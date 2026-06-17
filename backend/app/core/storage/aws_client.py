import boto3
from app.core.config import settings


def get_aws_session() -> boto3.Session:
    """Create a boto3 Session using the profile and region from app configuration."""
    kwargs = {}
    if settings.AWS_PROFILE:
        kwargs["profile_name"] = settings.AWS_PROFILE
    if settings.AWS_REGION:
        kwargs["region_name"] = settings.AWS_REGION
    return boto3.Session(**kwargs)


def get_dynamodb_resource():
    """Retrieve the DynamoDB resource from the active AWS session."""
    session = get_aws_session()
    return session.resource("dynamodb")


def get_s3_client():
    """Retrieve the S3 client from the active AWS session."""
    session = get_aws_session()
    return session.client("s3")
