/* Moteur Docker simulé : images et couches, construction avec cache, conteneurs, réseaux, volumes, registre.
   Les sorties (format, messages d'erreur) imitent Docker 27 ; voir cli.js pour l'affichage. */
import { IMAGES, canon, fullName, APT, APT_RECOMMENDS, APK, PIP, PIP_DEPS, MODULE_PKG, NPM } from "./catalog.js";
import { parseDockerfile, buildChecks, words, envPairs, DockerfileError } from "./dockerfile.js";

const MB = 1e6;
export class DockerErr extends Error { constructor(msg, code = 1) { super(msg); this.code = code; } }

/* ---------- utilitaires ---------- */
export function hash(s, len = 64) {
  let out = "", seed = 0;
  while (out.length < len) {
    let h = 0x811c9dc5 ^ seed++;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    out += h.toString(16).padStart(8, "0");
  }
  return out.slice(0, len);
}
const clone = (o) => JSON.parse(JSON.stringify(o));
const norm = (p) => { const out = []; for (const s of p.split("/")) { if (!s || s === ".") continue; if (s === "..") out.pop(); else out.push(s); } return "/" + out.join("/"); };
const join = (a, b) => (b.startsWith("/") ? norm(b) : norm(a + "/" + b));
const under = (p, dir) => dir === "/" || p === dir || p.startsWith(dir + "/");
const bytes = (s) => new TextEncoder().encode(s).length;
const UIDS = { root: 0, "www-data": 33, nobody: 65534, nonroot: 65532, node: 1000, postgres: 999, redis: 999 };
const globRe = (g) => new RegExp("^" + g.split("**").map((x) => x.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]")).join(".*") + "$");

/** Motifs .dockerignore, avec « ! » pour réinclure. */
export function ignoreFilter(text) {
  const rules = String(text || "").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
    .map((l) => { const neg = l.startsWith("!"); const p = (neg ? l.slice(1) : l).replace(/^\.?\//, "").replace(/\/$/, ""); return { neg, re: globRe(p), dirRe: globRe(p + "/**") }; });
  return (rel) => { let out = false; for (const r of rules) if (r.re.test(rel) || r.dirRe.test(rel)) out = !r.neg; return out; };
}

/* ---------- état d'une image en construction ---------- */
function baseState(ref) {
  const b = IMAGES[canon(ref)];
  const files = {}; for (const [p, d] of Object.entries(b.files || {})) files[p] = { data: d, mode: 0o644, owner: "root" };
  const users = {}; for (const u of b.users) users[u] = UIDS[u] ?? 1000;
  return {
    base: b.ref, os: b.os, pkg: b.pkg, shell: b.shell, files, dirs: [], users, env: { PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", ...b.env },
    workdir: b.workdir, user: b.user || "", cmd: b.cmd, entrypoint: b.entrypoint, exposes: b.exposes.slice(), healthcheck: null, volumes: [], labels: {}, app: b.app || null,
    bins: b.bins.slice(), pip: [], apt: [], npm: [], aptLists: false,
    layers: [{ createdBy: "/bin/sh -c #(nop) ADD file:" + hash(b.ref, 32) + " in / ", size: b.size, base: true }], args: {}
  };
}
const stateSize = (s) => s.layers.reduce((a, l) => a + l.size, 0);

/* ---------- moteur ---------- */
export class Docker {
  constructor(sh, setup = {}) {
    this.sh = sh; this.apps = setup.apps || {}; this.t = 0; this.seq = 0;
    this.images = {}; this.tags = {}; this.containers = []; this.volumes = {}; this.cache = {}; this.registry = {}; this.logins = {};
    this.networks = {};
    this.addNetwork("bridge", "bridge", "172.17.0"); this.addNetwork("host", "host", null); this.addNetwork("none", "null", null);
    for (const r of setup.images || []) this.pullBase(r);
    for (const [r, u] of Object.entries(setup.logins || {})) this.logins[r] = u;
    for (const [ref, img] of Object.entries(setup.registry || {})) this.registry[canon(ref)] = img;
  }
  tick(s = 7) { this.t += s; }
  id(kind) { return hash(kind + ":" + this.seq++ + ":" + this.t); }

  /* ----- réseaux et volumes ----- */
  addNetwork(name, driver, subnet, labels = {}) {
    if (this.networks[name]) throw new DockerErr("Error response from daemon: network with name " + name + " already exists");
    const n = Object.keys(this.networks).filter((k) => this.networks[k].subnet).length;
    const sub = subnet === undefined ? "172." + (17 + n) + ".0" : subnet;
    return (this.networks[name] = { name, id: this.id("net"), driver, subnet: sub, next: 2, labels, created: this.t, user: !["bridge", "host", "none"].includes(name) });
  }
  network(name) { const n = this.networks[name] || Object.values(this.networks).find((x) => x.id.startsWith(name)); if (!n) throw new DockerErr("Error response from daemon: network " + name + " not found"); return n; }
  addVolume(name, labels = {}) { if (!this.volumes[name]) this.volumes[name] = { name, files: {}, created: this.t, labels, init: false }; return this.volumes[name]; }

  /* ----- images ----- */
  pullBase(ref) {
    const c = canon(ref);
    if (this.tags[c]) return this.images[this.tags[c]];
    const src = IMAGES[c] ? null : this.registry[c];
    if (!IMAGES[c] && !src) return null;
    const st = src ? clone(src) : baseState(c);
    const id = src ? src.id : hash("base:" + c);
    const img = { ...st, id, created: src ? src.created : -1814400, tags: [] };
    this.images[id] = img; this.tag(id, c); return img;
  }
  tag(id, ref) {
    const c = canon(ref); const old = this.tags[c];
    if (old && old !== id && this.images[old]) this.images[old].tags = this.images[old].tags.filter((t) => t !== c);
    this.tags[c] = id; if (!this.images[id].tags.includes(c)) this.images[id].tags.push(c);
  }
  image(ref, { pull = false } = {}) {
    const c = canon(ref);
    if (this.tags[c]) return this.images[this.tags[c]];
    const byId = Object.values(this.images).find((i) => ref.length >= 4 && (i.id.startsWith(ref) || i.id.startsWith(ref.replace(/^sha256:/, ""))));
    if (byId) return byId;
    return pull ? this.pullBase(ref) : null;
  }
  knownRepo(ref) { const c = canon(ref); const repo = c.slice(0, c.lastIndexOf(":")); return Object.keys(IMAGES).concat(Object.keys(this.registry)).some((k) => k.slice(0, k.lastIndexOf(":")) === repo); }
  pullError(ref) {
    const c = canon(ref);
    if (this.knownRepo(ref)) return "Error response from daemon: manifest for " + c + " not found: manifest unknown: manifest unknown";
    return "Error response from daemon: pull access denied for " + c.slice(0, c.lastIndexOf(":")) + ", repository does not exist or may require 'docker login': denied: requested access to the resource is denied";
  }
  size(img) { return stateSize(img); }
  usedBy(img) { return this.containers.filter((c) => c.image === img.id); }

  /* ----- construction ----- */
  /** Construit une image. Retourne { steps, warnings, image, error } ; steps décrit chaque ligne de sortie BuildKit. */
  build(ctxDir, o = {}) {
    const sh = this.sh; const steps = []; const res = { steps, warnings: [], ctxDir };
    const dfPath = o.file ? (o.file.startsWith("/") ? o.file : sh.abs(o.file)) : ctxDir + "/Dockerfile";
    let ctxNode; try { ctxNode = sh.fs.lookup(ctxDir, { user: sh.user }).node; } catch (e) { ctxNode = null; }
    if (!ctxNode || ctxNode.t !== "d") { res.error = "unable to prepare context: path \"" + (o.ctxArg || ctxDir) + "\" not found"; res.early = true; return res; }
    let text; try { text = sh.fs.read(dfPath, sh.user); } catch (e) { res.error = "failed to solve: failed to read dockerfile: open " + (o.file || "Dockerfile") + ": no such file or directory"; res.early = true; steps.push({ name: "[internal] load build definition from " + (o.file ? o.file.split("/").pop() : "Dockerfile"), time: 0, sub: ["transferring dockerfile: 2B"] }); return res; }
    res.dockerfile = text; res.dfPath = dfPath;
    steps.push({ name: "[internal] load build definition from " + dfPath.split("/").pop(), time: 0, sub: ["transferring dockerfile: " + bytes(text) + "B"] });
    let parsed; try { parsed = parseDockerfile(text); } catch (e) { if (e instanceof DockerfileError) { res.error = "failed to solve: " + e.message; res.errLine = e.line; return res; } throw e; }
    res.warnings = buildChecks(text);
    // Contexte, filtré par .dockerignore.
    let ign = ""; try { ign = sh.fs.read(ctxDir + "/.dockerignore", sh.user); } catch (e) { /* pas de .dockerignore */ }
    const ignored = ignoreFilter(ign); const ctx = {};
    const walk = (dir, rel) => {
      let names; try { names = sh.fs.list(dir, sh.user); } catch (e) { return; }
      for (const n of names) {
        const p = dir + "/" + n, r = rel ? rel + "/" + n : n; if (ignored(r)) continue;
        const nd = sh.fs.lookup(p, { user: "root", follow: false }).node;
        if (nd.t === "d") { ctx[r + "/"] = null; walk(p, r); } else if (nd.t === "f") ctx[r] = { data: nd.data, mode: nd.mode, origin: p, size: nd.bytes ?? bytes(nd.data) };
      }
    };
    walk(ctxDir, ""); res.context = ctx;
    const ctxBytes = Object.values(ctx).reduce((a, f) => a + (f ? f.size : 0), 0);
    const bases = [...new Set(parsed.stages.map((s) => s.base).filter((b) => b !== "scratch" && !parsed.stages.some((x) => x.name === b.toLowerCase())))];
    for (const b of bases) steps.push({ name: "[internal] load metadata for " + fullName(this.subst(b, parsed, o.buildArgs)), time: 0.6 });
    steps.push({ name: "[internal] load .dockerignore", time: 0, sub: ["transferring context: " + (ign ? bytes(ign) : 2) + "B"] });
    // Étapes nécessaires (cible et dépendances COPY --from).
    const names = parsed.stages.map((s, i) => s.name || String(i));
    let target = parsed.stages.length - 1;
    if (o.target) { target = parsed.stages.findIndex((s) => s.name === o.target.toLowerCase()); if (target < 0) { res.error = "failed to solve: target stage \"" + o.target + "\" could not be found"; return res; } }
    const need = new Set(); const visit = (i) => { if (need.has(i)) return; need.add(i); const s = parsed.stages[i]; const dep = parsed.stages.findIndex((x) => x.name === s.base.toLowerCase()); if (dep >= 0 && dep < i) visit(dep); for (const it of parsed.ins.filter((x) => x.stage === i && x.flags.from)) { const j = names.indexOf(String(it.flags.from).toLowerCase()); if (j >= 0) visit(j); } };
    visit(target);
    const multi = parsed.stages.length > 1; const states = [];
    let ctxShown = false;
    for (let si = 0; si <= target; si++) {
      if (!need.has(si)) continue;
      const stage = parsed.stages[si]; const label = multi ? (stage.name || "stage-" + si) + " " : "";
      const ins = parsed.ins.filter((x) => x.stage === si);
      const layerIns = ins.filter((x) => ["FROM", "RUN", "COPY", "ADD", "WORKDIR"].includes(x.op));
      let n = 0; const total = layerIns.length;
      let st, key;
      for (const it of ins) {
        const stepName = () => "[" + label + ++n + "/" + total + "] " + this.stepText(it, stage, o.buildArgs, parsed);
        if (it.op === "FROM") {
          const baseRef = this.subst(stage.base, parsed, o.buildArgs);
          const dep = parsed.stages.findIndex((x) => x.name === baseRef.toLowerCase());
          if (dep >= 0) { st = clone(states[dep]); key = "stage:" + states[dep].key; steps.push({ name: stepName(), time: 0, cached: true }); continue; }
          if (baseRef === "scratch") { st = { ...baseState("busybox:latest"), base: "scratch", os: "scratch", pkg: null, shell: false, bins: [], files: {}, layers: [], cmd: null }; key = "scratch"; n++; continue; }
          const local = this.image(baseRef); const img = local || this.pullBase(baseRef);
          if (!img) { const c = canon(baseRef); steps.push({ name: stepName(), time: 0.4, error: true }); res.error = "failed to solve: " + c + ": failed to resolve source metadata for " + fullName(c) + ": " + (this.knownRepo(c) ? fullName(c) + ": not found" : "pull access denied, repository does not exist or may require authorization: server message: insufficient_scope: authorization failed"); res.errLine = it.line; return res; }
          st = clone(img); delete st.id; delete st.tags; delete st.created; st.args = {}; st.cmdSetHere = false;
          key = "from:" + img.id;
          steps.push({ name: "[" + label + ++n + "/" + total + "] FROM " + fullName(canon(baseRef)) + "@sha256:" + hash("digest:" + canon(baseRef)), time: local ? 0 : 2.8, sub: local ? [] : ["resolve " + fullName(canon(baseRef)) + "@sha256:" + hash("digest:" + canon(baseRef)) + " 0.0s done"] });
          if (!ctxShown && ins.some((x) => (x.op === "COPY" || x.op === "ADD") && !x.flags.from)) { ctxShown = true; steps.push({ name: "[internal] load build context", time: 0, sub: ["transferring context: " + human1(ctxBytes)] }); }
          continue;
        }
        if (it.op === "ARG") { for (const [k, v] of envPairs(it)) st.args[k] = (o.buildArgs || {})[k] ?? v ?? ""; continue; }
        if (["ENV", "LABEL", "EXPOSE", "USER", "CMD", "ENTRYPOINT", "HEALTHCHECK", "VOLUME", "SHELL", "STOPSIGNAL", "MAINTAINER", "ONBUILD"].includes(it.op)) { this.meta(st, it); key = hash(key + "|" + it.raw); continue; }
        // Étapes qui créent une couche : RUN, COPY, ADD, WORKDIR.
        if ((it.op === "COPY" || it.op === "ADD") && !it.flags.from && !ctxShown) { ctxShown = true; steps.push({ name: "[internal] load build context", time: 0, sub: ["transferring context: " + human1(ctxBytes)] }); }
        let src = "";
        if (it.op === "COPY" || it.op === "ADD") { const r = this.copySources(it, st, ctx, states, names, parsed); if (r.error) { steps.push({ name: stepName(), time: 0, error: true }); res.error = r.error; res.errLine = it.line; return res; } src = r.digest; it._srcs = r; }
        const nk = hash(key + "|" + it.raw + "|" + src + "|" + JSON.stringify(st.args) + (it.op === "RUN" ? "|" + JSON.stringify(st.env) : ""));
        const name = stepName();
        if (!o.noCache && this.cache[nk]) { st = clone(this.cache[nk]); key = nk; steps.push({ name, time: 0, cached: true }); continue; }
        const before = stateSize(st);
        if (it.op === "WORKDIR") { st.workdir = join(st.workdir, this.expand(it.args, st)); if (!st.dirs.includes(st.workdir)) st.dirs.push(st.workdir); st.layers.push({ createdBy: "WORKDIR " + st.workdir, size: 0 }); }
        else if (it.op === "COPY" || it.op === "ADD") this.applyCopy(it, st, it._srcs);
        else {
          const r = this.run(it, st);
          if (r.code) { steps.push({ name, time: r.time || 0.5, error: true, log: r.log }); res.error = 'failed to solve: process "' + (it.json ? it.json.join(" ") : "/bin/sh -c " + it.args) + '" did not complete successfully: exit code: ' + r.code; res.errLine = it.line; res.runLog = { name, log: r.log }; return res; }
          steps.push({ name, time: r.time, log: r.log }); key = nk; this.cache[nk] = clone(st); continue;
        }
        void before;
        steps.push({ name, time: it.op === "WORKDIR" ? 0.1 : 0.1 }); key = nk; this.cache[nk] = clone(st);
      }
      st.key = key; states[si] = st;
    }
    const fin = states[target];
    const id = hash("image:" + fin.key + JSON.stringify([fin.cmd, fin.entrypoint, fin.env, fin.user, fin.exposes, fin.healthcheck, fin.labels]));
    const existed = !!this.images[id];
    const img = existed ? this.images[id] : { ...clone(fin), id, created: this.t, tags: [] };
    this.images[id] = img;
    const tags = o.tags && o.tags.length ? o.tags : [];
    for (const t of tags) this.tag(id, t);
    steps.push({ name: "exporting to image", time: existed ? 0 : 0.2, sub: ["exporting layers" + (existed ? " done" : ""), "writing image sha256:" + id + (existed ? " done" : ""), ...tags.map((t) => "naming to " + fullName(t) + " done")] });
    res.image = img; return res;
  }
  subst(s, parsed, args = {}) { const glob = {}; for (const it of parsed.ins.filter((x) => x.op === "ARG" && x.stage < 0)) for (const [k, v] of envPairs(it)) glob[k] = args[k] ?? v ?? ""; return s.replace(/\$\{?(\w+)\}?/g, (m, k) => glob[k] ?? m); }
  expand(s, st) { return String(s).replace(/\$\{(\w+)(?::-([^}]*))?\}|\$(\w+)/g, (m, a, d, b) => { const k = a || b; return st.env[k] ?? st.args[k] ?? d ?? ""; }); }
  stepText(it, stage, args, parsed) {
    if (it.op === "FROM") return "FROM " + this.subst(stage.base, parsed, args);
    const fl = Object.entries(it.flags).map(([k, v]) => "--" + k + (v === true ? "" : "=" + v)).join(" ");
    return it.op + " " + (fl ? fl + " " : "") + it.args;
  }
  meta(st, it) {
    const a = it.args;
    switch (it.op) {
      case "ENV": for (const [k, v] of envPairs(it)) st.env[k] = this.expand(v ?? "", st); break;
      case "LABEL": for (const [k, v] of envPairs(it)) st.labels[k] = v ?? ""; break;
      case "EXPOSE": for (const p of a.split(/\s+/)) { const n = parseInt(p, 10); if (!st.exposes.includes(n)) st.exposes.push(n); } break;
      case "USER": st.user = this.expand(a, st); break;
      case "CMD": st.cmd = it.json || ["/bin/sh", "-c", a]; st.cmdSetHere = true; break;
      case "ENTRYPOINT": st.entrypoint = it.json || ["/bin/sh", "-c", a]; st.cmd = st.cmdSetHere ? st.cmd : null; break;
      case "VOLUME": for (const v of it.json || a.split(/\s+/)) st.volumes.push(v); break;
      case "HEALTHCHECK": {
        if (/^NONE$/i.test(a)) { st.healthcheck = null; break; }
        const m = /CMD\s+([\s\S]*)$/.exec(a); if (!m) break;
        let test; try { const j = JSON.parse(m[1]); test = ["CMD", ...j]; } catch (e) { test = ["CMD-SHELL", m[1]]; }
        st.healthcheck = { test, interval: it.flags.interval || "30s" };
        break;
      }
    }
    st.layers.push({ createdBy: it.op + " " + a, size: 0, meta: true });
  }

  /* COPY / ADD : sources du contexte, d'une autre étape ou d'une image. */
  copySources(it, st, ctx, states, names, parsed) {
    const w = it.json || words(it.args); if (w.length < 2) return { error: "failed to solve: dockerfile parse error on line " + it.line + ": " + it.op + " requires at least two arguments, but only one was provided. Destination could not be determined" };
    const srcs = w.slice(0, -1); const dest = this.expand(w[w.length - 1], st);
    let from = null, fromFiles;
    if (it.flags.from) {
      const f = String(it.flags.from).toLowerCase(); const j = /^\d+$/.test(f) ? +f : names.indexOf(f);
      if (j >= 0 && states[j]) { from = names[j]; fromFiles = states[j].files; }
      else { const img = this.image(it.flags.from) || this.pullBase(it.flags.from); if (!img) return { error: "failed to solve: " + it.flags.from + ": failed to resolve source metadata for " + fullName(it.flags.from) + ": not found" }; fromFiles = img.files; from = it.flags.from; }
    }
    const items = [];
    for (const s0 of srcs) {
      const s = this.expand(s0, st);
      if (/^https?:\/\//.test(s) && it.op === "ADD") { items.push({ rel: s.split("/").pop(), file: { data: "", mode: 0o600, size: 1.2 * MB } }); continue; }
      if (fromFiles) {
        const p = norm(s.startsWith("/") ? s : "/" + s); const hit = Object.keys(fromFiles).filter((k) => k === p || under(k, p));
        if (!hit.length) return { error: 'failed to solve: failed to compute cache key: failed to calculate checksum of ref ' + hash(from, 25) + "::" + hash(s, 25) + ': "' + p + '": not found' };
        for (const k of hit) items.push({ rel: k === p ? p.split("/").pop() : k.slice(p.length + 1), file: fromFiles[k], whole: k === p, base: p });
        continue;
      }
      const rel = s.replace(/^\.?\/+/, "").replace(/\/$/, "");
      if (rel === "" || rel === ".") { for (const [k, f] of Object.entries(ctx)) if (f) items.push({ rel: k, file: f }); continue; }
      const re = /[*?[]/.test(rel) ? globRe(rel) : null;
      const hit = Object.entries(ctx).filter(([k, f]) => f && (re ? re.test(k) : k === rel || k.startsWith(rel + "/")));
      if (!hit.length) return { error: 'failed to solve: failed to compute cache key: failed to calculate checksum of ref ' + hash("ctx", 25) + "::" + hash(rel, 25) + ': "/' + rel + '": not found' };
      for (const [k, f] of hit) items.push({ rel: re || k === rel ? k.split("/").pop() : k.slice(rel.length + 1), file: f, whole: re || k === rel });
    }
    if (items.length > 1 && items.every((x) => x.whole) && !dest.endsWith("/")) return { error: "failed to solve: dockerfile parse error on line " + it.line + ": When using " + it.op + " with more than one source file, the destination must be a directory and end with a /" };
    return { items, dest, digest: hash(JSON.stringify(items.map((x) => [x.rel, x.file.data, x.file.size]))) };
  }
  applyCopy(it, st, r) {
    const destAbs = join(st.workdir, r.dest);
    const asDir = r.dest.endsWith("/") || r.dest === "." || r.items.length > 1 || r.items.some((x) => !x.whole) || st.dirs.includes(destAbs);
    let [owner] = String(it.flags.chown || "root").split(":");
    if (/^\d+$/.test(owner)) owner = Object.keys(st.users).find((u) => String(st.users[u]) === owner) || owner;
    let size = 0;
    for (const x of r.items) {
      const p = asDir ? join(destAbs, x.rel) : destAbs;
      st.files[p] = { data: x.file.data, mode: x.file.mode ?? 0o644, owner, origin: x.file.origin, size: x.file.size };
      size += x.file.size ?? bytes(x.file.data || "");
    }
    if (asDir && !st.dirs.includes(destAbs)) st.dirs.push(destAbs);
    st.layers.push({ createdBy: it.op + " " + (it.flags.from ? "--from=" + it.flags.from + " " : "") + it.args + " # buildkit", size });
  }

  /* RUN : petit interpréteur des commandes courantes d'un Dockerfile. */
  run(it, st) {
    const cmd = this.expand(it.json ? it.json.join(" ") : it.args, st);
    const log = []; let size = 0.01 * MB, time = 0.4, cwd = st.workdir; let listsHere = false;
    const sh = st.os === "alpine" ? "/bin/sh: " : "/bin/sh: 1: ";
    const nf = (c) => { log.push(sh + c + ": not found"); return { code: 127, log, time }; };
    const hasBin = (b) => st.bins.includes(b) || ["sh", "echo", "cd", "true", "export", "set", "mkdir", "rm", "cp", "mv", "ln", "touch", "chmod", "test", "[", "sed", "grep", "find", "tar", "cat", "ls", "id", "env"].includes(b);
    for (const raw of cmd.split(/\s*(?:&&|;)\s*/)) {
      const red = /^(.*?)\s*(>>?)\s*(\S+)\s*$/.exec(raw);
      const w = words(red ? red[1] : raw); if (!w.length) continue;
      let c = w[0]; if (c === "sudo") { log.push(sh + "sudo: not found"); return { code: 127, log, time }; }
      if (/^\//.test(c)) c = c.split("/").pop();
      switch (c) {
        case "set": case "true": case "export": case ":": break;
        case "echo": if (red) { const p = join(cwd, red[3]); const t = w.slice(1).join(" ") + "\n"; st.files[p] = { data: (red[2] === ">>" && st.files[p] ? st.files[p].data : "") + t, mode: 0o644, owner: "root" }; } break;
        case "cd": cwd = join(cwd, w[1] || "/"); break;
        case "apt": case "apt-get": {
          if (st.pkg !== "apt") return nf(c);
          const sub = w.find((x, i) => i > 0 && !x.startsWith("-"));
          if (sub === "update") { listsHere = true; st.aptLists = true; size += 45 * MB; time += 3.1; log.push("Get:1 http://deb.debian.org/debian bookworm InRelease [151 kB]", "Fetched 9137 kB in 2s (4512 kB/s)", "Reading package lists..."); }
          else if (sub === "install") {
            if (!st.aptLists) { const p = w.slice(w.indexOf("install") + 1).find((x) => !x.startsWith("-")); log.push("Reading package lists...", "Building dependency tree...", "Reading state information...", "E: Unable to locate package " + p); return { code: 100, log, time: 1.1 }; }
            const pk = w.slice(w.indexOf("install") + 1).filter((x) => !x.startsWith("-")).map((x) => x.split("=")[0]);
            const bad = pk.find((p) => APT[p] === undefined); if (bad) { log.push("Reading package lists...", "E: Unable to locate package " + bad); return { code: 100, log, time: 1.2 }; }
            const rec = !w.includes("--no-install-recommends");
            const add = pk.reduce((a, p) => a + APT[p] * (rec ? APT_RECOMMENDS[p] || 1.2 : 1), 0) * MB;
            if (!w.some((x) => /^-[a-z]*y|^--yes$|^--assume-yes$/.test(x))) { log.push("After this operation, " + Math.round(add / MB) + " MB of additional disk space will be used.", "Do you want to continue? [Y/n] Abort."); return { code: 1, log, time: 1.3 }; }
            size += add; time += 2 + add / (20 * MB); for (const p of pk) { if (!st.apt.includes(p)) st.apt.push(p); if (!st.bins.includes(p)) st.bins.push(p); if (p === "build-essential") st.bins.push("gcc", "make"); }
          } else if (sub === "clean") { /* rien de visible */ }
          break;
        }
        case "apk": {
          if (st.pkg !== "apk") return nf("apk");
          if (w.includes("add")) {
            const pk = w.slice(w.indexOf("add") + 1).filter((x) => !x.startsWith("-")).map((x) => x.split("=")[0]);
            const bad = pk.find((p) => APK[p] === undefined); if (bad) { log.push("ERROR: unable to select packages:", "  " + bad + " (no such package):", "    required by: world[" + bad + "]"); return { code: 1, log, time: 1 }; }
            size += pk.reduce((a, p) => a + APK[p], 0) * MB + (w.includes("--no-cache") ? 0 : 2.6 * MB); time += 1.5;
            for (const p of pk) { st.apt.push(p); if (!st.bins.includes(p)) st.bins.push(p); }
          }
          break;
        }
        case "rm": {
          const paths = w.slice(1).filter((x) => !x.startsWith("-"));
          for (const p0 of paths) {
            if (/^\/var\/lib\/apt\/lists/.test(p0)) { st.aptLists = false; if (listsHere) size -= 45 * MB; continue; }
            const re = globRe(join(cwd, p0)); for (const k of Object.keys(st.files)) if (re.test(k) || under(k, join(cwd, p0))) delete st.files[k];
          }
          break;
        }
        case "pip": case "pip3": case "python": case "python3": {
          if (!st.bins.includes("pip") && !st.bins.includes("python")) return nf(c);
          if (c.startsWith("python") && !(w[1] === "-m" && /^pip3?$/.test(w[2]))) { if (w[1] === "-m" && w[2] === "pytest") { if (!st.pip.includes("pytest")) { log.push("/usr/local/bin/python: No module named pytest"); return { code: 1, log, time }; } log.push("============================= test session starts ==============================", "collected 4 items", "", "tests/test_api.py ....                                                   [100%]", "", "============================== 4 passed in 0.31s ==============================="); time += 1.2; } break; }
          const rest = w.slice(w.indexOf("install") + 1); if (!w.includes("install")) break;
          const pk = [];
          for (let i = 0; i < rest.length; i++) {
            const x = rest[i];
            if (x === "-r" || x === "--requirement" || x.startsWith("--requirement=")) {
              const f = x.includes("=") ? x.split("=")[1] : rest[++i]; const p = join(cwd, f);
              if (!st.files[p]) { log.push("ERROR: Could not open requirements file: [Errno 2] No such file or directory: '" + f + "'"); return { code: 1, log, time: 0.6 }; }
              for (const l of st.files[p].data.split("\n")) { const n = l.replace(/#.*/, "").trim(); if (n && !n.startsWith("-")) pk.push(n); }
            } else if (!x.startsWith("-")) pk.push(x);
          }
          if (!pk.length) { log.push("ERROR: You must give at least one requirement to install (see \"pip help install\")"); return { code: 1, log, time }; }
          const names = pk.map((p) => p.split(/[=<>~!;@ ]/)[0].toLowerCase());
          let add = 0; for (const n of names) { add += (PIP[n] ?? 2) * MB; for (const d of [n, ...(PIP_DEPS[n] || [])]) if (!st.pip.includes(d)) st.pip.push(d.replace(/\[.*\]$/, "")); }
          for (const b of ["uvicorn", "gunicorn", "flask", "pytest", "fastapi"]) if (st.pip.includes(b) && !st.bins.includes(b)) st.bins.push(b);
          size += add * (w.includes("--no-cache-dir") || /^(1|true|on|yes|off|0)$/i.test(st.env.PIP_NO_CACHE_DIR || "") ? 1 : 1.6); time += 1 + add / (4 * MB);
          log.push(...names.map((n) => "Collecting " + n), "Successfully installed " + names.join(" "));
          break;
        }
        case "npm": {
          if (!st.bins.includes("npm")) return nf("npm");
          if (w[1] === "ci" || w[1] === "install" || w[1] === "i") {
            const pj = st.files[join(cwd, "package.json")];
            if (w[1] === "ci" && !st.files[join(cwd, "package-lock.json")]) { log.push("npm error code EUSAGE", "npm error", "npm error The `npm ci` command can only install with an existing package-lock.json or", "npm error npm-shrinkwrap.json with lockfileVersion >= 1."); return { code: 1, log, time: 0.8 }; }
            if (!pj) { log.push("npm error code ENOENT", "npm error syscall open", "npm error path " + join(cwd, "package.json"), "npm error errno -2", "npm error enoent Could not read package.json: Error: ENOENT: no such file or directory, open '" + join(cwd, "package.json") + "'"); return { code: 254, log, time: 0.5 }; }
            let j = {}; try { j = JSON.parse(pj.data); } catch (e) { /* json invalide */ }
            const deps = Object.keys(j.dependencies || {}).concat(w.some((x) => /^--omit=dev$|^--production$/.test(x)) ? [] : Object.keys(j.devDependencies || {}));
            for (const d of deps) if (!st.npm.includes(d)) st.npm.push(d);
            size += deps.reduce((a, d) => a + (NPM[d] ?? 1.5), 0) * MB; time += 2.4;
            st.files[join(cwd, "node_modules/.package-lock.json")] = { data: "{}", mode: 0o644, owner: "root" };
            log.push("added " + (deps.length * 23 + 4) + " packages, and audited " + (deps.length * 23 + 5) + " packages in 3s", "found 0 vulnerabilities");
          } else if (w[1] === "run" || w[1] === "test") { log.push("> " + w.slice(1).join(" ")); }
          break;
        }
        case "useradd": case "adduser": case "groupadd": case "addgroup": {
          if (c === "useradd" || c === "groupadd") { if (st.os === "alpine") return nf(c); }
          if (st.os === "busybox" || st.os === "distroless" || st.os === "scratch") return nf(c);
          const args = w.slice(1); const name = args.filter((x, i) => !x.startsWith("-") && !["-u", "--uid", "-g", "--gid", "-G", "--ingroup", "-s", "--shell", "-h", "--home", "-d", "--gecos", "-c", "--home-dir"].includes(args[i - 1])).pop();
          if (c === "useradd" || c === "adduser") {
            if (st.users[name] !== undefined) { log.push(c === "useradd" ? "useradd: user '" + name + "' already exists" : "adduser: The user `" + name + "' already exists."); return { code: c === "useradd" ? 9 : 1, log, time }; }
            const ui = args.findIndex((x) => x === "-u" || x === "--uid"); const used = Object.values(st.users);
            st.users[name] = ui >= 0 ? +args[ui + 1] : (st.os === "alpine" && args.includes("-S") ? 100 : Math.max(999, ...used.filter((u) => u < 60000)) + 1);
            if (args.includes("-m") || args.includes("--create-home") || c === "adduser") st.dirs.push("/home/" + name);
          } else st.groups = { ...(st.groups || {}), [name]: true };
          break;
        }
        case "chown": {
          const args = w.slice(1).filter((x) => !x.startsWith("-")); const [u] = args[0].split(":");
          if (st.users[u] === undefined && !/^\d+$/.test(u)) { log.push("chown: invalid user: '" + args[0] + "'"); return { code: 1, log, time }; }
          for (const p0 of args.slice(1)) { const p = join(cwd, p0); for (const k of Object.keys(st.files)) if (under(k, p)) st.files[k] = { ...st.files[k], owner: u }; st.owners = { ...(st.owners || {}), [p]: u }; }
          break;
        }
        case "chmod": { const args = w.slice(1).filter((x) => !x.startsWith("-") || /^-[rwx]/.test(x)); const md = args[0]; for (const p0 of args.slice(1)) { const p = join(cwd, p0); for (const k of Object.keys(st.files)) if (under(k, p)) st.files[k] = { ...st.files[k], mode: /^\d+$/.test(md) ? parseInt(md, 8) : md.includes("+x") ? st.files[k].mode | 0o111 : st.files[k].mode }; } break; }
        case "mkdir": for (const d of w.slice(1).filter((x) => !x.startsWith("-"))) if (!st.dirs.includes(join(cwd, d))) st.dirs.push(join(cwd, d)); break;
        case "curl": case "wget": case "git": case "bash": case "gcc": case "make": case "vim":
          if (!st.bins.includes(c) && !(c === "wget" && st.os === "alpine")) return nf(c);
          if (c === "curl") time += 0.6;
          break;
        default:
          if (!hasBin(c) && ["pytest", "uvicorn", "gunicorn", "flask", "node", "go", "cargo", "java", "mvn"].includes(c)) return nf(c);
      }
    }
    st.layers.push({ createdBy: "RUN /bin/sh -c " + cmd + " # buildkit", size: Math.max(size, 0) });
    return { code: 0, log, time: +time.toFixed(1) };
  }

  /* ----- conteneurs ----- */
  container(ref, { must = true } = {}) {
    const c = this.containers.find((x) => x.name === ref.replace(/^\//, "")) || (ref.length >= 3 ? this.containers.find((x) => x.id.startsWith(ref)) : null);
    if (!c && must) throw new DockerErr("Error response from daemon: No such container: " + ref);
    return c;
  }
  autoName() { const a = ["admiring", "brave", "eager", "focused", "jolly", "nifty", "quirky", "serene", "vibrant", "zen"], b = ["hopper", "lovelace", "turing", "curie", "darwin", "euler", "noether", "ritchie", "torvalds", "wozniak"]; let n; do { n = a[this.seq % 10] + "_" + b[(this.seq * 7) % 10]; this.seq++; } while (this.containers.some((c) => c.name === n)); return n; }

  /** Crée un conteneur (docker create / run). spec : image, name, cmd, entrypoint, env, ports, mounts, network, restart, user, workdir, labels, rm, healthcheck, aliases. */
  create(spec) {
    const img = spec.imageObj;
    const name = spec.name || this.autoName();
    const dup = this.containers.find((c) => c.name === name);
    if (dup) throw new DockerErr('docker: Error response from daemon: Conflict. The container name "/' + name + '" is already in use by container "' + dup.id + '". You have to remove (or rename) that container to be able to reuse that name.', 125);
    const c = {
      id: this.id("ctr"), name, image: img.id, imageRef: spec.imageRef, created: this.t, state: "created", exitCode: 0, logs: [], restarts: 0,
      env: { ...img.env, ...spec.env }, user: spec.user ?? img.user ?? "", workdir: spec.workdir || img.workdir || "/",
      entrypoint: spec.entrypoint !== undefined ? spec.entrypoint : img.entrypoint, cmd: spec.cmd && spec.cmd.length ? spec.cmd : spec.entrypoint !== undefined ? [] : img.cmd,
      ports: spec.ports || [], mounts: [], networks: {}, restart: spec.restart || "no", labels: spec.labels || {}, rm: !!spec.rm,
      healthcheck: spec.healthcheck !== undefined ? spec.healthcheck : img.healthcheck, health: null, files: { ...img.files }, aliases: spec.aliases || []
    };
    for (const m of spec.mounts || []) c.mounts.push(m);
    for (const v of img.volumes || []) if (!c.mounts.some((m) => m.dest === v)) { const vn = hash("anon:" + c.id + v); this.addVolume(vn, { anonymous: true }); c.mounts.push({ type: "volume", source: vn, dest: v, rw: true }); }
    for (const m of c.mounts) if (m.type === "volume") { const v = this.addVolume(m.source, m.labels || {}); if (!v.init) { v.init = true; for (const [p, f] of Object.entries(img.files)) if (under(p, m.dest)) v.files[p.slice(m.dest.length) || "/"] = { ...f }; } }
    const net = spec.network || "bridge";
    if (net !== "none" && net !== "host") this.connect(c, this.network(net).name, spec.aliases);
    this.containers.push(c);
    return c;
  }
  connect(c, netName, aliases = []) {
    const n = this.network(netName);
    if (c.networks[n.name]) throw new DockerErr("Error response from daemon: endpoint with name " + c.name + " already exists in network " + n.name);
    c.networks[n.name] = { ip: n.subnet + "." + n.next++, aliases: n.user ? [c.name, c.id.slice(0, 12), ...aliases] : [] };
  }

  /** Démarre un conteneur : ports, utilisateur, commande, comportement de l'application. */
  start(c) {
    if (c.state === "running") return;
    const img = this.images[c.image];
    // Ports publiés : conflits avec d'autres conteneurs ou avec un service de l'hôte.
    for (const p of c.ports) {
      if (!p.host) p.host = String(32768 + this.containers.filter((x) => x.ports.length).indexOf(c) * 3 + c.ports.indexOf(p));
      const other = this.containers.find((x) => x !== c && x.state === "running" && x.ports.some((q) => q.host === p.host && (q.hostIp || "0.0.0.0") === (p.hostIp || "0.0.0.0")));
      if (other) throw new DockerErr("docker: Error response from daemon: driver failed programming external connectivity on endpoint " + c.name + " (" + c.id + "): Bind for " + (p.hostIp || "0.0.0.0") + ":" + p.host + " failed: port is already allocated.", 125);
      const hostSvc = Object.values(this.sh.services).some((s) => s.active && (s.ports || []).includes(+p.host)) || this.sh.procs.some((q) => q.port === +p.host);
      if (hostSvc) throw new DockerErr("docker: Error response from daemon: driver failed programming external connectivity on endpoint " + c.name + " (" + c.id + "): failed to bind port " + (p.hostIp || "0.0.0.0") + ":" + p.host + "/tcp: Error starting userland proxy: listen tcp4 " + (p.hostIp || "0.0.0.0") + ":" + p.host + ": bind: address already in use.", 125);
    }
    const user = (c.user || "root").split(":")[0];
    if (!/^\d+$/.test(user) && img.users[user] === undefined) throw new DockerErr("docker: Error response from daemon: unable to find user " + user + ": no matching entries in passwd file.", 126);
    const argv = [...(c.entrypoint || []), ...(c.cmd || [])];
    if (!argv.length) throw new DockerErr("docker: Error response from daemon: no command specified.", 125);
    const exe = argv[0] === "/bin/sh" && argv[1] === "-c" ? words(argv[2] || "")[0] : argv[0];
    const shellForm = argv[0] === "/bin/sh" && argv[1] === "-c";
    if (shellForm && !img.shell) throw new DockerErr('docker: Error response from daemon: failed to create task for container: failed to create shim task: OCI runtime create failed: runc create failed: unable to start container process: error during container init: exec: "/bin/sh": stat /bin/sh: no such file or directory: unknown.', 127);
    const base = String(exe).split("/").pop();
    const fileExe = exe.startsWith("/") || exe.startsWith("./") ? this.readFile(c, join(c.workdir, exe)) : null;
    if (!fileExe && !img.bins.includes(base) && !["sh", "echo", "sleep", "env", "cat", "ls", "true", "printenv", "id", "whoami"].includes(base) || (base === "sh" && !img.shell)) {
      const msg = 'exec: "' + exe + '": ' + (exe.includes("/") ? "stat " + exe + ": no such file or directory" : "executable file not found in $PATH");
      if (shellForm) { c.state = "exited"; c.exitCode = 127; c.startedAt = this.t; c.logs.push((img.os === "alpine" ? "/bin/sh: " : "/bin/sh: 1: ") + exe + ": not found"); return; }
      c.state = "created";
      throw new DockerErr("docker: Error response from daemon: failed to create task for container: failed to create shim task: OCI runtime create failed: runc create failed: unable to start container process: error during container init: " + msg + ": unknown.", 127);
    }
    c.startedAt = this.t; c.state = "running"; c.exitCode = 0;
    this.behave(c, shellForm ? words(argv[2]) : argv, img);
    if (c.state === "exited" && c.exitCode !== 0 && ["always", "unless-stopped", "on-failure"].includes(c.restart.split(":")[0])) { c.state = "restarting"; c.restarts++; }
  }

  /** Décide ce que fait le processus principal : serveur qui écoute, tâche qui se termine, ou plantage. */
  behave(c, argv, img) {
    const log = (...l) => c.logs.push(...l);
    const exit = (code, ...l) => { log(...l); c.state = "exited"; c.exitCode = code; c.listen = null; };
    c.listen = null; c.app = null;
    const a = argv.map(String); const b = a[0].split("/").pop();
    const opt = (names, d) => { for (let i = 0; i < a.length; i++) { for (const n of names) { if (a[i] === n) return a[i + 1]; if (a[i].startsWith(n + "=")) return a[i].slice(n.length + 1); } } return d; };
    // Programmes « système ».
    if (b === "hello") return exit(0, "", "Hello from Docker!", "This message shows that your installation appears to be working correctly.", "");
    if (b === "echo") return exit(0, a.slice(1).join(" "));
    if (["sh", "bash", "ash"].includes(b) && a.length === 1) return exit(0);
    if (["sh", "bash"].includes(b) && a[1] === "-c") return this.behave(c, words(a.slice(2).join(" ")), img);
    if (b === "sleep") { c.listen = null; return; }
    if (["env", "printenv"].includes(b)) return exit(0, ...Object.entries(c.env).map(([k, v]) => k + "=" + v));
    if (b === "nginx" || img.app === "nginx" && b === "/docker-entrypoint.sh") {
      log("/docker-entrypoint.sh: /docker-entrypoint.d/ is not empty, will attempt to perform configuration", "/docker-entrypoint.sh: Configuration complete; ready for start up", "2026/11/12 09:30:00 [notice] 1#1: nginx/1.27.3", "2026/11/12 09:30:00 [notice] 1#1: start worker processes");
      c.listen = { port: 80, host: "0.0.0.0", kind: "nginx" }; return;
    }
    if (b === "postgres") {
      const vol = c.mounts.find((m) => under("/var/lib/postgresql/data", m.dest));
      const store = vol ? (vol.type === "volume" ? this.volumes[vol.source].files : null) : c.files;
      const initKey = vol ? (vol.dest === "/var/lib/postgresql/data" ? "/PG_VERSION" : "/data/PG_VERSION") : "/var/lib/postgresql/data/PG_VERSION";
      const initialized = store && store[initKey];
      if (!initialized && !c.env.POSTGRES_PASSWORD && c.env.POSTGRES_HOST_AUTH_METHOD !== "trust") return exit(1, "Error: Database is uninitialized and superuser password is not specified.", "       You must specify POSTGRES_PASSWORD to a non-empty value for the", "       superuser. For example, \"-e POSTGRES_PASSWORD=password\" on \"docker run\".", "", "       You may also use \"POSTGRES_HOST_AUTH_METHOD=trust\" to allow all", "       connections without a password. This is *not* recommended.");
      if (!initialized) {
        if (store) store[initKey] = { data: "16\n", mode: 0o600, owner: "postgres", pg: { user: c.env.POSTGRES_USER || "postgres", password: c.env.POSTGRES_PASSWORD || "", db: c.env.POSTGRES_DB || c.env.POSTGRES_USER || "postgres" } };
        log("The files belonging to this database system will be owned by user \"postgres\".", "...", "PostgreSQL init process complete; ready for start up.", "");
      } else log("", "PostgreSQL Database directory appears to contain a database; Skipping initialization", "");
      c.pg = (store && store[initKey] && store[initKey].pg) || { user: c.env.POSTGRES_USER || "postgres", password: c.env.POSTGRES_PASSWORD || "", db: "postgres" };
      log("2026-11-12 09:30:01.123 UTC [1] LOG:  starting PostgreSQL 16.6 (Debian 16.6-1.pgdg120+1) on x86_64-pc-linux-gnu", "2026-11-12 09:30:01.130 UTC [1] LOG:  listening on IPv4 address \"0.0.0.0\", port 5432", "2026-11-12 09:30:01.141 UTC [1] LOG:  database system is ready to accept connections");
      c.listen = { port: 5432, host: "0.0.0.0", kind: "postgres" }; return;
    }
    if (b === "redis-server") { log("1:C 12 Nov 2026 09:30:00.000 * oO0OoO0OoO0Oo Redis is starting oO0OoO0OoO0Oo", "1:M 12 Nov 2026 09:30:00.002 * Ready to accept connections tcp"); c.listen = { port: 6379, host: "0.0.0.0", kind: "redis" }; return; }
    // Applications : Python, Node.
    let file = null, kind = "script", host = "127.0.0.1", port = null;
    if (/^python3?(\.\d+)?$/.test(b) && a[1] === "-m") {
      const mod = a[2];
      if (mod === "http.server") { c.listen = { port: +(a.find((x, i) => i > 2 && /^\d+$/.test(x)) || 8000), host: opt(["--bind", "-b"], "0.0.0.0"), kind: "static" }; log("Serving HTTP on 0.0.0.0 port " + c.listen.port + " (http://0.0.0.0:" + c.listen.port + "/) ..."); return; }
      if (!this.hasModule(img, mod)) return exit(1, "/usr/local/bin/python: No module named " + mod);
      return this.behave(c, [mod, ...a.slice(3)], img);
    }
    if (/^python3?(\.\d+)?$/.test(b)) {
      if (!a[1]) return exit(0);
      if (a[1] === "-c") return exit(0);
      file = join(c.workdir, a[1]);
      if (!this.readFile(c, file)) return exit(2, b + ": can't open file '" + file + "': [Errno 2] No such file or directory");
    } else if (b === "uvicorn" || b === "fastapi" || b === "gunicorn" || b === "flask") {
      kind = b;
      const target = b === "flask" ? (c.env.FLASK_APP || opt(["--app"], "app")) : b === "fastapi" ? a[2] : a.find((x, i) => i > 0 && !x.startsWith("-") && !/^-/.test(a[i - 1]) && x.includes(":")) || a.find((x, i) => i > 0 && !x.startsWith("-") && !["--host", "--port", "-b", "--bind", "-w", "--workers"].includes(a[i - 1]));
      const mod = String(target || "").split(":")[0];
      file = b === "fastapi" ? join(c.workdir, a[2] || "main.py") : join(c.workdir, mod.replace(/\./g, "/") + ".py");
      if (b === "uvicorn") { host = opt(["--host"], "127.0.0.1"); port = +opt(["--port"], 8000); }
      if (b === "fastapi") { host = opt(["--host"], a[1] === "run" ? "0.0.0.0" : "127.0.0.1"); port = +opt(["--port"], 8000); }
      if (b === "gunicorn") { const bind = opt(["-b", "--bind"], "127.0.0.1:8000"); [host, port] = [bind.split(":")[0] || "0.0.0.0", +(bind.split(":")[1] || 8000)]; }
      if (b === "flask") { host = opt(["--host", "-h"], "127.0.0.1"); port = +opt(["--port", "-p"], 5000); }
      if (!this.readFile(c, file)) {
        if (b === "uvicorn") return exit(1, "ERROR:    Error loading ASGI app. Could not import module \"" + mod + "\".");
        if (b === "gunicorn") return exit(3, "[2026-11-12 09:30:00 +0000] [1] [INFO] Starting gunicorn 23.0.0", "ModuleNotFoundError: No module named '" + mod + "'", "[2026-11-12 09:30:00 +0000] [7] [INFO] Worker exiting (pid: 7)", "[2026-11-12 09:30:00 +0000] [1] [ERROR] Reason: Worker failed to boot.");
        return exit(2, "Error: Could not import '" + mod + "'.");
      }
    } else if (b === "node" || b === "npm") {
      kind = "node";
      if (b === "npm") {
        const pj = this.readFile(c, join(c.workdir, "package.json")); let j = {}; try { j = JSON.parse(pj ? pj.data : "{}"); } catch (e) { /* invalide */ }
        const script = (j.scripts || {})[a[1] === "run" ? a[2] : a[1]];
        if (!pj) return exit(254, "npm error code ENOENT", "npm error path " + join(c.workdir, "package.json"), "npm error enoent Could not read package.json");
        if (!script) return exit(1, "npm error Missing script: \"" + (a[1] === "run" ? a[2] : a[1]) + "\"");
        log("", "> " + (j.name || "app") + "@" + (j.version || "1.0.0") + " " + (a[1] === "run" ? a[2] : a[1]), "> " + script, "");
        return this.behave(c, words(script), img);
      }
      file = join(c.workdir, a[1] || "index.js");
      if (!this.readFile(c, file)) return exit(1, "node:internal/modules/cjs/loader:1228", "  throw err;", "  ^", "", "Error: Cannot find module '" + file + "'", "    at Module._resolveFilename (node:internal/modules/cjs/loader:1225:15)", "", "Node.js v20.18.1");
    } else if (fileExe || this.readFile(c, join(c.workdir, a[0]))) { file = join(c.workdir, a[0]); kind = "script"; }
    else { return; /* commande longue inconnue : on la considère en cours d'exécution */ }
    // Spécification de l'application, rattachée au fichier source copié dans l'image.
    const f = this.readFile(c, file); const spec = (f && f.origin && this.apps[f.origin]) || {};
    c.app = spec;
    const lang = kind === "node" ? "node" : "python";
    for (const m of spec.requires || []) {
      if (lang === "python" && !this.hasModule(img, m)) return exit(1, "Traceback (most recent call last):", '  File "' + file + '", line 1, in <module>', "    " + (spec.importLine || "import " + m), "ModuleNotFoundError: No module named '" + m + "'");
      if (lang === "node" && !img.npm.includes(m)) return exit(1, "node:internal/modules/cjs/loader:1228", "  throw err;", "  ^", "", "Error: Cannot find module '" + m + "'", "Require stack:", "- " + file, "", "Node.js v20.18.1");
    }
    for (const v of spec.env || []) if (!(v in c.env) || c.env[v] === "") {
      if (lang === "node") return exit(1, "Error: la variable d'environnement " + v + " est obligatoire", "    at Object.<anonymous> (" + file + ":3:9)", "", "Node.js v20.18.1");
      return exit(1, "Traceback (most recent call last):", '  File "' + file + '", line ' + (spec.envLine || 5) + ", in <module>", '    ' + v.toLowerCase() + ' = os.environ["' + v + '"]', "                 ~~~~~~~~~~^^^^^^^^^^^^", "KeyError: '" + v + "'");
    }
    if (spec.writes) {
      const u = (c.user || "root").split(":")[0];
      const owner = this.ownerOf(c, spec.writes);
      if (u !== "root" && u !== "0" && owner !== u) return exit(1, "Traceback (most recent call last):", '  File "' + file + '", line 9, in <module>', "    os.makedirs(\"" + spec.writes + "\", exist_ok=True)", "PermissionError: [Errno 13] Permission denied: '" + spec.writes + "'");
    }
    for (const dep of spec.deps || []) {
      const url = c.env[dep.env]; if (!url) continue;
      const m = /^(\w[\w+]*):\/\/(?:([^:@/]*)(?::([^@/]*))?@)?([^:/?]+)(?::(\d+))?(?:\/(\w*))?/.exec(url); if (!m) continue;
      const [, scheme, du, dpw, dhost, dport0, ddb] = m; const dport = +(dport0 || (scheme.startsWith("postgres") ? 5432 : scheme === "redis" ? 6379 : 80));
      const pg = scheme.startsWith("postgres");
      const target = this.resolveFrom(c, dhost);
      const fail = (msg) => exit(1, ...(lang === "python" ? ["Traceback (most recent call last):", '  File "' + file + '", line ' + (spec.dbLine || 12) + ", in <module>", "    " + (pg ? "conn = psycopg2.connect(DATABASE_URL)" : "client.ping()")] : []), msg);
      if (dhost === "localhost" || dhost === "127.0.0.1") return fail(pg ? 'psycopg2.OperationalError: connection to server at "localhost" (127.0.0.1), port ' + dport + " failed: Connection refused\n\tIs the server running on that host and accepting TCP/IP connections?" : "redis.exceptions.ConnectionError: Error 111 connecting to localhost:" + dport + ". Connection refused.");
      if (!target) return fail(pg ? 'psycopg2.OperationalError: could not translate host name "' + dhost + '" to address: Name or service not known' : "redis.exceptions.ConnectionError: Error -2 connecting to " + dhost + ":" + dport + ". Name or service not known.");
      const ok = target.c.state === "running" && target.c.listen && target.c.listen.port === dport;
      if (!ok) return fail(pg ? 'psycopg2.OperationalError: connection to server at "' + dhost + '" (' + target.ip + "), port " + dport + " failed: Connection refused\n\tIs the server running on that host and accepting TCP/IP connections?" : "redis.exceptions.ConnectionError: Error 111 connecting to " + dhost + ":" + dport + ". Connection refused.");
      if (pg && target.c.pg && (du !== target.c.pg.user || (dpw || "") !== target.c.pg.password)) return fail('psycopg2.OperationalError: connection to server at "' + dhost + '" (' + target.ip + '), port ' + dport + ' failed: FATAL:  password authentication failed for user "' + du + '"');
      if (pg && target.c.pg && ddb && ddb !== target.c.pg.db && ddb !== "postgres") return fail('psycopg2.OperationalError: connection to server at "' + dhost + '" (' + target.ip + '), port ' + dport + ' failed: FATAL:  database "' + ddb + '" does not exist');
    }
    if (spec.exits !== undefined) return exit(spec.exits, ...(spec.logs || []));
    port = spec.port ?? port ?? (kind === "node" ? 3000 : 8000);
    if (kind === "script" || kind === "node") host = spec.host || host;
    if (kind === "uvicorn" || kind === "fastapi") log("INFO:     Started server process [1]", "INFO:     Waiting for application startup.", "INFO:     Application startup complete.", "INFO:     Uvicorn running on http://" + host + ":" + port + " (Press CTRL+C to quit)");
    else if (kind === "gunicorn") log("[2026-11-12 09:30:00 +0000] [1] [INFO] Starting gunicorn 23.0.0", "[2026-11-12 09:30:00 +0000] [1] [INFO] Listening at: http://" + host + ":" + port + " (1)", "[2026-11-12 09:30:00 +0000] [7] [INFO] Booting worker with pid: 7");
    else if (kind === "flask") log(" * Serving Flask app 'app'", " * Debug mode: off", " * Running on http://" + host + ":" + port, "Press CTRL+C to quit");
    log(...(spec.logs || []));
    c.listen = { port, host, kind: "app" };
  }
  hasModule(img, m) { const pk = MODULE_PKG[m] || m; return img.pip.includes(pk) || img.pip.includes(m) || ["os", "sys", "json", "http", "pathlib", "sqlite3", "time", "datetime", "logging", "unittest", "venv", "pip"].includes(m); }
  ownerOf(c, path) { const img = this.images[c.image]; for (let p = path; p !== "/"; p = p.slice(0, p.lastIndexOf("/")) || "/") { if (img.owners && img.owners[p]) return img.owners[p]; const f = Object.entries(c.files).find(([k]) => k === p); if (f) return f[1].owner; } return "root"; }

  /** Fichier vu depuis le conteneur : montage (volume ou dossier de l'hôte) ou couche de l'image. */
  mountFor(c, p) { return c.mounts.filter((m) => under(p, m.dest)).sort((x, y) => y.dest.length - x.dest.length)[0]; }
  readFile(c, p) {
    const m = this.mountFor(c, p);
    if (m) {
      const rel = p.slice(m.dest.length) || "/";
      if (m.type === "volume") return this.volumes[m.source].files[rel] || null;
      try { const n = this.sh.fs.lookup(m.source + (rel === "/" ? "" : rel), { user: "root" }).node; return n.t === "f" ? { data: n.data, mode: n.mode, owner: n.owner, origin: m.source + rel } : null; } catch (e) { return null; }
    }
    return c.files[p] || null;
  }
  writeFile(c, p, data) {
    const m = this.mountFor(c, p);
    if (m && !m.rw) throw new DockerErr("Read-only file system");
    if (m && m.type === "volume") { this.volumes[m.source].files[p.slice(m.dest.length)] = { data, mode: 0o644, owner: "root" }; return; }
    if (m) { this.sh.fs.write(m.source + p.slice(m.dest.length), data, "root"); return; }
    c.files[p] = { data, mode: 0o644, owner: c.user || "root" };
  }
  listDir(c, dir) {
    const out = new Set(); const d = dir.replace(/\/$/, "") || "/";
    const m = this.mountFor(c, d);
    if (m && m.type === "bind") { try { for (const n of this.sh.fs.list(m.source + d.slice(m.dest.length), "root")) out.add(n); } catch (e) { return null; } return [...out].sort(); }
    const add = (p) => { if (under(p, d) && p !== d) out.add(p.slice(d === "/" ? 1 : d.length + 1).split("/")[0]); };
    Object.keys(c.files).forEach(add); (this.images[c.image].dirs || []).forEach(add);
    for (const mm of c.mounts) { add(mm.dest); if (under(d, mm.dest) && mm.type === "volume") for (const k of Object.keys(this.volumes[mm.source].files)) add(mm.dest + k); }
    if (!out.size && !Object.keys(c.files).some((p) => under(p, d)) && !(this.images[c.image].dirs || []).includes(d) && !c.mounts.some((x) => under(d, x.dest))) return null;
    return [...out].sort();
  }

  /** DNS d'un conteneur : les noms ne se résolvent que sur un réseau défini par l'utilisateur partagé. */
  resolveFrom(c, name) {
    for (const [nn, ep] of Object.entries(c.networks)) {
      if (!this.networks[nn] || !this.networks[nn].user) continue;
      for (const o of this.containers) { const e = o.networks[nn]; if (o !== c && e && (e.aliases.includes(name) || o.name === name)) return { c: o, ip: e.ip }; }
    }
    return null;
  }

  /** Requête HTTP vers un conteneur. from = null pour l'hôte (ports publiés). */
  http(c, port, path, method = "GET") {
    const L = c.listen;
    if (c.state !== "running" || !L || L.port !== port) return { error: [7, "Failed to connect to " + (c.name) + " port " + port + " after 0 ms: Couldn't connect to server"] };
    const access = (st, len) => { if (L.kind === "nginx") c.logs.push("172.17.0.1 - - [12/Nov/2026:09:30:00 +0000] \"" + method + " " + path + " HTTP/1.1\" " + st + " " + len + " \"-\" \"curl/8.5.0\" \"-\""); else if (c.app || L.kind === "app") c.logs.push('INFO:     172.17.0.1:51234 - "' + method + " " + path + ' HTTP/1.1" ' + st + " " + (REASONS[st] || "")); };
    if (L.kind === "nginx" || L.kind === "static") {
      let root = "/usr/share/nginx/html";
      const conf = this.readFile(c, "/etc/nginx/conf.d/default.conf"); const m = conf && /root\s+([^;]+);/.exec(conf.data); if (m) root = m[1].trim();
      if (L.kind === "static") root = c.workdir;
      const f = this.readFile(c, join(root, "." + (path.endsWith("/") ? path + "index.html" : path)));
      if (!f) { const body = "<html>\r\n<head><title>404 Not Found</title></head>\r\n<body>\r\n<center><h1>404 Not Found</h1></center>\r\n<hr><center>nginx/1.27.3</center>\r\n</body>\r\n</html>\r\n"; access(404, 153); return { status: 404, type: "text/html", body, server: "nginx/1.27.3" }; }
      access(200, bytes(f.data)); return { status: 200, type: "text/html", body: f.data, server: L.kind === "nginx" ? "nginx/1.27.3" : "SimpleHTTP/0.6 Python/3.12.8" };
    }
    if (L.kind === "postgres" || L.kind === "redis") return { error: [52, "Empty reply from server"] };
    const routes = (c.app && c.app.routes) || {};
    let r = routes[path];
    if (c.app && c.app.counter && path === (c.app.counterPath || "/")) {
      const f = this.readFile(c, c.app.counter); const n = (f ? parseInt(f.data, 10) || 0 : 0) + 1;
      try { this.writeFile(c, c.app.counter, String(n)); } catch (e) { access(500); return { status: 500, type: "text/plain", body: "Internal Server Error" }; }
      r = [200, (c.app.counterBody || '{"visites":{n}}').replace("{n}", n)];
    }
    if (!r) { access(404); return { status: 404, type: "application/json", body: '{"detail":"Not Found"}', server: "uvicorn" }; }
    const body = String(r[1]).replace(/\{env\.(\w+)\}/g, (_, k) => c.env[k] ?? "").replace(/\{hostname\}/g, c.id.slice(0, 12));
    access(r[0]); return { status: r[0], type: r[2] || (body.startsWith("{") ? "application/json" : "text/plain"), body, server: "uvicorn" };
  }
  /** Requête depuis l'hôte sur un port publié. */
  hostHttp(port, path) {
    const c = this.containers.find((x) => x.state === "running" && x.ports.some((p) => +p.host === port));
    if (!c) return null;
    const p = c.ports.find((q) => +q.host === port);
    if (!c.listen || c.listen.port !== +p.container || c.listen.host === "127.0.0.1") return { error: [56, "Recv failure: Connection reset by peer"] };
    return this.http(c, +p.container, path);
  }

  /** Vérification de santé (HEALTHCHECK ou healthcheck de Compose). */
  checkHealth(c) {
    if (!c.healthcheck || c.state !== "running") { c.health = null; return; }
    const t = c.healthcheck.test; const img = this.images[c.image];
    const cmd = t[0] === "CMD-SHELL" ? words(t[1]) : t.slice(1);
    const b = cmd[0];
    let ok = false;
    if (b === "curl" || b === "wget") {
      if (!img.bins.includes(b) && !(b === "wget" && img.os === "alpine")) ok = false;
      else { const url = cmd.find((x) => /^https?:\/\//.test(x)); const m = url && /^https?:\/\/([^/:]+)(?::(\d+))?(\/\S*)?/.exec(url); const r = m && (m[1] === "localhost" || m[1] === "127.0.0.1") ? this.http(c, +(m[2] || 80), m[3] || "/") : { error: true }; ok = !r.error && r.status < 400; }
    } else if (b === "pg_isready") ok = c.listen && c.listen.kind === "postgres";
    else if (b === "redis-cli") ok = c.listen && c.listen.kind === "redis";
    else if (b === "python" || b === "python3") ok = !!c.listen;
    else ok = true;
    c.health = ok ? "healthy" : "unhealthy";
  }

  /** Relance les conteneurs en redémarrage (politique restart) : une dépendance a pu démarrer entre-temps. */
  settle() {
    for (const c of this.containers) {
      if (c.state === "restarting") {
        c.state = "exited"; const before = c.logs.length;
        try { this.start(c); } catch (e) { c.state = "exited"; }
        if (c.state === "restarting" && c.logs.length - before > 12) c.logs.splice(before, c.logs.length - before - 12);
      }
      if (c.state === "running") this.checkHealth(c);
    }
  }
  stop(c) { if (c.state === "running" || c.state === "restarting") { c.state = "exited"; c.exitCode = c.listen && c.listen.kind === "app" ? 0 : c.exitCode; c.listen = null; c.health = null; c.stoppedAt = this.t; c.manualStop = true; } }
  remove(c) { this.containers = this.containers.filter((x) => x !== c); for (const m of c.mounts) if (m.type === "volume" && this.volumes[m.source] && this.volumes[m.source].labels.anonymous && c.rm) delete this.volumes[m.source]; }
}
const REASONS = { 200: "OK", 201: "Created", 404: "Not Found", 500: "Internal Server Error" };
const human1 = (b) => (b >= 1e6 ? +(b / 1e6).toFixed(2) + "MB" : b >= 1e3 ? +(b / 1e3).toFixed(2) + "kB" : b + "B");
