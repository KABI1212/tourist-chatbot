"""
Destination Media Service
Provides destination images (via Unsplash API) and Google Maps location links
for the Smart Tourism Platform chatbot.

Supports:
1. Unsplash API integration for high-quality destination images
2. Google Geocoding API for precise coordinates and Google Maps links
3. Static fallback dataset (no API keys required for basic destinations)
"""

import os
import json
import logging
from typing import List, Dict, Optional, Tuple

logger = logging.getLogger(__name__)

# ─── Static fallback dataset ──────────────────────────────────────────
# Pre‑collected images & coordinates for popular destinations.
# Used when API keys are not set or as a fast fallback.

_STATIC_DESTINATIONS_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..", "..", "data", "destinations.json"
)

# Inline fallback for the most popular destinations (used if file not found)
_FALLBACK_DESTINATIONS = {
    "eiffel tower": {
        "images": [
            "https://images.unsplash.com/photo-1543349689-9a4d426bee8e?w=800",
            "https://images.unsplash.com/photo-1511739001486-6bfe10cec9e4?w=800",
            "https://images.unsplash.com/photo-1549877452-9c387954fbc2?w=800",
        ],
        "lat": 48.8584,
        "lng": 2.2945,
        "maps_link": "https://www.google.com/maps/search/?api=1&query=48.8584,2.2945",
    },
    "taj mahal": {
        "images": [
            "https://images.unsplash.com/photo-1564507592333-c60657eea523?w=800",
            "https://images.unsplash.com/photo-1599858769708-7c1ff5b6e47c?w=800",
            "https://images.unsplash.com/photo-1567157577867-917a9d7d9468?w=800",
        ],
        "lat": 27.1751,
        "lng": 78.0421,
        "maps_link": "https://www.google.com/maps/search/?api=1&query=27.1751,78.0421",
    },
    "colosseum": {
        "images": [
            "https://images.unsplash.com/photo-1562832135-14a35d25edef?w=800",
            "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800",
            "https://images.unsplash.com/photo-1605100764556-1f1c0f3c0e0e?w=800",
        ],
        "lat": 41.8902,
        "lng": 12.4922,
        "maps_link": "https://www.google.com/maps/search/?api=1&query=41.8902,12.4922",
    },
    "statue of liberty": {
        "images": [
            "https://images.unsplash.com/photo-1605130284535-b11db9d7c0a1?w=800",
            "https://images.unsplash.com/photo-1565130838609-c3a86655db61?w=800",
            "https://images.unsplash.com/photo-1590210697004-39f1ae1c6f19?w=800",
        ],
        "lat": 40.6892,
        "lng": -74.0445,
        "maps_link": "https://www.google.com/maps/search/?api=1&query=40.6892,-74.0445",
    },
    "machu picchu": {
        "images": [
            "https://images.unsplash.com/photo-1587595431973-160d0d94add1?w=800",
            "https://images.unsplash.com/photo-1526392060635-9d6019884377?w=800",
            "https://images.unsplash.com/photo-1580619305218-8423a7ef79b4?w=800",
        ],
        "lat": -13.1631,
        "lng": -72.5450,
        "maps_link": "https://www.google.com/maps/search/?api=1&query=-13.1631,-72.5450",
    },
    "great wall of china": {
        "images": [
            "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=800",
            "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800",
            "https://images.unsplash.com/photo-1599796915065-e860a5c97d33?w=800",
        ],
        "lat": 40.4319,
        "lng": 116.5704,
        "maps_link": "https://www.google.com/maps/search/?api=1&query=40.4319,116.5704",
    },
    "santorini": {
        "images": [
            "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=800",
            "https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=800",
            "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=800",
        ],
        "lat": 36.3932,
        "lng": 25.4615,
        "maps_link": "https://www.google.com/maps/search/?api=1&query=36.3932,25.4615",
    },
    "goa": {
        "images": [
            "https://images.unsplash.com/photo-1512343879784-a960bf40e7f0?w=800",
            "https://images.unsplash.com/photo-1614082242765-7c98ca0f3df5?w=800",
            "https://images.unsplash.com/photo-1582803859185-5848480cf5b5?w=800",
        ],
        "lat": 15.2993,
        "lng": 74.1240,
        "maps_link": "https://www.google.com/maps/search/?api=1&query=15.2993,74.1240",
    },
    "kerala": {
        "images": [
            "https://images.unsplash.com/photo-1593693397690-362cb9666fc2?w=800",
            "https://images.unsplash.com/photo-1602216054341-2d4b6b0c7b1e?w=800",
            "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800",
        ],
        "lat": 10.8505,
        "lng": 76.2711,
        "maps_link": "https://www.google.com/maps/search/?api=1&query=10.8505,76.2711",
    },
    "manali": {
        "images": [
            "https://images.unsplash.com/photo-1589632056659-9e5f62fb4b5f?w=800",
            "https://images.unsplash.com/photo-1589798058781-d1f1937a59c1?w=800",
            "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800",
        ],
        "lat": 32.2396,
        "lng": 77.1887,
        "maps_link": "https://www.google.com/maps/search/?api=1&query=32.2396,77.1887",
    },
    "jaipur": {
        "images": [
            "https://images.unsplash.com/photo-1599661046289-e31897846e41?w=800",
            "https://images.unsplash.com/photo-1477587458883-47145ed94245?w=800",
            "https://images.unsplash.com/photo-1586105251261-72a756497a11?w=800",
        ],
        "lat": 26.9124,
        "lng": 75.7873,
        "maps_link": "https://www.google.com/maps/search/?api=1&query=26.9124,75.7873",
    },
    "agra": {
        "images": [
            "https://images.unsplash.com/photo-1564507592333-c60657eea523?w=800",
            "https://images.unsplash.com/photo-1599858769708-7c1ff5b6e47c?w=800",
            "https://images.unsplash.com/photo-1567157577867-917a9d7d9468?w=800",
        ],
        "lat": 27.1767,
        "lng": 78.0081,
        "maps_link": "https://www.google.com/maps/search/?api=1&query=27.1767,78.0081",
    },
}


def _load_static_data() -> Dict:
    """Load static destination data from JSON file if exists, else use inline fallback."""
    try:
        if os.path.exists(_STATIC_DESTINATIONS_PATH):
            with open(_STATIC_DESTINATIONS_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception as e:
        logger.warning(f"Could not load static destinations file: {e}")
    return _FALLBACK_DESTINATIONS


def get_destination_key(name: str) -> Optional[str]:
    """
    Normalize destination name to lookup key.
    Returns None if no match found.
    """
    if not name:
        return None
    name_lower = name.strip().lower()

    # Try exact match
    static_data = _load_static_data()
    if name_lower in static_data:
        return name_lower

    # Try partial match
    for key in static_data:
        if key in name_lower or name_lower in key:
            return key

    return None


def get_destination_images(destination_name: str) -> List[str]:
    """
    Get up to 3 high-quality images for a destination.
    Returns empty list if not found.
    """
    # 1. Try Unsplash API if key is set
    unsplash_key = os.getenv("UNSPLASH_ACCESS_KEY", "")
    if unsplash_key:
        try:
            images = _fetch_from_unsplash(destination_name, unsplash_key)
            if images:
                return images
        except Exception as e:
            logger.warning(f"Unsplash fetch failed for '{destination_name}': {e}")

    # 2. Fallback to static dataset
    key = get_destination_key(destination_name)
    if key:
        static_data = _load_static_data()
        return static_data[key].get("images", [])

    return []


def get_destination_location(destination_name: str) -> Dict:
    """
    Get location data (lat, lng, maps_link) for a destination.
    Returns empty dict if not found.
    """
    # 1. Try Google Geocoding API if key is set
    maps_key = os.getenv("GOOGLE_MAPS_API_KEY", "")
    if maps_key:
        try:
            location = _fetch_from_geocoding(destination_name, maps_key)
            if location:
                return location
        except Exception as e:
            logger.warning(f"Geocoding fetch failed for '{destination_name}': {e}")

    # 2. Fallback to static dataset
    key = get_destination_key(destination_name)
    if key:
        static_data = _load_static_data()
        data = static_data[key]
        return {
            "lat": data["lat"],
            "lng": data["lng"],
            "maps_link": data["maps_link"],
        }

    return {}


def _fetch_from_unsplash(query: str, api_key: str) -> List[str]:
    """
    Fetch destination images from Unsplash API.
    Returns up to 3 image URLs.
    """
    import requests

    url = "https://api.unsplash.com/search/photos"
    params = {
        "query": query,
        "per_page": 3,
        "client_id": api_key,
        "orientation": "landscape",
    }
    try:
        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        results = resp.json().get("results", [])
        return [img["urls"]["regular"] for img in results]
    except Exception as e:
        logger.error(f"Unsplash API error for '{query}': {e}")
        return []


def _fetch_from_geocoding(place: str, api_key: str) -> Dict:
    """
    Fetch coordinates and generate Google Maps link.
    """
    import requests

    url = "https://maps.googleapis.com/maps/api/geocode/json"
    params = {"address": place, "key": api_key}
    try:
        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        if data.get("status") == "OK" and data.get("results"):
            loc = data["results"][0]["geometry"]["location"]
            lat, lng = loc["lat"], loc["lng"]
            return {
                "lat": lat,
                "lng": lng,
                "maps_link": f"https://www.google.com/maps/search/?api=1&query={lat},{lng}",
            }
    except Exception as e:
        logger.error(f"Geocoding API error for '{place}': {e}")
    return {}


def format_destination_media_response(
    destination_name: str,
    images: List[str],
    location: Dict,
) -> str:
    """
    Format destination media (images + map link) into a markdown string
    suitable for the chat response.

    Returns an empty string if no media is available.
    """
    parts = []

    if images:
        parts.append(f"\n📸 **Images of {destination_name}:**\n")
        for i, img_url in enumerate(images[:3], 1):
            parts.append(f"![{destination_name} - Image {i}]({img_url})")

    if location and location.get("maps_link"):
        parts.append(
            f"\n📍 **Location:** [View {destination_name} on Google Maps]({location['maps_link']})"
        )
        if location.get("lat") and location.get("lng"):
            parts.append(
                f"   Coordinates: {location['lat']:.4f}, {location['lng']:.4f}"
            )

    return "\n".join(parts) if parts else ""