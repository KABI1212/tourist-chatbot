class RouteResult:
    def __init__(self, origin, destination, distance_km, duration_hr, route_desc):
        self.origin = origin
        self.destination = destination
        self.distance_km = distance_km
        self.duration_hr = duration_hr
        self.route_desc = route_desc

    def to_dict(self):
        return self.__dict__


class RouteService:
    """
    Interface stays stable even when you swap in Google Maps Distance Matrix API.
    For now: static lookup table for common Tamil Nadu routes (good enough for demo).
    """

    STATIC_ROUTES = {
        ("Chennai", "Kodaikanal"): (520, 9.5, "Chennai → Trichy → Dindigul → Kodaikanal (via NH32, NH38)"),
        ("Chennai", "Ooty"): (565, 10, "Chennai → Salem → Coimbatore → Ooty (via NH44)"),
        ("Chennai", "Munnar"): (600, 11, "Chennai → Madurai → Theni → Munnar"),
        ("Chennai", "Goa"): (900, 15, "Chennai → Bangalore → Hubli → Goa (via NH48)"),
        ("Chennai", "Bangalore"): (350, 6, "Chennai → Vellore → Bangalore (via NH48)"),
        ("Chennai", "Pondicherry"): (170, 3.5, "Chennai → Tindivanam → Pondicherry (via NH32)"),
        ("Chennai", "Madurai"): (460, 8, "Chennai → Trichy → Madurai (via NH38)"),
        ("Chennai", "Rameswaram"): (570, 10, "Chennai → Madurai → Rameswaram (via NH38)"),
        ("Chennai", "Kanyakumari"): (700, 12, "Chennai → Madurai → Kanyakumari (via NH44)"),
        ("Chennai", "Hyderabad"): (630, 10, "Chennai → Nellore → Hyderabad (via NH16)"),
        ("Bangalore", "Kodaikanal"): (460, 8, "Bangalore → Salem → Dindigul → Kodaikanal"),
        ("Bangalore", "Ooty"): (270, 5.5, "Bangalore → Mysore → Bandipur → Ooty"),
        ("Bangalore", "Munnar"): (480, 9, "Bangalore → Madurai → Theni → Munnar"),
        ("Bangalore", "Goa"): (560, 9, "Bangalore → Hubli → Goa (via NH48)"),
        ("Bangalore", "Pondicherry"): (330, 5.5, "Bangalore → Krishnagiri → Tindivanam → Pondicherry"),
        ("Mumbai", "Goa"): (590, 10, "Mumbai → Pune → Kolhapur → Goa (via NH48)"),
        ("Mumbai", "Pune"): (150, 3, "Mumbai → Pune Expressway"),
        ("Delhi", "Agra"): (230, 4, "Delhi → Agra via Yamuna Expressway"),
        ("Delhi", "Jaipur"): (280, 5, "Delhi → Jaipur via NH48"),
        ("Delhi", "Manali"): (550, 12, "Delhi → Chandigarh → Mandi → Manali"),
        ("Delhi", "Shimla"): (350, 7, "Delhi → Chandigarh → Shimla"),
        ("Kolkata", "Darjeeling"): (620, 12, "Kolkata → Siliguri → Darjeeling"),
        ("Kolkata", "Puri"): (500, 9, "Kolkata → Bhubaneswar → Puri"),
    }

    def get_route(self, origin: str, destination: str) -> RouteResult:
        key = (origin, destination)
        if key in self.STATIC_ROUTES:
            distance, duration, desc = self.STATIC_ROUTES[key]
        else:
            # fallback estimate, flag it as approximate
            distance, duration, desc = 400, 7, f"{origin} → {destination} (estimated, verify with Maps API)"

        return RouteResult(origin, destination, distance, duration, desc)