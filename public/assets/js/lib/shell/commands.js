/* Commandes du terminal Linux simulé (Ubuntu 24.04) et monde de départ.
   Chaque commande reçoit (sh, args, io) et renvoie un code de sortie. Messages identiques
   aux outils GNU, en anglais comme sur une vraie machine. */
import { FsError, errText, normalize, dirname, basename, modeString } from "./fs.js";
import { posixRegex, globRegex, sed, awk } from "./text.js";

class CmdErr extends Error { constructor(msg, status = 1) { super(msg); this.status = status; } }
const fail = (msg, status = 1) => { throw new CmdErr(msg, status); };
/* Les erreurs CmdErr sont converties par l'interpréteur : message sur stderr, code de sortie. */
export { CmdErr };

/* ---------- options ---------- */
/** spec : lettres sans valeur, et lettres avec valeur suivies de « : » (ex. "nrk:t:"). */
function opts(args, spec, long = {}) {
  const takes = new Set(); const flags = new Set();
  const posix = spec.startsWith("+"); if (posix) spec = spec.slice(1); /* « + » : les options s'arrêtent au premier opérande (xargs CMD -f…) */
  for (let i = 0; i < spec.length; i++) { if (spec[i + 1] === ":") { takes.add(spec[i]); i++; } else flags.add(spec[i]); }
  const o = {}, rest = []; let stop = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (stop || a === "-" || !a.startsWith("-") || /^-\d+$/.test(a) && ![...a.slice(1)].every((c) => flags.has(c))) { if (/^-\d+$/.test(a) && !stop && spec.includes("N")) { o.N = +a.slice(1); continue; } rest.push(a); if (posix) stop = true; continue; }
    if (a === "--") { stop = true; continue; }
    if (a.startsWith("--")) { const [k, v] = a.slice(2).split("="); const key = long[k]; if (key === undefined) return { error: "unrecognized option '" + a + "'" }; if (typeof key === "string" && key.endsWith(":")) o[key.slice(0, -1)] = v ?? args[++i]; else o[key] = v ?? true; continue; }
    for (let j = 1; j < a.length; j++) {
      const c = a[j];
      if (takes.has(c)) { o[c] = a.slice(j + 1) || args[++i]; if (o[c] === undefined) return { error: "option requires an argument -- '" + c + "'" }; break; }
      if (!flags.has(c)) return { error: "invalid option -- '" + c + "'" };
      o[c] = (o[c] || 0) + 1;
    }
  }
  return { o, rest };
}
function need(name, r) { if (r.error) fail(name + ": " + r.error + "\nTry '" + name + " --help' for more information.", name === "grep" ? 2 : 1); return r; }

/* ---------- lecture des entrées ---------- */
function inputs(sh, name, files, io) {
  if (!files.length || (files.length === 1 && files[0] === "-")) return [{ name: "-", data: io.stdin || "" }];
  const out = [];
  for (const f of files) {
    if (f === "-") { out.push({ name: "-", data: io.stdin || "" }); continue; }
    try { out.push({ name: f, data: sh.fs.read(sh.abs(f), sh.user) }); }
    catch (e) { io.err(name + ": " + f + ": " + errText(e.code) + "\n"); out.push({ name: f, error: true }); }
  }
  return out;
}
const lines = (s) => { const l = s.split("\n"); if (l[l.length - 1] === "") l.pop(); return l; };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const lsDate = (d) => MONTHS[d.getUTCMonth()] + " " + String(d.getUTCDate()).padStart(2) + " " + String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0");
const logDate = (d) => MONTHS[d.getUTCMonth()] + " " + String(d.getUTCDate()).padStart(2, "0") + " " + d.toISOString().slice(11, 19);
const NOW = () => new Date(Date.UTC(2026, 10, 12, 9, 30, 0));
function human(n) { if (n < 1024) return String(n); const u = ["K", "M", "G", "T"]; let i = -1; do { n /= 1024; i++; } while (n >= 1024 && i < 3); return (n < 10 ? (Math.ceil(n * 10) / 10).toFixed(1) : String(Math.ceil(n))) + u[i]; }

/* ---------- monde de départ ---------- */
export function makeWorld(sh) {
  const fs = sh.fs;
  fs.addUser("root", { uid: 0, home: "/root" });
  fs.addGroup("sudo", 27); fs.addGroup("adm", 4); fs.addGroup("users", 100); fs.addGroup("shadow", 42); fs.addGroup("systemd-journal", 999);
  fs.addUser("www-data", { uid: 33, home: "/var/www", shell: "/usr/sbin/nologin" });
  fs.addUser("syslog", { uid: 104, home: "/nonexistent", shell: "/usr/sbin/nologin", groups: ["adm"] });
  fs.addUser("eleve", { uid: 1000, groups: ["sudo", "adm", "users"] });
  for (const d of ["bin", "boot", "dev", "etc", "home", "lib", "media", "mnt", "opt", "proc", "root", "run", "sbin", "srv", "sys", "tmp", "usr", "var"]) fs.mkdir("/" + d, "root");
  for (const d of ["/usr/bin", "/usr/sbin", "/usr/lib", "/usr/local/bin", "/usr/share", "/var/log", "/var/lib", "/var/tmp", "/var/www", "/var/backups", "/etc/ssh", "/etc/cron.d", "/etc/systemd/system", "/usr/lib/systemd/system", "/var/spool/cron/crontabs", "/home/eleve"]) fs.mkdir(d, "root", { parents: true });
  fs.stat("/root").mode = 0o700; fs.stat("/tmp").mode = 0o777;
  const home = fs.stat("/home/eleve"); home.owner = "eleve"; home.group = "eleve"; home.mode = 0o750;
  const w = (p, data, o = {}) => { const n = fs.write(p, data, "root"); Object.assign(n, { mode: 0o644 }, o); return n; };
  w("/etc/hostname", sh.host + "\n");
  w("/etc/os-release", 'PRETTY_NAME="Ubuntu 24.04.3 LTS"\nNAME="Ubuntu"\nVERSION_ID="24.04"\nVERSION="24.04.3 LTS (Noble Numbat)"\nID=ubuntu\nID_LIKE=debian\n');
  w("/etc/hosts", "127.0.0.1 localhost\n127.0.1.1 " + sh.host + "\n");
  w("/etc/shadow", "root:*:20000:0:99999:7:::\neleve:$y$j9T$…:20000:0:99999:7:::\n", { mode: 0o640, group: "shadow" });
  w("/etc/ssh/sshd_config", "Include /etc/ssh/sshd_config.d/*.conf\nPort 22\nPermitRootLogin prohibit-password\nPasswordAuthentication yes\n");
  w("/home/eleve/.bashrc", "# ~/.bashrc\nexport HISTSIZE=1000\nalias ll='ls -alF'\n", { owner: "eleve", group: "eleve" });
  w("/home/eleve/.profile", "# ~/.profile\n[ -f ~/.bashrc ] && . ~/.bashrc\n", { owner: "eleve", group: "eleve" });
  w("/var/log/syslog", "", { owner: "syslog", group: "adm", mode: 0o640 });
  w("/var/log/auth.log", "Nov 12 08:58:02 serveur sshd[701]: Server listening on 0.0.0.0 port 22.\nNov 12 09:01:17 serveur sshd[911]: Accepted publickey for eleve from 192.0.2.10 port 51122 ssh2: ED25519 SHA256:k3…\n", { owner: "syslog", group: "adm", mode: 0o640 });
  sh.journal = [];
  sh.services = {};
  sh.procs = [{ pid: 1, user: "root", cmd: "/sbin/init", cpu: 0.0, mem: 0.3 }, { pid: 911, user: "eleve", cmd: "-bash", cpu: 0.0, mem: 0.1 }];
  addService(sh, "ssh", { desc: "OpenBSD Secure Shell server", exec: "sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups", ports: [22], pid: 701, enabled: true, active: true });
  addService(sh, "cron", { desc: "Regular background program processing daemon", exec: "/usr/sbin/cron -f -P", pid: 655, enabled: true, active: true });
  sh.packages = new Set(["bash", "coreutils", "curl", "grep", "sed", "gawk", "openssh-server", "cron", "tar", "tree"]);
  sh.net = { dns: { "exemple.ca": "203.0.113.10", "api.exemple.ca": "203.0.113.20", "github.com": "140.82.112.4" }, http: {} };
  syncUsers(sh);
}
export function syncUsers(sh) {
  const fs = sh.fs; const u = Object.entries(fs.users).sort((a, b) => a[1].uid - b[1].uid);
  const passwd = u.map(([n, x]) => [n, "x", x.uid, (fs.groups[n] || { gid: x.uid }).gid, n === "root" ? "root" : "", x.home, x.shell].join(":")).join("\n") + "\n";
  const groups = Object.entries(fs.groups).sort((a, b) => a[1].gid - b[1].gid).map(([g, x]) => g + ":x:" + x.gid + ":" + x.members.join(",")).join("\n") + "\n";
  fs.write("/etc/passwd", passwd, "root"); fs.write("/etc/group", groups, "root");
}
export function addService(sh, name, s) {
  const pid = s.pid || 800 + Object.keys(sh.services).length * 7;
  sh.services[name] = Object.assign({ desc: name, enabled: false, active: false, failed: false, ports: [], exec: "/usr/bin/" + name, since: NOW(), pid, user: "root" }, s, { pid });
  if (!s.custom) sh.fs.write("/usr/lib/systemd/system/" + name + ".service", "[Unit]\nDescription=" + (s.desc || name) + "\n\n[Service]\nExecStart=" + (s.exec || "/usr/bin/" + name) + "\nRestart=on-failure\n\n[Install]\nWantedBy=multi-user.target\n", "root");
  if (sh.services[name].active) startProc(sh, name);
  sh.journal = sh.journal || [];
  if (sh.services[name].active) log(sh, name, "systemd[1]", "Started " + name + ".service - " + sh.services[name].desc + ".");
}
function startProc(sh, name) { const s = sh.services[name]; sh.procs = sh.procs.filter((p) => p.service !== name); sh.procs.push({ pid: s.pid, user: s.user, cmd: s.exec, cpu: 0.0, mem: 0.4, service: name }); for (const [i, extra] of (s.children || []).entries()) sh.procs.push({ pid: s.pid + i + 1, user: extra.user || s.user, cmd: extra.cmd, cpu: 0.0, mem: 0.2, service: name }); }
function log(sh, unit, src, msg, prio = 6) { sh.journal.push({ unit, src, msg, prio, ts: new Date(NOW().getTime() + sh.journal.length * 1000) }); }

/* Paquets installables avec apt */
const CATALOG = {
  nginx: (sh) => {
    sh.fs.mkdir("/etc/nginx/sites-available", "root", { parents: true }); sh.fs.mkdir("/etc/nginx/sites-enabled", "root", { parents: true }); sh.fs.mkdir("/var/www/html", "root", { parents: true }); sh.fs.mkdir("/var/log/nginx", "root", { parents: true });
    sh.fs.write("/etc/nginx/nginx.conf", "user www-data;\nworker_processes auto;\nevents {\n\tworker_connections 768;\n}\nhttp {\n\tinclude /etc/nginx/sites-enabled/*;\n}\n", "root");
    sh.fs.write("/etc/nginx/sites-available/default", "server {\n\tlisten 80 default_server;\n\troot /var/www/html;\n\tindex index.html;\n\tserver_name _;\n}\n", "root");
    try { sh.fs.symlink("/etc/nginx/sites-available/default", "/etc/nginx/sites-enabled/default", "root"); } catch (e) { /* déjà là */ }
    sh.fs.write("/var/www/html/index.html", "<!DOCTYPE html>\n<html><head><title>Welcome to nginx!</title></head>\n<body><h1>Welcome to nginx!</h1></body></html>\n", "root");
    for (const f of ["access.log", "error.log"]) { if (sh.fs.exists("/var/log/nginx/" + f)) continue; const n = sh.fs.write("/var/log/nginx/" + f, "", "root"); n.owner = "www-data"; n.group = "adm"; n.mode = 0o640; }
    addService(sh, "nginx", { desc: "A high performance web server and a reverse proxy server", exec: "nginx: master process /usr/sbin/nginx -g daemon on; master_process on;", children: [{ cmd: "nginx: worker process", user: "www-data" }], ports: [80], pid: 1312, enabled: true, active: true, check: nginxCheck });
  },
  jq: () => {}, htop: () => {}, tree: () => {}, "ansible-core": () => {}, ansible: () => {}, prometheus: () => {}, "net-tools": () => {}, unzip: () => {}, git: () => {}, "python3": () => {},
};
/** Vérifie la configuration nginx (accolades, points-virgules) comme « nginx -t ». */
const ONE_ARG = new Set(["root", "alias", "proxy_pass", "include", "worker_processes", "client_max_body_size"]);
export function nginxCheck(sh) {
  const files = ["/etc/nginx/nginx.conf"];
  try { for (const n of sh.fs.list("/etc/nginx/sites-enabled", "root") || []) files.push("/etc/nginx/sites-enabled/" + n); } catch (e) { /* rien */ }
  for (const f of files) {
    let data; try { data = sh.fs.read(f, "root"); } catch (e) { return { ok: false, msg: 'open() "' + f + '" failed (2: No such file or directory)' }; }
    let depth = 0, text = "", line = 1, start = 1;
    for (const ch of data.replace(/#[^\n]*/g, "")) {
      if (ch === "\n") { line++; if (text.trim()) continue; text = ""; continue; }
      if (ch === ";") {
        const [dir, ...a] = text.trim().split(/\s+/);
        if (ONE_ARG.has(dir) && a.length !== 1) return { ok: false, msg: 'invalid number of arguments in "' + dir + '" directive in ' + f + ":" + line };
        text = ""; continue;
      }
      if (ch === "{") { if (!text.trim()) return { ok: false, msg: 'unexpected "{" in ' + f + ":" + line }; depth++; text = ""; continue; }
      if (ch === "}") {
        if (text.trim()) return { ok: false, msg: 'directive "' + text.trim().split(/\s+/)[0] + '" is not terminated by ";" in ' + f + ":" + line };
        if (--depth < 0) return { ok: false, msg: 'unexpected "}" in ' + f + ":" + line }; continue;
      }
      if (!text.trim()) start = line;
      text += ch;
    }
    if (text.trim()) return { ok: false, msg: 'unexpected end of file, expecting ";" or "}" in ' + f + ":" + line };
    if (depth > 0) return { ok: false, msg: 'unexpected end of file, expecting "}" in ' + f + ":" + line };
    void start;
  }
  return { ok: true };
}

/* Services décrits par un fichier d'unité dans /etc/systemd/system (écrit par l'élève). */
function parseUnit(sh, n) {
  let data; try { data = sh.fs.read("/etc/systemd/system/" + n + ".service", "root"); } catch (e) { return null; }
  const get = (k) => { const m = new RegExp("^" + k + "=(.*)$", "m").exec(data); return m ? m[1].trim() : ""; };
  if (!/^\[Service\]/m.test(data)) return { exec: "", desc: get("Description") || n, invalid: "Service has no [Service] section" };
  return { exec: get("ExecStart"), desc: get("Description") || n, user: get("User") || "root", restart: get("Restart"), wantedBy: get("WantedBy") };
}
function loadUnit(sh, n) {
  const u = parseUnit(sh, n); if (!u) return null;
  addService(sh, n, { ...u, custom: true, active: false, enabled: false, unitPath: "/etc/systemd/system/" + n + ".service" });
  return sh.services[n];
}
function execCheck(sh, s) {
  if (s.invalid) return { ok: false, msg: s.invalid };
  if (!s.exec) return { ok: false, msg: "Service has no ExecStart=, ExecStop=, or SuccessAction=. Refusing." };
  const bin = s.exec.split(/\s+/)[0];
  if (!bin.startsWith("/")) return { ok: false, msg: "Neither a valid executable name nor an absolute path: " + bin };
  let node; try { node = sh.fs.stat(bin, "root"); } catch (e) { return { ok: false, msg: "Failed at step EXEC spawning " + bin + ": No such file or directory" }; }
  if (!(node.mode & 0o111)) return { ok: false, msg: "Failed at step EXEC spawning " + bin + ": Permission denied" };
  if (s.user && s.user !== "root" && !sh.fs.users[s.user]) return { ok: false, msg: "Failed to determine user credentials: No such process" };
  return { ok: true };
}

/* ---------- table des commandes ---------- */
export const COMMANDS = {};
/* Extensions branchées par d'autres simulateurs (Docker) : requêtes HTTP, critères, mise en place. */
export const HTTP_HOOKS = [];
export const EXTRA_CHECKS = {};
export const SETUP_HOOKS = [];
const C = (names, fn) => { for (const n of names.split(" ")) COMMANDS[n] = fn; };

C("ls", (sh, args, io) => {
  const { o, rest } = need("ls", opts(args, "alhARdt1rSF", { all: "a", "human-readable": "h", recursive: "R", directory: "d" }));
  const targets = rest.length ? rest : ["."];
  let code = 0; const files = [], dirs = [];
  for (const t of targets) {
    try { const n = sh.fs.lookup(sh.abs(t), { user: sh.user, follow: !o.l || t.endsWith("/") }).node; (n.t === "d" && !o.d ? dirs : files).push([t, n]); }
    catch (e) { io.err("ls: cannot access '" + t + "': " + errText(e.code) + "\n"); code = 2; }
  }
  const nameOf = (n, nm) => nm + (o.F ? (n.t === "d" ? "/" : n.t === "l" ? "@" : n.mode & 0o111 ? "*" : "") : "");
  const sortEntries = (es) => { if (o.t) es.sort((a, b) => b[1].mtime - a[1].mtime); else if (o.S) es.sort((a, b) => sh.fs.size(b[1]) - sh.fs.size(a[1])); if (o.r) es.reverse(); return es; };
  const longLine = (n, nm) => [modeString(n), String(n.t === "d" ? 2 + Object.values(n.children).filter((c) => c.t === "d").length : 1), n.owner, n.group, o.h ? human(sh.fs.size(n)) : String(sh.fs.size(n)), lsDate(n.mtime), nameOf(n, nm) + (n.t === "l" ? " -> " + n.target : "")];
  const table = (rows) => { if (!rows.length) return ""; const w = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length))); return rows.map((r) => r.map((c, i) => (i === 1 || i === 4 ? c.padStart(w[i]) : i === r.length - 1 ? c : c.padEnd(w[i]))).join(" ")).join("\n") + "\n"; };
  const show = (es) => { if (!es.length) return ""; if (o.l) return table(es.map(([nm, n]) => longLine(n, nm))); return io.tty && !o[1] ? es.map(([nm, n]) => nameOf(n, nm)).join("  ") + "\n" : es.map(([nm, n]) => nameOf(n, nm)).join("\n") + "\n"; };
  let out = show(sortEntries(files));
  const listDir = (label, path, n, first) => {
    let names; try { names = sh.fs.list(path, sh.user); } catch (e) { io.err("ls: cannot open directory '" + label + "': " + errText(e.code) + "\n"); code = 2; return; }
    let es = names.filter((x) => o.a || o.A || !x.startsWith(".")).map((x) => [x, n.children[x]]);
    if (o.a) { let up = n; try { up = sh.fs.stat(dirname(path), sh.user); } catch (e) { /* racine */ } es = [[".", n], ["..", up], ...es]; }
    sortEntries(es);
    if (dirs.length + files.length > 1 || o.R) out += (first && !files.length ? "" : "\n") + label + ":\n";
    if (o.l) out += "total " + es.reduce((a, [, c]) => a + Math.ceil(sh.fs.size(c) / 1024) * (c.t === "d" ? 4 : 1), 0) + "\n";
    out += show(es);
    if (o.R) for (const [x, c] of es) if (c.t === "d" && x !== "." && x !== "..") listDir((label === "." ? "." : label) + "/" + x, path + "/" + x, c, false);
  };
  dirs.forEach(([t, n], i) => listDir(t, sh.abs(t), n, i === 0));
  io.out(out);
  return code;
});
C("cat", (sh, args, io) => {
  const { o, rest } = need("cat", opts(args, "nAE"));
  let code = 0, out = "", k = 0;
  for (const f of inputs(sh, "cat", rest, io)) {
    if (f.error) { code = 1; continue; }
    out += o.n ? lines(f.data).map((l) => String(++k).padStart(6) + "\t" + l).join("\n") + (f.data ? "\n" : "") : f.data;
  }
  io.out(out); return code;
});
C("tac", (sh, args, io) => { for (const f of inputs(sh, "tac", args, io)) if (!f.error) io.out(lines(f.data).reverse().map((l) => l + "\n").join("")); return 0; });
COMMANDS.head = (sh, args, io) => headTail(sh, args, io, "head");
COMMANDS.tail = (sh, args, io) => headTail(sh, args, io, "tail");
function headTail(sh, args, io, name) {
  const { o, rest } = need(name, opts(args, "n:c:fqvN", { lines: "n:", follow: "f" }));
  let n = o.n !== undefined ? o.n : o.N !== undefined ? o.N : "10";
  const fromStart = name === "tail" && String(n).startsWith("+");
  n = Math.abs(parseInt(n, 10));
  if (Number.isNaN(n)) fail(name + ": invalid number of lines: '" + o.n + "'");
  const ins = inputs(sh, name, rest, io); let code = 0;
  ins.forEach((f, i) => {
    if (f.error) { code = 1; return; }
    if (ins.length > 1) io.out((i ? "\n" : "") + "==> " + f.name + " <==\n");
    const l = lines(f.data);
    const sel = name === "head" ? (o.n !== undefined && String(o.n).startsWith("-") ? l.slice(0, Math.max(l.length - n, 0)) : l.slice(0, n)) : fromStart ? l.slice(n - 1) : n === 0 ? [] : l.slice(-n);
    io.out(sel.map((x) => x + "\n").join(""));
  });
  if (o.f) io.err("(tail -f suit le fichier en continu sur une vraie machine ; Ctrl+C pour arrêter. Non simulé ici.)\n");
  return code;
}
C("wc", (sh, args, io) => {
  const { o, rest } = need("wc", opts(args, "lwcm", { lines: "l", words: "w", bytes: "c" }));
  const pick = o.l || o.w || o.c || o.m ? ["l", "w", "c"].filter((k) => o[k] || (k === "c" && o.m)) : ["l", "w", "c"];
  const rows = []; let code = 0; const tot = { l: 0, w: 0, c: 0 };
  for (const f of inputs(sh, "wc", rest, io)) {
    if (f.error) { code = 1; continue; }
    const v = { l: (f.data.match(/\n/g) || []).length, w: f.data.split(/\s+/).filter(Boolean).length, c: new TextEncoder().encode(f.data).length };
    for (const k in tot) tot[k] += v[k];
    rows.push([pick.map((k) => v[k]), f.name === "-" ? "" : f.name]);
  }
  if (rows.length > 1) rows.push([pick.map((k) => tot[k]), "total"]);
  const width = rows.length === 1 && pick.length === 1 ? 0 : Math.max(...rows.flatMap((r) => r[0].map((x) => String(x).length)), rest.length ? 1 : 7);
  io.out(rows.map(([vals, nm]) => vals.map((x) => String(x).padStart(width)).join(" ") + (nm ? " " + nm : "")).join("\n") + (rows.length ? "\n" : ""));
  return code;
});
C("grep egrep", (sh, args, io) => {
  const r = opts(args, "ivnclrRHhEFowqxe:A:B:C:s", { "ignore-case": "i", "invert-match": "v", "line-number": "n", count: "c", recursive: "r", "only-matching": "o", "word-regexp": "w", quiet: "q", "files-with-matches": "l", "extended-regexp": "E", "fixed-strings": "F", include: "include:", color: "color:" });
  const { o, rest } = need("grep", r);
  const pats = o.e !== undefined ? [o.e] : rest.length ? [rest.shift()] : fail("Usage: grep [OPTION]... PATTERNS [FILE]...\nTry 'grep --help' for more information.", 2);
  let src = pats[0];
  if (o.F) src = src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let rx;
  try { rx = o.F ? new RegExp(src, o.i ? "i" : "") : posixRegex(src, { extended: !!o.E || args[-1] === "egrep", flags: o.i ? "i" : "" }); } catch (e) { fail("grep: Invalid regular expression", 2); }
  if (o.w) rx = new RegExp("(?<![\\w])(?:" + rx.source + ")(?![\\w])", rx.flags);
  if (o.x) rx = new RegExp("^(?:" + rx.source + ")$", rx.flags);
  const files = [];
  const walk = (p, label) => {
    let n; try { n = sh.fs.stat(p, sh.user); } catch (e) { if (!o.s) io.err("grep: " + label + ": " + errText(e.code) + "\n"); return; }
    if (n.t === "d") { if (!(o.r || o.R)) { io.err("grep: " + label + ": Is a directory\n"); return; } for (const c of sh.fs.list(p, sh.user) || []) walk(p + "/" + c, label.replace(/\/$/, "") + "/" + c); return; }
    if (o.include && !globRegex(o.include).test(basename(p))) return;
    try { files.push({ name: label, data: sh.fs.read(p, sh.user) }); } catch (e) { if (!o.s) io.err("grep: " + label + ": " + errText(e.code) + "\n"); }
  };
  if (!rest.length && (o.r || o.R)) rest.push(".");
  if (rest.length) for (const f of rest) walk(sh.abs(f), f); else files.push({ name: "(standard input)", data: io.stdin || "" });
  const multi = (files.length > 1 || o.r || o.R) && !o.h;
  let found = false, out = "";
  for (const f of files) {
    let cnt = 0; const ls = lines(f.data);
    ls.forEach((l, i) => {
      const m = rx.test(l) !== !!o.v; if (!m) return; cnt++; found = true;
      if (o.c || o.l || o.q) return;
      const pre = (multi ? f.name + ":" : "") + (o.n ? i + 1 + ":" : "");
      if (o.o && !o.v) { const g = new RegExp(rx.source, rx.flags + "g"); for (const mm of l.matchAll(g)) out += pre + mm[0] + "\n"; }
      else out += pre + l + "\n";
    });
    if (o.c) out += (multi ? f.name + ":" : "") + cnt + "\n";
    if (o.l && cnt) out += f.name + "\n";
  }
  if (!o.q) io.out(out);
  return found ? 0 : 1;
});
C("sort", (sh, args, io) => {
  const { o, rest } = need("sort", opts(args, "nruk:t:fhVo:", { numeric: "n", reverse: "r", unique: "u", key: "k:", "field-separator": "t:", "human-numeric-sort": "h" }));
  const all = []; let code = 0;
  for (const f of inputs(sh, "sort", rest, io)) { if (f.error) { code = 2; continue; } all.push(...lines(f.data)); }
  const keyOf = (l) => {
    if (!o.k) return l;
    const [a, b] = String(o.k).split(",").map((x) => parseInt(x, 10));
    const parts = o.t ? l.split(o.t) : l.trim().split(/\s+/);
    return parts.slice(a - 1, b ? b : o.t ? a : parts.length).join(o.t || " ");
  };
  const hnum = (s) => { const m = /^\s*([\d.]+)([KMGT]?)/i.exec(s); return m ? parseFloat(m[1]) * Math.pow(1024, "KMGT".indexOf(m[2].toUpperCase()) + 1) : 0; };
  const cmp = (x, y) => {
    const a = keyOf(x), b = keyOf(y);
    let c;
    if (o.n || o.h) { const na = o.h ? hnum(a) : parseFloat(a) || 0, nb = o.h ? hnum(b) : parseFloat(b) || 0; c = na - nb; if (c === 0) c = x < y ? -1 : x > y ? 1 : 0; }
    else { const A = o.f ? a.toUpperCase() : a, B = o.f ? b.toUpperCase() : b; c = A < B ? -1 : A > B ? 1 : 0; if (c === 0 && o.k) c = x < y ? -1 : x > y ? 1 : 0; }
    return o.r ? -c : c;
  };
  let res = all.sort(cmp);
  if (o.u) res = res.filter((l, i) => i === 0 || cmp(res[i - 1], l) !== 0);
  const text = res.map((l) => l + "\n").join("");
  if (o.o) sh.fs.write(sh.abs(o.o), text, sh.user); else io.out(text);
  return code;
});
C("uniq", (sh, args, io) => {
  const { o, rest } = need("uniq", opts(args, "cdui", { count: "c" }));
  const f = inputs(sh, "uniq", rest.slice(0, 1), io)[0]; if (f.error) return 1;
  const ls = lines(f.data); const groups = [];
  for (const l of ls) { const last = groups[groups.length - 1]; if (last && (o.i ? last.l.toLowerCase() === l.toLowerCase() : last.l === l)) last.n++; else groups.push({ l, n: 1 }); }
  io.out(groups.filter((g) => (!o.d || g.n > 1) && (!o.u || g.n === 1)).map((g) => (o.c ? String(g.n).padStart(7) + " " : "") + g.l + "\n").join(""));
  return 0;
});
function ranges(spec) { return spec.split(",").map((r) => { const m = /^(\d*)-(\d*)$/.exec(r); return m ? [m[1] ? +m[1] : 1, m[2] ? +m[2] : Infinity] : [+r, +r]; }); }
C("cut", (sh, args, io) => {
  const { o, rest } = need("cut", opts(args, "d:f:c:s", { delimiter: "d:", fields: "f:", characters: "c:" }));
  if (!o.f && !o.c) fail("cut: you must specify a list of bytes, characters, or fields\nTry 'cut --help' for more information.");
  const d = o.d === undefined ? "\t" : o.d; if (d.length !== 1) fail("cut: the delimiter must be a single character");
  const rs = ranges(o.f || o.c); const inR = (i) => rs.some(([a, b]) => i >= a && i <= b);
  let out = "";
  for (const f of inputs(sh, "cut", rest, io)) {
    if (f.error) continue;
    for (const l of lines(f.data)) {
      if (o.c) { out += [...l].filter((_, i) => inR(i + 1)).join("") + "\n"; continue; }
      if (!l.includes(d)) { if (!o.s) out += l + "\n"; continue; }
      out += l.split(d).filter((_, i) => inR(i + 1)).join(d) + "\n";
    }
  }
  io.out(out); return 0;
});
function trSet(s) {
  s = s.replace(/\[:upper:\]/g, "A-Z").replace(/\[:lower:\]/g, "a-z").replace(/\[:digit:\]/g, "0-9").replace(/\[:space:\]/g, " \t\n\r").replace(/\[:alpha:\]/g, "a-zA-Z").replace(/\[:alnum:\]/g, "a-zA-Z0-9").replace(/\[:punct:\]/g, "!-/:-@[-`{-~");
  s = s.replace(/\\n/g, "\n").replace(/\\t/g, "\t");
  const out = [];
  for (let i = 0; i < s.length; i++) { if (s[i + 1] === "-" && i + 2 < s.length) { for (let c = s.charCodeAt(i); c <= s.charCodeAt(i + 2); c++) out.push(String.fromCharCode(c)); i += 2; } else out.push(s[i]); }
  return out;
}
C("tr", (sh, args, io) => {
  const { o, rest } = need("tr", opts(args, "dsc"));
  const a = trSet(rest[0] || ""), b = rest[1] !== undefined ? trSet(rest[1]) : [];
  let s = io.stdin || "";
  if (o.d) { const set = new Set(a); s = [...s].filter((c) => o.c ? set.has(c) : !set.has(c)).join(""); if (o.s && b.length) { const sq = new Set(b); s = s.replace(/(.)\1+/g, (m, c) => (sq.has(c) ? c : m)); } }
  else if (b.length) { const map = new Map(a.map((c, i) => [c, b[Math.min(i, b.length - 1)]])); s = [...s].map((c) => map.get(c) ?? c).join(""); if (o.s) { const sq = new Set(b); s = s.replace(/(.)\1+/g, (m, c) => (sq.has(c) ? c : m)); } }
  else if (o.s) { const sq = new Set(a); s = s.replace(/(.)\1+/g, (m, c) => (sq.has(c) ? c : m)); }
  io.out(s); return 0;
});
C("sed", (sh, args, io) => {
  const { o, rest } = need("sed", opts(args, "ne:iEr", { quiet: "n", expression: "e:", "in-place": "i", "regexp-extended": "E" }));
  const scripts = o.e !== undefined ? [o.e] : rest.length ? [rest.shift()] : fail("Usage: sed [OPTION]... {script-only-if-no-other-script} [input-file]...");
  const run = (data) => sed(data, scripts, { quiet: !!o.n, extended: !!(o.E || o.r) });
  try {
    if (o.i) { for (const f of rest) { const p = sh.abs(f); let d; try { d = sh.fs.read(p, sh.user); } catch (e) { io.err("sed: can't read " + f + ": " + errText(e.code) + "\n"); return 2; } sh.fs.write(p, run(d), sh.user); } return 0; }
    let code = 0;
    for (const f of inputs(sh, "sed", rest, io)) { if (f.error) { code = 2; continue; } io.out(run(f.data)); }
    return code;
  } catch (e) { if (e instanceof CmdErr) throw e; fail("sed: -e expression #1, char 1: " + e.message); }
});
C("awk gawk mawk", (sh, args, io) => {
  const { o, rest } = need("awk", opts(args, "F:v:f:"));
  const vars = {}; if (o.v) { const [k, ...v] = String(o.v).split("="); vars[k] = v.join("="); }
  const prog = o.f ? sh.fs.read(sh.abs(o.f), sh.user) : rest.shift();
  if (prog === undefined) fail("usage: awk [-F fs][-v var=value][prog | -f progfile][file ...]", 2);
  let data = ""; let code = 0;
  for (const f of inputs(sh, "awk", rest, io)) { if (f.error) { code = 2; continue; } data += f.data; }
  try { io.out(awk(data, prog, { fs: o.F === "\\t" ? "\t" : o.F ?? null, vars })); } catch (e) { fail("awk: " + e.message, 2); }
  return code;
});
C("tee", (sh, args, io) => { const { o, rest } = need("tee", opts(args, "a")); for (const f of rest) sh.fs.write(sh.abs(f), io.stdin || "", sh.user, { append: !!o.a }); io.out(io.stdin || ""); return 0; });
C("seq", (sh, args, io) => { const n = args.map(Number); const [a, s, b] = n.length === 1 ? [1, 1, n[0]] : n.length === 2 ? [n[0], 1, n[1]] : n; let out = ""; for (let x = a; s > 0 ? x <= b : x >= b; x += s) out += x + "\n"; io.out(out); return 0; });
C("rev", (sh, args, io) => { for (const f of inputs(sh, "rev", args, io)) if (!f.error) io.out(lines(f.data).map((l) => [...l].reverse().join("") + "\n").join("")); return 0; });
C("xargs", (sh, args, io) => {
  const { o, rest } = need("xargs", opts(args, "+n:I:0rt"));
  const items = (io.stdin || "").split(o[0] ? "\0" : /\s+/).filter(Boolean);
  const [cmd = "echo", ...base] = rest; let code = 0;
  const call = (a) => { if (o.t) io.err([cmd, ...a].join(" ") + "\n"); const c = sh.invoke(cmd, a, { ...io, stdin: "" }); if (c) code = 123; };
  if (!items.length && o.r) return 0;
  if (o.I) for (const it of items.length ? (io.stdin || "").split("\n").filter(Boolean) : []) call(base.map((b) => b.split(o.I).join(it)));
  else if (o.n) for (let i = 0; i < items.length; i += +o.n) call([...base, ...items.slice(i, i + +o.n)]);
  else call([...base, ...items]);
  return code;
});

/* ----- fichiers ----- */
C("mkdir", (sh, args, io) => {
  const { o, rest } = need("mkdir", opts(args, "pvm:", { parents: "p" }));
  if (!rest.length) fail("mkdir: missing operand\nTry 'mkdir --help' for more information.");
  let code = 0;
  for (const d of rest) {
    try { sh.fs.mkdir(sh.abs(d), sh.user, { parents: !!o.p, mode: o.m ? parseInt(o.m, 8) : undefined }); if (o.v) io.out("mkdir: created directory '" + d + "'\n"); }
    catch (e) { io.err("mkdir: cannot create directory '" + d + "': " + errText(e.code) + "\n"); code = 1; }
  }
  return code;
});
C("rmdir", (sh, args, io) => { let code = 0; for (const d of args) { try { const n = sh.fs.stat(sh.abs(d), sh.user); if (n.t !== "d") throw new FsError("ENOTDIR"); sh.fs.remove(sh.abs(d), sh.user, { dirOk: true }); } catch (e) { io.err("rmdir: failed to remove '" + d + "': " + errText(e.code) + "\n"); code = 1; } } return code; });
C("touch", (sh, args, io) => {
  if (!args.length) fail("touch: missing file operand\nTry 'touch --help' for more information.");
  let code = 0;
  for (const f of args.filter((a) => !a.startsWith("-"))) { const p = sh.abs(f); try { if (sh.fs.exists(p, sh.user)) { const n = sh.fs.stat(p, sh.user); if (!sh.fs.can(n, sh.user, 2)) throw new FsError("EACCES"); n.mtime = new Date(n.mtime.getTime() + 60000); } else sh.fs.write(p, "", sh.user); } catch (e) { io.err("touch: cannot touch '" + f + "': " + errText(e.code) + "\n"); code = 1; } }
  return code;
});
C("rm", (sh, args, io) => {
  const { o, rest } = need("rm", opts(args, "rRfiv", { recursive: "r", force: "f" }));
  if (!rest.length && !o.f) fail("rm: missing operand\nTry 'rm --help' for more information.");
  let code = 0;
  for (const f of rest) {
    const p = sh.abs(f);
    if (p === "/" ) { io.err("rm: it is dangerous to operate recursively on '/'\nrm: use --no-preserve-root to override this failsafe\n"); code = 1; continue; }
    try {
      const n = sh.fs.lookup(p, { user: sh.user, follow: false }).node;
      if (n.t === "d" && !(o.r || o.R)) { io.err("rm: cannot remove '" + f + "': Is a directory\n"); code = 1; continue; }
      sh.fs.remove(p, sh.user, { recursive: !!(o.r || o.R) });
      if (o.v) io.out("removed '" + f + "'\n");
    } catch (e) { if (o.f && e.code === "ENOENT") continue; io.err("rm: cannot remove '" + f + "': " + errText(e.code) + "\n"); code = 1; }
  }
  return code;
});
function copyOrMove(sh, args, io, move) {
  const name = move ? "mv" : "cp";
  const { o, rest } = need(name, opts(args, "rRfvinpa", { recursive: "r" }));
  if (rest.length < 2) fail(name + ": missing destination file operand after '" + (rest[0] || "") + "'\nTry '" + name + " --help' for more information.");
  const dst = rest.pop(); const dp = sh.abs(dst);
  let dnode = null; try { dnode = sh.fs.stat(dp, sh.user); } catch (e) { /* absent */ }
  if (rest.length > 1 && (!dnode || dnode.t !== "d")) fail(name + ": target '" + dst + "' is not a directory");
  let code = 0;
  for (const s of rest) {
    const sp = sh.abs(s);
    try {
      const n = sh.fs.lookup(sp, { user: sh.user, follow: !move }).node;
      if (!move && n.t === "d" && !(o.r || o.R || o.a)) { io.err("cp: -r not specified; omitting directory '" + s + "'\n"); code = 1; continue; }
      if (!move && n.t === "f" && !sh.fs.can(n, sh.user, 4)) throw new FsError("EACCES");
      const target = dnode && dnode.t === "d" ? dp + "/" + basename(sp) : dp;
      if (move && (target === sp || target.startsWith(sp + "/"))) { io.err("mv: cannot move '" + s + "' to a subdirectory of itself, '" + dst + "/" + basename(sp) + "'\n"); code = 1; continue; }
      if (o.n && sh.fs.exists(target, sh.user)) continue;
      if (move) { const parent = sh.fs.lookup(dirname(sp), { user: sh.user }).node; if (!sh.fs.can(parent, sh.user, 2)) throw new FsError("EACCES"); sh.fs.place(target, n, sh.user); delete parent.children[basename(sp)]; }
      else { const c = sh.fs.clone(n, o.p || o.a ? "root" : sh.user); if (!(o.p || o.a) && c.t === "f") c.mode = n.mode & ~sh.fs.umask & 0o777 | (n.mode & 0o111 ? n.mode & 0o111 : 0); sh.fs.place(target, c, sh.user); }
      if (o.v) io.out("'" + s + "' -> '" + (dnode && dnode.t === "d" ? dst.replace(/\/$/, "") + "/" + basename(sp) : dst) + "'\n");
    } catch (e) { io.err(name + ": cannot " + (move ? "move" : "stat") + " '" + s + "'" + (move ? " to '" + dst + "'" : "") + ": " + errText(e.code) + "\n"); code = 1; }
  }
  return code;
}
C("cp", (sh, args, io) => copyOrMove(sh, args, io, false));
C("mv", (sh, args, io) => copyOrMove(sh, args, io, true));
C("ln", (sh, args, io) => {
  const { o, rest } = need("ln", opts(args, "sfvnT", { symbolic: "s", force: "f", "no-dereference": "n" }));
  if (!o.s) fail("ln: les liens physiques ne sont pas simulés ; utilise ln -s");
  const [target, link = basename(target)] = rest;
  const lp = sh.abs(link); let ln = lp;
  try { if (sh.fs.lookup(lp, { user: sh.user, follow: !(o.n || o.T) }).node.t === "d") ln = lp + "/" + basename(target); } catch (e) { /* absent */ }
  if (o.f) { try { if (sh.fs.lookup(ln, { user: sh.user, follow: false }).node.t !== "d") sh.fs.remove(ln, sh.user); } catch (e) { /* rien */ } }
  try { sh.fs.symlink(target, ln, sh.user); } catch (e) { fail("ln: failed to create symbolic link '" + link + "': " + errText(e.code)); }
  return 0;
});
C("stat", (sh, args, io) => {
  let code = 0;
  for (const f of args.filter((a) => !a.startsWith("-"))) {
    try {
      const n = sh.fs.lookup(sh.abs(f), { user: sh.user, follow: false }).node;
      const u = sh.fs.users[n.owner] || { uid: 0 }, g = sh.fs.groups[n.group] || { gid: 0 };
      io.out("  File: " + f + (n.t === "l" ? " -> " + n.target : "") + "\n  Size: " + sh.fs.size(n) + "\t\tBlocks: 8          IO Block: 4096   " + ({ f: "regular file", d: "directory", l: "symbolic link" })[n.t] + "\nAccess: (" + (n.mode & 0o777).toString(8).padStart(4, "0") + "/" + modeString(n) + ")  Uid: ( " + String(u.uid).padStart(4) + "/" + n.owner.padStart(8) + ")   Gid: ( " + String(g.gid).padStart(4) + "/" + n.group.padStart(8) + ")\nModify: " + n.mtime.toISOString().replace("T", " ").replace("Z", "") + " +0000\n");
    } catch (e) { io.err("stat: cannot statx '" + f + "': " + errText(e.code) + "\n"); code = 1; }
  }
  return code;
});
C("file", (sh, args, io) => {
  for (const f of args) {
    try { const n = sh.fs.lookup(sh.abs(f), { user: sh.user, follow: false }).node; io.out(f + ": " + (n.t === "d" ? "directory" : n.t === "l" ? "symbolic link to " + n.target : !n.data ? "empty" : n.data.startsWith("#!") ? (/bash/.test(n.data.split("\n")[0]) ? "Bourne-Again shell script, ASCII text executable" : "a " + n.data.split("\n")[0].slice(2) + " script, ASCII text executable") : n.data.startsWith("BOUCLETAR") ? "gzip compressed data" : /^\s*[{[]/.test(n.data) ? "JSON text data" : "ASCII text") + "\n"); }
    catch (e) { io.out(f + ": cannot open `" + f + "' (" + errText(e.code) + ")\n"); }
  }
  return 0;
});
C("basename", (sh, args, io) => { let b = basename(args[0] || ""); if (args[1] && b.endsWith(args[1])) b = b.slice(0, -args[1].length); io.out(b + "\n"); return 0; });
C("dirname", (sh, args, io) => { const a = args[0] || "."; io.out((a.includes("/") ? dirname(a) : ".") + "\n"); return 0; });
C("realpath readlink", (sh, args, io) => { for (const a of args.filter((x) => !x.startsWith("-"))) { try { io.out(sh.fs.lookup(sh.abs(a), { user: sh.user }).path + "\n"); } catch (e) { io.err("realpath: " + a + ": " + errText(e.code) + "\n"); return 1; } } return 0; });
C("find", (sh, args, io) => {
  let i = 0; const starts = [];
  while (i < args.length && !args[i].startsWith("-") && args[i] !== "!" && args[i] !== "(") starts.push(args[i++]);
  if (!starts.length) starts.push(".");
  const preds = []; let maxd = Infinity, mind = 0, action = "print", execCmd = null;
  while (i < args.length) {
    const a = args[i++]; let neg = false; let x = a;
    if (a === "!" || a === "-not") { neg = true; x = args[i++]; }
    const v = args[i];
    const add = (fn) => preds.push(neg ? (n, p) => !fn(n, p) : fn);
    switch (x) {
      case "-name": i++; add((n, p) => globRegex(v).test(basename(p))); break;
      case "-iname": i++; add((n, p) => new RegExp(globRegex(v).source, "i").test(basename(p))); break;
      case "-path": i++; add((n, p) => globRegex(v).test(p)); break;
      case "-type": i++; add((n) => n.t === v); break;
      case "-maxdepth": i++; maxd = +v; break;
      case "-mindepth": i++; mind = +v; break;
      case "-user": i++; add((n) => n.owner === v); break;
      case "-group": i++; add((n) => n.group === v); break;
      case "-empty": add((n) => (n.t === "d" ? !Object.keys(n.children).length : n.t === "f" && !n.data)); break;
      case "-perm": i++; add((n) => (n.mode & 0o777).toString(8) === v.replace(/^0/, "")); break;
      case "-size": { i++; const m = /^([+-]?)(\d+)([ckMG]?)$/.exec(v); const mult = { c: 1, k: 1024, M: 1048576, G: 1073741824, "": 512 }[m[3]]; add((n) => { const s = sh.fs.size(n), lim = +m[2] * mult; return m[1] === "+" ? s > lim : m[1] === "-" ? s < lim : Math.ceil(s / mult) === +m[2]; }); break; }
      case "-newer": i++; { const ref = sh.fs.stat(sh.abs(v), sh.user); add((n) => n.mtime > ref.mtime); } break;
      case "-mtime": case "-mmin": { i++; const m = /^([+-]?)(\d+)$/.exec(v); const unit = x === "-mtime" ? 86400000 : 60000; add((n) => { const age = Math.floor((NOW() - n.mtime) / unit); return m[1] === "+" ? age > +m[2] : m[1] === "-" ? age < +m[2] : age === +m[2]; }); break; }
      case "-print": break;
      case "-delete": action = "delete"; break;
      case "-exec": { const end = args.indexOf(";", i) >= 0 ? args.indexOf(";", i) : args.indexOf("+", i); execCmd = args.slice(i, end); i = end + 1; action = "exec"; break; }
      default: fail("find: unknown predicate `" + x + "'");
    }
  }
  const results = [];
  const walk = (p, label, depth) => {
    let n; try { n = sh.fs.lookup(p, { user: sh.user, follow: depth === 0 }).node; } catch (e) { io.err("find: '" + label + "': " + errText(e.code) + "\n"); return; }
    if (depth >= mind && preds.every((f) => f(n, label))) results.push([p, label, n]);
    if (n.t === "d" && depth < maxd) {
      let names; try { names = sh.fs.list(p, sh.user); } catch (e) { io.err("find: '" + label + "': Permission denied\n"); return; }
      for (const c of names) walk(p + "/" + c, (label.endsWith("/") ? label : label + "/") + c, depth + 1);
    }
  };
  for (const s of starts) walk(sh.abs(s), s, 0);
  if (action === "delete") { for (const [p] of results.reverse()) try { sh.fs.remove(p, sh.user, { recursive: true }); } catch (e) { /* rien */ } return 0; }
  if (action === "exec") { let code = 0; for (const [, label] of results) { const c = sh.invoke(execCmd[0], execCmd.slice(1).map((x) => (x === "{}" ? label : x)), { ...io, stdin: "" }); if (c) code = 1; } return code; }
  io.out(results.map(([, l]) => l + "\n").join(""));
  return 0;
});
C("tree", (sh, args, io) => {
  const { o, rest } = need("tree", opts(args, "adL:"));
  const root = rest[0] || "."; let nd = 0, nf = 0;
  let out = root + "\n";
  const walk = (p, pre, depth) => {
    if (o.L && depth >= +o.L) return;
    let names; try { names = sh.fs.list(p, sh.user).filter((n) => o.a || !n.startsWith(".")); } catch (e) { return; }
    const node = sh.fs.stat(p, sh.user);
    if (o.d) names = names.filter((n) => node.children[n].t === "d");
    names.forEach((n, i) => {
      const last = i === names.length - 1, c = node.children[n];
      out += pre + (last ? "└── " : "├── ") + n + (c.t === "l" ? " -> " + c.target : "") + "\n";
      if (c.t === "d") { nd++; walk(p + "/" + n, pre + (last ? "    " : "│   "), depth + 1); } else nf++;
    });
  };
  walk(sh.abs(root), "", 0);
  io.out(out + "\n" + nd + " director" + (nd === 1 ? "y" : "ies") + (o.d ? "" : ", " + nf + " file" + (nf === 1 ? "" : "s")) + "\n");
  return 0;
});
C("du", (sh, args, io) => {
  const { o, rest } = need("du", opts(args, "shac", { "max-depth": "d:" }));
  for (const t of rest.length ? rest : ["."]) {
    let n; try { n = sh.fs.stat(sh.abs(t), sh.user); } catch (e) { io.err("du: cannot access '" + t + "': " + errText(e.code) + "\n"); continue; }
    const f = (b) => (o.h ? human(b) : String(Math.ceil(b / 1024)));
    if (!o.s && n.t === "d") for (const [c, cn] of Object.entries(n.children)) if (cn.t === "d") io.out(f(sh.fs.du(cn)) + "\t" + t.replace(/\/$/, "") + "/" + c + "\n");
    io.out(f(sh.fs.du(n)) + "\t" + t + "\n");
  }
  return 0;
});
C("df", (sh, args, io) => { const h = args.includes("-h"); io.out(h ? "Filesystem      Size  Used Avail Use% Mounted on\n/dev/sda1        29G  7.8G   21G  28% /\ntmpfs           2.0G     0  2.0G   0% /dev/shm\n/dev/sda15      105M  6.1M   99M   6% /boot/efi\n" : "Filesystem     1K-blocks    Used Available Use% Mounted on\n/dev/sda1       30298176 8159520  22122272  28% /\n"); return 0; });
C("free", (sh, args, io) => { io.out("               total        used        free      shared  buff/cache   available\nMem:           3.8Gi       1.1Gi       1.6Gi       4.0Mi       1.3Gi       2.7Gi\nSwap:             0B          0B          0B\n"); return 0; });
C("uptime", (sh, args, io) => { io.out(" 09:30:00 up 3 days,  2:14,  1 user,  load average: 0.08, 0.05, 0.01\n"); return 0; });
C("uname", (sh, args, io) => { io.out(args.includes("-a") ? "Linux " + sh.host + " 6.8.0-87-generic #88-Ubuntu SMP PREEMPT_DYNAMIC x86_64 x86_64 x86_64 GNU/Linux\n" : args.includes("-r") ? "6.8.0-87-generic\n" : "Linux\n"); return 0; });
C("hostname", (sh, args, io) => { io.out((args.includes("-I") ? "10.0.0.12 " : sh.host) + "\n"); return 0; });
C("whoami", (sh, args, io) => { io.out(sh.user + "\n"); return 0; });
C("id", (sh, args, io) => {
  const u = args[0] || sh.user; const x = sh.fs.users[u]; if (!x) fail("id: '" + u + "': no such user");
  const gs = sh.fs.groupsOf(u).map((g) => sh.fs.groups[g].gid + "(" + g + ")");
  io.out("uid=" + x.uid + "(" + u + ") gid=" + sh.fs.groups[u].gid + "(" + u + ") groups=" + gs.join(",") + "\n"); return 0;
});
C("groups", (sh, args, io) => { const u = args[0] || sh.user; io.out((args[0] ? u + " : " : "") + sh.fs.groupsOf(u).join(" ") + "\n"); return 0; });
C("date", (sh, args, io) => {
  const d = NOW(); const f = args.find((a) => a.startsWith("+"));
  const p = (n, w = 2) => String(n).padStart(w, "0");
  if (!f) { io.out(DAYS[d.getUTCDay()] + " " + MONTHS[d.getUTCMonth()] + " " + String(d.getUTCDate()).padStart(2) + " " + d.toISOString().slice(11, 19) + " UTC " + d.getUTCFullYear() + "\n"); return 0; }
  io.out(f.slice(1).replace(/%([YmdHMSFTsjAa%])/g, (m, c) => ({ Y: d.getUTCFullYear(), m: p(d.getUTCMonth() + 1), d: p(d.getUTCDate()), H: p(d.getUTCHours()), M: p(d.getUTCMinutes()), S: p(d.getUTCSeconds()), F: d.toISOString().slice(0, 10), T: d.toISOString().slice(11, 19), s: Math.floor(d.getTime() / 1000), j: "316", A: "Thursday", a: "Thu", "%": "%" })[c]) + "\n");
  return 0;
});
C("nginx", (sh, args, io) => {
  if (!sh.packages.has("nginx")) { io.err("Command 'nginx' not found, but can be installed with:\nsudo apt install nginx\n"); return 127; }
  if (args.includes("-t")) {
    if (sh.user !== "root") { io.err('nginx: [alert] could not open error log file: open() "/var/log/nginx/error.log" failed (13: Permission denied)\n'); }
    const r = nginxCheck(sh);
    if (!r.ok) { io.err("nginx: [emerg] " + r.msg + "\nnginx: configuration file /etc/nginx/nginx.conf test failed\n"); return 1; }
    io.err("nginx: the configuration file /etc/nginx/nginx.conf syntax is ok\nnginx: configuration file /etc/nginx/nginx.conf test is successful\n"); return 0;
  }
  if (args.includes("-v")) { io.err("nginx version: nginx/1.24.0 (Ubuntu)\n"); return 0; }
  fail("nginx: lance-le avec systemctl (sudo systemctl start nginx) plutôt qu'à la main");
});
C("sleep", () => 0);
C("clear", () => 0);
C("env printenv", (sh, args, io) => {
  if (args.length && COMMANDS.printenv === COMMANDS.env && args[0] && !args[0].includes("=")) { const v = sh.vars.get(args[0]); if (v === undefined || !sh.exported.has(args[0])) return 1; io.out(v + "\n"); return 0; }
  io.out([...sh.exported].filter((k) => sh.vars.has(k)).sort().map((k) => k + "=" + sh.vars.get(k) + "\n").join("")); return 0;
});
C("which", (sh, args, io) => { let code = 0; for (const a of args) { if (COMMANDS[a]) io.out("/usr/bin/" + a + "\n"); else if (sh.fs.exists("/usr/local/bin/" + a)) io.out("/usr/local/bin/" + a + "\n"); else code = 1; } return code; });
C("man info", (sh, args, io) => { io.out("Le manuel de « " + (args[0] || "") + " » n'est pas simulé ici. Sur ta machine : man " + (args[0] || "") + ", ou " + (args[0] || "commande") + " --help pour l'aide courte.\n"); return 0; });
C("chmod", (sh, args, io) => {
  const R = args.includes("-R"); const rest = args.filter((a) => a !== "-R" && a !== "-v");
  const [mode, ...files] = rest; if (!files.length) fail("chmod: missing operand after '" + (mode || "") + "'\nTry 'chmod --help' for more information.");
  let code = 0;
  const apply = (n, label) => {
    if (sh.user !== "root" && n.owner !== sh.user) { io.err("chmod: changing permissions of '" + label + "': Operation not permitted\n"); code = 1; return; }
    if (/^[0-7]{3,4}$/.test(mode)) { n.mode = parseInt(mode, 8) & 0o7777; return; }
    for (const clause of mode.split(",")) {
      const m = /^([ugoa]*)([-+=])([rwxX]*)$/.exec(clause); if (!m) fail("chmod: invalid mode: '" + mode + "'\nTry 'chmod --help' for more information.");
      const who = m[1] || "a"; let bits = 0;
      for (const c of m[3]) bits |= c === "r" ? 4 : c === "w" ? 2 : (c === "x" || (c === "X" && (n.t === "d" || n.mode & 0o111))) ? 1 : 0;
      let mask = 0; for (const w of who === "a" ? "ugo" : who) mask |= bits << ({ u: 6, g: 3, o: 0 })[w];
      const all = (who === "a" ? 0o777 : [...who].reduce((a, w) => a | (7 << ({ u: 6, g: 3, o: 0 })[w]), 0));
      if (m[2] === "+") n.mode |= m[1] ? mask : mask & ~sh.fs.umask;
      else if (m[2] === "-") n.mode &= ~mask;
      else n.mode = (n.mode & ~all) | mask;
    }
  };
  const walk = (p, label) => { let n; try { n = sh.fs.stat(p, sh.user); } catch (e) { io.err("chmod: cannot access '" + label + "': " + errText(e.code) + "\n"); code = 1; return; } apply(n, label); if (R && n.t === "d") for (const c of Object.keys(n.children)) walk(p + "/" + c, label + "/" + c); };
  for (const f of files) walk(sh.abs(f), f);
  return code;
});
function chownLike(sh, args, io, name) {
  const R = args.includes("-R"); const rest = args.filter((a) => a !== "-R" && a !== "-v");
  const [spec, ...files] = rest; if (!files.length) fail(name + ": missing operand after '" + (spec || "") + "'\nTry '" + name + " --help' for more information.");
  let [u, g] = name === "chgrp" ? [null, spec] : spec.split(":");
  if (u && !sh.fs.users[u]) fail(name + ": invalid user: '" + spec + "'");
  if (g && !sh.fs.groups[g]) fail(name + ": invalid group: '" + spec + "'");
  if (g === "" && u) g = u;
  let code = 0;
  const walk = (p, label) => {
    let n; try { n = sh.fs.stat(p, sh.user); } catch (e) { io.err(name + ": cannot access '" + label + "': " + errText(e.code) + "\n"); code = 1; return; }
    if (sh.user !== "root" && (u || !sh.fs.groupsOf(sh.user).includes(g) || n.owner !== sh.user)) { io.err(name + ": changing " + (u ? "ownership" : "group") + " of '" + label + "': Operation not permitted\n"); code = 1; return; }
    if (u) n.owner = u; if (g) n.group = g;
    if (R && n.t === "d") for (const c of Object.keys(n.children)) walk(p + "/" + c, label + "/" + c);
  };
  for (const f of files) walk(sh.abs(f), f);
  return code;
}
C("chown", (sh, args, io) => chownLike(sh, args, io, "chown"));
C("chgrp", (sh, args, io) => chownLike(sh, args, io, "chgrp"));
C("sudo", (sh, args, io) => {
  if (!sh.fs.groupsOf(sh.user).includes("sudo") && sh.user !== "root") fail(sh.user + " is not in the sudoers file.");
  if (!args.length) fail("usage: sudo -h | -K | -k | -V\nusage: sudo [-u user] command");
  if (args[0] === "-i" || args[0] === "-s" || (args[0] === "su" && args.length <= 2)) { sh.suStack = sh.suStack || []; sh.suStack.push({ user: sh.user, cwd: sh.cwd }); sh.user = "root"; if (args[0] !== "-s") sh.cwd = "/root"; return 0; }
  let user = "root", a = args;
  if (a[0] === "-u") { user = a[1]; a = a.slice(2); }
  const save = sh.user; sh.user = user;
  try { return sh.invoke(a[0], a.slice(1), io); } finally { sh.user = save; }
});
C("su", (sh, args, io) => { if (sh.user === "root") { sh.suStack = sh.suStack || []; sh.suStack.push({ user: sh.user, cwd: sh.cwd }); sh.user = args.find((a) => sh.fs.users[a]) || "root"; return 0; } io.err("Password: \nsu: Authentication failure\n"); return 1; });
C("useradd adduser", (sh, args, io) => {
  if (sh.user !== "root") fail("useradd: Permission denied.\nuseradd: cannot lock /etc/passwd; try again later.");
  const { o, rest } = need("useradd", opts(args, "ms:G:d:", { "create-home": "m", groups: "G:", shell: "s:" }));
  const name = rest[0]; if (!name) fail("Usage: useradd [options] LOGIN");
  if (sh.fs.users[name]) fail("useradd: user '" + name + "' already exists", 9);
  sh.fs.addUser(name, { groups: o.G ? String(o.G).split(",") : [], shell: o.s || "/bin/sh", home: o.d });
  if (o.m || io.adduser) { const h = sh.home(name); sh.fs.mkdir(h, "root", { parents: true }); const n = sh.fs.stat(h, "root"); n.owner = name; n.group = name; n.mode = 0o750; }
  syncUsers(sh); return 0;
});
C("usermod", (sh, args, io) => {
  if (sh.user !== "root") fail("usermod: Permission denied.\nusermod: cannot lock /etc/passwd; try again later.");
  const { o, rest } = need("usermod", opts(args, "aG:s:L"));
  const u = rest[0]; if (!sh.fs.users[u]) fail("usermod: user '" + u + "' does not exist", 6);
  if (o.G) { const gs = String(o.G).split(","); for (const g of gs) if (!sh.fs.groups[g]) fail("usermod: group '" + g + "' does not exist", 6); if (!o.a) for (const [g, x] of Object.entries(sh.fs.groups)) x.members = x.members.filter((m) => m !== u || g === u); for (const g of gs) if (!sh.fs.groups[g].members.includes(u)) sh.fs.groups[g].members.push(u); }
  if (o.s) sh.fs.users[u].shell = o.s;
  syncUsers(sh); return 0;
});
C("groupadd", (sh, args) => { if (sh.user !== "root") fail("groupadd: Permission denied.\ngroupadd: cannot lock /etc/group; try again later."); const g = args.find((a) => !a.startsWith("-")); if (sh.fs.groups[g]) fail("groupadd: group '" + g + "' already exists", 9); sh.fs.addGroup(g); syncUsers(sh); return 0; });
C("userdel", (sh, args) => { if (sh.user !== "root") fail("userdel: Permission denied."); const u = args.find((a) => !a.startsWith("-")); if (!sh.fs.users[u]) fail("userdel: user '" + u + "' does not exist", 6); delete sh.fs.users[u]; for (const g of Object.values(sh.fs.groups)) g.members = g.members.filter((m) => m !== u); if (args.includes("-r")) try { sh.fs.remove(sh.home(u), "root", { recursive: true }); } catch (e) { /* rien */ } syncUsers(sh); return 0; });
COMMANDS.adduser = (sh, args, io) => COMMANDS.useradd(sh, args, { ...io, adduser: true });
C("passwd", (sh, args, io) => { io.out("passwd: la saisie d'un mot de passe n'est pas simulée.\n"); return 0; });

/* ----- processus et services ----- */
C("ps", (sh, args, io) => {
  const all = args.some((a) => /a|e|x/.test(a.replace(/^-/, "")));
  let ps = all ? [...sh.procs] : sh.procs.filter((p) => p.user === sh.user);
  const sort = (args.find((a) => a.startsWith("--sort=")) || "").slice(7);
  if (sort) { const desc = sort.startsWith("-"); const k = sort.replace(/^[-+]/, "").replace("%", ""); ps.sort((a, b) => (desc ? -1 : 1) * ((a[k] ?? a.pid) - (b[k] ?? b.pid))); }
  args = args.filter((a) => !a.startsWith("--sort="));
  if (args.some((a) => /u/.test(a))) io.out("USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND\n" + ps.map((p) => p.user.padEnd(10) + String(p.pid).padStart(5) + String(p.cpu.toFixed(1)).padStart(5) + String(p.mem.toFixed(1)).padStart(5) + "  12345  6789 ?        Ss   09:00   0:00 " + p.cmd + "\n").join(""));
  else if (args.some((a) => /f/.test(a))) io.out("UID          PID    PPID  C STIME TTY          TIME CMD\n" + ps.map((p) => p.user.padEnd(8) + String(p.pid).padStart(8) + String(p.pid === 1 ? 0 : 1).padStart(8) + "  0 09:00 ?        00:00:00 " + p.cmd + "\n").join(""));
  else io.out("    PID TTY          TIME CMD\n" + ps.filter((p) => p.user === sh.user).map((p) => String(p.pid).padStart(7) + " pts/0    00:00:00 " + p.cmd.split(/[ /]/).filter(Boolean).pop().replace(/^-/, "") + "\n").join("") + "   5012 pts/0    00:00:00 ps\n");
  return 0;
});
function killProc(sh, p, sig, io) {
  if (sh.user !== "root" && p.user !== sh.user) { io.err("bash: kill: (" + p.pid + ") - Operation not permitted\n"); return 1; }
  sh.procs = sh.procs.filter((x) => x !== p);
  if (p.service) { const s = sh.services[p.service]; if (s && s.pid === p.pid) { s.active = false; s.failed = sig === "9" || sig === "KILL"; sh.procs = sh.procs.filter((x) => x.service !== p.service); log(sh, p.service, "systemd[1]", p.service + ".service: Main process exited, code=killed, status=" + (s.failed ? "9/KILL" : "15/TERM")); } }
  return 0;
}
C("kill", (sh, args, io) => {
  let sig = "15"; const pids = [];
  for (const a of args) { if (a === "-l") { io.out(" 1) SIGHUP\t 2) SIGINT\t 9) SIGKILL\t15) SIGTERM\n"); return 0; } if (/^-(\d+|[A-Z]+)$/.test(a)) sig = a.slice(1).replace(/^SIG/, ""); else pids.push(a); }
  let code = 0;
  for (const id of pids) { const p = sh.procs.find((x) => String(x.pid) === id); if (!p) { io.err("bash: kill: (" + id + ") - No such process\n"); code = 1; continue; } code = killProc(sh, p, sig, io) || code; }
  return code;
});
C("pkill pgrep", (sh, args, io) => {
  const pat = args.filter((a) => !a.startsWith("-")).pop(); const isGrep = io.cmdName === "pgrep";
  const ms = sh.procs.filter((p) => p.cmd.includes(pat));
  if (!ms.length) return 1;
  if (args.includes("-l") || isGrep) { io.out(ms.map((p) => p.pid + (args.includes("-l") ? " " + p.cmd.split(" ")[0] : "") + "\n").join("")); return 0; }
  for (const p of ms) killProc(sh, p, args.includes("-9") ? "9" : "15", io);
  return 0;
});
COMMANDS.pgrep = (sh, args, io) => { const pat = args.filter((a) => !a.startsWith("-")).pop(); const ms = sh.procs.filter((p) => p.cmd.includes(pat)); io.out(ms.map((p) => p.pid + (args.includes("-l") ? " " + basename(p.cmd.split(" ")[0]) : "") + "\n").join("")); return ms.length ? 0 : 1; };
C("systemctl", (sh, args, io) => {
  const rest = args.filter((a) => !a.startsWith("--") && a !== "-l"); const [verb, ...units] = rest;
  const unit = (u) => { const n = String(u || "").replace(/\.service$/, ""); return [n, sh.services[n] || loadUnit(sh, n)]; };
  const needRoot = (n, v) => { if (sh.user !== "root") fail("Failed to " + v + " " + n + ".service: Interactive authentication required.\nSee system logs and 'systemctl status " + n + ".service' for details.", 1); };
  const state = (s) => (s.active ? "active" : s.failed ? "failed" : "inactive");
  switch (verb) {
    case "start": case "restart": case "reload": case "stop": {
      for (const u of units) {
        const [n, s] = unit(u); needRoot(n, verb);
        if (!s) fail("Failed to " + verb + " " + n + ".service: Unit " + n + ".service not found.", 5);
        if (verb === "stop") { s.active = false; s.failed = false; sh.procs = sh.procs.filter((p) => p.service !== n); log(sh, n, "systemd[1]", "Stopped " + n + ".service - " + s.desc + "."); continue; }
        if (verb === "reload" && !s.active) fail(n + ".service is not active, cannot reload.", 1);
        const chk = s.check ? s.check(sh) : s.custom ? execCheck(sh, s) : { ok: true };
        const busy = (s.ports || []).find((pt) => Object.entries(sh.services).some(([m, o]) => m !== n && o.active && (o.ports || []).includes(pt)) || sh.procs.some((p) => p.port === pt && p.service !== n));
        if (!chk.ok || busy) {
          if (verb !== "reload") { s.active = false; s.failed = true; sh.procs = sh.procs.filter((p) => p.service !== n); }
          log(sh, n, s.custom ? "(" + basename(String(s.exec).split(" ")[0]) + ")[" + s.pid + "]" : n + "[" + s.pid + "]", busy ? (s.bindMsg ? s.bindMsg.replace("{port}", busy) : "bind() to 0.0.0.0:" + busy + " failed (98: Address already in use)") : (s.custom ? "" : "[emerg] ") + chk.msg, 3);
          log(sh, n, "systemd[1]", n + ".service: Control process exited, code=exited, status=1/FAILURE", 4);
          log(sh, n, "systemd[1]", "Failed to start " + n + ".service - " + s.desc + ".", 3);
          io.err("Job for " + n + ".service failed because the control process exited with error code.\nSee \"systemctl status " + n + ".service\" and \"journalctl -xeu " + n + ".service\" for details.\n");
          return 1;
        }
        s.active = true; s.failed = false; s.since = NOW(); startProc(sh, n);
        log(sh, n, "systemd[1]", (verb === "reload" ? "Reloaded " : "Started ") + n + ".service - " + s.desc + ".");
      }
      return 0;
    }
    case "enable": case "disable": {
      for (const u of units) { const [n, s] = unit(u); needRoot(n, verb); if (!s) fail("Failed to " + verb + " unit: Unit file " + n + ".service does not exist.", 1); s.enabled = verb === "enable"; if (args.includes("--now")) COMMANDS.systemctl(sh, [verb === "enable" ? "start" : "stop", n], io); io.err(verb === "enable" ? "Created symlink /etc/systemd/system/multi-user.target.wants/" + n + ".service → " + (s.unitPath || "/usr/lib/systemd/system/" + n + ".service") + ".\n" : "Removed \"/etc/systemd/system/multi-user.target.wants/" + n + ".service\".\n"); }
      return 0;
    }
    case "is-active": { const [, s] = unit(units[0]); io.out((s ? state(s) : "inactive") + "\n"); return s && s.active ? 0 : 3; }
    case "is-enabled": { const [, s] = unit(units[0]); io.out((s ? (s.enabled ? "enabled" : "disabled") : "not-found") + "\n"); return s && s.enabled ? 0 : 1; }
    case "daemon-reload": if (sh.user !== "root") fail("Failed to reload daemon: Interactive authentication required."); for (const n of Object.keys(sh.services)) if (sh.services[n].custom) Object.assign(sh.services[n], parseUnit(sh, n) || {}); return 0;
    case "list-units": case undefined: {
      io.out("  UNIT" + " ".repeat(22) + "LOAD   ACTIVE SUB     DESCRIPTION\n" + Object.entries(sh.services).filter(([, s]) => !args.includes("--failed") || s.failed).map(([n, s]) => (s.failed ? "● " : "  ") + (n + ".service").padEnd(26) + "loaded " + state(s).padEnd(6) + " " + (s.active ? "running" : s.failed ? "failed " : "dead   ") + " " + s.desc + "\n").join(""));
      return 0;
    }
    case "status": {
      const [n, s] = unit(units[0]);
      if (!s) { io.err("Unit " + n + ".service could not be found.\n"); return 4; }
      const st = s.active ? "active (running) since Thu 2026-11-12 09:00:00 UTC; 30min ago" : s.failed ? "failed (Result: exit-code) since Thu 2026-11-12 09:30:00 UTC; 2s ago" : "inactive (dead)";
      let out = (s.active ? "● " : s.failed ? "× " : "○ ") + n + ".service - " + s.desc + "\n     Loaded: loaded (" + (s.unitPath || "/usr/lib/systemd/system/" + n + ".service") + "; " + (s.enabled ? "enabled" : "disabled") + "; preset: enabled)\n     Active: " + st + "\n";
      if (s.active) out += "   Main PID: " + s.pid + " (" + basename(s.exec.split(" ")[0].replace(/:$/, "")) + ")\n      Tasks: " + (1 + (s.children || []).length) + " (limit: 4558)\n     Memory: 4.2M (peak: 4.6M)\n     CGroup: /system.slice/" + n + ".service\n" + sh.procs.filter((p) => p.service === n).map((p, i, a) => "             " + (i === a.length - 1 ? "└─" : "├─") + p.pid + " \"" + p.cmd + "\"\n").join("");
      const j = sh.journal.filter((e) => e.unit === n).slice(-5);
      if (j.length) out += "\n" + j.map((e) => logDate(e.ts) + " " + sh.host + " " + e.src + ": " + e.msg + "\n").join("");
      io.out(out); return s.active ? 0 : 3;
    }
    default: fail("Unknown command verb '" + verb + "'.");
  }
});
C("service", (sh, args, io) => COMMANDS.systemctl(sh, [args[1], args[0]], io));
C("journalctl", (sh, args, io) => {
  const { o } = need("journalctl", opts(args, "u:n:p:xefr", { unit: "u:", lines: "n:", priority: "p:", "no-pager": "nopager", since: "since:" }));
  if (sh.user !== "root" && !sh.fs.groupsOf(sh.user).some((g) => g === "adm" || g === "systemd-journal")) { io.out("Hint: You are currently not seeing messages from other users and the system.\n      Users in groups 'adm', 'systemd-journal' can see all messages.\n"); return 0; }
  const prio = { emerg: 0, alert: 1, crit: 2, err: 3, warning: 4, notice: 5, info: 6, debug: 7 };
  let es = sh.journal;
  if (o.u) { const u = String(o.u).replace(/\.service$/, ""); es = es.filter((e) => e.unit === u); }
  if (o.p) es = es.filter((e) => e.prio <= (prio[o.p] ?? +o.p));
  if (o.n) es = es.slice(-+o.n); else if (o.e) es = es.slice(-1000);
  if (o.r) es = [...es].reverse();
  if (!es.length) { io.out("-- No entries --\n"); return 0; }
  io.out(es.map((e) => logDate(e.ts) + " " + sh.host + " " + e.src + ": " + e.msg + "\n").join(""));
  if (o.f) io.err("(journalctl -f suit le journal en continu sur une vraie machine. Non simulé ici.)\n");
  return 0;
});
C("crontab", (sh, args, io) => {
  const u = sh.user;
  if (args.includes("-l")) { if (!sh.cron[u]) { io.err("no crontab for " + u + "\n"); return 1; } io.out(sh.cron[u]); return 0; }
  if (args.includes("-r")) { delete sh.cron[u]; return 0; }
  if (args.includes("-e")) { io.err("crontab -e ouvre un éditeur sur une vraie machine. Ici, écris la ligne dans un fichier puis : crontab fichier\n(ou : (crontab -l; echo \"…\") | crontab -)\n"); return 1; }
  const f = args[0]; if (!f) fail("crontab: usage error: file name must be specified for replace");
  const data = f === "-" ? io.stdin || "" : sh.fs.read(sh.abs(f), sh.user);
  for (const [i, l] of lines(data).entries()) { const t = l.trim(); if (!t || t.startsWith("#") || /^[A-Z_]+=/.test(t)) continue; const parts = t.split(/\s+/); if (!/^@(reboot|daily|hourly|weekly|monthly|yearly)$/.test(parts[0]) && (parts.length < 6 || !parts.slice(0, 5).every((x) => /^[\d*,/-]+$/.test(x)))) { io.err("\"-\":" + (i + 1) + ": bad minute\nerrors in crontab file, can't install.\n"); return 1; } }
  sh.cron[u] = data.endsWith("\n") ? data : data + "\n"; return 0;
});
C("apt apt-get", (sh, args, io) => {
  const verb = args.find((a) => !a.startsWith("-")); const pkgs = args.filter((a) => !a.startsWith("-")).slice(1);
  if (verb === "list") { io.out("Listing... Done\n" + [...sh.packages].sort().map((p) => p + "/noble,now amd64 [installed]\n").join("")); return 0; }
  if (["install", "update", "upgrade", "remove", "purge"].includes(verb) && sh.user !== "root") fail("E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)\nE: Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), are you root?", 100);
  if (verb === "update") { io.out("Hit:1 http://archive.ubuntu.com/ubuntu noble InRelease\nReading package lists... Done\n"); return 0; }
  if (verb === "install") {
    for (const p of pkgs) { if (!CATALOG[p]) fail("E: Unable to locate package " + p, 100); }
    io.out("Reading package lists... Done\nBuilding dependency tree... Done\n");
    for (const p of pkgs) { if (sh.packages.has(p)) { io.out(p + " is already the newest version.\n"); continue; } CATALOG[p](sh); sh.packages.add(p); io.out("Setting up " + p + " ...\n"); }
    return 0;
  }
  if (verb === "remove" || verb === "purge") { for (const p of pkgs) { sh.packages.delete(p); if (sh.services[p]) { sh.services[p].active = false; delete sh.services[p]; sh.procs = sh.procs.filter((x) => x.service !== p); } } return 0; }
  fail("E: Invalid operation " + verb, 100);
});

/* ----- réseau ----- */
function resolve(sh, host) { if (host === "localhost" || host === "127.0.0.1" || host === sh.host || /\.localhost$/.test(host)) return "127.0.0.1"; return sh.net.dns[host] || null; }
export function httpFor(sh, url) {
  const m = /^(https?):\/\/([^/:]+)(?::(\d+))?(\/[^?#]*)?(\?[^#]*)?/.exec(url); if (!m) return { error: [3, "URL using bad/illegal format or missing URL"] };
  const [, scheme, host, port0, path0 = "/"] = m; const port = +(port0 || (scheme === "https" ? 443 : 80)); const path = path0;
  const ip = resolve(sh, host); if (!ip) return { error: [6, "Could not resolve host: " + host] };
  const key = host + ":" + port + path;
  const routes = sh.net.http;
  if (routes[key] || routes[host + path]) return routes[key] || routes[host + path];
  for (const h of HTTP_HOOKS) { const r = h(sh, host, port, path, ip); if (r) return r; }
  if (ip === "127.0.0.1") {
    const svc = Object.entries(sh.services).find(([, s]) => s.active && (s.ports || []).includes(port));
    if (!svc) return { error: [7, "Failed to connect to " + host + " port " + port + " after 0 ms: Couldn't connect to server"] };
    if (svc[0] === "nginx") {
      let root = "/var/www/html";
      try { for (const n of sh.fs.list("/etc/nginx/sites-enabled", "root") || []) { const m = /^\s*root\s+(\S+);/m.exec(sh.fs.read("/etc/nginx/sites-enabled/" + n, "root")); if (m) { root = m[1]; break; } } } catch (e) { /* défaut */ }
      let body; try { body = sh.fs.read(root + (path.endsWith("/") ? path + "index.html" : path), "root"); } catch (e) { return { status: 404, type: "text/html", body: "<html>\n<head><title>404 Not Found</title></head>\n<body><center><h1>404 Not Found</h1></center></body>\n</html>\n" }; } return { status: 200, type: "text/html", body }; }
    if (svc[1].http) return svc[1].http(path) || { status: 404, type: "application/json", body: '{"detail":"Not Found"}' };
    return { status: 200, type: "text/plain", body: "OK\n" };
  }
  return { status: 200, type: "text/html", body: "<!doctype html><title>" + host + "</title>\n" };
}
const REASON = { 200: "OK", 201: "Created", 204: "No Content", 301: "Moved Permanently", 302: "Found", 400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found", 500: "Internal Server Error", 502: "Bad Gateway", 503: "Service Unavailable" };
C("curl", (sh, args, io) => {
  const { o, rest } = need("curl", opts(args, "sSiIfLvo:X:d:H:w:", { silent: "s", include: "i", head: "I", fail: "f", location: "L", output: "o:", request: "X:", data: "d:", header: "H:", "write-out": "w:" }));
  const url0 = rest[0]; if (!url0) fail("curl: try 'curl --help' or 'curl --manual' for more information", 2);
  const url = /^https?:\/\//.test(url0) ? url0 : "http://" + url0;
  const r = httpFor(sh, url);
  if (r.error) { if (!o.s || o.S) io.err("curl: (" + r.error[0] + ") " + r.error[1] + "\n"); if (o.w) io.out(String(o.w).replace(/%\{http_code\}/g, "000").replace(/\\n/g, "\n")); return r.error[0]; }
  if (o.f && r.status >= 400) { if (!o.s || o.S) io.err("curl: (22) The requested URL returned error: " + r.status + "\n"); return 22; }
  const head = "HTTP/1.1 " + r.status + " " + (REASON[r.status] || "") + "\nServer: " + (r.server || "nginx/1.24.0 (Ubuntu)") + "\nContent-Type: " + (r.type || "text/plain") + "\nContent-Length: " + new TextEncoder().encode(r.body || "").length + "\n\n";
  let out = o.I ? head : (o.i ? head : "") + (r.body || "");
  if (o.w) out += String(o.w).replace(/%\{http_code\}/g, String(r.status)).replace(/\\n/g, "\n");
  if (o.o) { if (sh.abs(o.o) !== "/dev/null") sh.fs.write(sh.abs(o.o), r.body || "", sh.user); if (o.w) io.out(String(o.w).replace(/%\{http_code\}/g, String(r.status)).replace(/\\n/g, "\n")); return 0; }
  io.out(out); return 0;
});
C("wget", (sh, args, io) => { io.err("wget n'est pas installé ici : utilise curl -O ou curl -o fichier.\n"); return 127; });
C("ping", (sh, args, io) => {
  const host = args.filter((a) => !a.startsWith("-") && !/^\d+$/.test(a)).pop(); const n = +(args[args.indexOf("-c") + 1] || 4);
  const ip = resolve(sh, host); if (!ip) fail("ping: " + host + ": Temporary failure in name resolution", 2);
  let out = "PING " + host + " (" + ip + ") 56(84) bytes of data.\n";
  for (let i = 1; i <= n; i++) out += "64 bytes from " + ip + ": icmp_seq=" + i + " ttl=" + (ip === "127.0.0.1" ? 64 : 54) + " time=" + (ip === "127.0.0.1" ? "0.04" : "12.3") + " ms\n";
  io.out(out + "\n--- " + host + " ping statistics ---\n" + n + " packets transmitted, " + n + " received, 0% packet loss, time " + (n - 1) * 1000 + "ms\n"); return 0;
});
C("dig nslookup host", (sh, args, io) => {
  const name = args.filter((a) => !a.startsWith("+") && !a.startsWith("-") && !/^(A|AAAA|MX|CNAME|TXT)$/.test(a)).pop(); const ip = resolve(sh, name);
  if (args.includes("+short")) { if (ip) io.out(ip + "\n"); return 0; }
  if (!ip) { io.out(";; ->>HEADER<<- opcode: QUERY, status: NXDOMAIN\n"); return 0; }
  io.out(";; QUESTION SECTION:\n;" + name + ".\t\t\tIN\tA\n\n;; ANSWER SECTION:\n" + name + ".\t\t300\tIN\tA\t" + ip + "\n\n;; SERVER: 127.0.0.53#53(127.0.0.53) (UDP)\n"); return 0;
});
C("ip", (sh, args, io) => {
  if (args[0] === "r" || args[0] === "route") { io.out("default via 10.0.0.1 dev eth0 proto dhcp src 10.0.0.12 metric 100\n10.0.0.0/24 dev eth0 proto kernel scope link src 10.0.0.12\n"); return 0; }
  io.out("1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN\n    inet 127.0.0.1/8 scope host lo\n2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP\n    link/ether 02:42:ac:11:00:0c brd ff:ff:ff:ff:ff:ff\n    inet 10.0.0.12/24 metric 100 brd 10.0.0.255 scope global dynamic eth0\n"); return 0;
});
C("ss", (sh, args, io) => {
  const showP = args.join("").includes("p");
  const procName = (cmd) => basename(cmd.split(" ")[0]).replace(/:$/, "");
  const rows = Object.entries(sh.services).filter(([, s]) => s.active).flatMap(([n, s]) => (s.ports || []).map((pt) => ["LISTEN", "0", "511", (pt === 5432 ? "127.0.0.1" : "0.0.0.0") + ":" + pt, "0.0.0.0:*", showP && sh.user === "root" ? 'users:(("' + procName(s.exec) + '",pid=' + s.pid + ",fd=6))" : ""]))
    .concat(sh.procs.filter((p) => p.port && !p.service).map((p) => ["LISTEN", "0", "5", "0.0.0.0:" + p.port, "0.0.0.0:*", showP && (sh.user === "root" || p.user === sh.user) ? 'users:(("' + procName(p.cmd) + '",pid=' + p.pid + ",fd=3))" : ""]));
  io.out("State  Recv-Q Send-Q Local Address:Port  Peer Address:Port Process\n" + rows.sort((a, b) => parseInt(a[3].split(":")[1], 10) - parseInt(b[3].split(":")[1], 10)).map((r) => r[0].padEnd(7) + r[1].padStart(6) + r[2].padStart(7) + " " + r[3].padStart(18) + " " + r[4].padStart(18) + " " + r[5] + "\n").join(""));
  return 0;
});
C("netstat", (sh, args, io) => { io.err("Command 'netstat' not found, but can be installed with:\nsudo apt install net-tools\n(netstat est obsolète : utilise ss -tlnp)\n"); return 127; });
C("base64", (sh, args, io) => {
  const dec = args.includes("-d") || args.includes("--decode"); const f = args.find((a) => !a.startsWith("-"));
  let data; try { data = f ? sh.fs.read(sh.abs(f), sh.user) : io.stdin || ""; } catch (e) { fail("base64: " + f + ": No such file or directory"); }
  if (dec) { try { io.out(decodeURIComponent(escape(atob(data.replace(/\s+/g, ""))))); } catch (e) { fail("base64: invalid input"); } return 0; }
  const b = btoa(unescape(encodeURIComponent(data))); io.out((b.match(/.{1,76}/g) || [""]).join("\n") + "\n"); return 0;
});
C("ssh-keygen", (sh, args, io) => {
  const { o } = need("ssh-keygen", opts(args, "t:f:N:C:b:qyl"));
  const type = o.t || "ed25519"; const f = sh.abs(o.f || "~/.ssh/id_" + type);
  if (sh.fs.exists(f, sh.user)) fail(f + " already exists.\nOverwrite (y/n)? (non simulé : supprime d'abord l'ancienne clé)");
  sh.fs.mkdir(dirname(f), sh.user, { parents: true });
  const d = sh.fs.stat(dirname(f), sh.user); if (basename(dirname(f)) === ".ssh") d.mode = 0o700;
  const fp = "SHA256:" + btoa(f + type).replace(/[^A-Za-z0-9]/g, "").slice(0, 43);
  const comment = o.C || sh.user + "@" + sh.host;
  const priv = sh.fs.write(f, "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAA" + (o.N ? "chiffrée" : "") + "…\n-----END OPENSSH PRIVATE KEY-----\n", sh.user); priv.mode = 0o600;
  const pub = sh.fs.write(f + ".pub", "ssh-" + type + " AAAAC3NzaC1lZDI1NTE5AAAAI" + btoa(fp).slice(0, 40) + " " + comment + "\n", sh.user); pub.mode = 0o644;
  io.out("Generating public/private " + type + " key pair.\nYour identification has been saved in " + f + "\nYour public key has been saved in " + f + ".pub\nThe key fingerprint is:\n" + fp + " " + comment + "\n");
  return 0;
});
C("mktemp", (sh, args, io) => { const dir = args.includes("-d"); const p = "/tmp/tmp." + Math.random().toString(36).slice(2, 12).padEnd(10, "x"); if (dir) sh.fs.mkdir(p, sh.user); else { const n = sh.fs.write(p, "", sh.user); n.mode = 0o600; } io.out(p + "\n"); return 0; });
C("ssh scp", (sh, args, io) => { io.err("La connexion SSH n'est pas simulée ici : refais cet exercice sur ta machine (voir « Sur ta machine »).\n"); return 255; });

/* ----- archives ----- */
C("tar", (sh, args, io) => {
  let flags = args[0] && !args[0].startsWith("-") ? args[0] : ""; let rest = flags ? args.slice(1) : [...args];
  const o = {}; let file = null, dir = null; const ops = [];
  for (const c of flags) o[c] = true;
  for (let i = 0; i < rest.length; i++) { const a = rest[i]; if (a === "-C") { dir = rest[++i]; continue; } if (a.startsWith("-")) { for (const c of a.slice(1)) { if (c === "f") { file = rest[++i]; } else o[c] = true; } continue; } if (o.f && !file) { file = a; continue; } ops.push(a); }
  if (flags.includes("f") && !file) file = ops.shift();
  if (!file) fail("tar: Refusing to read archive contents from terminal (missing -f option?)\ntar: Error is not recoverable: exiting now", 2);
  const base = dir ? sh.abs(dir) : sh.cwd;
  if (o.c) {
    const entries = [];
    const add = (p, label) => { const n = sh.fs.stat(p, sh.user); if (n.t === "d") { entries.push({ p: label + "/", d: true, mode: n.mode }); for (const c of Object.keys(n.children)) add(p + "/" + c, label + "/" + c); } else { entries.push({ p: label, data: sh.fs.read(p, sh.user), mode: n.mode }); } if (o.v) io.out(label + (n.t === "d" ? "/" : "") + "\n"); };
    for (const t of ops) { try { add(normalize(base + "/" + t), t.replace(/\/$/, "")); } catch (e) { fail("tar: " + t + ": Cannot stat: " + errText(e.code) + "\ntar: Exiting with failure status due to previous errors", 2); } }
    sh.fs.write(sh.abs(file), "BOUCLETAR" + (o.z ? "z" : "") + "\n" + JSON.stringify(entries), sh.user); return 0;
  }
  let data; try { data = sh.fs.read(sh.abs(file), sh.user); } catch (e) { fail("tar: " + file + ": Cannot open: " + errText(e.code) + "\ntar: Error is not recoverable: exiting now", 2); }
  if (!data.startsWith("BOUCLETAR")) fail("tar: This does not look like a tar archive\ntar: Exiting with failure status due to previous errors", 2);
  const entries = JSON.parse(data.slice(data.indexOf("\n") + 1));
  if (o.t) { io.out(entries.map((e) => e.p + "\n").join("")); return 0; }
  if (o.x) { for (const e of entries) { const p = normalize(base + "/" + e.p); if (e.d) sh.fs.mkdir(p, sh.user, { parents: true }); else { sh.fs.mkdir(dirname(p), sh.user, { parents: true }); const n = sh.fs.write(p, e.data, sh.user); n.mode = e.mode; } if (o.v) io.out(e.p + "\n"); } return 0; }
  fail("tar: You must specify one of the '-Acdtrux', '--delete' or '--test-label' options\nTry 'tar --help' or 'tar --usage' for more information.", 2);
});
C("gzip gunzip zip unzip", (sh, args, io) => { io.err("La compression seule n'est pas simulée : utilise tar -czf (créer) et tar -xzf (extraire).\n"); return 1; });
C("diff", (sh, args, io) => {
  const [a, b] = args.filter((x) => !x.startsWith("-"));
  const A = lines(sh.fs.read(sh.abs(a), sh.user)), B = lines(sh.fs.read(sh.abs(b), sh.user));
  const n = A.length, m = B.length; const L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  let i = 0, j = 0, out = "";
  const u = args.includes("-u");
  if (u) out += "--- " + a + "\n+++ " + b + "\n";
  while (i < n || j < m) {
    if (i < n && j < m && A[i] === B[j]) { if (u) out += " " + A[i] + "\n"; i++; j++; }
    else if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) { out += (u ? "+" : "> ") + B[j] + "\n"; j++; }
    else { out += (u ? "-" : "< ") + A[i] + "\n"; i++; }
  }
  const same = A.join("\n") === B.join("\n");
  if (!same) io.out(u ? out : out); return same ? 0 : 1;
});
C("jq", (sh, args, io) => {
  const raw = args.includes("-r"); const rest = args.filter((a) => !a.startsWith("-")); const filter = rest[0] || ".";
  let data; const src = rest[1] ? sh.fs.read(sh.abs(rest[1]), sh.user) : io.stdin || "";
  try { data = JSON.parse(src); } catch (e) { fail("jq: error (at <stdin>:1): Cannot parse input as JSON", 5); }
  const apply = (vals, f) => {
    f = f.trim(); if (f.includes("|")) return f.split("|").reduce((v, g) => apply(v, g), vals);
    if (f === "." ) return vals; if (f === "keys") return vals.map((v) => Object.keys(v).sort()); if (f === "length") return vals.map((v) => (Array.isArray(v) ? v.length : v && typeof v === "object" ? Object.keys(v).length : String(v).length));
    let m = /^select\((.+?)\s*(==|!=|>|<|>=|<=)\s*(.+)\)$/.exec(f);
    if (m) { const right = JSON.parse(m[3].replace(/'/g, '"')); return vals.filter((v) => { const l = apply([v], m[1])[0]; return ({ "==": l === right, "!=": l !== right, ">": l > right, "<": l < right, ">=": l >= right, "<=": l <= right })[m[2]]; }); }
    let out = vals;
    for (const part of f.match(/\.[A-Za-z_][\w-]*|\[\d*\]|\.\[\d*\]/g) || []) {
      const p = part.replace(/^\./, "");
      out = out.flatMap((v) => { if (p === "[]") return Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : fail("jq: error: Cannot iterate over " + typeof v, 5); const k = /^\[(\d+)\]$/.exec(p); if (k) return [Array.isArray(v) ? v[+k[1]] ?? null : null]; return [v && typeof v === "object" ? v[p] ?? null : null]; });
    }
    return out;
  };
  for (const v of apply([data], filter)) io.out((raw && typeof v === "string" ? v : JSON.stringify(v, null, 2)) + "\n");
  return 0;
});
