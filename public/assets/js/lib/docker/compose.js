/* `docker compose` (v2) : fichier compose.yaml, interpolation, validation, up/down/ps/logs/exec/build/config/run. */
import { load, dump } from "../../vendor/js-yaml.mjs";
import { DockerErr, hash } from "./engine.js";
import { words } from "./dockerfile.js";
import { canon, human } from "./catalog.js";
import { table, ago, status, cmdLine, portsStr, parsePort, parseMount, envFile, doBuild, execIn } from "./cli.js";

const FILES = ["compose.yaml", "compose.yml", "docker-compose.yaml", "docker-compose.yml"];
const TOP = ["version", "name", "services", "networks", "volumes", "configs", "secrets", "include"];
const SVC = ["build", "image", "command", "entrypoint", "environment", "env_file", "ports", "expose", "volumes", "depends_on", "restart", "healthcheck", "networks", "container_name", "user", "working_dir", "labels", "deploy", "profiles", "platform", "hostname", "init", "read_only", "stop_grace_period", "logging", "extra_hosts", "secrets", "configs", "tty", "stdin_open", "cap_add", "cap_drop", "security_opt", "mem_limit", "cpus", "ulimits", "pull_policy", "develop", "networks"];

/** Charge le projet : fichier, nom, interpolation des variables, validation. */
export function loadProject(sh, opts, io) {
  const dir = opts.dir || sh.cwd;
  let file = null, text = null;
  for (const f of opts.files && opts.files.length ? opts.files : FILES) { const p = f.startsWith("/") ? f : dir + "/" + f; try { text = sh.fs.read(p, sh.user); file = p; break; } catch (e) { if (opts.files && opts.files.length) throw new DockerErr("open " + p + ": no such file or directory", 1); } }
  if (!file) throw new DockerErr("no configuration file provided: not found", 1);
  const pdir = file.slice(0, file.lastIndexOf("/")) || "/";
  // Variables : .env du projet, puis l'environnement du shell (prioritaire).
  const vars = {}; try { Object.assign(vars, envFile(sh, opts.envFile || pdir + "/.env")); } catch (e) { /* pas de .env */ }
  for (const k of sh.exported) vars[k] = sh.vars.get(k);
  const warned = new Set();
  const interp = (s, where) => s.replace(/\$\$|\$\{(\w+)(?:(:?)([-?])([^}]*))?\}|\$(\w+)/g, (m, a, colon, op, arg, b) => {
    if (m === "$$") return "$";
    const k = a || b; const v = vars[k]; const unset = v === undefined || (colon && v === "");
    if (op === "-" && unset) return arg;
    if (op === "?" && unset) throw new DockerErr("error while interpolating " + where + ": required variable " + k + " is missing a value: " + arg, 1);
    if (v === undefined) { if (!warned.has(k)) { warned.add(k); io.err('WARN[0000] The "' + k + '" variable is not set. Defaulting to a blank string.\n'); } return ""; }
    return v;
  });
  let raw;
  try { raw = load(text); } catch (e) { const line = e.mark ? e.mark.line + 1 : 0; throw new DockerErr("yaml: line " + line + ": " + String(e.reason || e.message).replace(/^bad indentation of a mapping entry$/, "did not find expected key").replace(/^end of the stream or a document separator is expected$/, "did not find expected <document start>"), 1); }
  if (!raw || typeof raw !== "object") throw new DockerErr("empty compose file", 1);
  const walk = (x, where) => (typeof x === "string" ? interp(x, where) : Array.isArray(x) ? x.map((y, i) => walk(y, where + "[" + i + "]")) : x && typeof x === "object" ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, walk(v, where ? where + "." + k : k)])) : x);
  const cfg = walk(raw, "");
  for (const k of Object.keys(cfg)) if (!TOP.includes(k) && !k.startsWith("x-")) throw new DockerErr("validating " + file + ": additional properties '" + k + "' not allowed", 15);
  if (cfg.version !== undefined) io.err("WARN[0000] " + file + ": the attribute `version` is obsolete, it will be ignored, please remove it to avoid potential confusion\n");
  if (!cfg.services || typeof cfg.services !== "object") throw new DockerErr("no service selected", 1);
  for (const [n, s] of Object.entries(cfg.services)) {
    if (!s || typeof s !== "object") throw new DockerErr("service \"" + n + "\" has neither an image nor a build context specified: invalid compose project", 1);
    for (const k of Object.keys(s)) if (!SVC.includes(k) && !k.startsWith("x-")) throw new DockerErr("validating " + file + ": services." + n + " additional properties '" + k + "' not allowed", 15);
    if (!s.image && !s.build) throw new DockerErr("service \"" + n + "\" has neither an image nor a build context specified: invalid compose project", 1);
    for (const dep of deps(s)) if (!cfg.services[dep[0]]) throw new DockerErr("service \"" + n + "\" depends on undefined service \"" + dep[0] + "\": invalid compose project", 1);
    for (const v of s.volumes || []) { const src = typeof v === "string" ? v.split(":")[0] : v.source; if (src && !/^[./~]/.test(src) && typeof v === "string" && v.includes(":") && !(cfg.volumes && src in cfg.volumes)) throw new DockerErr("service \"" + n + "\" refers to undefined volume " + src + ": invalid compose project", 1); }
    for (const nt of netsOf(s)) if (nt !== "default" && !(cfg.networks && nt in cfg.networks)) throw new DockerErr("service \"" + n + "\" refers to undefined network " + nt + ": invalid compose project", 1);
  }
  const name = (opts.project || cfg.name || pdir.split("/").pop()).toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return { file, dir: pdir, name, cfg, vars };
}
const deps = (s) => (Array.isArray(s.depends_on) ? s.depends_on.map((x) => [x, "service_started"]) : Object.entries(s.depends_on || {}).map(([k, v]) => [k, (v && v.condition) || "service_started"]));
const netsOf = (s) => (Array.isArray(s.networks) ? s.networks : s.networks ? Object.keys(s.networks) : ["default"]);
function order(cfg, only) {
  const out = [], seen = new Set(), stack = new Set();
  const visit = (n) => { if (seen.has(n)) return; if (stack.has(n)) throw new DockerErr("dependency cycle detected: " + [...stack, n].join(" -> "), 1); stack.add(n); for (const [dname] of deps(cfg.services[n])) visit(dname); stack.delete(n); seen.add(n); out.push(n); };
  for (const n of only && only.length ? only : Object.keys(cfg.services)) { if (!cfg.services[n]) throw new DockerErr("no such service: " + n, 1); visit(n); }
  return out;
}
const imageOf = (P, n) => P.cfg.services[n].image || P.name + "-" + n;
const cname = (P, n) => P.cfg.services[n].container_name || P.name + "-" + n + "-1";
const line = (kind, name, st, t = "0.0s") => " ✔ " + (kind + " " + name).padEnd(34) + st.padEnd(32) + t.padStart(5) + "\n";
const errLine = (kind, name, st) => " ✘ " + (kind + " " + name).padEnd(34) + st.padEnd(32) + "0.0s\n";

/** Spécification du conteneur d'un service, pour create(). */
function containerSpec(sh, d, P, n) {
  const s = P.cfg.services[n];
  const env = {};
  for (const f of [].concat(s.env_file || [])) Object.assign(env, envFile(sh, (typeof f === "string" ? f : f.path).startsWith("/") ? f : P.dir + "/" + (typeof f === "string" ? f : f.path)));
  if (Array.isArray(s.environment)) for (const e of s.environment) { const i = e.indexOf("="); if (i < 0) { if (P.vars[e] !== undefined) env[e] = P.vars[e]; } else env[e.slice(0, i)] = e.slice(i + 1); }
  else for (const [k, v] of Object.entries(s.environment || {})) env[k] = v === null ? P.vars[k] ?? "" : String(v);
  const ports = (s.ports || []).map((p) => (typeof p === "object" ? { hostIp: p.host_ip || "", host: String(p.published || ""), container: String(p.target), proto: p.protocol || "tcp" } : parsePort(String(p))));
  const mounts = (s.volumes || []).map((v) => {
    if (typeof v === "object") return v.type === "bind" ? { type: "bind", source: sh.abs(v.source.startsWith("/") ? v.source : P.dir + "/" + v.source), dest: v.target, rw: !v.read_only } : { type: "volume", source: P.name + "_" + v.source, dest: v.target, rw: !v.read_only };
    const parts = v.split(":");
    if (/^[./~]/.test(parts[0])) { const save = sh.cwd; sh.cwd = P.dir; try { return parseMount(sh, v, false); } finally { sh.cwd = save; } }
    if (parts.length === 1) return { type: "volume", source: hash("anon:" + n + v), dest: v, rw: true, labels: { anonymous: true } };
    return { type: "volume", source: P.name + "_" + parts[0], dest: parts[1], rw: parts[2] !== "ro", labels: { "com.docker.compose.project": P.name, "com.docker.compose.volume": parts[0] } };
  });
  const hc = s.healthcheck ? (s.healthcheck.disable ? null : { test: typeof s.healthcheck.test === "string" ? ["CMD-SHELL", s.healthcheck.test] : s.healthcheck.test, interval: s.healthcheck.interval || "30s" }) : undefined;
  const cmd = s.command === undefined ? undefined : typeof s.command === "string" ? words(s.command) : s.command.map(String);
  const ep = s.entrypoint === undefined ? undefined : typeof s.entrypoint === "string" ? words(s.entrypoint) : s.entrypoint.map(String);
  const nets = netsOf(s).map((x) => (x === "default" ? P.name + "_default" : (P.cfg.networks[x] && P.cfg.networks[x].name) || P.name + "_" + x));
  return { name: cname(P, n), imageRef: imageOf(P, n), env, ports, mounts, cmd, entrypoint: ep, restart: s.restart || "no", user: s.user !== undefined ? String(s.user) : undefined, workdir: s.working_dir, healthcheck: hc, network: nets[0], extraNets: nets.slice(1), aliases: [n], labels: { "com.docker.compose.project": P.name, "com.docker.compose.service": n, "com.docker.compose.config-hash": hash(JSON.stringify(s)) } };
}

function parseFlags(a, spec) {
  const o = {}, rest = [];
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    if (x.startsWith("-") && rest.length === 0 || x.startsWith("-") && spec.__mix) {
      const [k, v] = x.includes("=") ? [x.slice(0, x.indexOf("=")), x.slice(x.indexOf("=") + 1)] : [x, undefined];
      const s = spec[k]; if (s === undefined) throw new DockerErr("unknown flag: " + k, 1);
      if (Array.isArray(s)) o[s[0]] = v ?? a[++i]; else o[s] = true;
    } else rest.push(x);
  }
  return { o, rest };
}

export function compose(sh, d, args, io) {
  // Options globales de compose.
  const g = { files: [] }; let i = 0;
  for (; i < args.length; i++) {
    const x = args[i];
    if (x === "-f" || x === "--file") g.files.push(args[++i]); else if (x.startsWith("--file=")) g.files.push(x.slice(7));
    else if (x === "-p" || x === "--project-name") g.project = args[++i];
    else if (x === "--env-file") g.envFile = args[++i];
    else if (x === "--project-directory") g.dir = sh.abs(args[++i]);
    else if (x === "-v" || x === "--version" || x === "version") { io.out("Docker Compose version v2.32.1\n"); return 0; }
    else break;
  }
  const sub = args[i]; const a = args.slice(i + 1);
  if (!sub) { io.out("Usage:  docker compose [OPTIONS] COMMAND\n\nDefine and run multi-container applications with Docker\n\nCommands:\n  build       Build or rebuild services\n  config      Parse, resolve and render compose file in canonical format\n  down        Stop and remove containers, networks\n  exec        Execute a command in a running container\n  logs        View output from containers\n  ls          List running compose projects\n  ps          List containers\n  pull        Pull service images\n  restart     Restart service containers\n  run         Run a one-off command on a service\n  start       Start services\n  stop        Stop services\n  up          Create and start containers\n  version     Show the Docker Compose version information\n"); return 0; }
  if (sub === "ls") {
    const projects = {}; for (const c of d.containers) { const p = c.labels["com.docker.compose.project"]; if (!p) continue; (projects[p] = projects[p] || []).push(c); }
    io.out(table(["NAME", "STATUS", "CONFIG FILES"], Object.entries(projects).map(([p, cs]) => [p, "running(" + cs.filter((c) => c.state === "running").length + ")", cs[0].labels["com.docker.compose.project.config_files"] || ""]))); return 0;
  }
  const P = loadProject(sh, g, io);
  const svcCont = (n) => d.container(cname(P, n), { must: false });
  const projConts = () => d.containers.filter((c) => c.labels["com.docker.compose.project"] === P.name);
  switch (sub) {
    case "config": {
      const { o } = parseFlags(a, { "-q": "quiet", "--quiet": "quiet", "--services": "services", "--volumes": "volumes", "--format": ["format"] });
      if (o.quiet) return 0;
      if (o.services) { io.out(Object.keys(P.cfg.services).join("\n") + "\n"); return 0; }
      const out = { name: P.name, ...P.cfg }; delete out.version;
      io.out(dump(out, { lineWidth: 200, noRefs: true })); return 0;
    }
    case "build": {
      const { o, rest } = parseFlags(a, { "--no-cache": "noCache", "--pull": "pull", "-q": "quiet" });
      let code = 0;
      for (const n of rest.length ? rest : Object.keys(P.cfg.services)) { const s = P.cfg.services[n]; if (!s.build) continue; code = buildSvc(sh, d, P, n, io, o.noCache); if (code) return code; io.err(line("Service", n, "Built")); }
      return code;
    }
    case "pull": { for (const n of Object.keys(P.cfg.services)) { const s = P.cfg.services[n]; if (!s.image || s.build) continue; if (!d.image(s.image, { pull: true })) { io.err(errLine("", n, "Error") + d.pullError(s.image) + "\n"); return 1; } io.err(line("", n, "Pulled", "2.1s")); } return 0; }
    case "up": {
      const { o, rest } = parseFlags(a, { "-d": "detach", "--detach": "detach", "--build": "build", "--force-recreate": "force", "--no-recreate": "noRecreate", "--remove-orphans": "orphans", "--wait": "wait", "--no-deps": "noDeps", "-V": "renewAnon", "--quiet-pull": "quietPull" });
      const list = order(P.cfg, rest.length ? rest : null);
      for (const n of list) { const s = P.cfg.services[n]; if (s.build && (o.build || !d.image(imageOf(P, n)))) { const code = buildSvc(sh, d, P, n, io); if (code) return code; io.err(line("Service", n, "Built")); } }
      let out = ""; let steps = 0;
      const nets = new Set(); for (const n of list) for (const x of netsOf(P.cfg.services[n])) nets.add(x);
      for (const x of nets) { const real = x === "default" ? P.name + "_default" : (P.cfg.networks[x] && P.cfg.networks[x].name) || P.name + "_" + x; if (!d.networks[real]) { d.addNetwork(real, "bridge", undefined, { "com.docker.compose.project": P.name }); out += line("Network", real, "Created", "0.1s"); steps++; } }
      for (const v of Object.keys(P.cfg.volumes || {})) { const real = (P.cfg.volumes[v] && P.cfg.volumes[v].name) || P.name + "_" + v; if (!d.volumes[real]) { d.addVolume(real, { "com.docker.compose.project": P.name, "com.docker.compose.volume": v }); out += line("Volume", '"' + real + '"', "Created"); steps++; } }
      for (const n of list) {
        const s = P.cfg.services[n];
        // Dépendances : condition service_healthy.
        for (const [dep, cond] of deps(s)) {
          const dc = svcCont(dep);
          if (cond === "service_healthy") {
            if (!dc || !dc.healthcheck) { io.err(out.replace(/^/, "[+] Running " + steps + "/" + (steps + 1) + "\n") + errLine("Container", cname(P, dep), "Error") + "dependency failed to start: container " + cname(P, dep) + " has no healthcheck configured\n"); return 1; }
            d.checkHealth(dc);
            if (dc.health !== "healthy") { io.err("[+] Running " + steps + "/" + (steps + 1) + "\n" + out + errLine("Container", cname(P, dep), "Error") + "dependency failed to start: container " + cname(P, dep) + " is unhealthy\n"); return 1; }
            out += line("Container", cname(P, dep), "Healthy", "5.6s");
          }
          if (cond === "service_completed_successfully" && (!dc || dc.state !== "exited" || dc.exitCode !== 0)) { io.err(out + errLine("Container", cname(P, dep), "Error") + "service \"" + dep + "\" didn't complete successfully: exit " + (dc ? dc.exitCode : 1) + "\n"); return 1; }
        }
        const spec = containerSpec(sh, d, P, n);
        let c = svcCont(n);
        if (c && (o.force || c.labels["com.docker.compose.config-hash"] !== spec.labels["com.docker.compose.config-hash"] || c.image !== (d.image(spec.imageRef) || {}).id) && !o.noRecreate) { d.stop(c); d.remove(c); c = null; out += line("Container", spec.name, "Recreated", "0.3s"); steps++; }
        if (c && c.state === "running") { out += line("Container", spec.name, "Running"); steps++; continue; }
        if (!c) {
          let img = d.image(spec.imageRef);
          if (!img) { img = d.pullBase(spec.imageRef); if (!img) { io.err(errLine("", n, "Error") + d.pullError(spec.imageRef) + "\n"); return 1; } out = line("", n + " Pulled", "", "3.4s").replace(n + " Pulled".padEnd(34), (n + " Pulled").padEnd(34)) + out; }
          c = d.create({ ...spec, imageObj: img });
          for (const x of spec.extraNets) d.connect(c, x, [n]);
          c.labels["com.docker.compose.project.config_files"] = P.file;
          if (!out.includes(spec.name + " ")) { out += line("Container", spec.name, "Created", "0.1s"); steps++; }
        }
        try { d.start(c); } catch (e) { io.err("[+] Running " + steps + "/" + (steps + 1) + "\n" + out + errLine("Container", spec.name, "Error") + "Error response from daemon: " + e.message.replace(/^docker: Error response from daemon: /, "").replace(/^docker: /, "") + "\n"); return 1; }
        d.checkHealth(c);
        out = out.replace(line("Container", spec.name, "Created", "0.1s"), "") + line("Container", spec.name, "Started", "0.4s");
      }
      const n = out.split("\n").filter(Boolean).length;
      io.err("[+] Running " + n + "/" + n + "\n" + out);
      if (!o.detach) {
        const cs = list.map((x) => svcCont(x)).filter(Boolean); const w = Math.max(...cs.map((c) => c.labels["com.docker.compose.service"].length)) + 2;
        io.out("Attaching to " + cs.map((c) => c.labels["com.docker.compose.service"] + "-1").join(", ") + "\n" + cs.flatMap((c) => c.logs.map((l) => (c.labels["com.docker.compose.service"] + "-1").padEnd(w) + " | " + l + "\n")).join("") + cs.filter((c) => c.state === "exited").map((c) => (c.labels["com.docker.compose.service"] + "-1").padEnd(w) + " exited with code " + c.exitCode + "\n").join(""));
        io.err("(compose up sans -d reste attaché aux journaux jusqu'à Ctrl+C ; ici, les conteneurs continuent en arrière-plan.)\n");
      }
      return 0;
    }
    case "down": {
      const { o } = parseFlags(a, { "-v": "volumes", "--volumes": "volumes", "--rmi": ["rmi"], "--remove-orphans": "orphans", "-t": ["timeout"] });
      let out = "";
      for (const c of projConts().reverse()) { d.stop(c); d.remove(c); out += line("Container", c.name, "Removed", "0.3s"); }
      if (o.volumes) for (const v of Object.values(d.volumes)) if (v.labels["com.docker.compose.project"] === P.name) { delete d.volumes[v.name]; out += line("Volume", v.name, "Removed"); }
      for (const n of Object.values(d.networks)) if (n.labels["com.docker.compose.project"] === P.name) { delete d.networks[n.name]; out += line("Network", n.name, "Removed", "0.1s"); }
      if (o.rmi) for (const sn of Object.keys(P.cfg.services)) { const s = P.cfg.services[sn]; if (o.rmi === "local" && s.image) continue; const img = d.image(imageOf(P, sn)); if (img) { for (const t of img.tags) delete d.tags[t]; delete d.images[img.id]; out += line("Image", imageOf(P, sn) + ":latest", "Removed"); } }
      const k = out.split("\n").filter(Boolean).length; io.err(k ? "[+] Running " + k + "/" + k + "\n" + out : ""); return 0;
    }
    case "ps": {
      const { o, rest } = parseFlags(a, { "-a": "all", "--all": "all", "-q": "quiet", "--services": "services", "--format": ["format"] });
      const cs = projConts().filter((c) => (o.all || c.state === "running" || c.state === "restarting") && (!rest.length || rest.includes(c.labels["com.docker.compose.service"])));
      if (o.quiet) { io.out(cs.map((c) => c.id + "\n").join("")); return 0; }
      if (o.services) { io.out(cs.map((c) => c.labels["com.docker.compose.service"] + "\n").join("")); return 0; }
      io.out(table(["NAME", "IMAGE", "COMMAND", "SERVICE", "CREATED", "STATUS", "PORTS"], cs.map((c) => [c.name, imageOf(P, c.labels["com.docker.compose.service"]), cmdLine(c), c.labels["com.docker.compose.service"], ago(d, c.created), status(d, c), portsStr(c)]))); return 0;
    }
    case "logs": {
      const { o, rest } = parseFlags(a, { "-f": "follow", "--follow": "follow", "--tail": ["tail"], "-n": ["tail"], "-t": "timestamps", "--no-color": "noColor", "--no-log-prefix": "noPrefix", __mix: true });
      const cs = projConts().filter((c) => !rest.length || rest.includes(c.labels["com.docker.compose.service"]));
      if (rest.length && !cs.length) throw new DockerErr("no such service: " + rest[0], 1);
      const w = Math.max(0, ...cs.map((c) => (c.labels["com.docker.compose.service"] + "-1").length)) + 1;
      io.out(cs.flatMap((c) => { let l = c.logs; if (o.tail !== undefined && o.tail !== "all") l = l.slice(-+o.tail); return l.map((x) => (o.noPrefix ? "" : (c.labels["com.docker.compose.service"] + "-1").padEnd(w) + " | ") + x + "\n"); }).join(""));
      if (o.follow) io.err("(-f suit les journaux en continu sur une vraie machine ; ici on affiche ce qui est déjà écrit.)\n");
      return 0;
    }
    case "exec": {
      const { o, rest } = parseFlags(a, { "-T": "noTty", "-it": "it", "-i": "i", "-t": "t", "-u": ["user"], "--user": ["user"], "-w": ["workdir"], "-e": ["env"], "-d": "detach" });
      const [n, ...cmd] = rest; if (!n || !cmd.length) throw new DockerErr("exec requires at least 2 arguments", 1);
      if (!P.cfg.services[n]) throw new DockerErr("no such service: " + n, 1);
      const c = svcCont(n); if (!c || c.state !== "running") throw new DockerErr("service \"" + n + "\" is not running", 1);
      return execIn(sh, d, c, cmd, io, o);
    }
    case "run": {
      const { o, rest } = parseFlags(a, { "--rm": "rm", "-T": "noTty", "-e": ["env"], "--no-deps": "noDeps", "-d": "detach", "--entrypoint": ["entrypoint"] });
      const [n, ...cmd] = rest; if (!P.cfg.services[n]) throw new DockerErr("no such service: " + n, 1);
      if (P.cfg.services[n].build && !d.image(imageOf(P, n))) { const code = buildSvc(sh, d, P, n, io); if (code) return code; }
      const spec = containerSpec(sh, d, P, n);
      for (const x of netsOf(P.cfg.services[n])) { const real = x === "default" ? P.name + "_default" : P.name + "_" + x; if (!d.networks[real]) d.addNetwork(real, "bridge", undefined, { "com.docker.compose.project": P.name }); }
      for (const v of Object.keys(P.cfg.volumes || {})) d.addVolume(P.name + "_" + v, { "com.docker.compose.project": P.name, "com.docker.compose.volume": v });
      const c = d.create({ ...spec, name: P.name + "-" + n + "-run-" + hash("run" + d.seq, 12), ports: [], cmd: cmd.length ? cmd : spec.cmd, entrypoint: o.entrypoint ? [o.entrypoint] : spec.entrypoint, imageObj: d.image(spec.imageRef) || d.pullBase(spec.imageRef), labels: { ...spec.labels, "com.docker.compose.oneoff": "True" } });
      try { d.start(c); } catch (e) { d.remove(c); throw e; }
      io.out(c.logs.map((l) => l + "\n").join(""));
      const code = c.state === "running" ? 0 : c.exitCode; if (o.rm && c.state !== "running") d.remove(c); return code;
    }
    case "stop": case "start": case "restart": case "rm": {
      const { rest } = parseFlags(a, { "-f": "force", "-s": "stop", "-t": ["timeout"] });
      let out = "";
      for (const n of rest.length ? rest : Object.keys(P.cfg.services).reverse()) {
        const c = svcCont(n); if (!c) continue;
        if (sub === "stop" || sub === "restart" || sub === "rm") { d.stop(c); if (sub !== "rm") out += line("Container", c.name, "Stopped", "0.3s"); }
        if (sub === "rm") { d.remove(c); out += line("Container", c.name, "Removed"); }
        if (sub === "start" || sub === "restart") { try { d.start(c); d.checkHealth(c); } catch (e) { io.err(e.message + "\n"); return 1; } out += line("Container", c.name, "Started", "0.4s"); }
      }
      const k = out.split("\n").filter(Boolean).length; io.err(k ? "[+] " + (sub === "rm" ? "Removing" : sub === "stop" ? "Stopping" : sub === "start" ? "Running" : "Restarting") + " " + k + "/" + k + "\n" + out : "");
      return 0;
    }
    case "images": { io.out(table(["CONTAINER", "REPOSITORY", "TAG", "IMAGE ID", "SIZE"], projConts().map((c) => { const img = d.images[c.image]; const t = img.tags[0] || "<none>:<none>"; return [c.name, t.slice(0, t.lastIndexOf(":")), t.slice(t.lastIndexOf(":") + 1), img.id.slice(0, 12), human(d.size(img))]; }))); return 0; }
    default: io.err("unknown docker command: \"compose " + sub + "\"\n"); return 1;
  }
}

function buildSvc(sh, d, P, n, io, noCache) {
  const b = P.cfg.services[n].build; const ctx = typeof b === "string" ? b : b.context || ".";
  const ctxAbs = ctx.startsWith("/") ? ctx : (P.dir + "/" + ctx).replace(/\/\.$/, "").replace(/\/\.\//g, "/");
  const args = ["-t", imageOf(P, n)];
  if (b.dockerfile) args.push("-f", b.dockerfile.startsWith("/") ? b.dockerfile : ctxAbs + "/" + b.dockerfile);
  if (b.target) args.push("--target", b.target);
  for (const [k, v] of Object.entries(b.args || {})) args.push("--build-arg", k + "=" + v);
  if (noCache) args.push("--no-cache");
  args.push(ctxAbs);
  void canon;
  return doBuild(sh, d, args, io);
}
