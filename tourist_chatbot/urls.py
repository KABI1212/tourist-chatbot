from django.contrib import admin
from django.urls import path
from main import views  # <-- Import views from "main" app

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', views.dashboard_view, name='dashboard'),
    path('register/', views.register_view, name='register'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('home/', views.home_view, name='home'),
    path('chat/', views.chat_view, name='chat'),
]
