import re


class IntentService:
    """
    Classifies user query into an intent + extracts entities.
    Later: replace regex with a Gemini function-calling call.
    For now: rule-based, fast, no API cost, easy to demo.
    """

    INTENTS = ["trip_plan", "place_info", "budget_query", "unknown"]

    def detect(self, query: str) -> dict:
        q = query.lower()

        origin, destination = self._extract_route(q)
        budget = self._extract_budget(q)
        days = self._extract_days(q)

        if origin and destination:
            intent = "trip_plan"
        elif "budget" in q or "cost" in q or "how much" in q:
            intent = "budget_query"
        elif any(word in q for word in ["about", "tell me", "info", "places in"]):
            intent = "place_info"
        else:
            intent = "unknown"

        return {
            "intent": intent,
            "entities": {
                "origin": origin,
                "destination": destination,
                "budget": budget,
                "days": days,
            }
        }

    def _extract_route(self, q):
        # matches "from X to Y"
        match = re.search(
            r"from\s+([a-zA-Z\s]+?)\s+to\s+([a-zA-Z\s]+?)(?:\s+with|\s+for|\s+in|\.|,|$)",
            q,
        )
        if match:
            return match.group(1).strip().title(), match.group(2).strip().title()
        return None, None

    def _extract_budget(self, q):
        match = re.search(r"(?:₹|rs\.?|budget of)\s?(\d[\d,]*)", q)
        if match:
            return int(match.group(1).replace(",", ""))
        return None

    def _extract_days(self, q):
        match = re.search(r"(\d+)\s*day", q)
        if match:
            return int(match.group(1))
        return None