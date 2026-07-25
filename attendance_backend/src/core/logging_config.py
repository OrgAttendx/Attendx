import logging
import sys

LOG_FORMAT = "%(asctime)s | %(levelname)-7s | %(name)s | %(message)s"

def setup_logging():
    """Configure structured logging for local development and AWS CloudWatch."""
    # Ensure stdout root logger handler is attached
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    
    # Clear existing handlers to avoid duplication in AWS Lambda / Mangum
    if root_logger.hasHandlers():
        root_logger.handlers.clear()
        
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(LOG_FORMAT))
    root_logger.addHandler(handler)
    
    # Reduce noise from noisy third-party libraries if needed
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("mangum").setLevel(logging.INFO)

def get_logger(name: str) -> logging.Logger:
    """Get a logger instance configured for the application."""
    return logging.getLogger(f"attendance.{name}")
