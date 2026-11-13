/* Valide tout le contenu pédagogique. Lancé en local (npm run validate) et en CI.
   Pour chaque leçon :
   - structure (ids uniques, quiz cohérents, liens internes des roadmaps) ;
   - les extraits de théorie s'exécutent sans erreur ;
   - la solution du défi passe tous les tests, le code de départ échoue.
   Python : CPython + le harnais du navigateur (public/assets/py/harness.py).
   C++    : g++ (vrai compilateur) ET JSCPP (l'interpréteur du navigateur).
   C      : gcc (vrai compilateur, avec mcu.h) ET minic (l'interpréteur du navigateur) : mêmes sorties exigées.
   Git    : simulateur du navigateur (lib/gitsim.js).
   YAML   : moteur des workflows du navigateur (lib/workflow.js). */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import vm from "node:vm";
import { COURSES, ROADMAPS, INSTALL, CERTS, PROJETS, GROUPES, EXERCICES_IDS } from "../public/content/index.js";
import { lintCert, buildExam, grade } from "../public/assets/js/lib/exam.js";
import { sqlRunProgram, sqlCheckProgram, parseSqlCheck } from "../public/assets/js/lib/sql.js";
import { cProgram } from "../public/assets/js/lib/engines.js";
import { trous, codeComplet, codeOrdre, verifierOrdre, melange } from "../public/assets/js/lib/exercices.js";
import { NIVEAUX, LANGS_DEFIS } from "../public/assets/js/lib/defis.js";
import { runScript, evaluate as evaluateGit } from "../public/assets/js/lib/gitsim.js";
import { lint as lintWorkflow, evaluate as evaluateWorkflow } from "../public/assets/js/lib/workflow.js";
import { createShell, evaluate as evaluateShell } from "../public/assets/js/lib/shell/shell.js";
import { splitCommands, runScriptTests } from "../public/assets/js/lib/shterm.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const MARK = "<<<BOUCLE-TESTS>>>";
const norm = (s) => String(s).replace(/\r/g, "").split("\n").map((l) => l.replace(/\s+$/, "")).join("\n").replace(/\n+$/, "");
const only = process.argv[2] || null; // ex. : node scripts/validate.mjs py-04

let problems = 0, checks = 0;
const fail = (where, msg) => { problems++; console.error("✗ " + where + " — " + msg); };
const ok = () => { checks++; };

/* ---------- Python ---------- */
function runPy(code, stdin = "") {
  const r = spawnSync("python3", [join(ROOT, "scripts/run_py.py")], { input: JSON.stringify({ code, stdin }), encoding: "utf8", timeout: 60000 });
  if (r.status !== 0) return { out: "", err: "runner: " + (r.stderr || r.error) };
  return JSON.parse(r.stdout);
}
function pyCheck(ch, code) {
  if (ch.tests) {
    const r = runPy(code + "\nprint(" + JSON.stringify(MARK) + ")\n" + ch.tests);
    const parts = r.out.split(MARK + "\n");
    const got = parts.length > 1 ? parts[1] : "";
    return { pass: !r.err && norm(got) === norm(ch.expected), got, err: r.err };
  }
  const r = runPy(code);
  return { pass: !r.err && norm(r.out) === norm(ch.expected), got: r.out, err: r.err };
}

/* ---------- C ---------- */
const MCU_DIR = join(ROOT, "public/assets/py");
const gccCache = new Map();
function runGcc(code, strict = true) {
  const cle = (strict ? "S" : "W") + code;
  if (!gccCache.has(cle)) {
    const src = join(tmp, "c" + gccCache.size + ".c"), bin = src.replace(/\.c$/, "");
    writeFileSync(src, code);
    // -fwrapv : le dépassement signé boucle, comme dans minic ; -Werror : le code du cours doit compiler proprement.
    const r = spawnSync("gcc", ["-std=c11", "-O0", "-fwrapv", "-Wall", "-Wextra", ...(strict ? ["-Werror"] : []), "-Wno-unused-parameter", "-I", MCU_DIR, src, "-o", bin, "-lm"], { encoding: "utf8" });
    gccCache.set(cle, r.status === 0 ? { bin } : { err: r.stderr.split("\n").filter(Boolean).slice(0, 3).join(" ") });
  }
  const c = gccCache.get(cle);
  if (c.err) return { out: "", err: "compilation : " + c.err };
  const r = spawnSync(c.bin, [], { encoding: "utf8", timeout: 5000 });
  return { out: r.stdout || "", err: r.status === 0 ? null : "exit " + r.status + (r.signal ? " " + r.signal : "") };
}
const runMinic = (code) => runPy(cProgram(code));
function cCheck(ch, code, runner) {
  const r = runner(code + "\n" + ch.tests);
  return { pass: !r.err && norm(r.out) === norm(ch.expected), got: r.out, err: r.err };
}

/* ---------- C++ ---------- */
const tmp = mkdtempSync(join(tmpdir(), "boucle-"));
const gppCache = new Map();
function compile(code) {
  if (gppCache.has(code)) return gppCache.get(code);
  const src = join(tmp, "p" + gppCache.size + ".cpp"), bin = src.replace(/\.cpp$/, "");
  writeFileSync(src, code);
  const r = spawnSync("g++", ["-std=c++17", "-Wall", "-O0", src, "-o", bin], { encoding: "utf8" });
  const res = r.status === 0 ? { bin } : { err: r.stderr.split("\n").slice(0, 4).join(" ") };
  gppCache.set(code, res);
  return res;
}
function runGpp(code, input) {
  const c = compile(code);
  if (c.err) return { out: "", err: "compilation : " + c.err };
  const r = spawnSync(c.bin, [], { input, encoding: "utf8", timeout: 5000 });
  return { out: r.stdout || "", err: r.status === 0 ? null : "exit " + r.status + (r.signal ? " " + r.signal : "") };
}
const ctx = { console, Date };
ctx.window = ctx; ctx.self = ctx;
vm.createContext(ctx);
vm.runInContext(readFileSync(require.resolve("JSCPP/dist/JSCPP.es5.min.js"), "utf8"), ctx);
function runJscpp(code, input) {
  let out = "";
  try {
    const dbg = ctx.JSCPP.run(code, input, { debug: true, stdio: { write: (s) => { out += s; } } });
    for (let i = 0; i < 2_000_000; i++) if (dbg.next() !== false) return { out };
    return { out, err: "trop d'étapes" };
  } catch (e) { return { out, err: String(e.message || e).split("\n")[0] }; }
}
function cppCheck(ch, code, runner) {
  for (const t of ch.tests) {
    const r = runner(code, t.input);
    if (r.err || norm(r.out) !== norm(t.expected)) return { pass: false, got: r.out, err: r.err, input: t.input };
  }
  return { pass: true };
}

/* ---------- Exercices courts (lib/exercices.js) ---------- */
// Chaque code est exécuté : en Python, et en C avec gcc et l'interpréteur du navigateur (sorties identiques exigées).
function executer(lang, code) {
  if (lang === "py") return runPy(code);
  const g = runGcc(code), m = runMinic(code);
  if (g.err) return { out: "", err: "gcc : " + g.err };
  if (m.err) return { out: "", err: "navigateur : " + m.err };
  if (norm(g.out) !== norm(m.out)) return { out: "", err: "sorties différentes entre gcc et le navigateur" };
  return g;
}
function verifierExercices(c, l) {
  (l.exercices || []).forEach((ex, i) => {
    const ou = l.id + " exercice " + (i + 1), lang = ex.lang || l.lang || c.lang;
    if (!["sortie", "trous", "ordre"].includes(ex.type)) return fail(ou, "type inconnu : " + ex.type);
    if (!ex.explain) return fail(ou, "explication manquante");
    if (lang !== "py" && lang !== "c") return fail(ou, "langage non exécutable : " + lang);
    let code;
    if (ex.type === "sortie") {
      if (!ex.code || ex.reponse == null) return fail(ou, "code ou réponse manquant");
      code = ex.code;
    } else if (ex.type === "trous") {
      if ((ex.code.match(/⟦/g) || []).length !== (ex.code.match(/⟧/g) || []).length) return fail(ou, "trou mal fermé (⟦ … ⟧)");
      const t = trous(ex.code || "");
      if (!t.length || t.some((r) => r.some((x) => !x))) return fail(ou, "aucun trou, ou réponse vide");
      code = codeComplet(ex.code);
    } else {
      if (!Array.isArray(ex.lignes) || ex.lignes.length < 3) return fail(ou, "il faut au moins 3 lignes");
      if (verifierOrdre(ex, melange(ex.lignes.length, l.id + "/" + i))) return fail(ou, "le mélange donne déjà le bon ordre");
      code = codeOrdre(ex);
    }
    const r = executer(lang, code);
    if (r.err) return fail(ou, "le code ne s'exécute pas : " + r.err);
    const attendu = ex.type === "sortie" ? ex.reponse : ex.attendu;
    if (attendu != null && norm(r.out) !== norm(attendu)) return fail(ou, "sortie " + JSON.stringify(r.out.slice(0, 200)) + " au lieu de " + JSON.stringify(attendu));
    ok();
  });
}

/* ---------- Défis gradués (lib/defis.js) ---------- */
// Même exigence que le défi principal : la solution passe, le code de départ échoue.
function verifierDefisGradues(c, l) {
  const defis = l.defis || [], lang = l.lang || c.lang, vus = new Set();
  if (defis.length && !l.challenge) return fail(l.id, "défis gradués sans défi principal");
  for (const d of defis) {
    const ou = l.id + " défi " + d.niveau;
    if (!NIVEAUX[d.niveau]) { fail(l.id, "niveau de défi inconnu : " + d.niveau); continue; }
    if (vus.has(d.niveau)) { fail(ou, "un seul défi par niveau"); continue; }
    vus.add(d.niveau);
    if (!LANGS_DEFIS.includes(lang)) { fail(ou, "langage sans défis gradués : " + lang); continue; }
    const manque = ["prompt", "starter", "solution", ...(lang === "sql" ? [] : ["expected"])].filter((k) => d[k] == null).concat(d.hint || (d.hints || []).length ? [] : ["hint"]);
    if (manque.length) { fail(ou, "champ manquant : " + manque.join(", ")); continue; }
    if (lang === "py") {
      const s = pyCheck(d, d.solution); s.pass ? ok() : fail(ou, "la solution échoue : " + (s.err || JSON.stringify(s.got)));
      pyCheck(d, d.starter).pass ? fail(ou, "le code de départ passe déjà les tests") : ok();
    } else if (lang === "c") {
      for (const [name, runner] of [["gcc", runGcc], ["navigateur", runMinic]]) { const s = cCheck(d, d.solution, runner); s.pass ? ok() : fail(ou, "solution (" + name + ") échoue : " + (s.err || JSON.stringify(s.got))); }
      cCheck(d, d.starter, runMinic).pass ? fail(ou, "le code de départ passe déjà les tests") : ok();
    } else if (lang === "cpp") {
      for (const [name, runner] of [["g++", runGpp], ["navigateur", runJscpp]]) { const s = cppCheck(d, d.solution, runner); s.pass ? ok() : fail(ou, "solution (" + name + ") échoue : " + (s.err || JSON.stringify(s.got))); }
      cppCheck(d, d.starter, runJscpp).pass ? fail(ou, "le code de départ passe déjà les tests") : ok();
    } else {
      const db = d.db || l.db || c.db || "";
      const sol = runPy(sqlCheckProgram(d, db, d.solution)); const vs = parseSqlCheck(sol.out).verdict;
      sol.err || !vs || !vs.ok ? fail(ou, "la solution SQL échoue : " + (sol.err || (vs ? vs.note : sol.out.slice(-200)))) : ok();
      const st = runPy(sqlCheckProgram(d, db, d.starter)); const vt = parseSqlCheck(st.out).verdict;
      !st.err && vt && vt.ok ? fail(ou, "le code de départ SQL passe déjà") : ok();
    }
  }
}

/* ---------- Structure ---------- */
const ids = new Set();
const routes = new Set(["home", "roadmaps", "atelier", "installer", "projets", "certifs", "cours", "revision"]);
for (const c of COURSES) {
  if (!c.route || !c.badge) fail(c.id, "cours sans route ou badge");
  if (routes.has(c.route)) fail(c.id, "route en double : " + c.route);
  routes.add(c.route);
}
for (const c of COURSES) for (const l of c.lessons) {
  if (ids.has(l.id)) fail(l.id, "id de leçon en double");
  ids.add(l.id);
  if (!l.title || !l.theory || !l.xp) fail(l.id, "champ title/theory/xp manquant");
  (l.quiz || []).forEach((q, i) => {
    if (!(q.answer >= 0 && q.answer < q.options.length)) fail(l.id, "quiz " + i + " : réponse hors des options");
    if (!q.explain) fail(l.id, "quiz " + i + " : explication manquante");
  });
  if (!l.challenge && !l.theoryOnly) fail(l.id, "ni défi ni theoryOnly");
  const lang = l.lang || c.lang;
  if (l.challenge && lang === "git") for (const k of ["prompt", "setup", "checks", "solution", "hint"]) if (!l.challenge[k]) fail(l.id, "défi Git sans " + k);
  if (l.challenge && lang === "sh") for (const k of (l.challenge.kind === "script" ? ["prompt", "starter", "solution", "tests", "hint"] : ["prompt", "checks", "solution", "hint"])) if (!l.challenge[k]) fail(l.id, "défi Linux sans " + k);
  if (l.challenge && lang === "yaml") for (const k of ["prompt", "starter", "checks", "solution", "hint"]) if (l.challenge[k] == null) fail(l.id, "défi YAML sans " + k);
  if (l.practice && (!l.practice.title || !l.practice.body)) fail(l.id, "pratique sans titre ou sans contenu");
}
for (const r of ROADMAPS) for (const s of r.stages) for (const n of s.nodes) {
  if (ids.has(n.id)) fail(n.id, "id en double");
  ids.add(n.id);
  for (const lid of n.lessons || []) if (!COURSES.some((c) => c.lessons.some((l) => l.id === lid))) fail(n.id, "leçon liée introuvable : " + lid);
  for (const [, url] of n.links) if (!/^https:\/\//.test(url)) fail(n.id, "lien non https : " + url);
}
for (const p of PROJETS) {
  if (ids.has(p.id) || routes.has(p.id)) fail(p.id, "id de projet en double ou déjà utilisé comme route");
  ids.add(p.id);
  if (!ROADMAPS.some((r) => r.id === p.roadmap)) fail(p.id, "roadmap inconnue : " + p.roadmap);
  for (const k of ["titre", "niveau", "duree", "resume", "contexte", "architecture"]) if (!p[k]) fail(p.id, "projet sans " + k);
  for (const k of ["technos", "exigences", "jalons", "criteres", "extensions", "lecons", "liens"]) if (!Array.isArray(p[k]) || !p[k].length) fail(p.id, "projet : liste « " + k + " » vide");
  const jal = new Set();
  for (const j of p.jalons || []) { if (jal.has(j.id)) fail(p.id, "jalon en double : " + j.id); jal.add(j.id); if (!j.titre || !(j.livrables || []).length) fail(p.id, "jalon incomplet : " + j.id); }
  for (const lid of p.lecons || []) if (!COURSES.some((c) => c.lessons.some((l) => l.id === lid))) fail(p.id, "leçon liée introuvable : " + lid);
  for (const [, url] of p.liens || []) if (!/^https:\/\//.test(url)) fail(p.id, "lien non https : " + url);
  if (JSON.stringify(p).includes("`")) fail(p.id, "accent grave dans le texte : écrire le code entre @@ @@");
  ok();
}
for (const c of COURSES) { const n = GROUPES.filter((g) => g.cours.includes(c.id)).length; if (n !== 1) fail(c.id, "cours présent dans " + n + " groupe(s) de la page Cours (il en faut exactement 1)"); }
for (const g of GROUPES) for (const id of g.cours) if (!COURSES.some((c) => c.id === id)) fail("groupes", "cours inconnu : " + id);
for (const id of EXERCICES_IDS) if (!ids.has(id)) fail("exercices", "leçon inconnue : " + id);
for (const sec of INSTALL.sections) if (!sec.id || !sec.title || !sec.body) fail("installer", "section incomplète");
ok();

/* ---------- Certifications : banques de questions ---------- */
for (const c of CERTS) {
  const errs = lintCert(c); errs.length ? errs.forEach((e) => fail("cert-" + c.id, e)) : ok();
  // un examen complet doit pouvoir être tiré, et tout juste donner 1000
  const ex = buildExam(c, { seed: 42 }); ex.items.length === c.count ? ok() : fail("cert-" + c.id, "examen complet de " + ex.items.length + " questions au lieu de " + c.count);
  const all = Object.fromEntries(c.bank.map((q) => [q.id, q.answer])); grade(c, ex, all).score === 1000 ? ok() : fail("cert-" + c.id, "un examen parfait ne donne pas 1000");
}

/* ---------- Exécution ---------- */
for (const c of COURSES) for (const l of c.lessons) {
  if (only && l.id !== only) continue;
  for (const b of l.theory.matchAll(/~~~(\w+)([^\n]*)\n([\s\S]*?)\n~~~/g)) {
    const [, lang, opts, code] = b;
    if (lang === "git") {
      const lines = code.split("\n").filter((x) => x.trim() && !x.trim().startsWith("#"));
      const { transcript } = runScript([], lines.map((x) => x.replace(/^!\s*/, "")));
      transcript.forEach((t, k) => { const attendu = !lines[k].startsWith("!"); t.ok === attendu ? ok() : fail(l.id, "extrait Git : « " + t.cmd + " » " + (attendu ? "échoue : " + t.out.split("\n")[0] : "devait échouer")); });
      continue;
    }
    if (lang === "sh") {
      if (/norun/.test(opts)) continue;
      const sh = createShell(l.snippetSetup || c.snippetSetup || {});
      for (const raw of splitCommands(code)) {
        const attendu = !raw.startsWith("!"); const r = sh.run(raw.replace(/^!\s*/, ""));
        (r.code === 0) === attendu ? ok() : fail(l.id, "extrait Linux : « " + raw.split("\n")[0] + " » " + (attendu ? "échoue : " + (r.err || r.out).split("\n")[0] : "devait échouer"));
      }
      continue;
    }
    if (lang === "yaml") {
      if (/norun/.test(opts)) continue;
      const { doc, issues } = lintWorkflow(code);
      const voulu = /erreurs/.test(opts); // extrait volontairement faux (exercice de diagnostic)
      if (voulu) issues.length ? ok() : fail(l.id, "extrait YAML marqué « erreurs » mais aucun problème détecté");
      else if (!doc || issues.length) fail(l.id, "extrait YAML : " + (issues[0] ? "ligne " + issues[0].line + " : " + issues[0].msg : "illisible"));
      else ok();
      continue;
    }
    if (lang === "sql") {
      if (/norun/.test(opts)) continue;
      const r = runPy(sqlRunProgram(l.db || c.db || "", code)); const voulu = /erreur/.test(opts);
      voulu ? (r.err ? ok() : fail(l.id, "extrait SQL marqué « erreur » mais accepté")) : r.err ? fail(l.id, "extrait SQL : " + r.err) : ok();
      continue;
    }
    if (lang === "c") {
      if (/norun/.test(opts)) continue;
      // option avertissement : extrait qui montre volontairement un piège signalé par gcc -Wall -Wextra
      const g = runGcc(code, !/avertissement/.test(opts)), m = runMinic(code);
      if (g.err) fail(l.id, "extrait C (gcc) : " + g.err);
      else if (m.err) fail(l.id, "extrait C (navigateur) : " + m.err);
      else if (norm(g.out) !== norm(m.out)) fail(l.id, "extrait C : sorties différentes entre gcc et le navigateur : " + JSON.stringify(g.out.slice(0, 200)) + " / " + JSON.stringify(m.out.slice(0, 200)));
      else ok();
      continue;
    }
    if (lang !== "py" && lang !== "cpp") continue; // terminal, powershell… : non exécutés
    if (/norun|\btf\b/.test(opts)) continue; // tf : vérifié par scripts/verifier_tf.mjs
    const stdin = ((/stdin:(.*)$/.exec(opts) || [])[1] || "").trim();
    if (lang === "py") {
      const r = runPy(code, stdin);
      r.err ? fail(l.id, "extrait de théorie Python : " + r.err) : ok();
    } else {
      const g = runGpp(code, stdin);
      g.err ? fail(l.id, "extrait C++ (g++) : " + g.err) : ok();
      if (!/norun/.test(opts)) { const j = runJscpp(code, stdin); j.err ? fail(l.id, "extrait C++ (navigateur) : " + j.err) : ok(); }
    }
  }
  verifierExercices(c, l);
  verifierDefisGradues(c, l);
  const ch = l.challenge;
  if (!ch) continue;
  const clang = l.lang || c.lang;
  if (clang === "sh") {
    try {
      if (ch.kind === "script") {
        const sol = runScriptTests(ch, ch.solution).filter((r) => !r.ok);
        sol.length ? fail(l.id, "la solution échoue : " + sol[0].label + " (" + sol[0].detail + ") → " + JSON.stringify((sol[0].got.out + sol[0].got.err).slice(0, 200))) : ok();
        runScriptTests(ch, ch.starter).every((r) => r.ok) ? fail(l.id, "le code de départ passe déjà les tests") : ok();
      } else {
        const sh = createShell(ch.setup || {});
        for (const c of ch.solution) { const r = sh.run(c); if (r.code !== 0 && !(ch.allowFail || []).includes(c)) fail(l.id, "solution : « " + c + " » échoue : " + (r.err || r.out).split("\n")[0]); }
        const fin = evaluateShell(sh, ch.checks).filter((r) => !r.ok);
        fin.length ? fail(l.id, "la solution ne remplit pas : " + fin.map((r) => r.label).join(" ; ")) : ok();
        evaluateShell(createShell(ch.setup || {}), ch.checks).every((r) => r.ok) ? fail(l.id, "l'état de départ remplit déjà tous les critères") : ok();
      }
    } catch (e) { fail(l.id, String(e.message || e)); }
    process.stdout.write(".");
    continue;
  }
  if (clang === "yaml") {
    try {
      const fin = evaluateWorkflow(ch.solution, ch.checks).filter((r) => !r.ok);
      fin.length ? fail(l.id, "la solution ne remplit pas : " + fin.map((r) => r.label).join(" ; ")) : ok();
      const w = lintWorkflow(ch.solution).issues.filter((i) => i.level === "warn");
      w.length ? fail(l.id, "la solution déclenche un avertissement : ligne " + w[0].line + " : " + w[0].msg) : ok();
      evaluateWorkflow(ch.starter, ch.checks).every((r) => r.ok) ? fail(l.id, "le code de départ remplit déjà tous les critères") : ok();
    } catch (e) { fail(l.id, String(e.message || e)); }
    process.stdout.write(".");
    continue;
  }
  if (clang === "git") {
    try {
      const fin = evaluateGit(runScript(ch.setup, ch.solution).sim, ch.checks).filter((r) => !r.ok);
      fin.length ? fail(l.id, "la solution ne remplit pas : " + fin.map((r) => r.label).join(" ; ")) : ok();
      evaluateGit(runScript(ch.setup, []).sim, ch.checks).every((r) => r.ok) ? fail(l.id, "l'état de départ remplit déjà tous les critères") : ok();
    } catch (e) { fail(l.id, String(e.message || e)); }
    process.stdout.write(".");
    continue;
  }
  if (clang === "sql") {
    for (const k of ["prompt", "starter", "solution", "hint"]) if (!ch[k]) fail(l.id, "défi SQL sans " + k);
    const db = ch.db || l.db || c.db || "";
    const sol = runPy(sqlCheckProgram(ch, db, ch.solution)); const vs = parseSqlCheck(sol.out).verdict;
    sol.err || !vs ? fail(l.id, "la solution SQL échoue : " + (sol.err || sol.out.slice(-200))) : vs.ok ? ok() : fail(l.id, "la solution SQL ne donne pas le résultat attendu : " + vs.note);
    const st = runPy(sqlCheckProgram(ch, db, ch.starter)); const vt = parseSqlCheck(st.out).verdict;
    !st.err && vt && vt.ok ? fail(l.id, "le code de départ SQL passe déjà") : ok();
    process.stdout.write(".");
    continue;
  }
  if (clang === "c") {
    for (const [name, runner] of [["gcc", runGcc], ["navigateur", runMinic]]) {
      const s = cCheck(ch, ch.solution, runner);
      s.pass ? ok() : fail(l.id, "solution (" + name + ") échoue : " + (s.err || JSON.stringify(s.got)));
    }
    cCheck(ch, ch.starter, runMinic).pass ? fail(l.id, "le code de départ passe déjà les tests") : ok();
    process.stdout.write(".");
    continue;
  }
  if (clang === "py") {
    const s = pyCheck(ch, ch.solution);
    s.pass ? ok() : fail(l.id, "la solution échoue : " + (s.err || JSON.stringify(s.got)));
    pyCheck(ch, ch.starter).pass ? fail(l.id, "le code de départ passe déjà les tests") : ok();
  } else {
    for (const [name, runner] of [["g++", runGpp], ["navigateur", runJscpp]]) {
      const s = cppCheck(ch, ch.solution, runner);
      s.pass ? ok() : fail(l.id, "solution (" + name + ") échoue sur l'entrée " + JSON.stringify(s.input) + " : " + (s.err || JSON.stringify(s.got)));
    }
    cppCheck(ch, ch.starter, runJscpp).pass ? fail(l.id, "le code de départ passe déjà les tests") : ok();
  }
  process.stdout.write(".");
}
rmSync(tmp, { recursive: true, force: true });
console.log("\n" + checks + " vérifications, " + problems + " problème(s).");
process.exit(problems ? 1 : 0);
