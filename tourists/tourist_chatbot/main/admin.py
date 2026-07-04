from django.contrib import admin
from .models import UserProfile, ChatHistory


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "full_name", "phone")
    search_fields = ("user__username", "full_name", "phone")


@admin.register(ChatHistory)
class ChatHistoryAdmin(admin.ModelAdmin):
    list_display = ("user", "question", "created_at")
    list_filter = ("created_at",)
    search_fields = ("user__username", "question")
    readonly_fields = ("created_at",)