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
