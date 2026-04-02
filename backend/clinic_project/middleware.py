import time
import logging
from django.conf import settings

logger = logging.getLogger('performance')

class QueryTimingMiddleware:
    """Mede tempo da requisição e loga se ultrapassar limiar.

    Configurável via env: SLOW_REQUEST_THRESHOLD_MS (default 500ms)
    """

    def __init__(self, get_response):
        self.get_response = get_response
        self.threshold_ms = int(getattr(settings, 'SLOW_REQUEST_THRESHOLD_MS', 500))

    def __call__(self, request):
        start = time.perf_counter()
        response = self.get_response(request)
        elapsed_ms = (time.perf_counter() - start) * 1000
        if elapsed_ms > self.threshold_ms:
            logger.info("SLOW %sms %s %s", int(elapsed_ms), request.method, request.path)
        return response


class VersionHeaderMiddleware:
    """Anexa o cabeçalho X-App-Version em todas as respostas para facilitar
    depuração entre frontend e backend, especialmente em ambientes de staging.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        version = getattr(settings, 'APP_VERSION', 'dev')
        response.headers["X-App-Version"] = version
        return response
