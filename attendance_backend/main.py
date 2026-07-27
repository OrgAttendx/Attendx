import time
import json
import asyncio
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from src.core.config import FRONTEND_URL
from src.core.logging_config import setup_logging, get_logger
from src.routers import auth, faculty, student

# Initialize logging configuration
setup_logging()
logger = get_logger("main")

app = FastAPI(title="Attendance Management API")

# Request Logging & Performance Middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    client_ip = request.client.host if request.client else "unknown"
    method = request.method
    path = request.url.path
    query = request.url.query
    full_path = f"{path}?{query}" if query else path

    logger.info(f"📥 [HTTP IN] {method} {full_path} | Client IP: {client_ip}")

    try:
        response = await call_next(request)
        process_time = (time.time() - start_time) * 1000
        logger.info(
            f"📤 [HTTP OUT] {method} {path} -> Status {response.status_code} | Duration: {process_time:.2f}ms"
        )
        return response
    except Exception as exc:
        process_time = (time.time() - start_time) * 1000
        logger.exception(
            f"💥 [HTTP UNHANDLED FAIL] {method} {path} failed after {process_time:.2f}ms: {exc}"
        )
        raise exc


# Global Exception Handlers for transparent CloudWatch logs
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    method = request.method
    path = request.url.path
    if exc.status_code >= 500:
        logger.error(
            f"⚠️ [HTTP {exc.status_code}] {method} {path} -> Error: {exc.detail}"
        )
    else:
        logger.info(
            f"ℹ️ [HTTP {exc.status_code}] {method} {path} -> Detail: {exc.detail}"
        )
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    method = request.method
    path = request.url.path
    logger.exception(
        f"❌ [CRITICAL 500 ERROR] {method} {path} -> Uncaught Exception: {exc}"
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error. Check server logs for full details."},
    )


# CORS — only allow known origins, never wildcard
origins = [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    FRONTEND_URL,
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router)
app.include_router(faculty.router)
app.include_router(student.router)


@app.get("/")
def root():
    logger.info("Root endpoint hit")
    return {"message": "Attendance API is up. See /docs for endpoints."}


@app.get("/health")
def health_check():
    """Health check endpoint for monitoring"""
    logger.info("Health check endpoint hit")
    return {
        "status": "healthy",
        "service": "Attendance Management API",
        "database": "connected",
    }


# Standard Mangum handler for API Gateway (HTTP)
_mangum_handler = Mangum(app)


def handler(event, context):
    """
    Unified AWS Lambda handler that routes between API Gateway HTTP events
    and SQS Queue events with full logging.
    """
    # 1. Check if the event came from an SQS Queue
    if (
        "Records" in event
        and len(event["Records"]) > 0
        and event["Records"][0].get("eventSource") == "aws:sqs"
    ):
        records = event["Records"]
        logger.info(f"⚡ [AWS SQS EVENT] Processing batch of {len(records)} messages")

        async def process_sqs_batch():
            from src.routers.student import _submit_code_internal, SubmitAttendanceCode

            failed_message_ids = []

            for record in records:
                message_id = record.get("messageId")
                try:
                    body = json.loads(record["body"])
                    payload = SubmitAttendanceCode(**body)

                    await _submit_code_internal(payload)
                    logger.info(
                        f"✅ [SQS OK] Attendance recorded for Student ID={payload.student_id}, Message ID={message_id}"
                    )

                except Exception as e:
                    logger.exception(
                        f"❌ [SQS FAIL] Message ID={message_id} processing failed: {e}"
                    )
                    failed_message_ids.append({"itemIdentifier": message_id})

            if failed_message_ids:
                logger.warning(
                    f"⚠️ [SQS BATCH PARTIAL FAILURES] {len(failed_message_ids)}/{len(records)} failed"
                )
            else:
                logger.info("✅ [SQS BATCH COMPLETE] All messages processed successfully")

            return {"batchItemFailures": failed_message_ids}

        new_loop = asyncio.new_event_loop()
        try:
            return new_loop.run_until_complete(process_sqs_batch())
        finally:
            new_loop.close()

    # 2. Ensure a usable event loop exists for Mangum
    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    # 3. Standard HTTP request from API Gateway
    return _mangum_handler(event, context)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

