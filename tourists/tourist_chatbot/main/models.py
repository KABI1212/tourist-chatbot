"""
Tourist Chatbot — Models
"""
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class UserProfile(models.Model):
    """
    Extends the built-in User with travel-specific profile fields.
    Created automatically on registration.
    """
    user      = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    full_name = models.CharField(max_length=255, blank=True)
    phone     = models.CharField(max_length=20, blank=True)
    address   = models.TextField(blank=True)
    avatar    = models.ImageField(upload_to="avatars/", blank=True, null=True)
    bio       = models.TextField(blank=True, help_text="Short bio or travel interests")
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)

    class Meta:
        verbose_name        = "User Profile"
        verbose_name_plural = "User Profiles"

    def __str__(self):
        return f"{self.user.username} — {self.full_name or 'No name'}"


class SavedDestination(models.Model):
    """Destinations a user has explicitly saved / bookmarked."""
    user            = models.ForeignKey(User, on_delete=models.CASCADE, related_name="saved_destinations")
    destination_name = models.CharField(max_length=255)
    country         = models.CharField(max_length=100, blank=True)
    notes           = models.TextField(blank=True)
    saved_at        = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together     = ("user", "destination_name")
        ordering            = ["-saved_at"]
        verbose_name        = "Saved Destination"
        verbose_name_plural = "Saved Destinations"

    def __str__(self):
        return f"{self.user.username} → {self.destination_name}"


class RecentSearch(models.Model):
    """Tracks the last N searches per user for quick re-access."""
    user      = models.ForeignKey(User, on_delete=models.CASCADE, related_name="recent_searches")
    query     = models.CharField(max_length=500)
    intent    = models.CharField(max_length=50, blank=True)
    searched_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering            = ["-searched_at"]
        verbose_name        = "Recent Search"
        verbose_name_plural = "Recent Searches"

    def __str__(self):
        return f"{self.user.username}: {self.query[:60]}"

    @classmethod
    def record(cls, user, query: str, intent: str = ""):
        """Upsert a search record and keep only the last 20 per user."""
        obj, _ = cls.objects.update_or_create(
            user=user, query=query,
            defaults={"intent": intent, "searched_at": timezone.now()},
        )
        # Prune: keep newest 20 only
        old_ids = (
            cls.objects.filter(user=user)
            .order_by("-searched_at")
            .values_list("pk", flat=True)[20:]
        )
        if old_ids:
            cls.objects.filter(pk__in=list(old_ids)).delete()
        return obj
