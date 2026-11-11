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


def run(code, stdin=""):
    out = io.StringIO()
    saved = sys.stdout, sys.stderr, sys.stdin
    sys.stdout = sys.stderr = out
    sys.stdin = io.StringIO(stdin)
    err, line = None, None
    _prepare_matplotlib(code)
    namespace = {"__name__": "__main__"}
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
