"""
Input validation utilities.

Provides reusable validation functions for user inputs.
"""

import re
import html
from typing import Tuple, Optional


def sanitize_html(text: str) -> str:
    """Escape HTML characters to prevent XSS attacks."""
    return html.escape(str(text), quote=True)


def validate_username(username: str) -> Tuple[bool, str]:
    """
    Validate a username.
    Returns (is_valid, error_message).
    """
    if not username or not username.strip():
        return False, "Username is required"
    
    username = username.strip()
    
    if len(username) < 3:
        return False, "Username must be at least 3 characters"
    
    if len(username) > 30:
        return False, "Username must be at most 30 characters"
    
    if not re.match(r"^[a-zA-Z0-9_]+$", username):
        return False, "Username can only contain letters, numbers, and underscores"
    
    return True, ""


def validate_email(email: str) -> Tuple[bool, str]:
    """
    Validate an email address.
    Returns (is_valid, error_message).
    """
    if not email or not email.strip():
        return False, "Email is required"
    
    email = email.strip().lower()
    
    if len(email) > 254:
        return False, "Email is too long"
    
    pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    if not re.match(pattern, email):
        return False, "Invalid email format"
    
    return True, ""


def validate_password(password: str, confirm_password: str = "") -> Tuple[bool, str]:
    """
    Validate a password.
    Returns (is_valid, error_message).
    """
    if not password:
        return False, "Password is required"
    
    if len(password) < 8:
        return False, "Password must be at least 8 characters"
    
    if len(password) > 128:
        return False, "Password must be at most 128 characters"
    
    if confirm_password and password != confirm_password:
        return False, "Passwords do not match"
    
    # Check for at least one uppercase letter
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter"
    
    # Check for at least one lowercase letter
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter"
    
    # Check for at least one digit
    if not re.search(r"[0-9]", password):
        return False, "Password must contain at least one number"
    
    return True, ""


def validate_phone(phone: str) -> Tuple[bool, str]:
    """
    Validate a phone number.
    Returns (is_valid, error_message).
    """
    if not phone:
        return False, "Phone number is required"
    
    phone = phone.strip()
    
    # Allow digits, spaces, +, -, and parentheses
    cleaned = re.sub(r"[\s\-\+\(\)]", "", phone)
    if not cleaned.isdigit():
        return False, "Phone number can only contain digits and common symbols"
    
    if len(cleaned) < 7 or len(cleaned) > 15:
        return False, "Invalid phone number length"
    
    return True, ""


def validate_chat_message(message: str) -> Tuple[bool, str, str]:
    """
    Validate a chat message.
    Returns (is_valid, error_message, sanitized_message).
    """
    if not message or not message.strip():
        return False, "Message cannot be empty", ""
    
    sanitized = sanitize_html(message.strip())
    
    if len(sanitized) > 500:
        return False, "Message must be 500 characters or less", sanitized[:500]
    
    return True, "", sanitized


def validate_rating(rating: int) -> Tuple[bool, str]:
    """
    Validate a rating value (1-5).
    Returns (is_valid, error_message).
    """
    try:
        rating = int(rating)
    except (ValueError, TypeError):
        return False, "Rating must be a number"
    
    if rating < 1 or rating > 5:
        return False, "Rating must be between 1 and 5"
    
    return True, ""