class BudgetBreakdown:
    def __init__(self, fuel, toll, hotel, food, misc, total):
        self.fuel = fuel
        self.toll = toll
        self.hotel = hotel
        self.food = food
        self.misc = misc
        self.total = total

    def to_dict(self):
        return self.__dict__


class BudgetService:
    """
    Pure calculation logic — no external API needed.
    Swappable constants now; later pull fuel price from an API.
    """

    FUEL_PRICE_PER_LITRE = 103  # ₹, update as needed
    CAR_MILEAGE_KMPL = 15
    TOLL_PER_100KM = 65          # rough NH toll average
    HOTEL_PER_NIGHT_BUDGET = {"budget": 1500, "mid": 3000, "premium": 6000}
    FOOD_PER_DAY_PER_PERSON = 600

    def calculate(self, distance_km, days, people=4, hotel_tier="mid", round_trip=True):
        trip_distance = distance_km * 2 if round_trip else distance_km

        fuel_cost = (trip_distance / self.CAR_MILEAGE_KMPL) * self.FUEL_PRICE_PER_LITRE
        toll_cost = (trip_distance / 100) * self.TOLL_PER_100KM
        hotel_cost = self.HOTEL_PER_NIGHT_BUDGET[hotel_tier] * days
        food_cost = self.FOOD_PER_DAY_PER_PERSON * people * days
        misc_cost = 0.1 * (fuel_cost + toll_cost + hotel_cost + food_cost)  # 10% buffer

        total = fuel_cost + toll_cost + hotel_cost + food_cost + misc_cost

        return BudgetBreakdown(
            fuel=round(fuel_cost),
            toll=round(toll_cost),
            hotel=round(hotel_cost),
            food=round(food_cost),
            misc=round(misc_cost),
            total=round(total),
        )

    def fits_budget(self, breakdown: BudgetBreakdown, user_budget: int) -> dict:
        diff = user_budget - breakdown.total
        return {
            "fits": diff >= 0,
            "difference": abs(diff),
            "message": (
                f"Within budget by ₹{diff}" if diff >= 0
                else f"Over budget by ₹{abs(diff)} — consider 'budget' hotel tier or public transport"
            )
        }