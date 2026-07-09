"""
Comprehensive Destination Information Service
==============================================
Fetches destination data from Wikipedia, Wikidata, and OpenStreetMap (Nominatim).
Responses are cached in Django's cache framework to avoid redundant API calls.

Cache TTL: 1 hour (configurable via DESTINATION_CACHE_TTL in settings).
"""
import json
import logging
import re
import ssl
import urllib.error
import urllib.parse
import urllib.request
from functools import wraps

from django.core.cache import cache

logger = logging.getLogger("main")

# ─── API endpoints ────────────────────────────────────────────────────────────
WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"
WIKIPEDIA_BASE = "https://en.wikipedia.org/wiki/"
NOMINATIM_API = "https://nominatim.openstreetmap.org/search"
WIKIDATA_API = "https://www.wikidata.org/w/api.php"

# Cache TTL in seconds (default 1 hour)
CACHE_TTL = 60 * 60

# Reuse an unverified SSL context for environments with cert issues
_ssl_ctx = ssl._create_unverified_context()


# ─── Low-level HTTP ──────────────────────────────────────────────────────────

def _fetch_json(url: str, params: dict | None = None, headers: dict | None = None) -> dict | None:
    """Fetch JSON from a URL; return None on any failure."""
    if params:
        url = url + "?" + urllib.parse.urlencode(params)
    req_headers = {"User-Agent": "TouristGuide/2.0 (travel-app; educational)"}
    if headers:
        req_headers.update(headers)
    try:
        req = urllib.request.Request(url, headers=req_headers)
        with urllib.request.urlopen(req, timeout=12, context=_ssl_ctx) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        logger.warning("HTTP %s fetching %s", exc.code, url)
    except urllib.error.URLError as exc:
        logger.warning("URL error fetching %s: %s", url, exc.reason)
    except Exception as exc:
        logger.warning("Unexpected error fetching %s: %s", url, exc)
    return None


def _wiki_request(params: dict) -> dict | None:
    """Convenience wrapper for Wikipedia API calls."""
    params.update({"format": "json", "origin": "*"})
    return _fetch_json(WIKIPEDIA_API, params=params)


# ─── Wikipedia ───────────────────────────────────────────────────────────────

def search_destination(query: str) -> tuple[str | None, int | None]:
    """
    Search Wikipedia for the best matching destination page.
    Returns (page_title, page_id) or (None, None).
    """
    # Strip common noise from queries
    clean = query.lower().strip()
    for prefix in [
        "tell me about", "show me", "what is", "where is",
        "information about", "details about", "i want to know about",
        "about", "describe", "explain", "find", "info on",
    ]:
        if clean.startswith(prefix):
            clean = clean[len(prefix):].strip()
    for suffix in ["tourism", "travel", "tourist", "destination", "place"]:
        if clean.endswith(suffix):
            clean = clean[: -len(suffix)].strip()
    if not clean:
        clean = query.strip()

    for search_q in [clean + " tourism", clean + " travel", clean]:
        data = _wiki_request({
            "action": "query",
            "list": "search",
            "srsearch": search_q,
            "srlimit": 10,
            "srprop": "snippet|pageid",
        })
        if not data:
            continue
        results = data.get("query", {}).get("search", [])
        if not results:
            continue

        best, best_score = None, -1
        for r in results:
            title_lower = r["title"].lower()
            score = 0
            if title_lower == clean:
                score = 100
            elif clean in title_lower:
                score = 50
            elif title_lower in clean:
                score = 40
            else:
                common = set(clean.split()) & set(title_lower.split())
                score = len(common) * 10

            geo_terms = [
                "city", "town", "village", "island", "mountain", "river", "lake",
                "park", "beach", "valley", "region", "temple", "monument", "museum",
                "fort", "palace", "waterfall", "hill", "station", "garden", "sanctuary",
            ]
            if any(t in title_lower for t in geo_terms):
                score += 5

            if score > best_score:
                best_score = score
                best = r

        if best and best_score > 0:
            return best["title"], best["pageid"]

    return None, None


def get_wikipedia_data(page_title: str) -> dict | None:
    """Fetch the full Wikipedia page extract, images, and coordinates."""
    data = _wiki_request({
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
    })
    if not data:
        return None
    for pid, page in data.get("query", {}).get("pages", {}).items():
        if pid != "-1":
            return page
    return None


def get_wikipedia_categories(page_title: str) -> list[str]:
    """Return a list of category title strings for a Wikipedia page."""
    data = _wiki_request({
        "action": "query",
        "titles": page_title,
        "prop": "categories",
        "cllimit": 100,
    })
    categories = []
    for pid, page in data.get("query", {}).get("pages", {}).items() if data else []:
        if pid != "-1":
            for cat in page.get("categories", []):
                categories.append(cat["title"])
    return categories


# ─── Wikidata ────────────────────────────────────────────────────────────────

def get_wikidata_entity_id(page_title: str) -> str | None:
    """Return the Wikidata Q-ID for a Wikipedia page title."""
    data = _wiki_request({
        "action": "query",
        "titles": page_title,
        "prop": "pageprops",
        "ppprop": "wikibase_item",
    })
    for pid, page in (data or {}).get("query", {}).get("pages", {}).items():
        if pid != "-1":
            return page.get("pageprops", {}).get("wikibase_item")
    return None


def get_wikidata_properties(entity_id: str) -> dict:
    """Fetch useful structured properties from Wikidata."""
    if not entity_id:
        return {}

    data = _fetch_json(WIKIDATA_API, params={
        "action": "wbgetentities",
        "ids": entity_id,
        "props": "claims|descriptions|labels",
        "languages": "en",
        "format": "json",
    })
    if not data or entity_id not in data.get("entities", {}):
        return {}

    entity = data["entities"][entity_id]
    claims = entity.get("claims", {})

    prop_map = {
        "P856": "website",
        "P1329": "phone",
        "P281": "postal_code",
        "P2044": "elevation",
        "P1082": "population",
        "P625": "coordinates",
        "P1435": "heritage_designation",
        "P18": "image",
    }

    result = {}
    for prop_id, prop_name in prop_map.items():
        if prop_id not in claims:
            continue
        snak = claims[prop_id][0].get("mainsnak", {})
        val = snak.get("datavalue", {}).get("value")
        if val is None:
            continue
        if isinstance(val, dict):
            if "latitude" in val:
                result[prop_name] = f"{val['latitude']}, {val['longitude']}"
            elif "text" in val:
                result[prop_name] = val["text"]
            else:
                result[prop_name] = str(val.get("id", val))
        else:
            result[prop_name] = str(val)

    if "descriptions" in entity and "en" in entity["descriptions"]:
        result["description"] = entity["descriptions"]["en"]["value"]

    return result


# ─── Nominatim (OpenStreetMap) ───────────────────────────────────────────────

def get_nominatim_data(place_name: str) -> dict | None:
    """Get geocoding data from OpenStreetMap Nominatim."""
    data = _fetch_json(
        NOMINATIM_API,
        params={"q": place_name, "format": "json", "limit": 1, "addressdetails": 1},
        headers={"User-Agent": "TouristGuide/2.0"},
    )
    return data[0] if data else None


# ─── Category Detection ──────────────────────────────────────────────────────

def determine_category(title: str, categories: list[str], summary: str) -> str:
    """Infer the destination category from page title, categories, and summary."""
    text = (title + " " + " ".join(categories) + " " + (summary or "")).lower()

    category_map = [
        ("Beach",             ["beach", "coastal", "seaside", "shore"]),
        ("Hill Station",      ["hill station", "hill resort", "hilltown"]),
        ("Mountain",          ["mountain", "peak", "summit", "volcano"]),
        ("Temple",            ["temple", "mandir", "shrine", "pagoda"]),
        ("Monument",          ["monument", "memorial", "statue", "pillar"]),
        ("Museum",            ["museum", "gallery", "exhibition"]),
        ("Fort / Palace",     ["fort", "fortress", "castle", "palace", "citadel"]),
        ("Waterfall",         ["waterfall", "falls", "cascade"]),
        ("National Park",     ["national park", "wildlife sanctuary", "biosphere"]),
        ("Garden / Park",     ["botanical garden", "zoological", "amusement park"]),
        ("Lake",              ["lake", "lagoon", "reservoir"]),
        ("Island",            ["island", "archipelago"]),
        ("Church / Cathedral",["church", "cathedral", "basilica"]),
        ("Mosque",            ["mosque", "masjid"]),
        ("Heritage Site",     ["unesco", "world heritage"]),
        ("City",              ["city", "metropolis", "capital city"]),
        ("Town",              ["town", "township"]),
        ("Village",           ["village", "hamlet"]),
        ("Cave",              ["cave", "cavern", "grotto"]),
    ]

    for cat_name, keywords in category_map:
        if any(kw in text for kw in keywords):
            return cat_name

    return "Tourist Attraction"


# ─── Main Public Function ────────────────────────────────────────────────────

def get_destination_info(user_input: str) -> dict | None:
    """
    Build a comprehensive destination info dict for *user_input*.

    Results are cached for CACHE_TTL seconds.
    Returns None if the destination cannot be identified.
    """
    cache_key = "dest_" + re.sub(r"\W+", "_", user_input.lower().strip())[:80]
    cached = cache.get(cache_key)
    if cached is not None:
        logger.debug("Cache hit for destination: %s", cache_key)
        return cached

    # 1. Find the best Wikipedia page
    page_title, page_id = search_destination(user_input)
    if not page_title:
        return None

    # 2. Fetch page data
    wiki_data = get_wikipedia_data(page_title)
    if not wiki_data:
        return None

    summary = wiki_data.get("extract", "")
    if not summary:
        return None

    # 3. Parallel enrichment
    categories = get_wikipedia_categories(page_title)
    entity_id = get_wikidata_entity_id(page_title)
    wikidata = get_wikidata_properties(entity_id) if entity_id else {}
    nominatim = get_nominatim_data(page_title)

    # 4. Images
    images: list[str] = []
    if "thumbnail" in wiki_data:
        images.append(wiki_data["thumbnail"]["source"])

    # 5. Coordinates
    lat = lng = None
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
        try:
            lat = float(nominatim.get("lat", 0))
            lng = float(nominatim.get("lon", 0))
        except ValueError:
            pass

    # 6. Address components from Nominatim
    country = state = district = postal_code = address_str = None
    if nominatim and "address" in nominatim:
        addr = nominatim["address"]
        country = addr.get("country")
        state = addr.get("state")
        district = addr.get("county") or addr.get("district")
        postal_code = wikidata.get("postal_code") or addr.get("postcode")
        parts = [
            addr.get(k)
            for k in ("road", "city", "town", "village", "county", "state", "postcode", "country")
            if addr.get(k)
        ]
        address_str = ", ".join(parts) if parts else None

    # 7. UNESCO status
    is_unesco = any("UNESCO" in c or "World Heritage" in c for c in categories)

    # 8. Opening hours / entry fee (best-effort extraction)
    hours_info = _extract_opening_hours(summary)
    entry_fee_text = _extract_entry_fee(summary)

    # 9. Elevation
    elevation = wikidata.get("elevation")
    if elevation:
        try:
            elevation = f"{float(elevation):.0f} m"
        except ValueError:
            pass

    # 10. Truncate summary
    about = summary[:2000] + ("..." if len(summary) > 2000 else "")

    # 11. Best-time defaults based on country
    is_india = "india" in (country or "").lower()
    best_time = "October to March" if is_india else "Varies by season"
    peak_season = "Winter (Oct–Feb)" if is_india else "Summer"
    off_season = "Monsoon (Jun–Sep)" if is_india else "Winter"
    temperature = "15°C – 30°C" if is_india else "Varies"

    result = {
        # Identity
        "place_name": page_title,
        "official_name": page_title,
        "category": determine_category(page_title, categories, summary),
        # Location
        "state": state or "N/A",
        "district": district or "N/A",
        "country": country or "N/A",
        "latitude": lat,
        "longitude": lng,
        "elevation": elevation or "N/A",
        "address": address_str or "N/A",
        "pin_code": postal_code or "N/A",
        # Content
        "about": about,
        "unesco_status": "Yes" if is_unesco else "No",
        "famous_for": determine_category(page_title, categories, summary),
        # Season
        "best_time": best_time,
        "peak_season": peak_season,
        "off_season": off_season,
        "weather": "Pleasant" if is_india else "Varies",
        "temperature": temperature,
        "rainfall": "Moderate" if is_india else "Varies",
        "ideal_duration": "2–3 days",
        # Timings (best-effort)
        "opening_time": (hours_info or {}).get("opening_hours", "9:00 AM"),
        "closing_time": (hours_info or {}).get("closing_hours", "5:00 PM"),
        "weekly_holidays": (hours_info or {}).get("holidays", "None"),
        "entry_timing": "9:00 AM – 5:00 PM",
        # Fees (estimated)
        "entry_fee_indian_adult": entry_fee_text or "₹50 – ₹500 (estimated)",
        "entry_fee_indian_child": "₹25 – ₹200 (estimated)",
        "entry_fee_foreign": "$5 – $20 (estimated)",
        "camera_charges": "₹50 – ₹200 (estimated)",
        "parking_charges": "₹20 – ₹100 (estimated)",
        "guide_charges": "₹500 – ₹1500 (estimated)",
        # Media
        "images": images[:10],
        # Map
        "maps_link": (
            f"https://www.google.com/maps/search/?api=1&query={lat},{lng}"
            if lat and lng else None
        ),
        "latitude_display": lat,
        "longitude_display": lng,
        # Contact
        "official_website": wikidata.get("website", "N/A"),
        "contact_phone": wikidata.get("phone", "N/A"),
        "contact_email": "N/A",
        "contact_website": wikidata.get("website", "N/A"),
        # Meta
        "travel_tip": (
            f"Best time to visit {page_title} is during the pleasant season. "
            "Carry comfortable shoes and stay hydrated."
        ),
        "wikipedia_url": (
            f"{WIKIPEDIA_BASE}{urllib.parse.quote(page_title.replace(' ', '_'))}"
        ),
    }

    # Store in cache
    cache.set(cache_key, result, CACHE_TTL)
    logger.info("Destination info built and cached for '%s'.", page_title)
    return result


# ─── Extraction helpers ───────────────────────────────────────────────────────

def _extract_opening_hours(text: str) -> dict | None:
    if not text:
        return None
    result = {}
    for pattern, key in [
        (r"(?:open|opening)\s*(?:hours?|times?)?\s*[:\-]\s*([^\.]{5,60})", "opening_hours"),
        (r"(?:closed|close)\s*(?:on|days?)?\s*[:\-]\s*([^\.]{3,40})", "holidays"),
    ]:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            result[key] = m.group(1).strip()
    return result or None


def _extract_entry_fee(text: str) -> str | None:
    if not text:
        return None
    for pattern in [
        r"(?:entry|entrance|admission|ticket)\s*(?:fee|price|cost|charge)?\s*[:\-]\s*([^\.]{5,60})",
        r"(?:fee|fees|charges?)\s*[:\-]\s*([^\.]{5,60})",
    ]:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            return m.group(1).strip()
    return None
