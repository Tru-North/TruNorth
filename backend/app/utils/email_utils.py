# app/utils/email_utils.py
import os
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr

conf = ConnectionConfig(
    MAIL_USERNAME=os.getenv("MAIL_USERNAME"),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD"),
    MAIL_FROM=os.getenv("MAIL_FROM"),
    MAIL_PORT=587,
    MAIL_SERVER="smtp.gmail.com",
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
)

async def send_reset_code(email: EmailStr, code: str):
    """Send password reset code to the user via email."""
    message = MessageSchema(
        subject="Your TruNorth Password Reset Code",
        recipients=[email],
        body=f"""
        Hello,

        Your password reset code is: {code}

        This code will expire in 10 minutes.
        If you didn’t request this, please ignore this email.

        — TruNorth Team
        """,
        subtype=MessageType.plain
    )
    fm = FastMail(conf)
    await fm.send_message(message)
