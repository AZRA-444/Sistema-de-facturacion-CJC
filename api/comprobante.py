from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import json
import os
import requests
from requests.adapters import HTTPAdapter, Retry

URL_SUPABASE = os.environ.get("SUPABASE_URL", "")
KEY_SUPABASE = os.environ.get("SUPABASE_SECRET_KEY", "")

BUCKET_COMPROBANTES = "comprobantes"
EXPIRACION_SEGUNDOS = 60 * 10  # la URL firmada dura 10 minutos

session = requests.Session()
retries = Retry(total=3, backoff_factor=0.5, status_forcelist=[502, 503, 504])
session.mount("https://", HTTPAdapter(max_retries=retries))


class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def _responder(self, status_code, payload):
        self.send_response(status_code)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode('utf-8'))

    def do_GET(self):
        # === IMPORTANTE: aquí deberías validar que quien llama es un admin ===
        # (ej. revisando un header Authorization con un token de sesión antes
        # de continuar). Lo dejo señalado porque no vi cómo autenticas tu
        # admin panel todavía.

        query = parse_qs(urlparse(self.path).query)
        path = (query.get("path") or [None])[0]

        if not path:
            self._responder(400, {"status": "error", "message": "Falta el parámetro 'path'"})
            return

        url_firma = f"{URL_SUPABASE}/storage/v1/object/sign/{BUCKET_COMPROBANTES}/{path}"
        headers = {
            "apikey": KEY_SUPABASE,
            "Authorization": f"Bearer {KEY_SUPABASE}",
            "Content-Type": "application/json",
        }

        try:
            res = session.post(
                url_firma,
                json={"expiresIn": EXPIRACION_SEGUNDOS},
                headers=headers,
                timeout=10,
            )
        except requests.exceptions.RequestException as e:
            self._responder(502, {"status": "error", "message": f"No se pudo conectar con Supabase: {e}"})
            return

        if res.status_code != 200:
            self._responder(404, {"status": "error", "message": "No se pudo generar la URL del comprobante"})
            return

        data = res.json()
        # Supabase devuelve algo como {"signedURL": "/storage/v1/object/sign/comprobantes/...?token=..."}
        signed_path = data.get("signedURL")
        if not signed_path:
            self._responder(500, {"status": "error", "message": "Respuesta inesperada de Supabase"})
            return

        url_completa = f"{URL_SUPABASE}/storage/v1{signed_path}"
        self._responder(200, {"status": "success", "url": url_completa})