/* Terraform simulé (sorties de Terraform 1.9, sans couleurs) sur le compte AWS simulé.
   init, validate, fmt, plan, apply, destroy, output, state list|show|rm, import ; variables, locals, count,
   for_each, data, modules locaux, backend s3 avec verrou. */
import { COMMANDS, EXTRA_CHECKS, SETUP_HOOKS } from "../shell/commands.js";
import { parseHcl, evaluate, refsOf, HclErr, Unknown, isUnknown } from "./hcl.js";
import { Account, AwsErr, SCHEMAS, DATA_SOURCES, providerOf, ACCOUNT_ID, REGION, AZS, AMIS } from "../aws/account.js";

const VERSIONS = { aws: "5.76.0", random: "3.6.3", local: "2.5.2" };
const KNOWN_PROVIDERS = { aws: "hashicorp/aws", random: "hashicorp/random", local: "hashicorp/local" };
class TfErr extends Error { constructor(title, detail, where) { super(title); this.title = title; this.detail = detail || ""; this.where = where; } }
const box = (title, detail, where, src) => {
  let s = "╷\n│ Error: " + title + "\n│ \n";
  if (where) { s += (where.with ? "│   with " + where.with + ",\n" : "") + "│   on " + where.file + " line " + where.line + (where.block ? ", in " + where.block : "") + ":\n"; const l = src && src.split("\n")[where.line - 1]; if (l !== undefined) s += "│ " + String(where.line).padStart(3) + ": " + l + "\n"; s += "│ \n"; }
  return s + detail.split("\n").map((x) => ("│ " + x).replace(/\s+$/, "")).join("\n") + "\n╵\n";
};
const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
const suggest = (w, list) => { const best = list.map((x) => [x, lev(w, x)]).sort((a, b) => a[1] - b[1])[0]; return best && best[1] <= Math.max(2, w.length / 4) ? best[0] : null; };
const clone = (o) => JSON.parse(JSON.stringify(o));
const dirOf = (p) => p.replace(/\/[^/]*$/, "") || "/";

/* ===================== configuration ===================== */
function loadConfig(sh, dir, modPath = "") {
  const files = {}; let names;
  try { names = sh.fs.list(dir, sh.user) || []; } catch (e) { throw new TfErr("Unreadable module directory", "Unable to read the directory " + dir + "."); }
  for (const n of names.filter((x) => x.endsWith(".tf")).sort()) files[n] = sh.fs.read(dir + "/" + n, sh.user);
  const cfg = { dir, files, mod: modPath, variables: {}, locals: [], resources: [], data: [], outputs: {}, modules: [], providers: {}, required: {}, backend: null };
  for (const [f, src] of Object.entries(files)) {
    let b; try { b = parseHcl(src, f); } catch (e) { if (e instanceof HclErr) { e.src = src; throw e; } throw e; }
    for (const blk of b.blocks) {
      const at = { file: f, line: blk.line, src };
      if (blk.type === "terraform") {
        for (const sub of blk.body.blocks) {
          if (sub.type === "required_providers") for (const [k, a] of Object.entries(sub.body.attrs)) { const v = evaluate(a.expr, { file: f, ref: () => null }); cfg.required[k] = v; }
          if (sub.type === "backend") cfg.backend = { type: sub.labels[0], attrs: Object.fromEntries(Object.entries(sub.body.attrs).map(([k, a]) => [k, evaluate(a.expr, { file: f, ref: () => { throw new HclErr("Variables not allowed", "Variables may not be used here.", f, a.line); } })])), at };
        }
      } else if (blk.type === "variable") cfg.variables[blk.labels[0]] = { body: blk.body, at };
      else if (blk.type === "locals") for (const [k, a] of Object.entries(blk.body.attrs)) cfg.locals.push({ name: k, expr: a.expr, at: { ...at, line: a.line } });
      else if (blk.type === "resource") { if (blk.labels.length !== 2) throw new TfErr("Missing name for resource", "All resource blocks must have 2 labels (type, name).", at); cfg.resources.push({ type: blk.labels[0], name: blk.labels[1], body: blk.body, at, mode: "managed" }); }
      else if (blk.type === "data") cfg.data.push({ type: blk.labels[0], name: blk.labels[1], body: blk.body, at, mode: "data" });
      else if (blk.type === "output") cfg.outputs[blk.labels[0]] = { body: blk.body, at };
      else if (blk.type === "module") cfg.modules.push({ name: blk.labels[0], body: blk.body, at });
      else if (blk.type === "provider") cfg.providers[blk.labels[0]] = { body: blk.body, at };
      else throw new TfErr("Unsupported block type", 'Blocks of type "' + blk.type + '" are not expected here.' + (suggest(blk.type, ["resource", "variable", "output", "locals", "module", "data", "provider", "terraform"]) ? ' Did you mean "' + suggest(blk.type, ["resource", "variable", "output", "locals", "module", "data", "provider", "terraform"]) + '"?' : ""), at);
    }
  }
  return cfg;
}
/** Vérifications statiques (terraform validate) : types de ressources, arguments, références déclarées. */
function validateConfig(cfg, all = []) {
  const errs = [];
  const push = (t, d, at, extra = {}) => errs.push(new TfErr(t, d, { ...at, ...extra }));
  const rkeys = new Set(cfg.resources.map((r) => r.type + "." + r.name)); const dkeys = new Set(cfg.data.map((r) => r.type + "." + r.name));
  const checkRefs = (expr, at, ctx) => {
    for (const ref of refsOf(expr)) {
      const [h, a, b] = ref;
      if (h === "var") { if (a && !cfg.variables[a]) push("Reference to undeclared input variable", 'An input variable with the name "' + a + '" has not been declared.' + (suggest(a, Object.keys(cfg.variables)) ? ' Did you mean "' + suggest(a, Object.keys(cfg.variables)) + '"?' : " This variable can be declared with a variable \"" + a + "\" {} block."), at); }
      else if (h === "local") { if (a && !cfg.locals.some((l) => l.name === a)) push("Reference to undeclared local value", 'A local value with the name "' + a + '" has not been declared.', at); }
      else if (h === "data") { if (a && b && !dkeys.has(a + "." + b)) push("Reference to undeclared resource", 'A data resource "' + a + '" "' + b + '" has not been declared in the root module.', at); }
      else if (h === "module") { if (a && !cfg.modules.some((m) => m.name === a)) push("Reference to undeclared module", 'No module call named "' + a + '" is declared in the root module.', at); }
      else if (["count", "each", "path", "terraform", "self"].includes(h) || ctx.iter && h === ctx.iter) { if (h === "count" && !ctx.count) push('Reference to "count" in non-counted context', 'The "count" object can only be used in "module", "resource", and "data" blocks, and only when the "count" argument is set.', at); if (h === "each" && !ctx.each) push('Reference to "each" in context without for_each', 'The "each" object can be used only in "module" or "resource" blocks, and only when the "for_each" argument is set.', at); }
      else if (SCHEMAS[h] || /^(aws|random|local)_/.test(h)) { if (a && !rkeys.has(h + "." + a)) push("Reference to undeclared resource", 'A managed resource "' + h + '" "' + a + '" has not been declared in the root module.', at); }
    }
  };
  for (const r of [...cfg.resources, ...cfg.data]) {
    const sch = (r.mode === "data" ? DATA_SOURCES : SCHEMAS)[r.type];
    const blockName = (r.mode === "data" ? "data " : "resource ") + '"' + r.type + '" "' + r.name + '"';
    if (!sch) { const s = suggest(r.type, Object.keys(r.mode === "data" ? DATA_SOURCES : SCHEMAS)); push("Invalid " + (r.mode === "data" ? "data source" : "resource type"), "The provider " + (KNOWN_PROVIDERS[providerOf(r.type)] || "hashicorp/" + providerOf(r.type)) + " does not support " + (r.mode === "data" ? "data source" : "resource type") + ' "' + r.type + '".' + (s ? '\n\nDid you mean "' + s + '"?' : ""), r.at, { block: blockName }); continue; }
    const meta = ["count", "for_each", "depends_on", "provider", "lifecycle"];
    for (const [k, a] of Object.entries(r.body.attrs)) {
      if (meta.includes(k)) continue;
      if (!sch.args[k] || sch.args[k].t === "blk" || (sch.args[k].computed)) { const s = suggest(k, Object.keys(sch.args).filter((x) => !sch.args[x].computed)); push("Unsupported argument", 'An argument named "' + k + '" is not expected here.' + (s ? ' Did you mean "' + s + '"?' : ""), { ...r.at, line: a.line }, { block: blockName }); }
      checkRefs(a.expr, { ...r.at, line: a.line, block: blockName }, { count: "count" in r.body.attrs, each: "for_each" in r.body.attrs });
    }
    for (const sub of r.body.blocks) {
      if (sub.type === "lifecycle" || sub.type === "dynamic") continue;
      if (!sch.args[sub.type] || sch.args[sub.type].t !== "blk") push("Unsupported block type", 'Blocks of type "' + sub.type + '" are not expected here.' + (sch.args[sub.type] ? ' Did you mean to define argument "' + sub.type + '"? If so, use the equals sign to assign it a value.' : ""), { ...r.at, line: sub.line }, { block: blockName });
      for (const a of Object.values(sub.body.attrs)) checkRefs(a.expr, { ...r.at, line: a.line, block: blockName }, { count: "count" in r.body.attrs, each: "for_each" in r.body.attrs });
    }
    for (const [k, s] of Object.entries(sch.args)) if (s.req && !(k in r.body.attrs) && !r.body.blocks.some((b) => b.type === k)) push("Missing required argument", 'The argument "' + k + '" is required, but no definition was found.', r.at, { block: blockName });
    for (const d of (r.body.attrs.depends_on ? r.body.attrs.depends_on.expr.items || [] : [])) checkRefs(d, r.at, {});
  }
  for (const [n, o] of Object.entries(cfg.outputs)) { if (!o.body.attrs.value) push("Missing required argument", 'The argument "value" is required, but no definition was found.', o.at, { block: 'output "' + n + '"' }); else checkRefs(o.body.attrs.value.expr, { ...o.at, line: o.body.attrs.value.line, block: 'output "' + n + '"' }, {}); }
  for (const l of cfg.locals) checkRefs(l.expr, { ...l.at, block: "locals" }, {});
  for (const m of cfg.modules) for (const [k, a] of Object.entries(m.body.attrs)) if (k !== "source") checkRefs(a.expr, { ...m.at, line: a.line }, {});
  for (const [n, v] of Object.entries(cfg.variables)) for (const k of Object.keys(v.body.attrs)) if (!["type", "default", "description", "sensitive", "nullable"].includes(k)) push("Unsupported argument", 'An argument named "' + k + '" is not expected here.', { ...v.at, line: v.body.attrs[k].line }, { block: 'variable "' + n + '"' });
  return errs;
}

/* ===================== état ===================== */
function newState() { return { version: 4, terraform_version: "1.9.8", serial: 0, lineage: "3f1c2b7e-9a4d-4e21-8c6b-5d0e7a9f1b2c", outputs: {}, resources: [] }; }
const addrOf = (r, key) => (r.mod ? r.mod + "." : "") + (r.mode === "data" ? "data." : "") + r.type + "." + r.name + (key === undefined || key === null ? "" : typeof key === "number" ? "[" + key + "]" : '["' + key + '"]');

/* ===================== moteur ===================== */
class TF {
  constructor(sh) { this.sh = sh; this.acct = sh.aws; this.dir = sh.cwd; }
  stateLoc() {
    const cfg = this.cfg;
    if (cfg.backend && cfg.backend.type === "s3") return { remote: true, bucket: cfg.backend.attrs.bucket, key: cfg.backend.attrs.key, table: cfg.backend.attrs.dynamodb_table };
    return { remote: false, path: this.dir + "/terraform.tfstate" };
  }
  readState() {
    const L = this.stateLoc();
    let txt = null;
    if (L.remote) { const b = this.acct.s3[L.bucket]; if (!b) throw new TfErr("Failed to get existing workspaces: S3 bucket \"" + L.bucket + "\" does not exist.", "The referenced S3 bucket must have been previously created. If the S3 bucket\nwas created within the last minute, please wait for a minute or two and try\nagain.\n\nError: operation error S3: ListObjectsV2, https response error StatusCode: 404, api error NoSuchBucket: The specified bucket does not exist"); txt = b[L.key] || null; }
    else { try { txt = this.sh.fs.read(L.path, this.sh.user); } catch (e) { txt = null; } }
    return txt ? JSON.parse(txt) : newState();
  }
  writeState(st) {
    st.serial++; const L = this.stateLoc(); const txt = JSON.stringify(st, null, 2) + "\n";
    if (L.remote) { this.acct.s3[L.bucket][L.key] = txt; return; }
    const prev = (() => { try { return this.sh.fs.read(L.path, this.sh.user); } catch (e) { return null; } })();
    if (prev) this.sh.fs.write(L.path + ".backup", prev, this.sh.user);
    this.sh.fs.write(L.path, txt, this.sh.user);
  }
  lock(op, io) {
    const L = this.stateLoc(); if (!L.remote || !L.table) return true;
    const held = this.sh.tfLock;
    if (held) { io.err(box("Error acquiring the state lock", "Error message: operation error DynamoDB: PutItem, https response error\nStatusCode: 400, api error ConditionalCheckFailedException: The conditional\nrequest failed\nLock Info:\n  ID:        " + held.id + "\n  Path:      " + L.bucket + "/" + L.key + "\n  Operation: OperationTypeApply\n  Who:       " + held.who + "\n  Version:   1.9.8\n  Created:   2026-11-12 09:12:44.118423 +0000 UTC\n  Info:\n\n\nTerraform acquires a state lock to protect the state from being written\nby multiple users at the same time. Please resolve the issue above and try\nagain. For most commands, you can disable locking with the \"-lock=false\"\nflag, but this is not recommended.")); return false; }
    io.out("Acquiring state lock. This may take a few moments...\n"); return true;
  }
  /** Charge la configuration (et les modules locaux) et prépare l'évaluation. */
  load(io, varsCli = {}, varFiles = []) {
    this.cfg = loadConfig(this.sh, this.dir);
    const errs = validateConfig(this.cfg);
    this.mods = {};
    for (const m of this.cfg.modules) {
      const src = evaluate(m.body.attrs.source.expr, { file: m.at.file, ref: () => null });
      const p = this.sh.abs(this.dir + "/" + src);
      let mc; try { mc = loadConfig(this.sh, p, "module." + m.name); } catch (e) { errs.push(new TfErr("Unreadable module directory", "Unable to evaluate directory symlink: lstat " + src + ": no such file or directory", m.at)); continue; }
      errs.push(...validateConfig(mc)); this.mods[m.name] = { cfg: mc, call: m };
    }
    if (errs.length) { this.printErrs(errs, io); return false; }
    // Variables : CLI, fichiers .tfvars, défauts.
    const fromFiles = {};
    const tfvars = ["terraform.tfvars", ...(() => { try { return (this.sh.fs.list(this.dir, this.sh.user) || []).filter((n) => n.endsWith(".auto.tfvars")).sort(); } catch (e) { return []; } })()];
    for (const f of [...tfvars.map((x) => this.dir + "/" + x), ...varFiles.map((x) => this.sh.abs(x))]) {
      let txt; try { txt = this.sh.fs.read(f, this.sh.user); } catch (e) { if (varFiles.map((x) => this.sh.abs(x)).includes(f)) { this.printErrs([new TfErr("Failed to read variables file", "Given variables file " + f.replace(this.dir + "/", "") + " does not exist.")], io); return false; } continue; }
      const b = parseHcl(txt, f.split("/").pop());
      for (const [k, a] of Object.entries(b.attrs)) { if (!this.cfg.variables[k]) { io.err(box("Value for undeclared variable", 'The root module does not declare a variable named "' + k + '" but a value was found in file "' + f.split("/").pop() + '". If you meant to use this value, add a "variable" block to the configuration.\n\nTo silence these warnings, use TF_VAR_... environment variables to provide certain "global" settings to all configurations in your organization. To reduce the verbosity of these warnings, use the -compact-warnings option.').replace("Error:", "Warning:")); continue; } fromFiles[k] = evaluate(a.expr, { file: f, ref: () => null }); }
    }
    this.vars = {};
    for (const [k, v] of Object.entries(this.cfg.variables)) {
      const typ = v.body.attrs.type ? srcOf(v.body.attrs.type.expr) : "any";
      let val = k in varsCli ? varsCli[k] : k in fromFiles ? fromFiles[k] : v.body.attrs.default ? evaluate(v.body.attrs.default.expr, { file: v.at.file, ref: () => null }) : undefined;
      if (val === undefined) { this.printErrs([new TfErr("No value for required variable", 'The root module input variable "' + k + '" is not set, and has no default value. Use a -var or -var-file command line argument to provide a value for this variable.', v.at)], io); return false; }
      if (typ === "number" && typeof val === "string") { if (Number.isNaN(+val)) { this.printErrs([new TfErr("Invalid value for input variable", 'The given value is not suitable for var.' + k + ' declared at ' + v.at.file + ':' + v.at.line + ',1-' + (13 + k.length) + ': a number is required.')], io); return false; } val = +val; }
      if (typ === "bool" && typeof val === "string") val = val === "true";
      for (const vb of v.body.blocks.filter((b) => b.type === "validation")) {
        const ok = evaluate(vb.body.attrs.condition.expr, { file: v.at.file, ref: (n) => (n === "var" ? { [k]: val } : null) });
        if (!ok) { this.printErrs([new TfErr("Invalid value for variable", evaluate(vb.body.attrs.error_message.expr, { file: v.at.file, ref: () => null }) + "\n\nThis was checked by the validation rule at " + v.at.file + ":" + vb.line + ",3-13.", { ...v.at, line: vb.body.attrs.condition.line, block: 'variable "' + k + '"' })], io); return false; }
      }
      this.vars[k] = val;
    }
    return true;
  }
  printErrs(errs, io) {
    for (const e of errs) {
      if (e instanceof HclErr) io.err(e.render(e.src || (this.cfg && this.cfg.files[e.file])));
      else io.err(box(e.title, e.detail, e.where, e.where && this.cfg && (this.cfg.files[e.where.file] || (e.where.src))));
    }
  }

  /** Expansion : instances voulues de chaque ressource, avec leurs arguments évalués (inconnus si dépendance non créée). */
  desired(state, opts = {}) {
    const insts = []; const values = {}; const locals = {}; const sh = this.sh; const self = this;
    const allRes = [...this.cfg.resources, ...this.cfg.data].map((r) => ({ ...r, mod: "" }));
    for (const [mn, m] of Object.entries(this.mods)) allRes.push(...[...m.cfg.resources, ...m.cfg.data].map((r) => ({ ...r, mod: "module." + mn, modName: mn })));
    // Ordre topologique selon les références et depends_on.
    const key = (r) => (r.mod ? r.mod + "." : "") + (r.mode === "data" ? "data." : "") + r.type + "." + r.name;
    const deps = new Map(allRes.map((r) => [key(r), new Set()]));
    for (const r of allRes) {
      const all = [...Object.values(r.body.attrs).map((a) => a.expr), ...r.body.blocks.flatMap((b) => Object.values(b.body.attrs).map((a) => a.expr))];
      for (const e of all) for (const ref of refsOf(e)) {
        const k = ref[0] === "data" ? (r.mod ? r.mod + "." : "") + "data." + ref[1] + "." + ref[2] : (r.mod ? r.mod + "." : "") + ref[0] + "." + ref[1];
        if (deps.has(k) && k !== key(r)) deps.get(key(r)).add(k);
        if (ref[0] === "module" && !r.mod) for (const o of allRes) if (o.mod === "module." + ref[1]) deps.get(key(r)).add(key(o));
        if (ref[0] === "local" || ref[0] === "var") {
          const cfg = r.mod ? this.mods[r.modName].cfg : this.cfg;
          const walk = (name, seen = new Set()) => { if (seen.has(name)) return; seen.add(name); const l = cfg.locals.find((x) => x.name === name); if (!l) return; for (const rr of refsOf(l.expr)) { const kk = (r.mod ? r.mod + "." : "") + (rr[0] === "data" ? "data." + rr[1] + "." + rr[2] : rr[0] + "." + rr[1]); if (deps.has(kk)) deps.get(key(r)).add(kk); if (rr[0] === "local") walk(rr[1], seen); } };
          if (ref[0] === "local") walk(ref[1]);
          if (ref[0] === "var" && r.mod) { const call = this.mods[r.modName].call; const a = call.body.attrs[ref[1]]; if (a) for (const rr of refsOf(a.expr)) { const kk = rr[0] === "data" ? "data." + rr[1] + "." + rr[2] : rr[0] + "." + rr[1]; if (deps.has(kk)) deps.get(key(r)).add(kk); } }
        }
      }
    }
    const order = []; const mark = {};
    const visit = (k, stack) => { if (mark[k] === 2) return; if (mark[k] === 1) throw new TfErr("Cycle: " + [...stack.slice(stack.indexOf(k)), k].join(", "), ""); mark[k] = 1; for (const d of deps.get(k)) visit(d, [...stack, k]); mark[k] = 2; order.push(k); };
    for (const k of deps.keys()) visit(k, []);
    this.order = order;
    const byKey = Object.fromEntries(allRes.map((r) => [key(r), r]));
    const stateRes = (k) => state.resources.find((x) => addrOf({ ...x, mod: x.module || "" }) === k);
    // Valeurs déjà connues : état existant, puis remplacées par le plan.
    const known = {}; // adresse d'instance -> attributs (ou Unknown)
    const valueOf = (mod, type, name) => {
      const k = (mod ? mod + "." : "") + type + "." + name; const r = byKey[k];
      const list = insts.filter((i) => i.key === k);
      if (!r) return undefined;
      if ("count" in r.body.attrs) return list.map((i) => known[i.addr]);
      if ("for_each" in r.body.attrs) return Object.fromEntries(list.map((i) => [i.idx, known[i.addr]]));
      return list[0] ? known[list[0].addr] : undefined;
    };
    const scopeFor = (mod, extra = {}) => {
      const cfg = mod ? this.mods[mod.replace("module.", "")].cfg : this.cfg;
      const modVars = mod ? this.modVars[mod] : this.vars;
      const loc = locals[mod] = locals[mod] || {};
      const sc = {
        file: "main.tf",
        readFile: (p, node) => { try { return sh.fs.read(sh.abs(String(p).replace("${path.module}", cfg.dir)), sh.user); } catch (e) { throw new HclErr("Invalid function argument", 'Invalid value for "path" parameter: no file exists at "' + p + '"; this function works only with files that are distributed as part of the configuration source code, so if this file will be created by a resource in this configuration you must instead obtain this result from an attribute of that resource.', "main.tf", node.line); } },
        ref: (n, node) => {
          if (n in extra) return extra[n];
          if (n === "var") return modVars;
          if (n === "local") return new Proxy({}, { get: (_, p) => { if (typeof p !== "string") return undefined; if (!(p in loc)) { const l = cfg.locals.find((x) => x.name === p); loc[p] = evaluate(l.expr, sc); } return loc[p]; }, has: (_, p) => cfg.locals.some((x) => x.name === p) });
          if (n === "path") return { module: cfg.dir, root: this.dir, cwd: this.dir };
          if (n === "terraform") return { workspace: "default" };
          if (n === "data") return new Proxy({}, { get: (_, t) => new Proxy({}, { get: (__, nm) => valueOf(mod, "data." + t, nm), has: () => true }) });
          if (n === "module") return new Proxy({}, { get: (_, mn) => { if (!this.mods[mn]) return undefined; const out = {}; for (const [on, o] of Object.entries(this.mods[mn].cfg.outputs)) out[on] = evaluate(o.body.attrs.value.expr, scopeFor("module." + mn)); return out; } });
          if (SCHEMAS[n]) return new Proxy({}, { get: (_, nm) => valueOf(mod, n, nm), has: (_, nm) => !!byKey[(mod ? mod + "." : "") + n + "." + nm] });
          throw new HclErr("Invalid reference", 'A reference to a resource type must be followed by at least one attribute access, specifying the resource name.', "main.tf", node.line);
        }
      };
      return sc;
    };
    this.modVars = {};
    for (const [mn, m] of Object.entries(this.mods)) {
      const vals = {};
      for (const [vn, v] of Object.entries(m.cfg.variables)) { const a = m.call.body.attrs[vn]; vals[vn] = a ? evaluate(a.expr, scopeFor("")) : v.body.attrs.default ? evaluate(v.body.attrs.default.expr, { file: "variables.tf", ref: () => null }) : (() => { throw new TfErr("Missing required argument", 'The argument "' + vn + '" is required, but no definition was found.', { ...m.call.at, block: 'module "' + mn + '"' }); })(); }
      this.modVars["module." + mn] = vals;
    }
    for (const k of order) {
      const r = byKey[k]; const sc = scopeFor(r.mod);
      let idxs = [null];
      if (r.body.attrs.count) { const c = evaluate(r.body.attrs.count.expr, sc); if (c instanceof Unknown) throw new TfErr("Invalid count argument", 'The "count" value depends on resource attributes that cannot be determined until apply, so Terraform cannot predict how many instances will be created. To work around this, use the -target argument to first apply only the resources that the count depends on.', { ...r.at, line: r.body.attrs.count.line, block: 'resource "' + r.type + '" "' + r.name + '"' }); idxs = Array.from({ length: c }, (_, i) => i); }
      if (r.body.attrs.for_each) { const fe = evaluate(r.body.attrs.for_each.expr, sc); if (Array.isArray(fe) && fe.some((x) => typeof x !== "string")) throw new TfErr("Invalid for_each argument", 'The given "for_each" argument value is unsuitable: the "for_each" argument must be a map, or set of strings, and you have provided a value of type list of object.', { ...r.at, line: r.body.attrs.for_each.line }); idxs = Array.isArray(fe) ? fe : Object.keys(fe); r.feMap = Array.isArray(fe) ? Object.fromEntries(fe.map((x) => [x, x])) : fe; }
      for (const idx of idxs) {
        const addr = addrOf(r, idx);
        const extra = {}; if (r.body.attrs.count) extra.count = { index: idx }; if (r.body.attrs.for_each) extra.each = { key: idx, value: r.feMap[idx] };
        const s2 = scopeFor(r.mod, extra);
        const sch = (r.mode === "data" ? DATA_SOURCES : SCHEMAS)[r.type];
        const args = {};
        for (const [a, at] of Object.entries(r.body.attrs)) { if (["count", "for_each", "depends_on", "provider", "lifecycle"].includes(a)) continue; try { args[a] = evaluate(at.expr, s2); } catch (e) { if (e instanceof HclErr) { e.file = r.at.file; e.line = at.line; e.block = 'resource "' + r.type + '" "' + r.name + '"'; e.src = (r.mod ? this.mods[r.modName].cfg : this.cfg).files[r.at.file]; } throw e; } }
        for (const b of r.body.blocks) { if (b.type === "lifecycle") continue; const o = {}; for (const [a, at] of Object.entries(b.body.attrs)) o[a] = evaluate(at.expr, s2); (args[b.type] = args[b.type] || []).push(o); }
        const life = r.body.blocks.find((b) => b.type === "lifecycle");
        const inst = { key: k, addr, idx, r, args, sch, prevent: life && life.body.attrs.prevent_destroy ? evaluate(life.body.attrs.prevent_destroy.expr, s2) : false, ignore: life && life.body.attrs.ignore_changes ? refsOf(life.body.attrs.ignore_changes.expr).map((x) => x[0]) : [] };
        insts.push(inst);
        // Valeurs connues pour les dépendants.
        const prev = stateRes(k); const pi = prev && prev.instances.find((x) => (x.index_key ?? null) === idx);
        if (r.mode === "data") { known[addr] = this.readData(r.type, args); continue; }
        const change = pi ? this.diff(inst, pi.attributes) : null;
        if (pi && change && !change.replace) known[addr] = { ...pi.attributes, ...Object.fromEntries(Object.entries(args).filter(([, v]) => !isUnknown(v))) };
        else if (pi && !change) known[addr] = pi.attributes;
        else known[addr] = this.unknownAttrs(inst);
      }
    }
    const outputs = {};
    for (const [n, o] of Object.entries(this.cfg.outputs)) { try { outputs[n] = { value: evaluate(o.body.attrs.value.expr, scopeFor("")), sensitive: o.body.attrs.sensitive ? evaluate(o.body.attrs.sensitive.expr, scopeFor("")) : false }; } catch (e) { if (e instanceof HclErr) { e.file = o.at.file; e.line = o.body.attrs.value.line; e.src = this.cfg.files[o.at.file]; e.block = 'output "' + n + '"'; } throw e; } }
    return { insts, outputs, known };
  }
  unknownAttrs(inst) { const o = {}; for (const [k, s] of Object.entries(inst.sch.args)) o[k] = k in inst.args ? inst.args[k] : s.computedIfUnset ? new Unknown() : s.def !== undefined ? s.def : null; for (const c of inst.sch.computed || []) o[c] = new Unknown(); if (inst.sch.args.tags) o.tags_all = new Unknown(); return o; }
  readData(type, a) {
    if (type === "aws_caller_identity") return { id: ACCOUNT_ID, account_id: ACCOUNT_ID, arn: "arn:aws:iam::" + ACCOUNT_ID + ":user/eleve", user_id: "AIDAEXEMPLE7ELEVE" };
    if (type === "aws_region") return { id: REGION, name: REGION, description: "Canada (Central)" };
    if (type === "aws_availability_zones") return { id: REGION, names: AZS, zone_ids: ["cac1-az1", "cac1-az2", "cac1-az4"] };
    if (type === "aws_ami") { const f = (a.filter || []).find((x) => x.name === "name"); const pat = f ? new RegExp("^" + String(f.values[0]).replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$") : /.*/; const hit = Object.entries(AMIS).find(([, n]) => pat.test(n)); if (!hit) throw new TfErr("Your query returned no results. Please change your search criteria and try again.", ""); return { id: hit[0], image_id: hit[0], name: hit[1], architecture: "x86_64" }; }
    if (type === "aws_vpc") { const v = this.acct.defaultVpc(); return { id: v.id, cidr_block: v.attrs.cidr_block, arn: v.attrs.arn }; }
    return {};
  }
  /** Comparaison avec l'état : null (aucun changement), { update: [...] } ou { replace: [...] }. */
  diff(inst, prev) {
    const changed = []; const forces = [];
    for (const [k, s] of Object.entries(inst.sch.args)) {
      if (s.computed || inst.ignore.includes(k)) continue;
      let want = k in inst.args ? inst.args[k] : s.def !== undefined ? s.def : s.computedIfUnset ? prev[k] : null;
      if (s.t === "j" && typeof want === "string" && typeof prev[k] === "string") { try { if (JSON.stringify(JSON.parse(want)) === JSON.stringify(JSON.parse(prev[k]))) continue; } catch (e) { /* comparer tel quel */ } }
      if (s.t === "m" && want === null) want = {};
      if (s.t === "blk" && want === null) want = [];
      if (JSON.stringify(want ?? null) !== JSON.stringify(prev[k] ?? (s.t === "m" ? {} : s.t === "blk" ? [] : null))) { changed.push(k); if (s.fn) forces.push(k); }
    }
    if (!changed.length) return null;
    return forces.length ? { replace: forces, changed } : { update: changed, changed };
  }

  /** Plan complet : actions par instance, sorties. */
  plan(state, destroy = false) {
    const d = this.desired(state);
    const actions = [];
    const wanted = new Set(d.insts.map((i) => i.addr));
    if (!destroy) for (const i of d.insts) {
      if (i.r.mode === "data") continue;
      const prev = state.resources.find((x) => addrOf({ ...x, mod: x.module || "" }) === i.key); const pi = prev && prev.instances.find((x) => (x.index_key ?? null) === i.idx);
      if (!pi) { actions.push({ act: "create", inst: i, after: d.known[i.addr] }); continue; }
      const ch = this.diff(i, pi.attributes); if (!ch) continue;
      if (ch.replace && i.prevent) throw new TfErr("Instance cannot be destroyed", "Resource " + i.addr + " has lifecycle.prevent_destroy set, but the plan calls for this resource to be destroyed. To avoid this error and continue with the plan, either disable lifecycle.prevent_destroy or reduce the scope of the plan using the -target option.", { ...i.r.at, block: 'resource "' + i.r.type + '" "' + i.r.name + '"' });
      actions.push({ act: ch.replace ? "replace" : "update", inst: i, before: pi.attributes, after: ch.replace ? this.unknownAttrs(i) : { ...pi.attributes, ...i.args }, ch });
    }
    for (const sr of state.resources.filter((x) => x.mode !== "data")) for (const pi of sr.instances) {
      const addr = addrOf({ ...sr, mod: sr.module || "" }, pi.index_key ?? null);
      if (!destroy && wanted.has(addr)) continue;
      const inst = d.insts.find((x) => x.addr === addr);
      if (inst && inst.prevent) throw new TfErr("Instance cannot be destroyed", "Resource " + addr + " has lifecycle.prevent_destroy set, but the plan calls for this resource to be destroyed. To avoid this error and continue with the plan, either disable lifecycle.prevent_destroy or reduce the scope of the plan using the -target option.", inst.r.at);
      actions.push({ act: "delete", addr, sr, pi, why: destroy ? null : "because " + (inst ? "" : addr.replace(/\[.*\]$/, "") === addr ? addr + " is not in configuration" : "index " + JSON.stringify(pi.index_key) + " is out of range for count") });
    }
    // Ordre : suppressions en ordre inverse, créations dans l'ordre du graphe.
    const pos = (a) => this.order.indexOf(a.inst ? a.inst.key : addrOf({ ...a.sr, mod: a.sr.module || "" }));
    actions.sort((a, b) => (a.act === "delete") - (b.act === "delete") || (a.act === "delete" ? pos(b) - pos(a) : pos(a) - pos(b)));
    const outs = Object.entries(d.outputs).map(([n, o]) => { const prev = state.outputs[n]; return { n, o, act: !prev ? "+" : JSON.stringify(prev.value) !== JSON.stringify(o.value) || isUnknown(o.value) ? "~" : null, prev }; });
    return { actions, outputs: d.outputs, outChanges: (destroy ? Object.keys(state.outputs).map((n) => ({ n, act: "-", prev: state.outputs[n] })) : outs.filter((x) => x.act).concat(Object.keys(state.outputs).filter((n) => !d.outputs[n]).map((n) => ({ n, act: "-", prev: state.outputs[n] })))).sort((a, b) => a.n.localeCompare(b.n)), insts: d.insts };
  }

  /* ----- affichage du plan ----- */
  render(p, destroy) {
    if (!p.actions.length && !p.outChanges.length) return "\nNo changes. Your infrastructure matches the configuration.\n\nTerraform has compared your real infrastructure against your configuration\nand found no differences, so no changes are needed.\n";
    const sym = { create: "+", update: "~", replace: "-/+", delete: "-" };
    const kinds = [...new Set(p.actions.map((a) => a.act))];
    let out = "\nTerraform used the selected providers to generate the following execution\nplan. Resource actions are indicated with the following symbols:\n" + ["create", "update", "delete", "replace"].filter((k) => kinds.includes(k)).map((k) => ({ create: "  + create", update: "  ~ update in-place", delete: "  - destroy", replace: "-/+ destroy and then create replacement" })[k]).join("\n") + "\n";
    if (p.actions.length) out += "\nTerraform will perform the following actions:\n";
    for (const a of p.actions) {
      const addr = a.inst ? a.inst.addr : a.addr; const type = a.inst ? a.inst.r.type : a.sr.type; const name = a.inst ? a.inst.r.name : a.sr.name;
      out += "\n  # " + addr + " " + ({ create: "will be created", update: "will be updated in-place", replace: "must be replaced", delete: "will be destroyed" })[a.act] + "\n" + (a.why ? "  # (" + a.why + ")\n" : "");
      out += (a.act === "replace" ? "-/+" : "  " + sym[a.act]) + ' resource "' + type + '" "' + name + '" {\n';
      const sch = SCHEMAS[type];
      const attrs = a.act === "delete" ? a.pi.attributes : a.after;
      const keys = Object.keys(attrs).filter((k) => sch.args[k] || (sch.computed || []).includes(k) || k === "tags_all").sort();
      const w = Math.max(...keys.map((k) => k.length));
      const lines = [];
      let hidden = 0;
      for (const k of keys) {
        const v = attrs[k]; const before = a.before ? a.before[k] : undefined;
        if (v === null && a.act !== "delete") continue;
        if (Array.isArray(v) && !v.length && sch.args[k] && sch.args[k].t === "blk" && a.act === "create") continue;
        const sens = sch.args[k] && sch.args[k].sensitive || (sch.sensitiveAttrs || []).includes(k);
        if (a.act === "update" || a.act === "replace") {
          const same = JSON.stringify(before) === JSON.stringify(v) && !(v instanceof Unknown);
          if (same) { if (k !== "id" && k !== "tags") { hidden++; continue; } }
          const mark = same ? "   " : v instanceof Unknown ? "~ " : before === undefined || before === null ? "+ " : "~ ";
          const force = a.ch && a.ch.replace && a.ch.replace.includes(k) ? " # forces replacement" : "";
          if (same) { lines.push("        " + k.padEnd(w) + " = " + fmtVal(v, 8, " ", sens)); continue; }
          lines.push("      " + (mark.trim() || " ") + " " + k.padEnd(w) + " = " + (before !== undefined && before !== null && !(v instanceof Unknown && false) ? fmtVal(before, 8, " ", sens) + " -> " : "") + fmtVal(v, 8, "+", sens) + force);
          continue;
        }
        const m = sym[a.act] === "-" ? "-" : "+";
        if (sch.args[k] && sch.args[k].t === "blk" && Array.isArray(v)) { for (const blk of v) { lines.push("      " + m + " " + k + " {"); const bw = Math.max(...Object.keys(blk).map((x) => x.length)); for (const [bk, bv] of Object.entries(blk).sort()) lines.push("          " + m + " " + bk.padEnd(bw) + " = " + fmtVal(bv, 12, m, false)); lines.push("        }"); } continue; }
        lines.push("      " + m + " " + k.padEnd(w) + " = " + fmtVal(v, 8, m, sens));
      }
      if (hidden) lines.push("        # (" + hidden + " unchanged attribute" + (hidden > 1 ? "s" : "") + " hidden)");
      out += lines.join("\n") + "\n    }\n";
    }
    const c = (k) => p.actions.filter((a) => a.act === k).length;
    if (p.actions.length) out += "\nPlan: " + (c("create") + c("replace")) + " to add, " + c("update") + " to change, " + (c("delete") + c("replace")) + " to destroy.\n";
    if (p.outChanges.length) { out += "\nChanges to Outputs:\n"; const w = Math.max(...p.outChanges.map((x) => x.n.length)); for (const o of p.outChanges) out += "  " + o.act + " " + o.n.padEnd(w) + " = " + (o.act === "-" ? fmtVal(o.prev.value, 4, "-", o.prev.sensitive) + " -> null" : o.act === "~" && o.prev ? fmtVal(o.prev.value, 4, " ", o.prev.sensitive) + " -> " + fmtVal(o.o.value, 4, "+", o.o.sensitive) : fmtVal(o.o.value, 4, "+", o.o.sensitive)) + "\n"; }
    return out;
  }

  /* ----- application ----- */
  apply(p, io, destroy) {
    const st = this.state; let added = 0, changed = 0, destroyed = 0; let failed = null;
    const findRes = (key) => { let r = st.resources.find((x) => addrOf({ ...x, mod: x.module || "" }) === key); return r; };
    const elapsed = (t) => (t === "aws_instance" ? "13s" : t === "aws_db_instance" ? "4m12s" : t === "aws_nat_gateway" ? "1m35s" : t.startsWith("aws_") ? "2s" : "0s");
    for (const a of p.actions) {
      const addr = a.inst ? a.inst.addr : a.addr;
      try {
        if (a.act === "delete" || a.act === "replace") {
          const pi = a.act === "delete" ? a.pi : findRes(a.inst.key).instances.find((x) => (x.index_key ?? null) === a.inst.idx);
          const type = a.act === "delete" ? a.sr.type : a.inst.r.type;
          io.out(addr + ": Destroying... [id=" + pi.attributes.id + "]\n");
          this.deleteObj(type, pi.attributes);
          io.out(addr + ": Destruction complete after " + elapsed(type).replace(/^(4m12s|13s)$/, "3s") + "\n"); destroyed++;
          const sr = a.act === "delete" ? a.sr : findRes(a.inst.key);
          sr.instances = sr.instances.filter((x) => x !== pi); if (!sr.instances.length) st.resources = st.resources.filter((x) => x !== sr);
          if (a.act === "delete") continue;
        }
        const i = a.inst; const args = this.evalAgain(i);
        if (a.act === "create" || a.act === "replace") {
          io.out(addr + ": Creating...\n");
          const attrs = this.createObj(i.r.type, args, i);
          io.out(addr + ": Creation complete after " + elapsed(i.r.type) + " [id=" + attrs.id + "]\n"); added++;
          let sr = findRes(i.key); if (!sr) { sr = { mode: "managed", type: i.r.type, name: i.r.name, provider: 'provider["registry.terraform.io/' + KNOWN_PROVIDERS[providerOf(i.r.type)] + '"]', instances: [] }; if (i.r.mod) sr.module = i.r.mod; st.resources.push(sr); }
          sr.instances.push({ ...(i.idx !== null ? { index_key: i.idx } : {}), schema_version: 0, attributes: attrs, sensitive_attributes: [] });
        } else if (a.act === "update") {
          io.out(addr + ": Modifying... [id=" + a.before.id + "]\n");
          const attrs = this.updateObj(i.r.type, a.before, args);
          io.out(addr + ": Modifications complete after 1s [id=" + attrs.id + "]\n"); changed++;
          const sr = findRes(i.key); const pi = sr.instances.find((x) => (x.index_key ?? null) === i.idx); pi.attributes = attrs;
        }
        this.state = st; this.writeState(st);
      } catch (e) {
        if (!(e instanceof AwsErr) && !(e instanceof TfErr)) throw e;
        failed = { e, a, addr }; break;
      }
    }
    // Sorties, recalculées après application.
    if (!failed) { st.outputs = {}; if (!destroy) { const d = this.desired(st); for (const [n, o] of Object.entries(d.outputs)) st.outputs[n] = { value: o.value, type: typeof o.value === "number" ? "number" : Array.isArray(o.value) ? ["tuple", []] : typeof o.value === "object" ? ["object", {}] : "string", ...(o.sensitive ? { sensitive: true } : {}) }; } }
    this.writeState(st);
    if (failed) {
      const { e, a, addr } = failed; const r = a.inst ? a.inst.r : null;
      if (e instanceof AwsErr) io.err(box((a.act === "delete" ? "deleting " : a.act === "update" ? "updating " : "creating ") + humanType(r ? r.type : a.sr.type) + (a.act === "delete" ? " (" + a.pi.attributes.id + ")" : "") + ": operation error " + e.op + ", https response error StatusCode: " + e.status + ", RequestID: 6f1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d, api error " + e.code + ": " + e.message, "", r ? { with: addr, file: r.at.file, line: r.at.line, block: 'resource "' + r.type + '" "' + r.name + '"' } : null, r && (r.mod ? this.mods[r.modName].cfg : this.cfg).files[r.at.file]));
      else io.err(box(e.title, e.detail, e.where));
      return 1;
    }
    io.out("\n" + (destroy ? "Destroy complete! Resources: " + destroyed + " destroyed.\n" : "Apply complete! Resources: " + added + " added, " + changed + " changed, " + destroyed + " destroyed.\n"));
    if (!destroy && Object.keys(st.outputs).length) io.out("\nOutputs:\n\n" + Object.entries(st.outputs).sort(([a], [b]) => a.localeCompare(b)).map(([n, o]) => n + " = " + fmtVal(o.value, 0, " ", o.sensitive)).join("\n") + "\n");
    return 0;
  }
  evalAgain(inst) {
    // Les références vers des ressources tout juste créées sont maintenant connues.
    const d = this.desired(this.state); const fresh = d.insts.find((x) => x.addr === inst.addr);
    return fresh ? fresh.args : inst.args;
  }
  createObj(type, a, inst) {
    if (type === "local_file") { try { this.sh.fs.write(this.sh.abs(a.filename), a.content ?? "", this.sh.user); } catch (e) { throw new TfErr("Create local file error", "An unexpected error occurred while writing the file\n\n+Original Error: open " + a.filename + ": permission denied"); } const id = "a1b2c3d4e5f6" + String(a.content || "").length; return { ...a, file_permission: a.file_permission || "0777", id }; }
    const sch = SCHEMAS[type]; const full = { ...a };
    for (const [k, s] of Object.entries(sch.args)) if (full[k] === undefined && s.def !== undefined) full[k] = s.def;
    if (type === "aws_s3_bucket" && !full.bucket) full.bucket = (full.bucket_prefix || "terraform-") + "20261112093000123400000001";
    if (type === "aws_iam_role" && !full.name) full.name = "terraform-20261112093000123400000002";
    if (type === "aws_db_instance" && !full.identifier) full.identifier = "terraform-20261112093000123400000003";
    if (!type.startsWith("random_")) this.acct.check(type, full, null);
    const r = this.acct.put(type, full, { managed: true });
    const out = {}; for (const k of Object.keys(sch.args)) out[k] = r.attrs[k] ?? null; for (const k of sch.computed || []) out[k] = r.attrs[k] ?? null; if (sch.args.tags) out.tags_all = r.attrs.tags_all;
    return out;
  }
  updateObj(type, before, a) {
    if (type.startsWith("random_") || type === "local_file") return { ...before, ...a };
    const r = this.acct.byId(before.id) || this.acct.get(type, before.id); const merged = { ...before, ...a };
    this.acct.check(type, merged, r || true);
    if (r) { Object.assign(r.attrs, a); if (a.tags) r.attrs.tags_all = { ...a.tags }; }
    return { ...merged, tags_all: a.tags ? { ...a.tags } : before.tags_all };
  }
  deleteObj(type, attrs) {
    if (type === "local_file") { try { this.sh.run("rm -f " + attrs.filename, { record: false }); } catch (e) { /* déjà absent */ } return; }
    if (type.startsWith("random_")) return;
    const r = this.acct.get(type, attrs.id) || this.acct.byId(attrs.id); if (!r) return;
    this.acct.checkDelete(r); this.acct.remove(type, r.id);
  }
}
const humanType = (t) => ({ aws_vpc: "EC2 VPC", aws_subnet: "EC2 Subnet", aws_instance: "EC2 Instance", aws_security_group: "Security Group", aws_s3_bucket: "S3 Bucket", aws_iam_role: "IAM Role", aws_iam_policy: "IAM Policy", aws_db_instance: "RDS DB Instance", aws_dynamodb_table: "AWS DynamoDB Table" })[t] || t;
function srcOf(e) { return e.k === "ref" ? e.name : e.k === "call" ? e.fn + "(" + e.args.map(srcOf).join(", ") + ")" : "any"; }
export function fmtVal(v, ind, m, sens) {
  if (sens) return "(sensitive value)";
  if (v instanceof Unknown) return "(known after apply)";
  if (v === null || v === undefined) return "null";
  if (typeof v === "string") return v.includes("\n") ? "<<-EOT\n" + v.replace(/\n$/, "").split("\n").map((l) => " ".repeat(ind + 4) + l).join("\n") + "\n" + " ".repeat(ind + 2) + "EOT" : JSON.stringify(v);
  if (typeof v !== "object") return String(v);
  const pad = " ".repeat(ind + 2); const sym = m === " " ? "  " : m + " ";
  if (Array.isArray(v)) return v.length ? "[\n" + v.map((x) => pad + sym + fmtVal(x, ind + 4, m, false) + ",").join("\n") + "\n" + " ".repeat(ind) + "]" : "[]";
  const ks = Object.keys(v).sort(); if (!ks.length) return "{}";
  const w = Math.max(...ks.map((k) => JSON.stringify(k).length));
  return "{\n" + ks.map((k) => pad + sym + JSON.stringify(k).padEnd(w) + " = " + fmtVal(v[k], ind + 4, m, false)).join("\n") + "\n" + " ".repeat(ind) + "}";
}

/* ===================== fmt ===================== */
export function fmtHcl(src) {
  const lines = src.replace(/\t/g, "  ").split("\n"); const out = []; let depth = 0;
  for (const raw of lines) {
    const l = raw.trim();
    if (/^[}\]]/.test(l)) depth = Math.max(0, depth - 1);
    out.push(l ? "  ".repeat(depth) + l.replace(/\s*=\s*/, (m) => (/^[\w-]+\s*=/.test(l) || /^"[^"]*"\s*=/.test(l) ? " = " : m)) : "");
    const opens = (l.replace(/"(?:[^"\\]|\\.)*"/g, "").match(/[{[(]/g) || []).length; const closes = (l.replace(/"(?:[^"\\]|\\.)*"/g, "").match(/[}\])]/g) || []).length;
    depth += opens - closes + (/^[}\]]/.test(l) ? 1 : 0);
  }
  // Aligne les « = » des attributs consécutifs d'un même niveau.
  const res = []; let group = [];
  const flush = () => { if (group.length > 1) { const w = Math.max(...group.map((g) => g.key.length)); for (const g of group) res[g.i] = g.ind + g.key.padEnd(w) + " = " + g.val; } group = []; };
  out.forEach((l, i) => {
    res.push(l); const m = /^(\s*)([\w-]+|"[^"]*")\s=\s(.*)$/.exec(l);
    if (m && !/[{[(]$/.test(m[3]) || m && /^\{\s*$/.test(m[3]) === false && /[{[(]$/.test(m[3]) && false) { if (group.length && group[0].ind !== m[1]) flush(); group.push({ i, ind: m[1], key: m[2], val: m[3] }); }
    else if (m) { if (group.length && group[0].ind !== m[1]) flush(); group.push({ i, ind: m[1], key: m[2], val: m[3] }); flush(); }
    else flush();
  });
  flush();
  return res.join("\n").replace(/\n{3,}/g, "\n\n").replace(/\s*$/, "\n");
}

/* ===================== la commande ===================== */
function parseFlags(args) {
  const o = { _: [], vars: {}, varFiles: [], auto: false, json: false, raw: false, check: false, destroy: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i]; const [k, v] = a.includes("=") && a.startsWith("-") ? [a.slice(0, a.indexOf("=")), a.slice(a.indexOf("=") + 1)] : [a, undefined];
    if (k === "-var") { const kv = v !== undefined ? v : args[++i]; const j = kv.indexOf("="); o.vars[kv.slice(0, j)] = kv.slice(j + 1); }
    else if (k === "-var-file") o.varFiles.push(v !== undefined ? v : args[++i]);
    else if (k === "-auto-approve") o.auto = true; else if (k === "-json") o.json = true; else if (k === "-raw") o.raw = true;
    else if (k === "-check") o.check = true; else if (k === "-destroy") o.destroy = true; else if (k === "-out") o.out = v ?? args[++i];
    else if (k === "-lock" || k === "-input" || k === "-no-color" || k === "-upgrade" || k === "-reconfigure" || k === "-recursive" || k === "-diff") { /* sans effet ici */ }
    else if (k === "-migrate-state") o.migrate = true; else if (k === "-force") o.force = true;
    else o._.push(a);
  }
  return o;
}
function terraform(sh, args, io) {
  if (!sh.packages.has("terraform")) { io.err("Command 'terraform' not found, but can be installed with:\nsudo snap install terraform --classic\n"); return 127; }
  const cmd = args[0]; const o = parseFlags(args.slice(1)); const tf = new TF(sh);
  try {
    switch (cmd) {
      case "version": case "-version": case "--version": io.out("Terraform v1.9.8\non linux_amd64\n"); return 0;
      case undefined: case "-help": case "--help": io.out("Usage: terraform [global options] <subcommand> [args]\n\nMain commands:\n  init          Prepare your working directory for other commands\n  validate      Check whether the configuration is valid\n  plan          Show changes required by the current configuration\n  apply         Create or update infrastructure\n  destroy       Destroy previously-created infrastructure\n\nAll other commands:\n  fmt           Reformat your configuration in the standard style\n  import        Associate existing infrastructure with a Terraform resource\n  output        Show output values from your root module\n  state         Advanced state management\n"); return 0;
      case "init": {
        tf.cfg = loadConfig(sh, tf.dir);
        const used = new Set([...tf.cfg.resources, ...tf.cfg.data].map((r) => providerOf(r.type)));
        for (const p of Object.keys(tf.cfg.required)) used.add(p);
        let out = "";
        if (tf.cfg.backend) {
          out += "\nInitializing the backend...\n";
          if (tf.cfg.backend.type === "s3") {
            const b = tf.cfg.backend.attrs; if (!sh.aws.s3[b.bucket]) { io.out(out); io.err(box("Failed to get existing workspaces: S3 bucket \"" + b.bucket + "\" does not exist.", "The referenced S3 bucket must have been previously created. If the S3 bucket\nwas created within the last minute, please wait for a minute or two and try\nagain.\n\nError: operation error S3: ListObjectsV2, https response error StatusCode: 404, RequestID: 8f2a1c6b9d3e4f50, HostID: , api error NoSuchBucket: The specified bucket does not exist")); return 1; }
            let local = null; try { local = sh.fs.read(tf.dir + "/terraform.tfstate", sh.user); } catch (e) { /* pas d'état local */ }
            if (local && JSON.parse(local).resources.length && !sh.aws.s3[b.bucket][b.key]) { if (!o.migrate) { io.out(out); io.err(box("Migration of existing state required", "Initializing a backend with existing state requires a migration. Run \"terraform init -migrate-state\" to migrate your existing state to the new backend, or \"terraform init -reconfigure\" to start with an empty state.")); return 1; } sh.aws.s3[b.bucket][b.key] = local; out += "Successfully configured the backend \"s3\"! Terraform will automatically\nuse this backend unless the backend configuration changes.\n"; }
            else out += "\nSuccessfully configured the backend \"s3\"! Terraform will automatically\nuse this backend unless the backend configuration changes.\n";
          }
        }
        out += "\nInitializing provider plugins...\n";
        for (const p of [...used].sort()) {
          if (!KNOWN_PROVIDERS[p]) { io.out(out); io.err(box("Failed to query available provider packages", "Could not retrieve the list of available versions for provider hashicorp/" + p + ": provider registry registry.terraform.io does not have a provider named registry.terraform.io/hashicorp/" + p)); return 1; }
          const req = tf.cfg.required[p]; const c = req && req.version ? " matching \"" + req.version + "\"" : "";
          out += "- Finding " + KNOWN_PROVIDERS[p] + " versions" + c + "...\n";
        }
        for (const p of [...used].sort()) out += "- Installing " + KNOWN_PROVIDERS[p] + " v" + VERSIONS[p] + "...\n- Installed " + KNOWN_PROVIDERS[p] + " v" + VERSIONS[p] + " (signed by HashiCorp)\n";
        out += "\nTerraform has created a lock file .terraform.lock.hcl to record the provider\nselections it made above. Include this file in your version control repository\nso that Terraform can guarantee to make the same selections by default when\nyou run \"terraform init\" in the future.\n\nTerraform has been successfully initialized!\n\nYou may now begin working with Terraform. Try running \"terraform plan\" to see\nany changes that are required for your infrastructure. All Terraform commands\nshould now work.\n\nIf you ever set or change modules or backend configuration for Terraform,\nrerun this command to reinitialize your working directory. If you forget, other\ncommands will detect it and remind you to do so if necessary.\n";
        sh.fs.mkdir(tf.dir + "/.terraform/providers", sh.user, { parents: true });
        sh.fs.write(tf.dir + "/.terraform.lock.hcl", "# This file is maintained automatically by \"terraform init\".\n# Manual edits may be lost in future updates.\n\n" + [...used].sort().map((p) => 'provider "registry.terraform.io/' + KNOWN_PROVIDERS[p] + '" {\n  version = "' + VERSIONS[p] + '"\n  hashes = [\n    "h1:' + btoa(p + VERSIONS[p]).slice(0, 43) + '=",\n  ]\n}\n').join("\n"), sh.user);
        sh.fs.write(tf.dir + "/.terraform/init.json", JSON.stringify({ providers: [...used], backend: tf.cfg.backend ? JSON.stringify(tf.cfg.backend.attrs) : null }), sh.user);
        io.out(out); return 0;
      }
      case "fmt": {
        const files = (sh.fs.list(tf.dir, sh.user) || []).filter((n) => /\.tf(vars)?$/.test(n)).sort(); let bad = [];
        for (const f of files) { const src = sh.fs.read(tf.dir + "/" + f, sh.user); try { parseHcl(src, f); } catch (e) { if (e instanceof HclErr) { io.err(e.render(src)); return 2; } throw e; } const nf = fmtHcl(src); if (nf !== src) { bad.push(f); if (!o.check) sh.fs.write(tf.dir + "/" + f, nf, sh.user); } }
        if (bad.length) io.out(bad.join("\n") + "\n");
        return o.check && bad.length ? 3 : 0;
      }
      case "validate": {
        if (!tf.load(io, {}, [])) return 1;
        io.out("Success! The configuration is valid.\n\n"); return 0;
      }
      case "plan": case "apply": case "destroy": {
        if (!needInit(sh, tf, io)) return 1;
        if (!tf.load(io, o.vars, o.varFiles)) return 1;
        if (!tf.lock(cmd, io)) return 1;
        tf.state = tf.readState();
        const destroy = cmd === "destroy" || o.destroy;
        // Rafraîchissement : ressources supprimées ou modifiées hors de Terraform.
        let drift = "";
        for (const sr of tf.state.resources.filter((x) => x.mode !== "data" && !x.type.startsWith("random_") && x.type !== "local_file")) for (const pi of [...sr.instances]) {
          const addr = addrOf({ ...sr, mod: sr.module || "" }, pi.index_key ?? null);
          io.out(addr + ": Refreshing state... [id=" + pi.attributes.id + "]\n");
          const live = tf.acct.get(sr.type, pi.attributes.id) || tf.acct.byId(pi.attributes.id);
          if (!live) { drift += "\n  # " + addr + " has been deleted\n  - resource \"" + sr.type + "\" \"" + sr.name + "\" {\n      - id = " + JSON.stringify(pi.attributes.id) + " -> null\n    }\n"; sr.instances = sr.instances.filter((x) => x !== pi); continue; }
          const changedKeys = Object.keys(SCHEMAS[sr.type].args).filter((k) => !SCHEMAS[sr.type].args[k].computed && JSON.stringify(live.attrs[k] ?? null) !== JSON.stringify(pi.attributes[k] ?? null) && live.attrs[k] !== undefined);
          if (changedKeys.length) { drift += "\n  # " + addr + " has changed\n  ~ resource \"" + sr.type + "\" \"" + sr.name + "\" {\n" + "        id = " + JSON.stringify(pi.attributes.id) + "\n" + changedKeys.map((k) => "      ~ " + k + " = " + fmtVal(pi.attributes[k], 8, " ", false) + " -> " + fmtVal(live.attrs[k], 8, " ", false)).join("\n") + "\n    }\n"; for (const k of changedKeys) pi.attributes[k] = live.attrs[k]; }
        }
        tf.state.resources = tf.state.resources.filter((x) => x.instances.length);
        if (drift) io.out("\nNote: Objects have changed outside of Terraform\n\nTerraform detected the following changes made outside of Terraform since the\nlast \"terraform apply\" which may have affected this plan:\n" + drift + "\n\nUnless you have made equivalent changes to your configuration, or ignored the\nrelevant attributes using ignore_changes, the following plan may include\nactions to undo or respond to these changes.\n\n─────────────────────────────────────────────────────────────────────────────\n");
        const p = tf.plan(tf.state, destroy);
        io.out(tf.render(p, destroy));
        if (cmd === "plan") { sh.tfLastPlan = { changes: p.actions.length, outs: p.outChanges.length }; if (p.actions.length || p.outChanges.length) io.out("\n─────────────────────────────────────────────────────────────────────────────\n\nNote: You didn't use the -out option to save this plan, so Terraform can't\nguarantee to take exactly these actions if you run \"terraform apply\" now.\n"); if (tf.stateLoc().remote) io.out("Releasing state lock. This may take a few moments...\n"); return 0; }
        if (!p.actions.length && !p.outChanges.length) { if (cmd === "apply") io.out("\nApply complete! Resources: 0 added, 0 changed, 0 destroyed.\n" + (Object.keys(tf.state.outputs).length ? "\nOutputs:\n\n" + Object.entries(tf.state.outputs).sort(([a], [b]) => a.localeCompare(b)).map(([n, x]) => n + " = " + fmtVal(x.value, 0, " ", x.sensitive)).join("\n") + "\n" : "")); else io.out("\nDestroy complete! Resources: 0 destroyed.\n"); return 0; }
        if (!o.auto) {
          const answer = (io.stdin || "").trim();
          io.out("\n" + (destroy ? "Do you really want to destroy all resources?\n  Terraform will destroy all your managed infrastructure, as shown above.\n  There is no undo. Only 'yes' will be accepted to confirm." : "Do you want to perform these actions?\n  Terraform will perform the actions described above.\n  Only 'yes' will be accepted to approve.") + "\n\n  Enter a value: " + (answer ? answer + "\n" : "\n"));
          if (answer !== "yes") { if (!answer) io.err("(Terraform attend ici que tu tapes « yes ». Dans ce terminal, relance avec -auto-approve, ou : echo yes | terraform " + cmd + ".)\n"); io.out("\n" + (destroy ? "Destroy cancelled." : "Apply cancelled.") + "\n"); return 1; }
        }
        io.out("\n");
        const code = tf.apply(p, io, destroy);
        if (tf.stateLoc().remote) io.out("Releasing state lock. This may take a few moments...\n");
        return code;
      }
      case "output": {
        if (!needInit(sh, tf, io, true)) return 1;
        tf.cfg = loadConfig(sh, tf.dir); const st = tf.readState();
        if (!Object.keys(st.outputs).length) { io.err(box("No outputs found", "The state file either has no outputs defined, or all the defined outputs are\nempty. Please define an output in your configuration with the `output` keyword\nand run `terraform refresh` for it to become available. If you are using\ninterpolation, please verify the interpolated value is not empty. You can use\nthe `terraform console` command to assist.").replace("Error", "Warning")); return 0; }
        const n = o._[0];
        if (n) { const x = st.outputs[n]; if (!x) { io.err(box("Output \"" + n + "\" not found", "The output variable requested could not be found in the state file. If you\nrecently added this to your configuration, be sure to run `terraform apply`,\nsince the state won't be updated with new output variables until that command\nis run.")); return 1; } io.out(o.raw ? String(x.value) : o.json ? JSON.stringify(x.value) + "\n" : fmtVal(x.value, 0, " ", false) + "\n"); return 0; }
        if (o.json) { io.out(JSON.stringify(st.outputs, null, 2) + "\n"); return 0; }
        io.out(Object.entries(st.outputs).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => k + " = " + fmtVal(x.value, 0, " ", x.sensitive)).join("\n") + "\n"); return 0;
      }
      case "state": {
        tf.cfg = loadConfig(sh, tf.dir); const st = tf.readState(); const sub = o._[0];
        const all = st.resources.flatMap((sr) => sr.instances.map((pi) => ({ sr, pi, addr: addrOf({ ...sr, mod: sr.module || "" }, pi.index_key ?? null) })));
        if (sub === "list") { io.out(all.map((x) => x.addr).sort().filter((a) => !o._[1] || a.startsWith(o._[1])).join("\n") + (all.length ? "\n" : "")); return 0; }
        if (sub === "show") { const x = all.find((y) => y.addr === o._[1]); if (!x) { io.err(box("No instance found for the given address!", "This command requires that the address references one specific instance.\nTo view the available instances, use \"terraform state list\". Please modify\nthe address to reference a specific instance.")); return 1; } const sch = SCHEMAS[x.sr.type] || DATA_SOURCES[x.sr.type]; const keys = Object.keys(x.pi.attributes).filter((k) => x.pi.attributes[k] !== null && !(Array.isArray(x.pi.attributes[k]) && !x.pi.attributes[k].length)).sort(); const w = Math.max(...keys.map((k) => k.length)); io.out("# " + x.addr + ":\n" + (x.sr.mode === "data" ? "data " : "") + 'resource "' + x.sr.type + '" "' + x.sr.name + '" {\n' + keys.map((k) => "    " + k.padEnd(w) + " = " + fmtVal(x.pi.attributes[k], 4, " ", sch && sch.args && sch.args[k] && sch.args[k].sensitive)).join("\n") + "\n}\n"); return 0; }
        if (sub === "rm") { const x = all.find((y) => y.addr === o._[1]); if (!x) { io.err(box("Invalid target address", "No matching objects found. To view the available instances, use \"terraform\nstate list\". Please modify the address to reference a specific instance.")); return 1; } x.sr.instances = x.sr.instances.filter((p) => p !== x.pi); st.resources = st.resources.filter((r) => r.instances.length); tf.writeState(st); io.out("Removed " + x.addr + "\nSuccessfully removed 1 resource instance(s).\n"); return 0; }
        io.err("Usage: terraform [global options] state <subcommand> [options] [args]\n\n  list  List resources in the state\n  show  Show a resource in the state\n  rm    Remove instances from the state\n"); return 1;
      }
      case "import": {
        if (!needInit(sh, tf, io)) return 1;
        if (!tf.load(io, o.vars, o.varFiles)) return 1;
        const [addr, id] = o._; const m = /^([\w]+)\.([\w-]+)$/.exec(addr || "");
        const r = m && tf.cfg.resources.find((x) => x.type === m[1] && x.name === m[2]);
        if (!r) { io.err(box("resource address \"" + addr + "\" does not exist in the configuration.", "Before importing this resource, please create its configuration in the root\nmodule. For example:\n\nresource \"" + (m ? m[1] : "aws_x") + "\" \"" + (m ? m[2] : "name") + "\" {\n  # (resource arguments)\n}")); return 1; }
        tf.state = tf.readState();
        if (tf.state.resources.some((x) => x.type === m[1] && x.name === m[2])) { io.err(box("Resource already managed by Terraform", "Terraform is already managing a remote object for " + addr + ". To import to this address you must first remove the existing object from the state.")); return 1; }
        const live = tf.acct.get(m[1], id) || tf.acct.byId(id);
        if (!live || live.type !== m[1]) { io.out(addr + ": Importing from ID \"" + id + "\"...\n"); io.err(box("Cannot import non-existent remote object", "While attempting to import an existing object to \"" + addr + "\", the provider\ndetected that no object exists with the given id. Only pre-existing objects\ncan be imported; check that the id is correct and that it is associated with\nthe provider's configured region or endpoint, or use \"terraform apply\" to\ncreate a new remote object for this resource.")); return 1; }
        const sch = SCHEMAS[m[1]]; const attrs = {}; for (const k of [...Object.keys(sch.args), ...(sch.computed || [])]) attrs[k] = live.attrs[k] ?? null;
        tf.state.resources.push({ mode: "managed", type: m[1], name: m[2], provider: 'provider["registry.terraform.io/' + KNOWN_PROVIDERS[providerOf(m[1])] + '"]', instances: [{ schema_version: 0, attributes: attrs, sensitive_attributes: [] }] });
        live.meta.managed = true; tf.writeState(tf.state);
        io.out(addr + ": Importing from ID \"" + id + "\"...\n" + addr + ": Import prepared!\n  Prepared " + m[1] + " for import\n" + addr + ": Refreshing state... [id=" + id + "]\n\nImport successful!\n\nThe resources that were imported are shown above. These resources are now in\nyour Terraform state and will henceforth be managed by Terraform.\n\n"); return 0;
      }
      case "force-unlock": { if (!sh.tfLock || o._[0] !== sh.tfLock.id) { io.err(box("Failed to unlock state: failed to retrieve lock info for lock ID \"" + o._[0] + "\": unexpected end of JSON input", "")); return 1; } if (!o.force) { io.out("Do you really want to force-unlock?\n  Terraform will remove the lock on the remote state.\n  This will allow local Terraform commands to modify this state, even though it\n  may still be in use. Only 'yes' will be accepted to confirm.\n\n  Enter a value: " + ((io.stdin || "").trim() || "") + "\n"); if ((io.stdin || "").trim() !== "yes") { io.out("force-unlock cancelled.\n"); return 1; } } sh.tfLock = null; io.out("Terraform state has been successfully unlocked!\n\nThe state has been unlocked, and Terraform commands should now be able to\nobtain a new lock on the remote state.\n"); return 0; }
      case "console": io.err("(terraform console est interactif : non simulé ici. Utilise des outputs, ou terraform output.)\n"); return 1;
      default: io.err("Terraform has no command named \"" + cmd + "\"." + (suggest(cmd, ["init", "plan", "apply", "destroy", "validate", "fmt", "output", "state", "import"]) ? " Did you mean \"" + suggest(cmd, ["init", "plan", "apply", "destroy", "validate", "fmt", "output", "state", "import"]) + "\"?" : "") + "\n\nTo see all of Terraform's top-level commands, run:\n  terraform -help\n\n"); return 1;
    }
  } catch (e) {
    if (e instanceof HclErr) { io.err(e.render(e.src || (tf.cfg && tf.cfg.files[e.file]))); return 1; }
    if (e instanceof TfErr) { io.err(box(e.title, e.detail, e.where, e.where && tf.cfg && tf.cfg.files[e.where.file])); return 1; }
    throw e;
  }
}
function needInit(sh, tf, io, quiet) {
  let init = null; try { init = JSON.parse(sh.fs.read(tf.dir + "/.terraform/init.json", sh.user)); } catch (e) { /* jamais initialisé */ }
  const cfg = loadConfig(sh, tf.dir);
  const used = new Set([...cfg.resources, ...cfg.data].map((r) => providerOf(r.type)));
  if (!init) { if (quiet) return true; io.err(box("Inconsistent dependency lock file", "The following dependency selections recorded in the lock file are\ninconsistent with the current configuration:\n" + [...used].sort().map((p) => "  - provider registry.terraform.io/" + KNOWN_PROVIDERS[p] + ": required by this configuration but no version is selected").join("\n") + "\n\nTo make the initial dependency selections that will initialize the\ndependency lock file, run:\n  terraform init")); return false; }
  const missing = [...used].filter((p) => !init.providers.includes(p));
  if (missing.length) { io.err(box("Inconsistent dependency lock file", "The following dependency selections recorded in the lock file are\ninconsistent with the current configuration:\n" + missing.map((p) => "  - provider registry.terraform.io/" + KNOWN_PROVIDERS[p] + ": required by this configuration but no version is selected").join("\n") + "\n\nTo update the locked dependency selections to match a changed configuration,\nrun:\n  terraform init -upgrade")); return false; }
  const be = cfg.backend ? JSON.stringify(cfg.backend.attrs) : null;
  if (be !== init.backend) { io.err(box("Backend initialization required, please run \"terraform init\"", "Reason: " + (be ? "Initial configuration of the requested backend \"" + cfg.backend.type + "\"" : "Unsetting the previously set backend") + "\n\nThe \"backend\" is the interface that Terraform uses to store state,\nperform operations, etc. If this message is showing up, it means that the\nTerraform configuration you're using is using a custom configuration for\nthe Terraform backend.\n\nChanges to backend configurations require reinitialization. This allows\nTerraform to set up the new configuration, copy existing state, etc. Please run\n\"terraform init\" with either the \"-reconfigure\" or \"-migrate-state\" flags to\nuse the current configuration.")); return false; }
  return true;
}

COMMANDS.terraform = terraform;
SETUP_HOOKS.push((sh, setup) => {
  if (!setup.aws && !setup.terraform) return;
  sh.aws = sh.aws || new Account(setup.aws || {});
  if (setup.terraform) { sh.packages.add("terraform"); if (setup.terraform.lock) sh.tfLock = setup.terraform.lock; }
});

/* ----- critères ----- */
EXTRA_CHECKS.tf = (sh, v, push) => {
  // { dir, state: [adresses], noChanges: true, outputs: { nom: valeur } }
  const save = sh.cwd; sh.cwd = v.dir || sh.cwd; const tf = new TF(sh);
  try {
    tf.cfg = loadConfig(sh, tf.dir);
    const st = tf.readState(); const addrs = st.resources.flatMap((sr) => sr.instances.map((pi) => addrOf({ ...sr, mod: sr.module || "" }, pi.index_key ?? null)));
    for (const a of v.state || []) push(addrs.includes(a), a + " est géré par Terraform (dans l'état)");
    for (const a of v.notState || []) push(!addrs.includes(a), a + " n'est plus dans l'état");
    for (const [n, val] of Object.entries(v.outputs || {})) push(st.outputs[n] && (val === true || JSON.stringify(st.outputs[n].value) === JSON.stringify(val)), "L'output " + n + (val === true ? " existe" : " vaut " + JSON.stringify(val)));
    if (v.noChanges) {
      let ok = false;
      try { const io = { out: () => {}, err: () => {} }; if (tf.load(io)) { tf.state = st; const p = tf.plan(st); ok = !p.actions.length && !p.outChanges.length; } } catch (e) { ok = false; }
      push(ok, "terraform plan n'a plus rien à changer (la configuration et l'infrastructure correspondent)");
    }
  } finally { sh.cwd = save; }
};
EXTRA_CHECKS.aws = (sh, v, push) => {
  // { type: [{ match: {attr: valeur}, count }] } : ressources présentes dans le compte
  for (const [type, specs] of Object.entries(v)) for (const s of [].concat(specs)) {
    const hits = sh.aws.list(type).filter((r) => !r.meta.isDefault && Object.entries(s.match || {}).every(([k, x]) => JSON.stringify(r.attrs[k]) === JSON.stringify(x) || (typeof x === "object" && x && !Array.isArray(x) && Object.entries(x).every(([kk, xx]) => (r.attrs[k] || {})[kk] === xx))));
    const n = s.count ?? 1;
    push(hits.length === n, s.label || (n ? n + " ressource" + (n > 1 ? "s" : "") + " " + type + (s.match ? " avec " + JSON.stringify(s.match) : "") + " dans le compte AWS" : "Plus aucune ressource " + type + (s.match ? " " + JSON.stringify(s.match) : "") + " dans le compte AWS"));
  }
};
