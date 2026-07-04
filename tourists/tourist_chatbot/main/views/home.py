"""
Home and dashboard views.

Dashboard shows personalized content for authenticated users.
"""

from django.shortcuts import render, redirect
from ..services.mongodb_service import (
    find_user_by_id,
    get_chat_history,
    get_user_trips,
    get_favourite_places,
    get_user_notifications,
)
import logging

logger = logging.getLogger(__name__)


def dashboard_view(request):
    """
    Renders the landing/dashboard page.
    Shows guest access option for unauthenticated users.
    """
    is_authenticated = request.session.get("is_authenticated", False)
    is_guest = request.session.get("is_guest", True)

    context = {
        "is_authenticated": is_authenticated,
        "is_guest": is_guest,
        "username": request.session.get("username", ""),
        "full_name": request.session.get("full_name", ""),
    }

    return render(request, "dashboard.html", context)


def home_view(request):
    """
    Renders the home page with personalized dashboard for authenticated users.
    Redirects guests to login with a prompt.
    """
    is_authenticated = request.session.get("is_authenticated", False)
    is_guest = request.session.get("is_guest", True)

    if not is_authenticated and is_guest:
        # Guest users can still access home but with limited features
        return render(request, "home.html", {
            "is_guest": True,
            "username": "Guest",
            "full_name": "Guest User",
        })

    if not is_authenticated:
        return redirect("login")

    user_id = request.session.get("user_id")
    username = request.session.get("username", "")
    full_name = request.session.get("full_name", "")

    # Get user data from MongoDB
    user_data = find_user_by_id(user_id) if user_id else None

    # Get recent chat history
    recent_chats = []
    if user_id:
        try:
            chats = get_chat_history(user_id, limit=5)
            for chat in chats:
                recent_chats.append({
                    "id": str(chat["_id"]),
                    "question": chat["question"][:100],
                    "created_at": chat["created_at"].isoformat() if chat.get("created_at") else "",
                })
        except Exception as e:
            logger.warning(f"Failed to get recent chats: {e}")

    # Get saved trips
    saved_trips = []
    if user_id:
        try:
            trips = get_user_trips(user_id, limit=3)
            for trip in trips:
                saved_trips.append({
                    "id": str(trip["_id"]),
                    "destination": trip.get("destination", "Unknown"),
                    "created_at": trip["created_at"].isoformat() if trip.get("created_at") else "",
                })
        except Exception as e:
            logger.warning(f"Failed to get saved trips: {e}")

    # Get favourite places
    favourite_places = []
    if user_id:
        try:
            places = get_favourite_places(user_id, limit=5)
            for place in places:
                favourite_places.append({
                    "id": str(place["_id"]),
                    "name": place.get("name", "Unknown"),
                })
        except Exception as e:
            logger.warning(f"Failed to get favourite places: {e}")

    context = {
        "is_authenticated": True,
        "is_guest": False,
        "username": username,
        "full_name": full_name or username,
        "user_data": user_data,
        "recent_chats": recent_chats,
        "saved_trips": saved_trips,
        "favourite_places": favourite_places,
        "chat_count": len(recent_chats),
    }

    return render(request, "home.html", context)