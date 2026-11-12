/* Ansible simulé : ansible-playbook et ansible appliqués à la machine du terminal (connexion locale).
   Sorties au format d'ansible-core 2.17 ; idempotence réelle : un second passage ne change rien. */
import { COMMANDS, EXTRA_CHECKS } from "../shell/commands.js";
import { load, CORE_SCHEMA } from "../../vendor/js-yaml.mjs";

class AnsErr extends Error { constructor(msg, code = 4) { super(msg); this.code = code; } }
const banner = (s) => s + " " + "*".repeat(Math.max(3, 79 - s.length));
const dirOf = (p) => p.replace(/\/[^/]*$/, "") || "/";
const LOCAL = new Set(["localhost", "127.0.0.1"]);

/* ===================== Jinja2 (sous-ensemble) ===================== */
function lookup(vars, path) {
  let v = vars;
  for (const part of path.split(/\.|\[(\d+)\]/).filter((x) => x !== undefined && x !== "")) { if (v === undefined || v === null) return undefined; v = v[part]; }
  return v;
}
function evalExpr(expr, vars) {
  let [head, ...filters] = splitTop(expr.trim(), "|");
  head = head.trim();
  let v;
  if (/^'.*'$|^".*"$/.test(head)) v = head.slice(1, -1);
  else if (/^-?\d+(\.\d+)?$/.test(head)) v = +head;
  else if (head === "true" || head === "True") v = true; else if (head === "false" || head === "False") v = false;
  else if (/^\[.*\]$/.test(head)) v = splitTop(head.slice(1, -1), ",").filter((x) => x.trim()).map((x) => evalExpr(x, vars));
  else if (/ ~ /.test(head)) v = splitTop(head, "~").map((x) => String(evalExpr(x, vars) ?? "")).join("");
  else v = lookup(vars, head);
  for (const f0 of filters) {
    const m = /^\s*(\w+)\s*(?:\((.*)\))?\s*$/.exec(f0); if (!m) continue; const [, f, a] = m; const arg = a !== undefined ? evalExpr(a, vars) : undefined;
    if (f === "default" || f === "d") { if (v === undefined || v === null) v = arg; }
    else if (f === "upper") v = String(v).toUpperCase(); else if (f === "lower") v = String(v).toLowerCase();
    else if (f === "join") v = (v || []).join(arg ?? ""); else if (f === "length") v = (v || []).length;
    else if (f === "int") v = parseInt(v, 10); else if (f === "string") v = String(v); else if (f === "trim") v = String(v).trim();
    else if (f === "bool") v = ["yes", "true", "1", "on", true, 1].includes(typeof v === "string" ? v.toLowerCase() : v);
    else throw new AnsErr("template error while templating string: No filter named '" + f + "'.. String: {{ " + expr + " }}");
  }
  return v;
}
function splitTop(s, sep) { const out = []; let depth = 0, q = null, cur = ""; for (const c of s) { if (q) { if (c === q) q = null; cur += c; continue; } if (c === "'" || c === '"') q = c; if ("([".includes(c)) depth++; if (")]".includes(c)) depth--; if (c === sep && !depth) { out.push(cur); cur = ""; } else cur += c; } out.push(cur); return out; }
function cond(expr, vars) {
  const e = String(expr).trim();
  if (/ and /.test(e)) return e.split(/ and /).every((x) => cond(x, vars));
  if (/ or /.test(e)) return e.split(/ or /).some((x) => cond(x, vars));
  if (/^not /.test(e)) return !cond(e.slice(4), vars);
  let m;
  if ((m = /^(.+?)\s+is\s+(not\s+)?defined$/.exec(e))) return (lookup(vars, m[1].trim()) !== undefined) !== !!m[2];
  if ((m = /^(.+?)\s*(==|!=|>=|<=|>|<|in)\s*(.+)$/.exec(e))) { const a = evalExpr(m[1], vars), b = evalExpr(m[3], vars); return { "==": a == b, "!=": a != b, ">": a > b, "<": a < b, ">=": a >= b, "<=": a <= b, in: (b || []).includes(a) }[m[2]]; } // eslint-disable-line eqeqeq
  const v = evalExpr(e, vars); return !!v && v !== "false" && v !== "no";
}
export function render(tpl, vars) {
  if (typeof tpl !== "string") return tpl;
  // Blocs {% for %} et {% if %} (imbrication simple), puis expressions {{ }}.
  const blocks = (s, v) => {
    let out = ""; let i = 0;
    while (i < s.length) {
      const k = s.indexOf("{%", i); if (k < 0) { out += s.slice(i); break; }
      out += s.slice(i, k); const e = s.indexOf("%}", k); const tag = s.slice(k + 2, e).replace(/^-|-$/g, "").trim(); i = e + 2;
      const m = /^(for|if)\s+(.*)$/.exec(tag); if (!m) continue;
      let depth = 1, j = i, mid = -1, end = -1;
      while (depth) { const a = s.indexOf("{%", j); if (a < 0) throw new AnsErr("template error while templating string: Unexpected end of template. Jinja was looking for the following tags: 'end" + m[1] + "'."); const b = s.indexOf("%}", a); const t = s.slice(a + 2, b).replace(/^-|-$/g, "").trim(); if (/^(for|if)\s/.test(t)) depth++; else if (t === "endfor" || t === "endif") { depth--; if (!depth) end = a; } else if (t === "else" && depth === 1) mid = a; j = b + 2; if (!depth) i = j; }
      const body = s.slice(s.indexOf("%}", k) + 2, mid >= 0 ? mid : end); const elseBody = mid >= 0 ? s.slice(s.indexOf("%}", mid) + 2, end) : "";
      if (m[1] === "for") { const fm = /^(\w+)\s+in\s+(.+)$/.exec(m[2]); for (const it of evalExpr(fm[2], v) || []) out += render(body.replace(/^\n/, ""), { ...v, [fm[1]]: it }); }
      else out += blocks((cond(m[2], v) ? body : elseBody).replace(/^\n/, ""), v);
      if (s[i] === "\n") i++;
    }
    return out;
  };
  return blocks(tpl, vars).replace(/\{\{(.*?)\}\}/g, (_, e) => { const v = evalExpr(e, vars); if (v === undefined) throw new AnsErr("The task includes an option with an undefined variable. The error was: '" + e.trim().split(/[.|\s]/)[0] + "' is undefined"); return typeof v === "object" ? JSON.stringify(v) : String(v); });
}
const renderDeep = (x, vars) => (typeof x === "string" ? (/^\{\{[^}]*\}\}$/.test(x.trim()) ? (() => { const v = evalExpr(x.trim().slice(2, -2), vars); if (v === undefined) throw new AnsErr("The task includes an option with an undefined variable. The error was: '" + x.trim().slice(2, -2).trim().split(/[.|\s]/)[0] + "' is undefined"); return v; })() : render(x, vars)) : Array.isArray(x) ? x.map((y) => renderDeep(y, vars)) : x && typeof x === "object" ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, renderDeep(v, vars)])) : x);
const yes = (v) => v === true || ["yes", "true", "True", "on", "1"].includes(String(v));

/* ===================== inventaire ===================== */
function inventory(sh, file) {
  const groups = { all: [], ungrouped: [] }; const hostvars = {};
  if (!file) { groups.all.push("localhost"); return { groups, hostvars, implicit: true }; }
  let text; try { text = sh.fs.read(sh.abs(file), sh.user); } catch (e) { return { groups: { all: [] }, hostvars, missing: file }; }
  if (/^\s*all\s*:/m.test(text)) {
    const d = load(text, { schema: CORE_SCHEMA }) || {};
    const walk = (name, g) => { groups[name] = groups[name] || []; for (const [h, hv] of Object.entries(g.hosts || {})) { groups[name].push(h); if (!groups.all.includes(h)) groups.all.push(h); hostvars[h] = { ...(hostvars[h] || {}), ...(hv || {}), ...(g.vars || {}) }; } for (const [c, cg] of Object.entries(g.children || {})) { walk(c, cg || {}); for (const h of groups[c]) if (!groups[name].includes(h)) groups[name].push(h); } };
    walk("all", d.all || {});
  } else {
    let cur = "ungrouped";
    for (const raw of text.split("\n")) {
      const line = raw.replace(/[#;].*$/, "").trim(); if (!line) continue;
      const g = /^\[([^\]:]+)(:vars)?\]$/.exec(line); if (g) { cur = g[1] + (g[2] || ""); if (!g[2]) groups[cur] = groups[cur] || []; continue; }
      if (cur.endsWith(":vars")) { const [k, v] = line.split("="); for (const h of groups[cur.slice(0, -5)] || []) hostvars[h] = { ...(hostvars[h] || {}), [k.trim()]: v.trim() }; continue; }
      const [h, ...kv] = line.split(/\s+/); (groups[cur] = groups[cur] || []).push(h); if (!groups.all.includes(h)) groups.all.push(h);
      hostvars[h] = { ...(hostvars[h] || {}), ...Object.fromEntries(kv.map((x) => x.split("="))) };
    }
  }
  return { groups, hostvars };
}
const reachable = (sh, h, hv) => LOCAL.has(h) || h === sh.host || (hv || {}).ansible_connection === "local";

/* ===================== modules ===================== */
function asUser(sh, become, fn) { const save = sh.user; if (become) sh.user = "root"; try { return fn(); } finally { sh.user = save; } }
function run(sh, cmd) { const r = sh.run(cmd, { record: false }); return r; }
const fileNode = (sh, p, follow = true) => { try { return sh.fs.lookup(p, { user: "root", follow }).node; } catch (e) { return null; } };
function setAttrs(sh, p, a, res) {
  const n = fileNode(sh, p); if (!n) return;
  if (a.mode !== undefined) { const m = parseInt(String(a.mode).replace(/^0o?/, ""), 8); if ((n.mode & 0o7777) !== m) { if (sh.user !== "root" && n.owner !== sh.user) throw new AnsErr("chmod failed: [Errno 1] Operation not permitted: '" + p + "'"); n.mode = (n.mode & ~0o7777) | m; res.changed = true; } }
  for (const [k, f] of [["owner", "owner"], ["group", "group"]]) if (a[k] !== undefined && n[f] !== a[k]) { if (sh.user !== "root") throw new AnsErr("chown failed: [Errno 1] Operation not permitted: b'" + p + "'"); if (k === "owner" && !sh.fs.users[a[k]]) throw new AnsErr("chown failed: failed to look up user " + a[k]); if (k === "group" && !sh.fs.groups[a[k]]) throw new AnsErr("chgrp failed: failed to look up group " + a[k]); n[f] = a[k]; res.changed = true; }
}
function writeFile(sh, dest, content, a, res, check, diff) {
  const n = fileNode(sh, dest); const before = n && n.t === "f" ? n.data : null;
  if (n && n.t === "d") throw new AnsErr("Destination " + dest + " is a directory");
  if (!fileNode(sh, dirOf(dest))) throw new AnsErr("Destination directory " + dirOf(dest) + " does not exist");
  if (before !== content) {
    res.changed = true; if (diff) res.diff = { before: before ?? "", after: content, path: dest };
    if (!check) { try { sh.fs.write(dest, content, sh.user); } catch (e) { throw new AnsErr("Destination " + dirOf(dest) + " not writable"); } const nn = fileNode(sh, dest); if (!n && nn) { nn.owner = sh.user; nn.group = sh.user === "root" ? "root" : sh.user; } }
  }
  if (!check) setAttrs(sh, dest, a, res);
}
const MODULES = {
  ping: () => ({ changed: false, ping: "pong" }),
  debug: (sh, a, ctx) => ({ changed: false, msg: a.msg !== undefined ? a.msg : a.var !== undefined ? { [a.var]: lookup(ctx.vars, a.var) } : "Hello world!" }),
  apt(sh, a, ctx) {
    const names = [].concat(a.name || a.pkg || []); const state = a.state || "present"; const res = { changed: false };
    if (sh.user !== "root") throw new AnsErr("Failed to lock apt for exclusive operation: Failed to lock directory /var/lib/apt/lists/: E:Could not open lock file /var/lib/apt/lists/lock - open (13: Permission denied)");
    if (yes(a.update_cache)) res.cache_updated = true;
    for (const n of names) {
      const has = sh.packages.has(n);
      if ((state === "present" || state === "latest") && !has) { res.changed = true; if (!ctx.check) { const r = run(sh, "apt-get install -y " + n); if (r.code) throw new AnsErr("No package matching '" + n + "' is available"); } }
      if (state === "absent" && has) { res.changed = true; if (!ctx.check) run(sh, "apt-get remove -y " + n); }
    }
    return res;
  },
  copy(sh, a, ctx) {
    if (!a.dest) throw new AnsErr("missing required arguments: dest");
    let content = a.content;
    if (content === undefined) { if (!a.src) throw new AnsErr("src (or content) is required"); const p = a.src.startsWith("/") ? a.src : [ctx.dir + "/files/" + a.src, ctx.dir + "/" + a.src].find((x) => fileNode(sh, x)); if (!p || !fileNode(sh, p)) throw new AnsErr("Could not find or access '" + a.src + "'\nSearched in:\n\t" + ctx.dir + "/files/" + a.src + "\n\t" + ctx.dir + "/" + a.src + " on the Ansible Controller.\nIf you are using a module and expect the file to exist on the remote, see the remote_src option"); content = sh.fs.read(p, "root"); }
    let dest = a.dest; if (fileNode(sh, dest) && fileNode(sh, dest).t === "d") dest = dest.replace(/\/$/, "") + "/" + String(a.src).split("/").pop();
    const res = { changed: false, dest }; writeFile(sh, dest, String(content), a, res, ctx.check, ctx.diff); return res;
  },
  template(sh, a, ctx) {
    if (!a.src || !a.dest) throw new AnsErr("missing required arguments: " + (!a.src ? "src" : "dest"));
    const p = a.src.startsWith("/") ? a.src : [ctx.dir + "/templates/" + a.src, ctx.dir + "/" + a.src].find((x) => fileNode(sh, x));
    if (!p) throw new AnsErr("Could not find or access '" + a.src + "'\nSearched in:\n\t" + ctx.dir + "/templates/" + a.src + "\n\t" + ctx.dir + "/" + a.src + " on the Ansible Controller.");
    const out = render(sh.fs.read(p, "root"), ctx.vars);
    const res = { changed: false, dest: a.dest }; writeFile(sh, a.dest, out, a, res, ctx.check, ctx.diff); return res;
  },
  file(sh, a, ctx) {
    const p = a.path || a.dest || a.name; if (!p) throw new AnsErr("missing required arguments: path");
    const st = a.state || (fileNode(sh, p) ? (fileNode(sh, p).t === "d" ? "directory" : "file") : "file"); const n = fileNode(sh, p, st !== "link"); const res = { changed: false, path: p };
    if (st === "absent") { if (n) { res.changed = true; if (!ctx.check) run(sh, "rm -rf " + p); } return res; }
    if (st === "directory") { if (n && n.t !== "d") throw new AnsErr("there was an issue creating " + p + " as requested: [Errno 17] File exists: b'" + p + "'"); if (!n) { res.changed = true; if (!ctx.check) { const r = run(sh, "mkdir -p " + p); if (r.code) throw new AnsErr("There was an issue creating " + p + " as requested: [Errno 13] Permission denied: b'" + p + "'"); } } if (!ctx.check) setAttrs(sh, p, a, res); return res; }
    if (st === "touch") { res.changed = true; if (!ctx.check) { const r = run(sh, "touch " + p); if (r.code) throw new AnsErr("Error, could not touch target: [Errno 13] Permission denied: b'" + p + "'"); setAttrs(sh, p, a, res); } return res; }
    if (st === "link") { if (!n || n.t !== "l" || n.target !== a.src) { res.changed = true; if (!ctx.check) run(sh, "ln -sfn " + a.src + " " + p); } return res; }
    if (!n) throw new AnsErr("file (" + p + ") is absent, cannot continue");
    if (!ctx.check) setAttrs(sh, p, a, res); return res;
  },
  lineinfile(sh, a, ctx) {
    const p = a.path || a.dest; const n = fileNode(sh, p);
    if (!n) { if (!yes(a.create)) throw new AnsErr("Destination " + p + " does not exist !"); }
    const lines = n ? n.data.replace(/\n$/, "").split("\n").filter((x, i, arr) => !(arr.length === 1 && x === "")) : [];
    const re = a.regexp ? new RegExp(a.regexp) : null; const res = { changed: false };
    let out = lines.slice();
    if ((a.state || "present") === "absent") out = lines.filter((l) => (re ? !re.test(l) : l !== a.line));
    else { const i = lines.findLastIndex((l) => (re ? re.test(l) : l === a.line)); if (i >= 0) out[i] = a.line; else out.push(a.line); }
    const after = out.join("\n") + (out.length ? "\n" : ""); const before = n ? n.data : "";
    if (after !== before) { res.changed = true; res.msg = (a.state === "absent" ? "line(s) removed" : lines.some((l) => re && re.test(l)) ? "line replaced" : "line added"); if (ctx.diff) res.diff = { before, after, path: p }; if (!ctx.check) { try { sh.fs.write(p, after, sh.user); } catch (e) { throw new AnsErr("Destination " + p + " not writable"); } } }
    if (!ctx.check) setAttrs(sh, p, a, res); return res;
  },
  user(sh, a, ctx) {
    if (sh.user !== "root") throw new AnsErr("useradd: Permission denied.\nuseradd: cannot lock /etc/passwd; try again later.\n");
    const res = { changed: false, name: a.name }; const exists = !!sh.fs.users[a.name];
    if ((a.state || "present") === "absent") { if (exists) { res.changed = true; if (!ctx.check) run(sh, "userdel " + (yes(a.remove) ? "-r " : "") + a.name); } return res; }
    if (!exists) { res.changed = true; if (!ctx.check) run(sh, "useradd " + (a.create_home === false ? "" : "-m ") + (a.shell ? "-s " + a.shell + " " : "") + a.name); }
    for (const g of [].concat(a.groups || []).flatMap((x) => String(x).split(",")).map((x) => x.trim()).filter(Boolean)) {
      if (!sh.fs.groups[g]) throw new AnsErr("Group " + g + " does not exist");
      if (!ctx.check && !sh.fs.groupsOf(a.name).includes(g)) { res.changed = true; run(sh, "usermod -aG " + g + " " + a.name); } else if (ctx.check && !(exists && sh.fs.groupsOf(a.name).includes(g))) res.changed = true;
    }
    return res;
  },
  group(sh, a, ctx) { if (sh.user !== "root") throw new AnsErr("groupadd: Permission denied."); const res = { changed: false }; if (!sh.fs.groups[a.name]) { res.changed = true; if (!ctx.check) run(sh, "groupadd " + a.name); } return res; },
  service(sh, a, ctx) {
    const s = sh.services[a.name]; if (!s) throw new AnsErr("Could not find the requested service " + a.name + ": host");
    if (sh.user !== "root" && (a.state || a.enabled !== undefined)) throw new AnsErr("Unable to " + (a.state === "stopped" ? "stop" : "start") + " service " + a.name + ": Failed to start " + a.name + ".service: Interactive authentication required.\nSee system logs and 'systemctl status " + a.name + ".service' for details.\n");
    const res = { changed: false, name: a.name };
    const doIt = (verb) => { res.changed = true; if (ctx.check) return; const r = run(sh, "systemctl " + verb + " " + a.name); if (r.code) throw new AnsErr("Unable to " + verb + " service " + a.name + ": " + (r.err || r.out).trim() + "\n"); };
    if (a.enabled !== undefined && !!s.enabled !== yes(a.enabled)) { res.changed = true; if (!ctx.check) s.enabled = yes(a.enabled); }
    if (a.state === "started" && !s.active) doIt("start");
    else if (a.state === "stopped" && s.active) doIt("stop");
    else if (a.state === "restarted") doIt("restart");
    else if (a.state === "reloaded") doIt(s.active ? "reload" : "start");
    return res;
  },
  command(sh, a, ctx) {
    const cmd = a._raw || a.cmd || a.argv && a.argv.join(" "); if (!cmd) throw new AnsErr("no command given");
    if (a.creates && fileNode(sh, a.creates)) return { changed: false, msg: "skipped, since " + a.creates + " exists", rc: 0, stdout: "", skippedByCreates: true };
    if (ctx.check) return { changed: true, msg: "Command would have run if not in check mode", skipped: false };
    const r = run(sh, a.chdir ? "cd " + a.chdir + " && " + cmd : cmd);
    const res = { changed: true, cmd, rc: r.code, stdout: r.out.replace(/\n$/, ""), stderr: r.err.replace(/\n$/, ""), stdout_lines: r.out.replace(/\n$/, "").split("\n") };
    if (r.code) { const e = new AnsErr("non-zero return code"); e.result = res; throw e; }
    return res;
  }
};
MODULES.shell = MODULES.command; MODULES.systemd = MODULES.service; MODULES.systemd_service = MODULES.service; MODULES["ansible.builtin.systemd_service"] = MODULES.service;
for (const k of Object.keys(MODULES)) if (!k.includes(".")) MODULES["ansible.builtin." + k] = MODULES[k];
const TASK_KEYS = new Set(["name", "become", "become_user", "when", "loop", "with_items", "notify", "register", "changed_when", "failed_when", "ignore_errors", "tags", "vars", "listen", "check_mode", "no_log", "args", "delegate_to", "loop_control"]);

/* ===================== exécution ===================== */
function moduleOf(task) {
  const keys = Object.keys(task).filter((k) => !TASK_KEYS.has(k));
  if (!keys.length) throw new AnsErr("no module/action detected in task.");
  if (keys.length > 1) { const known = keys.filter((k) => MODULES[k]); if (known.length > 1) throw new AnsErr("conflicting action statements: " + known.join(", ")); if (known.length === 1) return known[0]; }
  return keys.find((k) => MODULES[k]) || keys[0];
}
function argsOf(mod, raw) {
  if (raw === null || raw === undefined) return {};
  if (typeof raw === "string") {
    if (["command", "shell", "ansible.builtin.command", "ansible.builtin.shell"].includes(mod)) return { _raw: raw };
    const o = {}; for (const m of raw.matchAll(/(\w+)=("[^"]*"|'[^']*'|\S+)/g)) o[m[1]] = m[2].replace(/^["']|["']$/g, ""); return o;
  }
  return { ...raw };
}
const fmtJson = (o, v) => (v ? JSON.stringify(o, null, 4) : JSON.stringify(o).replace(/,"/g, ', "').replace(/":/g, '": '));

export function playbook(sh, args, io) {
  const o = { i: null, check: false, diff: false, v: 0, extra: {}, files: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-i" || a === "--inventory") o.i = args[++i]; else if (a.startsWith("--inventory=")) o.i = a.slice(12);
    else if (a === "--check" || a === "-C") o.check = true; else if (a === "--diff" || a === "-D") o.diff = true;
    else if (/^-v+$/.test(a)) o.v = a.length - 1; else if (a === "-K" || a === "--ask-become-pass") o.askPass = true;
    else if (a === "-e" || a === "--extra-vars") { const kv = args[++i]; for (const m of kv.matchAll(/(\w+)=(\S+)/g)) o.extra[m[1]] = m[2]; }
    else if (a === "--syntax-check") o.syntax = true; else if (a === "--list-tasks") o.list = true;
    else o.files.push(a);
  }
  if (!o.files.length) { io.err("usage: ansible-playbook [-h] [--version] [-v] [-k] ... playbook [playbook ...]\nansible-playbook: error: the following arguments are required: playbook\n"); return 2; }
  const inv = inventory(sh, o.i);
  if (inv.missing) io.err("[WARNING]: Unable to parse " + sh.abs(inv.missing) + " as an inventory source\n[WARNING]: No inventory was parsed, only implicit localhost is available\n");
  if (inv.implicit && !o.i) io.err("[WARNING]: No inventory was parsed, only implicit localhost is available\n");
  const pbPath = sh.abs(o.files[0]); let text;
  try { text = sh.fs.read(pbPath, sh.user); } catch (e) { io.err("ERROR! the playbook: " + o.files[0] + " could not be found\n"); return 1; }
  let plays;
  try { plays = load(text, { schema: CORE_SCHEMA }); }
  catch (e) { io.err("ERROR! We were unable to read either as JSON nor YAML, these are the errors we got from each:\nJSON: Expecting value: line 1 column 1 (char 0)\n\nSyntax Error while loading YAML.\n  " + (e.reason || e.message) + "\n\nThe error appears to be in '" + pbPath + "': line " + ((e.mark && e.mark.line + 1) || "?") + ", column " + ((e.mark && e.mark.column + 1) || "?") + ", but may\nbe elsewhere in the file depending on the exact syntax problem.\n"); return 4; }
  if (!Array.isArray(plays)) { io.err("ERROR! A playbook must be a list of plays, got a " + (plays === null ? "NoneType" : typeof plays === "object" ? "AnsibleMapping" : typeof plays) + " instead\n\nThe error appears to be in '" + pbPath + "': line 1, column 1, but may\nbe elsewhere in the file depending on the exact syntax problem.\n"); return 4; }
  for (const p of plays) {
    if (!p || p.hosts === undefined) { io.err("ERROR! the field 'hosts' is required but was not set\n"); return 4; }
    for (const t of [...(p.tasks || []), ...(p.handlers || [])]) { let m; try { m = moduleOf(t); } catch (e) { io.err("ERROR! " + e.message + "\n\nThe error appears to be in '" + pbPath + "'.\n"); return 4; } if (!MODULES[m]) { io.err("ERROR! couldn't resolve module/action '" + m + "'. This often indicates a misspelling, missing collection, or incorrect module path.\n\nThe error appears to be in '" + pbPath + "': line " + (text.split("\n").findIndex((l) => new RegExp("^\\s*-?\\s*" + m.replace(/\./g, "\\.") + "\\s*:").test(l)) + 1) + ", column 7, but may\nbe elsewhere in the file depending on the exact syntax problem.\n"); return 4; } }
  }
  if (o.syntax) { io.out("\nplaybook: " + o.files[0] + "\n"); return 0; }
  const recap = {}; let out = ""; let failedAny = false; let unreachAny = false;
  const say = (s) => { out += s; };
  for (const play of plays) {
    const hosts = String(play.hosts).split(/[,:]/).map((x) => x.trim()).flatMap((h) => inv.groups[h] || (inv.groups.all.includes(h) || LOCAL.has(h) ? [h] : []));
    say("\n" + banner("PLAY [" + (play.name || play.hosts) + "]") + "\n");
    if (!hosts.length) { say("skipping: no hosts matched\n"); io.err("[WARNING]: Could not match supplied host pattern, ignoring: " + play.hosts + "\n"); continue; }
    const st = {}; for (const h of hosts) { st[h] = { ok: true }; recap[h] = recap[h] || { ok: 0, changed: 0, unreachable: 0, failed: 0, skipped: 0, rescued: 0, ignored: 0 }; }
    const live = () => hosts.filter((h) => st[h].ok);
    const baseVars = (h) => ({ ansible_os_family: "Debian", ansible_distribution: "Ubuntu", ansible_distribution_version: "24.04", ansible_hostname: sh.host, inventory_hostname: h, ansible_user_id: sh.user, ...(inv.hostvars[h] || {}), ...(play.vars || {}), ...o.extra });
    const notified = new Set(); const registered = {};
    const runTask = (task, isHandler) => {
      const mod = moduleOf(task); const title = task.name ? render(String(task.name), { ...baseVars(live()[0] || hosts[0]), ...registered }) : mod;
      say("\n" + banner((isHandler ? "RUNNING HANDLER [" : "TASK [") + title + "]") + "\n");
      for (const h of live()) {
        const r0 = recap[h];
        if (!reachable(sh, h, inv.hostvars[h])) { say("fatal: [" + h + "]: UNREACHABLE! => {\"changed\": false, \"msg\": \"Failed to connect to the host via ssh: ssh: Could not resolve hostname " + h + ": Name or service not known\", \"unreachable\": true}\n"); st[h].ok = false; r0.unreachable++; unreachAny = true; continue; }
        const vars = { ...baseVars(h), ...registered, ...(task.vars || {}) };
        const items = task.loop !== undefined || task.with_items !== undefined ? renderDeep(task.loop ?? task.with_items, vars) : [undefined];
        let changed = false, failed = null, skippedAll = true; const lines = [];
        const become = task.become ?? play.become;
        for (const item of items) {
          const v = item === undefined ? vars : { ...vars, item };
          if (task.when !== undefined && !(Array.isArray(task.when) ? task.when : [task.when]).every((w) => cond(w, v))) { lines.push("skipping: [" + h + "]" + (item !== undefined ? " => (item=" + (typeof item === "object" ? fmtJson(item) : item) + ")" : "")); continue; }
          skippedAll = false;
          let res;
          try {
            const args0 = renderDeep(argsOf(mod, task[mod]), v); if (task.args) Object.assign(args0, renderDeep(task.args, v));
            res = asUser(sh, become, () => MODULES[mod](sh, args0, { vars: v, dir: dirOf(pbPath), check: o.check, diff: o.diff }));
            if (task.changed_when !== undefined) res.changed = typeof task.changed_when === "boolean" ? task.changed_when : cond(task.changed_when, { ...v, [task.register || "_"]: res });
          } catch (e) {
            if (!(e instanceof AnsErr)) throw e;
            res = { failed: true, changed: false, msg: e.message, ...(e.result || {}) };
          }
          if (task.register) registered[task.register] = res;
          if (res.diff) lines.push("--- before: " + res.diff.path + "\n+++ after: " + res.diff.path + "\n" + diffLines(res.diff.before, res.diff.after));
          const lbl = item !== undefined ? " => (item=" + (typeof item === "object" ? fmtJson(item) : item) + ")" : "";
          if (res.failed) { failed = res; const body = { ...(item !== undefined ? { ansible_loop_var: "item", item } : {}), changed: false, ...(res.cmd ? { cmd: res.cmd, rc: res.rc, stderr: res.stderr, stdout: res.stdout } : {}), msg: res.msg }; lines.push((task.ignore_errors ? "fatal" : "fatal") + ": [" + h + "]: FAILED! => " + fmtJson(body)); break; }
          changed = changed || !!res.changed;
          if (mod.endsWith("debug")) lines.push("ok: [" + h + "]" + lbl + " => " + fmtJson(res.msg !== undefined && typeof res.msg !== "object" ? { msg: res.msg } : res.msg, true));
          else lines.push((res.changed ? "changed" : "ok") + ": [" + h + "]" + lbl + (o.v && !mod.endsWith("debug") ? " => " + fmtJson(res) : ""));
        }
        if (items.length > 1 || (items.length === 1 && items[0] !== undefined)) { /* une ligne par élément, comme Ansible */ }
        say(lines.join("\n") + (lines.length ? "\n" : ""));
        if (failed) { if (task.ignore_errors) { say("...ignoring\n"); r0.ignored++; r0.ok++; } else { r0.failed++; st[h].ok = false; failedAny = true; } continue; }
        if (skippedAll) { r0.skipped++; continue; }
        r0.ok++; if (changed) { r0.changed++; for (const n of [].concat(task.notify || [])) notified.add(n); }
      }
    };
    if (play.gather_facts !== false) { say("\n" + banner("TASK [Gathering Facts]") + "\n"); for (const h of live()) { if (!reachable(sh, h, inv.hostvars[h])) { say("fatal: [" + h + "]: UNREACHABLE! => {\"changed\": false, \"msg\": \"Failed to connect to the host via ssh: ssh: Could not resolve hostname " + h + ": Name or service not known\", \"unreachable\": true}\n"); st[h].ok = false; recap[h].unreachable++; unreachAny = true; continue; } say("ok: [" + h + "]\n"); recap[h].ok++; } }
    for (const t of play.tasks || []) { if (!live().length) break; runTask(t, false); }
    for (const hd of play.handlers || []) { if (!live().length) break; if (notified.has(hd.name) || (hd.listen && notified.has(hd.listen))) runTask(hd, true); }
  }
  say("\n" + banner("PLAY RECAP") + "\n");
  for (const [h, r] of Object.entries(recap)) say((h.padEnd(26) + " : ") + ["ok", "changed", "unreachable", "failed", "skipped", "rescued", "ignored"].map((k) => k + "=" + String(r[k]).padEnd(4)).join(" ") + "\n");
  say("\n");
  io.out(out);
  sh.lastPlaybook = { recap, file: pbPath, check: o.check };
  return unreachAny ? 4 : failedAny ? 2 : 0;
}
function diffLines(a, b) {
  const x = a.replace(/\n$/, "").split("\n"), y = b.replace(/\n$/, "").split("\n");
  const out = ["@@ -1," + x.length + " +1," + y.length + " @@"]; const max = Math.max(x.length, y.length);
  for (let i = 0; i < max; i++) { if (x[i] === y[i]) { if (x[i] !== undefined) out.push(" " + x[i]); continue; } if (x[i] !== undefined) out.push("-" + x[i]); if (y[i] !== undefined) out.push("+" + y[i]); }
  return out.join("\n");
}
function adhoc(sh, args, io) {
  const pattern = args[0]; let i = 1; let mod = "command", arg = "", invFile = null, become = false;
  for (; i < args.length; i++) { if (args[i] === "-m") mod = args[++i]; else if (args[i] === "-a") arg = args[++i]; else if (args[i] === "-i") invFile = args[++i]; else if (args[i] === "-b" || args[i] === "--become") become = true; }
  if (!pattern) { io.err("usage: ansible [-h] [--version] [-v] [-b] ... pattern\nansible: error: the following arguments are required: pattern\n"); return 2; }
  const inv = inventory(sh, invFile); const hosts = inv.groups[pattern] || (inv.groups.all.includes(pattern) || LOCAL.has(pattern) ? [pattern] : []);
  if (!hosts.length) { io.err("[WARNING]: Could not match supplied host pattern, ignoring: " + pattern + "\n[WARNING]: No hosts matched, nothing to do\n"); return 0; }
  if (!MODULES[mod]) { io.err("ERROR! couldn't resolve module/action '" + mod + "'. This often indicates a misspelling, missing collection, or incorrect module path.\n"); return 4; }
  let code = 0;
  for (const h of hosts) {
    if (!reachable(sh, h, inv.hostvars[h])) { io.out(h + " | UNREACHABLE! => {\n    \"changed\": false,\n    \"msg\": \"Failed to connect to the host via ssh: ssh: Could not resolve hostname " + h + ": Name or service not known\",\n    \"unreachable\": true\n}\n"); code = 4; continue; }
    let res; try { res = asUser(sh, become, () => MODULES[mod](sh, argsOf(mod, arg), { vars: {}, dir: sh.cwd })); } catch (e) { if (!(e instanceof AnsErr)) throw e; io.out(h + " | FAILED! => " + fmtJson({ changed: false, msg: e.message }, true) + "\n"); code = 2; continue; }
    if (mod.endsWith("command") || mod.endsWith("shell")) io.out(h + " | " + (res.changed ? "CHANGED" : "SUCCESS") + " | rc=" + res.rc + " >>\n" + res.stdout + "\n");
    else io.out(h + " | " + (res.changed ? "CHANGED" : "SUCCESS") + " => " + fmtJson(mod === "ping" ? { changed: false, ping: "pong" } : res, true) + "\n");
  }
  return code;
}

COMMANDS["ansible-playbook"] = (sh, args, io) => { if (!sh.packages.has("ansible") && !sh.packages.has("ansible-core")) { io.err("Command 'ansible-playbook' not found, but can be installed with:\nsudo apt install ansible-core\n"); return 127; } return playbook(sh, args, io); };
COMMANDS.ansible = (sh, args, io) => { if (!sh.packages.has("ansible") && !sh.packages.has("ansible-core")) { io.err("Command 'ansible' not found, but can be installed with:\nsudo apt install ansible-core\n"); return 127; } if (args[0] === "--version") { io.out("ansible [core 2.17.6]\n  python version = 3.12.3\n  jinja version = 3.1.4\n"); return 0; } return adhoc(sh, args, io); };

/* ----- critères ----- */
EXTRA_CHECKS.playbook = (sh, v, push) => {
  // { file, inventory, idempotent: true } : relance le playbook ; le second passage ne doit rien changer.
  const lp = sh.lastPlaybook;
  if (v.ran) push(!!lp && Object.values(lp.recap).every((r) => !r.failed && !r.unreachable), "Le dernier ansible-playbook s'est terminé sans échec");
  if (v.idempotent) {
    let out = ""; const save = sh.lastPlaybook;
    const code = playbook(sh, [...(v.inventory ? ["-i", v.inventory] : []), v.file], { out: (s) => { out += s; }, err: () => {} });
    const rc = sh.lastPlaybook ? Object.values(sh.lastPlaybook.recap) : [];
    sh.lastPlaybook = save;
    push(code === 0 && rc.length && rc.every((r) => r.changed === 0), "Relancé, le playbook ne change plus rien (idempotence)");
  }
};
