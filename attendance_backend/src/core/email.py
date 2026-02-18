import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")  # Your Gmail address
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")  # Your Gmail app password
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


async def send_password_reset_email(email: str, token: str, name: str) -> bool:
    """Send password reset email with verification link"""
    try:
        if not SMTP_USER or not SMTP_PASSWORD:
            print("⚠️  SMTP credentials not configured. Set SMTP_USER and SMTP_PASSWORD in .env")
            print(f"📧 Debug: Reset link would be: {FRONTEND_URL}/reset-password?token={token}")
            return False
        
        reset_link = f"{FRONTEND_URL}/reset-password?token={token}"
        
        # Create email
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Password Reset Request - AttendX"
        msg["From"] = SMTP_USER
        msg["To"] = email
        
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
        
        part1 = MIMEText(text, "plain")
        part2 = MIMEText(html, "html")
        msg.attach(part1)
        msg.attach(part2)
        
        # Send email
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        
        print(f"✅ Password reset email sent to {email}")
        return True
        
    except Exception as e:
        print(f"❌ Failed to send email: {str(e)}")
        return False
