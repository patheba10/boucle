"""Exécute un programme élève avec le même harnais que le navigateur.

Entrée (stdin) : JSON {"code": "...", "stdin": "..."}
Sortie (stdout) : JSON {"out", "err", "line", "figs"}
"""
import json
import os
import shutil
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "public", "assets", "py"))
os.environ.setdefault("MPLBACKEND", "Agg")

import harness  # noqa: E402

# Même convention que le navigateur : les jeux de données de public/datasets/ sont lisibles via "data/<fichier>".
DATASETS = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "public", "datasets"))
workdir = tempfile.mkdtemp(prefix="boucle-run-")
if os.path.isdir(DATASETS):
    os.symlink(DATASETS, os.path.join(workdir, "data"))
os.chdir(workdir)

payload = json.load(sys.stdin)
result = harness.run(payload["code"], payload.get("stdin", ""))
result["figs"] = len(result["figs"])  # inutile de renvoyer les images en CI
sys.stdout.write(json.dumps(result))
shutil.rmtree(workdir, ignore_errors=True)
