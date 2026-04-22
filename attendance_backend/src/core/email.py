import os
import json
import boto3

# Ensure you have the SQS URL in your .env
EMAIL_QUEUE_URL = os.getenv("EMAIL_QUEUE_URL")

# Initialize Boto3 client outside the function for connection reuse
# Ensure your VPC has an Interface Endpoint for SQS!
sqs_client = boto3.client('sqs', region_name='ap-south-1')

async def send_password_reset_email(email: str, token: str, name: str, frontend_url: str = None) -> bool:
    """Drops the password reset payload into SQS for the external worker to process"""
    try:
        frontend_url_env = os.getenv("FRONTEND_URL", "http://localhost:5173")
        base_url = frontend_url if frontend_url else frontend_url_env

        payload = {
            "email": email,
            "token": token,
            "name": name,
            "frontend_url": base_url
        }

        print(f"📥 [QUEUE] Dropping reset email task into SQS for: {email}")
        
        response = sqs_client.send_message(
            QueueUrl=EMAIL_QUEUE_URL,
            MessageBody=json.dumps(payload)
        )
        
        print(f"✅ [QUEUE] Task queued successfully. MessageId: {response.get('MessageId')}")
        return True
        
    except Exception as e:
        print(f"❌ [QUEUE] Failed to queue email task: {type(e).__name__}: {str(e)}")
        return False