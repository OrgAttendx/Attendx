from datetime import datetime
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import text
from src.core.database import engine
from src.core.security import verify_password, get_password_hash, create_access_token, create_reset_token, create_reset_token_expiry
from src.core.email import send_password_reset_email
from src.models.schemas import LoginRequest, RegisterRequest, ForgotPasswordRequest, ResetPasswordRequest
from src.queries import create_notification

router = APIRouter(tags=["auth"])

@router.post("/login")
async def login(request: LoginRequest):
    """Login with email and password, returns JWT token"""
    try:
        # Truncate password to 72 bytes (bcrypt limit) to avoid errors
        password = request.password
        if len(password.encode('utf-8')) > 72:
            password = password[:72]
        
        async with engine.connect() as conn:
            q = text(
                "SELECT user_id, name, email, password_hash, role FROM users WHERE email = :email"
            )
            result = await conn.execute(q, {"email": request.email})
            row = result.fetchone()
            
            if not row:
                raise HTTPException(status_code=401, detail="Invalid email or password")
            
            user = dict(row._mapping)
            
            # Verify password - support both plain text (old) and bcrypt (new)
            password_valid = False
            if user["password_hash"].startswith("$2b$"):
                # Bcrypt hash
                password_valid = verify_password(password, user["password_hash"])
            else:
                # Plain text (legacy - for backward compatibility)
                password_valid = (password == user["password_hash"])
            
            if not password_valid:
                raise HTTPException(status_code=401, detail="Invalid email or password")
            
            # Create JWT token
            access_token = create_access_token(
                data={"sub": user["user_id"], "role": user["role"], "email": user["email"]}
            )
            
            return {
                "message": "Login successful",
                "access_token": access_token,
                "token_type": "bearer",
                "user_id": user["user_id"],
                "name": user["name"],
                "email": user["email"],
                "role": user["role"],
            }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[LOGIN] ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/register")
async def register(request: RegisterRequest):
    """Register a new user (student or faculty)"""
    try:
        print(f"[REGISTER] Attempting to register: {request.email}, role={request.role}")
        
        # Validate role
        if request.role not in ["STUDENT", "FACULTY"]:
            raise HTTPException(status_code=400, detail="Role must be STUDENT or FACULTY")
        
        # Validate password length
        if len(request.password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters long")
        
        # Truncate password to 72 bytes (bcrypt limit)
        password = request.password
        if len(password.encode('utf-8')) > 72:
            password = password[:72]
        
        async with engine.begin() as conn:
            # Check if email already exists
            check_sql = text("SELECT user_id FROM users WHERE email = :email")
            existing = await conn.execute(check_sql, {"email": request.email})
            if existing.fetchone():
                print(f"[REGISTER] Email already exists: {request.email}")
                raise HTTPException(status_code=400, detail="Email already registered")
            
            # Hash the password
            hashed_password = get_password_hash(password)
            
            # Insert new user
            insert_sql = text(
                """
                INSERT INTO users (name, email, password_hash, role)
                VALUES (:name, :email, :password, :role)
                RETURNING user_id, name, email, role
                """
            )
            result = await conn.execute(
                insert_sql,
                {
                    "name": request.name,
                    "email": request.email,
                    "password": hashed_password,
                    "role": request.role
                }
            )
            
            user = dict(result.fetchone()._mapping)
            print(f"[REGISTER] Successfully registered user_id={user['user_id']}")
            
            # Create welcome notification (needs separate transaction or fire-and-forget?)
            # Since we are in an async function, we can just await it. 
            # Note: create_notification manages its own connection/transaction.
            # Ideally we should use the same connection, but create_notification is a standalone helper.
            # Using standalone helper is safer to assume it works independently.
            await create_notification(
                user_id=user['user_id'],
                type="welcome",
                title="Welcome!",
                message=f"Welcome to the Attendance Management System, {user['name']}!",
                priority="low"
            )
            
            return {
                "message": "Registration successful",
                "user_id": user["user_id"],
                "name": user["name"],
                "email": user["email"],
                "role": user["role"]
            }
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"[REGISTER] ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """Send password reset email"""
    try:
        async with engine.begin() as conn:
            # Check if user exists
            user_sql = text("SELECT user_id, name, email FROM users WHERE email = :email")
            result = await conn.execute(user_sql, {"email": request.email})
            user_row = result.fetchone()
            
            if not user_row:
                # Don't reveal if email exists or not (security best practice)
                return {
                    "message": "If the email exists, a reset link has been sent",
                    "success": True
                }
            
            user = dict(user_row._mapping)
            
            # Generate reset token
            token = create_reset_token()
            expires_at = create_reset_token_expiry()
            
            # Delete any existing tokens for this user
            delete_sql = text("DELETE FROM password_reset_tokens WHERE user_id = :user_id")
            await conn.execute(delete_sql, {"user_id": user["user_id"]})
            
            # Store new token
            insert_sql = text("""
                INSERT INTO password_reset_tokens (user_id, token, expires_at)
                VALUES (:user_id, :token, :expires_at)
            """)
            await conn.execute(insert_sql, {
                "user_id": user["user_id"],
                "token": token,
                "expires_at": expires_at
            })
        
        # Send email
        email_sent = await send_password_reset_email(
            email=user["email"],
            token=token,
            name=user["name"],
            frontend_url=request.frontend_url
        )
        
        if not email_sent:
            print(f"⚠️  Failed to send reset email to {user['email']}")
            raise HTTPException(
                status_code=500,
                detail="Failed to send reset email. Please check SMTP configuration on the server."
            )
        
        return {
            "message": "If the email exists, a reset link has been sent",
            "success": True
        }
        
    except Exception as e:
        print(f"[FORGOT_PASSWORD] ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to process request")


@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """Reset password using token"""
    try:
        if len(request.new_password) < 6:
            raise HTTPException(
                status_code=400,
                detail="Password must be at least 6 characters long"
            )
        
        async with engine.begin() as conn:
            # Find valid token
            token_sql = text("""
                SELECT prt.user_id, prt.expires_at, prt.used, u.email, u.name
                FROM password_reset_tokens prt
                JOIN users u ON u.user_id = prt.user_id
                WHERE prt.token = :token
            """)
            result = await conn.execute(token_sql, {"token": request.token})
            token_row = result.fetchone()
            
            if not token_row:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid or expired reset token"
                )
            
            token_data = dict(token_row._mapping)
            
            # Check if token is used
            if token_data["used"]:
                raise HTTPException(
                    status_code=400,
                    detail="This reset link has already been used"
                )
            
            # Check if token is expired
            if datetime.utcnow() > token_data["expires_at"]:
                raise HTTPException(
                    status_code=400,
                    detail="This reset link has expired"
                )
            
            # Hash new password
            new_password_hash = get_password_hash(request.new_password)
            
            # Update password
            update_sql = text("""
                UPDATE users 
                SET password_hash = :password_hash
                WHERE user_id = :user_id
            """)
            await conn.execute(update_sql, {
                "password_hash": new_password_hash,
                "user_id": token_data["user_id"]
            })
            
            # Mark token as used
            mark_used_sql = text("""
                UPDATE password_reset_tokens
                SET used = TRUE
                WHERE token = :token
            """)
            await conn.execute(mark_used_sql, {"token": request.token})
            
            print(f"✅ Password reset successful for user_id={token_data['user_id']}")
        
        return {
            "message": "Password reset successful",
            "success": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[RESET_PASSWORD] ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to reset password")
