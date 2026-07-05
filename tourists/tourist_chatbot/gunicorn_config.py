# Gunicorn configuration for production
# Used by Railway/Render for deployment

import os
import sys
import logging

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Set Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tourist_chatbot.settings')

# Bind to all available interfaces
bind = f"0.0.0.0:{os.environ.get('PORT', 8000)}"
# Worker configuration
workers = 4
worker_class = "sync"
timeout = 120
keepalive = 5

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"

# SSL (HTTPS) - handled by reverse proxy in production
forwarded_allow_ips = "*"
proxy_protocol = True