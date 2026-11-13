"""Une API Supabase simulée (Auth et REST) pour tester les comptes sans projet réel.

Seul le contrat HTTP de supabase-js est imité : formats des réponses et des erreurs de GoTrue et PostgREST.
Les règles de sécurité de la vraie base sont testées à part, en pgTAP (supabase/tests).
"""
import base64
import json
import time
from urllib.parse import urlparse, parse_qs

URL = "https://test.supabase.co"
CONFIG_JS = 'export const SUPABASE_URL = "%s";\nexport const SUPABASE_ANON_KEY = "sb_publishable_test";\n' % URL
MOT_DE_PASSE = "analytique42"


def _jwt(sub):
    def b64(d):
        return base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip("=")
    return b64({"alg": "HS256", "typ": "JWT"}) + "." + b64({"sub": sub, "role": "authenticated", "aud": "authenticated", "exp": int(time.time()) + 3600}) + ".signature"


class FauxSupabase:
    def __init__(self):
        self.utilisateurs = {"ada@exemple.org": {"id": "11111111-1111-1111-1111-111111111111", "nom": "Ada Lovelace"}}
        self.appels = []
        self.progression = {"donnees": {}, "revision": 1}

    def _user(self, email):
        u = self.utilisateurs[email]
        return {"id": u["id"], "aud": "authenticated", "role": "authenticated", "email": email,
                "user_metadata": {"full_name": u["nom"]} if u["nom"] else {}, "app_metadata": {"provider": "email"},
                "created_at": "2026-11-13T12:00:00Z"}

    def _session(self, email):
        return {"access_token": _jwt(self.utilisateurs[email]["id"]), "token_type": "bearer", "expires_in": 3600,
                "expires_at": int(time.time()) + 3600, "refresh_token": "jeton-de-rafraichissement", "user": self._user(email)}

    def _connecte(self, req):
        """L'utilisateur du jeton envoyé (comme les règles RLS, qui filtrent sur auth.uid())."""
        jeton = (req.headers.get("authorization") or "").removeprefix("Bearer ")
        try:
            charge = jeton.split(".")[1]
            sub = json.loads(base64.urlsafe_b64decode(charge + "=" * (-len(charge) % 4)))["sub"]
        except (IndexError, ValueError, KeyError):
            return None
        return next((u for u in self.utilisateurs.values() if u["id"] == sub), None)

    @staticmethod
    def _json(route, statut, corps):
        route.fulfill(status=statut, content_type="application/json", body=json.dumps(corps),
                      headers={"access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*"})

    def _erreur(self, route, statut, code, msg):
        self._json(route, statut, {"code": statut, "error_code": code, "msg": msg})

    def gerer(self, route):
        req = route.request
        url = urlparse(req.url)
        if req.method == "OPTIONS":
            return self._json(route, 200, {})
        corps = json.loads(req.post_data) if req.post_data else {}
        self.appels.append((req.method, url.path, parse_qs(url.query), corps))
        chemin, q = url.path, parse_qs(url.query)
        if chemin == "/auth/v1/token" and q.get("grant_type") == ["password"]:
            if corps.get("email") in self.utilisateurs and corps.get("password") == MOT_DE_PASSE:
                return self._json(route, 200, self._session(corps["email"]))
            return self._erreur(route, 400, "invalid_credentials", "Invalid login credentials")
        if chemin == "/auth/v1/token" and q.get("grant_type") == ["refresh_token"]:
            return self._json(route, 200, self._session("ada@exemple.org"))
        if chemin == "/auth/v1/signup":
            if corps.get("email") in self.utilisateurs:
                return self._erreur(route, 422, "user_already_exists", "User already registered")
            nom = (corps.get("data") or {}).get("full_name")
            self.utilisateurs[corps["email"]] = {"id": "33333333-3333-3333-3333-333333333333", "nom": nom}
            return self._json(route, 200, self._session(corps["email"]))
        if chemin == "/auth/v1/recover":
            return self._json(route, 200, {})
        if chemin == "/auth/v1/logout":
            return route.fulfill(status=204, headers={"access-control-allow-origin": "*"})
        if chemin == "/auth/v1/user":
            u = self._connecte(req)
            email = next((e for e, v in self.utilisateurs.items() if v is u), None)
            return self._json(route, 200, self._user(email)) if email else self._erreur(route, 401, "bad_jwt", "invalid JWT")
        if chemin == "/auth/v1/authorize":
            return route.fulfill(status=200, content_type="text/html", body="<p>Page du fournisseur</p>")
        if chemin == "/rest/v1/profils":
            u = self._connecte(req)
            if not u:
                return self._json(route, 200, None)
            return self._json(route, 200, {"nom": u["nom"], "avatar_url": None, "objectif": None, "roadmap": None})
        return self._erreur(route, 404, "not_found", "route inconnue du faux Supabase : " + chemin)

    def brancher(self, context):
        context.route("**/config.js", lambda r: r.fulfill(status=200, content_type="text/javascript", body=CONFIG_JS))
        context.route(URL + "/**", self.gerer)
