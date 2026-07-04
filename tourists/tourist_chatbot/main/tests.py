"""
Tests for the main app - authentication, chat, and models.
"""

from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.urls import reverse
from .models import UserProfile, ChatHistory
import json
from unittest.mock import patch


class UserProfileModelTest(TestCase):
    """Test the UserProfile model."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="testpass123"
        )
        self.profile = UserProfile.objects.create(
            user=self.user,
            full_name="Test User",
            phone="1234567890",
            address="Test Address",
        )

    def test_profile_creation(self):
        """Test that a UserProfile is created correctly."""
        self.assertEqual(self.profile.user.username, "testuser")
        self.assertEqual(self.profile.full_name, "Test User")
        self.assertEqual(str(self.profile), "testuser's profile")


class ChatHistoryModelTest(TestCase):
    """Test the ChatHistory model."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="chatuser", password="testpass123"
        )

    def test_chat_history_creation(self):
        """Test that ChatHistory is created correctly."""
        chat = ChatHistory.objects.create(
            user=self.user,
            question="What are some good places to visit in Goa?",
            answer="Goa has many beautiful beaches like Baga, Anjuna, and Palolem.",
        )
        self.assertEqual(chat.user.username, "chatuser")
        self.assertIn("Goa", chat.question)
        self.assertIn("beaches", chat.answer)
        self.assertIsNotNone(chat.created_at)
        self.assertEqual(str(chat), "chatuser - What are some good places to visit in Goa?...")


class AuthViewsTest(TestCase):
    """Test authentication views."""

    def setUp(self):
        self.client = Client()
        self.register_url = reverse("register")
        self.login_url = reverse("login")
        self.logout_url = reverse("logout")
        self.home_url = reverse("home")

    def test_register_page_loads(self):
        """Test register page loads successfully."""
        response = self.client.get(self.register_url)
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, "register.html")

    def test_register_success(self):
        """Test user registration works."""
        response = self.client.post(
            self.register_url,
            {
                "username": "newuser",
                "email": "newuser@example.com",
                "password": "StrongPass123",
                "confirm_password": "StrongPass123",
                "full_name": "New User",
                "phone": "9876543210",
                "address": "New Address",
            },
        )
        self.assertEqual(response.status_code, 302)  # Redirect after success
        self.assertTrue(User.objects.filter(username="newuser").exists())
        self.assertTrue(UserProfile.objects.filter(user__username="newuser").exists())

    def test_register_password_mismatch(self):
        """Test registration fails when passwords don't match."""
        response = self.client.post(
            self.register_url,
            {
                "username": "newuser2",
                "email": "newuser2@example.com",
                "password": "StrongPass123",
                "confirm_password": "DifferentPass456",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Passwords do not match")

    def test_login_page_loads(self):
        """Test login page loads successfully."""
        response = self.client.get(self.login_url)
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, "login.html")

    def test_login_success(self):
        """Test user login works."""
        User.objects.create_user(username="logintest", password="testpass123")
        response = self.client.post(
            self.login_url,
            {"username": "logintest", "password": "testpass123"},
        )
        self.assertEqual(response.status_code, 302)  # Redirect to home

    def test_login_failure(self):
        """Test login fails with wrong credentials."""
        response = self.client.post(
            self.login_url,
            {"username": "nonexistent", "password": "wrongpass"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Invalid username or password")

    def test_logout(self):
        """Test logout works."""
        User.objects.create_user(username="logouttest", password="testpass123")
        self.client.login(username="logouttest", password="testpass123")
        response = self.client.get(self.logout_url)
        self.assertEqual(response.status_code, 302)  # Redirect to dashboard

    def test_home_requires_login(self):
        """Test home page redirects to login when not authenticated."""
        response = self.client.get(self.home_url)
        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse("login"), response.url)


class DashboardViewTest(TestCase):
    """Test dashboard view."""

    def setUp(self):
        self.client = Client()
        self.dashboard_url = reverse("dashboard")

    def test_dashboard_loads(self):
        """Test dashboard page loads successfully."""
        response = self.client.get(self.dashboard_url)
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, "dashboard.html")


class ChatViewTest(TestCase):
    """Test chat view."""

    def setUp(self):
        self.client = Client()
        self.chat_url = reverse("chat")
        self.user = User.objects.create_user(
            username="chattest", password="testpass123"
        )

    def test_chat_requires_login(self):
        """Test chat view redirects when not logged in."""
        response = self.client.get(self.chat_url)
        self.assertEqual(response.status_code, 302)

    def test_chat_get_request(self):
        """Test chat page loads for authenticated users."""
        self.client.login(username="chattest", password="testpass123")
        response = self.client.get(self.chat_url)
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, "chat.html")

    def test_chat_empty_message(self):
        """Test chat returns error for empty message."""
        self.client.login(username="chattest", password="testpass123")
        response = self.client.post(
            self.chat_url,
            json.dumps({"message": ""}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.content)
        self.assertIn("error", data)

    def test_chat_message_too_long(self):
        """Test chat rejects messages exceeding 500 characters."""
        self.client.login(username="chattest", password="testpass123")
        long_message = "x" * 501
        response = self.client.post(
            self.chat_url,
            json.dumps({"message": long_message}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.content)
        self.assertIn("error", data)

    @patch("main.views.chat.ask_gemini")
    def test_chat_success(self, mock_ask_gemini):
        """Test chat successfully returns AI response."""
        mock_ask_gemini.return_value = (
            "Destination: Goa\nFamous Food: Bebinca\nTransport: Flight available"
        )
        self.client.login(username="chattest", password="testpass123")
        response = self.client.post(
            self.chat_url,
            json.dumps({"message": "Tell me about Goa"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertIn("response", data)
        self.assertIsInstance(data["response"], list)
        self.assertTrue(len(data["response"]) > 0)

    @patch("main.views.chat.ask_gemini")
    def test_chat_history_saved(self, mock_ask_gemini):
        """Test that chat history is saved to database."""
        mock_ask_gemini.return_value = "Goa is a beautiful destination."
        self.client.login(username="chattest", password="testpass123")
        self.client.post(
            self.chat_url,
            json.dumps({"message": "Tell me about Goa"}),
            content_type="application/json",
        )
        self.assertEqual(ChatHistory.objects.count(), 1)
        chat = ChatHistory.objects.first()
        self.assertEqual(chat.user.username, "chattest")
        self.assertEqual(chat.question, "Tell me about Goa")