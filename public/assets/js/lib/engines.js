/* Moteurs d'exécution.
   - Python : Pyodide dans un Web Worker (vrai CPython, numpy/pandas/scikit-learn/matplotlib chargés à la demande).
   - C++   : JSCPP, interpréteur pédagogique exécuté pas à pas (on peut l'arrêter en cas de boucle infinie).
   - C     : minic (assets/py/minic.py), interpréteur C écrit en Python sur pycparser, exécuté par Pyodide. */

import { sqlRunProgram } from "./sql.js";

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
/* JSCPP tourne dans un Web Worker (workers/cpp-worker.js, AUDIT #22) : l'interface reste fluide, et la page n'a
   pas à autoriser eval() dans sa Content-Security-Policy (JSCPP en a besoin). Le worker coupe lui-même un
   programme trop long ; s'il ne répond plus du tout, on l'arrête et on en démarre un neuf. */
let cppWorker = null, cppSeq = 0, cppCharge = false;
const cppJobs = new Map();

function demarrerCpp() {
  cppWorker = new Worker(new URL("../workers/cpp-worker.js", import.meta.url));
  cppWorker.onmessage = (e) => {
    const m = e.data; const job = cppJobs.get(m.id);
    if (!job) return;
    if (m.statut) { cppCharge = true; job.onStatus && job.onStatus(m.statut); return; }
    clearTimeout(job.garde); cppJobs.delete(m.id);
    job.resolve({ out: m.out || "", err: m.err || null, figs: [] });
  };
  cppWorker.onerror = (e) => {
    e.preventDefault();
    for (const [, job] of cppJobs) { clearTimeout(job.garde); job.resolve({ out: "", err: e.message || "Erreur de l'interpréteur C++", figs: [] }); }
    cppJobs.clear(); cppWorker.terminate(); cppWorker = null;
  };
}

export function runCpp(code, stdin, onStatus) {
  if (!cppWorker) demarrerCpp();
  if (!cppCharge) onStatus && onStatus("Chargement de l'interpréteur C++…");
  return new Promise((resolve) => {
    const id = ++cppSeq;
    const garde = setTimeout(() => {
      cppJobs.delete(id);
      if (cppWorker) { cppWorker.terminate(); cppWorker = null; cppCharge = false; }
      resolve({ out: "", err: "TimeLimit", figs: [] });
    }, CPP_TIMEOUT_MS + 15000);
    cppJobs.set(id, { resolve, onStatus, garde });
    cppWorker.postMessage({ id, code, stdin: stdin || "", limiteMs: CPP_TIMEOUT_MS, maxOut: MAX_OUT });
  });
}

/** SQL : la requête tourne dans SQLite (module sqlite3 de Python) sur une base neuve créée par le script db. */
export const runSql = (db, code, onStatus) => runPy(sqlRunProgram(db, code), "", onStatus);
/** C : le programme est interprété par minic dans le worker Python (même chemin qu'en CI : scripts/validate.mjs). */
export const cProgram = (code) => "import pycparser\nimport minic\nminic.executer(" + JSON.stringify(code) + ")\n";
export const runC = (code, onStatus) => runPy(cProgram(code), "", onStatus);
/* Pour SQL, le troisième argument est le script de création de la base. */
export const run = (lang, code, stdin, onStatus) => (lang === "py" ? runPy(code, stdin, onStatus) : lang === "sql" ? runSql(stdin, code, onStatus) : lang === "c" ? runC(code, onStatus) : runCpp(code, stdin, onStatus));
export const isPyReady = () => pyReady;
