/* Web Worker : vrai CPython (Pyodide / WebAssembly), isolé du fil principal.
   Protocole : reçoit {id, code, stdin}
               envoie {id, status} pendant le chargement, {id, phase: "running"} au début de l'exécution,
               puis {id, out, err, line, figs} ou {id, fatal}. */
const PYODIDE_VERSION = "0.29.5";
const INDEX_URL = "https://cdn.jsdelivr.net/pyodide/v" + PYODIDE_VERSION + "/full/";

let pyodide = null;
let runJson = null;

async function init() {
  importScripts(INDEX_URL + "pyodide.js");
  pyodide = await loadPyodide({ indexURL: INDEX_URL });
  const harness = await (await fetch(new URL("../../py/harness.py", self.location))).text();
  pyodide.FS.writeFile("/home/pyodide/boucle_harness.py", harness);
  pyodide.runPython(
    "import sys, json\n" +
    "sys.path.insert(0, '/home/pyodide')\n" +
    "import boucle_harness\n" +
    "def __boucle_run(code, stdin):\n" +
    "    return json.dumps(boucle_harness.run(code, stdin))\n"
  );
  runJson = pyodide.globals.get("__boucle_run");
}
const ready = init();

self.onmessage = async (event) => {
  const { id, code, stdin } = event.data;
  try {
    await ready;
  } catch (e) {
    self.postMessage({ id, fatal: "Impossible de charger Python : " + (e && e.message ? e.message : e) });
    return;
  }
  try {
    await pyodide.loadPackagesFromImports(code, {
      messageCallback: (msg) => self.postMessage({ id, status: msg }),
      errorCallback: () => {}
    });
  } catch (e) {
    /* Paquet introuvable : l'import échouera proprement avec un ModuleNotFoundError lisible. */
  }
  self.postMessage({ id, phase: "running" });
  const result = JSON.parse(runJson(code, stdin || ""));
  self.postMessage(Object.assign({ id }, result));
};
