"""
Cache Service for Smart Tourism Platform
Provides in-memory caching for frequently accessed destination data.
Reduces MongoDB queries and improves response times.
"""

import time
import logging
from typing import Optional, Any, Dict
from threading import Lock

logger = logging.getLogger(__name__)


class TTLCache:
    """
    Simple thread-safe TTL (Time-To-Live) cache.
    Stores key-value pairs with expiration times.
    """

    def __init__(self, default_ttl: int = 300):
        """
        Initialize the cache.

        Args:
            default_ttl: Default time-to-live in seconds (5 minutes default).
        """
        self._default_ttl = default_ttl
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._lock = Lock()

    def get(self, key: str) -> Optional[Any]:
        """Get a value from the cache. Returns None if not found or expired."""
        with self._lock:
            entry = self._cache.get(key)
            if entry is None:
                return None
            if time.time() > entry["expires_at"]:
                del self._cache[key]
                return None
            return entry["value"]

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set a value in the cache with optional TTL."""
        with self._lock:
            expires_at = time.time() + (ttl if ttl is not None else self._default_ttl)
            self._cache[key] = {
                "value": value,
                "expires_at": expires_at,
                "created_at": time.time(),
            }

    def delete(self, key: str) -> bool:
        """Delete a key from the cache."""
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                return True
            return False

    def clear(self) -> None:
        """Clear all cached entries."""
        with self._lock:
            self._cache.clear()

    def cleanup_expired(self) -> int:
        """Remove all expired entries. Returns the number of removed entries."""
        now = time.time()
        count = 0
        with self._lock:
            expired_keys = [
                k for k, v in self._cache.items()
                if now > v["expires_at"]
            ]
            for key in expired_keys:
                del self._cache[key]
                count += 1
        if count > 0:
            logger.debug(f"Cleaned up {count} expired cache entries")
        return count

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        with self._lock:
            now = time.time()
            expired = sum(1 for v in self._cache.values() if now > v["expires_at"])
            return {
                "total_entries": len(self._cache),
                "expired_entries": expired,
                "active_entries": len(self._cache) - expired,
                "default_ttl": self._default_ttl,
            }


# Global cache instances
_destination_cache = TTLCache(default_ttl=600)  # 10 minutes for destinations
_hotel_cache = TTLCache(default_ttl=300)         # 5 minutes for hotels
_search_cache = TTLCache(default_ttl=120)        # 2 minutes for searches


def get_destination_cache() -> TTLCache:
    """Get the destination cache instance."""
    return _destination_cache


def get_hotel_cache() -> TTLCache:
    """Get the hotel cache instance."""
    return _hotel_cache


def get_search_cache() -> TTLCache:
    """Get the search cache instance."""
    return _search_cache


def clear_all_caches():
    """Clear all cache instances."""
    _destination_cache.clear()
    _hotel_cache.clear()
    _search_cache.clear()
    logger.info("All caches cleared")


def get_cache_stats() -> Dict[str, Any]:
    """Get statistics for all cache instances."""
    return {
        "destination_cache": _destination_cache.get_stats(),
        "hotel_cache": _hotel_cache.get_stats(),
        "search_cache": _search_cache.get_stats(),
    }