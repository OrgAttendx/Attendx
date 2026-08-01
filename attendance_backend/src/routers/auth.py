from datetime import datetime
from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy import text
from src.core.database import engine
from src.core.security import verify_password, get_password_hash, create_access_token, create_reset_token, create_reset_token_expiry, verify_token
from src.core.email import send_password_reset_email
from src.core.config import FACULTY_REGISTER_KEY
from src.models.schemas import LoginRequest, RegisterRequest, ForgotPasswordRequest, ResetPasswordRequest, DeleteAccountRequest, ChangeFirstPasswordRequest
from src.core.logging_config import get_logger

logger = get_logger("auth")
router = APIRouter(tags=["auth"])

@router.post("/login")
async def login(request: LoginRequest):
    """Login with email and password, returns JWT token"""
    logger.info(f"🔑 [AUTH/LOGIN] Attempting login for email: {request.email}")
    try:
        # Truncate password to 72 bytes (bcrypt limit) to avoid errors
        password = request.password
        if len(password.encode('utf-8')) > 72:
            password = password[:72]
        
        async with engine.connect() as conn:
            q = text(
                "SELECT user_id, name, email, password_hash, role, COALESCE(must_change_password, FALSE) AS must_change_password FROM users WHERE email = :email"
            )
            result = await conn.execute(q, {"email": request.email})
            row = result.fetchone()
            
            if not row:
                logger.warning(f"⚠️ [AUTH/LOGIN] Failed login: User not found ({request.email})")
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
                logger.warning(f"⚠️ [AUTH/LOGIN] Failed login: Incorrect password ({request.email})")
                raise HTTPException(status_code=401, detail="Invalid email or password")
            
            # Create JWT token
            access_token = create_access_token(
                data={"sub": user["user_id"], "role": user["role"], "email": user["email"]}
            )
            
            logger.info(f"✅ [AUTH/LOGIN] Login successful for user_id={user['user_id']} ({user['email']}, role={user['role']})")
            return {
                "message": "Login successful",
                "access_token": access_token,
                "token_type": "bearer",
                "user_id": user["user_id"],
                "name": user["name"],
                "email": user["email"],
                "role": user["role"],
                "must_change_password": bool(user.get("must_change_password", False)),
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"❌ [AUTH/LOGIN] Unexpected error during login for {request.email}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/register")
async def register(request: RegisterRequest):
    """Register a new user (student or faculty). Requires a valid registration key."""
    logger.info(f"📝 [AUTH/REGISTER] Attempting registration for email: {request.email}, role: {request.role}")
    try:
        # Validate role
        if request.role not in ["STUDENT", "FACULTY"]:
            logger.warning(f"⚠️ [AUTH/REGISTER] Invalid role requested: {request.role}")
            raise HTTPException(status_code=400, detail="Role must be STUDENT or FACULTY")
        
        # Validate registration key (faculty only — students register freely)
        if request.role == "FACULTY":
            if not request.register_key or request.register_key != FACULTY_REGISTER_KEY:
                logger.warning(f"⚠️ [AUTH/REGISTER] Invalid faculty registration key for email: {request.email}")
                raise HTTPException(status_code=403, detail="Invalid registration key. Contact your administrator to get the correct key.")
        
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
                logger.warning(f"⚠️ [AUTH/REGISTER] Email already exists: {request.email}")
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
            try:
                result = await conn.execute(
                    insert_sql,
                    {
                        "name": request.name,
                        "email": request.email,
                        "password": hashed_password,
                        "role": request.role
                    }
                )
            except Exception as reg_err:
                if "unique" in str(reg_err).lower() or "duplicate key" in str(reg_err).lower():
                    logger.warning(f"⚠️ [AUTH/REGISTER] Email already exists (race condition caught): {request.email}")
                    raise HTTPException(status_code=400, detail="Email already registered")
                raise reg_err
            
            user = dict(result.fetchone()._mapping)
            logger.info(f"✅ [AUTH/REGISTER] User registered successfully: user_id={user['user_id']}, role={user['role']}")
            
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
        logger.exception(f"❌ [AUTH/REGISTER] Error during registration for {request.email}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """Send password reset email"""
    logger.info(f"📧 [AUTH/FORGOT_PASSWORD] Forgot password requested for: {request.email}")
    try:
        async with engine.begin() as conn:
            # Check if user exists
            user_sql = text("SELECT user_id, name, email FROM users WHERE email = :email")
            result = await conn.execute(user_sql, {"email": request.email})
            user_row = result.fetchone()
            
            if not user_row:
                logger.info(f"ℹ️ [AUTH/FORGOT_PASSWORD] Email not found (silent return): {request.email}")
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
            logger.error(f"❌ [AUTH/FORGOT_PASSWORD] Failed to send reset email to {user['email']}")
            raise HTTPException(
                status_code=500,
                detail="Failed to send reset email. Please check SMTP configuration on the server."
            )
        
        logger.info(f"✅ [AUTH/FORGOT_PASSWORD] Password reset email sent to user_id={user['user_id']}")
        return {
            "message": "If the email exists, a reset link has been sent",
            "success": True
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"❌ [AUTH/FORGOT_PASSWORD] Error processing forgot password for {request.email}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process request: {str(e)}")


@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """Reset password using token"""
    logger.info("🔒 [AUTH/RESET_PASSWORD] Reset password attempt with token")
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
                logger.warning("⚠️ [AUTH/RESET_PASSWORD] Invalid or non-existent reset token")
                raise HTTPException(
                    status_code=400,
                    detail="Invalid or expired reset token"
                )
            
            token_data = dict(token_row._mapping)
            
            # Check if token is used
            if token_data["used"]:
                logger.warning(f"⚠️ [AUTH/RESET_PASSWORD] Token already used for user_id={token_data['user_id']}")
                raise HTTPException(
                    status_code=400,
                    detail="This reset link has already been used"
                )
            
            # Check if token is expired
            if datetime.utcnow() > token_data["expires_at"]:
                logger.warning(f"⚠️ [AUTH/RESET_PASSWORD] Token expired for user_id={token_data['user_id']}")
                raise HTTPException(
                    status_code=400,
                    detail="This reset link has expired"
                )
            
            # Mark token as used atomically to prevent double consumption
            mark_used_sql = text("""
                UPDATE password_reset_tokens
                SET used = TRUE
                WHERE token = :token AND used = FALSE
                RETURNING user_id
            """)
            mark_res = await conn.execute(mark_used_sql, {"token": request.token})
            if mark_res.rowcount == 0:
                logger.warning(f"⚠️ [AUTH/RESET_PASSWORD] Token already used or consumed concurrently for user_id={token_data['user_id']}")
                raise HTTPException(
                    status_code=400,
                    detail="This reset link has already been used"
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
            
            logger.info(f"✅ [AUTH/RESET_PASSWORD] Password reset successful for user_id={token_data['user_id']}")
        
        return {
            "message": "Password reset successful",
            "success": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"❌ [AUTH/RESET_PASSWORD] Unexpected error resetting password: {e}")
        raise HTTPException(status_code=500, detail="Failed to reset password")


@router.delete("/delete-account")
async def delete_account(request: DeleteAccountRequest):
    """Delete a user account and all associated data after password verification"""
    logger.info(f"🗑️ [AUTH/DELETE_ACCOUNT] Request to delete account for user_id={request.user_id}")
    try:
        async with engine.begin() as conn:
            # 1. Fetch user to verify password
            user_sql = text(
                "SELECT user_id, name, email, password_hash, role FROM users WHERE user_id = :user_id"
            )
            result = await conn.execute(user_sql, {"user_id": request.user_id})
            row = result.fetchone()

            if not row:
                logger.warning(f"⚠️ [AUTH/DELETE_ACCOUNT] User not found: user_id={request.user_id}")
                raise HTTPException(status_code=404, detail="User not found")

            user = dict(row._mapping)

            # 2. Verify password
            password_valid = False
            if user["password_hash"].startswith("$2b$"):
                password_valid = verify_password(request.password, user["password_hash"])
            else:
                password_valid = (request.password == user["password_hash"])

            if not password_valid:
                logger.warning(f"⚠️ [AUTH/DELETE_ACCOUNT] Incorrect password for account deletion: user_id={request.user_id}")
                raise HTTPException(status_code=401, detail="Incorrect password")

            # 3. Delete all related data (cascade)
            user_id = user["user_id"]
            role = user["role"]

            # Delete password reset tokens
            await conn.execute(
                text("DELETE FROM password_reset_tokens WHERE user_id = :user_id"),
                {"user_id": user_id}
            )

            if role == "FACULTY":
                class_ids_result = await conn.execute(
                    text("SELECT class_id FROM classes WHERE faculty_id = :user_id"),
                    {"user_id": user_id}
                )
                class_ids = [r[0] for r in class_ids_result.fetchall()]

                if class_ids:
                    await conn.execute(
                        text("""
                            DELETE FROM attendance_records 
                            WHERE session_id IN (
                                SELECT session_id FROM attendance_sessions 
                                WHERE class_id = ANY(:class_ids)
                            )
                        """),
                        {"class_ids": class_ids}
                    )

                    await conn.execute(
                        text("DELETE FROM attendance_sessions WHERE class_id = ANY(:class_ids)"),
                        {"class_ids": class_ids}
                    )

                    await conn.execute(
                        text("DELETE FROM class_enrollments WHERE class_id = ANY(:class_ids)"),
                        {"class_ids": class_ids}
                    )

                    await conn.execute(
                        text("DELETE FROM classes WHERE faculty_id = :user_id"),
                        {"user_id": user_id}
                    )

            elif role == "STUDENT":
                await conn.execute(
                    text("DELETE FROM attendance_records WHERE student_id = :user_id"),
                    {"user_id": user_id}
                )
                await conn.execute(
                    text("DELETE FROM class_enrollments WHERE student_id = :user_id"),
                    {"user_id": user_id}
                )

            # 4. Finally, delete the user
            await conn.execute(
                text("DELETE FROM users WHERE user_id = :user_id"),
                {"user_id": user_id}
            )

            logger.info(f"✅ [AUTH/DELETE_ACCOUNT] Account deleted successfully: user_id={user_id} ({user['email']})")

            return {
                "message": "Account deleted successfully",
                "success": True
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"❌ [AUTH/DELETE_ACCOUNT] Error deleting account user_id={request.user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete account: {str(e)}")


@router.post("/api/auth/change-first-password")
@router.post("/change-first-password")
async def change_first_password(
    request: ChangeFirstPasswordRequest,
    current_user: dict = Depends(verify_token)
):
    """Update user's password on first login and set must_change_password to FALSE"""
    user_id = current_user["user_id"]
    logger.info(f"🔑 [AUTH/CHANGE_FIRST_PASSWORD] Updating password for user_id={user_id}")
    
    if not request.new_password or len(request.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long")
    
    # Truncate password to 72 bytes (bcrypt limit)
    new_password = request.new_password
    if len(new_password.encode('utf-8')) > 72:
        new_password = new_password[:72]
        
    hashed_pwd = get_password_hash(new_password)
    
    try:
        async with engine.begin() as conn:
            q = text(
                """
                UPDATE users 
                SET password_hash = :hash, must_change_password = FALSE 
                WHERE user_id = :user_id
                """
            )
            await conn.execute(q, {"hash": hashed_pwd, "user_id": user_id})
            logger.info(f"✅ [AUTH/CHANGE_FIRST_PASSWORD] Password changed successfully for user_id={user_id}")
            return {"message": "Password updated successfully", "success": True}
    except Exception as e:
        logger.exception(f"❌ [AUTH/CHANGE_FIRST_PASSWORD] Error updating password for user_id={user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update password: {str(e)}")



