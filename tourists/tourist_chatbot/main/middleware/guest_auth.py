"""
Guest authentication middleware.

Allows unauthenticated users to access the chat with a guest session.
"""

import logging
from django.utils.deprecation import MiddlewareMixin
from ..utils.helpers import generate_session_id

logger = logging.getLogger(__name__)


class GuestSessionMiddleware(MiddlewareMixin):
    """
    Middleware that assigns a guest session ID to unauthenticated users.
    This allows guest users to use the chat without registering.
    """

    def process_request(self, request):
        """Assign a guest session ID if the user is not authenticated."""
        if not request.user.is_authenticated:
            if not request.session.get("guest_id"):
                request.session["guest_id"] = generate_session_id()
                request.session["is_guest"] = True
                logger.debug(f"Guest session created: {request.session['guest_id']}")