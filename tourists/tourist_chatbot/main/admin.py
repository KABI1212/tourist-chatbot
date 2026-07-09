"""
Tourist Chatbot — Django Admin Configuration
"""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User
from django.utils.html import format_html

from .models import UserProfile, SavedDestination, RecentSearch


# ─── Inline: UserProfile inside User admin ───────────────────────────────────

class UserProfileInline(admin.StackedInline):
    model          = UserProfile
    can_delete     = False
    verbose_name   = "Profile"
    fields         = ("full_name", "phone", "address", "bio", "avatar")
    extra          = 0


class ExtendedUserAdmin(BaseUserAdmin):
    inlines        = [UserProfileInline]
    list_display   = ("username", "email", "full_name_display", "is_active", "is_staff", "date_joined")
    list_filter    = ("is_active", "is_staff", "date_joined")
    search_fields  = ("username", "email", "profile__full_name")
    ordering       = ("-date_joined",)

    def full_name_display(self, obj):
        try:
            return obj.profile.full_name or "—"
        except UserProfile.DoesNotExist:
            return "—"
    full_name_display.short_description = "Full Name"


# Unregister the default User admin and re-register with our extended one
admin.site.unregister(User)
admin.site.register(User, ExtendedUserAdmin)


# ─── UserProfile ─────────────────────────────────────────────────────────────

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display   = ("user", "full_name", "phone", "created_at", "updated_at")
    list_filter    = ("created_at",)
    search_fields  = ("user__username", "user__email", "full_name", "phone")
    readonly_fields = ("created_at", "updated_at")
    ordering       = ("-created_at",)

    fieldsets = (
        ("User",    {"fields": ("user",)}),
        ("Details", {"fields": ("full_name", "phone", "address", "bio", "avatar")}),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",),
        }),
    )


# ─── SavedDestination ─────────────────────────────────────────────────────────

@admin.register(SavedDestination)
class SavedDestinationAdmin(admin.ModelAdmin):
    list_display   = ("user", "destination_name", "country", "saved_at")
    list_filter    = ("country", "saved_at")
    search_fields  = ("user__username", "destination_name", "country")
    ordering       = ("-saved_at",)
    date_hierarchy = "saved_at"


# ─── RecentSearch ─────────────────────────────────────────────────────────────

@admin.register(RecentSearch)
class RecentSearchAdmin(admin.ModelAdmin):
    list_display   = ("user", "short_query", "intent", "searched_at")
    list_filter    = ("intent", "searched_at")
    search_fields  = ("user__username", "query")
    ordering       = ("-searched_at",)
    date_hierarchy = "searched_at"

    def short_query(self, obj):
        return obj.query[:80] + ("..." if len(obj.query) > 80 else "")
    short_query.short_description = "Query"


# ─── Admin site branding ──────────────────────────────────────────────────────
admin.site.site_header  = "Tourist Guide Admin"
admin.site.site_title   = "Tourist Guide"
admin.site.index_title  = "Control Panel"
