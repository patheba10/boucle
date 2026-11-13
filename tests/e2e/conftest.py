"""Fixtures des tests e2e : serveur statique local + navigateur Chromium (Playwright).

Variables d'environnement facultatives (utiles hors CI, sans accès au CDN) :
- CHROME_PATH            navigateur Chrome/Chromium à utiliser au lieu de celui de Playwright
- BOUCLE_PYODIDE_DIR     copie locale de Pyodide (paquet npm « pyodide ») servie à la place du CDN
- BOUCLE_JSCPP_FILE      copie locale de JSCPP.es5.min.js servie à la place du CDN
Sans ces variables, les tests utilisent les vrais CDN, comme en production.
"""
import functools
import http.server
import os
import threading
from pathlib import Path

import pytest
from playwright.sync_api import sync_playwright

PUBLIC = Path(__file__).resolve().parents[2] / "public"
PYODIDE_DIR = os.environ.get("BOUCLE_PYODIDE_DIR")
JSCPP_FILE = os.environ.get("BOUCLE_JSCPP_FILE")
OFFLINE = bool(PYODIDE_DIR)

CONTENT_TYPES = {"wasm": "application/wasm", "js": "text/javascript", "json": "application/json", "zip": "application/zip"}


class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


@pytest.fixture(scope="session")
def base_url():
    handler = functools.partial(_Quiet, directory=str(PUBLIC))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{server.server_address[1]}/"
    server.shutdown()


@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as p:
        kwargs = {"args": ["--no-sandbox"]}
        if os.environ.get("CHROME_PATH"):
            kwargs["executable_path"] = os.environ["CHROME_PATH"]
        b = p.chromium.launch(**kwargs)
        yield b
        b.close()


def _serve_pyodide(route):
    name = route.request.url.split("/full/")[1].split("?")[0]
    path = Path(PYODIDE_DIR) / name
    if path.exists():
        route.fulfill(path=str(path), headers={"content-type": CONTENT_TYPES.get(path.suffix[1:], "application/octet-stream"), "access-control-allow-origin": "*"})
    else:
        route.fulfill(status=404, body="absent de la copie locale")


def _contexte(browser, service_workers="block"):
    # Le service worker est bloqué par défaut : chaque test part d'un navigateur neuf, sans cache hors ligne.
    # test_hors_ligne l'autorise pour vérifier le mode hors ligne lui-même.
    context = browser.new_context(viewport={"width": 1280, "height": 900}, service_workers=service_workers)
    context.route("**/fonts.g*/**", lambda r: r.abort())
    if PYODIDE_DIR:
        context.route("https://cdn.jsdelivr.net/pyodide/**", _serve_pyodide)
    if JSCPP_FILE:
        context.route("https://cdn.jsdelivr.net/npm/JSCPP**", lambda r: r.fulfill(path=JSCPP_FILE, headers={"content-type": "text/javascript"}))
    return context


def _page(context, base_url):
    pg = context.new_page()
    pg.errors = []
    pg.on("pageerror", lambda e: pg.errors.append(str(e)))
    # Une violation de la Content-Security-Policy n'est pas une exception : le navigateur la signale dans la console.
    pg.on("console", lambda m: pg.errors.append(m.text) if m.type == "error" and "Content Security Policy" in m.text else None)
    pg.base = base_url
    return pg


@pytest.fixture
def page(browser, base_url):
    context = _contexte(browser)
    yield _page(context, base_url)
    context.close()


@pytest.fixture
def page_hors_ligne(browser, base_url):
    """Une page dont le service worker est actif."""
    context = _contexte(browser, service_workers="allow")
    pg = _page(context, base_url)
    pg.contexte = context
    yield pg
    context.close()
