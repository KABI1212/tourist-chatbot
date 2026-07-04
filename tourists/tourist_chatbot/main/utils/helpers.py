"""
General helper utilities for the application.
"""

import os
import uuid
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def generate_session_id() -> str:
    """Generate a unique session ID for guest users."""
    return f"guest_{uuid.uuid4().hex[:16]}"


def get_client_ip(request) -> str:
    """Extract the client IP address from a request."""
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "unknown")


def is_environment_variable_set(var_name: str) -> bool:
    """Check if an environment variable is set and not empty."""
    value = os.getenv(var_name)
    return value is not None and value.strip() != ""


def get_env_or_default(var_name: str, default: str = "") -> str:
    """Get an environment variable or return a default value."""
    return os.getenv(var_name, default)


def check_required_env_vars() -> list:
    """
    Check all required environment variables.
    Returns a list of missing variable names.
    """
    required = [
        "SECRET_KEY",
        "GOOGLE_API_KEY",
        "MONGODB_URI",
        "DATABASE_NAME",
    ]
    missing = []
    for var in required:
        if not is_environment_variable_set(var):
            missing.append(var)
    if missing:
        logger.warning(f"Missing required environment variables: {', '.join(missing)}")
    return missing