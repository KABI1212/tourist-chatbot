"""
Destination Intelligence Service
Provides smart query classification, destination lookups, and data aggregation
for the Smart Tourism Platform.
"""

import re
import logging
import difflib
from functools import lru_cache
from datetime import datetime
from typing import Optional, List, Dict, Tuple, Any, Union
from bson.objectid import ObjectId

from . import mongodb_service as mdb

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════
# CONSTANTS & CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════

DEFAULT_COUNTRY = "India"
CONFIDENCE_THRESHOLD = 0.5  # Minimum score to consider an intent valid
MAX_INTENTS_TO_RETURN = 3

# ═══════════════════════════════════════════════════════════════════════
# QUERY CLASSIFICATION
# ═══════════════════════════════════════════════════════════════════════

# Expanded intent patterns with synonyms and common variations
INTENT_PATTERNS = {
    "season_info": [
        r"best (season|time|month|period) to visit",
        r"when to (go|visit|travel|plan)",
        r"which (season|month|weather)",
        r"weather in",
        r"climate|temperature|humidity|rainfall",
        r"summer|monsoon|winter|spring|autumn|fall",
        r"what('s| is) the weather",
        r"is it (hot|cold|rainy|humid) there",
    ],
    "budget_query": [
        r"how much (money|cost|budget|expense)",
        r"cost of (travel|trip|tour|vacation)",
        r"budget trip|cheapest|economical|affordable",
        r"how much (do i need|should i carry|will it cost)",
        r"daily budget|total cost|estimated cost|expenditure",
        r"budget|mid\.?range|luxury|low cost|high end",
        r"price range|spending",
    ],
    "hotel_query": [
        r"hotel|stay|accommodation|resort|homestay|lodge|inn|guest house",
        r"where to (stay|sleep|live|rent)",
        r"cheapest hotel|best hotel|luxury hotel|budget hotel",
        r"room|suite|villa|cottage",
        r"booking|reservation",
    ],
    "food_query": [
        r"food|restaurant|eat|dining|cuisine|dish|meal|breakfast|lunch|dinner",
        r"what to eat|local food|street food|must try",
        r"veg|non\.?veg|vegan|gluten free",
        r"famous (food|dish|cuisine|delicacy)",
        r"restaurant|eatery|cafe|dhaba",
    ],
    "transport_query": [
        r"transport|travel|reach|get (to|there|from)",
        r"flight|train|bus|taxi|auto|metro|cab|car rental",
        r"how to (reach|go|get|commute)",
        r"nearest (airport|station|railway|bus stop|metr?)",
        r"fare|ticket|price|cost",
        r"distance|route|direction",
    ],
    "attraction_query": [
        r"tourist (place|spot|attraction|destination|site)",
        r"what to (see|visit|explore|do)",
        r"places to visit|sightseeing|landmark|monument|museum|temple|fort|palace",
        r"entry fee|ticket|timings|hours",
        r"attractions|points of interest",
    ],
    "shopping_query": [
        r"shopping|market|bazaar|mall|souvenir|shop",
        r"what to (buy|shop|purchase|get)",
        r"local (market|shopping|handicraft|textile|spices|art|craft)",
        r"bargain|haggling",
    ],
    "festival_query": [
        r"festival|fair|culture|traditional|celebration|event|ceremony|ritual",
        r"cultural (event|program)|fairs",
    ],
    "family_friendly": [
        r"family friendly|family trip|with (kids|children|family)",
        r"safe for (kids|children|family)",
        r"activities for children|child friendly",
    ],
    "solo_travel": [
        r"solo (travel|trip|tour|woman|female|backpacker)",
        r"safe for (solo|women|girl|single|alone)",
        r"traveling alone",
    ],
    "adventure": [
        r"adventure|trekking|camping|trek|hiking|mountaineering",
        r"river rafting|paragliding|zipline|safari|boating|cycling|atv",
        r"extreme sports|water sports|wildlife safari",
    ],
    "honeymoon": [
        r"honeymoon|romantic|couple|anniversary|getaway",
        r"couple friendly|romantic places|love",
    ],
    "itinerary": [
        r"itinerary|plan|trip plan|travel plan|schedule",
        r"day (trip|plan|itinerary|tour)",
        r"(1|one|2|two|3|three|5|five|7|seven) day",
        r"how many days",
    ],
    "packing": [
        r"pack|what to (carry|bring|pack|take)",
        r"packing (list|guide|tips)",
        r"what (clothes|items|things) to",
        r"essentials|luggage",
    ],
    "emergency": [
        r"emergency|hospital|police|ambulance|helpline|doctor|pharmacy",
        r"help|medical|first aid|safety",
        r"emergency contact",
    ],
    "nearby": [
        r"nearby|near|around|close to|nearest",
        r"what else (near|around|close)",
        r"adjacent|vicinity",
    ],
    "hidden_gems": [
        r"hidden (gem|treasure|place|spot|paradise)",
        r"offbeat|secret|unknown|lesser known|undiscovered|untouched",
        r"off the beaten path",
    ],
}


# Comprehensive list of Indian destinations (for extraction)
INDIAN_DESTINATIONS = [
    "goa", "manali", "shimla", "darjeeling", "kerala", "munnar",
    "jaipur", "udaipur", "jodhpur", "delhi", "agra", "varanasi",
    "mumbai", "pune", "bangalore", "bengaluru", "chennai", "hyderabad",
    "kolkata", "amritsar", "srinagar", "ladakh", "leh", "gangtok",
    "rishikesh", "haridwar", "mathura", "vrindavan", "ayodhya",
    "coorg", "ooty", "kodaikanal", "andaman", "lakshadweep",
    "pondicherry", "hampi", "ellora", "ajanta", "khajuraho",
    "mysore", "coimbatore", "kochi", "trivandrum", "nagpur",
    "indore", "bhopal", "chandigarh", "dehradun", "mussoorie",
    "nainital", "mount abu", "lonavala", "mahabaleshwar",
    "panjim", "calangute", "baga", "anjuna", "alleppey",
    "varkala", "kovalam", "gokarna", "murudeshwar", "udupi",
    "mangalore", "surat", "vadodara", "rajkot", "jamnagar",
    "bikaner", "jaisalmer", "pushkar", "ranthambore", "sariska",
    "kanyakumari", "rameshwaram", "madurai", "thanjavur",
    "tirupati", "shirdi", "puri", "konark", "bhubaneswar",
    "shillong", "guwahati", "kaziranga", "tawang", "ziro",
    "kasauli", "kufri", "dharamshala", "mcleodganj", "spiti",
    "kinnaur", "sangla", "pahalgam", "gulmarg", "sonamarg",
    "patna", "bodh gaya", "rajgir", "nalanda",
]


def classify_query(user_input: str) -> List[Tuple[str, float]]:
    """
    Classify user query into intents with confidence scores.
    Returns list of (intent, confidence) tuples sorted by confidence,
    filtered by threshold.
    """
    user_input_lower = user_input.lower()
    scores = {}

    for intent, patterns in INTENT_PATTERNS.items():
        score = 0.0
        for pattern in patterns:
            if re.search(pattern, user_input_lower):
                score += 1.0
        if score > 0:
            # Normalize by number of patterns (max score per intent = len(patterns))
            normalized = score / len(patterns)
            if normalized >= CONFIDENCE_THRESHOLD:
                scores[intent] = normalized

    # Return sorted top intents
    sorted_intents = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return sorted_intents[:MAX_INTENTS_TO_RETURN]


def extract_destination_name(user_input: str) -> Optional[str]:
    """
    Extract potential destination name from user input using:
    1. Direct substring match against a known list (case-insensitive)
    2. Fuzzy matching for near matches (e.g., misspellings)
    3. Regex to capture capitalized phrases after prepositions
    Returns the most likely destination name or None.
    """
    user_input_lower = user_input.lower()

    # 1. Direct match
    for dest in INDIAN_DESTINATIONS:
        if dest in user_input_lower:
            return dest.title()

    # 2. Fuzzy match for multi-word destinations
    # Split input into words and try to find the longest substring that matches closely
    # We'll check substrings of consecutive words that could be a destination.
    words = user_input_lower.split()
    best_match = None
    best_ratio = 0.0
    for i in range(len(words)):
        for j in range(i+1, min(i+4, len(words)+1)):  # max 3-word phrases
            phrase = " ".join(words[i:j])
            for dest in INDIAN_DESTINATIONS:
                ratio = difflib.SequenceMatcher(None, phrase, dest).ratio()
                if ratio > best_ratio and ratio >= 0.8:
                    best_ratio = ratio
                    best_match = dest.title()
    if best_match:
        return best_match

    # 3. Regex for capitalized place names
    # Look for patterns like "I want to go to [Place]" or "about [Place]"
    patterns = [
        r"(?:to|in|at|for|visit|explore|about|regarding|on)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)",
        r"(?:destination|place)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)",
    ]
    for pattern in patterns:
        match = re.search(pattern, user_input)
        if match:
            place = match.group(1)
            # Avoid common words
            if place.lower() not in ["i", "my", "the", "a", "an", "this", "that", "you", "me"]:
                return place

    return None


# ═══════════════════════════════════════════════════════════════════════
# DESTINATION DATA AGGREGATION (with caching)
# ═══════════════════════════════════════════════════════════════════════

@lru_cache(maxsize=128)
def get_complete_destination_info(destination_name: str, season: str = "") -> Dict[str, Any]:
    """
    Get complete information about a destination by name.
    Aggregates data from all collections with error handling.
    Result is cached to reduce DB load.
    """
    try:
        destination = mdb.find_destination_by_name(destination_name)
        if not destination:
            logger.warning(f"Destination '{destination_name}' not found in DB")
            return {}
    except Exception as e:
        logger.error(f"Error fetching destination '{destination_name}': {e}")
        return {}

    dest_id = str(destination["_id"])
    result = {
        "destination": destination,
        "seasonal_info": {},
        "monthly_weather": [],
        "current_month_data": None,
        "hotels": {"budget": [], "mid_range": [], "luxury": []},
        "foods": [],
        "must_try_foods": [],
        "attractions": [],
        "transport": [],
        "shopping": [],
        "activities": [],
        "adventure_activities": [],
        "festivals": [],
        "emergency_contacts": {},
        "budget_plans": [],
        "packing_guides": {},
        "itineraries": {},
        "travel_tips": {},
        "nearby_places": [],
        "ratings": {},
    }

    # Helper to safely fetch and update
    def safe_fetch(fetch_func, key, default=None):
        try:
            data = fetch_func(dest_id)
            if data is not None:
                result[key] = data
        except Exception as e:
            logger.error(f"Error fetching {key} for {destination_name}: {e}")

    # Fetch all data with error handling
    safe_fetch(lambda did: mdb.get_all_seasons(did), "seasonal_info")
    safe_fetch(lambda did: mdb.get_all_monthly_weather(did), "monthly_weather")
    safe_fetch(lambda did: mdb.get_hotels_by_destination(did, "budget", 5), "hotels", {"budget": []})
    safe_fetch(lambda did: mdb.get_hotels_by_destination(did, "mid_range", 5), "hotels", {"mid_range": []})
    safe_fetch(lambda did: mdb.get_hotels_by_destination(did, "luxury", 5), "hotels", {"luxury": []})
    safe_fetch(lambda did: mdb.get_foods_by_destination(did), "foods")
    safe_fetch(lambda did: mdb.get_must_try_foods(did), "must_try_foods")
    safe_fetch(lambda did: mdb.get_top_attractions(did, 10), "attractions")
    safe_fetch(lambda did: mdb.get_transport_data(did), "transport")
    safe_fetch(lambda did: mdb.get_shopping_by_destination(did), "shopping")
    safe_fetch(lambda did: mdb.get_activities_by_destination(did), "activities")
    safe_fetch(lambda did: mdb.get_adventure_activities(did), "adventure_activities")
    safe_fetch(lambda did: mdb.get_festivals_by_destination(did), "festivals")
    safe_fetch(lambda did: mdb.get_emergency_contacts(did), "emergency_contacts", {})
    safe_fetch(lambda did: mdb.get_all_budget_plans(did), "budget_plans")
    safe_fetch(lambda did: mdb.get_travel_tips(did), "travel_tips", {})
    safe_fetch(lambda did: mdb.get_nearby_places(did), "nearby_places", {})
    safe_fetch(lambda did: mdb.get_destination_ratings(did), "ratings", {})

    # Packing guides - fetch per season
    packing = {}
    for s in ["summer", "winter", "monsoon"]:
        try:
            guide = mdb.get_packing_guide(dest_id, s)
            if guide:
                packing[s] = guide.get("data", {})
        except Exception as e:
            logger.error(f"Error fetching packing guide for {destination_name}, season {s}: {e}")
    result["packing_guides"] = packing

    # Itineraries
    itineraries = {}
    for days in [1, 2, 3, 5, 7]:
        try:
            itin = mdb.get_itinerary(dest_id, days)
            if itin:
                itineraries[str(days)] = itin.get("data", {})
        except Exception as e:
            logger.error(f"Error fetching itinerary for {destination_name}, {days} days: {e}")
    result["itineraries"] = itineraries

    # Current month weather
    current_month = datetime.now().month
    current_month_data = None
    for m in result["monthly_weather"]:
        if m.get("month") == current_month:
            current_month_data = m.get("data", {})
            break
    result["current_month_data"] = current_month_data

    return result


def format_destination_for_prompt(destination_info: Dict[str, Any]) -> str:
    """Format destination data into a compact string for AI prompt injection."""
    if not destination_info:
        return ""

    dest = destination_info.get("destination", {})
    parts = []

    # Basic info
    parts.append(f"Destination: {dest.get('place_name', 'Unknown')}")
    parts.append(f"State: {dest.get('state', 'N/A')}, Country: {dest.get('country', DEFAULT_COUNTRY)}")
    parts.append(f"Description: {dest.get('description', 'N/A')[:300]}")
    parts.append(f"Category: {dest.get('category', 'general')}")
    parts.append(f"Best Time: {dest.get('best_time_to_visit', 'N/A')}")

    # Current month weather
    current = destination_info.get("current_month_data", {})
    if current:
        parts.append(f"Current Weather: {current.get('weather', 'N/A')}, "
                     f"Temp: {current.get('average_temperature', 'N/A')}°C, "
                     f"Crowd: {current.get('crowd_level', 'N/A')}")

    # Hotels summary
    hotels = destination_info.get("hotels", {})
    budget_h = hotels.get("budget", [])
    if budget_h:
        parts.append(f"Budget Hotels from ₹{budget_h[0].get('price_per_night', 'N/A')}/night")
    mid_h = hotels.get("mid_range", [])
    if mid_h:
        parts.append(f"Mid-Range Hotels from ₹{mid_h[0].get('price_per_night', 'N/A')}/night")
    lux_h = hotels.get("luxury", [])
    if lux_h:
        parts.append(f"Luxury Hotels from ₹{lux_h[0].get('price_per_night', 'N/A')}/night")

    # Must try foods
    foods = destination_info.get("must_try_foods", [])
    if foods:
        food_names = [f.get("dish_name", "?") for f in foods[:5]]
        parts.append(f"Must Try Foods: {', '.join(food_names)}")

    # Transport summary
    transport = destination_info.get("transport", [])
    for t in transport:
        ttype = t.get("transport_type", "")
        tdata = t.get("data", {})
        if ttype == "flight":
            parts.append(f"Flights from ₹{tdata.get('average_flight_fare', 'N/A')}")
        elif ttype == "train":
            parts.append(f"Trains from ₹{tdata.get('sleeper_fare', 'N/A')} (Sleeper)")
        elif ttype == "bus":
            parts.append(f"Buses from ₹{tdata.get('average_fare', 'N/A')}")

    # Attractions
    attractions = destination_info.get("attractions", [])
    if attractions:
        top = [a.get("name", "?") for a in attractions[:5]]
        parts.append(f"Top Attractions: {', '.join(top)}")

    # Budget
    budgets = destination_info.get("budget_plans", [])
    for b in budgets:
        btype = b.get("budget_type", "")
        bdata = b.get("data", {})
        if btype == "budget":
            parts.append(f"Budget Traveler: ~₹{bdata.get('total', 'N/A')}/day")
        elif btype == "mid_range":
            parts.append(f"Mid-Range Traveler: ~₹{bdata.get('total', 'N/A')}/day")
        elif btype == "luxury":
            parts.append(f"Luxury Traveler: ~₹{bdata.get('total', 'N/A')}/day")

    # Safety and ratings
    ratings = destination_info.get("ratings")
    if ratings:
        parts.append(f"Safety Rating: {ratings.get('avg_safety', 'N/A')}/5")
        parts.append(f"Family Friendly: {ratings.get('avg_family', 'N/A')}/5")
        parts.append(f"Solo Traveler: {ratings.get('avg_solo', 'N/A')}/5")

    return "\n".join(parts)


# ═══════════════════════════════════════════════════════════════════════
# QUERY RESPONSE GENERATORS
# ═══════════════════════════════════════════════════════════════════════

def generate_budget_response(destination_info: Dict[str, Any], budget_type: str = "mid_range") -> str:
    """
    Generate a structured budget response from destination data.
    Budget type can be 'budget', 'mid_range', or 'luxury'.
    """
    budgets = destination_info.get("budget_plans", [])
    dest = destination_info.get("destination", {})

    if not budgets:
        return ""

    target = budget_type.lower().replace(" ", "_")
    budget_data = None
    for b in budgets:
        if b.get("budget_type", "").lower() == target:
            budget_data = b.get("data", {})
            break

    if not budget_data:
        return ""

    response = [
        f"💰 **Budget Plan for {dest.get('place_name', 'Destination')}**",
        f"💵 **Daily Budget: ₹{budget_data.get('daily_budget', 'N/A')}**",
        "",
        "**Cost Breakdown:**",
    ]

    for item in ["hotel", "food", "transport", "tickets", "shopping", "emergency"]:
        cost = budget_data.get(item, 0)
        if cost:
            response.append(f"   • {item.title()}: ₹{cost}")

    response.append("")
    response.append(f"**Total: ₹{budget_data.get('total', 'N/A')}**")

    return "\n".join(response)


def generate_itinerary_response(destination_info: Dict[str, Any], days: int = 3) -> str:
    """Generate a structured itinerary response for given number of days."""
    itineraries = destination_info.get("itineraries", {})
    dest = destination_info.get("destination", {})

    itinerary_data = itineraries.get(str(days))
    if not itinerary_data:
        return ""

    response = [
        f"🗺️ **{days}-Day Itinerary for {dest.get('place_name', 'Destination')}**",
        "",
    ]

    for day_num in range(1, days + 1):
        day_data = itinerary_data.get(f"day_{day_num}", {})
        if not day_data:
            continue

        response.append(f"**Day {day_num}:**")
        response.append(f"   🌅 Breakfast: {day_data.get('breakfast', 'N/A')}")
        response.append(f"   🏛️ Sightseeing: {day_data.get('sightseeing', 'N/A')}")
        response.append(f"   🍽️ Lunch: {day_data.get('lunch', 'N/A')}")
        response.append(f"   🎯 Activities: {day_data.get('activities', 'N/A')}")
        response.append(f"   🛍️ Shopping: {day_data.get('shopping', 'N/A')}")
        response.append(f"   🌙 Dinner: {day_data.get('dinner', 'N/A')}")
        response.append(f"   🏨 Stay: {day_data.get('night_stay', 'N/A')}")
        response.append(f"   💰 Est. Cost: ₹{day_data.get('estimated_cost', 'N/A')}")
        response.append("")

    total_cost = itinerary_data.get("total_estimated_cost", 0)
    if total_cost:
        response.append(f"**Total Estimated Trip Cost: ₹{total_cost}**")

    return "\n".join(response)


def generate_weather_response(destination_info: Dict[str, Any]) -> str:
    """Generate a structured weather response."""
    dest = destination_info.get("destination", {})
    monthly = destination_info.get("monthly_weather", [])
    current = destination_info.get("current_month_data", {})

    if not monthly and not current:
        return ""

    lines = [f"🌤️ **Weather in {dest.get('place_name', 'Destination')}**"]
    if current:
        lines.append(f"**Current Month ({datetime.now().strftime('%B')}):**")
        lines.append(f"   Weather: {current.get('weather', 'N/A')}")
        lines.append(f"   Avg Temp: {current.get('average_temperature', 'N/A')}°C")
        lines.append(f"   Crowd: {current.get('crowd_level', 'N/A')}")
        lines.append("")

    # Show a summary of all months (brief)
    if monthly:
        lines.append("**Monthly Overview:**")
        for m in monthly[:6]:  # first half
            month_num = m.get("month")
            month_name = datetime(2000, month_num, 1).strftime("%B")
            data = m.get("data", {})
            lines.append(f"   {month_name}: {data.get('weather', '')} {data.get('average_temperature', '')}°C")
        if len(monthly) > 6:
            lines.append("   ... (and more)")
    return "\n".join(lines)


def generate_attractions_response(destination_info: Dict[str, Any]) -> str:
    """Generate a response with top attractions."""
    attractions = destination_info.get("attractions", [])
    dest = destination_info.get("destination", {})
    if not attractions:
        return ""

    lines = [f"🏛️ **Top Attractions in {dest.get('place_name', 'Destination')}**"]
    for i, attr in enumerate(attractions[:10], 1):
        name = attr.get("name", "Unknown")
        desc = attr.get("description", "")
        if desc:
            lines.append(f"{i}. {name} — {desc[:100]}...")
        else:
            lines.append(f"{i}. {name}")
    return "\n".join(lines)


def generate_food_response(destination_info: Dict[str, Any]) -> str:
    """Generate a response with must-try foods."""
    foods = destination_info.get("must_try_foods", [])
    dest = destination_info.get("destination", {})
    if not foods:
        return ""

    lines = [f"🍽️ **Must-Try Foods in {dest.get('place_name', 'Destination')}**"]
    for food in foods[:10]:
        name = food.get("dish_name", "Unknown")
        desc = food.get("description", "")
        if desc:
            lines.append(f"• {name}: {desc[:100]}...")
        else:
            lines.append(f"• {name}")
    return "\n".join(lines)


def generate_safety_response(destination_info: Dict[str, Any]) -> str:
    """Generate a safety and emergency response."""
    dest = destination_info.get("destination", {})
    ratings = destination_info.get("ratings", {})
    emergency = destination_info.get("emergency_contacts", {})

    lines = [f"🛡️ **Safety Information for {dest.get('place_name', 'Destination')}**"]
    if ratings:
        lines.append(f"Safety Rating: {ratings.get('avg_safety', 'N/A')}/5")
        lines.append(f"Family Friendly: {ratings.get('avg_family', 'N/A')}/5")
        lines.append(f"Solo Traveler: {ratings.get('avg_solo', 'N/A')}/5")
    if emergency:
        lines.append("**Emergency Contacts:**")
        for key, value in emergency.items():
            lines.append(f"   {key.title()}: {value}")
    return "\n".join(lines)


def generate_general_response(destination_info: Dict[str, Any]) -> str:
    """Generate a general summary response."""
    dest = destination_info.get("destination", {})
    if not dest:
        return "I couldn't find information about that destination."

    lines = [
        f"📍 **{dest.get('place_name', 'Unknown')}**, {dest.get('state', '')}",
        f"📖 {dest.get('description', '')}",
        f"⭐ Best time to visit: {dest.get('best_time_to_visit', 'N/A')}",
    ]
    return "\n".join(lines)


# ═══════════════════════════════════════════════════════════════════════
# ORCHESTRATION: SELECT BEST RESPONSE BASED ON INTENT
# ═══════════════════════════════════════════════════════════════════════

def generate_response_for_query(user_input: str, destination_info: Dict[str, Any]) -> str:
    """
    Given a user query and destination info, determine the top intent and
    return a suitable response. Falls back to general response.
    """
    intents = classify_query(user_input)
    if not intents:
        return generate_general_response(destination_info)

    top_intent = intents[0][0]  # highest confidence
    # Map intent to response generator
    intent_to_generator = {
        "budget_query": lambda: generate_budget_response(destination_info),
        "itinerary": lambda: generate_itinerary_response(destination_info),
        "season_info": lambda: generate_weather_response(destination_info),
        "weather_info": lambda: generate_weather_response(destination_info),  # alias
        "attraction_query": lambda: generate_attractions_response(destination_info),
        "food_query": lambda: generate_food_response(destination_info),
        "emergency": lambda: generate_safety_response(destination_info),
        "safety": lambda: generate_safety_response(destination_info),
        "hotel_query": lambda: generate_hotel_response(destination_info),  # defined below
        "transport_query": lambda: generate_transport_response(destination_info),  # defined below
        "shopping_query": lambda: generate_shopping_response(destination_info),  # defined below
        "festival_query": lambda: generate_festival_response(destination_info),  # defined below
        "packing": lambda: generate_packing_response(destination_info),  # defined below
        "nearby": lambda: generate_nearby_response(destination_info),  # defined below
        "hidden_gems": lambda: generate_hidden_gems_response(destination_info),  # defined below
    }

    generator = intent_to_generator.get(top_intent)
    if generator:
        response = generator()
        if response:
            return response
    # Fallback to general
    return generate_general_response(destination_info)


# Additional response generators (may be extended)
def generate_hotel_response(destination_info: Dict[str, Any]) -> str:
    """Hotel recommendations."""
    hotels = destination_info.get("hotels", {})
    dest = destination_info.get("destination", {})
    lines = [f"🏨 **Hotel Options in {dest.get('place_name', 'Destination')}**"]
    for category, cat_name in [("budget", "Budget"), ("mid_range", "Mid‑Range"), ("luxury", "Luxury")]:
        hotel_list = hotels.get(category, [])
        if hotel_list:
            lines.append(f"**{cat_name}:**")
            for h in hotel_list[:3]:
                name = h.get("name", "Unknown")
                price = h.get("price_per_night", "N/A")
                lines.append(f"   • {name} — ₹{price}/night")
    return "\n".join(lines)


def generate_transport_response(destination_info: Dict[str, Any]) -> str:
    """Transport info."""
    transport = destination_info.get("transport", [])
    dest = destination_info.get("destination", {})
    lines = [f"🚗 **Transport Options to {dest.get('place_name', 'Destination')}**"]
    for t in transport:
        ttype = t.get("transport_type", "").title()
        data = t.get("data", {})
        if ttype == "Flight":
            lines.append(f"✈️ Flights: from ₹{data.get('average_flight_fare', 'N/A')}")
        elif ttype == "Train":
            lines.append(f"🚆 Trains: Sleeper ₹{data.get('sleeper_fare', 'N/A')}, AC ₹{data.get('ac_fare', 'N/A')}")
        elif ttype == "Bus":
            lines.append(f"🚌 Buses: from ₹{data.get('average_fare', 'N/A')}")
        elif ttype == "Local":
            lines.append(f"🚖 Local transport: {data.get('description', 'N/A')}")
    return "\n".join(lines)


def generate_shopping_response(destination_info: Dict[str, Any]) -> str:
    """Shopping info."""
    shopping = destination_info.get("shopping", [])
    dest = destination_info.get("destination", {})
    if not shopping:
        return ""
    lines = [f"🛍️ **Shopping in {dest.get('place_name', 'Destination')}**"]
    for item in shopping[:10]:
        name = item.get("name", "Unknown")
        desc = item.get("description", "")
        lines.append(f"• {name}: {desc[:100]}...")
    return "\n".join(lines)


def generate_festival_response(destination_info: Dict[str, Any]) -> str:
    """Festivals info."""
    festivals = destination_info.get("festivals", [])
    dest = destination_info.get("destination", {})
    if not festivals:
        return ""
    lines = [f"🎉 **Festivals in {dest.get('place_name', 'Destination')}**"]
    for f in festivals[:10]:
        name = f.get("name", "Unknown")
        month = f.get("month", "")
        desc = f.get("description", "")
        lines.append(f"• {name} ({month}): {desc[:100]}...")
    return "\n".join(lines)


def generate_packing_response(destination_info: Dict[str, Any]) -> str:
    """Packing guide."""
    packing = destination_info.get("packing_guides", {})
    dest = destination_info.get("destination", {})
    if not packing:
        return ""
    lines = [f"🧳 **Packing Guide for {dest.get('place_name', 'Destination')}**"]
    for season, data in packing.items():
        lines.append(f"**{season.title()}:**")
        for key, value in data.items():
            if isinstance(value, list):
                lines.append(f"   {key.title()}: {', '.join(value)}")
            else:
                lines.append(f"   {key.title()}: {value}")
    return "\n".join(lines)


def generate_nearby_response(destination_info: Dict[str, Any]) -> str:
    """Nearby places."""
    nearby = destination_info.get("nearby_places", [])
    dest = destination_info.get("destination", {})
    if not nearby:
        return ""
    lines = [f"📍 **Nearby Places to {dest.get('place_name', 'Destination')}**"]
    for place in nearby[:10]:
        name = place.get("name", "Unknown")
        distance = place.get("distance", "")
        desc = place.get("description", "")
        lines.append(f"• {name} ({distance}): {desc[:100]}...")
    return "\n".join(lines)


def generate_hidden_gems_response(destination_info: Dict[str, Any]) -> str:
    """Hidden gems (offbeat places)."""
    # Could use a separate field; if not present, fall back to attractions with 'offbeat' tag
    # For now, we'll try to get from activities or attractions.
    attractions = destination_info.get("attractions", [])
    offbeat = [a for a in attractions if "offbeat" in a.get("tags", []) or "hidden" in a.get("tags", [])]
    dest = destination_info.get("destination", {})
    if not offbeat:
        return f"I don't have specific hidden gems for {dest.get('place_name', 'this destination')} right now."
    lines = [f"💎 **Hidden Gems in {dest.get('place_name', 'Destination')}**"]
    for place in offbeat[:5]:
        name = place.get("name", "Unknown")
        desc = place.get("description", "")
        lines.append(f"• {name}: {desc[:100]}...")
    return "\n".join(lines)


# ═══════════════════════════════════════════════════════════════════════
# MAIN GUARD (for testing)
# ═══════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    # Simple test
    test_input = "What is the best time to visit Goa and how much budget do I need?"
    dest = extract_destination_name(test_input)
    print(f"Extracted destination: {dest}")
    intents = classify_query(test_input)
    print(f"Classified intents: {intents}")

    if dest:
        info = get_complete_destination_info(dest)
        response = generate_response_for_query(test_input, info)
        print("\nResponse:\n", response)