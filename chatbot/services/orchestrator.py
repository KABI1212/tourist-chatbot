from .intent_service import IntentService
from .route_service import RouteService
from .budget_service import BudgetService


class TravelPlannerOrchestrator:
    def __init__(self):
        self.intent_service = IntentService()
        self.route_service = RouteService()
        self.budget_service = BudgetService()

    def handle_query(self, query: str) -> dict:
        parsed = self.intent_service.detect(query)
        intent = parsed["intent"]
        entities = parsed["entities"]

        if intent == "trip_plan":
            return self._handle_trip_plan(entities)
        elif intent == "budget_query":
            return {
                "intent": intent,
                "message": "Please specify origin, destination and duration for a budget estimate, e.g. 'Chennai to Kodaikanal for 3 days, budget 20000'"
            }
        elif intent == "place_info":
            return {
                "intent": intent,
                "message": "I can help with that destination! Try asking for a trip plan like 'Chennai to Kodaikanal for 3 days' for a complete route + budget breakdown."
            }
        else:
            return {
                "intent": intent,
                "message": "Ask me about a specific trip, e.g. 'Chennai to Kodaikanal for 3 days, budget 20000'"
            }

    def _handle_trip_plan(self, entities):
        origin = entities["origin"]
        destination = entities["destination"]
        days = entities["days"] or 3
        user_budget = entities["budget"]

        route = self.route_service.get_route(origin, destination)
        breakdown = self.budget_service.calculate(route.distance_km, days)

        result = {
            "intent": "trip_plan",
            "route": route.to_dict(),
            "budget_breakdown": breakdown.to_dict(),
            "days": days,
        }

        if user_budget:
            result["budget_check"] = self.budget_service.fits_budget(breakdown, user_budget)

        return result