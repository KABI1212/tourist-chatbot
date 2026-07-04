from django.contrib import admin
from django.urls import path
from main.views import (
    dashboard_view,
    register_view,
    login_view,
    logout_view,
    home_view,
    chat_view,
    chat_api_view,
    chat_history_view,
    chat_delete_view,
    chat_clear_view,
    profile_view,
    change_password_view,
    forgot_password_view,
)

urlpatterns = [
    # Admin
    path('admin/', admin.site.urls),

    # Authentication
    path('', dashboard_view, name='dashboard'),
    path('register/', register_view, name='register'),
    path('login/', login_view, name='login'),
    path('logout/', logout_view, name='logout'),
    path('forgot-password/', forgot_password_view, name='forgot_password'),

    # User Profile
    path('profile/', profile_view, name='profile'),
    path('change-password/', change_password_view, name='change_password'),

    # Main Pages
    path('home/', home_view, name='home'),
    path('chat/', chat_view, name='chat'),

    # Chat API (Rate Limited)
    path('api/chat/', chat_api_view, name='chat_api'),
    path('api/chat/history/', chat_history_view, name='chat_history'),
    path('api/chat/delete/<str:message_id>/', chat_delete_view, name='chat_delete'),
    path('api/chat/clear/', chat_clear_view, name='chat_clear'),
]