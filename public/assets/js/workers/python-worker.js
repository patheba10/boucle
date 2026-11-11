/* Web Worker : vrai CPython (Pyodide / WebAssembly), isolé du fil principal.
   Messages reçus :
     {id, type: "run", code, stdin, files}  exécute le code ; files = {"iris.csv": "contenu…"} copiés dans data/
     {id, type: "preload", code}            charge Python et les paquets importés par ce code, sans l'exécuter
   Messages envoyés :
     {id, status}            progression du chargement
     {id, phase: "running"}  début de l'exécution (le minuteur anti-boucle infinie démarre ici)
     {id, out, err, line, figs} | {id, preloaded: true} | {id, fatal} */
const PYODIDE_VERSION = "0.29.5";
const INDEX_URL = "https://cdn.jsdelivr.net/pyodide/v" + PYODIDE_VERSION + "/full/";
const HOME = "/home/pyodide";

let pyodide = null;
let runJson = null;

async function init() {
  importScripts(INDEX_URL + "pyodide.js");
  pyodide = await loadPyodide({ indexURL: INDEX_URL });
  const harness = await (await fetch(new URL("../../py/harness.py", self.location))).text();
  pyodide.FS.writeFile(HOME + "/boucle_harness.py", harness);
  pyodide.runPython(
    "import os, sys, json\n" +
    "sys.path.insert(0, '" + HOME + "')\n" +
    "os.chdir('" + HOME + "')\n" +
    "import boucle_harness\n" +
    "def __boucle_run(code, stdin):\n" +
    "    return json.dumps(boucle_harness.run(code, stdin))\n"
  );
  runJson = pyodide.globals.get("__boucle_run");
}
const ready = init();

async function loadPackages(id, code) {
  try {
    await pyodide.loadPackagesFromImports(code, {
      messageCallback: (msg) => self.postMessage({ id, status: msg }),
      errorCallback: () => {}
    });
  } catch (e) {
    /* Paquet introuvable : l'import échouera proprement avec un ModuleNotFoundError lisible. */
  }
}

function writeFiles(files) {
  const names = Object.keys(files || {});
  if (!names.length) return;
  try { pyodide.FS.mkdir(HOME + "/data"); } catch (e) { /* existe déjà */ }
  for (const name of names) pyodide.FS.writeFile(HOME + "/data/" + name, files[name]);
}

self.onmessage = async (event) => {
  const { id, type, code, stdin, files } = event.data;
  try {
    await ready;
  } catch (e) {
    self.postMessage({ id, fatal: "Impossible de charger Python : " + (e && e.message ? e.message : e) });
    return;
  }
  await loadPackages(id, code || "");
  if (type === "preload") { self.postMessage({ id, preloaded: true }); return; }
  writeFiles(files);
  self.postMessage({ id, phase: "running" });
  const result = JSON.parse(runJson(code, stdin || ""));
  self.postMessage(Object.assign({ id }, result));
};
