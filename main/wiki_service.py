"""
Wikipedia Travel Info Service
Fetches travel information about any destination using the free Wikipedia API.
Completely free, no API key needed, no rate limits for reasonable usage.
"""
import json
import re
import urllib.request
import urllib.parse
import urllib.error

WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"
WIKIPEDIA_BASE = "https://en.wikipedia.org/wiki/"


def _wiki_request(params):
    """Make a request to the Wikipedia API."""
    params["format"] = "json"
    params["origin"] = "*"
    url = f"{WIKIPEDIA_API}?{urllib.parse.urlencode(params)}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "TouristGuide/1.0"})
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception:
        return None


def search_destination(query):
    """Search Wikipedia for a destination and return the best match."""
    # Extract the place name from common query patterns
    clean_query = query.lower().strip()
    
    # Remove common prefixes
    for prefix in ["tell me about", "show me", "what is", "where is", 
                    "information about", "details about", "i want to know about",
                    "about", "describe", "explain", "find"]:
        if clean_query.startswith(prefix):
            clean_query = clean_query[len(prefix):].strip()
    
    # Remove trailing words
    for suffix in ["tourism", "travel", "tourist", "destination", "place", "city", "town"]:
        if clean_query.endswith(suffix):
            clean_query = clean_query[:-len(suffix)].strip()
    
    if not clean_query:
        clean_query = query
    
    # Try with "tourism" suffix first (better for travel results)
    search_queries = [
        clean_query + " tourism",
        clean_query + " travel",
        clean_query,
    ]
    
    for sq in search_queries:
        params = {
            "action": "query",
            "list": "search",
            "srsearch": sq,
            "srlimit": 5,
            "srprop": "snippet",
        }
        data = _wiki_request(params)
        if data and "query" in data and "search" in data["query"]:
            results = data["query"]["search"]
            if results:
                # Score results: prefer exact title matches
                best_result = None
                best_score = -1
                
                for r in results:
                    title_lower = r["title"].lower()
                    score = 0
                    
                    # Exact match gets highest score
                    if title_lower == clean_query:
                        score = 100
                    # Title contains the query
                    elif clean_query in title_lower:
                        score = 50
                    # Query contains the title
                    elif title_lower in clean_query:
                        score = 40
                    # Partial word match
                    else:
                        query_words = set(clean_query.split())
                        title_words = set(title_lower.split())
                        common = query_words & title_words
                        score = len(common) * 10
                    
                    # Bonus for geographic terms
                    geo_terms = ["city", "town", "village", "island", "mountain", 
                                "river", "lake", "park", "beach", "valley", "region"]
                    if any(term in title_lower for term in geo_terms):
                        score += 5
                    
                    if score > best_score:
                        best_score = score
                        best_result = r
                
                if best_result and best_score > 0:
                    return best_result["title"], best_result["pageid"]
    
    return None


def get_page_summary(page_title):
    """Get a summary/extract of a Wikipedia page."""
    params = {
        "action": "query",
        "titles": page_title,
        "prop": "extracts",
        "exintro": True,
        "explaintext": True,
        "exlimit": 1,
    }
    data = _wiki_request(params)
    if not data or "query" not in data or "pages" not in data["query"]:
        return None

    pages = data["query"]["pages"]
    for page_id, page_data in pages.items():
        if page_id != "-1" and "extract" in page_data:
            return page_data["extract"]
    return None


def get_page_images(page_title, limit=5):
    """Get images from a Wikipedia page."""
    params = {
        "action": "query",
        "titles": page_title,
        "prop": "pageimages",
        "pithumbsize": 600,
        "pilimit": limit,
    }
    data = _wiki_request(params)
    if not data or "query" not in data or "pages" not in data["query"]:
        return []

    images = []
    pages = data["query"]["pages"]
    for page_id, page_data in pages.items():
        if page_id != "-1" and "thumbnail" in page_data:
            images.append(page_data["thumbnail"]["source"])
        if page_id != "-1" and "pageimage" in page_data:
            pass  # We already have the thumbnail

    return images


def get_coordinates(page_title):
    """Get coordinates for a destination from Wikipedia."""
    params = {
        "action": "query",
        "titles": page_title,
        "prop": "coordinates",
    }
    data = _wiki_request(params)
    if not data or "query" not in data or "pages" not in data["query"]:
        return None

    pages = data["query"]["pages"]
    for page_id, page_data in pages.items():
        if page_id != "-1" and "coordinates" in page_data:
            coords = page_data["coordinates"][0]
            return coords["lat"], coords["lon"]
    return None


def generate_wiki_response(user_input):
    """
    Generate a travel response using Wikipedia data.
    Returns a formatted string or None if no info found.
    """
    # Clean the query
    query = user_input.strip().lower()

    # Skip very short queries
    if len(query) < 3:
        return None

    # Skip greetings and non-destination queries
    skip_words = ["hi", "hello", "hey", "help", "thanks", "thank", "bye", "good"]
    if query in skip_words:
        return None

    # Search for the destination
    result = search_destination(query)
    if not result:
        return None

    page_title, page_id = result

    # Get summary
    summary = get_page_summary(page_title)
    if not summary:
        return None

    # Get images
    images = get_page_images(page_title)

    # Get coordinates
    coords = get_coordinates(page_title)

    # Build response
    lines = []
    lines.append(f"📍 **{page_title}**")
    lines.append("")

    # Truncate summary to a reasonable length
    if len(summary) > 800:
        summary = summary[:800] + "..."
    lines.append(summary)
    lines.append("")

    # Images
    if images:
        lines.append("📸 **Images:**")
        for i, img_url in enumerate(images[:3], 1):
            lines.append(f"   {i}. {img_url}")
        lines.append("")

    # Coordinates and map
    if coords:
        lat, lng = coords
        maps_link = f"https://www.google.com/maps/search/?api=1&query={lat},{lng}"
        lines.append(f"🌐 **Location:** {lat}, {lng}")
        lines.append(f"🗺️ **Google Maps:** {maps_link}")
        lines.append("")

    # Wikipedia link
    wiki_url = f"{WIKIPEDIA_BASE}{urllib.parse.quote(page_title.replace(' ', '_'))}"
    lines.append(f"📖 **Learn more:** {wiki_url}")
    lines.append("")
    lines.append("💡 *Tip: Ask me for hotels, food, transport, or budget details about this place!*")

    return "\n".join(lines)