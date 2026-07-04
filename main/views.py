from django.shortcuts import render, redirect
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required
from .models import UserProfile
import google.generativeai as genai
from dotenv import load_dotenv
import os
import json

# Load environment variables
load_dotenv()

# Configure Gemini API key
genai.configure(api_key=os.environ.get("GOOGLE_API_KEY"))


# Create the model
generation_config = {
    "temperature": 0,
    "top_p": 0.95,
    "top_k": 64,
    "max_output_tokens": 8192,
    "response_mime_type": "text/plain",
}

# Safety settings for content moderation
safety_settings = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
]

# Initialize the model with safety and generation configurations
model = genai.GenerativeModel(
    model_name="gemini-2.5-flash-lite",
    safety_settings=safety_settings,
    generation_config=generation_config,
    system_instruction=[
        "You are a travel planning chatbot. Follow these strict instructions carefully to provide accurate, detailed, and visually clean travel information."
        "All responses must convert clickable URLs properly: if a URL is provided in bracket format [https://...], remove the brackets and output it as a clickable link; if a raw URL is provided, output it as a clickable link."
        ""
        "======================"
        "TRAVEL RESPONSE FORMAT AND RULES"
        "======================"
        ""
        "1. DESTINATION DETAILS"
        "   - Clearly state the travel route extracted from the user query, including the starting point and destination."
        "   - If the user searches for a specific country, include seasonal specialties for each state."
        "   - Double-check the route before generating the map link."
        ""
        "----------------------"
        "2. CULTURAL INSIGHTS"
        "   - Provide rich cultural experiences, including local traditions, festivals, and historical insights."
        "   - Add specific details such as dates, rituals, traditional dress codes, and local customs that travelers should try or avoid."
        ""
        "----------------------"
        "3. TRANSPORTATION OPTIONS"
        "   Present all possible travel modes in separate, clearly spaced sections. For each mode include:"
        "   - Cost"
        "   - Estimated travel time"
        "   - Practical travel tips (e.g., preferred routes, packing recommendations)"
        "   - Savings compared to other modes of transport"
        ""
        "   Example format for each:"
        ""
        "   Personal Vehicle:"
        "       • Cost: ₹2,000 (includes petrol and tolls)"
        "       • Time: 6 hrs"
        "       • Tips: Use NH44 for smoother roads; carry extra snacks."
        "       • Savings vs flight: ₹5,000 saved"
        ""
        "   (Repeat similar blocks for Flight, Train, and Bus)"
        ""
        "----------------------"
        "4. FAMOUS FOODS & SNACKS"
        "   - List unique local dishes and popular snacks."
        "   - For each item, provide:"
        "       • Cost"
        "       • Taste profile (e.g., spicy, savory, sweet)"
        "       • Best time to eat (breakfast, mid-afternoon, dinner, etc.)"
        "       • Additional details such as where to try them and any cultural significance"
        ""
        "----------------------"
        "5. ACCOMMODATION OPTIONS"
        "   Provide recommendations categorized as Budget, Mid-Range, and Luxury. For each category list one or more hotels with:"
        "       • Hotel Name"
        "       • Approximate cost per night"
        "       • Complete address"
        "       • Phone number"
        "       • Feedback rating (out of 5)"
        ""
        "----------------------"
        "6. COST BREAKDOWN"
        "   Clearly list expenses in separate sections for each traveler type:"
        "       • Budget Traveler: Food, Transport, Activities, Stay"
        "       • Mid-Range Traveler: Food, Transport, Activities, Stay"
        "       • Luxury Traveler: Food, Transport, Activities, Stay"
        ""
        "----------------------"
        "7. GOOGLE MAPS LINK"
        "   - At the end of the response include a single-line, clickable Google Maps link."
        "   - The link must extract the starting point and destination from the query in this format:"
        "       [https://www.google.com/maps/dir/starting_point/destination]"
        "   - Ensure the entire link appears on its own single line with no other text."
        ""
        "----------------------"
        "8. BOOKING SITES"
        "   - At the very bottom of your response include clickable booking site links (each on its own line) as follows:"
        "       • If the user prefers flights, include: ([https://www.makemytrip.com])"
        "       • If the user prefers bus travel, include: ([https://www.redbus.in])"
        "       • Always include: https://www.booking.com as the active and clickable link ([https://www.booking.com])"
        ""
        "----------------------"
        "9. CLICKABLE LINK CONVERSION"
        "   - Ensure that any URLs in the response are converted into clickable links."
        "   - If a URL is enclosed in square brackets (e.g., [https://example.com]), remove the brackets and display the URL as a clickable link."
        "   - If a raw URL is present, display it as a clickable link without any additional formatting."
        ""
        "----------------------"
        "GENERAL TIPS"
        "   - Maintain perfect spacing and neat UI between all sections."
        "   - Provide concise yet comprehensive details."
        "   - Ensure conditional elements (booking sites) appear according to the user’s preference."
        "   - Double-check extracted travel details to ensure an accurate and complete response."
      


    ]
)


@csrf_exempt
def chat_view(request):
    """
    Handles POST requests for chatbot responses.
    If GET, just render 'chat.html'.
    """
    if request.method == "POST":
        try:
            # Parse the incoming JSON data
            data = json.loads(request.body)
            user_input = data.get("message", "")

            if not user_input:
                return JsonResponse({"error": "No message provided"}, status=400)

            # Start a new chat session with the model
            chat_session = model.start_chat(history=[])
            response = chat_session.send_message(user_input)
            model_response = response.text

            # Split the response into lines and format them
            response_lines = model_response.split("\n")
            formatted_response = []

            for line in response_lines:
                if line.strip():  # Skip empty lines
                    topic_details = line.split(":")
                    if len(topic_details) > 1:
                        topic = topic_details[0].strip()
                        details = ":".join(topic_details[1:]).strip()
                        formatted_response.append({"topic": topic, "details": details})
                    else:
                        formatted_response.append({"topic": line.strip(), "details": ""})

            return JsonResponse({"response": formatted_response})

        except Exception as e:
            # Return error message for any exception during processing
            return JsonResponse({"error": str(e)}, status=500)

    # If GET request, render the chat.html page
    return render(request, 'chat.html')

def register_view(request):
    """
    Handles user registration by saving details to the database and a UserProfile model.
    """
    if request.method == 'POST':
        # Get form data
        username = request.POST.get('username')
        email = request.POST.get('email')
        password = request.POST.get('password')
        confirm_password = request.POST.get('confirm_password')
        full_name = request.POST.get('full_name')
        phone = request.POST.get('phone')
        address = request.POST.get('address')

        # Validate passwords match
        if password != confirm_password:
            return render(request, 'register.html', {'error': 'Passwords do not match'})

        # Check if username already exists
        if User.objects.filter(username=username).exists():
            return render(request, 'register.html', {'error': 'Username already exists'})

        # Check if email already exists
        if User.objects.filter(email=email).exists():
            return render(request, 'register.html', {'error': 'Email already exists'})

        try:
            # Create user and profile
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password
            )
            profile = UserProfile.objects.create(
                user=user,
                full_name=full_name,
                phone=phone,
                address=address
            )

            # Log the user in
            login(request, user)
            return redirect('home')

        except Exception as e:
            # If user was partially created and an error occurs, clean up
            if 'user' in locals():
                user.delete()
            return render(request, 'register.html', {'error': str(e)})

    return render(request, 'register.html')

def login_view(request):
    """
    Handles user login.
    """
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')

        if not username or not password:
            return render(request, 'login.html', {'error': 'Please fill in all fields'})

        # Authenticate user
        user = authenticate(request, username=username, password=password)
        if user is not None:
            login(request, user)
            return redirect('home')
        else:
            return render(request, 'login.html', {'error': 'Invalid username or password'})

    return render(request, 'login.html')

def logout_view(request):
    """
    Logs out the user and redirects to the dashboard page.
    """
    logout(request)
    return redirect('dashboard')

def dashboard_view(request):
    """
    Renders the dashboard page.
    """
    return render(request, 'dashboard.html')

def home_view(request):
    """
    Renders the home page. Requires login.
    """
    if not request.user.is_authenticated:
        return redirect('login')
    return render(request, 'home.html')