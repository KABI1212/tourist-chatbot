"""
URL Configuration for Tourist Chatbot
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from main.views import (
    # Page views
    dashboard_view,
    home_view,
    chat_view,
    # Auth
    register_view,
    login_view,
    logout_view,
    forgot_password_view,
    reset_password_view,
    # Profile
    profile_view,
    change_password_view,
    # Chat API
    chat_api_view,
    chat_history_view,
    chat_delete_view,
    chat_clear_view,
)

urlpatterns = [
    # ── Admin ──────────────────────────────────────────────────────────────
    path("admin/", admin.site.urls),

    # ── Page Views ─────────────────────────────────────────────────────────
    path("",        dashboard_view, name="dashboard"),
    path("home/",   home_view,      name="home"),
    path("chat/",   chat_view,      name="chat"),

    # ── Authentication ─────────────────────────────────────────────────────
    path("register/",        register_view,        name="register"),
    path("login/",           login_view,           name="login"),
    path("logout/",          logout_view,          name="logout"),
    path("forgot-password/", forgot_password_view, name="forgot_password"),
    path("reset-password/",  reset_password_view,  name="reset_password"),

    # ── Profile ────────────────────────────────────────────────────────────
    path("profile/",         profile_view,         name="profile"),
    path("change-password/", change_password_view, name="change_password"),

    # ── Chat REST API ──────────────────────────────────────────────────────
    path("api/chat/",                        chat_api_view,     name="chat_api"),
    path("api/chat/history/",               chat_history_view, name="chat_history"),
    path("api/chat/delete/<str:message_id>/", chat_delete_view,  name="chat_delete"),
    path("api/chat/clear/",                  chat_clear_view,   name="chat_clear"),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
