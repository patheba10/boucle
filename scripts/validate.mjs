/* Valide tout le contenu pédagogique. Lancé en local (npm run validate) et en CI.
   Pour chaque leçon :
   - structure (ids uniques, quiz cohérents, liens internes des roadmaps) ;
   - les extraits de théorie s'exécutent sans erreur ;
   - la solution du défi passe tous les tests, le code de départ échoue.
   Python : CPython + le harnais du navigateur (public/assets/py/harness.py).
   C++    : g++ (vrai compilateur) ET JSCPP (l'interpréteur du navigateur).
   Git    : simulateur du navigateur (lib/gitsim.js).
   YAML   : moteur des workflows du navigateur (lib/workflow.js). */
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import vm from "node:vm";
import { COURSES, ROADMAPS, INSTALL, CERTS } from "../public/content/index.js";
import { lintCert, buildExam, grade } from "../public/assets/js/lib/exam.js";
import { sqlRunProgram, sqlCheckProgram, parseSqlCheck } from "../public/assets/js/lib/sql.js";
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

/* ---------- Structure ---------- */
const ids = new Set();
const routes = new Set(["home", "roadmaps", "atelier", "installer"]);
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
    if (lang !== "py" && lang !== "cpp") continue; // terminal, powershell… : non exécutés
    if (/norun/.test(opts)) continue;
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
