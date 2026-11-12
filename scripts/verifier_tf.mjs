/* Vérifie avec le vrai TensorFlow tout le code Keras du site (défis et extraits de théorie).
   Dans le navigateur, « keras » est minikeras (public/assets/py/minikeras.py) ; ce script garantit que le même code,
   et les mêmes résultats attendus, valent aussi avec Keras 3 sur TensorFlow.
   Usage : PYTHON=/chemin/vers/python-avec-tensorflow node scripts/verifier_tf.mjs */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { COURSES } from "../public/content/index.js";

const PY = process.env.PYTHON || "python3";
const RUNNER = fileURLToPath(new URL("./run_py.py", import.meta.url));
const MARK = "<<<BOUCLE-TESTS>>>";
const usesKeras = (s) => /\b(keras|tensorflow)\b/.test(s || "");
const run = (code) => JSON.parse(spawnSync(PY, [RUNNER], { input: JSON.stringify({ code, stdin: "" }), encoding: "utf8", maxBuffer: 1 << 26, env: { ...process.env, TF_CPP_MIN_LOG_LEVEL: "3" } }).stdout);

const probe = run("import tensorflow as tf\nprint(tf.__version__)");
if (probe.err || /Boucle/.test(probe.out)) { console.error("Le vrai TensorFlow est introuvable pour " + PY + " : " + (probe.err || probe.out)); process.exit(2); }
console.log("TensorFlow " + probe.out.trim());

let n = 0, ko = 0;
const fail = (id, msg) => { ko++; console.log("✗ " + id + " — " + msg); };
for (const c of COURSES) for (const l of c.lessons) {
  for (const [, lang, opts, code] of (l.theory || "").matchAll(/~~~(\w+)([^\n]*)\n([\s\S]*?)\n~~~/g)) {
    if (lang !== "py" || /norun/.test(opts) || !(usesKeras(code) || /\btf\b/.test(opts))) continue;
    n++; const r = run(code); r.err ? fail(l.id, "extrait de théorie : " + r.err) : process.stdout.write(".");
  }
  const ch = l.challenge;
  if (!ch || !usesKeras(ch.solution)) continue;
  n++;
  const r = run(ch.solution + "\nprint(" + JSON.stringify(MARK) + ")\n" + (ch.tests || ""));
  const got = r.out.split(MARK + "\n")[1] ?? "";
  if (r.err) fail(l.id, "la solution échoue : " + r.err);
  else if (ch.expected !== undefined && got !== ch.expected) fail(l.id, "sortie différente avec TensorFlow :\n" + got);
  else process.stdout.write(".");
}
console.log("\n" + n + " vérifications avec TensorFlow, " + ko + " problème(s).");
process.exit(ko ? 1 : 0);
