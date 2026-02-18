# Deployment Guide

## Target Environment

This application is optimized for **Render.com** (specifically the Free Tier), but can technically run on any platform supporting Python and Node.js.

## Prerequisites

- **GitHub Repository**: The code must be pushed to a public or private GitHub repository.
- **Render Account**: A valid account on Render.com.
- **PostgreSQL Database**: An external Postgres database (e.g., Render Postgres or Supabase).

## Critical Configuration

To ensure the application runs stably on low-resource environments, the following configurations are mandatory:

### 1. Build Command

We use a unified build command to install dependencies and apply migrations:

```bash
pip install -r requirements.txt && python database_manager.py
```

_Note: Ensure `database_manager.py` is in the root directory._

### 2. Start Command

The backend is served using Uvicorn:

```bash
python -m uvicorn main:app --host 0.0.0.0 --port $PORT
```

_Note: `main.py` is located in the root `attendance_backend` folder (after restructuring)._

### 3. Environment Variables

Set the following secrets in your hosting dashboard:

**Required:**

- `DATABASE_URL`: Full connection string (e.g., `postgresql://user:pass@host/dbname`)
- `SECRET_KEY`: A random string for JWT encryption.
- `ALGORITHM`: `HS256`
- `ACCESS_TOKEN_EXPIRE_MINUTES`: `10080` (7 days)
- `FRONTEND_URL`: Your production frontend URL (e.g., `https://yourapp.vercel.app` or `https://yourapp.render.com`)

**Required for Forgot Password Feature:**

- `SMTP_HOST`: SMTP server host (default: `smtp.gmail.com` for Gmail)
- `SMTP_PORT`: SMTP server port (default: `587` for TLS)
- `SMTP_USER`: Your email address (e.g., `yourapp@gmail.com`)
- `SMTP_PASSWORD`: Your email password or app-specific password (see Gmail setup below)

#### Setting Up Gmail for Password Reset Emails

1. **Create or use a Gmail account** for sending password reset emails
2. **Enable 2-Factor Authentication** on your Gmail account
3. **Generate an App Password**:
   - Go to Google Account Settings → Security → 2-Step Verification
   - Scroll to "App passwords" and click it
   - Select "Mail" and "Other (Custom name)" → Enter "AttendX" or your app name
   - Google will generate a 16-character password
   - **Use this App Password** as your `SMTP_PASSWORD` environment variable
4. Set the environment variables:
   - `SMTP_HOST=smtp.gmail.com`
   - `SMTP_PORT=587`
   - `SMTP_USER=your-email@gmail.com`
   - `SMTP_PASSWORD=your-16-char-app-password`

**Important:** Never commit SMTP credentials to your repository. Always use environment variables.

#### Adding Environment Variables on Render.com

1. Go to your **Render Dashboard** → Select your backend service
2. Click on **Environment** in the left sidebar
3. Add the following environment variables:

| Key             | Value                                  |
| --------------- | -------------------------------------- |
| `SMTP_HOST`     | `smtp.gmail.com`                       |
| `SMTP_PORT`     | `587`                                  |
| `SMTP_USER`     | `your-email@gmail.com`                 |
| `SMTP_PASSWORD` | `your-16-char-app-password`            |
| `FRONTEND_URL`  | `https://your-frontend-url.vercel.app` |

4. Click **Save Changes**
5. Render will automatically redeploy your service with the new variables

## Troubleshooting Deployments

### "Module not found: src"

- **Cause:** Python path issue.
- **Fix:** Ensure you are running `main:app`, NOT `src.main:app`. We moved `main.py` to the root of the backend folder to simplify imports.

### "500 Internal Server Error" on Login

- **Cause:** Database connectivity or missing tables.
- **Fix:** Check logs. If "relation does not exist", your migrations failed. run `python database_manager.py` manually locally or via the build command.

### "Timeout" / "High Latency"

- **Cause:** Too many concurrent connections or aggressive polling.
- **Fix:** We have already patched this by increasing frontend polling intervals to 10s-20s and disabling expensive notification writes. Do not revert these changes without upgrading your server plan.

### "Forgot Password Not Working"

- **Cause:** Missing SMTP credentials in production environment.
- **Fix:**
  1. Check your server logs for messages like "SMTP credentials not configured"
  2. Ensure all SMTP environment variables are set: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`
  3. Verify your Gmail App Password is correct (16 characters, no spaces)
  4. Confirm `FRONTEND_URL` is set to your production URL (not localhost)
  5. Test email sending by checking server logs after requesting a password reset

### "Password Reset Email Not Received"

- **Cause:** Email going to spam, wrong SMTP credentials, or email service blocking.
- **Fix:**
  1. Check spam/junk folder
  2. Verify SMTP credentials are correct in environment variables
  3. Check server logs for email sending errors
  4. Ensure Gmail "Less secure app access" is disabled (use App Password instead)
  5. Verify your Gmail account is not locked or suspended
