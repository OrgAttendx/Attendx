# Production Deployment & Troubleshooting Guide

## 1. Required "Redeploy" Step
I have updated the code to automatically detect your frontend URL. For these changes to take effect, you **MUST**:
1.  **Commit and Push** the latest changes to GitHub.
2.  **Redeploy** your Backend (Render).
3.  **Redeploy** your Frontend (Vercel/Netlify).

## 2. Environment Variables Verification

### Backend (Render)
Your provided configuration looks correct:
*   `SMTP_HOST`: `smtp.gmail.com`
*   `SMTP_PORT`: `587`
*   `SMTP_USER`: (Your Gmail)
*   `SMTP_PASSWORD`: (Your App Password) - *Ensure there are no leading/trailing spaces.*
*   `FRONTEND_URL`: (Your Frontend URL) - *My code fix makes this optional, but keep it as a backup.*

### Frontend (Vercel)
You must ensure `VITE_API_URL` is set correctly in your Vercel Project Settings:
*   **Key**: `VITE_API_URL`
*   **Value**: `https://your-backend-name.onrender.com` (Replace with your actual backend URL)
*   **Important**: Do NOT include a trailing slash `/` at the end.
    *   ✅ Correct: `https://api.site.com`
    *   ❌ Incorrect: `https://api.site.com/`

## 3. How the Fix Works
Previously, the "Reset Password" link in the email was generated using the `FRONTEND_URL` variable on the backend. If that variable was wrong (or `localhost`), the link was broken.

**The New Fix:**
1.  When a user requests a password reset, the **Frontend** now sends its own URL (`window.location.origin`) to the Backend.
2.  The **Backend** uses this exact URL to generate the link in the email.
3.  This guarantees the link always points back to the correct website, regardless of server configuration.

## 4. Troubleshooting "Network Error"
If the button spins and then shows "Could not connect to server":
*   This means `VITE_API_URL` is missing or incorrect in your **Frontend** build.
*   Check the Browser Console (F12) -> Network tab.
*   If you see requests going to `http://localhost:8000/...`, then `VITE_API_URL` is not being picked up.
*   **Fix**: Update `VITE_API_URL` in Vercel and **Trigger a New Deployment** (Rebuild).
