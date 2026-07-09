"""
DRF Serializers for Tourist Chatbot REST API.
"""
from django.contrib.auth.models import User
from rest_framework import serializers
from .models import UserProfile, SavedDestination, RecentSearch


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model  = UserProfile
        fields = ("full_name", "phone", "address", "bio")


class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)

    class Meta:
        model  = User
        fields = ("id", "username", "email", "first_name", "last_name",
                  "date_joined", "profile")
        read_only_fields = ("id", "username", "date_joined")


class RegisterSerializer(serializers.Serializer):
    username         = serializers.CharField(max_length=150)
    email            = serializers.EmailField()
    password         = serializers.CharField(min_length=8, write_only=True)
    confirm_password = serializers.CharField(write_only=True)
    full_name        = serializers.CharField(max_length=255, required=False, allow_blank=True)
    phone            = serializers.CharField(max_length=20, required=False, allow_blank=True)

    def validate(self, data):
        if data["password"] != data["confirm_password"]:
            raise serializers.ValidationError("Passwords do not match.")
        if User.objects.filter(username=data["username"]).exists():
            raise serializers.ValidationError("Username already exists.")
        if User.objects.filter(email=data["email"]).exists():
            raise serializers.ValidationError("Email already registered.")
        return data


class ChatMessageSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=1000)


class ChatHistoryItemSerializer(serializers.Serializer):
    message_id   = serializers.CharField()
    user_message = serializers.CharField()
    ai_reply     = serializers.CharField()
    intent       = serializers.CharField()
    source       = serializers.CharField()
    timestamp    = serializers.DateTimeField()


class SavedDestinationSerializer(serializers.ModelSerializer):
    class Meta:
        model  = SavedDestination
        fields = ("id", "destination_name", "country", "notes", "saved_at")
        read_only_fields = ("id", "saved_at")


class RecentSearchSerializer(serializers.ModelSerializer):
    class Meta:
        model  = RecentSearch
        fields = ("id", "query", "intent", "searched_at")
        read_only_fields = ("id", "searched_at")


class DestinationInfoSerializer(serializers.Serializer):
    """Validates the structured destination response dict."""
    place_name     = serializers.CharField()
    category       = serializers.CharField()
    country        = serializers.CharField()
    state          = serializers.CharField()
    latitude       = serializers.FloatField(allow_null=True)
    longitude      = serializers.FloatField(allow_null=True)
    about          = serializers.CharField()
    best_time      = serializers.CharField()
    wikipedia_url  = serializers.URLField(allow_null=True)
