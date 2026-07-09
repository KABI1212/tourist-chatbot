"""
Travel Planner Orchestrator
============================
Routes a classified intent to the appropriate service and returns a
structured dict ready for JSON serialisation.

Flow:
  User query → IntentService → (RouteService + BudgetService) → result dict

The orchestrator does NOT call external APIs — that happens in views.py
after this service layer has done its structured extraction.
"""
import logging
from .intent_service import IntentService, IntentResult
from .route_service import RouteService
from .budget_service import BudgetService

logger = logging.getLogger("main")


class TravelPlannerOrchestrator:
    """
    Coordinates IntentService, RouteService, and BudgetService.
    Returns structured dicts; never raises — always returns a dict.
    """

    def __init__(self):
        self.intent_service = IntentService()
        self.route_service = RouteService()
        self.budget_service = BudgetService()

    def handle_query(self, query: str) -> dict:
        """
        Main entry point.  Returns a dict with at minimum:
          { "intent": str, "entities": dict, "message": str, ... }
        """
        try:
            result: IntentResult = self.intent_service.detect(query)
            intent = result.intent
            entities = result.entities

            dispatch = {
                "trip_plan":          self._handle_trip_plan,
                "budget_query":       self._handle_budget_query,
                "destination_info":   self._handle_destination_info,
                "nearby_attractions": self._handle_nearby_attractions,
                "weather":            self._handle_weather,
                "hotels":             self._handle_hotels,
                "restaurants":        self._handle_restaurants,
                "transportation":     self._handle_transportation,
                "best_time":          self._handle_best_time,
                "safety_tips":        self._handle_safety_tips,
                "travel_checklist":   self._handle_checklist,
                "visa_questions":     self._handle_visa,
                "emergency_contacts": self._handle_emergency,
                "unknown":            self._handle_unknown,
            }

            handler = dispatch.get(intent, self._handle_unknown)
            result_dict = handler(entities)
            result_dict["intent"] = intent
            result_dict["entities"] = entities
            result_dict["confidence"] = result.confidence
            return result_dict

        except Exception as exc:
            logger.exception("Orchestrator error for query %r: %s", query, exc)
            return {
                "intent": "unknown",
                "entities": {},
                "confidence": 0.0,
                "message": "An error occurred while processing your request.",
                "needs_gemini": True,
            }

    # ─── Intent Handlers ─────────────────────────────────────────────────────

    def _handle_trip_plan(self, entities: dict) -> dict:
        origin = entities.get("origin")
        destination = entities.get("destination")
        days = entities.get("days", 3)
        people = entities.get("people", 2)
        hotel_tier = entities.get("hotel_tier", "mid")
        user_budget = entities.get("budget")

        if not (origin and destination):
            return {
                "message": (
                    "I'd love to plan your trip! Please tell me the origin and "
                    "destination, e.g. *'from Chennai to Kodaikanal for 3 days'*."
                ),
                "needs_gemini": False,
            }

        route = self.route_service.get_route(origin, destination)
        breakdown = self.budget_service.calculate(
            distance_km=route.distance_km,
            days=days,
            people=people,
            hotel_tier=hotel_tier,
        )

        result = {
            "route": route.to_dict(),
            "budget_breakdown": breakdown.to_dict(),
            "days": days,
            "people": people,
            "hotel_tier": hotel_tier,
            "needs_gemini": True,  # Ask Gemini to enrich with attractions/tips
        }

        if user_budget:
            result["budget_check"] = self.budget_service.fits_budget(breakdown, user_budget)

        return result

    def _handle_budget_query(self, entities: dict) -> dict:
        destination = entities.get("destination")
        days = entities.get("days", 3)
        people = entities.get("people", 2)
        hotel_tier = entities.get("hotel_tier", "mid")

        if not destination:
            return {
                "message": (
                    "Please specify a destination for budget estimation, e.g. "
                    "*'cost of trip to Goa for 3 days'*."
                ),
                "needs_gemini": False,
            }

        # Use distance=400 as a neutral default when only destination is known
        breakdown = self.budget_service.calculate(
            distance_km=400,
            days=days,
            people=people,
            hotel_tier=hotel_tier,
        )
        return {
            "budget_breakdown": breakdown.to_dict(),
            "days": days,
            "people": people,
            "hotel_tier": hotel_tier,
            "note": "Distance-based costs are approximate. Specify origin for exact fuel/toll.",
            "needs_gemini": True,
        }

    def _handle_destination_info(self, entities: dict) -> dict:
        dest = entities.get("destination")
        if not dest:
            return {
                "message": "Which destination would you like to know about?",
                "needs_gemini": False,
            }
        return {"needs_gemini": True, "destination": dest}

    def _handle_nearby_attractions(self, entities: dict) -> dict:
        dest = entities.get("destination")
        if not dest:
            return {
                "message": "Which place would you like to find nearby attractions for?",
                "needs_gemini": False,
            }
        return {
            "needs_gemini": True,
            "destination": dest,
            "prompt_hint": f"List nearby tourist attractions and hidden gems around {dest}.",
        }

    def _handle_weather(self, entities: dict) -> dict:
        dest = entities.get("destination")
        month = entities.get("month", "")
        if not dest:
            return {
                "message": "Which destination's weather are you asking about?",
                "needs_gemini": False,
            }
        hint = f"Weather and climate in {dest}"
        if month:
            hint += f" during {month}"
        return {"needs_gemini": True, "destination": dest, "prompt_hint": hint}

    def _handle_hotels(self, entities: dict) -> dict:
        dest = entities.get("destination")
        tier = entities.get("hotel_tier", "")
        if not dest:
            return {
                "message": "Which city or destination are you looking for hotels in?",
                "needs_gemini": False,
            }
        hint = f"Hotels and accommodation options in {dest}"
        if tier:
            hint += f" ({tier} tier)"
        return {"needs_gemini": True, "destination": dest, "prompt_hint": hint}

    def _handle_restaurants(self, entities: dict) -> dict:
        dest = entities.get("destination")
        if not dest:
            return {
                "message": "Which place are you looking for restaurants in?",
                "needs_gemini": False,
            }
        return {
            "needs_gemini": True,
            "destination": dest,
            "prompt_hint": (
                f"Best restaurants, street food, and local cuisine in {dest}. "
                "Include must-try dishes, price range, and recommendations."
            ),
        }

    def _handle_transportation(self, entities: dict) -> dict:
        origin = entities.get("origin")
        dest = entities.get("destination")
        if not dest:
            return {
                "message": "Which destination are you asking about transportation for?",
                "needs_gemini": False,
            }
        hint = f"How to reach {dest}"
        if origin:
            hint += f" from {origin}"
        hint += ". Include flights, trains, buses, taxis, and road routes."
        return {"needs_gemini": True, "destination": dest, "prompt_hint": hint}

    def _handle_best_time(self, entities: dict) -> dict:
        dest = entities.get("destination")
        if not dest:
            return {
                "message": "Which destination are you asking about the best time to visit?",
                "needs_gemini": False,
            }
        return {
            "needs_gemini": True,
            "destination": dest,
            "prompt_hint": (
                f"Best time to visit {dest}: peak season, off season, weather, "
                "festivals, and travel tips for each season."
            ),
        }

    def _handle_safety_tips(self, entities: dict) -> dict:
        dest = entities.get("destination")
        if not dest:
            return {
                "message": "Which destination are you asking about safety for?",
                "needs_gemini": False,
            }
        return {
            "needs_gemini": True,
            "destination": dest,
            "prompt_hint": (
                f"Safety tips for travelling to {dest}. Include scam warnings, "
                "solo travel advice, women safety, health precautions."
            ),
        }

    def _handle_checklist(self, entities: dict) -> dict:
        dest = entities.get("destination")
        hint = "Travel packing checklist and essentials"
        if dest:
            hint += f" for a trip to {dest}"
        return {
            "needs_gemini": True,
            "destination": dest,
            "prompt_hint": hint + ". Include documents, clothing, gadgets, and medicines.",
        }

    def _handle_visa(self, entities: dict) -> dict:
        dest = entities.get("destination")
        if not dest:
            return {
                "message": "Which country or destination are you asking about visa requirements for?",
                "needs_gemini": False,
            }
        return {
            "needs_gemini": True,
            "destination": dest,
            "prompt_hint": (
                f"Visa requirements and entry rules for {dest}. Include tourist visa, "
                "visa on arrival, e-visa, and passport requirements."
            ),
        }

    def _handle_emergency(self, entities: dict) -> dict:
        dest = entities.get("destination")
        if not dest:
            return {
                "message": "Which country or city are you asking about emergency contacts for?",
                "needs_gemini": False,
            }
        return {
            "needs_gemini": True,
            "destination": dest,
            "prompt_hint": (
                f"Emergency contacts and helpline numbers for tourists in {dest}. "
                "Include police, ambulance, tourist helpline, and embassy contacts."
            ),
        }

    def _handle_unknown(self, entities: dict) -> dict:
        return {
            "message": (
                "I can help you with trip planning, budgets, destination info, hotels, "
                "restaurants, transportation, weather, safety tips, and more!\n\n"
                "Try asking:\n"
                "• *'Plan a trip from Mumbai to Goa for 3 days'*\n"
                "• *'Best time to visit Manali'*\n"
                "• *'Hotels in Ooty under ₹2000'*"
            ),
            "needs_gemini": False,
        }
