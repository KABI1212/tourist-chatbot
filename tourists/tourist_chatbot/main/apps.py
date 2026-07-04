import os
import logging
from django.apps import AppConfig

logger = logging.getLogger(__name__)


class MainConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'main'

    def ready(self):
        """
        Run startup health checks when Django finishes loading.
        Verifies MongoDB connectivity before accepting requests.
        """
        # ── Autoreloader guard ───────────────────────────────────────
        # runserver spawns a parent (watcher) and child (actual server).
        # ready() fires in BOTH processes. Only run health check in the
        # child process (RUN_MAIN='true') to avoid duplicate connections
        # and to prevent sys.exit(1) killing the watcher on failure.
        if os.environ.get("RUN_MAIN") != "true":
            return

        # ── Management command guard ─────────────────────────────────
        # Commands like collectstatic, migrate, shell don't need MongoDB.
        import sys
        if any(cmd in sys.argv for cmd in [
            "collectstatic", "migrate", "makemigrations",
            "createsuperuser", "flush", "shell", "test",
        ]):
            return

        # ── Health check ─────────────────────────────────────────────
        try:
            from main.services.mongodb_service import check_connection_startup
            check_connection_startup()
        except Exception as e:
            logger.critical("Startup health check crashed: %s", e)
            sys.exit(1)
