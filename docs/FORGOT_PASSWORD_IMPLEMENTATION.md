# Forgot Password Feature Implementation

## Overview

This document describes the implementation of the forgot password feature with email verification for the Faculty Student Hub application.

## Features Implemented

- **Password Reset Request**: Users can request a password reset via email
- **Email Verification**: Secure token-based verification via Gmail SMTP
- **Token Expiry**: Reset links expire after 1 hour
- **One-Time Use**: Tokens can only be used once
- **Security**: No email enumeration, secure token generation
- **User-Friendly UI**: Professional email templates and responsive pages

## Architecture

### Flow Diagram

```
User requests reset → Email sent with token → User clicks link →
New password set → Token marked as used → Success
```

### Components

1. **Backend**: FastAPI endpoints for password reset
2. **Database**: Token storage with expiry tracking
3. **Email Service**: Gmail SMTP integration
4. **Frontend**: React pages for forgot/reset password

---

## Backend Changes

### 1. New Files Created

#### `attendance_backend/src/core/email.py`

**Purpose**: Email utility for sending password reset emails via Gmail SMTP

**Key Functions**:

- `send_password_reset_email(email, token, name)` - Sends HTML/text email with reset link

**Features**:

- HTML and plain text email versions
- Professional email template
- Configurable SMTP settings via environment variables
- Error handling and logging

#### `attendance_backend/sql/create_password_reset_tokens.sql`

**Purpose**: Database migration to create password reset tokens table

**Schema**:

```sql
CREATE TABLE password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes**:

- `idx_password_reset_token` - Fast token lookup
- `idx_password_reset_user_id` - User-based queries

#### `attendance_backend/run_password_reset_migration.py`

**Purpose**: Helper script to run the database migration

### 2. Modified Files

#### `attendance_backend/src/core/security.py`

**Added Functions**:

```python
def create_reset_token() -> str:
    """Generate a secure random token for password reset"""
    return secrets.token_urlsafe(32)

def create_reset_token_expiry() -> datetime:
    """Create expiration time for reset token (1 hour from now)"""
    return datetime.utcnow() + timedelta(hours=1)
```

**Imports Added**:

- `import secrets`

#### `attendance_backend/src/core/config.py`

**Added Configuration**:

```python
# Email Configuration
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
```

#### `attendance_backend/src/models/schemas.py`

**Added Models**:

```python
class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str
```

#### `attendance_backend/src/routers/auth.py`

**Added Endpoints**:

1. **POST `/forgot-password`**
   - Accepts: `{ "email": "user@example.com" }`
   - Generates reset token
   - Sends email with reset link
   - Returns generic success message (security)

2. **POST `/reset-password`**
   - Accepts: `{ "token": "...", "new_password": "..." }`
   - Validates token (existence, expiry, used status)
   - Updates user password
   - Marks token as used

**Imports Added**:

```python
from datetime import datetime
from src.core.security import create_reset_token, create_reset_token_expiry
from src.core.email import send_password_reset_email
from src.models.schemas import ForgotPasswordRequest, ResetPasswordRequest
```

#### `attendance_backend/.env`

**Added Configuration**:

```env
# Email Configuration for Password Reset
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=achyutshekhar54@gmail.com
SMTP_PASSWORD=xtlqsfbrdwjkhdks
FRONTEND_URL=http://localhost:5173
```

---

## Frontend Changes

### 1. New Pages Created

#### `frontend/src/pages/ForgotPassword.jsx`

**Purpose**: Page where users request password reset

**Features**:

- Email input validation
- API call to `/forgot-password`
- Success state with email confirmation
- Loading states and error handling
- Responsive design with animations
- Back to login navigation

**User Flow**:

1. User enters email
2. Clicks "Send Reset Link"
3. Sees success message
4. Receives email

#### `frontend/src/pages/ResetPassword.jsx`

**Purpose**: Page where users reset their password using email token

**Features**:

- Token extraction from URL query params
- Password and confirm password fields
- Password visibility toggle
- Token validation
- Success state with auto-redirect
- Error handling for expired/invalid tokens
- Responsive design matching app theme

**User Flow**:

1. User clicks link from email
2. Enters new password
3. Confirms password
4. Submits form
5. Redirected to login

### 2. Modified Files

#### `frontend/src/App.jsx`

**Added Routes**:

```jsx
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";

// In Routes:
<Route path="/forgot-password" element={<ForgotPassword />} />
<Route path="/reset-password" element={<ResetPassword />} />
```

#### `frontend/src/pages/Login.jsx`

**Added Element**:

```jsx
{
  /* After password input field */
}
<div className="flex justify-end">
  <button
    type="button"
    onClick={() => navigate("/forgot-password")}
    className="text-xs sm:text-sm text-primary hover:underline"
  >
    Forgot password?
  </button>
</div>;
```

---

## Database Schema

### New Table: `password_reset_tokens`

| Column       | Type         | Description                 |
| ------------ | ------------ | --------------------------- |
| `id`         | SERIAL       | Primary key                 |
| `user_id`    | INTEGER      | Foreign key to users table  |
| `token`      | VARCHAR(255) | Unique reset token          |
| `expires_at` | TIMESTAMP    | Token expiration time       |
| `used`       | BOOLEAN      | Whether token has been used |
| `created_at` | TIMESTAMP    | Token creation time         |

**Indexes**:

- Primary key on `id`
- Unique constraint on `token`
- Index on `token` for fast lookups
- Index on `user_id` for user-based queries

**Constraints**:

- Foreign key to `users(user_id)` with CASCADE delete
- Unique token ensures no duplicates

---

## API Endpoints

### POST `/forgot-password`

**Request**:

```json
{
  "email": "user@example.com"
}
```

**Response** (200 OK):

```json
{
  "message": "If the email exists, a reset link has been sent",
  "success": true
}
```

**Security Notes**:

- Returns same response whether email exists or not
- Prevents email enumeration attacks

### POST `/reset-password`

**Request**:

```json
{
  "token": "secure-token-from-email",
  "new_password": "newpassword123"
}
```

**Response** (200 OK):

```json
{
  "message": "Password reset successful",
  "success": true
}
```

**Errors**:

- `400`: Invalid/expired/used token
- `400`: Password too short (< 6 characters)
- `500`: Server error

---

## Email Template

### HTML Email Content

The reset email includes:

- Professional header with branding
- Personalized greeting
- Clear call-to-action button
- Plain text link (for accessibility)
- Security notice about expiration
- Instructions if email was not requested

### Email Styling

- Responsive design
- Primary brand color (#4F46E5)
- Clear typography
- Mobile-friendly

---

## Security Features

### 1. Token Security

- **Cryptographically secure**: Uses `secrets.token_urlsafe(32)`
- **Unique per request**: New token generated each time
- **Time-limited**: Expires after 1 hour
- **One-time use**: Marked as used after successful reset

### 2. Email Enumeration Prevention

- Same response for existing and non-existing emails
- No indication whether email is in system

### 3. Password Validation

- Minimum 6 characters
- Bcrypt hashing with salt
- 72-byte truncation (bcrypt limit)

### 4. Database Security

- Tokens stored with expiry timestamp
- Old tokens deleted before creating new ones
- Cascade delete when user is removed

### 5. HTTPS Ready

- Email links support HTTPS via `FRONTEND_URL` env var
- Production deployment should use HTTPS

---

## Configuration Guide

### Gmail Setup

1. **Enable 2-Factor Authentication**:
   - Go to https://myaccount.google.com/security
   - Enable 2-Step Verification

2. **Generate App Password**:
   - Go to Security → App passwords
   - Select app: Mail
   - Select device: Other (Custom name)
   - Enter "AttendX" and click Generate
   - Copy the 16-character password

3. **Update Environment Variables**:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=your-16-char-app-password
   FRONTEND_URL=http://localhost:5173
   ```

### Database Migration

Run the migration script:

```bash
cd attendance_backend
py run_password_reset_migration.py
```

Or execute SQL directly:

```bash
psql -U username -d database -f sql/create_password_reset_tokens.sql
```

---

## Testing Guide

### Manual Testing

1. **Test Forgot Password Flow**:

   ```
   1. Go to http://localhost:5173/login
   2. Click "Forgot password?"
   3. Enter registered email
   4. Check email inbox
   5. Click reset link
   6. Enter new password
   7. Verify redirect to login
   8. Login with new password
   ```

2. **Test Error Cases**:
   - Invalid email format
   - Expired token (after 1 hour)
   - Already used token
   - Password mismatch
   - Password too short

3. **Test Security**:
   - Try using same token twice
   - Check non-existing email (should get same response)
   - Verify token format in database

### API Testing with curl

**Forgot Password**:

```bash
curl -X POST http://localhost:8000/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

**Reset Password**:

```bash
curl -X POST http://localhost:8000/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token":"TOKEN_FROM_EMAIL","new_password":"newpass123"}'
```

---

## Troubleshooting

### Email Not Sending

**Check**:

1. SMTP credentials in `.env`
2. App password (not regular Gmail password)
3. Gmail 2FA is enabled
4. Check backend console for error messages

**Debug Mode**:
The email utility prints the reset link to console if SMTP is not configured.

### Token Issues

**Invalid Token**:

- Check if token expired (1 hour limit)
- Verify token wasn't already used
- Check database `password_reset_tokens` table

**Database Check**:

```sql
SELECT * FROM password_reset_tokens
WHERE token = 'YOUR_TOKEN';
```

### Frontend Issues

**Reset page shows "Invalid Link"**:

- Token parameter missing from URL
- Check URL format: `/reset-password?token=...`

**Errors in console**:

- Check backend is running on port 8000
- Verify CORS settings
- Check API_URL in frontend `.env`

---

## Production Considerations

### Security Enhancements

1. **HTTPS Only**: Use HTTPS in production

   ```env
   FRONTEND_URL=https://yourdomain.com
   ```

2. **Rate Limiting**: Add rate limiting to prevent abuse

   ```python
   # Limit to 3 requests per hour per IP
   ```

3. **Token Cleanup**: Add cron job to delete expired tokens

   ```sql
   DELETE FROM password_reset_tokens
   WHERE expires_at < NOW() - INTERVAL '24 hours';
   ```

4. **Logging**: Add logging for security events
   - Failed reset attempts
   - Unusual patterns
   - Email sending failures

### Email Service Alternatives

For production, consider:

- **SendGrid**: Better deliverability
- **AWS SES**: Scalable, cheap
- **Mailgun**: Developer-friendly
- **Postmark**: Transactional emails

### Monitoring

Track:

- Email delivery success rate
- Token usage patterns
- Failed reset attempts
- Average time to token usage

---

## File Summary

### Created Files (8)

1. `attendance_backend/src/core/email.py`
2. `attendance_backend/sql/create_password_reset_tokens.sql`
3. `attendance_backend/run_password_reset_migration.py`
4. `frontend/src/pages/ForgotPassword.jsx`
5. `frontend/src/pages/ResetPassword.jsx`
6. `docs/FORGOT_PASSWORD_IMPLEMENTATION.md` (this file)

### Modified Files (6)

1. `attendance_backend/src/core/security.py`
2. `attendance_backend/src/core/config.py`
3. `attendance_backend/src/models/schemas.py`
4. `attendance_backend/src/routers/auth.py`
5. `frontend/src/App.jsx`
6. `frontend/src/pages/Login.jsx`
7. `attendance_backend/.env`

---

## Support

For issues or questions:

1. Check troubleshooting section above
2. Verify all configuration steps completed
3. Check backend console logs
4. Test with curl commands
5. Open GitHub issue with error details

---

## Future Enhancements

Potential improvements:

- [ ] SMS-based password reset
- [ ] Security questions as alternative
- [ ] Password strength meter
- [ ] Password history (prevent reuse)
- [ ] Account lockout after multiple failed attempts
- [ ] Email notification on successful password change
- [ ] Custom email templates per tenant
- [ ] Multi-language email support

---

**Last Updated**: February 18, 2026  
**Version**: 1.0.0  
**Author**: GitHub Copilot
