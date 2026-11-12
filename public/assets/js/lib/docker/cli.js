/* Commandes `docker` et `hadolint` du terminal simulé, critères déclaratifs et mise en place.
   Les sorties suivent Docker 27 (BuildKit, Compose v2). */
import { COMMANDS, HTTP_HOOKS, EXTRA_CHECKS, SETUP_HOOKS, addService, httpFor } from "../shell/commands.js";
import { Docker, DockerErr, hash } from "./engine.js";
import { canon, fullName, human } from "./catalog.js";
import { lint, words, DockerfileError } from "./dockerfile.js";
import { compose } from "./compose.js";

/* ---------- affichage ---------- */
export function table(head, rows) {
  const all = [head, ...rows]; const w = head.map((_, i) => Math.max(...all.map((r) => String(r[i] ?? "").length)));
  return all.map((r) => r.map((c, i) => (i === r.length - 1 ? String(c ?? "") : String(c ?? "").padEnd(w[i] + 3))).join("").replace(/\s+$/, "")).join("\n") + "\n";
}
export function ago(d, t) {
  const s = d.t - t;
  if (s < 0 || t < -100000) return s > 1209600 ? Math.round(s / 604800) + " weeks ago" : "3 weeks ago";
  if (s < 1) return "Less than a second ago";
  if (s < 60) return s + " seconds ago";
  if (s < 120) return "About a minute ago";
  if (s < 3600) return Math.floor(s / 60) + " minutes ago";
  if (s < 7200) return "About an hour ago";
  return Math.floor(s / 3600) + " hours ago";
}
const dur = (s) => (s < 1 ? "Less than a second" : s < 60 ? s + " seconds" : s < 120 ? "About a minute" : s < 3600 ? Math.floor(s / 60) + " minutes" : Math.floor(s / 3600) + " hours");
export function status(d, c) {
  if (c.state === "running") return "Up " + dur(d.t - c.startedAt) + (c.health ? " (" + c.health + ")" : "");
  if (c.state === "restarting") return "Restarting (" + c.exitCode + ") " + ago(d, c.startedAt);
  if (c.state === "created") return "Created";
  return "Exited (" + c.exitCode + ") " + ago(d, c.stoppedAt ?? c.startedAt ?? c.created);
}
export const cmdLine = (c) => { const s = [...(c.entrypoint || []), ...(c.cmd || [])].map((x) => (x.includes(" ") && !(c.entrypoint || [])[0]?.startsWith("/bin/sh") ? x : x)).join(" ").replace(/^\/bin\/sh -c /, "/bin/sh -c "); return '"' + (s.length > 20 ? s.slice(0, 19) + "…" : s) + '"'; };
export function portsStr(c, running = c.state === "running") {
  if (!running) return "";
  const out = [];
  for (const p of c.ports) { const proto = p.proto || "tcp"; if (p.hostIp && p.hostIp !== "0.0.0.0") out.push(p.hostIp + ":" + p.host + "->" + p.container + "/" + proto); else out.push("0.0.0.0:" + p.host + "->" + p.container + "/" + proto, "[::]:" + p.host + "->" + p.container + "/" + proto); }
  return out.join(", ");
}
const imgName = (d, c) => { const i = d.images[c.image]; return c.imageRef && i && i.tags.includes(canon(c.imageRef)) ? c.imageRef : i && i.tags[0] ? i.tags[0].replace(/:latest$/, "") : c.image.slice(0, 12); };

/* ---------- options ---------- */
/* spec : { "-d": "detach", "--name": ["name"] (prend une valeur), "-e": ["env", true] (répétable) } */
function parseOpts(args, spec, { stopAtFirst = true } = {}) {
  const o = {}, rest = []; let i = 0;
  const set = (key, v) => { const s = spec[key]; if (Array.isArray(s)) { if (s[1]) (o[s[0]] = o[s[0]] || []).push(v); else o[s[0]] = v; } else o[s] = true; };
  for (; i < args.length; i++) {
    const a = args[i];
    if (a === "--") { i++; break; }
    if (a.startsWith("--")) {
      const [k, v] = a.includes("=") ? [a.slice(0, a.indexOf("=")), a.slice(a.indexOf("=") + 1)] : [a, undefined];
      if (!(k in spec)) throw new DockerErr("unknown flag: " + k + "\nSee 'docker --help'.", 125);
      if (Array.isArray(spec[k])) { const val = v ?? args[++i]; if (val === undefined) throw new DockerErr("flag needs an argument: " + k, 125); set(k, val); } else set(k);
      continue;
    }
    if (a.startsWith("-") && a.length > 1) {
      for (let j = 1; j < a.length; j++) {
        const k = "-" + a[j];
        if (!(k in spec)) throw new DockerErr("unknown shorthand flag: '" + a[j] + "' in " + a + "\nSee 'docker --help'.", 125);
        if (Array.isArray(spec[k])) { const val = a.slice(j + 1) || args[++i]; if (val === undefined) throw new DockerErr("flag needs an argument: '" + a[j] + "' in " + a, 125); set(k, val); break; }
        set(k);
      }
      continue;
    }
    if (stopAtFirst) break;
    rest.push(a);
  }
  return { o, rest: rest.concat(args.slice(i)) };
}

/* Analyse -p, -v, -e partagée par run et Compose. */
export function parsePort(s) {
  const m = /^(?:(\d+\.\d+\.\d+\.\d+|\[::\]):)?(?:(\d+)?:)?(\d+)(?:\/(tcp|udp))?$/.exec(String(s));
  if (!m) throw new DockerErr("docker: invalid containerPort: " + s + ".\nSee 'docker run --help'.", 125);
  return { hostIp: m[1] || "", host: m[2] || "", container: m[3], proto: m[4] || "tcp" };
}
export function parseMount(sh, s, isMount) {
  if (isMount) {
    const kv = Object.fromEntries(String(s).split(",").map((x) => { const i = x.indexOf("="); return i < 0 ? [x, "true"] : [x.slice(0, i), x.slice(i + 1)]; }));
    const type = kv.type || "volume"; const src = kv.source || kv.src; const dest = kv.target || kv.destination || kv.dst;
    const ro = "readonly" in kv || "ro" in kv;
    if (type === "bind") { const p = sh.abs(src); try { sh.fs.lookup(p, { user: "root" }); } catch (e) { throw new DockerErr("docker: Error response from daemon: invalid mount config for type \"bind\": bind source path does not exist: " + p + ".\nSee 'docker run --help'.", 125); } return { type, source: p, dest, rw: !ro }; }
    return { type: "volume", source: src, dest, rw: !ro };
  }
  const parts = String(s).split(":"); const ro = parts[2] === "ro";
  if (parts.length === 1) return { type: "volume", source: null, dest: parts[0], rw: true };
  const [src, dest] = parts;
  if (src.startsWith("/") || src.startsWith(".") || src.startsWith("~")) {
    const p = sh.abs(src);
    try { sh.fs.lookup(p, { user: "root" }); } catch (e) { sh.fs.mkdir(p, "root", { parents: true }); }
    return { type: "bind", source: p, dest, rw: !ro };
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(src)) throw new DockerErr('docker: Error response from daemon: create ' + src + ': "' + src + '" includes invalid characters for a local volume name, only "[a-zA-Z0-9][a-zA-Z0-9_.-]" are allowed. If you intended to pass a host directory, use absolute path.\nSee \'docker run --help\'.', 125);
  return { type: "volume", source: src, dest, rw: !ro };
}
export function envFile(sh, path) {
  let data; try { data = sh.fs.read(sh.abs(path), sh.user); } catch (e) { throw new DockerErr("docker: open " + path + ": no such file or directory.\nSee 'docker run --help'.", 125); }
  const out = {}; for (const l of data.split("\n")) { const t = l.trim(); if (!t || t.startsWith("#")) continue; const i = t.indexOf("="); if (i < 0) out[t] = sh.vars.get(t) ?? ""; else out[t.slice(0, i)] = t.slice(i + 1).replace(/^(["'])(.*)\1$/, "$2"); }
  return out;
}

/* ---------- construction : rendu BuildKit ---------- */
function renderBuild(d, res, plain) {
  const lines = []; let total = 0; const n = res.steps.length;
  if (plain) {
    res.steps.forEach((s, i) => { lines.push("#" + (i + 1) + " " + s.name); for (const l of s.log || []) lines.push("#" + (i + 1) + " " + (0.3 + total).toFixed(3) + " " + l); for (const x of s.sub || []) lines.push("#" + (i + 1) + " " + x); lines.push("#" + (i + 1) + (s.error ? " ERROR: " + res.error : s.cached ? " CACHED" : " DONE " + (s.time || 0).toFixed(1) + "s"), ""); total += s.time || 0; });
  } else {
    for (const s of res.steps) {
      total += s.time || 0;
      const name = (s.error ? "ERROR " : s.cached ? "CACHED " : "") + s.name;
      const label = name.length > 74 ? name.slice(0, 73) + "…" : name;
      lines.push(" => " + label.padEnd(76) + (s.time || 0).toFixed(1) + "s");
      for (const x of s.sub || []) lines.push(" => => " + (x.length > 72 ? x.slice(0, 71) + "…" : x).padEnd(73) + "0.0s");
    }
  }
  const head = plain ? "" : "[+] Building " + total.toFixed(1) + "s (" + res.steps.filter((s) => !s.error).length + "/" + (res.error ? n + 1 : n) + ") FINISHED" + " ".repeat(30) + "docker:default\n";
  let out = head + lines.join("\n") + "\n";
  if (res.error) {
    if (res.runLog) out += "------\n > " + res.runLog.name + ":\n" + res.runLog.log.map((l, i) => (0.2 + i * 0.3).toFixed(3) + " " + l).join("\n") + "\n------\n";
    if (res.errLine && res.dockerfile) {
      const src = res.dockerfile.replace(/\n$/, "").split("\n"); const L = res.errLine;
      out += res.dfPath.split("/").pop() + ":" + L + "\n--------------------\n";
      for (let i = Math.max(1, L - 2); i <= Math.min(src.length, L + 2); i++) out += String(i).padStart(4) + " | " + (i === L ? ">>> " : "    ") + src[i - 1] + "\n";
      out += "--------------------\n";
    }
    out += "ERROR: " + res.error + "\n";
  }
  if (res.warnings.length && !res.early) out += "\n " + res.warnings.length + " warning" + (res.warnings.length > 1 ? "s" : "") + " found (use docker --debug to expand):\n" + res.warnings.map((w) => " - " + w.rule + ": " + w.message + " (line " + w.line + ")\n").join("");
  return out;
}

export function doBuild(sh, d, args, io) {
  const { o, rest } = parseOpts(args, { "-t": ["tags", true], "--tag": ["tags", true], "-f": ["file"], "--file": ["file"], "--target": ["target"], "--no-cache": "noCache", "--build-arg": ["buildArgs", true], "--progress": ["progress"], "-q": "quiet", "--quiet": "quiet", "--pull": "pull", "--platform": ["platform"], "--load": "load", "--push": "push" }, { stopAtFirst: false });
  if (rest.length !== 1) throw new DockerErr('ERROR: "docker buildx build" requires exactly 1 argument.\nSee \'docker buildx build --help\'.\n\nUsage:  docker buildx build [OPTIONS] PATH | URL | -\n\nStart a build', 1);
  for (const t of o.tags || []) if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*(?::[\w][\w.-]{0,127})?$/.test(t.replace(/^[\w.-]+\.\w+(:\d+)?\//, "x/"))) throw new DockerErr("ERROR: invalid tag \"" + t + "\": repository name must be lowercase", 1);
  const buildArgs = {}; for (const b of o.buildArgs || []) { const i = b.indexOf("="); buildArgs[i < 0 ? b : b.slice(0, i)] = i < 0 ? sh.vars.get(b) ?? "" : b.slice(i + 1); }
  const ctx = sh.abs(rest[0]);
  const res = d.build(ctx, { tags: o.tags, file: o.file, target: o.target, noCache: o.noCache, buildArgs, ctxArg: rest[0] });
  if (res.early && !res.steps.length) throw new DockerErr("ERROR: " + res.error, 1);
  if (o.quiet && !res.error) { io.out("sha256:" + res.image.id + "\n"); return 0; }
  io.err(renderBuild(d, res, o.progress === "plain"));
  return res.error ? 1 : 0;
}

/* ---------- exécution dans un conteneur (docker exec, docker compose exec) ---------- */
export function execIn(sh, d, c, argv, io, o = {}) {
  if (c.state !== "running") throw new DockerErr("Error response from daemon: container " + c.id + " is not running", 1);
  const img = d.images[c.image];
  const user = (o.user || c.user || "root").split(":")[0];
  const exe = argv[0]; const b = exe.split("/").pop();
  const builtin = ["ls", "cat", "env", "printenv", "id", "whoami", "pwd", "echo", "hostname", "ps", "touch", "mkdir", "getent", "date", "df", "uname", "rm", "head", "tail", "wc"];
  const avail = (x) => (img.shell && builtin.includes(x)) || img.bins.includes(x) || (["alpine", "busybox"].includes(img.os) && ["wget", "ping", "nslookup"].includes(x));
  if (!avail(b) && !(["sh", "bash"].includes(b) && img.shell)) throw new DockerErr('OCI runtime exec failed: exec failed: unable to start container process: exec: "' + exe + '": executable file not found in $PATH: unknown', 126);
  const cwd = o.workdir || c.workdir || "/"; const abs = (p) => (p.startsWith("/") ? p : (cwd === "/" ? "" : cwd) + "/" + p).replace(/\/+/g, "/");
  const a = argv.slice(1);
  const uid = user === "root" ? 0 : img.users[user] ?? (+user || 1000);
  switch (b) {
    case "sh": case "bash": {
      if (a[0] !== "-c") { io.err("(shell interactif dans le conteneur : non simulé ici. Lance une commande à la fois : docker exec " + c.name + " ls /app)\n"); return 0; }
      let code = 0; for (const part of a.slice(1).join(" ").split(/\s*&&\s*/)) { const w = words(part); const red = w.indexOf(">");
        if (red > 0) { const sub = { out: (s) => { try { d.writeFile(c, abs(w[red + 1]), s); } catch (e) { io.err("sh: can't create " + w[red + 1] + ": " + e.message + "\n"); code = 1; } }, err: io.err }; code = execIn(sh, d, c, w.slice(0, red), sub, o); } else code = execIn(sh, d, c, w, io, o);
        if (code) return code; }
      return code;
    }
    case "echo": io.out(a.join(" ") + "\n"); return 0;
    case "pwd": io.out(cwd + "\n"); return 0;
    case "whoami": io.out((user === "0" ? "root" : user) + "\n"); return 0;
    case "id": io.out("uid=" + uid + "(" + user + ") gid=" + uid + "(" + user + ") groups=" + uid + "(" + user + ")\n"); return 0;
    case "hostname": io.out(c.id.slice(0, 12) + "\n"); return 0;
    case "uname": io.out(a.includes("-a") ? "Linux " + c.id.slice(0, 12) + " 6.8.0-49-generic #49-Ubuntu SMP x86_64 GNU/Linux\n" : "Linux\n"); return 0;
    case "date": io.out("Thu Nov 12 09:30:00 UTC 2026\n"); return 0;
    case "env": case "printenv": { const env = { PATH: img.env.PATH, HOSTNAME: c.id.slice(0, 12), ...c.env, HOME: user === "root" ? "/root" : "/home/" + user }; if (a[0] && b === "printenv") { if (env[a[0]] === undefined) return 1; io.out(env[a[0]] + "\n"); return 0; } io.out(Object.entries(env).map(([k, v]) => k + "=" + v).join("\n") + "\n"); return 0; }
    case "ps": io.out("PID   USER     TIME  COMMAND\n    1 " + user.padEnd(8) + " 0:00 " + [...(c.entrypoint || []), ...(c.cmd || [])].join(" ") + "\n   " + (12 + d.seq % 50) + " " + user.padEnd(8) + " 0:00 ps " + a.join(" ") + "\n"); return 0;
    case "ls": {
      const long = a.some((x) => /^-\w*l/.test(x)); const paths = a.filter((x) => !x.startsWith("-")); const p = abs(paths[0] || ".");
      const f = d.readFile(c, p); if (f) { io.out((long ? "-" + modeStr(f.mode) + " 1 " + (f.owner || "root").padEnd(8) + " " + (f.owner || "root").padEnd(8) + " " + String((f.data || "").length).padStart(5) + " Nov 12 09:30 " : "") + p.split("/").pop() + "\n"); return 0; }
      const ls = d.listDir(c, p); if (!ls) { io.err("ls: cannot access '" + (paths[0] || ".") + "': No such file or directory\n"); return 2; }
      if (!long) { io.out(ls.join("\n") + (ls.length ? "\n" : "")); return 0; }
      io.out("total " + ls.length * 4 + "\n" + ls.map((n) => { const ff = d.readFile(c, (p === "/" ? "" : p) + "/" + n); return (ff ? "-" + modeStr(ff.mode) : "drwxr-xr-x") + " 1 " + ((ff && ff.owner) || d.ownerOf(c, (p === "/" ? "" : p) + "/" + n)).padEnd(8) + " " + ((ff && ff.owner) || d.ownerOf(c, (p === "/" ? "" : p) + "/" + n)).padEnd(8) + " " + String(ff ? (ff.data || "").length : 4096).padStart(5) + " Nov 12 09:30 " + n; }).join("\n") + "\n");
      return 0;
    }
    case "cat": case "head": case "tail": { let code = 0; for (const p of a.filter((x) => !x.startsWith("-"))) { if (p === "/etc/os-release") { io.out(img.os === "alpine" ? 'NAME="Alpine Linux"\nID=alpine\nVERSION_ID=3.20.3\nPRETTY_NAME="Alpine Linux v3.20"\n' : 'PRETTY_NAME="Debian GNU/Linux 12 (bookworm)"\nNAME="Debian GNU/Linux"\nVERSION_ID="12"\nID=debian\n'); continue; } const f = d.readFile(c, abs(p)); if (!f) { io.err(b + ": " + p + ": No such file or directory\n"); code = 1; } else io.out(f.data); } return code; }
    case "touch": case "mkdir": {
      for (const p of a.filter((x) => !x.startsWith("-"))) {
        const ap = abs(p); const m = d.mountFor(c, ap);
        if (m && !m.rw) { io.err(b + ": cannot " + (b === "touch" ? "touch '" + p + "'" : "create directory '" + p + "'") + ": Read-only file system\n"); return 1; }
        const dir = ap.slice(0, ap.lastIndexOf("/")) || "/"; const owner = m ? "root" : d.ownerOf(c, dir);
        if (user !== "root" && owner !== user && !dir.startsWith("/tmp")) { io.err(b + ": cannot " + (b === "touch" ? "touch '" + p + "'" : "create directory '" + p + "'") + ": Permission denied\n"); return 1; }
        if (b === "touch") d.writeFile(c, ap, "");
      }
      return 0;
    }
    case "rm": return 0;
    case "df": io.out("Filesystem     1K-blocks     Used Available Use% Mounted on\noverlay         61202244 18234120  39826740  32% /\n"); return 0;
    case "ping": case "nslookup": {
      // BusyBox : résolution par le DNS de Docker (réseaux utilisateur seulement).
      const host = a.filter((x) => !x.startsWith("-") && !/^\d+$/.test(x)).pop(); const t = d.resolveFrom(c, host);
      if (b === "nslookup") { if (!t) { io.out("Server:\t\t127.0.0.11\nAddress:\t127.0.0.11:53\n\n** server can't find " + host + ": NXDOMAIN\n\n"); return 1; } io.out("Server:\t\t127.0.0.11\nAddress:\t127.0.0.11:53\n\nNon-authoritative answer:\nName:\t" + host + "\nAddress: " + t.ip + "\n\n"); return 0; }
      if (!t) { io.err("ping: bad address '" + host + "'\n"); return 1; }
      const n = +(a[a.indexOf("-c") + 1] || 1) || 1; let o2 = "PING " + host + " (" + t.ip + "): 56 data bytes\n";
      for (let i = 0; i < n; i++) o2 += "64 bytes from " + t.ip + ": seq=" + i + " ttl=64 time=0.0" + (81 + i) + " ms\n";
      io.out(o2 + "\n--- " + host + " ping statistics ---\n" + n + " packets transmitted, " + n + " packets received, 0% packet loss\nround-trip min/avg/max = 0.081/0.081/0.081 ms\n"); return 0;
    }
    case "getent": { const t = d.resolveFrom(c, a[1]); if (!t) return 2; io.out(t.ip.padEnd(16) + a[1] + "\n"); return 0; }
    case "curl": case "wget": {
      const url = a.find((x) => /^https?:\/\/|^[\w.-]+(:\d+)?\//.test(x) && !x.startsWith("-")) || a.filter((x) => !x.startsWith("-")).pop();
      const m = /^(?:https?:\/\/)?([^/:]+)(?::(\d+))?(\/\S*)?/.exec(url || ""); if (!m) { io.err("curl: (3) URL using bad/illegal format or missing URL\n"); return 3; }
      const [, h, pt = "80", pa = "/"] = m;
      let r;
      if (h === "localhost" || h === "127.0.0.1") r = d.http(c, +pt, pa);
      else { const t = d.resolveFrom(c, h); if (!t) { io.err(b === "wget" ? "wget: bad address '" + h + "'\n" : "curl: (6) Could not resolve host: " + h + "\n"); return b === "wget" ? 1 : 6; } r = d.http(t.c, +pt, pa); if (r.error) r.error[1] = r.error[1].replace(t.c.name, h); }
      if (r.error) { io.err(b === "wget" ? "wget: can't connect to remote host: Connection refused\n" : "curl: (" + r.error[0] + ") " + r.error[1] + "\n"); return b === "wget" ? 1 : r.error[0]; }
      if (a.includes("-f") && r.status >= 400) { io.err("curl: (22) The requested URL returned error: " + r.status + "\n"); return 22; }
      io.out(r.body); return 0;
    }
    case "pg_isready": io.out("/var/run/postgresql:5432 - accepting connections\n"); return 0;
    case "redis-cli": io.out(a.includes("ping") || !a.length ? "PONG\n" : "OK\n"); return 0;
    case "psql": {
      const q = a[a.indexOf("-c") + 1] || ""; const u = a.includes("-U") ? a[a.indexOf("-U") + 1] : "postgres";
      if (c.pg && u !== c.pg.user && u !== "postgres") { io.err('psql: error: connection to server on socket "/var/run/postgresql/.s.PGSQL.5432" failed: FATAL:  role "' + u + '" does not exist\n'); return 2; }
      if (/^\s*select\s+1\s*;?\s*$/i.test(q)) { io.out(" ?column? \n----------\n        1\n(1 row)\n\n"); return 0; }
      if (/^\s*\\l/.test(q) || /\\l/.test(a.join(" "))) { io.out("                                 List of databases\n   Name    |  Owner   | Encoding\n-----------+----------+----------\n " + (c.pg ? c.pg.db : "postgres").padEnd(9) + " | " + (c.pg ? c.pg.user : "postgres").padEnd(8) + " | UTF8\n"); return 0; }
      io.err("(psql : seules SELECT 1 et \\l sont simulées ici)\n"); return 0;
    }
    case "python": case "python3": case "node": io.err("(" + b + " dans le conteneur : non simulé ici)\n"); return 0;
    default: io.err("(" + b + " dans le conteneur : non simulé ici)\n"); return 0;
  }
}
const modeStr = (m) => { let s = ""; for (let i = 8; i >= 0; i--) s += m & (1 << i) ? "rwx"[(8 - i) % 3] : "-"; return s; };

/* ---------- docker run ---------- */
const RUN_FLAGS = { "-d": "detach", "--detach": "detach", "-i": "interactive", "--interactive": "interactive", "-t": "tty", "--tty": "tty", "--rm": "rm", "--name": ["name"], "-p": ["ports", true], "--publish": ["ports", true], "-P": "publishAll", "--publish-all": "publishAll", "-e": ["env", true], "--env": ["env", true], "--env-file": ["envFiles", true], "-v": ["volumes", true], "--volume": ["volumes", true], "--mount": ["mounts", true], "--network": ["network"], "--net": ["network"], "--network-alias": ["aliases", true], "--restart": ["restart"], "-u": ["user"], "--user": ["user"], "-w": ["workdir"], "--workdir": ["workdir"], "--entrypoint": ["entrypoint"], "--health-cmd": ["healthCmd"], "--health-interval": ["healthInterval"], "-m": ["memory"], "--memory": ["memory"], "--cpus": ["cpus"], "--hostname": ["hostname"], "-h": ["hostname"], "--platform": ["platform"], "--init": "init", "-l": ["labels", true], "--label": ["labels", true], "--read-only": "readOnly", "--pull": ["pull"] };

function runSpec(sh, d, o, rest, io, quietPull) {
  if (!rest.length) throw new DockerErr('docker: "docker run" requires at least 1 argument.\nSee \'docker run --help\'.\n\nUsage:  docker run [OPTIONS] IMAGE [COMMAND] [ARG...]\n\nCreate and run a new container from an image', 1);
  const ref = rest[0];
  let img = d.image(ref);
  if (!img) {
    if (!quietPull) io.err("Unable to find image '" + canon(ref) + "' locally\n");
    const p = pullOut(d, ref, true); if (!p.ok) throw new DockerErr("docker: " + d.pullError(ref) + ".\n\nRun 'docker run --help' for more information", 125);
    if (!quietPull) io.err(p.text.replace(/\n[^\n]*\n$/, "\n"));
    img = d.image(ref);
  }
  if (o.restart && !/^(no|always|unless-stopped|on-failure(:\d+)?)$/.test(o.restart)) throw new DockerErr("docker: invalid restart policy '" + o.restart + "'.\nSee 'docker run --help'.", 125);
  if (o.rm && o.restart && o.restart !== "no") throw new DockerErr("docker: Conflicting options: --restart and --rm.\nSee 'docker run --help'.", 125);
  const env = {};
  for (const f of o.envFiles || []) Object.assign(env, envFile(sh, f));
  for (const e of o.env || []) { const i = e.indexOf("="); if (i < 0) { if (sh.exported.has(e)) env[e] = sh.vars.get(e); } else env[e.slice(0, i)] = e.slice(i + 1); }
  const ports = (o.ports || []).map(parsePort);
  if (o.publishAll) for (const p of img.exposes) if (!ports.some((x) => +x.container === p)) ports.push({ hostIp: "", host: "", container: String(p), proto: "tcp" });
  const mounts = (o.volumes || []).map((v) => parseMount(sh, v, false)).concat((o.mounts || []).map((v) => parseMount(sh, v, true)));
  for (const m of mounts) if (m.type === "volume" && !m.source) { m.source = hash("anon:" + d.seq + m.dest); m.labels = { anonymous: true }; }
  if (o.network && !["bridge", "host", "none"].includes(o.network) && !d.networks[o.network]) throw new DockerErr("docker: Error response from daemon: network " + o.network + " not found.", 125);
  const health = o.healthCmd ? { test: ["CMD-SHELL", o.healthCmd], interval: o.healthInterval || "30s" } : undefined;
  return d.create({ imageObj: img, imageRef: ref, name: o.name, cmd: rest.slice(1), entrypoint: o.entrypoint !== undefined ? (o.entrypoint ? [o.entrypoint] : []) : undefined, env, ports, mounts, network: o.network, restart: o.restart, user: o.user, workdir: o.workdir, rm: o.rm, healthcheck: health, aliases: o.aliases, labels: Object.fromEntries((o.labels || []).map((l) => l.split("="))) });
}
function pullOut(d, ref, fromRun = false) {
  const c = canon(ref); const had = d.image(ref);
  const img = had || d.pullBase(ref);
  if (!img) return { ok: false };
  const tag = c.slice(c.lastIndexOf(":") + 1); const repo = c.slice(0, c.lastIndexOf(":"));
  let t = (String(ref).includes(":") || fromRun ? "" : "Using default tag: latest\n") + tag + ": Pulling from " + (repo.includes("/") ? repo : "library/" + repo) + "\n";
  if (had) return { ok: true, text: (String(ref).includes(":") ? "" : "Using default tag: latest\n") + tag + ": Pulling from " + (repo.includes("/") ? repo : "library/" + repo) + "\nDigest: sha256:" + hash("digest:" + c) + "\nStatus: Image is up to date for " + c + "\n" + fullName(c) + "\n" };
  const nl = Math.max(1, Math.min(6, Math.round(Math.log2(d.size(img) / 1e6 + 2))));
  for (let i = 0; i < nl; i++) t += hash("layer" + c + i, 12) + ": Pull complete\n";
  return { ok: true, text: t + "Digest: sha256:" + hash("digest:" + c) + "\nStatus: Downloaded newer image for " + c + "\n" + fullName(c) + "\n" };
}

/* ---------- inspect ---------- */
function inspectObj(d, kind, x) {
  if (kind === "container") {
    const img = d.images[x.image];
    return { Id: x.id, Created: "2026-11-12T09:30:00Z", Path: [...(x.entrypoint || []), ...(x.cmd || [])][0] || "", Args: [...(x.entrypoint || []), ...(x.cmd || [])].slice(1),
      State: { Status: x.state, Running: x.state === "running", Restarting: x.state === "restarting", ExitCode: x.exitCode, ...(x.health ? { Health: { Status: x.health } } : {}) },
      Image: "sha256:" + x.image, Name: "/" + x.name, RestartCount: x.restarts,
      HostConfig: { RestartPolicy: { Name: x.restart.split(":")[0], MaximumRetryCount: +(x.restart.split(":")[1] || 0) }, PortBindings: Object.fromEntries(x.ports.map((p) => [p.container + "/" + p.proto, [{ HostIp: p.hostIp, HostPort: p.host }]])), Binds: x.mounts.filter((m) => m.type === "bind").map((m) => m.source + ":" + m.dest + (m.rw ? "" : ":ro")) },
      Mounts: x.mounts.map((m) => ({ Type: m.type, Name: m.type === "volume" ? m.source : undefined, Source: m.type === "volume" ? "/var/lib/docker/volumes/" + m.source + "/_data" : m.source, Destination: m.dest, RW: m.rw })),
      Config: { Hostname: x.id.slice(0, 12), User: x.user, Env: Object.entries(x.env).map(([k, v]) => k + "=" + v), Cmd: x.cmd, Entrypoint: x.entrypoint, Image: x.imageRef, WorkingDir: x.workdir, ExposedPorts: Object.fromEntries((img.exposes || []).map((p) => [p + "/tcp", {}])), Labels: x.labels, ...(x.healthcheck ? { Healthcheck: { Test: x.healthcheck.test } } : {}) },
      NetworkSettings: { Ports: Object.fromEntries(x.ports.map((p) => [p.container + "/" + p.proto, [{ HostIp: "0.0.0.0", HostPort: p.host }]])), Networks: Object.fromEntries(Object.entries(x.networks).map(([n, e]) => [n, { Aliases: e.aliases.length ? e.aliases : null, IPAddress: e.ip, Gateway: e.ip.replace(/\.\d+$/, ".1") }])) } };
  }
  if (kind === "image") return { Id: "sha256:" + x.id, RepoTags: x.tags, Created: "2026-11-12T09:30:00Z", Size: Math.round(d.size(x)), Config: { User: x.user, Env: Object.entries(x.env).map(([k, v]) => k + "=" + v), Cmd: x.cmd, Entrypoint: x.entrypoint, WorkingDir: x.workdir === "/" ? "" : x.workdir, ExposedPorts: Object.fromEntries((x.exposes || []).map((p) => [p + "/tcp", {}])), Labels: Object.keys(x.labels).length ? x.labels : null, ...(x.healthcheck ? { Healthcheck: { Test: x.healthcheck.test } } : {}), Volumes: x.volumes.length ? Object.fromEntries(x.volumes.map((v) => [v, {}])) : null }, Os: "linux", Architecture: "amd64", RootFS: { Type: "layers", Layers: x.layers.filter((l) => !l.meta).map((l, i) => "sha256:" + hash(x.id + i)) } };
  if (kind === "volume") return { CreatedAt: "2026-11-12T09:30:00Z", Driver: "local", Labels: x.labels.anonymous ? null : x.labels, Mountpoint: "/var/lib/docker/volumes/" + x.name + "/_data", Name: x.name, Options: null, Scope: "local" };
  return { Name: x.name, Id: x.id, Scope: "local", Driver: x.driver, IPAM: { Driver: "default", Config: x.subnet ? [{ Subnet: x.subnet + ".0/16", Gateway: x.subnet + ".1" }] : [] }, Containers: Object.fromEntries(d.containers.filter((c) => c.networks[x.name]).map((c) => [c.id, { Name: c.name, IPv4Address: c.networks[x.name].ip + "/16" }])), Labels: x.labels };
}
function goFmt(v) { if (v === null || v === undefined) return "<no value>"; if (Array.isArray(v)) return "[" + v.map(goFmt).join(" ") + "]"; if (typeof v === "object") return "map[" + Object.entries(v).map(([k, x]) => k + ":" + goFmt(x)).join(" ") + "]"; return String(v); }
export function template(fmt, obj) {
  return fmt.replace(/\\n/g, "\n").replace(/\{\{\s*(json\s+)?\.([\w.]*)\s*\}\}/g, (_, json, path) => { let v = obj; for (const k of path.split(".").filter(Boolean)) v = v == null ? undefined : v[k]; return json ? JSON.stringify(v ?? null) : goFmt(v); }).replace(/\{\{\s*json\s+\.\s*\}\}/g, () => JSON.stringify(obj));
}

/* ---------- la commande docker ---------- */
function dockerCmd(sh, args, io) {
  if (!sh.docker) { io.err("Command 'docker' not found, but can be installed with:\nsudo snap install docker         # version 27.2.0, or\nsudo apt  install docker.io      # version 26.1.3-0ubuntu1~24.04.1\nsudo apt  install podman-docker  # version 4.9.3+ds1-1ubuntu0.2\nSee 'snap info <snapname>' for additional versions.\n"); return 127; }
  const d = sh.docker;
  if (args[0] === "--version" || args[0] === "-v") { io.out("Docker version 27.4.1, build b9d17ea\n"); return 0; }
  if (sh.user !== "root" && !sh.fs.groupsOf(sh.user).includes("docker")) { io.err("permission denied while trying to connect to the Docker daemon socket at unix:///var/run/docker.sock: Head \"http://%2Fvar%2Frun%2Fdocker.sock/_ping\": dial unix /var/run/docker.sock: connect: permission denied\n"); return 1; }
  d.tick(); d.settle();
  try { return dispatch(sh, d, args, io); }
  catch (e) { if (e instanceof DockerErr) { io.err(e.message + "\n"); return e.code; } if (e instanceof DockerfileError) { io.err("ERROR: " + e.message + "\n"); return 1; } throw e; }
}

function dispatch(sh, d, args, io) {
  let [sub, ...a] = args;
  const MGMT = { container: { ls: "ps", list: "ps", rm: "rm", run: "run", start: "start", stop: "stop", logs: "logs", exec: "exec", inspect: "inspect", prune: "container-prune", create: "create", restart: "restart", kill: "kill", port: "port", cp: "cp" }, image: { ls: "images", list: "images", rm: "rmi", build: "build", pull: "pull", push: "push", tag: "tag", inspect: "inspect", history: "history", prune: "image-prune" }, builder: { build: "build", prune: "builder-prune" }, buildx: { build: "build", b: "build" } };
  if (MGMT[sub]) { const m = MGMT[sub][a[0]]; if (!m) { io.err("docker: '" + sub + " " + (a[0] || "") + "' n'est pas simulé ici.\n"); return 1; } [sub, a] = [m, a.slice(1)]; }
  switch (sub) {
    case undefined: case "--help": case "help": io.out("Usage:  docker [OPTIONS] COMMAND\n\nA self-sufficient runtime for containers\n\nCommon Commands:\n  run         Create and run a new container from an image\n  exec        Execute a command in a running container\n  ps          List containers\n  build       Build an image from a Dockerfile\n  pull        Download an image from a registry\n  push        Upload an image to a registry\n  images      List images\n  login       Authenticate to a registry\n  version     Show the Docker version information\n\nManagement Commands:\n  compose*    Docker Compose\n  container   Manage containers\n  image       Manage images\n  network     Manage networks\n  volume      Manage volumes\n  system      Manage Docker\n"); return 0;
    case "version": io.out("Client: Docker Engine - Community\n Version:           27.4.1\n API version:       1.47\n OS/Arch:           linux/amd64\n\nServer: Docker Engine - Community\n Engine:\n  Version:          27.4.1\n  API version:      1.47 (minimum version 1.24)\n containerd:\n  Version:          1.7.24\n runc:\n  Version:          1.2.2\n"); return 0;
    case "info": io.out("Client: Docker Engine - Community\n Version:    27.4.1\n Context:    default\n\nServer:\n Containers: " + d.containers.length + "\n  Running: " + d.containers.filter((c) => c.state === "running").length + "\n  Stopped: " + d.containers.filter((c) => c.state !== "running").length + "\n Images: " + Object.keys(d.images).length + "\n Server Version: 27.4.1\n Storage Driver: overlay2\n Cgroup Driver: systemd\n Kernel Version: 6.8.0-49-generic\n Operating System: Ubuntu 24.04.1 LTS\n"); return 0;
    case "build": return doBuild(sh, d, a, io);
    case "compose": return compose(sh, d, a, io);
    case "images": {
      const { o, rest } = parseOpts(a, { "-a": "all", "--all": "all", "-q": "quiet", "--quiet": "quiet", "--format": ["format"] });
      let list = Object.values(d.images).sort((x, y) => y.created - x.created);
      const rows = [];
      for (const i of list) { const tags = i.tags.length ? i.tags : ["<none>:<none>"]; for (const t of tags) { const [r, tg] = t === "<none>:<none>" ? ["<none>", "<none>"] : [t.slice(0, t.lastIndexOf(":")), t.slice(t.lastIndexOf(":") + 1)]; if (rest[0] && r !== rest[0].split(":")[0]) continue; rows.push([r, tg, i.id.slice(0, 12), ago(d, i.created), human(d.size(i))]); } }
      if (o.quiet) { io.out([...new Set(rows.map((r) => r[2]))].join("\n") + (rows.length ? "\n" : "")); return 0; }
      if (o.format) { io.out(rows.map((r) => template(o.format, { Repository: r[0], Tag: r[1], ID: r[2], CreatedSince: r[3], Size: r[4] })).join("\n") + "\n"); return 0; }
      io.out(table(["REPOSITORY", "TAG", "IMAGE ID", "CREATED", "SIZE"], rows)); return 0;
    }
    case "ps": {
      const { o } = parseOpts(a, { "-a": "all", "--all": "all", "-q": "quiet", "--quiet": "quiet", "--format": ["format"], "-f": ["filter", true], "--filter": ["filter", true], "-n": ["last"], "-l": "latest", "-s": "size", "--no-trunc": "noTrunc" });
      let list = d.containers.filter((c) => o.all || c.state === "running" || c.state === "restarting").slice().reverse();
      for (const f of o.filter || []) { const [k, v] = f.split("="); list = list.filter((c) => (k === "status" ? c.state === v : k === "name" ? c.name.includes(v) : k === "label" ? (v.includes("=") ? c.labels[v.split("=")[0]] === v.split("=")[1] : v in c.labels) : true)); }
      if (o.quiet) { io.out(list.map((c) => c.id.slice(0, 12) + "\n").join("")); return 0; }
      if (o.format) { io.out(list.map((c) => template(o.format, { ID: c.id.slice(0, 12), Names: c.name, Image: imgName(d, c), Status: status(d, c), Ports: portsStr(c), State: c.state, Command: cmdLine(c) })).join("\n") + (list.length ? "\n" : "")); return 0; }
      io.out(table(["CONTAINER ID", "IMAGE", "COMMAND", "CREATED", "STATUS", "PORTS", "NAMES"], list.map((c) => [c.id.slice(0, 12), imgName(d, c), cmdLine(c), ago(d, c.created), status(d, c), portsStr(c), c.name]))); return 0;
    }
    case "run": case "create": {
      const { o, rest } = parseOpts(a, RUN_FLAGS);
      const c = runSpec(sh, d, o, rest, io);
      if (sub === "create") { io.out(c.id + "\n"); return 0; }
      try { d.start(c); } catch (e) { if (o.rm) d.remove(c); throw e; }
      d.checkHealth(c);
      const interactiveShell = o.interactive && o.tty && ["sh", "bash", "ash", "/bin/sh", "/bin/bash"].includes([...(c.entrypoint || []), ...(c.cmd || [])][0]);
      if (interactiveShell) { io.err("(shell interactif dans le conteneur : non simulé ici. Utilise docker run --rm IMAGE commande, ou docker exec.)\n"); d.stop(c); c.exitCode = 0; if (o.rm) d.remove(c); return 0; }
      if (o.detach) { io.out(c.id + "\n"); return 0; }
      io.out(c.logs.map((l) => l + "\n").join(""));
      if (c.state === "running") { io.err("(conteneur lancé au premier plan : dans un vrai terminal, il garde la main jusqu'à Ctrl+C. Ici il continue en arrière-plan ; utilise -d.)\n"); return 0; }
      const code = c.exitCode; if (o.rm) d.remove(c); return code;
    }
    case "start": case "restart": case "stop": case "kill": {
      const { rest } = parseOpts(a, { "-a": "attach", "-i": "interactive", "-t": ["time"], "--time": ["time"], "-s": ["signal"] }, { stopAtFirst: false });
      if (!rest.length) throw new DockerErr('docker: "docker ' + sub + '" requires at least 1 argument.\nSee \'docker ' + sub + " --help'.", 1);
      let code = 0;
      for (const r of rest) {
        const c = d.container(r, { must: false }); if (!c) { io.err("Error response from daemon: No such container: " + r + "\n"); code = 1; continue; }
        if (sub === "stop" || sub === "restart" || sub === "kill") { d.stop(c); if (sub === "kill") c.exitCode = 137; else if (c.exitCode === 0 && c.app) c.exitCode = 0; if (c.rm && sub !== "restart") d.remove(c); }
        if (sub === "start" || sub === "restart") { c.manualStop = false; try { d.start(c); d.checkHealth(c); } catch (e) { io.err((e.message || "").replace(/^docker: /, "") + "\nError: failed to start containers: " + r + "\n"); code = 1; continue; } }
        io.out(r + "\n");
      }
      return code;
    }
    case "rm": {
      const { o, rest } = parseOpts(a, { "-f": "force", "--force": "force", "-v": "volumes", "--volumes": "volumes" }, { stopAtFirst: false });
      if (!rest.length) throw new DockerErr('docker: "docker rm" requires at least 1 argument.\nSee \'docker rm --help\'.', 1);
      let code = 0;
      for (const r of rest) {
        const c = d.container(r, { must: false }); if (!c) { io.err("Error response from daemon: No such container: " + r + "\n"); code = 1; continue; }
        if ((c.state === "running" || c.state === "restarting") && !o.force) { io.err('Error response from daemon: cannot remove container "/' + c.name + '": container is running: stop the container before removing or force remove\n'); code = 1; continue; }
        d.stop(c); d.remove(c);
        if (o.volumes) for (const m of c.mounts) if (m.type === "volume" && d.volumes[m.source] && d.volumes[m.source].labels.anonymous) delete d.volumes[m.source];
        io.out(r + "\n");
      }
      return code;
    }
    case "logs": {
      const { o, rest } = parseOpts(a, { "-f": "follow", "--follow": "follow", "-n": ["tail"], "--tail": ["tail"], "-t": "timestamps", "--timestamps": "timestamps", "--since": ["since"] });
      if (!rest[0]) throw new DockerErr('docker: "docker logs" requires exactly 1 argument.\nSee \'docker logs --help\'.', 1);
      const c = d.container(rest[0]);
      let l = c.logs; if (o.tail !== undefined && o.tail !== "all") l = l.slice(-+o.tail);
      io.out(l.map((x) => (o.timestamps ? "2026-11-12T09:30:00.000000000Z " : "") + x + "\n").join(""));
      if (o.follow) io.err("(-f suit le journal en continu sur une vraie machine ; ici on affiche ce qui est déjà écrit.)\n");
      return 0;
    }
    case "exec": {
      const { o, rest } = parseOpts(a, { "-i": "interactive", "-t": "tty", "-d": "detach", "-u": ["user"], "--user": ["user"], "-w": ["workdir"], "--workdir": ["workdir"], "-e": ["env", true], "--env": ["env", true] });
      if (rest.length < 2) throw new DockerErr('docker: "docker exec" requires at least 2 arguments.\nSee \'docker exec --help\'.\n\nUsage:  docker exec [OPTIONS] CONTAINER COMMAND [ARG...]\n\nExecute a command in a running container', 1);
      const c = d.container(rest[0]);
      return execIn(sh, d, c, rest.slice(1), io, o);
    }
    case "port": { const c = d.container(a[0]); io.out(c.state !== "running" ? "" : c.ports.flatMap((p) => [p.container + "/" + p.proto + " -> " + (p.hostIp || "0.0.0.0") + ":" + p.host, ...(p.hostIp ? [] : [p.container + "/" + p.proto + " -> [::]:" + p.host])]).join("\n") + (c.ports.length && c.state === "running" ? "\n" : "")); return 0; }
    case "cp": {
      const [src, dst] = a; if (!src || !dst) throw new DockerErr('docker: "docker cp" requires exactly 2 arguments.', 1);
      const cs = /^([\w.-]+):(.+)$/;
      if (cs.test(src)) { const [, n, p] = cs.exec(src); const c = d.container(n); const f = d.readFile(c, p); if (!f) throw new DockerErr("Error response from daemon: Could not find the file " + p + " in container " + n, 1); let out = sh.abs(dst); try { if (sh.fs.lookup(out, { user: sh.user }).node.t === "d") out += "/" + p.split("/").pop(); } catch (e) { /* nouveau fichier */ } sh.fs.write(out, f.data, sh.user); io.out("Successfully copied " + human(f.data.length).replace("B", "B") + " to " + out + "\n"); return 0; }
      const [, n, p] = cs.exec(dst) || []; if (!n) throw new DockerErr("must specify at least one container source", 1);
      const c = d.container(n); let data; try { data = sh.fs.read(sh.abs(src), sh.user); } catch (e) { throw new DockerErr("lstat " + sh.abs(src) + ": no such file or directory", 1); }
      d.writeFile(c, p.endsWith("/") ? p + src.split("/").pop() : p, data); io.out("Successfully copied " + human(data.length) + " to " + n + ":" + p + "\n"); return 0;
    }
    case "pull": {
      if (!a[0]) throw new DockerErr('docker: "docker pull" requires exactly 1 argument.\nSee \'docker pull --help\'.', 1);
      const r = pullOut(d, a[0]); if (!r.ok) throw new DockerErr(d.pullError(a[0]), 1);
      io.out(r.text); return 0;
    }
    case "tag": {
      if (a.length !== 2) throw new DockerErr('docker: "docker tag" requires exactly 2 arguments.\nSee \'docker tag --help\'.', 1);
      const img = d.image(a[0]); if (!img) throw new DockerErr("Error response from daemon: No such image: " + canon(a[0]), 1);
      d.tag(img.id, a[1]); return 0;
    }
    case "rmi": {
      const { o, rest } = parseOpts(a, { "-f": "force", "--force": "force" }, { stopAtFirst: false }); let code = 0;
      for (const r of rest) {
        const img = d.image(r); if (!img) { io.err("Error response from daemon: No such image: " + canon(r) + "\n"); code = 1; continue; }
        const c = canon(r); const byTag = img.tags.includes(c);
        if (byTag && img.tags.length > 1) { img.tags = img.tags.filter((t) => t !== c); delete d.tags[c]; io.out("Untagged: " + c + "\n"); continue; }
        const users = d.usedBy(img);
        if (users.length && !o.force) { io.err('Error response from daemon: conflict: unable to remove repository reference "' + r + '" (must force) - container ' + users[0].id.slice(0, 12) + " is using its referenced image " + img.id.slice(0, 12) + "\n"); code = 1; continue; }
        for (const t of img.tags) { delete d.tags[t]; io.out("Untagged: " + t + "\n"); }
        img.tags = [];
        if (!users.length) { delete d.images[img.id]; io.out("Deleted: sha256:" + img.id + "\n"); }
      }
      return code;
    }
    case "history": {
      const { o, rest } = parseOpts(a, { "--no-trunc": "noTrunc", "-H": "human", "-q": "quiet" });
      const img = d.image(rest[0] || ""); if (!img) throw new DockerErr("Error response from daemon: No such image: " + canon(rest[0] || ""), 1);
      const rows = img.layers.slice().reverse().map((l, i) => { const cb = l.createdBy.replace(/ # buildkit$/, ""); const s = o.noTrunc || cb.length <= 45 ? cb : cb.slice(0, 44) + "…"; return [i === 0 ? img.id.slice(0, 12) : "<missing>", l.base ? "3 weeks ago" : ago(d, img.created), s, human(l.size).replace(/^0B$/, "0B"), l.base ? "" : "buildkit.dockerfile.v0"]; });
      io.out(table(["IMAGE", "CREATED", "CREATED BY", "SIZE", "COMMENT"], rows)); return 0;
    }
    case "inspect": {
      const { o, rest } = parseOpts(a, { "-f": ["format"], "--format": ["format"], "--type": ["type"], "-s": "size" }, { stopAtFirst: false });
      const objs = [];
      for (const r of rest) {
        const c = (!o.type || o.type === "container") && d.container(r, { must: false }); const img = !c && (!o.type || o.type === "image") && d.image(r);
        const vol = !c && !img && (!o.type || o.type === "volume") && d.volumes[r]; const net = !c && !img && !vol && d.networks[r];
        if (c) objs.push(inspectObj(d, "container", c)); else if (img) objs.push(inspectObj(d, "image", img)); else if (vol) objs.push(inspectObj(d, "volume", vol)); else if (net) objs.push(inspectObj(d, "network", net));
        else { io.out("[]\n"); io.err("Error: No such object: " + r + "\n"); return 1; }
      }
      io.out(o.format ? objs.map((x) => template(o.format, x)).join("\n") + "\n" : JSON.stringify(objs, null, 4) + "\n"); return 0;
    }
    case "login": {
      const { o, rest } = parseOpts(a, { "-u": ["user"], "--username": ["user"], "-p": ["password"], "--password": ["password"], "--password-stdin": "stdin" });
      const reg = rest[0] || "docker.io";
      if (o.password) io.err("WARNING! Using --password via the CLI is insecure. Use --password-stdin.\n");
      if (o.stdin && !(io.stdin || "").trim()) throw new DockerErr("Error: Password Required", 1);
      if (!o.user || (!o.stdin && !o.password)) { io.err("(connexion interactive non simulée : utilise  echo \"$TOKEN\" | docker login -u " + (o.user || "utilisateur") + " --password-stdin" + (rest[0] ? " " + rest[0] : "") + ")\n"); return 1; }
      d.logins[reg] = o.user;
      io.out("\nLogin Succeeded\n"); return 0;
    }
    case "logout": { const reg = a[0] || "docker.io"; delete d.logins[reg]; io.out("Removing login credentials for " + (reg === "docker.io" ? "https://index.docker.io/v1/" : reg) + "\n"); return 0; }
    case "push": {
      if (!a[0]) throw new DockerErr('docker: "docker push" requires exactly 1 argument.\nSee \'docker push --help\'.', 1);
      const c = canon(a[0]); const img = d.image(a[0]); if (!img) throw new DockerErr("An image does not exist locally with the tag: " + a[0].replace(/:latest$/, ""), 1);
      const fn = fullName(c); const repo = fn.slice(0, fn.lastIndexOf(":")); const reg = fn.split("/")[0];
      const ns = fn.split("/")[1];
      io.out("The push refers to repository [" + repo + "]\n");
      const layers = img.layers.filter((l) => !l.meta).map((l, i) => hash(img.id + i, 12));
      const user = d.logins[reg === "docker.io" ? "docker.io" : reg];
      if (!user || ns === "library" || (reg === "docker.io" && ns !== user) || (reg === "ghcr.io" && ns !== user)) {
        io.out(layers.slice(0, 3).map((l) => l + ": Preparing\n").join(""));
        io.err(reg === "ghcr.io" && !user ? "unauthorized: unauthenticated: User cannot be authenticated with the token provided.\n" : "denied: requested access to the resource is denied\n"); return 1;
      }
      io.out(layers.reverse().map((l, i) => l + ": " + (i < layers.length - 2 ? "Pushed" : "Mounted from library/" + img.base.split(":")[0]) + "\n").join("") + c.slice(c.lastIndexOf(":") + 1) + ": digest: sha256:" + hash("push" + img.id) + " size: " + (1200 + layers.length * 210) + "\n");
      d.registry[c] = { ...JSON.parse(JSON.stringify(img)), tags: [] };
      return 0;
    }
    case "volume": return volumeCmd(sh, d, a, io);
    case "network": return networkCmd(sh, d, a, io);
    case "system": case "container-prune": case "image-prune": case "builder-prune": return pruneCmd(sh, d, sub === "system" ? a : [sub.split("-")[0], ...a], io);
    case "stats": io.out(table(["CONTAINER ID", "NAME", "CPU %", "MEM USAGE / LIMIT", "MEM %", "NET I/O", "BLOCK I/O", "PIDS"], d.containers.filter((c) => c.state === "running").map((c, i) => [c.id.slice(0, 12), c.name, (0.1 + i * 0.37).toFixed(2) + "%", (c.listen && c.listen.kind === "postgres" ? "38.6MiB" : "52.3MiB") + " / 7.6GiB", "0.67%", "1.2kB / 0B", "0B / 0B", "4"]))); if (!a.includes("--no-stream")) io.err("(docker stats se met à jour en continu sur une vraie machine ; ici, une seule mesure. Utilise --no-stream.)\n"); return 0;
    case "top": { const c = d.container(a[0]); io.out(table(["UID", "PID", "PPID", "C", "STIME", "TTY", "TIME", "CMD"], [[c.user || "root", "4321", "4300", "0", "09:30", "?", "00:00:00", [...(c.entrypoint || []), ...(c.cmd || [])].join(" ")]])); return 0; }
    default: io.err("docker: '" + sub + "' is not a docker command.\nSee 'docker --help'\n"); return 1;
  }
}

function volumeCmd(sh, d, a, io) {
  const [sub, ...r] = a;
  switch (sub) {
    case "create": { const name = r.find((x) => !x.startsWith("-")) || hash("vol" + d.seq++); d.addVolume(name); io.out(name + "\n"); return 0; }
    case "ls": case "list": { const q = r.includes("-q"); const vs = Object.values(d.volumes).sort((x, y) => x.name.localeCompare(y.name)); io.out(q ? vs.map((v) => v.name + "\n").join("") : table(["DRIVER", "VOLUME NAME"], vs.map((v) => ["local", v.name]))); return 0; }
    case "inspect": { const v = d.volumes[r[0]]; if (!v) { io.out("[]\n"); io.err("Error response from daemon: get " + r[0] + ": no such volume\n"); return 1; } io.out(JSON.stringify([inspectObj(d, "volume", v)], null, 4) + "\n"); return 0; }
    case "rm": case "remove": { let code = 0; for (const n of r.filter((x) => !x.startsWith("-"))) { if (!d.volumes[n]) { io.err("Error response from daemon: get " + n + ": no such volume\n"); code = 1; continue; } const u = d.containers.find((c) => c.mounts.some((m) => m.source === n)); if (u) { io.err("Error response from daemon: remove " + n + ": volume is in use - [" + u.id + "]\n"); code = 1; continue; } delete d.volumes[n]; io.out(n + "\n"); } return code; }
    case "prune": { if (!r.includes("-f") && !r.includes("--force")) { io.out("WARNING! This will remove anonymous local volumes not used by at least one container.\nAre you sure you want to continue? [y/N] \n"); io.err("(confirmation interactive non simulée : ajoute -f)\n"); return 1; } const all = r.includes("-a") || r.includes("--all"); const del = Object.values(d.volumes).filter((v) => (all || v.labels.anonymous) && !d.containers.some((c) => c.mounts.some((m) => m.source === v.name))); for (const v of del) delete d.volumes[v.name]; io.out((del.length ? "Deleted Volumes:\n" + del.map((v) => v.name + "\n").join("") + "\n" : "") + "Total reclaimed space: " + (del.length ? "47.2MB" : "0B") + "\n"); return 0; }
    default: io.err("Usage:  docker volume COMMAND\n\nManage volumes\n\nCommands:\n  create      Create a volume\n  inspect     Display detailed information on one or more volumes\n  ls          List volumes\n  prune       Remove unused local volumes\n  rm          Remove one or more volumes\n"); return sub ? 1 : 0;
  }
}
function networkCmd(sh, d, a, io) {
  const [sub, ...r] = a;
  switch (sub) {
    case "create": { const { o, rest } = parseOpts(r, { "-d": ["driver"], "--driver": ["driver"], "--subnet": ["subnet"], "--label": ["labels", true] }); if (!rest[0]) throw new DockerErr('docker: "docker network create" requires exactly 1 argument.', 1); const n = d.addNetwork(rest[0], o.driver || "bridge"); io.out(n.id + "\n"); return 0; }
    case "ls": case "list": { const q = r.includes("-q"); const ns = Object.values(d.networks); io.out(q ? ns.map((n) => n.id.slice(0, 12) + "\n").join("") : table(["NETWORK ID", "NAME", "DRIVER", "SCOPE"], ns.map((n) => [n.id.slice(0, 12), n.name, n.driver, "local"]))); return 0; }
    case "inspect": { const n = d.network(r.find((x) => !x.startsWith("-"))); const f = r.indexOf("-f") >= 0 ? r[r.indexOf("-f") + 1] : r.find((x) => x.startsWith("--format=")); const obj = inspectObj(d, "network", n); io.out(f ? template(f.replace(/^--format=/, ""), obj) + "\n" : JSON.stringify([obj], null, 4) + "\n"); return 0; }
    case "rm": case "remove": { let code = 0; for (const x of r) { const n = d.networks[x]; if (!n) { io.err("Error response from daemon: network " + x + " not found\n"); code = 1; continue; } if (!n.user) { io.err("Error response from daemon: " + x + " is a pre-defined network and cannot be removed\n"); code = 1; continue; } const u = d.containers.filter((c) => c.networks[x] && c.state === "running"); if (u.length) { io.err("Error response from daemon: error while removing network: network " + x + " id " + n.id + " has active endpoints\n"); code = 1; continue; } for (const c of d.containers) delete c.networks[x]; delete d.networks[x]; io.out(x + "\n"); } return code; }
    case "connect": { const { o, rest } = parseOpts(r, { "--alias": ["aliases", true] }); const c = d.container(rest[1]); d.connect(c, rest[0], o.aliases || []); return 0; }
    case "disconnect": { const c = d.container(r[1]); delete c.networks[r[0]]; return 0; }
    case "prune": { const del = Object.values(d.networks).filter((n) => n.user && !d.containers.some((c) => c.networks[n.name])); for (const n of del) delete d.networks[n.name]; io.out(del.length ? "Deleted Networks:\n" + del.map((n) => n.name + "\n").join("") : ""); return 0; }
    default: io.err("Usage:  docker network COMMAND\n\nManage networks\n\nCommands:\n  connect     Connect a container to a network\n  create      Create a network\n  disconnect  Disconnect a container from a network\n  inspect     Display detailed information on one or more networks\n  ls          List networks\n  prune       Remove all unused networks\n  rm          Remove one or more networks\n"); return sub ? 1 : 0;
  }
}
function pruneCmd(sh, d, a, io) {
  const [what, ...r] = a; const force = r.includes("-f") || r.includes("--force"); const all = r.includes("-a") || r.includes("--all");
  if (what === "df") {
    const imgs = Object.values(d.images); const active = imgs.filter((i) => d.usedBy(i).length); const sz = (l) => l.reduce((s, i) => s + d.size(i), 0);
    const cache = Object.keys(d.cache).length; const vols = Object.values(d.volumes);
    io.out(table(["TYPE", "TOTAL", "ACTIVE", "SIZE", "RECLAIMABLE"], [["Images", imgs.length, active.length, human(sz(imgs)), human(sz(imgs) - sz(active)) + " (" + (imgs.length ? Math.round(100 * (1 - sz(active) / (sz(imgs) || 1))) : 0) + "%)"], ["Containers", d.containers.length, d.containers.filter((c) => c.state === "running").length, "0B", "0B"], ["Local Volumes", vols.length, vols.filter((v) => d.containers.some((c) => c.mounts.some((m) => m.source === v.name))).length, human(vols.length * 47.2e6), "0B (0%)"], ["Build Cache", cache, 0, human(cache * 12.5e6), human(cache * 12.5e6)]]));
    return 0;
  }
  const warn = { container: "WARNING! This will remove all stopped containers.", image: all ? "WARNING! This will remove all images without at least one container associated to them." : "WARNING! This will remove all dangling images.", builder: "WARNING! This will remove all dangling build cache.", prune: "WARNING! This will remove:\n  - all stopped containers\n  - all networks not used by at least one container\n  - all dangling images\n  - unused build cache" }[what];
  if (!warn) { io.err("Usage:  docker system COMMAND\n\nManage Docker\n\nCommands:\n  df          Show docker disk usage\n  prune       Remove unused data\n"); return 1; }
  if (!force) { io.out(warn + "\nAre you sure you want to continue? [y/N] \n"); io.err("(confirmation interactive non simulée : ajoute -f)\n"); return 1; }
  let out = "", freed = 0;
  if (what === "container" || what === "prune") { const del = d.containers.filter((c) => c.state !== "running" && c.state !== "restarting"); for (const c of del) d.remove(c); if (del.length) out += "Deleted Containers:\n" + del.map((c) => c.id + "\n").join("") + "\n"; }
  if (what === "prune") { const del = Object.values(d.networks).filter((n) => n.user && !d.containers.some((c) => c.networks[n.name])); for (const n of del) delete d.networks[n.name]; if (del.length) out += "Deleted Networks:\n" + del.map((n) => n.name + "\n").join("") + "\n"; }
  if (what === "image" || what === "prune") { const del = Object.values(d.images).filter((i) => !d.usedBy(i).length && (all || !i.tags.length)); for (const i of del) { freed += d.size(i); for (const t of i.tags) delete d.tags[t]; delete d.images[i.id]; } if (del.length) out += "Deleted Images:\n" + del.map((i) => (i.tags.length ? i.tags.map((t) => "untagged: " + t + "\n").join("") : "") + "deleted: sha256:" + i.id + "\n").join("") + "\n"; }
  if (what === "builder" || what === "prune") { const n = Object.keys(d.cache).length; freed += n * 12.5e6; d.cache = {}; if (n) out += "Deleted build cache objects:\n" + Array.from({ length: Math.min(n, 5) }, (_, i) => hash("cache" + i, 25) + "\n").join("") + "\n"; }
  io.out(out + "Total reclaimed space: " + human(freed) + "\n"); return 0;
}

/* ---------- hadolint ---------- */
function hadolintCmd(sh, args, io) {
  if (!sh.docker) { io.err("Command 'hadolint' not found\n"); return 127; }
  const files = args.filter((x) => !x.startsWith("-")); const ignore = []; args.forEach((x, i) => { if (x === "--ignore") ignore.push(args[i + 1]); });
  const list = files.length ? files : ["Dockerfile"]; let found = 0;
  for (const f of list) {
    if (ignore.includes(f)) continue;
    let text; try { text = sh.fs.read(sh.abs(f), sh.user); } catch (e) { io.err("hadolint: " + f + ": openBinaryFile: does not exist (No such file or directory)\n"); return 1; }
    let res; try { res = lint(text); } catch (e) { if (e instanceof DockerfileError) { io.out(f + ":" + e.line + " DL1000 error: " + e.message + "\n"); return 1; } throw e; }
    res = res.filter((x) => !ignore.includes(x.code));
    found += res.length; io.out(res.map((x) => f + ":" + x.line + " " + x.code + " " + x.level + ": " + x.message + "\n").join(""));
  }
  return found ? 1 : 0;
}

/* ---------- critères ---------- */
const findImg = (d, ref) => d && d.image(ref);
EXTRA_CHECKS.images = (sh, v, push) => {
  const d = sh.docker;
  for (const [ref, spec] of Object.entries(v)) {
    const img = findImg(d, ref);
    if (spec === null) { push(!img, "L'image " + ref + " n'existe pas"); continue; }
    push(!!img, "L'image " + ref + " existe");
    if (!img) continue;
    if (spec.maxMB !== undefined) push(d.size(img) <= spec.maxMB * 1e6, "L'image " + ref + " pèse au plus " + spec.maxMB + " Mo (" + human(d.size(img)) + ")");
    if (spec.base !== undefined) push(img.base === canon(spec.base), "L'image " + ref + " part de " + spec.base);
    if (spec.nonRoot) push(img.user && !/^(root|0)(:|$)/.test(img.user), "L'image " + ref + " tourne avec un utilisateur non root");
    if (spec.user !== undefined) push(img.user === spec.user, "L'image " + ref + " tourne en tant que " + spec.user);
    if (spec.exposes) for (const p of spec.exposes) push(img.exposes.includes(p), "L'image " + ref + " déclare le port " + p);
    if (spec.healthcheck) push(!!img.healthcheck, "L'image " + ref + " a un HEALTHCHECK");
    if (spec.jsonCmd) push(!img.cmd || img.cmd[0] !== "/bin/sh" || img.cmd[1] !== "-c", "Le CMD de " + ref + " est en forme JSON");
    if (spec.hasFile) for (const f of [].concat(spec.hasFile)) push(!!img.files[f], "L'image " + ref + " contient " + f);
    if (spec.lacksFile) for (const f of [].concat(spec.lacksFile)) push(!Object.keys(img.files).some((k) => k === f || k.startsWith(f.replace(/\/$/, "") + "/")), "L'image " + ref + " ne contient pas " + f);
    if (spec.pip) for (const p of spec.pip) push(img.pip.includes(p), "Le paquet Python " + p + " est installé dans " + ref);
    if (spec.lacksBin) for (const b of spec.lacksBin) push(!img.bins.includes(b), "L'image " + ref + " ne contient pas " + b);
  }
};
EXTRA_CHECKS.containers = (sh, v, push) => {
  const d = sh.docker; d.settle();
  for (const [name, spec] of Object.entries(v)) {
    const c = d && d.container(name, { must: false });
    if (spec === null) { push(!c, "Le conteneur " + name + " n'existe plus"); continue; }
    push(!!c, "Le conteneur " + name + " existe"); if (!c) continue;
    if (spec.state) push(c.state === spec.state, "Le conteneur " + name + " est " + ({ running: "démarré", exited: "arrêté", restarting: "en redémarrage" })[spec.state]);
    if (spec.image) push(d.image(spec.image) && d.image(spec.image).id === c.image, "Le conteneur " + name + " utilise l'image " + spec.image);
    if (spec.ports) for (const p of spec.ports) { const [h, ct] = p.split(":"); push(c.ports.some((x) => x.host === h && x.container === ct), "Le conteneur " + name + " publie le port " + ct + " sur " + h); }
    if (spec.env) for (const [k, val] of Object.entries(spec.env)) push(c.env[k] === val, "Le conteneur " + name + " a " + k + "=" + val);
    if (spec.envSet) for (const k of spec.envSet) push(!!c.env[k], "Le conteneur " + name + " reçoit la variable " + k);
    if (spec.restart) push(c.restart === spec.restart, "Le conteneur " + name + " a la politique de redémarrage " + spec.restart);
    if (spec.network) push(!!c.networks[spec.network], "Le conteneur " + name + " est sur le réseau " + spec.network);
    if (spec.volume) for (const [vol, dest] of Object.entries(spec.volume)) push(c.mounts.some((m) => m.type === "volume" && m.source === vol && m.dest === dest), "Le volume " + vol + " est monté sur " + dest + " dans " + name);
    if (spec.bind) for (const [src, dest] of Object.entries(spec.bind)) push(c.mounts.some((m) => m.type === "bind" && m.source === src && m.dest === dest), "Le dossier " + src + " est monté sur " + dest + " dans " + name);
    if (spec.readOnly) for (const dest of spec.readOnly) push(c.mounts.some((m) => m.dest === dest && !m.rw), dest + " est monté en lecture seule dans " + name);
    if (spec.health) push(c.health === spec.health, "Le conteneur " + name + " est « " + spec.health + " »");
    if (spec.user !== undefined) push((c.user || "root") === spec.user, "Le conteneur " + name + " tourne en tant que " + spec.user);
  }
};
EXTRA_CHECKS.volumes = (sh, v, push) => { for (const n of v) push(!!sh.docker.volumes[n], "Le volume " + n + " existe"); };
EXTRA_CHECKS.noVolumes = (sh, v, push) => { for (const n of v) push(!sh.docker.volumes[n], "Le volume " + n + " n'existe plus"); };
EXTRA_CHECKS.networks = (sh, v, push) => { for (const n of v) push(!!sh.docker.networks[n], "Le réseau " + n + " existe"); };
EXTRA_CHECKS.pushed = (sh, v, push) => { for (const r of v) push(!!sh.docker.registry[canon(r)], "L'image " + r + " est publiée dans le registre"); };
EXTRA_CHECKS.http = (sh, v, push) => {
  sh.docker && sh.docker.settle();
  for (const [url, exp] of Object.entries(v)) {
    const r = httpFor(sh, url); const [st, body] = [].concat(exp);
    push(!r.error && r.status === st && (body === undefined || (r.body || "").includes(body)), url + " répond " + st + (body !== undefined ? " avec « " + body + " »" : ""));
  }
};
EXTRA_CHECKS.dockerfile = (sh, v, push) => {
  for (const [p, spec] of Object.entries(v)) {
    let text = null; try { text = sh.fs.read(p, "root"); } catch (e) { /* absent */ }
    push(text !== null, p + " existe"); if (text === null) continue;
    let res = []; try { res = lint(text); } catch (e) { push(false, p + " est un Dockerfile valide"); continue; }
    if (spec.clean) push(!res.length, "hadolint ne signale rien dans " + p + (res.length ? " (" + [...new Set(res.map((x) => x.code))].join(", ") + ")" : ""));
    for (const code of spec.absent || []) push(!res.some((x) => x.code === code), "hadolint ne signale plus " + code + " dans " + p);
    for (const s of [].concat(spec.contains || [])) push(text.includes(s), p + " contient « " + s + " »");
    if (spec.stages) push(text.split("\n").filter((l) => /^\s*FROM\s/i.test(l)).length >= spec.stages, p + " a au moins " + spec.stages + " étapes (FROM)");
  }
};

/* ---------- branchements ---------- */
COMMANDS.docker = dockerCmd;
COMMANDS.hadolint = hadolintCmd;
HTTP_HOOKS.push((sh, host, port, path, ip) => (sh.docker && ip === "127.0.0.1" ? (sh.docker.settle(), sh.docker.hostHttp(port, path)) : null));
SETUP_HOOKS.push((sh, setup) => {
  if (!setup.docker) return;
  sh.docker = new Docker(sh, setup.docker);
  sh.docker.runShort = (c, argv) => { let out = ""; const io = { out: (s) => { out += s; }, err: (s) => { out += s; } }; let code; try { code = execIn(sh, sh.docker, c, argv, io); } catch (e) { out += e.message + "\n"; code = e.status || 1; } return { code, out }; };
  if (!sh.fs.groups.docker) sh.fs.addGroup("docker", 988);
  if (setup.docker.group !== false && !sh.fs.groups.docker.members.includes(sh.user)) sh.fs.groups.docker.members.push(sh.user);
  addService(sh, "docker", { desc: "Docker Application Container Engine", exec: "/usr/bin/dockerd -H fd:// --containerd=/run/containerd/containerd.sock", ports: [], pid: 912, enabled: true, active: true });
  sh.packages.add("docker-ce");
  sh.fs.mkdir("/var/run", "root", { parents: true }); sh.fs.write("/var/run/docker.sock", "", "root"); const n = sh.fs.stat("/var/run/docker.sock", "root"); n.group = "docker"; n.mode = 0o660;
});
