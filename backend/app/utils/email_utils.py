# app/utils/email_utils.py
import os
import asyncio
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

# Load from environment (Render or .env)
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
MAIL_FROM = os.getenv("MAIL_FROM")  # no default fallback now — required


async def send_reset_code(email: str, code: str):
    """Send password reset email using SendGrid API."""
    if not SENDGRID_API_KEY:
        raise ValueError("Missing SENDGRID_API_KEY")
    if not MAIL_FROM:
        raise ValueError("Missing MAIL_FROM")

    subject = "Your TruNorth Password Reset Code"
    content = f"""
    Hello 👋,

    Here’s your 6-digit password reset code: <b>{code}</b>

    This code will expire in 10 minutes. 
    Please do not share it with anyone.

    — TruNorth Team
    """

    message = Mail(
        from_email=MAIL_FROM,
        to_emails=email,
        subject=subject,
        html_content=content.replace("\n", "<br>")
    )

    try:
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(
            None, lambda: SendGridAPIClient(SENDGRID_API_KEY).send(message)
        )
        print(f"✅ Password reset email sent to {email}")
    except Exception as e:
        print(f"❌ Failed to send email to {email}: {e}")
        raise
