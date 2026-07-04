"""
Chat view: handles AI chatbot interactions with Gemini for the Smart Tourism Platform.

Supports both authenticated users and guest users.
Saves chat history to MongoDB for authenticated users.
Integrates with Destination Intelligence Service for data-enhanced responses.
"""

import json
import time
import logging
from django.shortcuts import render
from django.http import JsonResponse
from django_ratelimit.decorators import ratelimit
from ..services.gemini_service import ask_gemini
from ..services.mongodb_service import (
    save_chat_message,
    get_chat_history,
    delete_chat_message,
    clear_chat_history,
    search_chat_history,
    log_ai_request,
)
from ..services.destination_service import (
    classify_query,
    extract_destination_name,
    get_complete_destination_info,
    format_destination_for_prompt,
    generate_budget_response,
    generate_itinerary_response,
)
from ..utils.validators import validate_chat_message
from ..utils.parser import parse_ai_response, format_chat_response

logger = logging.getLogger(__name__)


def chat_view(request):
    """
    Handles POST requests for chatbot responses.
    If GET, just render 'chat.html'.
    Works for both authenticated and guest users.
    Integrates destination data for enhanced AI responses.
    """
    if request.method == "POST":
        try:
            # Parse the incoming JSON data
            data = json.loads(request.body)
            user_input = data.get("message", "").strip()

            # Validate input
            valid, error, sanitized = validate_chat_message(user_input)
            if not valid:
                return JsonResponse({"error": error}, status=400)

            # Get user info
            user_id = request.session.get("user_id")
            is_guest = request.session.get("is_guest", True)
            if is_guest:
                user_id = request.session.get("guest_id")

            # Classify the query to understand user intent
            intents = classify_query(sanitized)
            primary_intent = intents[0][0] if intents else "general"

            # Extract destination name from query
            destination_name = extract_destination_name(sanitized)

            # Get destination context data if a destination is mentioned
            context_data = ""
            destination_context = ""
            if destination_name:
                dest_info = get_complete_destination_info(destination_name)
                if dest_info:
                    context_data = format_destination_for_prompt(dest_info)
                    destination_context = destination_name

            # Measure response time
            start_time = time.time()

            # Get AI response from Gemini service with context data
            model_response = ask_gemini(sanitized, context_data=context_data)

            response_time_ms = int((time.time() - start_time) * 1000)

            # Format the response for display
            formatted_response = format_chat_response(model_response)

            # Save chat history to MongoDB for authenticated users
            if not is_guest and user_id:
                try:
                    save_chat_message(
                        user_id=user_id,
                        question=sanitized,
                        answer=model_response,
                        language=data.get("language", "en"),
                        response_time_ms=response_time_ms,
                        destination_context=destination_context,
                    )
                except Exception as e:
                    logger.warning(f"Failed to save chat history: {e}")

            # Log AI request
            try:
                log_ai_request(
                    user_id=user_id,
                    prompt=sanitized,
                    response=model_response,
                    model="gemini-2.5-flash-lite",
                    response_time_ms=response_time_ms,
                    success=True,
                    destination_context=destination_context,
                )
            except Exception as e:
                logger.warning(f"Failed to log AI request: {e}")

            return JsonResponse({
                "response": formatted_response,
                "intent": primary_intent,
                "destination": destination_context,
            })

        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)

        except Exception as e:
            logger.exception("Chat error")
            return JsonResponse(
                {"error": "Something went wrong. Please try again."}, status=500
            )

    # If GET request, render the chat.html page
    return render(request, "chat.html")


@ratelimit(key="ip", rate="10/m", method="POST")
def chat_api_view(request):
    """
    Rate-limited API endpoint for chat messages.
    """
    return chat_view(request)


def chat_history_view(request):
    """
    API endpoint to get chat history for the current user.
    """
    user_id = request.session.get("user_id")
    is_guest = request.session.get("is_guest", True)

    if is_guest or not user_id:
        return JsonResponse({"history": []})

    try:
        limit = int(request.GET.get("limit", 50))
        skip = int(request.GET.get("skip", 0))
        query = request.GET.get("q", "")

        if query:
            history = search_chat_history(user_id, query, limit)
        else:
            history = get_chat_history(user_id, limit, skip)

        # Convert ObjectId to string for JSON serialization
        formatted_history = []
        for msg in history:
            formatted_history.append({
                "id": str(msg["_id"]),
                "question": msg["question"],
                "answer": msg["answer"],
                "language": msg.get("language", "en"),
                "created_at": msg["created_at"].isoformat() if msg.get("created_at") else "",
            })

        return JsonResponse({"history": formatted_history})

    except Exception as e:
        logger.exception("Failed to get chat history")
        return JsonResponse({"error": "Failed to get chat history"}, status=500)


def chat_delete_view(request, message_id):
    """
    API endpoint to delete a single chat message.
    """
    user_id = request.session.get("user_id")
    is_guest = request.session.get("is_guest", True)

    if is_guest or not user_id:
        return JsonResponse({"error": "Authentication required"}, status=401)

    try:
        success = delete_chat_message(message_id)
        if success:
            return JsonResponse({"success": True})
        return JsonResponse({"error": "Message not found"}, status=404)
    except Exception as e:
        logger.exception("Failed to delete chat message")
        return JsonResponse({"error": "Failed to delete message"}, status=500)


def chat_clear_view(request):
    """
    API endpoint to clear all chat history for the current user.
    """
    user_id = request.session.get("user_id")
    is_guest = request.session.get("is_guest", True)

    if is_guest or not user_id:
        return JsonResponse({"error": "Authentication required"}, status=401)

    try:
        success = clear_chat_history(user_id)
        return JsonResponse({"success": True})
    except Exception as e:
        logger.exception("Failed to clear chat history")
        return JsonResponse({"error": "Failed to clear history"}, status=500)