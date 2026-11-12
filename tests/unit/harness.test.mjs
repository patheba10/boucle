/* Harnais Python commun (navigateur et CI) : client de test FastAPI sans threads, pytest et test par mutation. */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const RUNNER = fileURLToPath(new URL("../../scripts/run_py.py", import.meta.url));
const py = (code) => JSON.parse(spawnSync("python3", [RUNNER], { input: JSON.stringify({ code, stdin: "" }), encoding: "utf8" }).stdout);

test("TestClient : FastAPI tourne sans thread ni boucle d'événements (comme dans Pyodide)", () => {
  const r = py(`import threading
def interdit(*a, **k): raise RuntimeError("thread")
threading.Thread.start = interdit
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.testclient import TestClient
from pydantic import BaseModel
app = FastAPI()
class P(BaseModel):
    nom: str
def qui(x_cle: str | None = Header(default=None)):
    if x_cle != "ok": raise HTTPException(401, "non")
    return x_cle
@app.post("/p", status_code=201)
def creer(p: P, c: str = Depends(qui)): return {"nom": p.nom, "c": c}
@app.get("/p")
async def lister(n: int = 2): return list(range(n))
with TestClient(app) as client:
    print(client.post("/p", json={"nom": "a"}).status_code)
    r = client.post("/p", json={"nom": "a"}, headers={"X-Cle": "ok"}); print(r.status_code, r.json(), r.headers["content-type"])
    print(client.get("/p", params={"n": 3}).json(), client.get("/p?n=x").status_code, client.post("/p", json={}).status_code)`);
  assert.equal(r.err, null);
  assert.equal(r.out, "401\n201 {'nom': 'a', 'c': 'ok'} application/json\n[0, 1, 2] 422 401\n");
});

test("boucle.pytest et boucle.mutants : le fichier de l'élève est lancé par pytest, sur le bon code puis sur les mutants", () => {
  const eleve = "from calc import double\n\ndef test_double():\n    assert double(2) == 4\n";
  const bon = "def double(x):\n    return 2 * x\n";
  const r = py(eleve + "#@boucle\nimport pytest\nM = {'calc': " + JSON.stringify(bon) + "}\nboucle.mutants(M, [('carré', {'calc': 'def double(x):\\n    return x * x\\n'}), ('plus un', {'calc': 'def double(x):\\n    return x + 1\\n'})])\nboucle.pytest(M)\n");
  assert.equal(r.err, null);
  assert.match(r.out, /^sur le code correct : tous les tests réussissent\nerreur 1 \(carré\) : NON détectée\nerreur 2 \(plus un\) : détectée\n\.\n1 passed/);
  const rate = py("from calc import double\n\ndef test_faux():\n    assert double(2) == 5\n#@boucle\nimport pytest\nboucle.mutants({'calc': " + JSON.stringify(bon) + "}, [])\n");
  assert.match(rate.out, /^sur le code correct : 1 test\(s\) en échec, ils doivent tous réussir\n  test_faux : failed\n$/);
  assert.equal(py("x = 1\n#@boucle\nimport pytest\nboucle.mutants({}, [])\n").out, "aucun test trouvé : les fonctions de test doivent commencer par test_\n");
});

test("démontage après exécution : les objets de l'élève sont vidés un par un, les conteneurs partagés intacts", () => {
  // Dans un seul processus : on exécute le code de l'élève, puis on vérifie ce que _demonter a fait.
  const r = py(`import harness, sys
code = '''
import sys
class Noeud:
    def __init__(self, v, s=None):
        self.v, self.s = v, s
class Fente:
    __slots__ = ("v", "s")
    def __init__(self, v, s=None):
        self.v, self.s = v, s
tete = None
for i in range(50000):
    tete = Noeud(i, tete)
f = Fente(1, Fente(2))
chemins = sys.path
garde = [tete, f]
sys.modules["__temoin_boucle__"] = garde
print("construit")
'''
res = harness.run(code)
garde = sys.modules.pop("__temoin_boucle__")
print(res["out"].strip(), res["err"])
print(len(sys.path) > 0, len(garde), vars(garde[0]), hasattr(garde[1], "v"))
`);
  assert.equal(r.err, null);
  assert.equal(r.out, "construit None\nTrue 2 {} False\n");
});
