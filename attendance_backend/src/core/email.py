import os
from dotenv import load_dotenv
import resend

# Ensure env vars are loaded
load_dotenv()


async def send_password_reset_email(email: str, token: str, name: str, frontend_url: str = None) -> bool:
    """Send password reset email with verification link using Resend API"""
    try:
        resend_api_key = os.getenv("RESEND_API_KEY")
        from_email = os.getenv("RESEND_FROM_EMAIL", "AttendX <onboarding@resend.dev>")
        frontend_url_env = os.getenv("FRONTEND_URL", "http://localhost:5173")

        # Use provided frontend_url if available, otherwise fall back to env var
        base_url = frontend_url if frontend_url else frontend_url_env
        
        print(f"📧 [EMAIL] Attempting to send email to: {email}")
        print(f"📧 [EMAIL] RESEND_API_KEY set: {bool(resend_api_key)}")
        print(f"📧 [EMAIL] FROM_EMAIL: {from_email}")
        
        if not resend_api_key:
            print("❌ [EMAIL] RESEND_API_KEY not configured!")
            print(f"📧 Debug: Reset link would be: {base_url}/reset-password?token={token}")
            return False
        
        resend.api_key = resend_api_key
        reset_link = f"{base_url}/reset-password?token={token}"
        
        # HTML version
        html = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #4F46E5;">Password Reset Request</h2>
                    <p>Hi {name},</p>
                    <p>We received a request to reset your password for your AttendX account.</p>
                    <p>Click the button below to reset your password:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{reset_link}" 
                           style="background-color: #4F46E5; color: white; padding: 12px 30px; 
                                  text-decoration: none; border-radius: 8px; display: inline-block;">
                            Reset Password
                        </a>
                    </div>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style="color: #666; word-break: break-all;">{reset_link}</p>
                    <p style="color: #999; font-size: 14px; margin-top: 30px;">
                        This link will expire in 1 hour.<br>
                        If you didn't request this, please ignore this email.
                    </p>
                </div>
            </body>
        </html>
        """
        
        print(f"📧 [EMAIL] Sending via Resend API...")
        
        params = {
            "from": from_email,
            "to": [email],
            "subject": "Password Reset Request - AttendX",
            "html": html,
        }
        
        response = resend.Emails.send(params)
        print(f"✅ [EMAIL] Email sent successfully! Response: {response}")
        return True
        
    except Exception as e:
        print(f"❌ [EMAIL] Failed to send email: {type(e).__name__}: {str(e)}")
        return False
