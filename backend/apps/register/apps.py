# backend\apps\register\apps.py
import os
import json
import logging
from django.apps import AppConfig

logger = logging.getLogger(__name__)


class RegisterConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.register'

    def ready(self):
        # One-time admin creation hook. Set ONE_OFF_ADMIN as JSON in env vars, e.g.
        # {"username":"admin","email":"you@example.com","password":"StrongPass123!"}
        payload = os.environ.get('ONE_OFF_ADMIN')
        if not payload:
            return
        try:
            data = json.loads(payload)
        except Exception:
            logger.exception('ONE_OFF_ADMIN is not valid JSON')
            return

        try:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            if not User.objects.filter(is_superuser=True).exists():
                User.objects.create_superuser(
                    username=data.get('username', 'admin'),
                    email=data.get('email', 'admin@example.com'),
                    password=data.get('password', 'ChangeMe123!')
                )
                logger.warning('ONE_OFF_ADMIN: created superuser')
            else:
                logger.info('ONE_OFF_ADMIN: superuser already exists, skipping')
        except Exception:
            logger.exception('Failed to create one-off admin')
