"""
Tourist Chatbot — Views
========================
Organised into four sections:
  1. Page views      (dashboard, home, chat page)
  2. Auth views      (register, login, logout, forgot/change password)
  3. Profile views   (profile, change password)
  4. Chat API views  (chat, chat_api, history, delete, clear)

Chat pipeline (new flow):
  User → IntentService → Orchestrator
       → DestinationService (Wikipedia / Wikidata / OSM)  [if destination intent]
       → local_travel_data                                  [fallback]
       → wiki_service                                       [fallback]
       → Gemini API                                         [final fallback / enrichment]
       → save_chat (MongoDB)
       → JSON response
"""
import json
import logging
import os
import sys
from pathlib import Path

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import PasswordChangeForm
from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.http import JsonResponse
from django.shortcuts import redirect, render
from django.utils.crypto import get_random_string
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.conf import settings

from .models import UserProfile
from .destination_service import get_destination_info
from .local_travel_data import generate_local_response
from .wiki_service import generate_wiki_response
from .mongo_client import (
    save_chat,
    get_chat_history,
    delete_chat,
    clear_chat,
    count_chats,
)
from .utils import json_error, json_success

# Add chatbot services to path
_SERVICES_PATH = Path(__file__).resolve().parent.parent.parent.parent / "chatbot"
if str(_SERVICES_PATH) not in sys.path:
    sys.path.insert(0, str(_SERVICES_PATH.parent))

try:
    from chatbot.services import TravelPlannerOrchestrator
    _orchestrator = TravelPlannerOrchestrator()
    _HAS_ORCHESTRATOR = True
except ImportError:
    _HAS_ORCHESTRATOR = False
    _orchestrator = None

logger = logging.getLogger("main")
auth_logger = logging.getLogger("main.auth")
gemini_logger = logging.getLogger("main.gemini")

# ─── Gemini Setup ─────────────────────────────────────────────────────────────
_GOOGLE_API_KEY = getattr(settings, "GOOGLE_API_KEY", "") or os.environ.get("GOOGLE_API_KEY", "")

_gemini_client = None


def _get_gemini_client():
    """Lazy-initialise the Gemini client. Returns None if key is missing."""
    global _gemini_client
    if _gemini_client is not None:
        return _gemini_client
    if not _GOOGLE_API_KEY:
        gemini_logger.warning("GOOGLE_API_KEY not set — Gemini disabled.")
        return None
    try:
        from google import genai
        _gemini_client = genai.Client(api_key=_GOOGLE_API_KEY)
        gemini_logger.info("Gemini client initialised.")
    except Exception as exc:
        gemini_logger.error("Gemini init failed: %s", exc)
        _gemini_client = None
    return _gemini_client


_GEMINI_SYSTEM_PROMPT = """You are a Global AI Travel Planner — a production-ready travel assistant capable of \
planning trips to ANY valid location worldwide.

Your purpose is to help users discover destinations, plan trips, estimate budgets, find hidden gems, \
explore like a local, and generate complete travel experiences for any destination worldwide.

RESPONSE STRUCTURE (use these sections when applicable):
1. 📍 DESTINATION OVERVIEW — Name, Country, Time Zone, Currency, Language, Visa Info
2. 🌍 WHY VISIT — Fame, uniqueness, history, culture
3. 🗺 ROUTE PLANNING — Best routes, distance, travel time, alternatives
4. 💰 TRAVEL COST CALCULATOR — Estimated expenses (label verified vs estimated)
5. 🚆 TRANSPORT INFORMATION — Airport, railway, metro, bus, taxi, rentals
6. ⭐ TOP ATTRACTIONS — Must-visit places with descriptions
7. 💎 HIDDEN GEMS — Lesser-known places
8. 🍛 FOOD EXPLORER — Traditional foods, street food, restaurants
9. 🏨 STAY RECOMMENDATIONS — Budget to luxury with price ranges
10. 📅 SUGGESTED ITINERARY — Multi-day plan with timetable, meals, transport
11. ⚠ TRAVEL TIPS — Safety, emergency contacts, ATM, medical
12. ⭐ FINAL RECOMMENDATION — Who should visit, budget range, must-do experiences

RULES:
- Never fabricate distances, prices, visa rules, or flight schedules.
- If live information is unavailable, clearly state it is estimated.
- Always distinguish ✅ Verified, ⚠️ Estimated, ❌ Unavailable.
- Be concise but comprehensive.
- Convert any URLs to clickable Markdown links."""


# ─── 1. PAGE VIEWS ────────────────────────────────────────────────────────────

def dashboard_view(request):
    """Public landing page — login / register."""
    return render(request, "dashboard.html")


@login_required(login_url="login")
def home_view(request):
    """Authenticated home page."""
    return render(request, "home.html")


@login_required(login_url="login")
def chat_view(request):
    """Render the chat UI page."""
    return render(request, "chat.html")


# ─── 2. AUTH VIEWS ────────────────────────────────────────────────────────────

def register_view(request):
    """User registration — creates Django User + UserProfile."""
    if request.user.is_authenticated:
        return redirect("home")

    if request.method != "POST":
        return render(request, "register.html")

    username         = request.POST.get("username", "").strip()
    email            = request.POST.get("email", "").strip()
    password         = request.POST.get("password", "")
    confirm_password = request.POST.get("confirm_password", "")
    full_name        = request.POST.get("full_name", "").strip()
    phone            = request.POST.get("phone", "").strip()
    address          = request.POST.get("address", "").strip()

    def error(msg):
        return render(request, "register.html", {"error": msg})

    if not all([username, email, password, confirm_password]):
        return error("Please fill in all required fields.")
    if password != confirm_password:
        return error("Passwords do not match.")
    if len(password) < 8:
        return error("Password must be at least 8 characters.")
    if User.objects.filter(username=username).exists():
        return error("Username already exists.")
    if User.objects.filter(email=email).exists():
        return error("Email address already registered.")

    try:
        user = User.objects.create_user(username=username, email=email, password=password)
        UserProfile.objects.create(
            user=user,
            full_name=full_name or username,
            phone=phone,
            address=address,
        )
        login(request, user)
        auth_logger.info("New user registered: %s (%s)", username, email)
        return redirect("home")
    except Exception as exc:
        auth_logger.error("Registration error for %s: %s", username, exc)
        # Clean up partially-created user
        User.objects.filter(username=username).delete()
        return error("Registration failed. Please try again.")


def login_view(request):
    """Username/password login with optional 'remember me'."""
    if request.user.is_authenticated:
        return redirect("home")

    if request.method != "POST":
        return render(request, "login.html")

    username = request.POST.get("username", "").strip()
    password = request.POST.get("password", "")
    remember = request.POST.get("remember_me")

    if not username or not password:
        return render(request, "login.html", {"error": "Please enter username and password."})

    user = authenticate(request, username=username, password=password)
    if user is None:
        auth_logger.warning("Failed login attempt for username: %s", username)
        return render(request, "login.html", {"error": "Invalid username or password."})

    login(request, user)

    # Session expiry — 0 = expires when browser closes
    if not remember:
        request.session.set_expiry(0)
    else:
        request.session.set_expiry(60 * 60 * 24 * 30)  # 30 days

    auth_logger.info("User logged in: %s", username)
    return redirect("home")


def logout_view(request):
    """Logout and redirect to dashboard."""
    auth_logger.info("User logged out: %s", request.user.username)
    logout(request)
    return redirect("dashboard")


def forgot_password_view(request):
    """
    Sends a one-time reset token to the user's email.
    Token is stored in the session for verification.
    """
    if request.method == "POST":
        email = request.POST.get("email", "").strip()
        if not email:
            return render(request, "forgot_password.html", {"error": "Please enter your email."})

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            # Don't reveal whether the email exists
            return render(
                request, "forgot_password.html",
                {"success": "If that email exists, a reset link has been sent."},
            )

        token = get_random_string(48)
        request.session["password_reset_token"] = token
        request.session["password_reset_user_id"] = user.pk
        request.session["password_reset_token_used"] = False

        reset_url = request.build_absolute_uri(f"/reset-password/?token={token}")

        try:
            send_mail(
                subject="Tourist Guide — Password Reset",
                message=(
                    f"Hi {user.username},\n\n"
                    f"Click the link below to reset your password:\n{reset_url}\n\n"
                    "This link expires when your browser session ends.\n\n"
                    "If you didn't request this, ignore this email."
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False,
            )
        except Exception as exc:
            auth_logger.error("Password reset email failed for %s: %s", email, exc)
            return render(
                request, "forgot_password.html",
                {"error": "Could not send reset email. Please try again later."},
            )

        auth_logger.info("Password reset requested for: %s", email)
        return render(
            request, "forgot_password.html",
            {"success": "If that email exists, a reset link has been sent."},
        )

    return render(request, "forgot_password.html")


def reset_password_view(request):
    """Verifies a reset token and allows setting a new password."""
    token = request.GET.get("token") or request.POST.get("token", "")

    stored_token = request.session.get("password_reset_token")
    stored_uid   = request.session.get("password_reset_user_id")
    token_used   = request.session.get("password_reset_token_used", True)

    if not stored_token or token != stored_token or token_used:
        return render(request, "reset_password.html", {
            "error": "This reset link is invalid or has already been used.",
        })

    if request.method == "POST":
        password = request.POST.get("password", "")
        confirm  = request.POST.get("confirm_password", "")

        if len(password) < 8:
            return render(request, "reset_password.html", {
                "error": "Password must be at least 8 characters.",
                "token": token,
            })
        if password != confirm:
            return render(request, "reset_password.html", {
                "error": "Passwords do not match.",
                "token": token,
            })

        try:
            user = User.objects.get(pk=stored_uid)
            user.set_password(password)
            user.save()
            # Invalidate token
            request.session["password_reset_token_used"] = True
            auth_logger.info("Password reset completed for user id: %s", stored_uid)
            return render(request, "reset_password.html", {
                "success": "Password changed successfully. You can now log in.",
            })
        except User.DoesNotExist:
            return render(request, "reset_password.html", {
                "error": "User not found.",
            })

    return render(request, "reset_password.html", {"token": token})


# ─── 3. PROFILE VIEWS ─────────────────────────────────────────────────────────

@login_required(login_url="login")
def profile_view(request):
    """View and update user profile information."""
    profile, _ = UserProfile.objects.get_or_create(
        user=request.user,
        defaults={"full_name": request.user.username, "phone": "", "address": ""},
    )

    if request.method == "POST":
        full_name = request.POST.get("full_name", "").strip()
        phone     = request.POST.get("phone", "").strip()
        address   = request.POST.get("address", "").strip()
        email     = request.POST.get("email", "").strip()

        if email and email != request.user.email:
            if User.objects.filter(email=email).exclude(pk=request.user.pk).exists():
                return render(request, "profile.html", {
                    "profile": profile,
                    "error": "That email address is already in use.",
                })
            request.user.email = email
            request.user.save()

        profile.full_name = full_name or profile.full_name
        profile.phone     = phone
        profile.address   = address
        profile.save()

        return render(request, "profile.html", {
            "profile": profile,
            "success": "Profile updated successfully.",
        })

    return render(request, "profile.html", {"profile": profile})


@login_required(login_url="login")
def change_password_view(request):
    """Change password using Django's built-in PasswordChangeForm."""
    if request.method == "POST":
        form = PasswordChangeForm(request.user, request.POST)
        if form.is_valid():
            user = form.save()
            # Re-authenticate to keep session alive after password change
            from django.contrib.auth import update_session_auth_hash
            update_session_auth_hash(request, user)
            auth_logger.info("Password changed for user: %s", request.user.username)
            return render(request, "change_password.html", {
                "form": PasswordChangeForm(request.user),
                "success": "Password changed successfully.",
            })
        return render(request, "change_password.html", {"form": form})

    return render(request, "change_password.html", {"form": PasswordChangeForm(request.user)})


# ─── 4. CHAT API VIEWS ────────────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(["GET", "POST"])
def chat_view_page(request):
    """
    GET  → render chat.html
    POST → legacy direct-chat endpoint (kept for backward compat)
           Delegates to _process_chat_message.
    """
    if request.method == "GET":
        if not request.user.is_authenticated:
            return redirect("login")
        return render(request, "chat.html")

    return _process_chat_message(request)


@csrf_exempt
@require_http_methods(["POST"])
def chat_api_view(request):
    """
    Rate-limited REST endpoint for the chat interface.
    Requires authentication.
    POST /api/chat/
    Body: { "message": "..." }
    """
    if not request.user.is_authenticated:
        return json_error("Authentication required.", status=401)

    return _process_chat_message(request)


def _process_chat_message(request) -> JsonResponse:
    """
    Core chat processing pipeline.

    Flow:
      1. Parse & validate input
      2. Run orchestrator (intent + structured services)
      3. Destination service  (Wikipedia / Wikidata / OSM)
      4. Local JSON database
      5. Wikipedia text fallback
      6. Gemini API (if needs_gemini=True or all else failed)
      7. Save to MongoDB
      8. Return JSON
    """
    # ── Parse body ──────────────────────────────────────────────────────────
    try:
        body = json.loads(request.body)
        user_input = body.get("message", "").strip()
    except (json.JSONDecodeError, AttributeError):
        return json_error("Invalid JSON body.", status=400)

    if not user_input:
        return json_error("No message provided.", status=400)
    if len(user_input) > 1000:
        return json_error("Message too long (max 1000 characters).", status=400)

    session_id = request.session.session_key or "anonymous"
    user_id    = request.user.pk if request.user.is_authenticated else 0

    # ── Step 1: Orchestrator (intent + structured data) ─────────────────────
    orch_result = {}
    intent      = "unknown"
    entities    = {}
    if _HAS_ORCHESTRATOR:
        try:
            orch_result = _orchestrator.handle_query(user_input)
            intent      = orch_result.get("intent", "unknown")
            entities    = orch_result.get("entities", {})
        except Exception as exc:
            logger.warning("Orchestrator error: %s", exc)

    needs_gemini = orch_result.get("needs_gemini", True)

    # ── Step 2: Destination service (structured card) ────────────────────────
    if intent in ("destination_info", "trip_plan", "unknown", "nearby_attractions",
                  "hotels", "restaurants", "weather", "best_time", "transportation",
                  "safety_tips", "visa_questions", "emergency_contacts"):
        try:
            dest_info = get_destination_info(user_input)
            if dest_info:
                # Enrich with orchestrator data if a trip was planned
                if "route" in orch_result:
                    dest_info["route"] = orch_result["route"]
                if "budget_breakdown" in orch_result:
                    dest_info["budget_breakdown"] = orch_result["budget_breakdown"]
                if "budget_check" in orch_result:
                    dest_info["budget_check"] = orch_result["budget_check"]

                _save(user_id, session_id, user_input, str(dest_info), intent, entities, "destination")
                return JsonResponse({"response": dest_info, "source": "destination"})
        except Exception as exc:
            logger.warning("DestinationService error: %s", exc)

    # ── Step 3: Local JSON data ──────────────────────────────────────────────
    try:
        local_reply = generate_local_response(user_input)
        if local_reply:
            _save(user_id, session_id, user_input, local_reply, intent, entities, "local")
            return JsonResponse({"response": local_reply, "source": "local"})
    except Exception as exc:
        logger.warning("LocalData error: %s", exc)

    # ── Step 4: Wikipedia text fallback ─────────────────────────────────────
    try:
        wiki_reply = generate_wiki_response(user_input)
        if wiki_reply:
            _save(user_id, session_id, user_input, wiki_reply, intent, entities, "wikipedia")
            return JsonResponse({"response": wiki_reply, "source": "wikipedia"})
    except Exception as exc:
        logger.warning("WikiService error: %s", exc)

    # ── Step 5: Structured non-destination orchestrator message ─────────────
    if not needs_gemini and orch_result.get("message"):
        reply = orch_result["message"]
        _save(user_id, session_id, user_input, reply, intent, entities, "orchestrator")
        return JsonResponse({"response": reply, "source": "orchestrator"})

    # ── Step 6: Gemini API ───────────────────────────────────────────────────
    client = _get_gemini_client()
    if client is None:
        return json_error(
            "⚠️ AI service is currently unavailable. Please try a specific destination name "
            "like 'Taj Mahal', 'Paris', or 'Goa'.",
            status=503,
        )

    # Build enriched prompt from orchestrator hints
    prompt = user_input
    if orch_result.get("prompt_hint"):
        prompt = f"{orch_result['prompt_hint']}\n\nUser query: {user_input}"
    if "route" in orch_result:
        route = orch_result["route"]
        prompt += (
            f"\n\n[Route data: {route.get('origin')} → {route.get('destination')}, "
            f"{route.get('distance_km')} km, {route.get('duration_hr')} hrs, "
            f"{route.get('route_desc')}]"
        )
    if "budget_breakdown" in orch_result:
        bd = orch_result["budget_breakdown"]
        prompt += f"\n\n[Budget estimate: Total ₹{bd.get('total')} for the trip]"

    # Prepend system instruction to prompt (new genai client approach)
    full_prompt = _GEMINI_SYSTEM_PROMPT + "\n\n---\n\n" + prompt

    try:
        from google.genai import types as genai_types
        gemini_logger.info("Calling Gemini for query: %r", user_input[:80])
        response = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=full_prompt,
            config=genai_types.GenerateContentConfig(
                temperature=0.4,
                max_output_tokens=8192,
            ),
        )
        reply_text = response.text

        # Format into topic/detail pairs for frontend compatibility
        formatted = []
        for line in reply_text.split("\n"):
            if not line.strip():
                continue
            if ":" in line:
                parts = line.split(":", 1)
                formatted.append({"topic": parts[0].strip(), "details": parts[1].strip()})
            else:
                formatted.append({"topic": line.strip(), "details": ""})

        _save(user_id, session_id, user_input, reply_text, intent, entities, "gemini")
        return JsonResponse({"response": formatted, "source": "gemini"})

    except Exception as exc:
        err_str = str(exc)
        gemini_logger.error("Gemini call failed: %s", err_str)
        if "429" in err_str or "quota" in err_str.lower() or "rate" in err_str.lower():
            return json_error(
                "⚠️ AI quota exceeded. Try asking about a specific destination like "
                "'Tell me about Tokyo' for instant results.",
                status=429,
            )
        return json_error(f"AI service error: {err_str}", status=500)


def _save(user_id, session_id, user_message, ai_reply, intent, entities, source):
    """Fire-and-forget MongoDB save — never raises."""
    try:
        if user_id:
            save_chat(
                user_id=user_id,
                session_id=session_id,
                user_message=user_message,
                ai_reply=str(ai_reply)[:5000],
                intent=intent,
                entities=entities,
                source=source,
            )
    except Exception as exc:
        logger.warning("save_chat suppressed error: %s", exc)


# ─── Chat History & Management ────────────────────────────────────────────────

@login_required(login_url="login")
def chat_history_view(request):
    """
    GET /api/chat/history/
    Returns the last 50 messages for the authenticated user.
    Supports ?page=N for pagination (20 per page).
    """
    page     = max(int(request.GET.get("page", 1)), 1)
    per_page = 20
    skip     = (page - 1) * per_page
    total    = count_chats(request.user.pk)
    history  = get_chat_history(request.user.pk, limit=per_page, skip=skip)

    # Serialise datetime objects
    for item in history:
        if "timestamp" in item and hasattr(item["timestamp"], "isoformat"):
            item["timestamp"] = item["timestamp"].isoformat()

    return JsonResponse({
        "history": history,
        "page": page,
        "per_page": per_page,
        "total": total,
        "has_next": (skip + per_page) < total,
    })


@csrf_exempt
@login_required(login_url="login")
@require_http_methods(["DELETE", "POST"])
def chat_delete_view(request, message_id: str):
    """
    DELETE /api/chat/delete/<message_id>/
    Soft-deletes a single chat message owned by the authenticated user.
    """
    success = delete_chat(message_id=message_id, user_id=request.user.pk)
    if success:
        return json_success({"message_id": message_id})
    return json_error("Message not found or already deleted.", status=404)


@csrf_exempt
@login_required(login_url="login")
@require_http_methods(["POST", "DELETE"])
def chat_clear_view(request):
    """
    POST /api/chat/clear/
    Soft-deletes all chat messages for the authenticated user.
    """
    count = clear_chat(user_id=request.user.pk)
    return json_success({"cleared": count})
