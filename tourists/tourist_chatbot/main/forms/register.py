"""
Registration form handling with validation.
"""

from ..utils.validators import (
    validate_username,
    validate_email,
    validate_password,
    validate_phone,
    sanitize_html,
)
from typing import Dict, Any, Tuple


def clean_registration_data(post_data: Dict[str, str]) -> Tuple[Dict[str, Any], str]:
    """
    Clean and validate registration form data.
    
    Args:
        post_data: Dictionary of POST data from the registration form.
    
    Returns:
        Tuple of (cleaned_data_dict, error_message).
        If validation passes, error_message is empty string.
    """
    username = post_data.get("username", "").strip()
    email = post_data.get("email", "").strip().lower()
    password = post_data.get("password", "")
    confirm_password = post_data.get("confirm_password", "")
    full_name = sanitize_html(post_data.get("full_name", "").strip())
    phone = post_data.get("phone", "").strip()
    address = sanitize_html(post_data.get("address", "").strip())

    # Validate username
    valid, error = validate_username(username)
    if not valid:
        return {}, error

    # Validate email
    valid, error = validate_email(email)
    if not valid:
        return {}, error

    # Validate password
    valid, error = validate_password(password, confirm_password)
    if not valid:
        return {}, error

    # Validate phone
    valid, error = validate_phone(phone)
    if not valid:
        return {}, error

    cleaned = {
        "username": username,
        "email": email,
        "password": password,
        "full_name": full_name,
        "phone": phone,
        "address": address,
    }

    return cleaned, ""


def clean_login_data(post_data: Dict[str, str]) -> Tuple[Dict[str, str], str]:
    """
    Clean and validate login form data.
    
    Args:
        post_data: Dictionary of POST data from the login form.
    
    Returns:
        Tuple of (cleaned_data_dict, error_message).
    """
    username = post_data.get("username", "").strip()
    password = post_data.get("password", "")

    if not username:
        return {}, "Username is required"

    if not password:
        return {}, "Password is required"

    return {"username": username, "password": password}, ""


def clean_profile_update_data(post_data: Dict[str, str]) -> Tuple[Dict[str, str], str]:
    """
    Clean and validate profile update data.
    
    Args:
        post_data: Dictionary of POST data.
    
    Returns:
        Tuple of (cleaned_data_dict, error_message).
    """
    full_name = sanitize_html(post_data.get("full_name", "").strip())
    phone = post_data.get("phone", "").strip()
    address = sanitize_html(post_data.get("address", "").strip())

    if not full_name:
        return {}, "Full name is required"

    valid, error = validate_phone(phone)
    if not valid:
        return {}, error

    return {
        "full_name": full_name,
        "phone": phone,
        "address": address,
    }, ""