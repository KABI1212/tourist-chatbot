"""
MongoDB Client & Chat History Service
======================================
Provides a thread-safe, lazy-initialised connection to MongoDB Atlas and
helper functions for storing and retrieving chat history.

All functions degrade gracefully — if MongoDB is unavailable the application
continues to work; chat history simply won't be persisted.
"""
import os
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from django.conf import settings

logger = logging.getLogger("main")

# ─── Lazy singleton ───────────────────────────────────────────────────────────
_client = None
_db = None


def _get_db():
    """Return the MongoDB database, initialising the client on first call."""
    global _client, _db
    if _db is not None:
        return _db

    uri = getattr(settings, "MONGODB_URI", "") or os.environ.get("MONGODB_URI", "")
    db_name = getattr(settings, "MONGODB_DATABASE", "tourist_chatbot")

    if not uri:
        logger.warning("MONGODB_URI not set — chat history will not be persisted.")
        return None

    try:
        from pymongo import MongoClient
        from pymongo.server_api import ServerApi

        _client = MongoClient(uri, server_api=ServerApi("1"), serverSelectionTimeoutMS=5000)
        # Ping to confirm connection
        _client.admin.command("ping")
        _db = _client[db_name]
        logger.info("MongoDB connected to database '%s'.", db_name)
    except Exception as exc:
        logger.error("MongoDB connection failed: %s", exc)
        _client = None
        _db = None

    return _db


def get_chat_collection():
    """Return the chat_history collection or None if unavailable."""
    db = _get_db()
    return db["chat_history"] if db is not None else None


# ─── CRUD helpers ─────────────────────────────────────────────────────────────

def save_chat(
    user_id: int,
    session_id: str,
    user_message: str,
    ai_reply: str,
    intent: str = "unknown",
    entities: Optional[dict] = None,
    source: str = "gemini",
    token_usage: Optional[dict] = None,
) -> Optional[str]:
    """
    Persist a single chat exchange to MongoDB.

    Returns the inserted document's string ID, or None on failure.

    Parameters
    ----------
    user_id     : Django User.pk
    session_id  : browser-level session key
    user_message: raw user input
    ai_reply    : formatted AI response text
    intent      : detected intent label
    entities    : extracted entity dict (destination, budget, etc.)
    source      : which service produced the reply ("gemini", "wikipedia", etc.)
    token_usage : dict with prompt_tokens / completion_tokens if available
    """
    collection = get_chat_collection()
    if collection is None:
        return None

    doc = {
        "message_id": str(uuid.uuid4()),
        "user_id": user_id,
        "session_id": session_id,
        "user_message": user_message,
        "ai_reply": ai_reply,
        "intent": intent,
        "entities": entities or {},
        "source": source,
        "token_usage": token_usage or {},
        "timestamp": datetime.now(timezone.utc),
        "is_deleted": False,
    }

    try:
        result = collection.insert_one(doc)
        logger.debug("Chat saved: %s", doc["message_id"])
        return doc["message_id"]
    except Exception as exc:
        logger.error("save_chat failed: %s", exc)
        return None


def get_chat_history(
    user_id: int,
    session_id: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
) -> list[dict]:
    """
    Retrieve chat history for a user, newest first.

    Parameters
    ----------
    user_id    : filter by user
    session_id : if provided, filter to this session only
    limit      : max records to return
    skip       : pagination offset
    """
    collection = get_chat_collection()
    if collection is None:
        return []

    query: dict = {"user_id": user_id, "is_deleted": False}
    if session_id:
        query["session_id"] = session_id

    try:
        cursor = (
            collection.find(query, {"_id": 0})
            .sort("timestamp", -1)
            .skip(skip)
            .limit(limit)
        )
        return list(cursor)
    except Exception as exc:
        logger.error("get_chat_history failed: %s", exc)
        return []


def delete_chat(message_id: str, user_id: int) -> bool:
    """
    Soft-delete a single message (sets is_deleted=True).
    Only the owning user can delete their own messages.

    Returns True on success, False otherwise.
    """
    collection = get_chat_collection()
    if collection is None:
        return False

    try:
        result = collection.update_one(
            {"message_id": message_id, "user_id": user_id},
            {"$set": {"is_deleted": True, "deleted_at": datetime.now(timezone.utc)}},
        )
        success = result.modified_count > 0
        if not success:
            logger.warning(
                "delete_chat: no document found for message_id=%s user_id=%s",
                message_id, user_id,
            )
        return success
    except Exception as exc:
        logger.error("delete_chat failed: %s", exc)
        return False


def clear_chat(user_id: int, session_id: Optional[str] = None) -> int:
    """
    Soft-delete all chat messages for a user (optionally scoped to a session).

    Returns the count of messages cleared.
    """
    collection = get_chat_collection()
    if collection is None:
        return 0

    query: dict = {"user_id": user_id, "is_deleted": False}
    if session_id:
        query["session_id"] = session_id

    try:
        result = collection.update_many(
            query,
            {"$set": {"is_deleted": True, "deleted_at": datetime.now(timezone.utc)}},
        )
        logger.info(
            "clear_chat: %d messages cleared for user_id=%s", result.modified_count, user_id
        )
        return result.modified_count
    except Exception as exc:
        logger.error("clear_chat failed: %s", exc)
        return 0


def count_chats(user_id: int) -> int:
    """Return total non-deleted message count for a user."""
    collection = get_chat_collection()
    if collection is None:
        return 0
    try:
        return collection.count_documents({"user_id": user_id, "is_deleted": False})
    except Exception as exc:
        logger.error("count_chats failed: %s", exc)
        return 0
