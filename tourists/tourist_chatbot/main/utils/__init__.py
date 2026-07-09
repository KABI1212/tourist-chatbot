"""
Shared utility functions for the Tourist Chatbot main app.
"""
import logging
from django.http import JsonResponse
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger("main")


def custom_exception_handler(exc, context):
    """
    DRF custom exception handler — wraps errors in a consistent JSON envelope.
    """
    response = drf_exception_handler(exc, context)
    if response is not None:
        detail = response.data
        if isinstance(detail, dict) and "detail" in detail:
            detail = str(detail["detail"])
        elif isinstance(detail, list) and detail:
            detail = str(detail[0])
        else:
            detail = str(detail)
        response.data = {"error": detail, "status_code": response.status_code}
    return response


def json_error(message: str, status: int = 400) -> JsonResponse:
    """Return a consistent JSON error response."""
    return JsonResponse({"error": message}, status=status)


def json_success(data: dict, status: int = 200) -> JsonResponse:
    """Return a consistent JSON success response."""
    return JsonResponse({"success": True, **data}, status=status)
