# Password Reset Admin Key Configuration

## Overview

This document describes the configuration and security details of the Admin Password Reset feature, which allows Faculty members to directly reset any student's or user's password from their dashboard without requiring email token verification.

Historically, this authorization key was configured within environment variables. To improve the developer experience and prevent deployment bottlenecks, the configuration has been migrated to use a central application-level configuration constant with system-level environment overrides.

---

## Architecture and Flow

### Password Reset Flow

```
Faculty Dashboard → Request with User ID, New Password, & Admin Key
                         ↓
           Faculty Router (/api/faculty/admin/reset-password)
                         ↓
  Validates input length & Compares request key to RESET_ADMIN_KEY constant
                         ↓
  Updates targeted password in Database (hashed via Bcrypt) → Success
```

---

## Configuration Details

The admin authorization key is now defined inside the core configuration file:

### [config.py](file:///c:/Users/achyu/OneDrive/Documents/GitHub/facul-student-hub/attendance_backend/src/core/config.py)

```python
# Password Reset Admin Key
RESET_ADMIN_KEY = os.getenv("RESET_ADMIN_KEY", "AttendX@Reset#2026")
# find here this snippet
attendance_backend/src/core/config.py
```

### Key Behaviors:
1. **Zero-Config Default**: In development or standard deployments, the backend automatically uses the fallback value `"AttendX@Reset#2026"`. No entry is needed in `.env`.
2. **Production Overrides**: For production deployments, you can securely override this value by setting the `RESET_ADMIN_KEY` environment variable in your production hosting environment (e.g., AWS Lambda, Heroku, Docker) without needing to change source code.
3. **Insecure Local Files Prevention**: By keeping the key out of the local `.env` file, we reduce the risk of leaking secrets during local git operations.

---

## Codebase Implementation

### 1. Backend Changes

#### `attendance_backend/src/core/config.py`
We added `RESET_ADMIN_KEY` to retrieve the key from environment variables or fallback to a standard development key:
```python
RESET_ADMIN_KEY = os.getenv("RESET_ADMIN_KEY", "AttendX@Reset#2026")
```

#### `attendance_backend/src/routers/faculty.py`
We imported the config-level key and used it for verification in the reset password handler:
```python
from src.core.config import RESET_ADMIN_KEY

@router.post("/api/faculty/admin/reset-password")
async def admin_reset_password(request: AdminResetPasswordRequest):
    try:
        # Secure comparison of admin confirmation key
        server_admin_key = RESET_ADMIN_KEY
        if not server_admin_key:
            print("[ADMIN_RESET] SECURITY ALERT: RESET_ADMIN_KEY is not configured in the application config!")
            raise HTTPException(
                status_code=500,
                detail="Password reset is disabled: Admin reset key is not configured."
            )
        
        if not secrets.compare_digest(request.admin_key, server_admin_key):
            raise HTTPException(
                status_code=403,
                detail="Invalid admin reset key. Access denied."
            )
```

#### `attendance_backend/.env`
The key `RESET_ADMIN_KEY` has been safely removed from the local `.env` file.

---

## Testing Guide

### Manual Testing from UI

1. Log into your **Faculty Account** on the Faculty Student Hub.
2. Click **Reset Password** on the upper right corner of the dashboard.
3. Search for the student or faculty member whose password you wish to reset.
4. Input the new password (minimum 6 characters).
5. In the **Admin Reset Key** field, enter: `AttendX@Reset#2026`
6. Click **Reset Password**. The system will verify the key against the code constant and successfully reset the user's password.

### API Testing with `curl`

To trigger the password reset manually using the REST API:

```bash
curl -X POST http://localhost:8000/api/faculty/admin/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 123,
    "new_password": "secureNewPassword123",
    "admin_key": "AttendX@Reset#2026"
  }'
```

---

## Security Best Practices

### Constant Time Comparison
The verification utilizes Python's built-in `secrets.compare_digest` to prevent timing attacks. Traditional string equality comparisons can leak information because they return false as soon as a mismatch is found, allowing attackers to guess strings character-by-character based on processing duration.

### Production Environment Setup
In production environments (e.g. AWS ECS/Lambda, Google Cloud Run), you should configure a custom, long, randomly generated secret as the `RESET_ADMIN_KEY` environment variable. Do not reuse the development fallback key in production.
