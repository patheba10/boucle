"""Exécute un programme élève avec le même harnais que le navigateur.

Entrée (stdin) : JSON {"code": "...", "stdin": "..."}
Sortie (stdout) : JSON {"out", "err", "line", "figs"}
"""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "public", "assets", "py"))
os.environ.setdefault("MPLBACKEND", "Agg")

import harness  # noqa: E402

payload = json.load(sys.stdin)
result = harness.run(payload["code"], payload.get("stdin", ""))
result["figs"] = len(result["figs"])  # inutile de renvoyer les images en CI
sys.stdout.write(json.dumps(result))
