"""
Architectural boundary test for the register app.

Enforces that register stays focused on authentication and professional
identity. If a new model is needed, it must live in its own dedicated app.

Allowed models:
  - professional       (AUTH_USER_MODEL)
  - devicesession      (JWT device tokens)
  - professionalsettings
  - webauthn credential
"""

from django.apps import apps
from django.test import SimpleTestCase


ALLOWED_REGISTER_MODELS = {
    "professional",
    "devicesession",
    "professionalsettings",
    "webauthncredential",
    "pushsubscription",
}


class RegisterAppBoundaryTest(SimpleTestCase):
    def test_no_unexpected_models_in_register(self):
        """register should only contain auth/session models for Professional."""
        register_models = {
            m._meta.model_name
            for m in apps.get_app_config("register").get_models()
        }
        unexpected = register_models - ALLOWED_REGISTER_MODELS
        self.assertEqual(
            unexpected,
            set(),
            f"Unexpected models in register app: {unexpected}. "
            "Extract them into a dedicated app (e.g. apps/<domain>/).",
        )
