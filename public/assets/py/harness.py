"""Exécute le code de l'élève et renvoie un résultat sérialisable.

Utilisé à deux endroits, pour que le navigateur et la CI se comportent pareil :
- dans le navigateur, par le Web Worker Pyodide (assets/js/workers/python-worker.js) ;
- en CI, par scripts/run_py.py avec CPython.
"""
import base64
import io
import sys
import traceback

FILENAME = "main.py"
MAX_OUT = 60_000


def _prepare_matplotlib(code):
    """Force un backend sans écran et neutralise plt.show() : les figures sont récupérées après coup."""
    if "matplotlib" not in code and "seaborn" not in code and ".plot(" not in code:
        return
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        plt.close("all")
        plt.show = lambda *args, **kwargs: None
    except Exception:
        pass


def _collect_figures():
    plt = sys.modules.get("matplotlib.pyplot")
    if plt is None:
        return []
    figures = []
    for number in plt.get_fignums():
        buf = io.BytesIO()
        plt.figure(number).savefig(buf, format="png", dpi=110, bbox_inches="tight")
        figures.append(base64.b64encode(buf.getvalue()).decode("ascii"))
    plt.close("all")
    return figures


class _Reponse:
    """Réponse du client de test : les attributs usuels de httpx.Response."""

    def __init__(self, status, headers, body):
        self.status_code = status
        self.headers = {k.lower(): v for k, v in headers.items()}
        self.content = body
        self.text = body.decode("utf-8", "replace")

    def json(self):
        import json
        return json.loads(self.text)

    def __repr__(self):
        return f"<Response [{self.status_code}]>"


class _ClientDeTest:
    """Remplace fastapi.testclient.TestClient : même usage (get, post, put, patch, delete, json=, params=, headers=),
    mais l'application ASGI est exécutée directement, sans thread ni boucle d'événements, ce que Pyodide n'offre pas.
    Les événements de démarrage (lifespan) ne sont pas exécutés."""

    def __init__(self, app, base_url="http://testserver", headers=None, raise_server_exceptions=True, **_):
        self.app = app
        self.headers = dict(headers or {})
        self.raise_server_exceptions = raise_server_exceptions

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def request(self, method, url, json=None, params=None, headers=None, content=None, data=None):
        import json as _json
        from urllib.parse import urlsplit, urlencode
        u = urlsplit(url)
        qs = u.query
        if params:
            qs = (qs + "&" if qs else "") + urlencode(params, doseq=True)
        hdr = {k.lower(): str(v) for k, v in {**self.headers, **(headers or {})}.items()}
        if json is not None:
            body = _json.dumps(json).encode()
            hdr.setdefault("content-type", "application/json")
        elif data is not None:
            body = urlencode(data).encode()
            hdr.setdefault("content-type", "application/x-www-form-urlencoded")
        else:
            body = content.encode() if isinstance(content, str) else (content or b"")
        hdr.setdefault("host", "testserver")
        hdr["content-length"] = str(len(body))
        path = u.path or "/"
        scope = {"type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1", "method": method.upper(), "scheme": "http",
                 "path": path, "raw_path": path.encode(), "query_string": qs.encode(), "root_path": "",
                 "headers": [(k.encode(), v.encode()) for k, v in hdr.items()], "client": ("testclient", 50000), "server": ("testserver", 80)}
        state = {"lu": False, "status": 500, "headers": {}, "body": b""}

        async def receive():
            if not state["lu"]:
                state["lu"] = True
                return {"type": "http.request", "body": body, "more_body": False}
            return {"type": "http.disconnect"}

        async def send(msg):
            if msg["type"] == "http.response.start":
                state["status"] = msg["status"]
                state["headers"] = {k.decode(): v.decode() for k, v in msg.get("headers", [])}
            elif msg["type"] == "http.response.body":
                state["body"] += msg.get("body", b"")

        coro = self.app(scope, receive, send)
        try:
            while True:
                coro.send(None)
                raise RuntimeError("l'application attend une opération asynchrone réelle, que le client de test ne sait pas exécuter")
        except StopIteration:
            pass
        except Exception:
            if self.raise_server_exceptions:
                raise
            return _Reponse(500, {"content-type": "text/plain"}, b"Internal Server Error")
        return _Reponse(state["status"], state["headers"], state["body"])

    def get(self, url, **k):
        return self.request("GET", url, **k)

    def post(self, url, **k):
        return self.request("POST", url, **k)

    def put(self, url, **k):
        return self.request("PUT", url, **k)

    def patch(self, url, **k):
        return self.request("PATCH", url, **k)

    def delete(self, url, **k):
        return self.request("DELETE", url, **k)


def _prepare_asgi(code):
    """FastAPI exécute les fonctions synchrones dans un pool de threads et son TestClient en lance un : Pyodide n'a pas
    de threads. On exécute donc ces fonctions directement, et TestClient devient un client synchrone (même chose en CI)."""
    if "fastapi" not in code and "starlette" not in code:
        return
    try:
        import starlette.concurrency
        import starlette.testclient
        import fastapi.concurrency
        import fastapi.dependencies.utils
        import fastapi.routing
        import fastapi.testclient
    except Exception:
        return

    async def direct(func, *args, **kwargs):
        return func(*args, **kwargs)

    for module in (starlette.concurrency, fastapi.concurrency, fastapi.dependencies.utils, fastapi.routing):
        if hasattr(module, "run_in_threadpool"):
            module.run_in_threadpool = direct
    starlette.testclient.TestClient = fastapi.testclient.TestClient = _ClientDeTest


def _prepare_keras(code):
    """TensorFlow n'existe pas dans Pyodide : sans lui, « keras » et « tensorflow » désignent minikeras (même API, en NumPy)."""
    if "keras" not in code and "tensorflow" not in code:
        return
    try:
        import tensorflow  # noqa: F401 — le vrai, en CI (vérification avec TensorFlow)
        return
    except ImportError:
        pass
    import minikeras
    minikeras.Layer._compteur = {}
    minikeras.installer()


class _Outils:
    """Objet « boucle » disponible dans le code des tests d'un défi (après la ligne #@boucle)."""

    def __init__(self, code):
        lines = code.split("\n#@boucle")[0].split("\n")
        self.source = "\n".join(l for l in lines if not (l.startswith('print("<<<') and l.endswith('>>>")')))

    def _pytest(self, modules, quiet):
        import importlib
        import os
        import tempfile
        import pytest
        sys.dont_write_bytecode = True
        d = tempfile.mkdtemp(prefix="boucle-pytest-")
        for name, src in {**modules, "test_eleve": self.source}.items():
            with open(os.path.join(d, name + ".py"), "w", encoding="utf-8") as f:
                f.write(src)
            sys.modules.pop(name, None)
        importlib.invalidate_caches()
        results = []

        class Collecte:
            def pytest_runtest_logreport(self, report):
                if report.when == "call" or report.outcome != "passed":
                    results.append((report.nodeid.split("::")[-1], report.outcome))

        saved = sys.stdout
        if quiet:
            sys.stdout = io.StringIO()
        sys.path.insert(0, d)
        cwd = os.getcwd()
        os.chdir(d)
        try:
            code = pytest.main(["test_eleve.py", "-q", "-s", "--no-header", "-p", "no:cacheprovider", "-p", "no:faulthandler", "--import-mode=importlib", "-W", "ignore::DeprecationWarning"], plugins=[Collecte()])
        finally:
            sys.stdout = saved
            os.chdir(cwd)
            sys.path.remove(d)
            for name in list(modules) + ["test_eleve"]:
                sys.modules.pop(name, None)
        return int(code), results

    def pytest(self, modules=None):
        """Lance pytest sur le fichier de l'élève (sortie réelle de pytest)."""
        self._pytest(modules or {}, quiet=False)

    def mutants(self, modules, mutants):
        """Les tests de l'élève passent-ils sur le code correct et échouent-ils sur chaque version fautive ?
        modules : {nom: source correcte} ; mutants : [(description, {nom: source fautive})]."""
        code, res = self._pytest(modules, quiet=True)
        ok = [r for r in res if r[1] == "passed"]
        if not res:
            print("aucun test trouvé : les fonctions de test doivent commencer par test_")
            return
        if code != 0:
            print("sur le code correct : %d test(s) en échec, ils doivent tous réussir" % (len(res) - len(ok)))
            for name, outcome in res:
                if outcome != "passed":
                    print("  " + name + " : " + outcome)
            return
        print("sur le code correct : tous les tests réussissent")
        for i, (desc, mods) in enumerate(mutants, 1):
            c, _ = self._pytest({**modules, **mods}, quiet=True)
            print("erreur %d (%s) : %s" % (i, desc, "détectée" if c != 0 else "NON détectée"))


def run(code, stdin=""):
    out = io.StringIO()
    saved = sys.stdout, sys.stderr, sys.stdin
    sys.stdout = sys.stderr = out
    sys.stdin = io.StringIO(stdin)
    err, line = None, None
    _prepare_matplotlib(code)
    _prepare_asgi(code)
    _prepare_keras(code)
    namespace = {"__name__": "__main__", "boucle": _Outils(code)}
    if "\n#@boucle" in code or code.startswith("#@boucle"):
        # Défi de tests : le code de l'élève est un fichier de tests, lancé par pytest (boucle.pytest / boucle.mutants).
        # On n'exécute que la partie après #@boucle, précédée des éventuels marqueurs de sortie du vérificateur.
        head, _, tail = code.partition("#@boucle")
        marks = [l for l in head.split("\n") if l.startswith('print("<<<') and l.endswith('>>>")')]
        code = "\n".join(marks) + "\n" + tail
    try:
        exec(compile(code, FILENAME, "exec"), namespace)
    except SyntaxError as e:
        err, line = f"{type(e).__name__}: {e.msg}", e.lineno
    except SystemExit:
        pass
    except BaseException as e:  # noqa: BLE001 — on veut tout remonter à l'élève
        frames = [f for f in traceback.extract_tb(e.__traceback__) if f.filename == FILENAME]
        line = frames[-1].lineno if frames else None
        err = f"{type(e).__name__}: {e}"
    finally:
        sys.stdout, sys.stderr, sys.stdin = saved
    try:
        figures = _collect_figures()
    except Exception:
        figures = []
    text = out.getvalue()
    if len(text) > MAX_OUT:
        text = text[:MAX_OUT] + "\n… (sortie tronquée)"
    return {"out": text, "err": err, "line": line, "figs": figures}
