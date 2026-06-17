import json
from decimal import Decimal
from datetime import datetime
from uuid import UUID

def python_to_dynamodb(val):
    """Recursively convert float objects to Decimal for DynamoDB storage."""
    if isinstance(val, float):
        return Decimal(str(val))
    elif isinstance(val, dict):
        return {k: python_to_dynamodb(v) for k, v in val.items()}
    elif isinstance(val, list):
        return [python_to_dynamodb(v) for v in val]
    elif isinstance(val, tuple):
        return tuple(python_to_dynamodb(v) for v in val)
    elif isinstance(val, UUID):
        return str(val)
    elif isinstance(val, datetime):
        return val.isoformat()
    return val

def dynamodb_to_python(val):
    """Recursively convert Decimal objects back to standard float or int."""
    if isinstance(val, Decimal):
        if val % 1 == 0:
            return int(val)
        return float(val)
    elif isinstance(val, dict):
        return {k: dynamodb_to_python(v) for k, v in val.items()}
    elif isinstance(val, list):
        return [dynamodb_to_python(v) for v in val]
    elif isinstance(val, tuple):
        return tuple(dynamodb_to_python(v) for v in val)
    return val


