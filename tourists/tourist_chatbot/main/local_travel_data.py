"""
Local Travel Data Service
Reads destination data from data/destinations.json using a dynamic, OS-agnostic
path. No API calls — instant, quota-free responses.
"""
import json
import logging
import re
from pathlib import Path

logger = logging.getLogger("main")

# ─── Data file location (always relative to this file's directory) ─────────────
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DESTINATIONS_PATH = DATA_DIR / "destinations.json"

_destinations_cache: dict | None = None


# ─── Loader ───────────────────────────────────────────────────────────────────

def _load_destinations() -> dict:
    """Load and cache destinations.json. Returns empty dict on any failure."""
    global _destinations_cache
    if _destinations_cache is not None:
        return _destinations_cache

    if not DESTINATIONS_PATH.exists():
        logger.warning("destinations.json not found at %s", DESTINATIONS_PATH)
        _destinations_cache = {}
        return _destinations_cache

    try:
        with open(DESTINATIONS_PATH, "r", encoding="utf-8") as fh:
            raw = json.load(fh)
            if not isinstance(raw, dict):
                logger.error("destinations.json must be a JSON object (dict), got %s", type(raw))
                _destinations_cache = {}
            else:
                # Normalise all keys to lowercase for case-insensitive lookup
                _destinations_cache = {k.lower(): v for k, v in raw.items()}
                logger.info("Loaded %d destinations from local data", len(_destinations_cache))
    except json.JSONDecodeError as exc:
        logger.error("destinations.json is not valid JSON: %s", exc)
        _destinations_cache = {}
    except OSError as exc:
        logger.error("Could not read destinations.json: %s", exc)
        _destinations_cache = {}

    return _destinations_cache


def reload_destinations() -> None:
    """Force reload of the destination cache (useful after editing the JSON)."""
    global _destinations_cache
    _destinations_cache = None
    _load_destinations()


# ─── Search ───────────────────────────────────────────────────────────────────

def _clean_query(query: str) -> str:
    """Strip common travel-query noise words."""
    q = query.lower().strip()
    stop_phrases = [
        "tell me about", "show me", "what is", "where is",
        "information about", "details about", "i want to know about",
        "about", "describe", "find", "info on", "places in",
    ]
    for phrase in stop_phrases:
        if q.startswith(phrase):
            q = q[len(phrase):].strip()
    for suffix in ["tourism", "travel", "tourist", "destination", "place"]:
        if q.endswith(suffix):
            q = q[: -len(suffix)].strip()
    return q or query.lower().strip()


def find_destination(query: str) -> tuple[str | None, dict | None]:
    """
    Look up query against the local destinations dict.
    Search strategy (in priority order):
      1. Exact match on cleaned query
      2. Destination key contained in query
      3. Query contained in destination key
      4. Fuzzy word-overlap (≥2 shared words, each ≥4 chars)
    Returns (name, data) or (None, None).
    """
    destinations = _load_destinations()
    if not destinations:
        return None, None

    cleaned = _clean_query(query)

    # 1. Exact match
    if cleaned in destinations:
        return cleaned, destinations[cleaned]

    # 2. Destination key is a substring of the query
    for name, data in destinations.items():
        if name in cleaned:
            return name, data

    # 3. Query is a substring of the destination key
    for name, data in destinations.items():
        if cleaned in name:
            return name, data

    # 4. Word-overlap fuzzy match
    query_words = {w for w in cleaned.split() if len(w) >= 4}
    best_name, best_data, best_score = None, None, 0
    for name, data in destinations.items():
        name_words = {w for w in name.split() if len(w) >= 4}
        overlap = len(query_words & name_words)
        if overlap > best_score:
            best_score = overlap
            best_name, best_data = name, data

    if best_score >= 1:
        return best_name, best_data

    return None, None


def get_all_destination_names() -> list[str]:
    """Return sorted list of all destination names (title-cased)."""
    return sorted(k.title() for k in _load_destinations().keys())


# ─── Response Builders ────────────────────────────────────────────────────────

def _build_destination_response(name: str, data: dict) -> str:
    """Format a destination entry from local JSON into a human-readable string."""
    lines = [f"📍 **{name.title()}**", ""]

    images = data.get("images", [])
    if images:
        lines.append("📸 **Images:**")
        for i, url in enumerate(images[:5], 1):
            lines.append(f"   {i}. {url}")
        lines.append("")

    lat = data.get("lat")
    lng = data.get("lng")
    if lat and lng:
        lines.append(f"🌐 **Location:** {lat}, {lng}")
        maps_link = data.get("maps_link") or f"https://www.google.com/maps/search/?api=1&query={lat},{lng}"
        lines.append(f"🗺️ **Google Maps:** {maps_link}")
        lines.append("")

    about = data.get("about") or data.get("description", "")
    if about:
        lines.append("📖 **About:**")
        lines.append(about[:800] + ("..." if len(about) > 800 else ""))
        lines.append("")

    lines.append("💡 *Ask me for hotels, food, transport, or a full trip plan!*")
    return "\n".join(lines)


def generate_local_response(user_input: str) -> str | None:
    """
    Generate a response from local JSON data.
    Returns a formatted string or None if no match found.
    """
    destinations = _load_destinations()
    if not destinations:
        return None

    lower = user_input.lower().strip()

    # ── List / browse all destinations ──
    list_keywords = ["list", "available", "all destinations", "all places", "show all", "what places"]
    if any(kw in lower for kw in list_keywords):
        # Only show the listing if no specific destination was also mentioned
        if not any(dest in lower for dest in destinations):
            names = get_all_destination_names()
            lines = ["🌍 **Available Destinations in Local Database:**", ""]
            for i, n in enumerate(names, 1):
                lines.append(f"{i}. {n}")
            lines += ["", f"✨ *Total: {len(names)} destinations*",
                      "💡 *Ask about any destination for detailed info!*"]
            return "\n".join(lines)

    # ── Greeting ──
    greetings = ["hi", "hello", "hey", "good morning", "good afternoon", "good evening"]
    if any(g == lower or lower.startswith(g + " ") for g in greetings):
        names = get_all_destination_names()
        sample = ", ".join(names[:5]) + ("..." if len(names) > 5 else "")
        return (
            "👋 **Hello! Welcome to Tourist Guide!**\n\n"
            f"I have local data on **{len(names)} destinations** including: {sample}\n\n"
            "💡 Try asking:\n"
            "• \"Tell me about Goa\"\n"
            "• \"Show me Paris\"\n"
            "• \"List all destinations\"\n\n"
            "✨ *Instant responses, no limits!*"
        )

    # ── Help ──
    if lower in ("help", "?") or "what can you" in lower:
        names = get_all_destination_names()
        return (
            "🤖 **Tourist Guide — Help**\n\n"
            "I can help you with:\n"
            "📍 Destination info — description, images, maps\n"
            "📋 List all available destinations\n"
            "🗺️ Google Maps links and coordinates\n\n"
            f"🌍 *Local database: {len(names)} destinations*\n\n"
            "Just type any destination name to get started!"
        )

    # ── Destination lookup ──
    dest_name, dest_data = find_destination(user_input)
    if dest_name and dest_data:
        return _build_destination_response(dest_name, dest_data)

    return None
