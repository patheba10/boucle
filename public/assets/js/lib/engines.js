/* Moteurs d'exécution.
   - Python : Pyodide dans un Web Worker (vrai CPython, numpy/pandas/scikit-learn/matplotlib chargés à la demande).
   - C++   : JSCPP, interpréteur pédagogique exécuté pas à pas (on peut l'arrêter en cas de boucle infinie). */

const PY_TIMEOUT_MS = 20000; // assez pour importer scikit-learn et entraîner un petit modèle en WebAssembly
const CPP_TIMEOUT_MS = 6000;
const MAX_OUT = 60000;

/* ---------- Python ---------- */
let worker = null;
let pyReady = false;
let seq = 0;
const pending = new Map();

function startWorker() {
  worker = new Worker(new URL("../workers/python-worker.js", import.meta.url));
  worker.onmessage = (e) => {
    const msg = e.data;
    const job = pending.get(msg.id);
    if (!job) return;
    if (msg.status) { job.onStatus && job.onStatus(statusText(msg.status)); return; }
    if (msg.preloaded) { pyReady = true; pending.delete(msg.id); job.resolve(); return; }
    if (msg.phase === "running") {
      pyReady = true;
      job.onStatus && job.onStatus("Exécution…");
      job.timer = setTimeout(() => {
        pending.delete(msg.id);
        worker.terminate(); worker = null; pyReady = false;
        rejectAll("Python a été redémarré.");
        job.resolve({ out: "", err: "TimeLimit" });
      }, PY_TIMEOUT_MS);
      return;
    }
    clearTimeout(job.timer);
    pending.delete(msg.id);
    if (msg.fatal) { worker.terminate(); worker = null; job.reject(new Error(msg.fatal)); return; }
    job.resolve({ out: msg.out || "", err: msg.err || null, line: msg.line || null, figs: msg.figs || [] });
  };
  worker.onerror = (e) => {
    for (const [, job] of pending) { clearTimeout(job.timer); job.reject(new Error(e.message || "Erreur du worker Python")); }
    pending.clear();
    worker && worker.terminate(); worker = null; pyReady = false;
  };
}
function rejectAll(reason) {
  for (const [, job] of pending) { clearTimeout(job.timer); job.resolve({ out: "", err: reason }); }
  pending.clear();
}
function statusText(s) {
  const m = /Loading (.+)/.exec(s);
  if (m) return "Chargement de " + m[1].replace(/,\s*/g, ", ") + "…";
  if (/Loaded/.test(s)) return "Paquets chargés.";
  return s;
}

/* Jeux de données : tout chemin "data/<fichier>" cité dans le code est servi depuis public/datasets/
   et copié dans le système de fichiers de Pyodide avant l'exécution (même convention qu'en CI). */
const DATA_RX = /["']data\/([\w.-]+\.(?:csv|json|txt|tsv))["']/g;
const fileCache = new Map();
async function datasetsFor(code) {
  const files = {};
  for (const m of code.matchAll(DATA_RX)) {
    const name = m[1];
    if (!fileCache.has(name)) {
      fileCache.set(name, fetch(new URL("../../../datasets/" + name, import.meta.url)).then((r) => {
        if (!r.ok) throw new Error("Jeu de données introuvable : data/" + name);
        return r.text();
      }).catch((e) => { fileCache.delete(name); throw e; }));
    }
    files[name] = await fileCache.get(name);
  }
  return files;
}

export async function runPy(code, stdin, onStatus) {
  if (!worker) startWorker();
  let files = {};
  try { files = await datasetsFor(code); } catch (e) { return { out: "", err: "FileNotFoundError: " + e.message, figs: [] }; }
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onStatus, timer: null });
    worker.postMessage({ id, type: "run", code, stdin: stdin || "", files });
  });
}

/** Démarre Python en arrière-plan et charge les paquets que `code` importe, sans rien exécuter. */
export function preloadPy(code) {
  if (!worker) startWorker();
  const id = ++seq;
  pending.set(id, { resolve: () => {}, reject: () => {}, onStatus: null, timer: null, preload: true });
  worker.postMessage({ id, type: "preload", code: code || "" });
}

/* ---------- C++ ---------- */
const CPP_LIBS = ["https://cdn.jsdelivr.net/npm/JSCPP@2.0.6/dist/JSCPP.es5.min.js", "https://unpkg.com/JSCPP@2.0.6/dist/JSCPP.es5.min.js"];
let cppP = null;
function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src; s.onload = res; s.onerror = () => rej(new Error("Échec du chargement : " + src));
    document.head.appendChild(s);
  });
}
function cppEngine() {
  if (!cppP) cppP = (async () => {
    let err;
    for (const u of CPP_LIBS) { try { await loadScript(u); return; } catch (e) { err = e; } }
    throw err;
  })().catch((e) => { cppP = null; throw e; });
  return cppP;
}

export async function runCpp(code, stdin, onStatus) {
  if (!window.JSCPP) onStatus && onStatus("Chargement de l'interpréteur C++…");
  await cppEngine();
  onStatus && onStatus("Exécution…");
  let out = "";
  try {
    const dbg = window.JSCPP.run(code, stdin || "", { debug: true, stdio: { write: (s) => { if (out.length < MAX_OUT) out += s; } } });
    const t0 = performance.now();
    for (;;) {
      for (let i = 0; i < 2500; i++) {
        const r = dbg.next();
        if (r !== false) return { out, figs: [] };
      }
      if (performance.now() - t0 > CPP_TIMEOUT_MS) return { out, err: "TimeLimit", figs: [] };
      await new Promise((r) => setTimeout(r, 0));
    }
  } catch (e) {
    return { out, err: String((e && e.message) || e), figs: [] };
  }
}

export const run = (lang, code, stdin, onStatus) => (lang === "py" ? runPy(code, stdin, onStatus) : runCpp(code, stdin, onStatus));
export const isPyReady = () => pyReady;
