"""
API check script - tests the Gemini API connection.
Uses environment variables for the API key.
"""

import os
from dotenv import load_dotenv
from google import genai

# Load environment variables
load_dotenv()

# Configure Gemini with API key from .env
api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    print("ERROR: GOOGLE_API_KEY not found in .env file")
    exit(1)

client = genai.Client(api_key=api_key)

response = client.models.generate_content(
    model="gemini-2.5-flash-lite",
    contents="tell me about yourself",
)

print(response.text)
