"""
Intent Detection Service
========================
Classifies a user query into one of the supported travel intents and extracts
all relevant entities (origin, destination, budget, days, people, etc.).

Architecture note
-----------------
The detector is deliberately rule-based so it works with zero API cost and
zero latency.  Each intent has:
  • A set of keyword triggers (fast O(n) scan)
  • Optional regex patterns for entity extraction
  • A priority rank so that more-specific intents win over generic ones

To add a new intent:
  1. Add its string label to INTENTS.
  2. Add keyword triggers to _INTENT_KEYWORDS.
  3. Add any entity-extraction logic to detect() or a helper method.
"""
import re
import logging
from dataclasses import dataclass, field

logger = logging.getLogger("main")


# ─── Supported Intents ────────────────────────────────────────────────────────

INTENTS = [
    "trip_plan",          # "from Chennai to Ooty for 3 days"
    "budget_query",       # "how much will it cost to go to Goa"
    "destination_info",   # "tell me about Paris"
    "nearby_attractions", # "places near Kodaikanal"
    "weather",            # "weather in Manali in December"
    "hotels",             # "hotels in Ooty under 2000"
    "restaurants",        # "restaurants in Pondicherry"
    "transportation",     # "how to reach Munnar from Bangalore"
    "best_time",          # "best time to visit Ladakh"
    "safety_tips",        # "is it safe to travel to Kashmir"
    "travel_checklist",   # "what to pack for a Himalayan trek"
    "visa_questions",     # "do I need a visa for Thailand"
    "emergency_contacts", # "emergency numbers in Japan"
    "unknown",            # fallback
]


# ─── Keyword Maps (intent → trigger phrases) ──────────────────────────────────
# Ordered from most-specific to least-specific so priority works correctly.

_INTENT_KEYWORDS: dict[str, list[str]] = {
    "trip_plan": [
        "trip plan", "travel plan", "itinerary", "plan my trip",
        "plan a trip", "road trip", "from.*to", "travel from",
        "going from", "drive from", "fly from", "journey from",
    ],
    "budget_query": [
        "how much", "budget", "cost", "price", "expense", "afford",
        "cheap", "expensive", "money needed", "total cost", "spending",
        "estimate cost", "cost of trip", "travel cost",
    ],
    "nearby_attractions": [
        "near", "nearby", "places near", "attractions near",
        "things to do near", "around", "close to", "within",
        "in the vicinity", "neighbouring", "neighboring",
    ],
    "weather": [
        "weather", "climate", "temperature", "rain", "snow",
        "monsoon", "season", "forecast", "hot", "cold", "humid",
        "when does it rain", "weather in", "climate of",
    ],
    "hotels": [
        "hotel", "stay", "accommodation", "resort", "hostel",
        "guest house", "airbnb", "where to stay", "lodge",
        "homestay", "inn", "bed and breakfast", "dormitory",
        "book a room", "cheap rooms",
    ],
    "restaurants": [
        "restaurant", "food", "eat", "dining", "cuisine",
        "where to eat", "best food", "local food", "street food",
        "cafe", "snacks", "dish", "must try", "famous food",
        "vegetarian", "vegan", "non-veg",
    ],
    "transportation": [
        "how to reach", "how to go", "how to get to",
        "transport", "transportation", "bus", "train", "flight",
        "cab", "taxi", "auto", "bike", "ferry", "ship",
        "route to", "directions to", "way to reach",
        "travel by", "nearest airport", "nearest station",
    ],
    "best_time": [
        "best time", "when to visit", "when should i go",
        "ideal time", "good time", "right season",
        "peak season", "off season", "avoid", "monsoon visit",
        "summer visit", "winter visit",
    ],
    "safety_tips": [
        "safe", "safety", "danger", "risk", "crime",
        "is it safe", "travel advisory", "solo female",
        "women travel", "solo travel", "scam", "precaution",
        "tips for", "warning",
    ],
    "travel_checklist": [
        "checklist", "what to pack", "packing", "what to bring",
        "things to carry", "essentials", "luggage", "documents needed",
        "what do i need", "preparation",
    ],
    "visa_questions": [
        "visa", "passport", "entry requirement", "permit",
        "do i need a visa", "visa on arrival", "e-visa",
        "tourist visa", "travel document", "customs",
        "immigration", "border",
    ],
    "emergency_contacts": [
        "emergency", "police", "ambulance", "hospital",
        "helpline", "sos", "contact number", "emergency number",
        "tourist helpline", "embassy", "consulate",
    ],
    "destination_info": [
        "tell me about", "about", "information", "details",
        "describe", "what is", "where is", "facts about",
        "history of", "famous for", "known for", "popular",
        "overview", "guide to",
    ],
}


# ─── Entity Extraction Patterns ───────────────────────────────────────────────

_RE_ROUTE = re.compile(
    r"from\s+([a-zA-Z\s]+?)\s+to\s+([a-zA-Z\s]+?)"
    r"(?:\s+with|\s+for|\s+in|\s+by|\.|,|$)",
    re.IGNORECASE,
)
_RE_BUDGET = re.compile(
    r"(?:₹|rs\.?|inr|budget\s+of|usd|\$|€|£)\s?(\d[\d,]*)",
    re.IGNORECASE,
)
_RE_DAYS = re.compile(r"(\d+)\s*(?:day|days|night|nights)", re.IGNORECASE)
_RE_PEOPLE = re.compile(r"(\d+)\s*(?:person|persons|people|adult|adults|pax)", re.IGNORECASE)
_RE_MONTH = re.compile(
    r"\b(january|february|march|april|may|june|july|august|"
    r"september|october|november|december|jan|feb|mar|apr|jun|"
    r"jul|aug|sep|oct|nov|dec)\b",
    re.IGNORECASE,
)
_RE_HOTEL_TIER = re.compile(
    r"\b(budget|cheap|affordable|mid[\-\s]?range|standard|"
    r"luxury|premium|five[\-\s]?star|5[\-\s]?star)\b",
    re.IGNORECASE,
)

# Words that should NOT be matched as destination names
_STOPWORDS = {
    "a", "an", "the", "i", "me", "my", "we", "us",
    "is", "are", "was", "were", "be", "been",
    "it", "its", "this", "that", "these", "those",
    "trip", "travel", "plan", "visit", "go", "going",
    "do", "did", "does", "will", "would", "can", "could",
    "how", "what", "when", "where", "which", "who",
    "best", "good", "great", "nice",
}


# ─── Dataclass ────────────────────────────────────────────────────────────────

@dataclass
class IntentResult:
    intent: str
    confidence: float                      # 0.0 – 1.0
    entities: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "intent": self.intent,
            "confidence": round(self.confidence, 2),
            "entities": self.entities,
        }


# ─── Service ──────────────────────────────────────────────────────────────────

class IntentService:
    """
    Rule-based intent classifier with entity extraction.
    Designed to be fast, transparent, and easily extensible.
    """

    def detect(self, query: str) -> IntentResult:
        """
        Classify *query* and extract entities.
        Returns an IntentResult with intent label, confidence, and entities dict.
        """
        if not query or not query.strip():
            return IntentResult(intent="unknown", confidence=0.0)

        q_lower = query.lower()

        # ── Entity extraction (always run, intent-independent) ──────────────
        entities = self._extract_all_entities(q_lower, query)

        # ── Intent scoring ──────────────────────────────────────────────────
        scores: dict[str, int] = {}
        for intent, keywords in _INTENT_KEYWORDS.items():
            for kw in keywords:
                # Support simple regex-style ".*" in keywords
                pattern = kw.replace(".*", r"[\w\s]+")
                if re.search(pattern, q_lower):
                    scores[intent] = scores.get(intent, 0) + 1

        # ── Override: if origin+destination are present → trip_plan ─────────
        if entities.get("origin") and entities.get("destination"):
            scores["trip_plan"] = scores.get("trip_plan", 0) + 5

        # ── Pick winning intent ─────────────────────────────────────────────
        if not scores:
            intent = "unknown"
            confidence = 0.0
        else:
            intent = max(scores, key=lambda k: scores[k])
            total = sum(scores.values())
            confidence = min(scores[intent] / max(total, 1), 1.0)

        result = IntentResult(intent=intent, confidence=confidence, entities=entities)
        logger.debug("Intent detected: %s (%.2f) | entities: %s", intent, confidence, entities)
        return result

    # ── Entity helpers ────────────────────────────────────────────────────────

    def _extract_all_entities(self, q_lower: str, original: str) -> dict:
        """Extract every entity type from the query."""
        entities: dict = {}

        origin, destination = self._extract_route(original)
        if origin:
            entities["origin"] = origin
        if destination:
            entities["destination"] = destination

        # If no route found, try to extract a single destination
        if not destination:
            dest = self._extract_single_destination(q_lower, original)
            if dest:
                entities["destination"] = dest

        budget = self._extract_budget(q_lower)
        if budget is not None:
            entities["budget"] = budget

        days = self._extract_days(q_lower)
        if days is not None:
            entities["days"] = days

        people = self._extract_people(q_lower)
        if people is not None:
            entities["people"] = people

        month = self._extract_month(q_lower)
        if month:
            entities["month"] = month

        hotel_tier = self._extract_hotel_tier(q_lower)
        if hotel_tier:
            entities["hotel_tier"] = hotel_tier

        return entities

    def _extract_route(self, text: str) -> tuple[str | None, str | None]:
        """Extract 'from X to Y' patterns."""
        match = _RE_ROUTE.search(text)
        if match:
            origin = match.group(1).strip().title()
            destination = match.group(2).strip().title()
            # Filter out stopwords-only matches
            if origin.lower() not in _STOPWORDS and destination.lower() not in _STOPWORDS:
                return origin, destination
        return None, None

    def _extract_single_destination(self, q_lower: str, original: str) -> str | None:
        """
        Extract a standalone destination when no 'from/to' pattern is present.
        Looks for capitalised noun phrases that are not stopwords.
        """
        # Look for capitalised proper-noun sequences (2+ chars each word)
        proper = re.findall(r"\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*)\b", original)
        for p in proper:
            if p.lower() not in _STOPWORDS:
                return p
        return None

    def _extract_budget(self, q: str) -> int | None:
        match = _RE_BUDGET.search(q)
        if match:
            try:
                return int(match.group(1).replace(",", ""))
            except ValueError:
                pass
        return None

    def _extract_days(self, q: str) -> int | None:
        match = _RE_DAYS.search(q)
        if match:
            try:
                return int(match.group(1))
            except ValueError:
                pass
        return None

    def _extract_people(self, q: str) -> int | None:
        match = _RE_PEOPLE.search(q)
        if match:
            try:
                return int(match.group(1))
            except ValueError:
                pass
        return None

    def _extract_month(self, q: str) -> str | None:
        match = _RE_MONTH.search(q)
        return match.group(1).title() if match else None

    def _extract_hotel_tier(self, q: str) -> str | None:
        match = _RE_HOTEL_TIER.search(q)
        if not match:
            return None
        raw = match.group(1).lower().replace("-", "").replace(" ", "")
        if raw in ("budget", "cheap", "affordable"):
            return "budget"
        if raw in ("midrange", "standard"):
            return "mid"
        if raw in ("luxury", "premium", "fivestar", "5star"):
            return "premium"
        return "mid"  # safe default
