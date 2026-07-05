"""
Local Travel Data Service
Provides travel information from the destinations.json file without any API calls.
This ensures unlimited usage with no quota limits.
"""
import json
import os
import re
from pathlib import Path

# Load destinations data
DESTINATIONS_PATH = Path(__file__).resolve().parent.parent / "tourists" / "tourist_chatbot" / "data" / "destinations.json"

_destinations_cache = None

def _load_destinations():
    global _destinations_cache
    if _destinations_cache is not None:
        return _destinations_cache
    try:
        with open(DESTINATIONS_PATH, 'r', encoding='utf-8') as f:
            _destinations_cache = json.load(f)
    except FileNotFoundError:
        _destinations_cache = {}
    return _destinations_cache


def find_destination(query):
    """Find a destination in the local data matching the user's query."""
    destinations = _load_destinations()
    query_lower = query.lower()
    
    # Direct match
    for name in destinations:
        if name in query_lower:
            return name, destinations[name]
    
    # Partial match
    for name in destinations:
        name_words = name.split()
        for word in name_words:
            if len(word) > 3 and word in query_lower:
                return name, destinations[name]
    
    return None, None


def get_destination_info(name, data):
    """Generate a formatted response for a destination from local data."""
    lines = []
    lines.append(f"📍 **{name.title()}**")
    lines.append("")
    lines.append(f"📸 **Images:**")
    for i, img_url in enumerate(data.get("images", []), 1):
        lines.append(f"   {i}. {img_url}")
    lines.append("")
    
    lat = data.get("lat")
    lng = data.get("lng")
    if lat and lng:
        lines.append(f"🌐 **Location:** {lat}, {lng}")
        lines.append(f"🗺️ **Google Maps:** {data.get('maps_link', '')}")
    
    return "\n".join(lines)


def get_all_destination_names():
    """Return a list of all available destination names."""
    destinations = _load_destinations()
    return list(destinations.keys())


def generate_local_response(user_input):
    """
    Generate a response using only local data (no API calls).
    Returns a formatted string response or None if no match found.
    """
    user_lower = user_input.lower().strip()
    destinations = _load_destinations()
    
    if not destinations:
        return None
    
    # Check for "list" or "available" destinations
    list_keywords = ["list", "available", "destinations", "places", "show me", "what places", "all places"]
    if any(kw in user_lower for kw in list_keywords) and not any(dest in user_lower for dest in destinations):
        names = list(destinations.keys())
        response = "🌍 **Available Destinations:**\n\n"
        # Group by first letter
        for i, name in enumerate(names, 1):
            response += f"{i}. {name.title()}\n"
        response += f"\n✨ *Total: {len(names)} destinations*\n"
        response += "\n💡 *Ask me about any of these places for details!*"
        return response
    
    # Find matching destination
    dest_name, dest_data = find_destination(user_input)
    
    if dest_name and dest_data:
        return get_destination_info(dest_name, dest_data)
    
    # Check for general travel queries we can answer
    greetings = ["hi", "hello", "hey", "good morning", "good afternoon", "good evening"]
    if any(g in user_lower for g in greetings):
        names = list(destinations.keys())
        return (
            "👋 **Hello! Welcome to Tourist Guide!**\n\n"
            "I can help you with information about these destinations:\n"
            f"🌍 *{len(names)} destinations available*\n\n"
            "💡 **Try asking:**\n"
            f"• \"Show me {names[0].title() if names else 'a place'}\"\n"
            "• \"List all destinations\"\n"
            "• \"Tell me about [any place]\"\n"
            "• \"Where is [destination] located?\"\n\n"
            "✨ *All responses are instant with no limits!*"
        )
    
    # Help query
    if "help" in user_lower or "what can you" in user_lower:
        names = list(destinations.keys())
        return (
            "🤖 **Tourist Guide - Help**\n\n"
            "I'm your travel assistant! Here's what I can do:\n\n"
            "📍 **Show destination info** - images, location, maps\n"
            "📋 **List all destinations** - see all available places\n"
            "🗺️ **Get maps link** - directions to any destination\n\n"
            f"🌍 *I have information on {len(names)} destinations!*\n\n"
            "💡 Just type a destination name or ask a question!"
        )
    
    return None