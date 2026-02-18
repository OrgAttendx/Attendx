import smtplib
import ssl
import os
import asyncio
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from concurrent.futures import ThreadPoolExecutor

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")  # Your Gmail address
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")  # Your Gmail app password
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# Thread pool for blocking SMTP operations - prevents blocking the async event loop
_email_executor = ThreadPoolExecutor(max_workers=3, thread_name_prefix="email_sender")


def _send_email_sync(to_email: str, subject: str, html_content: str, text_content: str) -> bool:
    """Synchronous email sending - runs in a thread pool to avoid blocking"""
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = SMTP_USER
        msg["To"] = to_email
        
        part1 = MIMEText(text_content, "plain")
        part2 = MIMEText(html_content, "html")
        msg.attach(part1)
        msg.attach(part2)
        
        # Create SSL context for secure connection
        context = ssl.create_default_context()
        
        # Use timeout to prevent hanging indefinitely
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as server:
            server.starttls(context=context)
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        
        print(f"✅ Email sent to {to_email}")
        return True
        
    except smtplib.SMTPAuthenticationError as e:
        print(f"❌ SMTP Authentication failed: {str(e)}")
        print("   Make sure you're using a Gmail App Password, not your regular password.")
        return False
    except smtplib.SMTPException as e:
        print(f"❌ SMTP error: {str(e)}")
        return False
    except Exception as e:
        print(f"❌ Failed to send email: {str(e)}")
        return False


async def send_password_reset_email(email: str, token: str, name: str, frontend_url: str = None) -> bool:
    """Send password reset email with verification link - non-blocking"""
    try:
        # Use provided frontend_url if available, otherwise fall back to env var
        base_url = frontend_url if frontend_url else FRONTEND_URL
        if not SMTP_USER or not SMTP_PASSWORD:
            error_msg = "❌ SMTP credentials not configured. Email cannot be sent."
            print(error_msg)
            print(f"   Missing: SMTP_USER={bool(SMTP_USER)}, SMTP_PASSWORD={bool(SMTP_PASSWORD)}")
            print(f"   Set SMTP_USER and SMTP_PASSWORD environment variables in your deployment.")
            print(f"   Set SMTP_USER and SMTP_PASSWORD environment variables in your deployment.")
            print(f"📧 Debug: Reset link would be: {base_url}/reset-password?token={token}")
            return False
        
        if not base_url or base_url == "http://localhost:5173":
            print(f"⚠️  Warning: FRONTEND_URL is set to localhost. This will not work in production.")
            print(f"   Current URL: {base_url}")
        
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
        
        # Text version
        text = f"""
Password Reset Request

Hi {name},

We received a request to reset your password for your AttendX account.

Click the link below to reset your password:
{reset_link}

This link will expire in 1 hour.
If you didn't request this, please ignore this email.
        """
        
        # Run email sending in thread pool to avoid blocking the event loop
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            _email_executor,
            _send_email_sync,
            email,
            "Password Reset Request - AttendX",
            html,
            text
        )
        
        if result:
            print(f"✅ Password reset email sent to {email}")
        return result
        
    except Exception as e:
        print(f"❌ Failed to send email: {str(e)}")
        return False
