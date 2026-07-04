"""
Logging configuration for the Tourist Chatbot application.

Configures logging for:
- Authentication events
- Database operations
- Gemini AI interactions
- General application errors
- API failures
"""

import os
import logging
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
LOG_DIR = BASE_DIR / "logs"

# Ensure log directory exists
os.makedirs(LOG_DIR, exist_ok=True)

LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {module} {process:d} {thread:d} {message}",
            "style": "{",
        },
        "standard": {
            "format": "{levelname} {asctime} {module} {message}",
            "style": "{",
        },
        "simple": {
            "format": "{levelname} {message}",
            "style": "{",
        },
    },
    "filters": {
        "require_debug_false": {
            "()": "django.utils.log.RequireDebugFalse",
        },
        "require_debug_true": {
            "()": "django.utils.log.RequireDebugTrue",
        },
    },
    "handlers": {
        "console": {
            "level": "INFO",
            "class": "logging.StreamHandler",
            "formatter": "standard",
        },
        "application_file": {
            "level": "INFO",
            "class": "logging.handlers.RotatingFileHandler",
            "filename": LOG_DIR / "application.log",
            "maxBytes": 10485760,  # 10 MB
            "backupCount": 5,
            "formatter": "verbose",
        },
        "auth_file": {
            "level": "INFO",
            "class": "logging.handlers.RotatingFileHandler",
            "filename": LOG_DIR / "auth.log",
            "maxBytes": 10485760,
            "backupCount": 3,
            "formatter": "verbose",
        },
        "database_file": {
            "level": "INFO",
            "class": "logging.handlers.RotatingFileHandler",
            "filename": LOG_DIR / "database.log",
            "maxBytes": 10485760,
            "backupCount": 3,
            "formatter": "verbose",
        },
        "gemini_file": {
            "level": "INFO",
            "class": "logging.handlers.RotatingFileHandler",
            "filename": LOG_DIR / "gemini.log",
            "maxBytes": 10485760,
            "backupCount": 3,
            "formatter": "verbose",
        },
        "error_file": {
            "level": "ERROR",
            "class": "logging.handlers.RotatingFileHandler",
            "filename": LOG_DIR / "errors.log",
            "maxBytes": 10485760,
            "backupCount": 5,
            "formatter": "verbose",
        },
        "mail_admins": {
            "level": "ERROR",
            "filters": ["require_debug_false"],
            "class": "django.utils.log.AdminEmailHandler",
        },
    },
    "loggers": {
        "django": {
            "handlers": ["console", "error_file"],
            "level": "INFO",
            "propagate": True,
        },
        "django.request": {
            "handlers": ["error_file", "mail_admins"],
            "level": "ERROR",
            "propagate": False,
        },
        "django.security": {
            "handlers": ["error_file"],
            "level": "WARNING",
            "propagate": False,
        },
        # Application loggers
        "main": {
            "handlers": ["console", "application_file", "error_file"],
            "level": "INFO",
            "propagate": False,
        },
        "main.views.auth": {
            "handlers": ["console", "auth_file", "error_file"],
            "level": "INFO",
            "propagate": False,
        },
        "main.services.mongodb_service": {
            "handlers": ["console", "database_file", "error_file"],
            "level": "INFO",
            "propagate": False,
        },
        "main.services.gemini_service": {
            "handlers": ["console", "gemini_file", "error_file"],
            "level": "INFO",
            "propagate": False,
        },
    },
}