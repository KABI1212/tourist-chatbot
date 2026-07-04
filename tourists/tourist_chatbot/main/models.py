from django.db import models
from django.contrib.auth.models import User


class UserProfile(models.Model):
    """
    Stores additional user information such as full_name, phone, and address,
    linked to Django's built-in User model.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    full_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=20)
    address = models.TextField()

    def __str__(self):
        return f"{self.user.username}'s profile"


class ChatHistory(models.Model):
    """
    Stores chat conversations between users and the AI assistant.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="chat_histories")
    question = models.TextField()
    answer = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Chat histories"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.username} - {self.question[:50]}..."