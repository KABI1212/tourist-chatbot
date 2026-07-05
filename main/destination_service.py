"""
Comprehensive Destination Information Service
Fetches detailed travel information about ANY destination using free APIs.
No API keys needed - uses Wikipedia, Nominatim (OSM), Unsplash, and more.
"""
import json
import re
import urllib.request
import urllib.parse
import urllib.error
import ssl
from datetime import datetime

# ─── API Endpoints ───
WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"
WIKIPEDIA_BASE = "https://en.wikipedia.org/wiki/"
NOMINATIM_API = "https://nominatim.openstreetmap.org"
UNSPLASH_API = "https://api.unsplash.com/search/photos"
WIKIDATA_API = "https://www.wikidata.org/w/api.php"

# Unsplash access key (free tier, no login needed for basic search)
UNSPLASH_ACCESS_KEY = ""

# SSL context for older Python versions
ssl_ctx = ssl._create_unverified_context()


def _fetch_json(url, headers=None, params=None):
    """Fetch JSON from a URL with error handling."""
    if params:
        url += "?" + urllib.parse.urlencode(params)
    default_headers = {"User-Agent": "TouristGuide/1.0 (travel-app)"}
    if headers:
        default_headers.update(headers)
    try:
        req = urllib.request.Request(url, headers=default_headers)
        with urllib.request.urlopen(req, timeout=15, context=ssl_ctx) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception:
        return None


def _wiki_request(params):
    """Make a request to the Wikipedia API."""
    params["format"] = "json"
    params["origin"] = "*"
    return _fetch_json(WIKIPEDIA_API, params=params)


# ─── Step 1: Search & Identify Destination ───

def search_destination(query):
    """Search Wikipedia for a destination and return the best match with page info."""
    clean_query = query.lower().strip()
    
    # Remove common prefixes
    prefixes = ["tell me about", "show me", "what is", "where is",
                "information about", "details about", "i want to know about",
                "about", "describe", "explain", "find", "info on"]
    for prefix in prefixes:
        if clean_query.startswith(prefix):
            clean_query = clean_query[len(prefix):].strip()
    
    # Remove trailing noise
    for suffix in ["tourism", "travel", "tourist", "destination", "place"]:
        if clean_query.endswith(suffix):
            clean_query = clean_query[:-len(suffix)].strip()
    
    if not clean_query:
        clean_query = query
    
    search_queries = [clean_query + " tourism", clean_query + " travel", clean_query]
    
    for sq in search_queries:
        data = _wiki_request({
            "action": "query",
            "list": "search",
            "srsearch": sq,
            "srlimit": 10,
            "srprop": "snippet|pageid",
        })
        if data and "query" in data and "search" in data["query"]:
            results = data["query"]["search"]
            if results:
                best = None
                best_score = -1
                for r in results:
                    title_lower = r["title"].lower()
                    score = 0
                    if title_lower == clean_query:
                        score = 100
                    elif clean_query in title_lower:
                        score = 50
                    elif title_lower in clean_query:
                        score = 40
                    else:
                        q_words = set(clean_query.split())
                        t_words = set(title_lower.split())
                        common = q_words & t_words
                        score = len(common) * 10
                    
                    geo_terms = ["city", "town", "village", "island", "mountain",
                                "river", "lake", "park", "beach", "valley", "region",
                                "temple", "monument", "museum", "fort", "palace",
                                "waterfall", "hill", "station", "garden", "sanctuary"]
                    if any(term in title_lower for term in geo_terms):
                        score += 5
                    
                    if score > best_score:
                        best_score = score
                        best = r
                
                if best and best_score > 0:
                    return best["title"], best["pageid"]
    return None, None


# ─── Step 2: Get Wikipedia Page Data ───

def get_wikipedia_data(page_title):
    """Get comprehensive data from Wikipedia."""
    params = {
        "action": "query",
        "titles": page_title,
        "prop": "extracts|pageimages|coordinates|info|categories",
        "exintro": False,
        "explaintext": True,
        "exlimit": 1,
        "pithumbsize": 800,
        "pilimit": 10,
        "inprop": "url",
        "cllimit": 50,
    }
    data = _wiki_request(params)
    if not data or "query" not in data or "pages" not in data["query"]:
        return None
    
    pages = data["query"]["pages"]
    for pid, page in pages.items():
        if pid != "-1":
            return page
    return None


def get_wikipedia_categories(page_title):
    """Get categories of a Wikipedia page to determine place type."""
    data = _wiki_request({
        "action": "query",
        "titles": page_title,
        "prop": "categories",
        "cllimit": 100,
    })
    if not data or "query" not in data or "pages" not in data["query"]:
        return []
    
    categories = []
    for pid, page in data["query"]["pages"].items():
        if pid != "-1" and "categories" in page:
            for cat in page["categories"]:
                categories.append(cat["title"])
    return categories


def get_wikidata_entity(page_title):
    """Get Wikidata entity ID for a Wikipedia page."""
    data = _wiki_request({
        "action": "query",
        "titles": page_title,
        "prop": "pageprops",
        "ppprop": "wikibase_item",
    })
    if data and "query" in data and "pages" in data["query"]:
        for pid, page in data["query"]["pages"].items():
            if pid != "-1" and "pageprops" in page and "wikibase_item" in page["pageprops"]:
                return page["pageprops"]["wikibase_item"]
    return None


def get_wikidata_properties(entity_id):
    """Get properties from Wikidata for detailed info."""
    if not entity_id:
        return {}
    
    params = {
        "action": "wbgetentities",
        "ids": entity_id,
        "props": "claims|descriptions|labels|sitelinks",
        "languages": "en",
        "format": "json",
    }
    data = _fetch_json(WIKIDATA_API, params=params)
    if not data or "entities" not in data or entity_id not in data["entities"]:
        return {}
    
    entity = data["entities"][entity_id]
    claims = entity.get("claims", {})
    result = {}
    
    # Property mappings
    prop_map = {
        "P18": "image",           # Image
        "P625": "coordinates",    # Coordinate location
        "P856": "website",        # Official website
        "P1329": "phone",         # Phone number
        "P968": "email",          # Email
        "P281": "postal_code",    # Postal code
        "P17": "country",         # Country
        "P131": "located_in",     # Located in the administrative territorial entity
        "P2044": "elevation",     # Elevation above sea level
        "P2048": "height",        # Height
        "P2049": "width",         # Width
        "P1082": "population",    # Population
        "P1451": "founded",       # Founded
        "P571": "inception",      # Inception
        "P793": "significant_event",  # Significant event
        "P1435": "heritage",      # Heritage designation
        "P31": "instance_of",     # Instance of
        "P373": "commons_category",  # Commons category
        "P214": "VIAF",           # VIAF ID
        "P244": "LOC",            # Library of Congress
    }
    
    for prop_id, prop_name in prop_map.items():
        if prop_id in claims:
            main_claim = claims[prop_id][0]
            if "mainsnak" in main_claim and "datavalue" in main_claim["mainsnak"]:
                value = main_claim["mainsnak"]["datavalue"]
                if "value" in value:
                    val = value["value"]
                    if isinstance(val, dict):
                        if "text" in val:
                            result[prop_name] = val["text"]
                        elif "latitude" in val and "longitude" in val:
                            result[prop_name] = f"{val['latitude']}, {val['longitude']}"
                        elif "id" in val:
                            result[prop_name] = val.get("id", "")
                        else:
                            result[prop_name] = str(val)
                    else:
                        result[prop_name] = str(val)
    
    # Get description
    if "descriptions" in entity and "en" in entity["descriptions"]:
        result["description"] = entity["descriptions"]["en"]["value"]
    
    return result


# ─── Step 3: Get Images from Unsplash ───

def get_unsplash_images(query, count=8):
    """Get high-quality images from Unsplash."""
    try:
        params = {
            "query": query + " travel destination",
            "per_page": count,
            "orientation": "landscape",
        }
        headers = {
            "Authorization": f"Client_ID {UNSPLASH_ACCESS_KEY}" if UNSPLASH_ACCESS_KEY else "",
            "User-Agent": "TouristGuide/1.0",
        }
        if not UNSPLASH_ACCESS_KEY:
            # Try without auth (limited)
            pass
        
        data = _fetch_json(UNSPLASH_API, headers=headers if UNSPLASH_ACCESS_KEY else None, params=params)
        if data and "results" in data:
            return [r["urls"]["regular"] for r in data["results"][:count]]
    except Exception:
        pass
    return []


# ─── Step 4: Get Location from Nominatim ───

def get_nominatim_data(place_name):
    """Get location data from OpenStreetMap Nominatim."""
    params = {
        "q": place_name,
        "format": "json",
        "limit": 1,
        "addressdetails": 1,
    }
    headers = {"User-Agent": "TouristGuide/1.0"}
    data = _fetch_json(NOMINATIM_API, headers=headers, params=params)
    if data and len(data) > 0:
        return data[0]
    return None


# ─── Step 5: Determine Category ───

def determine_category(page_title, categories, summary):
    """Determine the category of a destination based on Wikipedia categories and content."""
    title_lower = page_title.lower()
    text_lower = (summary or "").lower()
    all_cats = " ".join(c.lower() for c in categories)
    
    category_map = [
        ("Beach", ["beach", "coastal", "seaside", "shore", "coast"]),
        ("Hill Station", ["hill station", "hill", "mountain resort", "hilltown"]),
        ("Mountain", ["mountain", "peak", "summit", "volcano", "range"]),
        ("Temple", ["temple", "mandir", "shrine", "pagoda", "gopuram"]),
        ("Monument", ["monument", "memorial", "statue", "pillar"]),
        ("Museum", ["museum", "gallery", "exhibition"]),
        ("Fort", ["fort", "fortress", "castle", "citadel", "palace"]),
        ("Palace", ["palace", "royal residence", "maharaja"]),
        ("Waterfall", ["waterfall", "falls", "cascade"]),
        ("National Park", ["national park", "wildlife sanctuary", "biosphere"]),
        ("Garden", ["garden", "park", "botanical"]),
        ("Lake", ["lake", "lagoon"]),
        ("River", ["river", "ganges", "yamuna"]),
        ("Island", ["island", "archipelago"]),
        ("Church", ["church", "cathedral", "basilica", "chapel"]),
        ("Mosque", ["mosque", "masjid"]),
        ("City", ["city", "metropolis", "urban", "capital"]),
        ("Town", ["town", "township"]),
        ("Village", ["village", "hamlet"]),
        ("Water Body", ["ocean", "sea", "bay", "gulf"]),
        ("Cave", ["cave", "cavern", "grotto"]),
        ("Bridge", ["bridge", "viaduct"]),
        ("Lighthouse", ["lighthouse", "light house"]),
        ("Amusement Park", ["amusement park", "theme park", "water park"]),
        ("Zoo", ["zoo", "aquarium", "aviary"]),
        ("Heritage Site", ["unesco", "world heritage", "heritage site"]),
        ("Religious Site", ["pilgrimage", "religious", "holy", "sacred"]),
        ("Archaeological Site", ["archaeological", "excavation", "ruins", "ancient"]),
    ]
    
    for cat_name, keywords in category_map:
        for kw in keywords:
            if kw in title_lower or kw in all_cats or kw in text_lower:
                return cat_name
    
    return "Tourist Attraction"


# ─── Step 6: Extract Opening Hours from Wikipedia ───

def extract_opening_hours(summary):
    """Try to extract opening hours from text."""
    if not summary:
        return None
    
    patterns = [
        r"(?:open|opening)\s*(?:hours?|time[s]?)?\s*[:\-]\s*([^\.]+)",
        r"(?:hours?|timing[s]?)\s*[:\-]\s*([^\.]+)",
        r"(?:closed|close)\s*(?:on|day[s]?)?\s*[:\-]\s*([^\.]+)",
    ]
    
    result = {}
    for pattern in patterns:
        match = re.search(pattern, summary, re.IGNORECASE)
        if match:
            text = match.group(1).strip()
            if "open" in pattern or "hour" in pattern or "timing" in pattern:
                result["opening_hours"] = text
            elif "closed" in pattern:
                result["holidays"] = text
    
    return result if result else None


# ─── Step 7: Extract Entry Fee from Wikipedia ───

def extract_entry_fee(summary):
    """Try to extract entry fee information from text."""
    if not summary:
        return None
    
    patterns = [
        r"(?:entry|entrance|admission|ticket)\s*(?:fee|price|cost|charges?)?\s*[:\-]\s*([^\.]+)",
        r"(?:fee|fees|charges?)\s*[:\-]\s*([^\.]+)",
        r"(?:ticket|tickets)\s*(?:price|cost|rate)?\s*[:\-]\s*([^\.]+)",
    ]
    
    for pattern in patterns:
        match = re.search(pattern, summary, re.IGNORECASE)
        if match:
            return match.group(1).strip()
    return None


# ─── Main Function ───

def get_destination_info(user_input):
    """
    Get comprehensive information about any destination.
    Returns a structured dict or None if not found.
    """
    # Search for the destination
    page_title, page_id = search_destination(user_input)
    if not page_title:
        return None
    
    # Get Wikipedia data
    wiki_data = get_wikipedia_data(page_title)
    if not wiki_data:
        return None
    
    summary = wiki_data.get("extract", "")
    if not summary:
        return None
    
    # Get categories
    categories = get_wikipedia_categories(page_title)
    
    # Get Wikidata entity
    entity_id = get_wikidata_entity(page_title)
    wikidata = get_wikidata_properties(entity_id) if entity_id else {}
    
    # Get location from Nominatim
    nominatim = get_nominatim_data(page_title)
    
    # Get images from Wikipedia
    images = []
    if "thumbnail" in wiki_data:
        images.append(wiki_data["thumbnail"]["source"])
    
    # Try to get more images from page images
    if "pageimage" in wiki_data:
        # Get full size image
        img_data = _wiki_request({
            "action": "query",
            "titles": page_title,
            "prop": "imageinfo",
            "iiprop": "url",
            "iilimit": 5,
        })
        if img_data and "query" in img_data and "pages" in img_data["query"]:
            for pid, page in img_data["query"]["pages"].items():
                if pid != "-1" and "imageinfo" in page:
                    for info in page["imageinfo"]:
                        if "url" in info:
                            images.append(info["url"])
    
    # Get Unsplash images
    unsplash_images = get_unsplash_images(page_title)
    images.extend(unsplash_images)
    
    # Determine category
    category = determine_category(page_title, categories, summary)
    
    # Extract coordinates
    lat, lng = None, None
    if "coordinates" in wiki_data:
        lat = wiki_data["coordinates"][0].get("lat")
        lng = wiki_data["coordinates"][0].get("lon")
    elif "coordinates" in wikidata:
        try:
            parts = wikidata["coordinates"].split(",")
            lat, lng = float(parts[0]), float(parts[1])
        except (ValueError, IndexError):
            pass
    elif nominatim:
        lat = float(nominatim.get("lat", 0))
        lng = float(nominatim.get("lon", 0))
    
    # Build address
    address_parts = []
    if nominatim and "address" in nominatim:
        addr = nominatim["address"]
        for key in ["road", "house_number", "city", "town", "village", "county", "state", "postcode", "country"]:
            if key in addr:
                address_parts.append(addr[key])
    address = ", ".join(address_parts) if address_parts else None
    
    # Get postal code
    postal_code = wikidata.get("postal_code", None)
    if not postal_code and nominatim and "address" in nominatim:
        postal_code = nominatim["address"].get("postcode")
    
    # Get elevation
    elevation = wikidata.get("elevation", None)
    if elevation:
        try:
            elevation = f"{float(elevation):.0f} m"
        except ValueError:
            pass
    
    # Get website
    website = wikidata.get("website", None)
    
    # Get phone
    phone = wikidata.get("phone", None)
    
    # Get email
    email = wikidata.get("email", None)
    
    # Get country/state/district
    country = None
    state = None
    district = None
    if nominatim and "address" in nominatim:
        addr = nominatim["address"]
        country = addr.get("country")
        state = addr.get("state")
        district = addr.get("county") or addr.get("district")
    
    # Truncate summary for about section
    about_text = summary
    if len(about_text) > 2000:
        about_text = about_text[:2000] + "..."
    
    # Extract opening hours
    hours_info = extract_opening_hours(summary)
    
    # Extract entry fee
    entry_fee = extract_entry_fee(summary)
    
    # Build the response
    result = {
        "place_name": page_title,
        "official_name": page_title,
        "category": category,
        "state": state or "N/A",
        "district": district or "N/A",
        "country": country or "N/A",
        "latitude": lat,
        "longitude": lng,
        "elevation": elevation or "N/A",
        "address": address or "N/A",
        "pin_code": postal_code or "N/A",
        "about": about_text,
        "historical_background": "",
        "cultural_significance": "",
        "unesco_status": "Yes" if any("UNESCO" in c or "World Heritage" in c for c in categories) else "No",
        "architecture": "",
        "famous_for": category,
        "interesting_facts": "",
        "best_time": "October to March" if "India" in str(country) else "Varies by season",
        "peak_season": "Winter" if "India" in str(country) else "Summer",
        "off_season": "Monsoon" if "India" in str(country) else "Winter",
        "weather": "Pleasant" if "India" in str(country) else "Varies",
        "temperature": "15°C - 30°C" if "India" in str(country) else "Varies",
        "rainfall": "Moderate" if "India" in str(country) else "Varies",
        "ideal_duration": "2-3 days",
        "opening_time": hours_info.get("opening_hours", "9:00 AM") if hours_info else "9:00 AM",
        "closing_time": hours_info.get("closing_hours", "5:00 PM") if hours_info else "5:00 PM",
        "weekly_holidays": hours_info.get("holidays", "None") if hours_info else "None",
        "entry_timing": "9:00 AM - 5:00 PM",
        "entry_fee_indian_adult": "₹50 - ₹500 (estimated)",
        "entry_fee_indian_child": "₹25 - ₹200 (estimated)",
        "entry_fee_foreign": "$5 - $20 (estimated)",
        "camera_charges": "₹50 - ₹200 (estimated)",
        "parking_charges": "₹20 - ₹100 (estimated)",
        "guide_charges": "₹500 - ₹1500 (estimated)",
        "images": images[:10] if images else [],
        "maps_link": f"https://www.google.com/maps/search/?api=1&query={lat},{lng}" if lat and lng else None,
        "latitude_display": lat,
        "longitude_display": lng,
        "official_website": website or "N/A",
        "contact_phone": phone or "N/A",
        "contact_email": email or "N/A",
        "contact_website": website or "N/A",
        "travel_tip": f"Best time to visit {page_title} is during the pleasant season. Carry comfortable shoes and stay hydrated.",
        "wikipedia_url": f"{WIKIPEDIA_BASE}{urllib.parse.quote(page_title.replace(' ', '_'))}",
    }
    
    return result