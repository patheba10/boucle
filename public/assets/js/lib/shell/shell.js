/* Interpréteur Bash simulé : expansions, redirections, contrôle de flux, builtins.
   Les commandes externes (ls, grep, systemctl…) sont dans commands.js. */
import { FS, FsError, errText, normalize, dirname, basename, resetClock } from "./fs.js";
import { parse, ParseError } from "./parse.js";
import { globRegex, posixRegex } from "./text.js";
import { COMMANDS, makeWorld, addService, EXTRA_CHECKS, SETUP_HOOKS } from "./commands.js";
import "../docker/cli.js";
import "../k8s/kubectl.js";
import "../prom/cli.js";
import "../ansible/ansible.js";
import "../terraform/terraform.js";
import "../aws/cli.js";

class ExitSig { constructor(code) { this.code = code; } }
class ReturnSig { constructor(code) { this.code = code; } }
class LoopSig { constructor(kind, n) { this.kind = kind; this.n = n; } }
class ShErr extends Error { constructor(msg, code = 1) { super(msg); this.status = code; } }
const MAX_STEPS = 200000;

export class Shell {
  constructor(opts = {}) {
    resetClock();
    this.fs = new FS();
    this.user = "eleve"; this.host = opts.host || "serveur";
    this.vars = new Map(); this.exported = new Set(); this.funcs = new Map();
    this.opts = { e: false, u: false, pipefail: false, x: false };
    this.positional = []; this.argv0 = "bash"; this.status = 0;
    this.history = []; this.services = {}; this.procs = []; this.cron = {}; this.net = { http: {}, dns: {} }; this.packages = new Set();
    this.lastOut = ""; this.steps = 0; this.scriptName = null; this.nextPid = 4200;
    makeWorld(this);
    this.cwd = this.home();
    for (const [k, v] of Object.entries({ HOME: this.home(), USER: this.user, LOGNAME: this.user, SHELL: "/bin/bash", PATH: "/usr/local/bin:/usr/bin:/bin", LANG: "C.UTF-8", TERM: "xterm-256color", HOSTNAME: this.host, PWD: this.cwd })) { this.vars.set(k, v); this.exported.add(k); }
  }
  home(u = this.user) { return (this.fs.users[u] || {}).home || "/home/" + u; }
  abs(p) { if (p === "~" || p.startsWith("~/")) p = this.home() + p.slice(1); return normalize(p.startsWith("/") ? p : this.cwd + "/" + p); }
  prompt() { const h = this.home(); const d = this.cwd === h ? "~" : this.cwd.startsWith(h + "/") ? "~" + this.cwd.slice(h.length) : this.cwd; return this.user + "@" + this.host + ":" + d + (this.user === "root" ? "# " : "$ "); }

  /** Exécute une ligne (ou un script). Renvoie { out, err, code, chunks }. */
  run(src, { stdin = "", record = true } = {}) {
    const chunks = [];
    const io = { stdin, tty: true, out: (s) => { if (s) chunks.push(["out", s]); }, err: (s) => { if (s) chunks.push(["err", s]); } };
    this._errSink = io.err;
    if (record && src.trim()) this.history.push(src);
    let code;
    try {
      const ast = parse(src);
      this.steps = 0;
      code = this.execList(ast, io);
    } catch (e) {
      if (e instanceof ExitSig) { code = e.code; if (this.suStack && this.suStack.length) { const back = this.suStack.pop(); this.user = back.user; this.cwd = back.cwd; io.out("logout\n"); } else this.exited = true; }
      else if (e instanceof ParseError) { io.err("bash: " + e.message + "\n"); code = 2; }
      else if (e instanceof ShErr) { io.err(e.message + "\n"); code = e.status; }
      else if (e instanceof LoopSig || e instanceof ReturnSig) code = 0;
      else throw e;
    }
    this.status = code;
    const out = chunks.filter((c) => c[0] === "out").map((c) => c[1]).join("");
    this.lastOut = out; this.lastCode = code;
    return { out, err: chunks.filter((c) => c[0] === "err").map((c) => c[1]).join(""), code, chunks };
  }

  /* ---------- variables ---------- */
  getVar(name) {
    if (name === "?") return String(this.status);
    if (name === "#") return String(this.positional.length);
    if (name === "@" || name === "*") return this.positional.join(" ");
    if (name === "0") return this.argv0;
    if (name === "$") return "4096";
    if (name === "!") return String(this.lastBg || "");
    if (name === "RANDOM") { this._rnd = ((this._rnd || 12345) * 1103515245 + 12345) & 0x7fffffff; return String(this._rnd % 32768); }
    if (name === "PWD") return this.cwd;
    if (/^\d+$/.test(name)) return this.positional[+name - 1];
    return this.vars.get(name);
  }
  setVar(name, v) { if (this.readonly && this.readonly.has(name)) throw new ShErr(this.where() + name + ": readonly variable"); this.vars.set(name, v); }
  where(line) { return this.scriptName ? this.scriptName + ": line " + (line || this.curLine || 1) + ": " : "bash: "; }

  /* ---------- exécution ---------- */
  tick() { if (++this.steps > MAX_STEPS) throw new ShErr("bash: exécution interrompue : boucle trop longue (simulateur)", 124); }
  execList(list, io) {
    let code = 0;
    for (const it of list.items) {
      if (it.bg) { code = this.execNode(it.node, io); const pid = this.nextPid++; this.lastBg = pid; io.err("[1] " + pid + "\n"); continue; }
      code = this.execNode(it.node, io);
    }
    return code;
  }
  execNode(node, io, { cond = false } = {}) {
    this.tick();
    let code;
    switch (node.type) {
      case "list": code = this.execList(node, io); break;
      case "andor": {
        const l = this.execNode(node.left, io, { cond: true });
        code = (node.op === "&&" ? l === 0 : l !== 0) ? this.execNode(node.right, io, { cond }) : l;
        this.status = code; return code;
      }
      case "pipeline": code = this.execPipeline(node, io); if (node.neg) { this.status = code ? 0 : 1; return this.status; } break;
      default: code = this.withRedirs(node, io, (io2) => this.execCompound(node, io2)); break;
    }
    this.status = code;
    if (code !== 0 && this.opts.e && !cond && node.type !== "andor" && !(node.type === "pipeline" && node.neg)) throw new ExitSig(code);
    return code;
  }
  execPipeline(node, io) {
    let input = io.stdin, codes = [];
    node.cmds.forEach((c, i) => {
      const last = i === node.cmds.length - 1;
      let buf = "";
      const io2 = { stdin: input, tty: last ? io.tty : false, out: last ? io.out : (s) => { buf += s; }, err: io.err };
      const sub = node.cmds.length > 1 && !last ? this.subshell() : this;
      let code;
      try { code = sub.execNode(c, io2, { cond: true }); } catch (e) { if (e instanceof ExitSig && sub !== this) code = e.code; else throw e; }
      codes.push(code); input = buf;
    });
    const last = codes[codes.length - 1];
    return this.opts.pipefail ? [...codes].reverse().find((c) => c !== 0) || 0 : last;
  }
  subshell() {
    const s = Object.create(Shell.prototype);
    Object.assign(s, this, { vars: new Map(this.vars), exported: new Set(this.exported), funcs: new Map(this.funcs), opts: { ...this.opts }, positional: [...this.positional], localStack: this.localStack ? this.localStack.map((m) => new Map(m)) : null });
    return s;
  }
  execCompound(node, io) {
    switch (node.type) {
      case "simple": return this.execSimple(node, io);
      case "group": return this.execList(node.body, io);
      case "subshell": { const s = this.subshell(); try { return s.execList(node.body, io); } catch (e) { if (e instanceof ExitSig) return e.code; throw e; } }
      case "if": {
        for (const c of node.clauses) if (this.condRun(c.cond, io) === 0) return this.execList(c.body, io);
        return node.otherwise ? this.execList(node.otherwise, io) : 0;
      }
      case "while": {
        let code = 0;
        for (;;) {
          this.tick();
          const c = this.condRun(node.cond, io);
          if (node.until ? c === 0 : c !== 0) break;
          try { code = this.execList(node.body, io); }
          catch (e) { if (e instanceof LoopSig) { if (e.n > 1) { e.n--; throw e; } if (e.kind === "break") break; continue; } throw e; }
        }
        return code;
      }
      case "for": {
        const words = node.words === null ? [...this.positional] : node.words.flatMap((w) => this.expand(w));
        let code = 0;
        for (const w of words) {
          this.setVar(node.name, w);
          try { code = this.execList(node.body, io); }
          catch (e) { if (e instanceof LoopSig) { if (e.n > 1) { e.n--; throw e; } if (e.kind === "break") break; continue; } throw e; }
        }
        return code;
      }
      case "case": {
        const v = this.expandOne(node.word);
        for (const it of node.items) if (it.pats.some((p) => globRegex(this.expandPattern(p)).test(v))) return this.execList(it.body, io);
        return 0;
      }
      case "func": this.funcs.set(node.name, node.body); return 0;
      case "dbl": return this.testDouble(node.expr) ? 0 : 1;
      case "arithcmd": return this.arith(node.expr) !== 0 ? 0 : 1;
    }
    throw new ShErr("bash: construction non simulée");
  }
  condRun(list, io) { const save = this.opts.e; this.opts.e = false; try { return this.execList(list, io); } finally { this.opts.e = save; } }

  /* ---------- redirections ---------- */
  withRedirs(node, io, fn) {
    if (!node.redirs || !node.redirs.length) return fn(io);
    const io2 = { ...io }; const sinks = [];
    try {
      for (const r of node.redirs) {
        if (r.op === "<<") { io2.stdin = r.heredoc.quoted ? r.heredoc.body : this.expandHeredoc(r.heredoc.body); continue; }
        if (r.op === "<<<") { io2.stdin = this.expandOne(r.target) + "\n"; continue; }
        const target = this.expandOne(r.target);
        if (r.op === ">&" || r.op === "<&") { // 2>&1, >&2
          if (target === "1" || target === "2") { const dst = target === "1" ? io2.out : io2.err; if (r.fd === 2) io2.err = dst; else io2.out = dst; continue; }
        }
        if (r.op === "<") {
          const p = this.abs(target);
          if (p === "/dev/null") { io2.stdin = ""; continue; }
          try { io2.stdin = this.fs.read(p, this.user); } catch (e) { throw new ShErr(this.where(node.line) + target + ": " + errText(e.code)); }
          continue;
        }
        const p = this.abs(target); const append = r.op === ">>" || r.op === "&>>";
        if (p === "/dev/null") { const nul = () => {}; if (r.op === "&>" || r.op === "&>>") { io2.out = nul; io2.err = nul; } else if (r.fd === 2) io2.err = nul; else io2.out = nul; continue; }
        if (p === "/dev/stderr") { if (r.fd !== 2) io2.out = io.err; continue; }
        try { this.fs.write(p, "", this.user, { append: true }); if (!append) this.fs.write(p, "", this.user); }
        catch (e) { throw new ShErr(this.where(node.line) + target + ": " + errText(e.code)); }
        const sink = { p, buf: "" }; sinks.push(sink);
        const w = (s) => { sink.buf += s; };
        if (r.op === "&>" || r.op === "&>>") { io2.out = w; io2.err = w; io2.tty = false; } else if (r.fd === 2) io2.err = w; else { io2.out = w; io2.tty = false; }
      }
    } catch (e) { if (e instanceof ShErr) { io.err(e.message + "\n"); return 1; } throw e; }
    try { return fn(io2); }
    finally { for (const s of sinks) if (s.buf) this.fs.write(s.p, s.buf, this.user, { append: true }); }
  }

  /* ---------- commande simple ---------- */
  execSimple(node, io) {
    this.curLine = node.line;
    const words = node.words.flatMap((w) => this.expand(w));
    const assigns = node.assigns.map(([n, raw, plus]) => [n, this.expandOne(raw, { assign: true }), plus]);
    if (this.opts.x) io.err("+ " + [...assigns.map(([n, v]) => n + "=" + v), ...words].join(" ") + "\n");
    if (!words.length) { for (const [n, v, plus] of assigns) this.setVar(n, plus ? (this.getVar(n) || "") + v : v); return 0; }
    const [name, ...args] = words;
    // Variables limitées à la commande : on les applique pendant son exécution
    const saved = assigns.map(([n]) => [n, this.vars.get(n), this.exported.has(n)]);
    for (const [n, v] of assigns) { this.vars.set(n, v); this.exported.add(n); }
    try { return this.invoke(name, args, io, node.line); }
    finally { for (const [n, v, ex] of saved) { if (v === undefined) this.vars.delete(n); else this.vars.set(n, v); if (!ex) this.exported.delete(n); } }
  }
  invoke(name, args, io, line) {
    if (this.funcs.has(name)) return this.callFunc(name, args, io);
    const b = BUILTINS[name];
    if (b) { try { return b(this, args, io); } catch (e) { if (e instanceof ShErr) { io.err(e.message + "\n"); return e.status; } throw e; } }
    if (name.includes("/")) return this.runFile(name, args, io, line);
    const c = COMMANDS[name];
    if (c) {
      try { return c(this, args, io) ?? 0; }
      catch (e) {
        if (e instanceof ShErr) { io.err(e.message + "\n"); return e.status; }
        if (e instanceof FsError) { io.err(name + ": " + errText(e.code) + "\n"); return 1; }
        if (e instanceof ExitSig || e instanceof ReturnSig || e instanceof LoopSig) throw e;
        if (e && typeof e.status === "number") { io.err(e.message + "\n"); return e.status; }
        io.err(name + ": " + (e.message || e) + "\n"); return 1;
      }
    }
    // Script dans le PATH ?
    for (const d of (this.getVar("PATH") || "").split(":")) { const p = d + "/" + name; if (this.fs.exists(p, this.user)) { const n = this.fs.stat(p, this.user); if (n.t === "f") return this.runFile(p, args, io, line); } }
    io.err(this.where(line) + name + ": command not found\n");
    if (NOT_SIMULATED.has(name)) io.err("(« " + name + " » existe sur une vraie machine, mais n'est pas simulé ici.)\n");
    return 127;
  }
  callFunc(name, args, io) {
    const savePos = this.positional; this.positional = args;
    this.localStack = this.localStack || []; this.localStack.push(new Map());
    const body = this.funcs.get(name);
    try { return this.execNode(body, io); }
    catch (e) { if (e instanceof ReturnSig) return e.code; throw e; }
    finally {
      const locals = this.localStack.pop();
      for (const [n, v] of locals.get("__saved__") || []) { if (v === undefined) this.vars.delete(n); else this.vars.set(n, v); }
      this.positional = savePos;
    }
  }
  /** ./script.sh ou /chemin/script : vérifie l'existence et le droit d'exécution. */
  runFile(path, args, io, line) {
    const p = this.abs(path);
    let node;
    try { node = this.fs.stat(p, this.user); } catch (e) { io.err(this.where(line) + path + ": " + errText(e.code) + "\n"); return e.code === "ENOENT" ? 127 : 126; }
    if (node.t === "d") { io.err(this.where(line) + path + ": Is a directory\n"); return 126; }
    if (!this.fs.can(node, this.user, 1)) { io.err(this.where(line) + path + ": Permission denied\n"); return 126; }
    if (!this.fs.can(node, this.user, 4)) { io.err("/bin/bash: " + path + ": Permission denied\n"); return 126; }
    const first = node.data.split("\n")[0];
    if (first.startsWith("#!") && !/\b(ba)?sh\b/.test(first)) { io.err(this.where(line) + path + ": " + first.slice(2).trim() + ": bad interpreter: interpréteur non simulé\n"); return 126; }
    return this.runScript(node.data, path, args, io);
  }
  runScript(src, name, args, io, { x = false } = {}) {
    const s = this.subshell();
    // Un script ne voit que les variables exportées.
    for (const k of [...s.vars.keys()]) if (!this.exported.has(k)) s.vars.delete(k);
    s.funcs = new Map(); s.positional = args; s.argv0 = name; s.scriptName = name; s.opts = { e: false, u: false, pipefail: false, x };
    let code; s.traps = {};
    try { const ast = parse(src); code = s.execList(ast, io); }
    catch (e) {
      if (e instanceof ExitSig) code = e.code;
      else if (e instanceof ParseError) { io.err(name + ": line " + 1 + ": " + e.message + "\n"); code = 2; }
      else if (e instanceof ShErr) { io.err(e.message + "\n"); code = e.status; }
      else throw e;
    }
    if (s.traps.EXIT || s.traps["0"]) { const t = s.traps.EXIT || s.traps["0"]; s.traps = {}; s.status = code; try { s.execList(parse(t), io); } catch (e) { if (!(e instanceof ExitSig)) throw e; } }
    this.fs = s.fs; this.services = s.services; this.procs = s.procs; this.cron = s.cron;
    return code;
  }

  /* ---------- expansions ---------- */
  /** Découpe un mot brut en morceaux { s, q (entre guillemets), exp (issu d'une expansion) }. */
  pieces(raw, { inDq = false, assign = false } = {}) {
    const out = []; let i = 0;
    const lit = (s, q) => out.push({ s, q, exp: false });
    while (i < raw.length) {
      const c = raw[i];
      if (!inDq && c === "'") { const e = raw.indexOf("'", i + 1); lit(raw.slice(i + 1, e), true); i = e + 1; continue; }
      if (!inDq && c === "$" && raw[i + 1] === "'") { // $'…' : échappements C
        const e = raw.indexOf("'", i + 2); lit(raw.slice(i + 2, e).replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\(.)/g, "$1"), true); i = e + 1; continue;
      }
      if (!inDq && c === '"') {
        let j = i + 1, depth = 0;
        while (j < raw.length) { if (raw[j] === "\\") { j += 2; continue; } if (raw[j] === "$" && raw[j + 1] === "(") { depth++; j += 2; continue; } if (raw[j] === ")" && depth) { depth--; j++; continue; } if (raw[j] === '"' && !depth) break; j++; }
        const inner = this.pieces(raw.slice(i + 1, j), { inDq: true });
        if (!inner.length) out.push({ s: "", q: true, exp: false });
        for (const x of inner) out.push({ ...x, q: true });
        i = j + 1; continue;
      }
      if (c === "\\") { const d = raw[i + 1]; if (inDq && !"$`\"\\\n".includes(d)) lit("\\" + (d ?? ""), true); else if (d !== "\n" && d !== undefined) lit(d, true); i += 2; continue; }
      if (c === "`") { const e = raw.indexOf("`", i + 1); out.push({ s: this.cmdSub(raw.slice(i + 1, e)), q: inDq, exp: true }); i = e + 1; continue; }
      if (c === "$") {
        if (raw.startsWith("$((", i)) { const e = findClose(raw, i + 3, "((", "))"); out.push({ s: String(this.arith(raw.slice(i + 3, e))), q: inDq, exp: true }); i = e + 2; continue; }
        if (raw[i + 1] === "(") { const e = findClose(raw, i + 2, "(", ")"); out.push({ s: this.cmdSub(raw.slice(i + 2, e)), q: inDq, exp: true }); i = e + 1; continue; }
        if (raw[i + 1] === "{") { const e = raw.indexOf("}", i + 2); const r = this.paramExp(raw.slice(i + 2, e)); out.push({ s: r.s, q: inDq, exp: true, at: r.at }); i = e + 1; continue; }
        const m = /^\$([A-Za-z_]\w*|[0-9?#@*$!])/.exec(raw.slice(i));
        if (m) { const v = this.getVar(m[1]); if (v === undefined && this.opts.u && !/^[@*#?]$/.test(m[1])) throw new ShErr(this.where() + m[1] + ": unbound variable"); out.push({ s: v ?? "", q: inDq, exp: true, at: m[1] === "@" && inDq }); i += m[0].length; continue; }
        lit("$", inDq); i++; continue;
      }
      if (!inDq && c === "~" && i === 0 && (raw.length === 1 || raw[1] === "/")) { lit(this.home(), true); i++; continue; }
      if (assign && c === "~" && raw[i - 1] === ":") { lit(this.home(), true); i++; continue; }
      let j = i; while (j < raw.length && !(inDq ? "\\$`" : "'\"\\$`").includes(raw[j])) j++;
      lit(raw.slice(i, j), inDq); i = j;
    }
    return out;
  }
  paramExp(body) {
    const pos = this.positional;
    if (body === "#") return { s: String(pos.length) };
    if (body === "@" || body === "*") return { s: pos.join(" "), at: body === "@" };
    let m;
    if ((m = /^#([A-Za-z_]\w*|\d+)$/.exec(body))) return { s: String((this.getVar(m[1]) || "").length) };
    if ((m = /^([A-Za-z_]\w*|\d+|[?#])(:?[-=+?])([\s\S]*)$/.exec(body))) {
      const [, n, op, w] = m; const v = this.getVar(n); const empty = op.startsWith(":") ? !v : v === undefined; const word = () => this.expandOne(w);
      switch (op.replace(":", "")) {
        case "-": return { s: empty ? word() : v };
        case "=": if (empty) { this.setVar(n, word()); } return { s: this.getVar(n) };
        case "+": return { s: empty ? "" : word() };
        case "?": if (empty) throw new ShErr(this.where() + n + ": " + (w ? this.expandOne(w) : "parameter null or not set")); return { s: v };
      }
    }
    if ((m = /^([A-Za-z_]\w*|\d+)(##?|%%?)([\s\S]*)$/.exec(body))) {
      const v = this.getVar(m[1]) || ""; const pat = this.expandPattern(m[3]); const op = m[2];
      const rx = globRegex(pat, { anchored: false }).source;
      if (op === "#") { for (let k = 0; k <= v.length; k++) if (new RegExp("^(?:" + rx + ")$").test(v.slice(0, k))) return { s: v.slice(k) }; return { s: v }; }
      if (op === "##") { for (let k = v.length; k >= 0; k--) if (new RegExp("^(?:" + rx + ")$").test(v.slice(0, k))) return { s: v.slice(k) }; return { s: v }; }
      if (op === "%") { for (let k = v.length; k >= 0; k--) if (new RegExp("^(?:" + rx + ")$").test(v.slice(k))) return { s: v.slice(0, k) }; return { s: v }; }
      for (let k = 0; k <= v.length; k++) if (new RegExp("^(?:" + rx + ")$").test(v.slice(k))) return { s: v.slice(0, k) }; return { s: v };
    }
    if ((m = /^([A-Za-z_]\w*)\/(\/?)([^/]*)\/?([\s\S]*)$/.exec(body))) {
      const v = this.getVar(m[1]) || ""; const rx = new RegExp(globRegex(this.expandPattern(m[3]), { anchored: false }).source, m[2] ? "g" : "");
      return { s: v.replace(rx, () => this.expandOne(m[4])) };
    }
    if ((m = /^([A-Za-z_]\w*)(\^\^|,,)$/.exec(body))) { const v = this.getVar(m[1]) || ""; return { s: m[2] === "^^" ? v.toUpperCase() : v.toLowerCase() }; }
    if ((m = /^([A-Za-z_]\w*):(-?\d+)(?::(\d+))?$/.exec(body))) { const v = this.getVar(m[1]) || ""; const st = +m[2] < 0 ? v.length + +m[2] : +m[2]; return { s: m[3] !== undefined ? v.substr(st, +m[3]) : v.slice(st) }; }
    if (/^([A-Za-z_]\w*|\d+|[?$!])$/.test(body)) { const v = this.getVar(body); if (v === undefined && this.opts.u) throw new ShErr(this.where() + body + ": unbound variable"); return { s: v ?? "" }; }
    throw new ShErr(this.where() + "${" + body + "}: bad substitution");
  }
  cmdSub(src) {
    const s = this.subshell(); let buf = "";
    const io = { stdin: "", out: (x) => { buf += x; }, err: this._errSink || (() => {}) };
    try { s.execList(parse(src), io); } catch (e) { if (!(e instanceof ExitSig)) { if (e instanceof ParseError) throw new ShErr("bash: " + e.message, 2); throw e; } }
    this.fs = s.fs; this.status = s.status;
    return buf.replace(/\n+$/, "");
  }
  /** Expansion complète : renvoie une liste de champs (découpage et globbing compris). */
  expand(raw) {
    const ps = this.pieces(raw);
    if (ps.some((p) => p.at)) { // "$@" : un champ par argument
      const before = ps.slice(0, ps.findIndex((p) => p.at)).map((p) => p.s).join(""), after = ps.slice(ps.findIndex((p) => p.at) + 1).map((p) => p.s).join("");
      if (!this.positional.length) return before || after ? [before + after] : [];
      return this.positional.map((a, i, arr) => (i === 0 ? before : "") + a + (i === arr.length - 1 ? after : ""));
    }
    const fields = []; let cur = null, pat = "", globbable = false;
    const esc = (x) => x.replace(/[*?[\]\\]/g, "\\$&");
    const add = (x, quoted) => { cur = (cur ?? "") + x; pat += quoted ? esc(x) : x; if (!quoted && /[*?[]/.test(x)) globbable = true; };
    const flush = () => { if (cur !== null) fields.push({ s: cur, pat, glob: globbable }); cur = null; pat = ""; globbable = false; };
    for (const p of ps) {
      if (p.exp && !p.q) { p.s.split(/[ \t\n]+/).forEach((x, k) => { if (k > 0) flush(); if (x !== "") add(x, false); }); continue; }
      add(p.s, p.q);
    }
    flush();
    return fields.flatMap((f) => (f.glob ? this.glob(f.pat, f.s) : [f.s]));
  }
  expandOne(raw, opts) { return this.pieces(raw, opts).map((p) => p.s).join(""); }
  expandPattern(raw) { return this.pieces(raw).map((p) => (p.q ? p.s.replace(/[*?[\]\\]/g, "\\$&") : p.s)).join(""); }
  expandHeredoc(body) { return this.pieces(body.replace(/"/g, "\u0001"), { inDq: true }).map((p) => p.s).join("").replace(/\u0001/g, '"'); }
  glob(pat, literal) {
    const abs = pat.startsWith("/");
    const segs = pat.split("/").filter((s, i) => s !== "" || i === 0);
    let paths = [abs ? "/" : ""];
    for (const seg of (abs ? segs.slice(1) : segs)) {
      const next = [];
      for (const base of paths) {
        const dir = base === "" ? this.cwd : this.abs(base);
        if (!/[*?[]/.test(seg.replace(/\\./g, ""))) { const p = (base === "" ? "" : base.endsWith("/") ? base : base + "/") + seg.replace(/\\(.)/g, "$1"); if (this.fs.exists(this.abs(p), this.user)) next.push(p); continue; }
        let names; try { names = this.fs.list(dir, this.user) || []; } catch (e) { names = []; }
        const rx = globRegex(seg);
        for (const n of names) if (rx.test(n) && (!n.startsWith(".") || seg.startsWith("."))) next.push((base === "" ? "" : base.endsWith("/") ? base : base + "/") + n);
      }
      paths = next;
    }
    return paths.length ? paths.sort() : [literal];
  }

  /* ---------- arithmétique $(( )) ---------- */
  arith(src) {
    const t = src.match(/\d+|[A-Za-z_]\w*|\*\*|[<>=!]=|&&|\|\||<<|>>|\+\+|--|[-+*/%<>=!?:()&|^~]|\+=|-=|\*=|\/=/g) || [];
    let p = 0;
    const val = (n) => { const v = this.getVar(n); return v === undefined || v === "" ? 0 : /^-?\d+$/.test(v.trim()) ? parseInt(v, 10) : this.arith(v); };
    const peek = () => t[p];
    const prim = () => {
      const x = t[p++];
      if (x === "(") { const v = ternary(); p++; return v; }
      if (x === "-") return -prim();
      if (x === "+") return prim();
      if (x === "!") return prim() ? 0 : 1;
      if (x === "++" || x === "--") { const n = t[p++]; const v = val(n) + (x === "++" ? 1 : -1); this.setVar(n, String(v)); return v; }
      if (/^\d+$/.test(x)) return parseInt(x, 10);
      if (/^[A-Za-z_]/.test(x)) {
        if (peek() === "++" || peek() === "--") { const o = t[p++]; const v = val(x); this.setVar(x, String(v + (o === "++" ? 1 : -1))); return v; }
        if (["=", "+=", "-=", "*=", "/="].includes(peek())) { const o = t[p++]; const r = ternary(); const v = o === "=" ? r : o === "+=" ? val(x) + r : o === "-=" ? val(x) - r : o === "*=" ? val(x) * r : Math.trunc(val(x) / r); this.setVar(x, String(v)); return v; }
        return val(x);
      }
      throw new ShErr(this.where() + src.trim() + ": syntax error in expression");
    };
    const LV = [["||"], ["&&"], ["==", "!="], ["<", ">", "<=", ">="], ["+", "-"], ["*", "/", "%"]];
    const bin = (lv) => {
      if (lv === LV.length) { const b = prim(); if (peek() === "**") { p++; return Math.pow(b, bin(lv)); } return b; }
      let l = bin(lv + 1);
      while (LV[lv].includes(peek())) {
        const o = t[p++]; const r = bin(lv + 1);
        if ((o === "/" || o === "%") && r === 0) throw new ShErr(this.where() + src.trim() + ": division by 0 (error token is \"" + t[p - 1] + "\")");
        l = { "||": l || r ? 1 : 0, "&&": l && r ? 1 : 0, "==": +(l === r), "!=": +(l !== r), "<": +(l < r), ">": +(l > r), "<=": +(l <= r), ">=": +(l >= r), "+": l + r, "-": l - r, "*": l * r, "/": Math.trunc(l / r), "%": l % r }[o];
      }
      return l;
    };
    const ternary = () => { const c = bin(0); if (peek() === "?") { p++; const a = ternary(); p++; const b = ternary(); return c ? a : b; } return c; };
    if (!t.length) return 0;
    return ternary();
  }

  /* ---------- test, [ ] et [[ ]] ---------- */
  testArgs(a) {
    const un = (op, x) => {
      const p = this.abs(x); let n = null; try { n = this.fs.stat(p, this.user); } catch (e) { n = null; }
      switch (op) {
        case "-e": case "-a": return !!n;
        case "-f": return !!n && n.t === "f";
        case "-d": return !!n && n.t === "d";
        case "-L": case "-h": try { return this.fs.lookup(p, { user: this.user, follow: false }).node.t === "l"; } catch (e) { return false; }
        case "-s": return !!n && n.t === "f" && n.data.length > 0;
        case "-r": return !!n && this.fs.can(n, this.user, 4);
        case "-w": return !!n && this.fs.can(n, this.user, 2);
        case "-x": return !!n && this.fs.can(n, this.user, 1);
        case "-z": return x === "";
        case "-n": return x !== "";
      }
      return null;
    };
    const ints = (x, y, op) => { if (!/^\s*-?\d+\s*$/.test(x) || !/^\s*-?\d+\s*$/.test(y)) throw new ShErr(this.where() + "[: " + (!/^\s*-?\d+\s*$/.test(x) ? x : y) + ": integer expression expected", 2); const a = +x, b = +y; return { "-eq": a === b, "-ne": a !== b, "-lt": a < b, "-le": a <= b, "-gt": a > b, "-ge": a >= b }[op]; };
    const one = (a) => {
      if (a.length === 0) return false;
      if (a[0] === "!") return !one(a.slice(1));
      if (a.length === 1) return a[0] !== "";
      if (a.length === 2) { const r = un(a[0], a[1]); if (r === null) throw new ShErr(this.where() + "[: " + a[0] + ": unary operator expected", 2); return r; }
      if (a.length === 3) {
        const [x, op, y] = a;
        if (op === "=" || op === "==") return x === y;
        if (op === "!=") return x !== y;
        if (["-eq", "-ne", "-lt", "-le", "-gt", "-ge"].includes(op)) return ints(x, y, op);
        if (op === "<") return x < y; if (op === ">") return x > y;
        if (op === "-nt" || op === "-ot") return false;
      }
      const ia = a.indexOf("-a"), io = a.indexOf("-o");
      if (io > 0) return one(a.slice(0, io)) || one(a.slice(io + 1));
      if (ia > 0) return one(a.slice(0, ia)) && one(a.slice(ia + 1));
      throw new ShErr(this.where() + "[: too many arguments", 2);
    };
    return one(a);
  }
  testDouble(expr) {
    // [[ ]] : pas de découpage ni de globbing ; == compare à un motif, =~ à une regex.
    const toks = []; let i = 0;
    while (i < expr.length) {
      if (/\s/.test(expr[i])) { i++; continue; }
      if (expr.startsWith("&&", i) || expr.startsWith("||", i)) { toks.push({ op: expr.slice(i, i + 2) }); i += 2; continue; }
      if (expr[i] === "(" || expr[i] === ")") { toks.push({ op: expr[i] }); i++; continue; }
      let j = i, q = null;
      while (j < expr.length && (q || !/[\s()]/.test(expr[j]) || (expr[j] === "(" && expr[j - 1] === "$"))) { if (q) { if (expr[j] === q) q = null; } else if (expr[j] === "'" || expr[j] === '"') q = expr[j]; else if (expr[j] === "$" && expr[j + 1] === "(") { j = findClose(expr, j + 2, "(", ")") + 1; continue; } j++; }
      toks.push({ w: expr.slice(i, j) }); i = j;
    }
    let p = 0;
    const prim = () => {
      const x = toks[p];
      if (x && x.op === "(") { p++; const v = or(); p++; return v; }
      if (x && x.w === "!") { p++; return !prim(); }
      const words = []; while (p < toks.length && toks[p].w !== undefined) words.push(toks[p++].w);
      if (words.length === 3 && (words[1] === "==" || words[1] === "=" || words[1] === "!=")) { const ok = globRegex(this.expandPattern(words[2])).test(this.expandOne(words[0])); return words[1] === "!=" ? !ok : ok; }
      if (words.length === 3 && words[1] === "=~") {
        const m = new RegExp(this.expandOne(words[2])).exec(this.expandOne(words[0]));
        this.vars.set("BASH_REMATCH", m ? m[0] : ""); if (m) m.slice(1).forEach((g, k) => this.vars.set("BASH_REMATCH_" + (k + 1), g ?? ""));
        return !!m;
      }
      return this.testArgs(words.map((w) => this.expandOne(w)));
    };
    const and = () => { let v = prim(); while (toks[p] && toks[p].op === "&&") { p++; const r = prim(); v = v && r; } return v; };
    const or = () => { let v = and(); while (toks[p] && toks[p].op === "||") { p++; const r = and(); v = v || r; } return v; };
    return or();
  }
}

function findClose(s, from, open, close) {
  let depth = 1, i = from, q = null;
  while (i < s.length) {
    const c = s[i];
    if (q) { if (c === "\\") { i += 2; continue; } if (c === q) q = null; i++; continue; }
    if (c === "'" || c === '"') { q = c; i++; continue; }
    if (s.startsWith(close, i)) { if (--depth === 0) return i; i += close.length; continue; }
    if (s.startsWith(open, i)) { depth++; i += open.length; continue; }
    i++;
  }
  throw new ShErr("bash: unexpected EOF while looking for matching `" + close + "'", 2);
}

const NOT_SIMULATED = new Set(["vim", "vi", "nano", "emacs", "less", "more", "top", "htop", "ssh", "scp", "rsync", "docker", "kubectl", "git", "python3", "python", "pip", "node", "npm", "make", "gcc", "mysql", "psql", "watch", "screen", "tmux"]);

/* ===================== builtins ===================== */
const BUILTINS = {
  cd(sh, args, io) {
    const dest = args[0] === undefined || args[0] === "~" ? sh.home() : args[0] === "-" ? sh.getVar("OLDPWD") || sh.cwd : args[0];
    const p = sh.abs(dest);
    let n; try { n = sh.fs.stat(p, sh.user); } catch (e) { throw new ShErr(sh.where() + "cd: " + args[0] + ": " + errText(e.code)); }
    if (n.t !== "d") throw new ShErr(sh.where() + "cd: " + args[0] + ": Not a directory");
    if (!sh.fs.can(n, sh.user, 1)) throw new ShErr(sh.where() + "cd: " + args[0] + ": Permission denied");
    sh.vars.set("OLDPWD", sh.cwd); sh.cwd = p; sh.vars.set("PWD", p);
    if (args[0] === "-") io.out(p + "\n");
    return 0;
  },
  pwd(sh, args, io) { io.out(sh.cwd + "\n"); return 0; },
  echo(sh, args, io) {
    let n = false, e = false; let i = 0;
    while (i < args.length && /^-[neE]+$/.test(args[i])) { if (args[i].includes("n")) n = true; if (args[i].includes("e")) e = true; i++; }
    let s = args.slice(i).join(" ");
    if (e) s = s.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\\\/g, "\\");
    io.out(s + (n ? "" : "\n")); return 0;
  },
  printf(sh, args, io) {
    if (!args.length) throw new ShErr(sh.where() + "printf: usage: printf [-v var] format [arguments]", 2);
    const fmt = args[0].replace(/\\n/g, "\n").replace(/\\t/g, "\t");
    let rest = args.slice(1), out = "";
    do {
      let i = 0;
      out += fmt.replace(/%([-+ 0]*)(\d*)(?:\.(\d+))?([sdfxo%])/g, (m, fl, w, pr, c) => {
        if (c === "%") return "%";
        const v = rest[i++] ?? "";
        let s = c === "d" ? String(parseInt(v, 10) || 0) : c === "f" ? (parseFloat(v) || 0).toFixed(pr === undefined ? 6 : +pr) : c === "x" ? (parseInt(v, 10) || 0).toString(16) : c === "o" ? (parseInt(v, 10) || 0).toString(8) : pr !== undefined ? String(v).slice(0, +pr) : String(v);
        if (w && s.length < +w) s = fl.includes("-") ? s.padEnd(+w) : fl.includes("0") && c !== "s" ? s.padStart(+w, "0") : s.padStart(+w);
        return s;
      });
      rest = rest.slice(i || rest.length);
      if (!i) break;
    } while (rest.length);
    io.out(out); return 0;
  },
  export(sh, args) { for (const a of args) { if (a === "-p") continue; const m = /^([A-Za-z_]\w*)(=([\s\S]*))?$/.exec(a); if (!m) throw new ShErr(sh.where() + "export: `" + a + "': not a valid identifier"); if (m[2] !== undefined) sh.setVar(m[1], m[3]); sh.exported.add(m[1]); } return 0; },
  unset(sh, args) { for (const a of args) { if (a === "-f") continue; sh.vars.delete(a); sh.funcs.delete(a); sh.exported.delete(a); } return 0; },
  readonly(sh, args) { sh.readonly = sh.readonly || new Set(); for (const a of args) { const m = /^([A-Za-z_]\w*)(=([\s\S]*))?$/.exec(a); if (!m) continue; if (m[2] !== undefined) sh.vars.set(m[1], m[3]); sh.readonly.add(m[1]); } return 0; },
  local(sh, args) {
    const top = sh.localStack && sh.localStack[sh.localStack.length - 1];
    if (!top) throw new ShErr(sh.where() + "local: can only be used in a function");
    const saved = top.get("__saved__") || []; top.set("__saved__", saved);
    for (const a of args) { const m = /^([A-Za-z_]\w*)(=([\s\S]*))?$/.exec(a); if (!m) continue; saved.push([m[1], sh.vars.get(m[1])]); sh.vars.set(m[1], m[2] !== undefined ? m[3] : ""); }
    return 0;
  },
  declare(sh, args) { return BUILTINS.export(sh, args.filter((a) => !a.startsWith("-"))) && 0; },
  set(sh, args, io) {
    if (!args.length) { for (const [k, v] of [...sh.vars].sort()) io.out(k + "=" + v + "\n"); return 0; }
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === "-o" || a === "+o") { const name = args[++i]; if (name === "pipefail") sh.opts.pipefail = a === "-o"; else if (name === "errexit") sh.opts.e = a === "-o"; else if (name === "nounset") sh.opts.u = a === "-o"; continue; }
      if (a === "--") { sh.positional = args.slice(i + 1); break; }
      if (/^[-+][euxo]+$/.test(a)) { const on = a[0] === "-"; for (const c of a.slice(1)) { if (c === "o") { const name = args[++i]; if (name === "pipefail") sh.opts.pipefail = on; continue; } sh.opts[c] = on; } continue; }
      sh.positional = args.slice(i); break;
    }
    return 0;
  },
  shift(sh, args) { const n = args[0] ? +args[0] : 1; if (n > sh.positional.length) return 1; sh.positional = sh.positional.slice(n); return 0; },
  exit(sh, args) { throw new ExitSig(args[0] !== undefined ? (+args[0] & 255) : sh.status); },
  return(sh, args) { throw new ReturnSig(args[0] !== undefined ? +args[0] : sh.status); },
  break(sh, args) { throw new LoopSig("break", +(args[0] || 1)); },
  continue(sh, args) { throw new LoopSig("continue", +(args[0] || 1)); },
  true: () => 0,
  false: () => 1,
  ":": () => 0,
  test(sh, args) { return sh.testArgs(args) ? 0 : 1; },
  "["(sh, args) { if (args[args.length - 1] !== "]") throw new ShErr(sh.where() + "[: missing `]'", 2); return sh.testArgs(args.slice(0, -1)) ? 0 : 1; },
  read(sh, args, io) {
    let names = [], raw = false, prompt = null;
    for (let i = 0; i < args.length; i++) { if (args[i] === "-r") raw = true; else if (args[i] === "-p") prompt = args[++i]; else names.push(args[i]); }
    if (prompt) io.err(prompt);
    if (!io.stdin) return 1;
    const nl = io.stdin.indexOf("\n"); let line = nl < 0 ? io.stdin : io.stdin.slice(0, nl);
    io.stdin = nl < 0 ? "" : io.stdin.slice(nl + 1);
    if (!raw) line = line.replace(/\\(.)/g, "$1");
    if (!names.length) names = ["REPLY"];
    const parts = line.trim().split(/[ \t]+/);
    names.forEach((n, k) => sh.setVar(n, k === names.length - 1 ? parts.slice(k).join(" ") : parts[k] ?? ""));
    return nl < 0 && line === "" ? 1 : 0;
  },
  source(sh, args, io) {
    const p = sh.abs(args[0] || ""); let src;
    try { src = sh.fs.read(p, sh.user); } catch (e) { throw new ShErr(sh.where() + args[0] + ": " + errText(e.code)); }
    const save = sh.positional; if (args.length > 1) sh.positional = args.slice(1);
    try { return sh.execList(parse(src), io); } finally { sh.positional = save; }
  },
  ".": (sh, args, io) => BUILTINS.source(sh, args, io),
  type(sh, args, io) {
    let code = 0;
    for (const a of args) {
      if (sh.funcs.has(a)) io.out(a + " is a function\n");
      else if (BUILTINS[a]) io.out(a + " is a shell builtin\n");
      else if (COMMANDS[a]) io.out(a + " is /usr/bin/" + a + "\n");
      else { io.err(sh.where() + "type: " + a + ": not found\n"); code = 1; }
    }
    return code;
  },
  history(sh, args, io) { sh.history.forEach((h, i) => io.out(String(i + 1).padStart(5) + "  " + h + "\n")); return 0; },
  umask(sh, args, io) { if (!args.length) { io.out(sh.fs.umask.toString(8).padStart(4, "0") + "\n"); return 0; } sh.fs.umask = parseInt(args[0], 8); return 0; },
  eval(sh, args, io) { return sh.execList(parse(args.join(" ")), io); },
  wait: () => 0,
  trap(sh, args) {
    if (!args.length || args[0] === "-l" || args[0] === "-p") return 0;
    const [cmd, ...sigs] = args; sh.traps = { ...(sh.traps || {}) };
    for (const g of sigs) sh.traps[g.replace(/^SIG/, "")] = cmd === "-" ? undefined : cmd;
    return 0;
  },
  alias: () => 0,
  exec(sh, args, io) { if (!args.length) return 0; const c = sh.invoke(args[0], args.slice(1), io); throw new ExitSig(c); },
};
/* bash / sh : lancer un script sans droit d'exécution, ou une commande avec -c */
BUILTINS.bash = BUILTINS.sh = (sh, args, io) => {
  let i = 0, x = false, n = false;
  while (args[i] && args[i].startsWith("-") && args[i] !== "-c") { if (args[i].includes("x")) x = true; if (args[i].includes("n")) n = true; i++; }
  if (args[i] === "-c") { const s = sh.subshell(); s.positional = args.slice(i + 2); try { return s.execList(parse(args[i + 1] || ""), io); } catch (e) { if (e instanceof ExitSig) return e.code; if (e instanceof ParseError) { io.err("bash: -c: " + e.message + "\n"); return 2; } throw e; } }
  const file = args[i]; if (!file) { io.err("bash : le mode interactif imbriqué n'est pas simulé.\n"); return 0; }
  const p = sh.abs(file); let src;
  try { src = sh.fs.read(p, sh.user); } catch (e) { io.err("bash: " + file + ": " + errText(e.code) + "\n"); return 127; }
  if (n) { try { parse(src); return 0; } catch (e) { io.err(file + ": " + e.message + "\n"); return 2; } }
  const save = sh.opts.x; const code = sh.runScript(src, file, args.slice(i + 1), io, { x });
  sh.opts.x = save; return code;
};
export const BUILTIN_NAMES = Object.keys(BUILTINS);

/* ===================== critères de vérification ===================== */
/**
 * checks : { cwd, files: {chemin: null | "contenu exact" | {contains, mode, owner, group, type, target, lines}},
 *            output, outputHas, exit, services: {nom: "active"|"inactive"}, enabled: {nom: bool},
 *            env: {VAR: valeur}, groups: {utilisateur: [groupes]}, users: [noms], cron: [fragments], packages: [noms], processes: {absent: [], present: []} }
 */
export function evaluate(sh, checks) {
  const out = []; const push = (ok, label) => out.push({ ok: !!ok, label });
  const node = (p) => { try { return sh.fs.lookup(p, { user: "root", follow: false }).node; } catch (e) { return null; } };
  const norm = (s) => String(s).replace(/\r/g, "").replace(/[ \t]+$/gm, "").replace(/\n+$/, "");
  for (const [k, v] of Object.entries(checks || {})) {
    switch (k) {
      case "cwd": push(sh.cwd === v, "Tu es dans " + v); break;
      case "files":
        for (const [p, spec] of Object.entries(v)) {
          const n = node(p);
          if (spec === null) { push(!n, p + " n'existe pas"); continue; }
          if (typeof spec === "string") { push(n && n.t === "f" && norm(n.data) === norm(spec), p + " contient exactement le texte attendu"); continue; }
          if (spec.type) push(n && n.t === spec.type, p + " est " + ({ f: "un fichier", d: "un dossier", l: "un lien symbolique" })[spec.type]);
          else push(!!n, p + " existe");
          if (spec.target !== undefined) push(n && n.t === "l" && n.target === spec.target, p + " pointe vers " + spec.target);
          if (spec.contains !== undefined) for (const c of [].concat(spec.contains)) push(n && n.t === "f" && n.data.includes(c), p + " contient « " + c + " »");
          if (spec.lacks !== undefined) for (const c of [].concat(spec.lacks)) push(n && n.t === "f" && !n.data.includes(c), p + " ne contient pas « " + c + " »");
          if (spec.lines !== undefined) push(n && n.t === "f" && n.data.replace(/\n$/, "").split("\n").length === spec.lines, p + " a " + spec.lines + " lignes");
          if (spec.mode !== undefined) push(n && (n.mode & 0o777).toString(8) === spec.mode, p + " a les droits " + spec.mode);
          if (spec.owner !== undefined) push(n && n.owner === spec.owner, p + " appartient à " + spec.owner);
          if (spec.group !== undefined) push(n && n.group === spec.group, p + " appartient au groupe " + spec.group);
          if (spec.executable !== undefined) push(n && ((n.mode & 0o100) !== 0) === spec.executable, p + (spec.executable ? " est exécutable" : " n'est pas exécutable"));
        }
        break;
      case "output": { const sq = (x) => norm(x).replace(/\s+/g, " ").trim(); push(norm(sh.lastOut) === norm(v) || sq(sh.lastOut) === sq(v), "La dernière commande affiche exactement le résultat attendu"); break; }
      case "outputHas": for (const c of [].concat(v)) push(sh.lastOut.includes(c), "La dernière commande affiche « " + c + " »"); break;
      case "exit": push(sh.lastCode === v, "La dernière commande se termine avec le code " + v); break;
      case "services": for (const [s, st] of Object.entries(v)) push(sh.services[s] && (sh.services[s].active ? "active" : sh.services[s].failed ? "failed" : "inactive") === st, "Le service " + s + " est " + ({ active: "démarré", inactive: "arrêté", failed: "en échec" })[st]); break;
      case "enabled": for (const [s, en] of Object.entries(v)) push(sh.services[s] && !!sh.services[s].enabled === en, "Le service " + s + (en ? " démarre au boot" : " ne démarre pas au boot")); break;
      case "env": for (const [n, val] of Object.entries(v)) push(sh.vars.get(n) === val && sh.exported.has(n), "La variable " + n + " vaut « " + val + " » et est exportée"); break;
      case "groups": for (const [u, gs] of Object.entries(v)) push(sh.fs.users[u] && gs.every((g) => sh.fs.groupsOf(u).includes(g)), u + " fait partie de " + gs.join(", ")); break;
      case "users": for (const u of v) push(!!sh.fs.users[u], "L'utilisateur " + u + " existe"); break;
      case "cron": for (const c of v) push(Object.values(sh.cron).some((t) => t.includes(c)), "La crontab contient « " + c + " »"); break;
      case "packages": for (const p of v) push(sh.packages.has(p), "Le paquet " + p + " est installé"); break;
      case "processes":
        for (const n of v.absent || []) push(!sh.procs.some((p) => p.cmd.includes(n)), "Plus aucun processus « " + n + " »");
        for (const n of v.present || []) push(sh.procs.some((p) => p.cmd.includes(n)), "Un processus « " + n + " » tourne");
        break;
      default: if (EXTRA_CHECKS[k]) { EXTRA_CHECKS[k](sh, v, push); break; } throw new Error("critère de vérification inconnu : " + k);
    }
  }
  return out;
}

/** Prépare un monde : fichiers, dossiers, droits, puis commandes de mise en place (en root si préfixées par #). */
export function createShell(setup = {}) {
  const sh = new Shell(setup);
  for (const [p, spec] of Object.entries(setup.files || {})) {
    const s = typeof spec === "string" ? { content: spec } : spec;
    sh.fs.mkdir(dirname(p), "root", { parents: true });
    if (s.dir) sh.fs.mkdir(p, "root", { parents: true });
    else sh.fs.write(p, s.content || "", "root");
    const n = sh.fs.stat(p, "root");
    n.owner = s.owner || (p.startsWith(sh.home()) ? sh.user : "root"); n.group = s.group || n.owner;
    // Les dossiers créés pour l'occasion dans le dossier personnel appartiennent à l'élève.
    for (let d = dirname(p); d.startsWith(sh.home() + "/"); d = dirname(d)) { const dn = sh.fs.stat(d, "root"); dn.owner = sh.user; dn.group = sh.user; }
    if (s.mode) n.mode = parseInt(s.mode, 8); else if (s.dir) n.mode = 0o755;
    if (s.bytes !== undefined) n.bytes = s.bytes;
    if (s.age !== undefined) n.mtime = new Date(Date.UTC(2026, 10, 12, 9, 30, 0) - s.age * 86400000);
  }
  for (const [name, svc] of Object.entries(setup.services || {})) {
    const routes = svc.routes || {};
    addService(sh, name, { desc: svc.desc || name, exec: svc.exec || "/usr/bin/" + name, ports: svc.ports || [], active: svc.active !== false, enabled: svc.enabled !== false, user: svc.user || "root", bindMsg: svc.bindMsg,
      http: (path) => (routes[path] ? { status: routes[path][0], type: "application/json", body: routes[path][1], server: "uvicorn" } : null) });
    // Journal de mise en place : le service a démarré, a écrit ses lignes, puis systemd a constaté l'échec.
    const at = () => new Date(Date.UTC(2026, 10, 12, 9, 30, 0) + sh.journal.length * 1000);
    const push = (src, msg, prio) => sh.journal.push({ unit: name, src, msg, prio, ts: at() });
    for (const l of svc.journal || []) push((svc.src || name) + "[" + sh.services[name].pid + "]", l, /error|failed|exception/i.test(l) ? 3 : 6);
    if (svc.failed) {
      sh.services[name].active = false; sh.services[name].failed = true; sh.procs = sh.procs.filter((p) => p.service !== name);
      sh.journal = sh.journal.filter((e) => !(e.unit === name && e.src === "systemd[1]"));
      sh.journal.splice(sh.journal.findIndex((e) => e.unit === name), 0, { unit: name, src: "systemd[1]", msg: "Started " + name + ".service - " + (svc.desc || name) + ".", prio: 6 });
      push("systemd[1]", name + ".service: Main process exited, code=exited, status=1/FAILURE", 4);
      push("systemd[1]", name + ".service: Failed with result 'exit-code'.", 4);
      sh.journal.forEach((e, i) => { if (e.unit === name) e.ts = new Date(Date.UTC(2026, 10, 12, 9, 30, 0) + i * 1000); });
    }
  }
  for (const p of setup.procs || []) sh.procs.push({ cpu: 0, mem: 0.1, user: sh.user, ...p });
  for (const h of SETUP_HOOKS) h(sh, setup);
  for (const line of setup.commands || []) {
    const asRoot = line.startsWith("#");
    const save = sh.user; if (asRoot) sh.user = "root";
    const r = sh.run(asRoot ? line.slice(1).trim() : line, { record: false });
    sh.user = save;
    if (r.code !== 0 && !setup.allowFail) throw new Error("mise en place invalide : « " + line + " » → " + (r.err || r.out).trim());
  }
  for (const h of SETUP_HOOKS) if (h.after) h.after(sh, setup);
  if (setup.cwd) sh.cwd = sh.abs(setup.cwd);
  sh.lastOut = ""; sh.lastCode = 0; sh.status = 0;
  return sh;
}
export { basename };
