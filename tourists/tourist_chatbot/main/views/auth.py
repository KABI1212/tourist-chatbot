"""
Authentication views: register, login, logout, forgot password, profile.

Uses MongoDB for user storage with bcrypt password hashing.
Supports guest users and registered users.
"""

import logging
import bcrypt
from django.shortcuts import render, redirect
from django.http import JsonResponse
from django.contrib.auth import authenticate, login, logout
from ..services.mongodb_service import (
    create_user,
    find_user_by_username,
    find_user_by_email,
    find_user_by_id,
    update_user,
    update_last_login,
    username_exists,
    email_exists,
    save_search,
)
from ..forms.register import clean_registration_data, clean_login_data, clean_profile_update_data
from ..utils.validators import sanitize_html
import json

logger = logging.getLogger("main.views.auth")


def register_view(request):
    """
    Handles user registration using MongoDB.
    """
    if request.method == "POST":
        cleaned_data, error = clean_registration_data(request.POST)

        if error:
            return render(request, "register.html", {"error": error})

        # Check duplicate username
        if username_exists(cleaned_data["username"]):
            return render(request, "register.html", {"error": "Username already exists"})

        # Check duplicate email
        if email_exists(cleaned_data["email"]):
            return render(request, "register.html", {"error": "Email already exists"})

        try:
            # Hash the password
            password_hash = bcrypt.hashpw(
                cleaned_data["password"].encode("utf-8"),
                bcrypt.gensalt(),
            ).decode("utf-8")

            # Create user in MongoDB
            user_id = create_user(
                username=cleaned_data["username"],
                email=cleaned_data["email"],
                password_hash=password_hash,
                full_name=cleaned_data["full_name"],
                phone=cleaned_data["phone"],
                address=cleaned_data["address"],
            )

            if not user_id:
                return render(request, "register.html", {
                    "error": "Registration failed. Please try again."
                })

            logger.info(f"User registered: {cleaned_data['username']} (ID: {user_id})")

            # Log the user in by setting session
            request.session["user_id"] = user_id
            request.session["username"] = cleaned_data["username"]
            request.session["is_authenticated"] = True
            request.session["is_guest"] = False
            request.session["full_name"] = cleaned_data["full_name"]

            # Clear guest session if existed
            if request.session.get("is_guest"):
                del request.session["is_guest"]
            if request.session.get("guest_id"):
                del request.session["guest_id"]

            return redirect("home")

        except Exception as e:
            logger.exception("Registration failed")
            return render(request, "register.html", {
                "error": "Registration failed. Please try again."
            })

    return render(request, "register.html")


def login_view(request):
    """
    Handles user login using MongoDB.
    """
    if request.method == "POST":
        username = request.POST.get("username", "").strip()
        password = request.POST.get("password", "")

        if not username or not password:
            return render(request, "login.html", {"error": "Please fill in all fields"})

        # Find user in MongoDB
        user = find_user_by_username(username)

        if not user:
            return render(request, "login.html", {"error": "Invalid username or password"})

        # Verify password
        try:
            if bcrypt.checkpw(
                password.encode("utf-8"),
                user["password_hash"].encode("utf-8"),
            ):
                # Set session
                request.session["user_id"] = str(user["_id"])
                request.session["username"] = user["username"]
                request.session["is_authenticated"] = True
                request.session["is_guest"] = False
                request.session["full_name"] = user.get("full_name", "")

                # Clear guest session
                if request.session.get("is_guest"):
                    del request.session["is_guest"]
                if request.session.get("guest_id"):
                    del request.session["guest_id"]

                # Update last login
                update_last_login(str(user["_id"]))

                logger.info(f"User logged in: {username}")

                # Handle "Remember Me"
                if request.POST.get("remember_me"):
                    request.session.set_expiry(604800)  # 7 days

                return redirect("home")
        except Exception as e:
            logger.error(f"Password verification failed for {username}: {e}")

        return render(request, "login.html", {"error": "Invalid username or password"})

    return render(request, "login.html")


def logout_view(request):
    """
    Logs out the user and clears session.
    """
    username = request.session.get("username", "unknown")
    logger.info(f"User logged out: {username}")

    # Clear session
    request.session.flush()
    return redirect("dashboard")


def profile_view(request):
    """
    View and update user profile.
    Requires authentication.
    """
    user_id = request.session.get("user_id")
    if not user_id or request.session.get("is_guest"):
        return redirect("login")

    user_data = find_user_by_id(user_id)
    if not user_data:
        return redirect("login")

    if request.method == "POST":
        cleaned_data, error = clean_profile_update_data(request.POST)

        if error:
            return render(request, "profile.html", {
                "error": error,
                "profile": user_data,
            })

        # Update user in MongoDB
        success = update_user(user_id, {
            "full_name": cleaned_data["full_name"],
            "phone": cleaned_data["phone"],
            "address": cleaned_data["address"],
        })

        if success:
            logger.info(f"Profile updated for user: {user_data['username']}")
            request.session["full_name"] = cleaned_data["full_name"]
            return render(request, "profile.html", {
                "success": "Profile updated successfully",
                "profile": {
                    **user_data,
                    "full_name": cleaned_data["full_name"],
                    "phone": cleaned_data["phone"],
                    "address": cleaned_data["address"],
                },
            })
        else:
            return render(request, "profile.html", {
                "error": "Failed to update profile",
                "profile": user_data,
            })

    return render(request, "profile.html", {"profile": user_data})


def change_password_view(request):
    """
    Change password for authenticated users.
    """
    user_id = request.session.get("user_id")
    if not user_id or request.session.get("is_guest"):
        return redirect("login")

    if request.method == "POST":
        current_password = request.POST.get("current_password", "")
        new_password = request.POST.get("new_password", "")
        confirm_password = request.POST.get("confirm_password", "")

        if not current_password or not new_password:
            return render(request, "change_password.html", {
                "error": "Please fill in all fields"
            })

        if new_password != confirm_password:
            return render(request, "change_password.html", {
                "error": "New passwords do not match"
            })

        if len(new_password) < 8:
            return render(request, "change_password.html", {
                "error": "Password must be at least 8 characters"
            })

        # Verify current password
        user_data = find_user_by_id(user_id)
        if not user_data:
            return redirect("login")

        try:
            if bcrypt.checkpw(
                current_password.encode("utf-8"),
                user_data["password_hash"].encode("utf-8"),
            ):
                # Hash new password
                new_hash = bcrypt.hashpw(
                    new_password.encode("utf-8"),
                    bcrypt.gensalt(),
                ).decode("utf-8")

                update_user(user_id, {"password_hash": new_hash})
                logger.info(f"Password changed for user: {user_data['username']}")

                return render(request, "change_password.html", {
                    "success": "Password changed successfully"
                })
            else:
                return render(request, "change_password.html", {
                    "error": "Current password is incorrect"
                })
        except Exception as e:
            logger.exception("Password change failed")
            return render(request, "change_password.html", {
                "error": "Failed to change password"
            })

    return render(request, "change_password.html")


def forgot_password_view(request):
    """
    Forgot password page - shows a message to contact support.
    In a production environment, this would send an email with a reset link.
    """
    if request.method == "POST":
        email = request.POST.get("email", "").strip().lower()

        if not email:
            return render(request, "forgot_password.html", {
                "error": "Please enter your email address"
            })

        user = find_user_by_email(email)
        if user:
            logger.info(f"Password reset requested for: {email}")
            # In production, send email here
            return render(request, "forgot_password.html", {
                "success": "If an account with that email exists, a password reset link has been sent."
            })
        else:
            # Don't reveal if email exists or not (security)
            return render(request, "forgot_password.html", {
                "success": "If an account with that email exists, a password reset link has been sent."
            })

    return render(request, "forgot_password.html")


def api_login_view(request):
    """
    API endpoint for login (AJAX requests).
    """
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            username = data.get("username", "").strip()
            password = data.get("password", "")

            if not username or not password:
                return JsonResponse({"error": "Please fill in all fields"}, status=400)

            user = find_user_by_username(username)
            if not user:
                return JsonResponse({"error": "Invalid credentials"}, status=401)

            if bcrypt.checkpw(
                password.encode("utf-8"),
                user["password_hash"].encode("utf-8"),
            ):
                # Store user info in session
                request.session["user_id"] = str(user["_id"])
                request.session["username"] = user["username"]
                request.session["is_authenticated"] = True
                request.session["is_guest"] = False
                request.session["full_name"] = user.get("full_name", "")

                if request.session.get("is_guest"):
                    del request.session["is_guest"]
                if request.session.get("guest_id"):
                    del request.session["guest_id"]

                update_last_login(str(user["_id"]))

                return JsonResponse({
                    "success": True,
                    "username": user["username"],
                    "full_name": user.get("full_name", ""),
                })

            return JsonResponse({"error": "Invalid credentials"}, status=401)

        except Exception as e:
            logger.exception("API login failed")
            return JsonResponse({"error": "Login failed"}, status=500)

    return JsonResponse({"error": "Method not allowed"}, status=405)