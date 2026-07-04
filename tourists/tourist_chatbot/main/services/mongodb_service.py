"""
MongoDB Atlas connection and operations service.
Handles all database interactions with MongoDB Atlas for the Smart Tourism Platform.
Uses connection pooling and graceful error handling.
"""

import os
import logging
from datetime import datetime, timezone
from typing import Optional, Any, List, Dict
from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.errors import ConnectionFailure, OperationFailure, ServerSelectionTimeoutError
from bson.objectid import ObjectId
from bson.errors import InvalidId

logger = logging.getLogger(__name__)

# Global connection state
_client: Optional[MongoClient] = None
_db = None


def get_client() -> MongoClient:
    """Get or create the MongoDB client with connection pooling."""
    global _client
    if _client is None:
        mongodb_uri = os.getenv("MONGODB_URI")
        if not mongodb_uri:
            raise ValueError("MONGODB_URI environment variable is not set")

        _client = MongoClient(
            mongodb_uri,
            maxPoolSize=50,
            minPoolSize=5,
            maxIdleTimeMS=30000,
            connectTimeoutMS=5000,
            serverSelectionTimeoutMS=5000,
            retryWrites=True,
            retryReads=True,
        )
        logger.info("MongoDB client initialized with connection pooling")
    return _client


def get_db():
    """Get the database instance."""
    global _db
    if _db is None:
        client = get_client()
        db_name = os.getenv("DATABASE_NAME", "tourist_chatbot")
        _db = client[db_name]
        logger.info(f"Connected to database: {db_name}")
    return _db


def get_collection(name: str) -> Collection:
    """Get a MongoDB collection by name."""
    db = get_db()
    return db[name]


def ping() -> bool:
    """Test the MongoDB connection. Returns True if connected."""
    try:
        client = get_client()
        client.admin.command("ping")
        return True
    except (ConnectionFailure, ServerSelectionTimeoutError) as e:
        logger.error(f"MongoDB ping failed: {e}")
        return False


def close_connection():
    """Close the MongoDB connection."""
    global _client, _db
    if _client:
        _client.close()
        _client = None
        _db = None
        logger.info("MongoDB connection closed")


def safe_object_id(id_str: str) -> Optional[ObjectId]:
    """Safely convert a string to ObjectId."""
    try:
        return ObjectId(id_str)
    except (InvalidId, TypeError):
        return None


def now_utc():
    """Get current UTC datetime."""
    return datetime.now(timezone.utc)


# ═══════════════════════════════════════════════════════════════════════
# USER OPERATIONS
# ═══════════════════════════════════════════════════════════════════════

def create_user(username: str, email: str, password_hash: str, full_name: str = "",
                phone: str = "", address: str = "") -> Optional[str]:
    """Create a new user document. Returns the user ID or None on failure."""
    try:
        collection = get_collection("users")
        user_doc = {
            "username": username,
            "email": email,
            "password_hash": password_hash,
            "full_name": full_name,
            "phone": phone,
            "address": address,
            "is_active": True,
            "is_guest": False,
            "preferences": {
                "budget_type": "mid_range",
                "travel_style": "leisure",
                "dietary_preference": "any",
                "language": "en",
            },
            "created_at": now_utc(),
            "updated_at": now_utc(),
            "last_login": None,
        }
        result = collection.insert_one(user_doc)
        logger.info(f"User created: {username} (ID: {result.inserted_id})")
        return str(result.inserted_id)
    except OperationFailure as e:
        logger.error(f"Failed to create user {username}: {e}")
        return None


def find_user_by_username(username: str) -> Optional[dict]:
    """Find a user by username."""
    try:
        collection = get_collection("users")
        return collection.find_one({"username": username, "is_active": True})
    except OperationFailure as e:
        logger.error(f"Failed to find user by username {username}: {e}")
        return None


def find_user_by_email(email: str) -> Optional[dict]:
    """Find a user by email."""
    try:
        collection = get_collection("users")
        return collection.find_one({"email": email, "is_active": True})
    except OperationFailure as e:
        logger.error(f"Failed to find user by email {email}: {e}")
        return None


def find_user_by_id(user_id: str) -> Optional[dict]:
    """Find a user by their ObjectId string."""
    oid = safe_object_id(user_id)
    if not oid:
        return None
    try:
        collection = get_collection("users")
        return collection.find_one({"_id": oid, "is_active": True})
    except OperationFailure as e:
        logger.error(f"Failed to find user by ID {user_id}: {e}")
        return None


def update_user(user_id: str, update_data: dict) -> bool:
    """Update a user document."""
    oid = safe_object_id(user_id)
    if not oid:
        return False
    try:
        collection = get_collection("users")
        update_data["updated_at"] = now_utc()
        result = collection.update_one({"_id": oid}, {"$set": update_data})
        return result.modified_count > 0
    except OperationFailure as e:
        logger.error(f"Failed to update user {user_id}: {e}")
        return False


def update_last_login(user_id: str) -> bool:
    """Update the last login timestamp for a user."""
    return update_user(user_id, {"last_login": now_utc()})


def username_exists(username: str) -> bool:
    """Check if a username already exists."""
    return find_user_by_username(username) is not None


def email_exists(email: str) -> bool:
    """Check if an email already exists."""
    return find_user_by_email(email) is not None


# ═══════════════════════════════════════════════════════════════════════
# DESTINATION OPERATIONS
# ═══════════════════════════════════════════════════════════════════════

def create_destination(data: dict) -> Optional[str]:
    """Create a new destination document."""
    try:
        collection = get_collection("destinations")
        data["created_at"] = now_utc()
        data["updated_at"] = now_utc()
        result = collection.insert_one(data)
        return str(result.inserted_id)
    except OperationFailure as e:
        logger.error(f"Failed to create destination: {e}")
        return None


def get_destination(destination_id: str) -> Optional[dict]:
    """Get a destination by ID."""
    oid = safe_object_id(destination_id)
    if not oid:
        return None
    try:
        collection = get_collection("destinations")
        return collection.find_one({"_id": oid})
    except OperationFailure as e:
        logger.error(f"Failed to get destination {destination_id}: {e}")
        return None


def find_destination_by_name(name: str) -> Optional[dict]:
    """Find a destination by name (case-insensitive)."""
    try:
        collection = get_collection("destinations")
        return collection.find_one({
            "place_name": {"$regex": f"^{name}$", "$options": "i"}
        })
    except OperationFailure as e:
        logger.error(f"Failed to find destination by name {name}: {e}")
        return None


def search_destinations(query: str, limit: int = 20) -> List[dict]:
    """Search destinations by name, state, country, or description."""
    try:
        collection = get_collection("destinations")
        cursor = collection.find({
            "$or": [
                {"place_name": {"$regex": query, "$options": "i"}},
                {"state": {"$regex": query, "$options": "i"}},
                {"country": {"$regex": query, "$options": "i"}},
                {"description": {"$regex": query, "$options": "i"}},
                {"district": {"$regex": query, "$options": "i"}},
            ]
        }).limit(limit)
        return list(cursor)
    except OperationFailure as e:
        logger.error(f"Failed to search destinations: {e}")
        return []


def get_all_destinations(limit: int = 50, skip: int = 0) -> List[dict]:
    """Get all destinations with pagination."""
    try:
        collection = get_collection("destinations")
        cursor = collection.find().sort("place_name", 1).skip(skip).limit(limit)
        return list(cursor)
    except OperationFailure as e:
        logger.error(f"Failed to get all destinations: {e}")
        return []


def get_destinations_by_state(state: str, limit: int = 50) -> List[dict]:
    """Get destinations by state."""
    try:
        collection = get_collection("destinations")
        cursor = collection.find({"state": {"$regex": state, "$options": "i"}}).limit(limit)
        return list(cursor)
    except OperationFailure as e:
        logger.error(f"Failed to get destinations by state {state}: {e}")
        return []


def get_destinations_by_category(category: str, limit: int = 50) -> List[dict]:
    """Get destinations by category (beach, hill_station, heritage, etc.)."""
    try:
        collection = get_collection("destinations")
        cursor = collection.find({"category": {"$regex": category, "$options": "i"}}).limit(limit)
        return list(cursor)
    except OperationFailure as e:
        logger.error(f"Failed to get destinations by category {category}: {e}")
        return []


def update_destination(destination_id: str, update_data: dict) -> bool:
    """Update a destination document."""
    oid = safe_object_id(destination_id)
    if not oid:
        return False
    try:
        collection = get_collection("destinations")
        update_data["updated_at"] = now_utc()
        result = collection.update_one({"_id": oid}, {"$set": update_data})
        return result.modified_count > 0
    except OperationFailure as e:
        logger.error(f"Failed to update destination {destination_id}: {e}")
        return False


def delete_destination(destination_id: str) -> bool:
    """Delete a destination."""
    oid = safe_object_id(destination_id)
    if not oid:
        return False
    try:
        collection = get_collection("destinations")
        result = collection.delete_one({"_id": oid})
        return result.deleted_count > 0
    except OperationFailure as e:
        logger.error(f"Failed to delete destination {destination_id}: {e}")
        return False


# ═══════════════════════════════════════════════════════════════════════
# SEASONAL DATA OPERATIONS
# ═══════════════════════════════════════════════════════════════════════

def save_seasonal_data(destination_id: str, season: str, data: dict) -> Optional[str]:
    """Save seasonal data for a destination."""
    try:
        collection = get_collection("seasonal_data")
        doc = {
            "destination_id": destination_id,
            "season": season,
            "data": data,
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }
        # Upsert: update if exists, insert if not
        result = collection.update_one(
            {"destination_id": destination_id, "season": season},
            {"$set": doc},
            upsert=True,
        )
        return str(result.upserted_id) if result.upserted_id else destination_id
    except OperationFailure as e:
        logger.error(f"Failed to save seasonal data: {e}")
        return None


def get_seasonal_data(destination_id: str, season: str) -> Optional[dict]:
    """Get seasonal data for a destination."""
    try:
        collection = get_collection("seasonal_data")
        return collection.find_one({"destination_id": destination_id, "season": season})
    except OperationFailure as e:
        logger.error(f"Failed to get seasonal data: {e}")
        return None


def get_all_seasons(destination_id: str) -> List[dict]:
    """Get all seasonal data for a destination."""
    try:
        collection = get_collection("seasonal_data")
        cursor = collection.find({"destination_id": destination_id})
        return list(cursor)
    except OperationFailure as e:
        logger.error(f"Failed to get all seasons: {e}")
        return []


# ═══════════════════════════════════════════════════════════════════════
# MONTHLY WEATHER OPERATIONS
# ═══════════════════════════════════════════════════════════════════════

def save_monthly_weather(destination_id: str, month: int, data: dict) -> Optional[str]:
    """Save monthly weather data for a destination. Month: 1-12."""
    try:
        collection = get_collection("monthly_weather")
        doc = {
            "destination_id": destination_id,
            "month": month,
            "data": data,
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }
        result = collection.update_one(
            {"destination_id": destination_id, "month": month},
            {"$set": doc},
            upsert=True,
        )
        return str(result.upserted_id) if result.upserted_id else destination_id
    except OperationFailure as e:
        logger.error(f"Failed to save monthly weather: {e}")
        return None


def get_monthly_weather(destination_id: str, month: int) -> Optional[dict]:
    """Get monthly weather data for a destination."""
    try:
        collection = get_collection("monthly_weather")
        return collection.find_one({"destination_id": destination_id, "month": month})
    except OperationFailure as e:
        logger.error(f"Failed to get monthly weather: {e}")
        return None


def get_all_monthly_weather(destination_id: str) -> List[dict]:
    """Get all monthly weather data for a destination."""
    try:
        collection = get_collection("monthly_weather")
        cursor = collection.find({"destination_id": destination_id}).sort("month", 1)
        return list(cursor)
    except OperationFailure as e:
        logger.error(f"Failed to get all monthly weather: {e}")
        return []


# ═══════════════════════════════════════════════════════════════════════
# HOTEL OPERATIONS
# ═══════════════════════════════════════════════════════════════════════

def create_hotel(data: dict) -> Optional[str]:
    """Create a new hotel entry."""
    try:
        collection = get_collection("hotels")
        data["created_at"] = now_utc()
        data["updated_at"] = now_utc()
        result = collection.insert_one(data)
        return str(result.inserted_id)
    except OperationFailure as e:
        logger.error(f"Failed to create hotel: {e}")
        return None


def get_hotels_by_destination(destination_id: str, category: str = "", limit: int = 20) -> List[dict]:
    """Get hotels for a destination, optionally filtered by category."""
    try:
        collection = get_collection("hotels")
        query = {"destination_id": destination_id}
        if category:
            query["category"] = category
        cursor = collection.find(query).limit(limit)
        return list(cursor)
    except OperationFailure as e:
        logger.error(f"Failed to get hotels: {e}")
        return []


def get_hotel(hotel_id: str) -> Optional[dict]:
    """Get a hotel by ID."""
    oid = safe_object_id(hotel_id)
    if not oid:
        return None
    try:
        collection = get_collection("hotels")
        return collection.find_one({"_id": oid})
    except OperationFailure as e:
        logger.error(f"Failed to get hotel {hotel_id}: {e}")
        return None


def search_hotels(query: str, limit: int = 20) -> List[dict]:
    """Search hotels by name or location."""
    try:
        collection = get_collection("hotels")
        cursor = collection.find({
            "$or": [
                {"name": {"$regex": query, "$options": "i"}},
                {"address": {"$regex": query, "$options": "i"}},
            ]
        }).limit(limit)
        return list(cursor)
    except OperationFailure as e:
        logger.error(f"Failed to search hotels: {e}")
        return []


def get_cheapest_hotels(destination_id: str, limit: int = 5) -> List[dict]:
    """Get cheapest hotels for a destination."""
    try:
        collection = get_collection("hotels")
        cursor = collection.find({"destination_id": destination_id}).sort("price_per_night", 1).limit(limit)
        return list(cursor)
    except OperationFailure as e:
        logger.error(f"Failed to get cheapest hotels: {e}")
        return []


# ═══════════════════════════════════════════════════════════════════════
# RESTAURANT & FOOD OPERATIONS
# ═══════════════════════════════════════════════════════════════════════

def create_restaurant(data: dict) -> Optional[str]:
    """Create a new restaurant entry."""
    try:
        collection = get_collection("restaurants")
        data["created_at"] = now_utc()
        data["updated_at"] = now_utc()
        result = collection.insert_one(data)
        return str(result.inserted_id)
    except OperationFailure as e:
        logger.error(f"Failed to create restaurant: {e}")
        return None


def get_restaurants_by_destination(destination_id: str, limit: int = 20) -> List[dict]:
    """Get restaurants for a destination."""
    try:
        collection = get_collection("restaurants")
        cursor = collection.find({"destination_id": destination_id}).limit(limit)
        return list(cursor)
    except OperationFailure as e:
        logger.error(f"Failed to get restaurants: {e}")
        return []


def create_food_item(data: dict) -> Optional[str]:
    """Create a new food item entry."""
    try:
        collection = get_collection("foods")
        data["created_at"] = now_utc()
        result = collection.insert_one(data)
        return str(result.inserted_id)
    except OperationFailure as e:
        logger.error(f"Failed to create food item: {e}")
        return None


def get_foods_by_destination(destination_id: str, meal_type: str = "", limit: int = 30) -> List[dict]:
    """Get food items for a destination, optionally filtered by meal type."""
    try:
        collection = get_collection("foods")
        query = {"destination_id": destination_id}
        if meal_type:
            query["meal_type"] = meal_type
        cursor = collection.find(query).limit(limit)
        return list(cursor)
    except OperationFailure as e:
        logger.error(f"Failed to get foods: {e}")
        return []


def get_must_try_foods(destination_id: str, limit: int = 10) -> List[dict]:
    """Get must-try food items for a destination."""
    try:
        collection = get_collection("foods")
        cursor = collection.find({"destination_id": destination_id, "must_try": True}).limit(limit)
        return list(cursor)
    except OperationFailure as e:
        logger.error(f"Failed to get must-try foods: {e}")
        return []


# ═══════════════════════════════════════════════════════════════════════
# TOURIST PLACE OPERATIONS
# ═══════════════════════════════════════════════════════════════════════

def create_tourist_place(data: dict) -> Optional[str]:
    """Create a new tourist place entry."""
    try:
        collection = get_collection("tourist_places")
        data["created_at"] = now_utc()
        data["updated_at"] = now_utc()
        result = collection.insert_one(data)
        return str(result.inserted_id)
    except OperationFailure as e:
        logger.error(f"Failed to create tourist place: {e}")
        return None


def get_tourist_places_by_destination(destination_id: str, limit: int = 30) -> List[dict]:
    """Get tourist places for a destination."""
    try:
        collection = get_collection("tourist_places")
        cursor = collection.find({"destination_id": destination_id}).limit(limit)
        return list(cursor)
    except OperationFailure as e:
        logger.error(f"Failed to get tourist places: {e}")
        return []


def get_top_attractions(destination_id: str, limit: int = 10) -> List[dict]:
    """Get top-rated tourist places for a destination."""
    try:
        collection = get_collection("tourist_places")
        cursor = collection.find({"destination_id": destination_id}).sort("rating", -1).limit(limit)
        return list(cursor)
    except OperationFailure as e:
        logger.error(f"Failed to get top attractions: {e}")
        return []


# ═══════════════════════════════════════════════════════════════════════
# TRANSPORT OPERATIONS
# ═══════════════════════════════════════════════════════════════════════

def save_transport_data(destination_id: str, transport_type: str, data: dict) -> Optional[str]:
    """Save transport data for a destination."""
    try:
        collection = get_collection("transport")
        doc = {
            "destination_id": destination_id,
            "transport_type": transport_type,
            "data": data,
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }
        result = collection.update_one(
            {"destination_id": destination_id, "transport_type": transport_type},
            {"$set": doc},
            upsert=True,
        )
        return str(result.upserted_id) if result.upserted_id else destination_id
    except OperationFailure as e:
        logger.error(f"Failed to save transport data: {e}")
        return None


def get_transport_data(destination_id: str, transport_type: str = "") -> List[dict]:
    """Get transport data for a destination."""
    try:
        collection = get_collection("transport")
        query = {"destination_id": destination_id}
        if transport_type:
            query["transport_type"] = transport_type
        cursor = collection.find(query)
        return list(cursor)
    except OperationFailure as e:
        logger.error(f"Failed to get transport data: {e}")
        return []


def get_cheapest_transport(destination_id: str) -> List[dict]:
    """Get cheapest transport options for a destination."""
    try:
        collection = get_collection("transport")
        cursor = collection.find({"destination_id": destination_id}).sort("data.average_fare", 1)
        return list(cursor)
    except OperationFailure as e:
        logger.error(f"Failed to get cheapest transport: {e}")
        return []


# ═══════════════════════════════════════════════════════════════════════
# SHOPPING OPERATIONS
# ═══════════════════════════════════════════════════════════════════════

def create_shopping_entry(data: dict) -> Optional[str]:
    """Create a new shopping entry."""
    try:
        collection = get_collection("shopping")
        data["created_at"] = now_utc()
        result = collection.insert_one(data)
        return str(result.inserted_id)
    except OperationFailure as e:
        logger.error(f"Failed to create shopping entry: {e}")
        return None


def get_shopping_by_destination(destination_id: str, limit: int = 20) -> List[dict]:
    """Get shopping entries for a destination."""
    try:
        collection = get_collection("shopping")
        cursor = collection.find({"destination_id": destination_id}).limit(limit)
        return list(cursor)
    except OperationFailure as e:
        logger.error(f"Failed to get shopping entries: {e}")
        return []


# ═══════════════════════════════════════════════════════════════════════
# ACTIVITIES OPERATIONS
# ═══════════════════════════════════════════════════════════════════════

def create_activity(data: dict) -> Optional[str]:
    """Create a new activity entry."""
    try:
        collection = get_collection("activities")
        data["created_at"] = now_utc()
        result = collection.insert_one(data)
        return str(result.inserted_id)
    except OperationFailure as e:
        logger.error(f"Failed to create activity: {e}")
        return None


def get_activities_by_destination(destination_id: str, activity_type: str = "", limit: int = 20) -> List[dict]:
    """Get activities for a destination, optionally filtered by type."""
    try:
        collection = get_collection("activities")
        query = {"destination_id": destination_id}
        if activity_type:
            query["activity_type"] = activity_type
        cursor = collection.find(query).limit(limit)
        return list(cursor)
    except OperationFailure as e:
        logger.error(f"Failed to get activities: {e}")
        return []


def get_adventure_activities(destination_id: str, limit: int = 20) -> List[dict]:
    """Get adventure activities for a destination."""
    try:
        collection = get_collection("activities")
        cursor = collection.find({
            "destination_id": destination_id,
            "activity_type": {
                "$in": ["trekking", "camping", "safari", "boating", "rafting",
                        "paragliding", "zipline", "cycling", "atv", "horse_riding"]
            }
        }).limit(limit)
        return list(cursor)
    except OperationFailure as e:
        logger.error(f"Failed to get adventure activities: {e}")
        return []


# ═══════════════════════════════════════════════════════════════════════
# FESTIVAL OPERATIONS
# ═══════════════════════════════════════════════════════════════════════

def create_festival(data: dict) -> Optional[str]:
    """Create a new festival entry."""
    try:
        collection = get_collection("festivals")
        data["created_at"] = now_utc()
        result = collection.insert_one(data)
        return str(result.inserted_id)
    except OperationFailure as e:
        logger.error(f"Failed to create festival: {e}")
        return None


def get_festivals_by_destination(destination_id: str, month: int = 0, limit: int = 20) -> List[dict]:
    """Get festivals for a destination, optionally filtered by month."""
    try:
        collection = get_collection("festivals")
        query = {"destination_id": destination_id}
        if month:
            query["month"] = month
        cursor = collection.find(query).limit(limit)
        return list(cursor)
    except OperationFailure as e:
        logger.error(f"Failed to get festivals: {e}")
        return []


# ═══════════════════════════════════════════════════════════════════════
# EMERGENCY CONTACT OPERATIONS
# ═══════════════════════════════════════════════════════════════════════

def save_emergency_contacts(destination_id: str, data: dict) -> Optional[str]:
    """Save emergency contacts for a destination."""
    try:
        collection = get_collection("emergency_contacts")
        doc = {
            "destination_id": destination_id,
            "data": data,
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }
        result = collection.update_one(
            {"destination_id": destination_id},
            {"$set": doc},
            upsert=True,
        )
        return str(result.upserted_id) if result.upserted_id else destination_id
    except OperationFailure as e:
        logger.error(f"Failed to save emergency contacts: {e}")
        return None


def get_emergency_contacts(destination_id: str) -> Optional[dict]:
    """Get emergency contacts for a destination."""
    try:
        collection = get_collection("emergency_contacts")
        return collection.find_one({"destination_id": destination_id})
    except OperationFailure as e:
        logger.error(f"Failed to get emergency contacts: {e}")
        return None


# ═══════════════════════════════════════════════════════════════════════
# BUDGET OPERATIONS
# ═══════════════════════════════════════════════════════════════════════

def save_budget_plan(destination_id: str, budget_type: str, data: dict) -> Optional[str]:
    """Save a budget plan for a destination."""
    try:
        collection = get_collection("budgets")
        doc = {
            "destination_id": destination_id,
            "budget_type": budget_type,
            "data": data,
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }
        result = collection.update_one(
            {"destination_id": destination_id, "budget_type": budget_type},
            {"$set": doc},
            upsert=True,
        )
        return str(result.upserted_id) if result.upserted_id else destination_id
    except OperationFailure as e:
        logger.error(f"Failed to save budget plan: {e}")
        return None


def get_budget_plan(destination_id: str, budget_type: str) -> Optional[dict]:
    """Get a budget plan for a destination."""
    try:
        collection = get_collection("budgets")
        return collection.find_one({"destination_id": destination_id, "budget_type": budget_type})
    except OperationFailure as e:
        logger.error(f"Failed to get budget plan: {e}")
        return None


def get_all_budget_plans(destination_id: str) -> List[dict]:
    """Get all budget plans for a destination."""
    try:
        collection = get_collection("budgets")
        cursor = collection.find({"destination_id": destination_id})
        return list(cursor)
    except OperationFailure as e:
        logger.error(f"Failed to get all budget plans: {e}")
        return []


# ═══════════════════════════════════════════════════════════════════════
# PACKING GUIDE OPERATIONS
# ═══════════════════════════════════════════════════════════════════════

def save_packing_guide(destination_id: str, season: str, data: dict) -> Optional[str]:
    """Save a packing guide for a destination and season."""
    try:
        collection = get_collection("packing_guides")
        doc = {
            "destination_id": destination_id,
            "season": season,
            "data": data,
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }
        result = collection.update_one(
            {"destination_id": destination_id, "season": season},
            {"$set": doc},
            upsert=True,
        )
        return str(result.upserted_id) if result.upserted_id else destination_id
    except OperationFailure as e:
        logger.error(f"Failed to save packing guide: {e}")
        return None


def get_packing_guide(destination_id: str, season: str) -> Optional[dict]:
    """Get a packing guide for a destination and season."""
    try:
        collection = get_collection("packing_guides")
        return collection.find_one({"destination_id": destination_id, "season": season})
    except OperationFailure as e:
        logger.error(f"Failed to get packing guide: {e}")
        return None


# ═══════════════════════════════════════════════════════════════════════
# ITINERARY OPERATIONS
# ═══════════════════════════════════════════════════════════════════════

def save_itinerary(destination_id: str, duration_days: int, data: dict) -> Optional[str]:
    """Save an itinerary for a destination."""
    try:
        collection = get_collection("itineraries")
        doc = {
            "destination_id": destination_id,
            "duration_days": duration_days,
            "data": data,
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }
        result = collection.update_one(
            {"destination_id": destination_id, "duration_days": duration_days},
            {"$set": doc},
            upsert=True,
        )
        return str(result.upserted_id) if result.upserted_id else destination_id
    except OperationFailure as e:
        logger.error(f"Failed to save itinerary: {e}")
        return None


def get_itinerary(destination_id: str, duration_days: int) -> Optional[dict]:
    """Get an itinerary for a destination."""
    try:
        collection = get_collection("itineraries")
        return collection.find_one({"destination_id": destination_id, "duration_days": duration_days})
    except OperationFailure as e:
        logger.error(f"Failed to get itinerary: {e}")
        return None


# ═══════════════════════════════════════════════════════════════════════
# TRAVEL TIPS OPERATIONS
# ═══════════════════════════════════════════════════════════════════════

def save_travel_tips(destination_id: str, data: dict) -> Optional[str]:
    """Save travel tips for a destination."""
    try:
        collection = get_collection("travel_tips")
        doc = {
            "destination_id": destination_id,
            "data": data,
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }
        result = collection.update_one(
            {"destination_id": destination_id},
            {"$set": doc},
            upsert=True,
        )
        return str(result.upserted_id) if result.upserted_id else destination_id
    except OperationFailure as e:
        logger.error(f"Failed to save travel tips: {e}")
        return None


def get_travel_tips(destination_id: str) -> Optional[dict]:
    """Get travel tips for a destination."""
    try:
        collection = get_collection("travel_tips")
        return collection.find_one({"destination_id": destination_id})
    except OperationFailure as e:
        logger.error(f"Failed to get travel tips: {e}")
        return None


# ═══════════════════════════════════════════════════════════════════════
# NEARBY PLACES OPERATIONS
# ═══════════════════════════════════════════════════════════════════════

def save_nearby_places(destination_id: str, data: list) -> Optional[str]:
    """Save nearby places for a destination."""
    try:
        collection = get_collection("nearby_places")
        # Remove existing and insert new
        collection.delete_many({"destination_id": destination_id})
        doc = {
            "destination_id": destination_id,
            "places": data,
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }
        result = collection.insert_one(doc)
        return str(result.inserted_id)
    except OperationFailure as e:
        logger.error(f"Failed to save nearby places: {e}")
        return None


def get_nearby_places(destination_id: str) -> Optional[dict]:
    """Get nearby places for a destination."""
    try:
        collection = get_collection("nearby_places")
        return collection.find_one({"destination_id": destination_id})
    except OperationFailure as e:
        logger.error(f"Failed to get nearby places: {e}")
        return None


# ═══════════════════════════════════════════════════════════════════════
# REVIEW & RATING OPERATIONS
# ═══════════════════════════════════════════════════════════════════════

def create_review(data: dict) -> Optional[str]:
    """Create a new review."""
    try:
        collection = get_collection("reviews")
        data["created_at"] = now_utc()
        result = collection.insert_one(data)
        return str(result.inserted_id)
    except OperationFailure as e:
        logger.error(f"Failed to create review: {e}")
        return None


def get_reviews_by_destination(destination_id: str, limit: int = 20) -> List[dict]:
    """Get reviews for a destination."""
    try:
        collection = get_collection("reviews")
        cursor = collection.find({"destination_id": destination_id}).sort("created_at", -1).limit(limit)
        return list(cursor)
    except OperationFailure as e:
        logger.error(f"Failed to get reviews: {e}")
        return []


def save_rating(destination_id: str, rating_data: dict) -> Optional[str]:
    """Save a rating for a destination."""
    try:
        collection = get_collection("ratings")
        rating_data["destination_id"] = destination_id
        rating_data["created_at"] = now_utc()
        result = collection.insert_one(rating_data)
        return str(result.inserted_id)
    except OperationFailure as e:
        logger.error(f"Failed to save rating: {e}")
        return None


def get_destination_ratings(destination_id: str) -> Optional[dict]:
    """Get aggregated ratings for a destination."""
    try:
        collection = get_collection("ratings")
        pipeline = [
            {"$match": {"destination_id": destination_id}},
            {
                "$group": {
                    "_id": "$destination_id",
                    "avg_safety": {"$avg": "$safety_rating"},
                    "avg_tourist": {"$avg": "$tourist_rating"},
                    "avg_family": {"$avg": "$family_friendly"},
                    "avg_solo": {"$avg": "$solo_traveller"},
                    "avg_couple": {"$avg": "$couple_friendly"},
                    "avg_foreign": {"$avg": "$foreign_tourist"},
                    "total_reviews": {"$sum": 1},
                }
            },
        ]
        results = list(collection.aggregate(pipeline))
        return results[0] if results else None
    except OperationFailure as e:
        logger.error(f"Failed to get destination ratings: {e}")
        return None


# ═══════════════════════════════════════════════════════════════════════
# CHAT HISTORY OPERATIONS
# ═══════════════════════════════════════════════════════════════════════

def save_chat_message(user_id: Optional[str], question: str, answer: str,
                      language: str = "en", ai_model: str = "gemini-2.5-flash-lite",
                      response_time_ms: int = 0, destination_context: str = "") -> Optional[str]:
    """Save a chat message to the chat_history collection."""
    try:
        collection = get_collection("chat_history")
        doc = {
            "user_id": user_id,
            "question": question,
            "answer": answer,
            "language": language,
            "ai_model": ai_model,
            "response_time_ms": response_time_ms,
            "destination_context": destination_context,
            "created_at": now_utc(),
        }
        result = collection.insert_one(doc)
        return str(result.inserted_id)
    except OperationFailure as e:
        logger.error(f"Failed to save chat message: {e}")
        return None


def get_chat_history(user_id: str, limit: int = 50, skip: int = 0) -> list:
    """Get chat history for a user, most recent first."""
    try:
        collection = get_collection("chat_history")
        cursor = (
            collection.find({"user_id": user_id})
            .sort("created_at", -1)
            .skip(skip)
            .limit(limit)
        )
        return list(cursor)
    except OperationFailure as e:
        logger.error(f"Failed to get chat history for {user_id}: {e}")
        return []


def delete_chat_message(message_id: str) -> bool:
    """Delete a single chat message."""
    oid = safe_object_id(message_id)
    if not oid:
        return False
    try:
        collection = get_collection("chat_history")
        result = collection.delete_one({"_id": oid})
        return result.deleted_count > 0
    except OperationFailure as e:
        logger.error(f"Failed to delete chat message {message_id}: {e}")
        return False


def clear_chat_history(user_id: str) -> bool:
    """Clear all chat history for a user."""
    try:
        collection = get_collection("chat_history")
        result = collection.delete_many({"user_id": user_id})
        logger.info(f"Cleared {result.deleted_count} chat messages for user {user_id}")
        return True
    except OperationFailure as e:
        logger.error(f"Failed to clear chat history for {user_id}: {e}")
        return False


def search_chat_history(user_id: str, query: str, limit: int = 20) -> list:
    """Search chat history for a user by text query."""
    try:
        collection = get_collection("chat_history")
        cursor = (
            collection.find(
                {
                    "user_id": user_id,
                    "$text": {"$search": query},
                }
            )
            .sort("created_at", -1)
            .limit(limit)
        )
        return list(cursor)
    except OperationFailure:
        # Fallback to simple regex search if text index doesn't exist
        try:
            cursor = (
                collection.find(
                    {
                        "user_id": user_id,
                        "$or": [
                            {"question": {"$regex": query, "$options": "i"}},
                            {"answer": {"$regex": query, "$options": "i"}},
                        ],
                    }
                )
                .sort("created_at", -1)
                .limit(limit)
            )
            return list(cursor)
        except OperationFailure as e:
            logger.error(f"Failed to search chat history: {e}")
            return []


# ═══════════════════════════════════════════════════════════════════════
# SAVED TRIPS OPERATIONS
# ═══════════════════════════════════════════════════════════════════════

def save_trip(user_id: str, trip_data: dict) -> Optional[str]:
    """Save a trip for a user."""
    try:
        collection = get_collection("saved_trips")
        trip_data["user_id"] = user_id
        trip_data["created_at"] = now_utc()
        trip_data["updated_at"] = now_utc()
        result = collection.insert_one(trip_data)
        return str(result.inserted_id)
    except OperationFailure as e:
        logger.error(f"Failed to save trip: {e}")
        return None


def get_user_trips(user_id: str, limit: int = 20) -> list:
    """Get saved trips for a user."""
    try:
        collection = get_collection("saved_trips")
        cursor = collection.find({"user_id": user_id}).sort("created_at", -1).limit(limit)
        return list(cursor)
    except OperationFailure as e:
        logger.error(f"Failed to get trips for {user_id}: {e}")
        return []


def delete_trip(trip_id: str) -> bool:
    """Delete a saved trip."""
    oid = safe_object_id(trip_id)
    if not oid:
        return False
    try:
        collection = get_collection("saved_trips")
        result = collection.delete_one({"_id": oid})
        return result.deleted_count > 0
    except OperationFailure as e:
        logger.error(f"Failed to delete trip {trip_id}: {e}")
        return False


# ═══════════════════════════════════════════════════════════════════════
# FAVOURITE PLACES OPERATIONS
# ═══════════════════════════════════════════════════════════════════════

def add_favourite_place(user_id: str, place_data: dict) -> Optional[str]:
    """Add a favourite place for a user."""
    try:
        collection = get_collection("favorite_places")
        place_data["user_id"] = user_id
        place_data["created_at"] = now_utc()
        result = collection.insert_one(place_data)
        return str(result.inserted_id)
    except OperationFailure as e:
        logger.error(f"Failed to add favourite place: {e}")
        return None


def get_favourite_places(user_id: str, limit: int = 20) -> list:
    """Get favourite places for a user."""
    try:
        collection = get_collection("favorite_places")
        cursor = collection.find({"user_id": user_id}).sort("created_at", -1).limit(limit)
        return list(cursor)
    except OperationFailure as e:
        logger.error(f"Failed to get favourite places for {user_id}: {e}")
        return []


def remove_favourite_place(place_id: str) -> bool:
    """Remove a favourite place."""
    oid = safe_object_id(place_id)
    if not oid:
        return False
    try:
        collection = get_collection("favorite_places")
        result = collection.delete_one({"_id": oid})
        return result.deleted_count > 0
    except OperationFailure as e:
        logger.error(f"Failed to remove favourite place {place_id}: {e}")
        return False


# ═══════════════════════════════════════════════════════════════════════
# FEEDBACK OPERATIONS
# ═══════════════════════════════════════════════════════════════════════

def save_feedback(user_id: Optional[str], rating: int, message: str,
                  category: str = "general") -> Optional[str]:
    """Save user feedback."""
    try:
        collection = get_collection("feedback")
        doc = {
            "user_id": user_id,
            "rating": rating,
            "message": message,
            "category": category,
            "created_at": now_utc(),
        }
        result = collection.insert_one(doc)
        return str(result.inserted_id)
    except OperationFailure as e:
        logger.error(f"Failed to save feedback: {e}")
        return None


# ═══════════════════════════════════════════════════════════════════════
# AI LOGS OPERATIONS
# ═══════════════════════════════════════════════════════════════════════

def log_ai_request(user_id: Optional[str], prompt: str, response: str,
                   model: str, response_time_ms: int, success: bool,
                   error_message: str = "", destination_context: str = "") -> Optional[str]:
    """Log an AI request for monitoring."""
    try:
        collection = get_collection("ai_logs")
        doc = {
            "user_id": user_id,
            "prompt": prompt[:500],
            "response": response[:1000],
            "model": model,
            "response_time_ms": response_time_ms,
            "success": success,
            "error_message": error_message,
            "destination_context": destination_context,
            "created_at": now_utc(),
        }
        result = collection.insert_one(doc)
        return str(result.inserted_id)
    except OperationFailure as e:
        logger.error(f"Failed to log AI request: {e}")
        return None


# ═══════════════════════════════════════════════════════════════════════
# NOTIFICATIONS OPERATIONS
# ═══════════════════════════════════════════════════════════════════════

def create_notification(user_id: str, title: str, message: str,
                        notification_type: str = "info") -> Optional[str]:
    """Create a notification for a user."""
    try:
        collection = get_collection("notifications")
        doc = {
            "user_id": user_id,
            "title": title,
            "message": message,
            "type": notification_type,
            "is_read": False,
            "created_at": now_utc(),
        }
        result = collection.insert_one(doc)
        return str(result.inserted_id)
    except OperationFailure as e:
        logger.error(f"Failed to create notification: {e}")
        return None


def get_user_notifications(user_id: str, limit: int = 20) -> list:
    """Get notifications for a user."""
    try:
        collection = get_collection("notifications")
        cursor = collection.find({"user_id": user_id}).sort("created_at", -1).limit(limit)
        return list(cursor)
    except OperationFailure as e:
        logger.error(f"Failed to get notifications for {user_id}: {e}")
        return []


def mark_notification_read(notification_id: str) -> bool:
    """Mark a notification as read."""
    oid = safe_object_id(notification_id)
    if not oid:
        return False
    try:
        collection = get_collection("notifications")
        result = collection.update_one(
            {"_id": oid}, {"$set": {"is_read": True}}
        )
        return result.modified_count > 0
    except OperationFailure as e:
        logger.error(f"Failed to mark notification {notification_id} as read: {e}")
        return False


# ═══════════════════════════════════════════════════════════════════════
# SEARCH HISTORY OPERATIONS
# ═══════════════════════════════════════════════════════════════════════

def save_search(user_id: Optional[str], query: str, result_count: int = 0) -> Optional[str]:
    """Save a search query."""
    try:
        collection = get_collection("search_history")
        doc = {
            "user_id": user_id,
            "query": query,
            "result_count": result_count,
            "created_at": now_utc(),
        }
        result = collection.insert_one(doc)
        return str(result.inserted_id)
    except OperationFailure as e:
        logger.error(f"Failed to save search: {e}")
        return None


def get_search_history(user_id: str, limit: int = 20) -> list:
    """Get search history for a user."""
    try:
        collection = get_collection("search_history")
        cursor = collection.find({"user_id": user_id}).sort("created_at", -1).limit(limit)
        return list(cursor)
    except OperationFailure as e:
        logger.error(f"Failed to get search history for {user_id}: {e}")
        return []


# ═══════════════════════════════════════════════════════════════════════
# TRAVEL HISTORY OPERATIONS
# ═══════════════════════════════════════════════════════════════════════

def save_travel_history(user_id: str, travel_data: dict) -> Optional[str]:
    """Save a travel history entry."""
    try:
        collection = get_collection("travel_history")
        travel_data["user_id"] = user_id
        travel_data["created_at"] = now_utc()
        result = collection.insert_one(travel_data)
        return str(result.inserted_id)
    except OperationFailure as e:
        logger.error(f"Failed to save travel history: {e}")
        return None


def get_travel_history(user_id: str, limit: int = 20) -> list:
    """Get travel history for a user."""
    try:
        collection = get_collection("travel_history")
        cursor = collection.find({"user_id": user_id}).sort("created_at", -1).limit(limit)
        return list(cursor)
    except OperationFailure as e:
        logger.error(f"Failed to get travel history for {user_id}: {e}")
        return []


# ═══════════════════════════════════════════════════════════════════════
# INDEX CREATION
# ═══════════════════════════════════════════════════════════════════════

def ensure_indexes():
    """Create necessary indexes for all collections."""
    try:
        db = get_db()

        # Users indexes
        db.users.create_index("username", unique=True)
        db.users.create_index("email", unique=True)

        # Destinations indexes
        db.destinations.create_index("place_name")
        db.destinations.create_index([("place_name", "text"), ("description", "text"), ("state", "text")])
        db.destinations.create_index("state")
        db.destinations.create_index("country")
        db.destinations.create_index("category")

        # Seasonal data indexes
        db.seasonal_data.create_index([("destination_id", 1), ("season", 1)], unique=True)

        # Monthly weather indexes
        db.monthly_weather.create_index([("destination_id", 1), ("month", 1)], unique=True)

        # Hotels indexes
        db.hotels.create_index("destination_id")
        db.hotels.create_index([("destination_id", 1), ("category", 1)])
        db.hotels.create_index("price_per_night")
        db.hotels.create_index([("name", "text"), ("address", "text")])

        # Restaurants indexes
        db.restaurants.create_index("destination_id")
        db.restaurants.create_index([("name", "text")])

        # Foods indexes
        db.foods.create_index("destination_id")
        db.foods.create_index([("destination_id", 1), ("meal_type", 1)])
        db.foods.create_index([("destination_id", 1), ("must_try", 1)])

        # Tourist places indexes
        db.tourist_places.create_index("destination_id")
        db.tourist_places.create_index([("destination_id", 1), ("rating", -1)])

        # Transport indexes
        db.transport.create_index([("destination_id", 1), ("transport_type", 1)], unique=True)

        # Shopping indexes
        db.shopping.create_index("destination_id")

        # Activities indexes
        db.activities.create_index("destination_id")
        db.activities.create_index([("destination_id", 1), ("activity_type", 1)])

        # Festivals indexes
        db.festivals.create_index("destination_id")
        db.festivals.create_index([("destination_id", 1), ("month", 1)])

        # Budgets indexes
        db.budgets.create_index([("destination_id", 1), ("budget_type", 1)], unique=True)

        # Packing guides indexes
        db.packing_guides.create_index([("destination_id", 1), ("season", 1)], unique=True)

        # Itineraries indexes
        db.itineraries.create_index([("destination_id", 1), ("duration_days", 1)], unique=True)

        # Emergency contacts indexes
        db.emergency_contacts.create_index("destination_id", unique=True)

        # Travel tips indexes
        db.travel_tips.create_index("destination_id", unique=True)

        # Nearby places indexes
        db.nearby_places.create_index("destination_id", unique=True)

        # Reviews indexes
        db.reviews.create_index("destination_id")
        db.reviews.create_index([("destination_id", 1), ("created_at", -1)])

        # Ratings indexes
        db.ratings.create_index("destination_id")

        # Chat history indexes
        db.chat_history.create_index([("user_id", 1), ("created_at", -1)])
        db.chat_history.create_index([("question", "text"), ("answer", "text")])

        # Saved trips indexes
        db.saved_trips.create_index([("user_id", 1), ("created_at", -1)])

        # Favorite places indexes
        db.favorite_places.create_index([("user_id", 1), ("created_at", -1)])

        # Notifications indexes
        db.notifications.create_index([("user_id", 1), ("created_at", -1)])
        db.notifications.create_index([("user_id", 1), ("is_read", 1)])

        # AI logs indexes
        db.ai_logs.create_index([("user_id", 1), ("created_at", -1)])
        db.ai_logs.create_index([("created_at", -1)])

        # Search history indexes
        db.search_history.create_index([("user_id", 1), ("created_at", -1)])

        # Travel history indexes
        db.travel_history.create_index([("user_id", 1), ("created_at", -1)])

        # Feedback indexes
        db.feedback.create_index([("created_at", -1)])

        logger.info("All MongoDB indexes created successfully")
    except OperationFailure as e:
        logger.error(f"Failed to create indexes: {e}")