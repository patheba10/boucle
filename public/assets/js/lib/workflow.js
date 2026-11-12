/* Moteur des exercices GitHub Actions, sans DOM : le navigateur et la CI
   exécutent le même code.
   - parse()    : lit le YAML (erreurs traduites, avec le numéro de ligne) ;
   - lint()     : erreurs de structure, inspiré d'actionlint ;
   - plan()     : simule un événement (push, pull request…) et dit quels jobs
                  et quelles étapes tournent, dans quel ordre ;
   - evaluate() : critères déclaratifs d'un défi.
   Pas de vrai runner : on raisonne sur le pipeline, comme en revue de code. */
import { load, CORE_SCHEMA } from "../vendor/js-yaml.mjs";

/* ===================== Référentiel ===================== */
const TOP_KEYS = ["name", "run-name", "on", "permissions", "env", "defaults", "concurrency", "jobs"];
const JOB_KEYS = ["name", "needs", "permissions", "runs-on", "environment", "concurrency", "outputs", "env", "defaults", "if", "steps", "timeout-minutes", "strategy", "continue-on-error", "container", "services", "uses", "with", "secrets"];
const STEP_KEYS = ["id", "if", "name", "uses", "run", "shell", "with", "env", "continue-on-error", "timeout-minutes", "working-directory"];
export const EVENTS = ["branch_protection_rule", "check_run", "check_suite", "create", "delete", "deployment", "deployment_status", "discussion", "discussion_comment", "fork", "gollum", "issue_comment", "issues", "label", "merge_group", "milestone", "page_build", "public", "pull_request", "pull_request_review", "pull_request_review_comment", "pull_request_target", "push", "registry_package", "release", "repository_dispatch", "schedule", "status", "watch", "workflow_call", "workflow_dispatch", "workflow_run"];
const FILTERS = {
  push: ["branches", "branches-ignore", "tags", "tags-ignore", "paths", "paths-ignore"],
  pull_request: ["branches", "branches-ignore", "paths", "paths-ignore", "types"],
  pull_request_target: ["branches", "branches-ignore", "paths", "paths-ignore", "types"],
  workflow_dispatch: ["inputs"],
  workflow_call: ["inputs", "outputs", "secrets"],
  workflow_run: ["workflows", "types", "branches", "branches-ignore"],
};
const PERM_SCOPES = ["actions", "attestations", "checks", "contents", "deployments", "discussions", "id-token", "issues", "models", "packages", "pages", "pull-requests", "repository-projects", "security-events", "statuses"];
const PERM_LEVEL = { none: 0, read: 1, write: 2 };
const CONTEXTS = ["github", "env", "vars", "secrets", "matrix", "needs", "steps", "job", "jobs", "runner", "inputs", "strategy"];
const JOB_IF_CONTEXTS = ["github", "needs", "vars", "inputs"];
const RUNNERS = ["ubuntu-latest", "ubuntu-24.04", "ubuntu-22.04", "ubuntu-24.04-arm", "ubuntu-22.04-arm", "windows-latest", "windows-2025", "windows-2022", "windows-11-arm", "macos-latest", "macos-15", "macos-14", "macos-13", "self-hosted"];
/* Valeurs qu'un inconnu peut contrôler (titre de PR, nom de branche…) : jamais directement dans run. */
const UNTRUSTED = /github\.(head_ref|event\.(pull_request\.(title|body|head\.ref|head\.label)|issue\.(title|body)|comment\.body|review\.body|head_commit\.message|commits))/;

/* ===================== Petits outils ===================== */
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const list = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const str = (v) => (v == null ? "" : String(v));
function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
function suggest(word, choices) {
  let best = null, bd = 3;
  for (const c of choices) { const d = lev(str(word).toLowerCase(), c); if (d < bd) { bd = d; best = c; } }
  return best ? " Tu voulais dire « " + best + " » ?" : "";
}
export function actionName(uses) { return str(uses).split("@")[0]; }

/* ===================== Lecture du YAML ===================== */
const YAML_FR = [
  [/tab characters must not be used/, "tabulation dans l'indentation : YAML n'accepte que des espaces"],
  [/duplicated mapping key/, "clé en double au même niveau"],
  [/bad indentation of a (mapping entry|sequence entry)/, "indentation incorrecte : cette ligne n'est pas alignée avec ses voisines"],
  [/end of the stream or a document separator is expected/, "structure inattendue, souvent une indentation décalée ou un « : » manquant"],
  [/multiline key may not be an implicit key/, "il manque probablement « : » après une clé"],
  [/within a (double|single) quoted scalar/, "guillemet ouvert mais jamais fermé"],
  [/missed comma between flow collection entries/, "virgule manquante entre deux éléments d'une liste [ … ]"],
  [/unexpected end of the stream within a flow collection/, "crochet ou accolade jamais fermé"],
  [/incomplete explicit mapping pair/, "« : » mal placé"],
];
export function parse(text) {
  try {
    const doc = load(text, { schema: CORE_SCHEMA });
    return { ok: true, doc: doc == null ? {} : doc };
  } catch (e) {
    const reason = str(e.reason || e.message);
    const fr = (YAML_FR.find(([rx]) => rx.test(reason)) || [null, "YAML invalide (" + reason + ")"])[1];
    return { ok: false, error: { line: e.mark ? e.mark.line + 1 : 1, level: "error", msg: fr } };
  }
}

/** Numéro de ligne (1-based) d'un chemin de clés/indices dans le texte. Approximatif mais suffisant pour guider. */
export function locate(text, path) {
  const lines = text.split("\n");
  const ind = (s) => s.length - s.trimStart().length;
  const blank = (s) => !s.trim() || s.trim().startsWith("#");
  const rxEsc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let start = 0, parent = -1, best = 0, sameLine = false;
  for (const seg of path) {
    let found = -1;
    if (typeof seg === "number") {
      let n = -1, itemInd = null;
      for (let i = start; i < lines.length; i++) {
        if (blank(lines[i])) continue;
        const m = /^(\s*)-(\s|$)/.exec(lines[i]);
        if (!m && ind(lines[i]) <= parent) break;
        if (m && m[1].length <= parent) break;
        if (m && (itemInd === null || m[1].length === itemInd)) { itemInd = m[1].length; if (++n === seg) { found = i; break; } }
      }
      if (found < 0) return best + 1;
      best = found; start = found; parent = itemInd; sameLine = true;
    } else {
      const rx = new RegExp("^\\s*(?:-\\s+)?[\"']?" + rxEsc(seg) + "[\"']?\\s*:(\\s|$)");
      let want = null;
      for (let i = start; i < lines.length; i++) {
        if (blank(lines[i])) continue;
        if (sameLine && i === start) { if (rx.test(lines[i])) { found = i; break; } want = (/^(\s*)-\s+/.exec(lines[i]) || [""])[0].length; continue; }
        const li = ind(lines[i]);
        if (li <= parent) break;
        if (want === null) want = li;
        if (li === want && rx.test(lines[i])) { found = i; break; }
      }
      if (found < 0) return best + 1;
      const l = lines[found], dash = /^(\s*)-\s+/.exec(l);
      best = found; start = found + 1; parent = dash ? dash[0].length : ind(l); sameLine = false;
    }
  }
  return best + 1;
}

/* ===================== Normalisation ===================== */
export function normOn(on) {
  const ev = {};
  if (typeof on === "string") ev[on] = {};
  else if (Array.isArray(on)) on.forEach((e) => { ev[e] = {}; });
  else if (isObj(on)) for (const [k, v] of Object.entries(on)) ev[k] = v == null ? {} : v;
  return ev;
}
function needsOf(job) { return list(job && job.needs).map(str); }
function jobsOf(doc) { return isObj(doc && doc.jobs) ? doc.jobs : {}; }

/* ===================== Expressions ${{ }} ===================== */
function tokenize(src) {
  const t = []; let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "'") {
      let j = i + 1, s = "";
      for (;;) {
        if (j >= src.length) throw new Error("chaîne '…' jamais fermée");
        if (src[j] === "'") { if (src[j + 1] === "'") { s += "'"; j += 2; continue; } break; }
        s += src[j++];
      }
      t.push({ k: "str", v: s }); i = j + 1; continue;
    }
    if (c === '"') throw new Error("dans une expression, les chaînes s'écrivent entre apostrophes 'comme ceci', pas entre guillemets");
    const two = src.slice(i, i + 2);
    if (["==", "!=", "<=", ">=", "&&", "||"].includes(two)) { t.push({ k: "op", v: two }); i += 2; continue; }
    if ("<>!".includes(c)) { t.push({ k: "op", v: c }); i++; continue; }
    if ("().[],*".includes(c)) { t.push({ k: c }); i++; continue; }
    const num = /^-?(0x[0-9a-fA-F]+|\d+(\.\d+)?(e[+-]?\d+)?)/.exec(src.slice(i));
    if (num && !(c === "-" && t.length && !["op", "(", ","].includes(t[t.length - 1].k))) { t.push({ k: "num", v: Number(num[0]) }); i += num[0].length; continue; }
    const id = /^[A-Za-z_][A-Za-z0-9_-]*/.exec(src.slice(i));
    if (id) { t.push({ k: "id", v: id[0] }); i += id[0].length; continue; }
    if (c === "=") throw new Error("« = » seul n'existe pas : pour comparer, écris « == »");
    throw new Error("caractère inattendu « " + c + " »");
  }
  return t;
}
export function parseExpr(src) {
  const t = tokenize(src); let p = 0;
  const peek = () => t[p], eat = (k, v) => { const x = t[p]; if (!x || x.k !== k || (v && x.v !== v)) throw new Error("expression incomplète ou mal formée"); p++; return x; };
  const isOp = (...vs) => peek() && peek().k === "op" && vs.includes(peek().v);
  const bin = (next, ...ops) => () => { let l = next(); while (isOp(...ops)) { const op = t[p++].v; l = { k: "bin", op, l, r: next() }; } return l; };
  function primary() {
    const x = peek(); if (!x) throw new Error("expression incomplète");
    if (x.k === "(") { p++; const e = or(); eat(")"); return e; }
    if (x.k === "str" || x.k === "num") { p++; return { k: "lit", v: x.v }; }
    if (x.k === "id") {
      p++;
      if (x.v === "true" || x.v === "false") return { k: "lit", v: x.v === "true" };
      if (x.v === "null") return { k: "lit", v: null };
      if (peek() && peek().k === "(") {
        p++; const args = [];
        if (!(peek() && peek().k === ")")) { args.push(or()); while (peek() && peek().k === ",") { p++; args.push(or()); } }
        eat(")"); return { k: "call", f: x.v, args };
      }
      return { k: "ctx", name: x.v };
    }
    throw new Error("expression mal formée");
  }
  function postfix() {
    let e = primary();
    for (;;) {
      if (peek() && peek().k === ".") { p++; const n = peek(); if (n && n.k === "*") { p++; e = { k: "star", o: e }; } else e = { k: "get", o: e, key: eat("id").v }; }
      else if (peek() && peek().k === "[") { p++; const key = or(); eat("]"); e = { k: "idx", o: e, key }; }
      else return e;
    }
  }
  function unary() { if (isOp("!")) { p++; return { k: "not", e: unary() }; } return postfix(); }
  const cmp = bin(unary, "<", ">", "<=", ">="), eq = bin(cmp, "==", "!="), and = bin(eq, "&&"), or = bin(and, "||");
  const ast = or();
  if (p < t.length) throw new Error("expression mal formée près de « " + (t[p].v ?? t[p].k) + " »");
  return ast;
}
/** Références de contexte (« github.ref », « needs.test.result »…) d'une expression analysée. */
function refs(ast, out = []) {
  if (!ast) return out;
  if (ast.k === "get" || ast.k === "idx" || ast.k === "star") {
    const path = []; let e = ast;
    while (e.k === "get" || e.k === "idx" || e.k === "star") { path.unshift(e.k === "get" ? e.key : e.k === "idx" && e.key.k === "lit" ? String(e.key.v) : "*"); if (e.k === "idx") refs(e.key, out); e = e.o; }
    if (e.k === "ctx") out.push([e.name, ...path]); else refs(e, out);
    return out;
  }
  if (ast.k === "ctx") out.push([ast.name]);
  if (ast.k === "bin") { refs(ast.l, out); refs(ast.r, out); }
  if (ast.k === "not") refs(ast.e, out);
  if (ast.k === "call") ast.args.forEach((a) => refs(a, out));
  return out;
}
const STATUS_FN = ["success", "failure", "always", "cancelled"];
const FUNCS = ["contains", "startsWith", "endsWith", "format", "join", "toJSON", "fromJSON", "hashFiles", ...STATUS_FN];
function calls(ast, out = []) {
  if (!ast) return out;
  if (ast.k === "call") { out.push(ast.f); ast.args.forEach((a) => calls(a, out)); }
  for (const k of ["l", "r", "e", "o", "key"]) if (ast[k] && typeof ast[k] === "object") calls(ast[k], out);
  return out;
}
const truthy = (v) => !(v === false || v === 0 || v === "" || v == null || Number.isNaN(v));
function toNum(v) {
  if (v == null) return 0; if (typeof v === "boolean") return v ? 1 : 0; if (typeof v === "number") return v;
  if (typeof v === "string") return v.trim() === "" ? 0 : Number(v); return NaN;
}
function looseEq(a, b) {
  if (a == null && b == null) return true;
  if (typeof a === "string" && typeof b === "string") return a.toLowerCase() === b.toLowerCase();
  if (typeof a === typeof b && typeof a !== "object") return a === b;
  if (typeof a === "object" && a !== null && typeof b === "object" && b !== null) return a === b;
  return toNum(a) === toNum(b);
}
export function evalExpr(ast, ctx, status = {}) {
  const ev = (e) => evalExpr(e, ctx, status);
  switch (ast.k) {
    case "lit": return ast.v;
    case "ctx": return ctx[ast.name];
    case "get": { const o = ev(ast.o); if (Array.isArray(o) && ast.o.k === "star") return o.map((x) => (x == null ? undefined : x[ast.key])); return o == null ? undefined : o[ast.key]; }
    case "idx": { const o = ev(ast.o), k = ev(ast.key); if (o == null) return undefined; if (isObj(o) && typeof k === "string") { const hit = Object.keys(o).find((x) => x.toLowerCase() === k.toLowerCase()); return hit === undefined ? undefined : o[hit]; } return o[k]; }
    case "star": { const o = ev(ast.o); return o == null ? [] : Array.isArray(o) ? o : Object.values(o); }
    case "not": return !truthy(ev(ast.e));
    case "bin": {
      if (ast.op === "&&") { const l = ev(ast.l); return truthy(l) ? ev(ast.r) : l; }
      if (ast.op === "||") { const l = ev(ast.l); return truthy(l) ? l : ev(ast.r); }
      const l = ev(ast.l), r = ev(ast.r);
      if (ast.op === "==") return looseEq(l, r);
      if (ast.op === "!=") return !looseEq(l, r);
      const [a, b] = typeof l === "string" && typeof r === "string" ? [l.toLowerCase(), r.toLowerCase()] : [toNum(l), toNum(r)];
      return ast.op === "<" ? a < b : ast.op === ">" ? a > b : ast.op === "<=" ? a <= b : a >= b;
    }
    case "call": {
      const a = ast.args.map(ev), low = (v) => str(v).toLowerCase();
      switch (ast.f) {
        case "success": return !!status.success;
        case "failure": return !!status.failure;
        case "always": return true;
        case "cancelled": return false;
        case "contains": return Array.isArray(a[0]) ? a[0].some((x) => looseEq(x, a[1])) : low(a[0]).includes(low(a[1]));
        case "startsWith": return low(a[0]).startsWith(low(a[1]));
        case "endsWith": return low(a[0]).endsWith(low(a[1]));
        case "format": return str(a[0]).replace(/\{(\d+)\}/g, (_, i) => str(a[1 + +i]));
        case "join": return Array.isArray(a[0]) ? a[0].map(str).join(a.length > 1 ? str(a[1]) : ",") : str(a[0]);
        case "toJSON": return JSON.stringify(a[0], null, 2);
        case "fromJSON": try { return JSON.parse(str(a[0])); } catch (e) { return null; }
        case "hashFiles": return "3f1c0b4e…";
        default: throw new Error("fonction inconnue : " + ast.f + "()");
      }
    }
  }
  throw new Error("expression non gérée");
}
/** Le contenu d'un if : « ${{ x }} » ou directement « x ». */
function ifSource(v) {
  const s = str(v).trim(); const m = /^\$\{\{([\s\S]*)\}\}$/.exec(s);
  return m && !m[1].includes("}}") ? m[1] : s;
}
function exprsIn(s) {
  const out = []; const rx = /\$\{\{([\s\S]*?)\}\}/g; let m;
  while ((m = rx.exec(s))) out.push(m[1]);
  const opens = (s.match(/\$\{\{/g) || []).length;
  return { list: out, unbalanced: opens > out.length };
}

/* ===================== Lint ===================== */
export function lint(text) {
  const P = parse(text);
  if (!P.ok) return { doc: null, issues: [P.error] };
  const doc = P.doc, issues = [];
  const at = (path, msg, level = "error") => issues.push({ line: locate(text, path), level, msg });
  if (!isObj(doc)) { at([], "Un workflow est un dictionnaire de clés (name, on, jobs…)."); return { doc, issues }; }

  for (const k of Object.keys(doc)) if (!TOP_KEYS.includes(k)) at([k], "Clé inconnue au premier niveau : « " + k + " »." + suggest(k, TOP_KEYS));
  if (!("on" in doc)) at([], "Il manque « on: » : sans déclencheur, le workflow ne démarre jamais.");
  const events = normOn(doc.on);
  for (const [e, cfg] of Object.entries(events)) {
    if (!EVENTS.includes(e)) { at(["on", e], "Événement inconnu : « " + e + " »." + suggest(e, EVENTS)); continue; }
    if (e === "schedule") {
      list(cfg).forEach((s, i) => { const c = isObj(s) ? str(s.cron).trim() : ""; if (c.split(/\s+/).length !== 5) at(["on", "schedule", i], "Un cron a 5 champs : minute heure jour mois jour-de-semaine (ex. « 0 6 * * 1 »)."); });
      continue;
    }
    if (!isObj(cfg)) { if (cfg != null && !(Array.isArray(cfg) && !cfg.length)) at(["on", e], "La configuration de « " + e + " » doit être un dictionnaire (branches:, paths:…)."); continue; }
    const allowed = FILTERS[e] || ["types"];
    for (const k of Object.keys(cfg)) if (!allowed.includes(k)) at(["on", e, k], "Filtre inconnu pour " + e + " : « " + k + " »." + suggest(k, allowed));
    for (const [a, b] of [["branches", "branches-ignore"], ["tags", "tags-ignore"], ["paths", "paths-ignore"]])
      if (a in cfg && b in cfg) at(["on", e, b], "« " + a + " » et « " + b + " » ne peuvent pas être combinés : utilise un motif « !… » dans « " + a + " ».");
    for (const k of ["branches", "branches-ignore", "tags", "tags-ignore", "paths", "paths-ignore", "types"]) if (k in cfg && !Array.isArray(cfg[k]) && typeof cfg[k] !== "string") at(["on", e, k], "« " + k + " » attend une liste.");
  }

  checkPerms(doc.permissions, ["permissions"], at);
  const jobs = jobsOf(doc);
  if (!("jobs" in doc)) at([], "Il manque « jobs: » : un workflow contient au moins un job.");
  else if (!isObj(doc.jobs) || !Object.keys(doc.jobs).length) at(["jobs"], "« jobs: » doit contenir au moins un job.");
  const ids = Object.keys(jobs);
  for (const id of ids) {
    const job = jobs[id], jp = ["jobs", id];
    if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(id)) at(jp, "Nom de job invalide « " + id + " » : lettres, chiffres, - et _, en commençant par une lettre ou _.");
    if (!isObj(job)) { at(jp, "Le job « " + id + " » doit être un dictionnaire (runs-on, steps…)."); continue; }
    for (const k of Object.keys(job)) if (!JOB_KEYS.includes(k)) at([...jp, k], "Clé inconnue dans le job « " + id + " » : « " + k + " »." + suggest(k, JOB_KEYS));
    for (const n of needsOf(job)) {
      if (n === id) at([...jp, "needs"], "Le job « " + id + " » ne peut pas s'attendre lui-même.");
      else if (!jobs[n]) at([...jp, "needs"], "« needs » cite un job qui n'existe pas : « " + n + " »." + suggest(n, ids));
    }
    checkPerms(job.permissions, [...jp, "permissions"], at);
    if (job.uses) {
      if (job.steps) at([...jp, "steps"], "Un job qui appelle un workflow réutilisable (uses) n'a pas de steps.");
    } else {
      if (!("runs-on" in job)) at(jp, "Le job « " + id + " » n'a pas de « runs-on » : sur quelle machine doit-il tourner ?");
      else for (const r of list(job["runs-on"])) if (typeof r === "string" && !r.includes("${{") && !RUNNERS.includes(r)) { const s = suggest(r, RUNNERS); if (s) at([...jp, "runs-on"], "Machine « " + r + " » inconnue." + s, "warn"); }
      if (!Array.isArray(job.steps) || !job.steps.length) at(jp, "Le job « " + id + " » n'a pas d'étapes (« steps: » avec au moins une étape).");
    }
    if ("timeout-minutes" in job && !(typeof job["timeout-minutes"] === "number" || str(job["timeout-minutes"]).includes("${{"))) at([...jp, "timeout-minutes"], "« timeout-minutes » attend un nombre de minutes.");
    const strat = isObj(job.strategy) ? job.strategy : null;
    if (job.strategy != null && !strat) at([...jp, "strategy"], "« strategy » doit être un dictionnaire (matrix:, fail-fast:…).");
    if (strat && strat.matrix != null && !isObj(strat.matrix) && !str(strat.matrix).includes("${{")) at([...jp, "strategy", "matrix"], "« matrix » doit être un dictionnaire : chaque clé liste ses valeurs.");
    const stepIds = new Set();
    list(job.steps).forEach((st, i) => {
      const sp = [...jp, "steps", i];
      if (!isObj(st)) { at(sp, "Chaque étape est un dictionnaire, par exemple « - run: echo bonjour »."); return; }
      for (const k of Object.keys(st)) if (!STEP_KEYS.includes(k)) at([...sp, k], "Clé inconnue dans une étape : « " + k + " »." + suggest(k, STEP_KEYS));
      if ("uses" in st && "run" in st) at(sp, "Une étape fait soit « uses » (une action), soit « run » (des commandes), pas les deux.");
      else if (!("uses" in st) && !("run" in st)) at(sp, "Cette étape ne fait rien : il lui faut « uses » ou « run ».");
      if ("with" in st && !("uses" in st)) at([...sp, "with"], "« with » passe des paramètres à une action : il n'a de sens qu'avec « uses ».");
      if ("uses" in st) {
        const u = str(st.uses);
        if (!u.startsWith("./") && !u.startsWith("docker://") && !/^[\w.-]+\/[\w.\-/]+@[\w.\-/]+$/.test(u))
          at([...sp, "uses"], u.includes("@") ? "Format d'action invalide : « propriétaire/dépôt@version »." : "Il manque la version de l'action : « " + u + "@v… ». Sans version, rien n'est figé.");
      }
      if (st.id != null) { if (stepIds.has(str(st.id))) at([...sp, "id"], "Deux étapes ont le même id « " + st.id + " »."); stepIds.add(str(st.id)); }
      if (typeof st.run === "string") for (const e of exprsIn(st.run).list) if (UNTRUSTED.test(e))
        at([...sp, "run"], "Risque d'injection : « ${{" + e + "}} » vient d'un inconnu (titre de PR, branche…). Passe la valeur par « env: » puis utilise la variable dans le script.", "warn");
    });
  }

  // « Pwn request » : pull_request_target donne des secrets et un jeton en écriture ; y exécuter le code de la PR est dangereux.
  if ("pull_request_target" in events) for (const id of ids) list(isObj(jobs[id]) ? jobs[id].steps : []).forEach((st, i) => {
    if (isObj(st) && st.uses && actionName(st.uses) === "actions/checkout" && isObj(st.with) && /pull_request\.head|head_ref/.test(str(st.with.ref)))
      at(["jobs", id, "steps", i, "with", "ref"], "Danger : avec pull_request_target, récupérer le code de la PR l'exécute avec les secrets et un jeton en écriture (« pwn request »). Utilise pull_request.", "warn");
  });

  // Cycles dans needs
  const state = {};
  const visit = (id, chain) => {
    if (state[id] === 2 || !jobs[id]) return; if (state[id] === 1) { at(["jobs", id, "needs"], "Dépendances circulaires : " + [...chain, id].join(" → ") + ". Aucun de ces jobs ne pourrait démarrer."); return; }
    state[id] = 1; for (const n of needsOf(jobs[id])) if (n !== id) visit(n, [...chain, id]); state[id] = 2;
  };
  ids.forEach((id) => visit(id, []));

  // Expressions et contextes
  walk(doc, [], (v, path) => {
    if (typeof v !== "string") return;
    const isIf = path[path.length - 1] === "if";
    const jobId = path[0] === "jobs" ? path[1] : null, job = jobId ? jobs[jobId] : null;
    const isJobIf = isIf && path.length === 3;
    const ex = exprsIn(v);
    if (ex.unbalanced) { at(path, "« ${{ » ouvert mais jamais fermé par « }} »."); return; }
    const srcs = isIf ? [ifSource(v)] : ex.list;
    for (const src of srcs) {
      let ast;
      try { ast = parseExpr(src); } catch (e) { at(path, "Expression invalide : " + e.message + "."); continue; }
      for (const f of calls(ast)) if (!FUNCS.includes(f)) at(path, "Fonction inconnue : « " + f + "() »." + suggest(f, FUNCS));
      for (const r of refs(ast)) {
        const [c, k] = r;
        if (!CONTEXTS.includes(c)) { at(path, "Contexte inconnu : « " + c + " »." + suggest(c, CONTEXTS)); continue; }
        if (isJobIf && !JOB_IF_CONTEXTS.includes(c)) at(path, "Le contexte « " + c + " » n'existe pas encore dans le « if » d'un job (seulement " + JOB_IF_CONTEXTS.join(", ") + ").");
        if (c === "needs" && job && k && k !== "*" && !needsOf(job).includes(k)) at(path, "« needs." + k + " » : ce job n'attend pas « " + k + " » (ajoute-le dans « needs »).");
        if (c === "matrix" && job && k && k !== "*") {
          const m = isObj(job.strategy) && isObj(job.strategy.matrix) ? job.strategy.matrix : null;
          const keys = m ? new Set([...Object.keys(m), ...list(m.include).flatMap((x) => (isObj(x) ? Object.keys(x) : []))]) : new Set();
          if (m && !str(job.strategy.matrix).includes("${{") && !keys.has(k)) at(path, "« matrix." + k + " » n'est pas défini dans la matrice de ce job.");
          if (!m) at(path, "« matrix." + k + " » : ce job n'a pas de « strategy.matrix ».");
        }
      }
    }
  });

  // Nombres qui perdent leur zéro final (3.10 lu 3.1)
  text.split("\n").forEach((l, i) => {
    const code = l.replace(/(^|\s)#.*$/, "").replace(/"[^"]*"|'[^']*'/g, '""');
    const m = /(?:[:\-[,]\s*)(\d+\.\d*0)(?=\s*(?:[,\]]|$))/.exec(code);
    if (m) issues.push({ line: i + 1, level: "warn", msg: "« " + m[1] + " » est lu comme le nombre " + Number(m[1]) + " : mets-le entre guillemets (\"" + m[1] + "\") pour garder la version exacte." });
  });

  issues.sort((a, b) => a.line - b.line);
  return { doc, issues };
}
function checkPerms(p, path, at) {
  if (p == null) return;
  if (typeof p === "string") { if (!["read-all", "write-all"].includes(p)) at(path, "« permissions » vaut « read-all », « write-all » ou un dictionnaire scope: niveau."); return; }
  if (!isObj(p)) { at(path, "« permissions » doit être un dictionnaire (contents: read…)."); return; }
  for (const [k, v] of Object.entries(p)) {
    if (!PERM_SCOPES.includes(k)) at([...path, k], "Permission inconnue : « " + k + " »." + suggest(k, PERM_SCOPES));
    else if (!(str(v) in PERM_LEVEL)) at([...path, k], "Niveau de permission invalide « " + v + " » : read, write ou none.");
  }
}
function walk(v, path, fn) {
  fn(v, path);
  if (Array.isArray(v)) v.forEach((x, i) => walk(x, [...path, i], fn));
  else if (isObj(v)) for (const [k, x] of Object.entries(v)) walk(x, [...path, k], fn);
}

/* ===================== Simulation d'un événement ===================== */
/** Correspondance d'un motif de filtre GitHub : * (sans /), ** (tout), ?, +. */
export function globMatch(pattern, value) {
  let rx = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "*") { if (pattern[i + 1] === "*") { rx += ".*"; i++; if (pattern[i + 1] === "/") { rx += "/?"; i++; } } else rx += "[^/]*"; }
    else if (c === "?") rx += "[^/]?";
    else if (c === "+") rx += "+";
    else if ("[]".includes(c)) rx += c;
    else rx += c.replace(/[.^${}()|\\]/g, "\\$&");
  }
  return new RegExp("^" + rx + "$").test(value);
}
function filterMatch(patterns, value) {
  let ok = false;
  for (const p of list(patterns).map(str)) { if (p.startsWith("!")) { if (globMatch(p.slice(1), value)) ok = false; } else if (globMatch(p, value)) ok = true; }
  return ok;
}
function pathsOk(cfg, paths) {
  if (!paths) return true;
  if (cfg.paths) return paths.some((f) => filterMatch(cfg.paths, f));
  if (cfg["paths-ignore"]) return !paths.every((f) => list(cfg["paths-ignore"]).some((p) => globMatch(str(p), f)));
  return true;
}
const DEFAULT_TYPES = { pull_request: ["opened", "synchronize", "reopened"], pull_request_target: ["opened", "synchronize", "reopened"] };

export function describeEvent(ev) {
  const files = ev.paths ? " qui modifie " + fmtList(ev.paths) : "";
  return baseEvent(ev) + files;
}
function baseEvent(ev) {
  switch (ev.name) {
    case "push": return ev.tag ? "un push du tag " + ev.tag : "un push sur " + (ev.branch || "main");
    case "pull_request": case "pull_request_target": return (ev.draft ? "une pull request brouillon" : "une pull request") + " de " + (ev.head || "feature") + " vers " + (ev.base || "main") + (ev.action && ev.action !== "opened" ? " (" + ev.action + ")" : "");
    case "workflow_dispatch": return "un lancement manuel" + (ev.branch && ev.branch !== "main" ? " sur " + ev.branch : "");
    case "schedule": return "le déclenchement planifié";
    case "release": return "une release " + (ev.action || "published");
    default: return "l'événement " + ev.name;
  }
}

function triggered(doc, ev) {
  const events = normOn(doc.on), name = ev.name;
  if (!(name in events)) return { ok: false, why: "« " + name + " » n'est pas dans « on: »" };
  const cfg = isObj(events[name]) ? events[name] : {};
  if (name === "push") {
    const hasB = "branches" in cfg || "branches-ignore" in cfg, hasT = "tags" in cfg || "tags-ignore" in cfg;
    if (ev.tag) {
      if (hasB && !hasT) return { ok: false, why: "seules des branches sont filtrées : les tags ne déclenchent pas ce workflow" };
      if (cfg.tags && !filterMatch(cfg.tags, ev.tag)) return { ok: false, why: "le tag " + ev.tag + " ne correspond pas à « tags »" };
      if (cfg["tags-ignore"] && list(cfg["tags-ignore"]).some((p) => globMatch(str(p), ev.tag))) return { ok: false, why: "le tag " + ev.tag + " est ignoré" };
      return { ok: true };
    }
    const b = ev.branch || "main";
    if (hasT && !hasB) return { ok: false, why: "seuls des tags sont filtrés : un push de branche ne déclenche pas ce workflow" };
    if (cfg.branches && !filterMatch(cfg.branches, b)) return { ok: false, why: "la branche " + b + " ne correspond pas à « branches »" };
    if (cfg["branches-ignore"] && list(cfg["branches-ignore"]).some((p) => globMatch(str(p), b))) return { ok: false, why: "la branche " + b + " est dans « branches-ignore »" };
    if (!pathsOk(cfg, ev.paths)) return { ok: false, why: "aucun fichier modifié ne correspond au filtre « paths »" };
    return { ok: true };
  }
  if (name === "pull_request" || name === "pull_request_target") {
    const base = ev.base || "main", action = ev.action || "opened";
    const types = cfg.types ? list(cfg.types).map(str) : DEFAULT_TYPES[name];
    if (!types.includes(action)) return { ok: false, why: "l'action « " + action + " » n'est pas dans « types »" };
    if (cfg.branches && !filterMatch(cfg.branches, base)) return { ok: false, why: "la branche cible " + base + " ne correspond pas à « branches »" };
    if (cfg["branches-ignore"] && list(cfg["branches-ignore"]).some((p) => globMatch(str(p), base))) return { ok: false, why: "la branche cible " + base + " est ignorée" };
    if (!pathsOk(cfg, ev.paths)) return { ok: false, why: "aucun fichier modifié ne correspond au filtre « paths »" };
    return { ok: true };
  }
  if (cfg.types && ev.action && !list(cfg.types).map(str).includes(ev.action)) return { ok: false, why: "l'action « " + ev.action + " » n'est pas dans « types »" };
  return { ok: true };
}

function githubCtx(doc, ev) {
  const g = { event_name: ev.name, actor: ev.actor || "eleve", repository: "eleve/projet", repository_owner: "eleve", sha: "a1b2c3d", run_number: 42, event: {}, workflow: str(doc.name), head_ref: "", base_ref: "" };
  if (ev.name === "push" && ev.tag) Object.assign(g, { ref: "refs/tags/" + ev.tag, ref_name: ev.tag, ref_type: "tag" });
  else if (ev.name === "pull_request" || ev.name === "pull_request_target") {
    Object.assign(g, { ref: "refs/pull/7/merge", ref_name: "7/merge", ref_type: "branch", head_ref: ev.head || "feature", base_ref: ev.base || "main" });
    g.event = { action: ev.action || "opened", number: 7, pull_request: { number: 7, draft: !!ev.draft, title: ev.title || "Ajoute la recherche", labels: list(ev.labels).map((n) => ({ name: n })), base: { ref: ev.base || "main" }, head: { ref: ev.head || "feature" }, user: { login: ev.actor || "eleve" } } };
  } else {
    const b = ev.branch || "main";
    Object.assign(g, { ref: "refs/heads/" + b, ref_name: b, ref_type: "branch" });
    if (ev.name === "release") g.event = { action: ev.action || "published", release: { tag_name: ev.tag || "v1.0.0" } };
  }
  return g;
}
function inputsCtx(doc, ev) {
  const cfg = normOn(doc.on).workflow_dispatch, out = {};
  if (isObj(cfg) && isObj(cfg.inputs)) for (const [k, v] of Object.entries(cfg.inputs)) out[k] = isObj(v) && "default" in v ? v.default : "";
  return Object.assign(out, ev.inputs || {});
}
function stepLabel(st) { return str(st.name || st.uses || str(st.run).split("\n")[0]).trim(); }
function matrixSize(job) {
  const m = isObj(job.strategy) && isObj(job.strategy.matrix) ? job.strategy.matrix : null;
  if (!m) return 1;
  const dims = Object.entries(m).filter(([k, v]) => k !== "include" && k !== "exclude" && Array.isArray(v));
  const inc = list(m.include).filter(isObj);
  if (!dims.length) return Math.max(inc.length, 1);
  const base = dims.reduce((a, [, v]) => a * v.length, 1) - list(m.exclude).length;
  // Une entrée d'include crée une combinaison de plus si une de ses valeurs n'existe pas dans la matrice.
  const extra = inc.filter((x) => dims.some(([d, vals]) => d in x && !vals.map(str).includes(str(x[d])))).length;
  return Math.max(base + extra, 1);
}
function firstCombo(job) {
  const m = isObj(job.strategy) && isObj(job.strategy.matrix) ? job.strategy.matrix : {};
  const c = {}; for (const [k, v] of Object.entries(m)) if (k !== "include" && k !== "exclude" && Array.isArray(v)) c[k] = v[0];
  return c;
}

/** Ordre d'exécution : niveaux d'un tri topologique (les jobs d'un même niveau tournent en parallèle). */
export function stages(doc) {
  const jobs = jobsOf(doc), lvl = {}, seen = new Set();
  const depth = (id) => {
    if (lvl[id] != null) return lvl[id]; if (seen.has(id)) return 0; seen.add(id);
    const ns = needsOf(jobs[id]).filter((n) => jobs[n] && n !== id);
    return (lvl[id] = ns.length ? 1 + Math.max(...ns.map(depth)) : 0);
  };
  Object.keys(jobs).forEach(depth);
  return lvl;
}

/**
 * Simule un événement. ev = { name, branch?, tag?, base?, head?, action?, draft?, paths?, inputs?, vars?, secrets? }
 * opts.fail = jobs dont on simule l'échec.
 */
export function plan(doc, ev, opts = {}) {
  const fail = new Set(opts.fail || []);
  const t = triggered(doc, ev);
  const jobs = jobsOf(doc), lvl = stages(doc);
  if (!t.ok) return { triggered: false, why: t.why, jobs: Object.keys(jobs).map((id) => ({ id, name: str(jobs[id] && jobs[id].name) || id, needs: needsOf(jobs[id]), stage: lvl[id], status: "off", steps: [], matrix: 1 })) };
  const github = githubCtx(doc, ev), inputs = inputsCtx(doc, ev), vars = ev.vars || {}, secrets = Object.assign({ GITHUB_TOKEN: "***" }, ev.secrets || {});
  const result = {}, out = [];
  const order = Object.keys(jobs).sort((a, b) => lvl[a] - lvl[b]);
  for (const id of order) {
    const job = isObj(jobs[id]) ? jobs[id] : {}, needs = needsOf(job).filter((n) => jobs[n]);
    const res = needs.map((n) => result[n]);
    const status = { success: res.every((r) => r === "success"), failure: res.some((r) => r === "failure") };
    const needsCtx = {}; needs.forEach((n) => { needsCtx[n] = { result: result[n], outputs: {} }; });
    let runs = status.success, why = runs ? "" : "un job attendu n'a pas réussi (" + needs.filter((n) => result[n] !== "success").map((n) => n + " : " + frResult(result[n])).join(", ") + ")";
    if (job.if != null) {
      try {
        const ast = parseExpr(ifSource(job.if)); const usesStatus = calls(ast).some((f) => STATUS_FN.includes(f));
        const v = truthy(evalExpr(ast, { github, needs: needsCtx, vars, inputs }, status));
        if (usesStatus) { runs = v; why = v ? "" : "condition « if » fausse"; }
        else if (runs) { runs = v; why = v ? "" : "condition « if » fausse : " + str(job.if).replace(/^\$\{\{\s*|\s*\}\}$/g, ""); }
      } catch (e) { runs = false; why = "expression invalide dans « if »"; }
    }
    const r = runs ? (fail.has(id) ? "failure" : "success") : "skipped";
    result[id] = r;
    const steps = [];
    if (runs) {
      const env = Object.assign({}, isObj(doc.env) ? doc.env : {}, isObj(job.env) ? job.env : {});
      const stepsCtx = {}; let failed = false;
      const all = list(job.steps).filter(isObj);
      // Dans un job en échec, c'est la première commande « run » qui casse (en général : les tests).
      const breaking = fail.has(id) ? Math.max(all.findIndex((x) => "run" in x), 0) : -1;
      all.forEach((st, i) => {
        let ran = !failed;
        if (st.if != null) {
          try { ran = truthy(evalExpr(parseExpr(ifSource(st.if)), { github, env: Object.assign({}, env, isObj(st.env) ? st.env : {}), vars, secrets, inputs, matrix: firstCombo(job), steps: stepsCtx, needs: needsCtx, job: { status: failed ? "failure" : "success" }, runner: { os: "Linux", temp: "/tmp" } }, { success: !failed, failure: failed })); }
          catch (e) { ran = false; }
        }
        const broke = ran && i === breaking;
        if (broke) failed = true;
        const outcome = !ran ? "skipped" : broke ? "failure" : "success";
        if (st.id != null) stepsCtx[str(st.id)] = { outcome, conclusion: outcome, outputs: {} };
        steps.push({ label: stepLabel(st), ran, failed: broke });
      });
    }
    const envName = isObj(job.environment) ? str(job.environment.name) : str(job.environment || "");
    out.push({ id, name: str(job.name) || id, needs, stage: lvl[id], status: r, why, steps, matrix: matrixSize(job), environment: envName });
  }
  return { triggered: true, jobs: out };
}
const frResult = (r) => ({ success: "réussi", failure: "échoué", skipped: "sauté" })[r] || r;

/* ===================== Critères d'un défi ===================== */
function stepsOf(doc, id) { const j = jobsOf(doc)[id]; return isObj(j) ? list(j.steps).filter(isObj) : []; }
function stepMatches(st, token) { return st.uses ? actionName(st.uses) === token || str(st.uses).startsWith(token) : str(st.run).includes(token); }
function effPerms(doc, job) {
  const p = job && job.permissions != null ? job.permissions : doc.permissions;
  if (p == null) return null;
  if (p === "read-all") return Object.fromEntries(PERM_SCOPES.map((s) => [s, "read"]));
  if (p === "write-all") return Object.fromEntries(PERM_SCOPES.map((s) => [s, "write"]));
  return isObj(p) ? p : {};
}
function fmtList(a) { return a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " et " + a[a.length - 1]; }

function scenarioLabel(s) {
  const head = "Sur " + describeEvent(s.event) + (s.fail && s.fail.length ? " avec " + fmtList(s.fail) + " en échec" : "");
  if (s.triggered === false) return head + " : le workflow ne démarre pas";
  const parts = [];
  if (s.run && s.run.length) parts.push(fmtList(s.run) + (s.run.length > 1 ? " tournent" : " tourne"));
  if (s.skip && s.skip.length) parts.push(fmtList(s.skip) + (s.skip.length > 1 ? " sont sautés" : " est sauté"));
  for (const [j, a] of Object.entries(s.stepsRun || {})) parts.push("dans " + j + ", « " + a.join(" », « ") + " » s'exécute" + (a.length > 1 ? "nt" : ""));
  for (const [j, a] of Object.entries(s.stepsSkipped || {})) parts.push("dans " + j + ", « " + a.join(" », « ") + " » " + (a.length > 1 ? "sont sautées" : "est sautée"));
  return head + " : " + (parts.join(", ") || "le workflow démarre");
}

/**
 * checks : { name, triggers, onlyTriggers, branches, jobs, runsOn, needs, uses, run, order, with, matrix,
 *            env, permissions, maxPermissions, pinned, timeout, concurrency, noWarnings, scenarios }
 * Renvoie [{ ok, label }]. Les deux premiers critères (YAML valide, aucune erreur) sont toujours vérifiés.
 */
export function evaluate(text, checks) {
  const { doc, issues } = lint(text);
  const errs = issues.filter((i) => i.level === "error"), warns = issues.filter((i) => i.level === "warn");
  const out = [{ ok: !!doc, label: "Le fichier est un YAML valide" }];
  if (doc) out.push({ ok: !errs.length, label: errs.length ? "Aucune erreur de structure (" + errs.length + " à corriger)" : "Aucune erreur de structure" });
  const d = doc && isObj(doc) ? doc : {}, jobs = jobsOf(d), events = normOn(d.on);
  const push = (ok, label) => out.push({ ok: !!doc && !!ok, label });
  for (const [k, v] of Object.entries(checks || {})) {
    switch (k) {
      case "name": push(d.name === v, "Le workflow s'appelle « " + v + " »"); break;
      case "triggers": push(v.every((e) => e in events), "Il se déclenche sur " + fmtList(v)); break;
      case "onlyTriggers": push(v.length === Object.keys(events).length && v.every((e) => e in events), "Il se déclenche uniquement sur " + fmtList(v)); break;
      case "branches": for (const [e, bs] of Object.entries(v)) { const c = isObj(events[e]) ? list(events[e].branches).map(str) : []; push(bs.length === c.length && bs.every((b) => c.includes(b)), "« " + e + " » filtre les branches " + fmtList(bs)); } break;
      case "jobs": push(v.every((j) => jobs[j]), (v.length > 1 ? "Les jobs " : "Le job ") + fmtList(v) + (v.length > 1 ? " existent" : " existe")); break;
      case "runsOn": for (const [j, r] of Object.entries(v)) push(jobs[j] && list(jobs[j]["runs-on"]).map(str).includes(r), "Le job " + j + " tourne sur " + r); break;
      case "needs": for (const [j, ns] of Object.entries(v)) { const have = needsOf(jobs[j]); push(jobs[j] && ns.length === have.length && ns.every((n) => have.includes(n)), ns.length ? j + " attend la fin de " + fmtList(ns) : j + " n'attend aucun autre job"); } break;
      case "uses": for (const [j, as] of Object.entries(v)) push(as.every((a) => stepsOf(d, j).some((s) => s.uses && actionName(s.uses) === a)), "Le job " + j + " utilise " + fmtList(as)); break;
      case "run": for (const [j, cs] of Object.entries(v)) push(cs.every((c) => stepsOf(d, j).some((s) => str(s.run).includes(c))), "Le job " + j + " lance " + cs.map((c) => "« " + c + " »").join(", ")); break;
      case "order": for (const [j, toks] of Object.entries(v)) { const st = stepsOf(d, j); let i = 0; const ok = toks.every((tk) => { while (i < st.length && !stepMatches(st[i], tk)) i++; return i++ < st.length; }); push(ok, "Dans " + j + ", les étapes s'enchaînent : " + toks.join(" → ")); } break;
      case "with": for (const [j, acts] of Object.entries(v)) for (const [a, kv] of Object.entries(acts)) for (const [key, val] of Object.entries(kv)) { const s = stepsOf(d, j).find((x) => x.uses && actionName(x.uses) === a); const got = s && isObj(s.with) ? s.with[key] : undefined; push(got !== undefined && str(got) === str(val) && (typeof got === "number") === (typeof val === "number"), a + " reçoit " + key + ": " + JSON.stringify(val)); } break;
      case "matrix": for (const [j, dims] of Object.entries(v)) for (const [dim, vals] of Object.entries(dims)) { const m = jobs[j] && isObj(jobs[j].strategy) && isObj(jobs[j].strategy.matrix) ? list(jobs[j].strategy.matrix[dim]) : []; push(vals.length === m.length && vals.every((x) => m.some((y) => str(y) === str(x) && typeof y === typeof x)), "La matrice de " + j + " fait varier " + dim + " : " + vals.join(", ")); } break;
      case "env": for (const [scope, kv] of Object.entries(v)) { const e = scope === "workflow" ? d.env : jobs[scope] && jobs[scope].env; for (const [key, val] of Object.entries(kv)) push(isObj(e) && str(e[key]) === str(val), (scope === "workflow" ? "Le workflow" : "Le job " + scope) + " définit " + key + "=" + val); } break;
      case "permissions": for (const [scope, kv] of Object.entries(v)) { const p = scope === "workflow" ? d.permissions : jobs[scope] && jobs[scope].permissions; for (const [s, lv] of Object.entries(kv)) push(isObj(p) && str(p[s]) === lv, (scope === "workflow" ? "Le workflow" : "Le job " + scope) + " déclare " + s + ": " + lv); } break;
      case "maxPermissions": {
        const ids = Object.keys(jobs);
        const ok = ids.length && ids.every((id) => { const p = effPerms(d, jobs[id]); return p && Object.entries(p).every(([s, lv]) => (PERM_LEVEL[str(lv)] || 0) <= (PERM_LEVEL[v[s]] || 0)); });
        push(ok, "Permissions minimales : rien au-delà de " + (Object.entries(v).map(([s, l]) => s + ": " + l).join(", ") || "aucune") + " pour chaque job");
        break;
      }
      case "pinned": {
        const all = []; walk(d, [], (x, p) => { if (p[p.length - 1] === "uses" && typeof x === "string" && !x.startsWith("./") && !x.startsWith("docker://")) all.push(x); });
        const ok = all.length && all.every((u) => (v === "sha" ? /@[0-9a-f]{40}$/.test(u) : /@.+/.test(u)));
        push(ok, v === "sha" ? "Chaque action est épinglée sur un SHA complet de 40 caractères" : "Chaque action a une version");
        break;
      }
      case "timeout": for (const [j, max] of Object.entries(v)) { const t = jobs[j] && jobs[j]["timeout-minutes"]; push(typeof t === "number" && t <= max, "Le job " + j + " s'arrête au bout de " + max + " minutes au plus"); } break;
      case "concurrency": { const c = d.concurrency; push(c && (v === true || (isObj(c) && (!v.cancel || c["cancel-in-progress"] === true))), "Une nouvelle exécution " + (v.cancel ? "annule la précédente" : "ne se superpose pas à la précédente")); break; }
      case "services": for (const [j, names] of Object.entries(v)) { const sv = jobs[j] && isObj(jobs[j].services) ? jobs[j].services : {}; push(names.every((n) => isObj(sv[n]) && sv[n].image), "Le job " + j + " démarre le service " + fmtList(names)); } break;
      case "environment": for (const [j, e] of Object.entries(v)) { const got = jobs[j] && (isObj(jobs[j].environment) ? jobs[j].environment.name : jobs[j].environment); push(str(got) === e, "Le job " + j + " déploie dans l'environnement « " + e + " »"); } break;
      case "cache": for (const [j, kind] of Object.entries(v)) { const st = stepsOf(d, j); push(st.some((x) => (isObj(x.with) && str(x.with.cache) === kind) || (x.uses && actionName(x.uses) === "actions/cache")), "Le job " + j + " met en cache les dépendances " + kind); } break;
      case "matrixSize": for (const [j, n] of Object.entries(v)) push(jobs[j] && matrixSize(jobs[j]) === n, "La matrice de " + j + " produit " + n + " combinaisons"); break;
      case "failFast": for (const [j, ff] of Object.entries(v)) { const st = jobs[j] && isObj(jobs[j].strategy) ? jobs[j].strategy["fail-fast"] : undefined; push((st === undefined ? true : st) === ff, ff ? "Un échec dans la matrice de " + j + " arrête les autres combinaisons" : "Un échec dans la matrice de " + j + " n'arrête pas les autres combinaisons"); } break;
      case "jobConcurrency": for (const [j, cfg] of Object.entries(v)) { const c = jobs[j] && jobs[j].concurrency; const cancel = isObj(c) ? c["cancel-in-progress"] === true : false; push(c != null && (cfg.cancel === undefined || cancel === cfg.cancel), "Le job " + j + " ne tourne qu'une fois à la fois" + (cfg.cancel === false ? ", sans annuler un déploiement en cours" : cfg.cancel ? ", la nouvelle exécution annule l'ancienne" : "")); } break;
      case "dispatchInputs": { const cfg = isObj(events.workflow_dispatch) && isObj(events.workflow_dispatch.inputs) ? events.workflow_dispatch.inputs : {}; push(v.every((n) => n in cfg), "Le lancement manuel demande " + fmtList(v.map((n) => "« " + n + " »"))); break; }
      case "contains": for (const t of v) push(text.includes(t), "Le fichier contient « " + t + " »"); break;
      case "lacks": for (const t of v) push(!!doc && !text.includes(t), "Le fichier ne contient plus « " + t + " »"); break;
      case "noWarnings": push(!warns.length, warns.length ? "Aucun avertissement (" + warns.length + " restant)" : "Aucun avertissement"); break;
      case "scenarios":
        for (const s of v) {
          let ok = !!doc && !errs.length;
          if (ok) {
            const p = plan(d, s.event, { fail: s.fail });
            const st = Object.fromEntries(p.jobs.map((j) => [j.id, j]));
            if (s.triggered === false) ok = !p.triggered;
            else ok = p.triggered && (s.run || []).every((j) => st[j] && st[j].status !== "skipped") && (s.skip || []).every((j) => st[j] && st[j].status === "skipped") &&
              Object.entries(s.stepsRun || {}).every(([j, a]) => st[j] && a.every((l) => st[j].steps.some((x) => x.ran && x.label.includes(l)))) &&
              Object.entries(s.stepsSkipped || {}).every(([j, a]) => st[j] && a.every((l) => st[j].steps.some((x) => !x.ran && x.label.includes(l))));
          }
          out.push({ ok, label: s.label || scenarioLabel(s) });
        }
        break;
      default: throw new Error("critère de vérification inconnu : " + k);
    }
  }
  return out;
}

/** Tout ce qu'il faut à l'interface : problèmes et simulation de chaque événement demandé. */
export function analyze(text, events = []) {
  const { doc, issues } = lint(text);
  const ok = !!doc && isObj(doc) && !issues.some((i) => i.level === "error");
  return { doc, issues, plans: ok ? events.map((ev) => ({ event: ev, label: describeEvent(ev) + (ev.fail && ev.fail.length ? ", " + fmtList(ev.fail) + " en échec" : ""), ...plan(doc, ev, { fail: ev.fail }) })) : [] };
}
