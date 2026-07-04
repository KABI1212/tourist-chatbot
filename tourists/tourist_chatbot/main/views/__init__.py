"""
Views package - exposes all view functions for URL routing.
"""

from .auth import (
    register_view,
    login_view,
    logout_view,
    profile_view,
    change_password_view,
    forgot_password_view,
    api_login_view,
)
from .chat import (
    chat_view,
    chat_api_view,
    chat_history_view,
    chat_delete_view,
    chat_clear_view,
)
from .home import home_view, dashboard_view

__all__ = [
    "register_view",
    "login_view",
    "logout_view",
    "profile_view",
    "change_password_view",
    "forgot_password_view",
    "api_login_view",
    "chat_view",
    "chat_api_view",
    "chat_history_view",
    "chat_delete_view",
    "chat_clear_view",
    "home_view",
    "dashboard_view",
]