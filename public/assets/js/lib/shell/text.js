/* Outils de texte : expressions régulières POSIX, motifs du shell, sed et awk (sous-ensembles). */

/** Convertit une regex POSIX (BRE par défaut, ERE si extended) en RegExp JavaScript. */
export function posixRegex(src, { extended = false, flags = "" } = {}) {
  let out = "", i = 0;
  const classes = { "[:alpha:]": "a-zA-Z", "[:digit:]": "0-9", "[:alnum:]": "a-zA-Z0-9", "[:space:]": "\\s", "[:upper:]": "A-Z", "[:lower:]": "a-z", "[:punct:]": "!-\\/:-@\\[-`{-~", "[:xdigit:]": "0-9A-Fa-f" };
  while (i < src.length) {
    const c = src[i];
    if (c === "[") { // classe de caractères
      let j = i + 1, body = "";
      if (src[j] === "^") { body += "^"; j++; }
      if (src[j] === "]") { body += "\\]"; j++; }
      while (j < src.length && src[j] !== "]") {
        const cl = Object.keys(classes).find((k) => src.startsWith(k, j));
        if (cl) { body += classes[cl]; j += cl.length; continue; }
        body += src[j] === "\\" ? "\\\\" : src[j]; j++;
      }
      out += "[" + body + "]"; i = j + 1; continue;
    }
    if (c === "\\" && i + 1 < src.length) {
      const d = src[i + 1];
      if (!extended && "(){}|+?".includes(d)) out += d; // \( en BRE = groupe
      else if (/[0-9]/.test(d)) out += "\\" + d;
      else if (d === "<" || d === ">") out += "\\b";
      else out += "\\" + d;
      i += 2; continue;
    }
    if (!extended && "(){}|+?".includes(c)) { out += "\\" + c; i++; continue; }
    out += c; i++;
  }
  return new RegExp(out, flags);
}

/** Motif du shell (* ? [..]) vers RegExp ancrée. */
export function globRegex(pat, { anchored = true } = {}) {
  let rx = "";
  for (let i = 0; i < pat.length; i++) {
    const c = pat[i];
    if (c === "\\") { rx += "\\" + (pat[++i] || "\\"); continue; }
    if (c === "*") rx += ".*";
    else if (c === "?") rx += ".";
    else if (c === "[") { const e = pat.indexOf("]", i + 2); if (e < 0) { rx += "\\["; continue; } rx += "[" + pat.slice(i + 1, e).replace(/^!/, "^") + "]"; i = e; }
    else rx += c.replace(/[.+^${}()|\\/]/g, "\\$&");
  }
  return new RegExp(anchored ? "^" + rx + "$" : rx);
}

/* ===================== sed ===================== */
function parseSedScript(script, extended) {
  const cmds = []; let i = 0;
  const skip = () => { while (i < script.length && /[\s;]/.test(script[i])) i++; };
  const readDelim = (d) => { let s = ""; while (i < script.length && script[i] !== d) { if (script[i] === "\\" && script[i + 1] === d) { s += d; i += 2; continue; } if (script[i] === "\\") { s += script[i] + script[i + 1]; i += 2; continue; } s += script[i++]; } i++; return s; };
  const readAddr = () => {
    if (/\d/.test(script[i] || "")) { let n = ""; while (/\d/.test(script[i])) n += script[i++]; return { line: +n }; }
    if (script[i] === "$") { i++; return { last: true }; }
    if (script[i] === "/") { i++; return { re: posixRegex(readDelim("/"), { extended }) }; }
    return null;
  };
  while (skip(), i < script.length) {
    const a1 = readAddr(); let a2 = null;
    if (a1 && script[i] === ",") { i++; a2 = readAddr(); }
    let neg = false; if (script[i] === "!") { neg = true; i++; }
    const c = script[i++];
    if (c === "s") {
      const d = script[i++]; const re = readDelim(d), rep = readDelim(d); let fl = "";
      while (i < script.length && /[gipI0-9]/.test(script[i])) fl += script[i++];
      cmds.push({ a1, a2, neg, c, re: posixRegex(re, { extended, flags: (fl.includes("g") ? "g" : "") + (/[iI]/.test(fl) ? "i" : "") }), rep, print: fl.includes("p") });
    } else if ("dpq=".includes(c)) cmds.push({ a1, a2, neg, c });
    else if ("aic".includes(c)) { while (script[i] === " " || script[i] === "\\") i++; let txt = ""; while (i < script.length && script[i] !== "\n" && script[i] !== ";") txt += script[i++]; cmds.push({ a1, a2, neg, c, txt }); }
    else throw new Error("unknown command: `" + c + "'");
  }
  return cmds;
}
function sedReplacement(rep) {
  return (m, ...g) => rep.replace(/\\(\d)|\\n|\\t|\\(.)|&/g, (x, d, e) => (d ? g[+d - 1] ?? "" : x === "\\n" ? "\n" : x === "\\t" ? "\t" : e !== undefined ? e : m));
}
export function sed(input, scripts, { quiet = false, extended = false } = {}) {
  const cmds = scripts.flatMap((s) => parseSedScript(s, extended));
  const lines = input.split("\n"); if (lines[lines.length - 1] === "") lines.pop();
  const out = []; const ranges = new Map();
  const match = (a, n, l, last) => (a.line ? n === a.line : a.last ? last : a.re.test(l));
  for (let n = 1; n <= lines.length; n++) {
    let l = lines[n - 1], del = false; const last = n === lines.length; const after = [];
    for (const [k, cmd] of cmds.entries()) {
      let on;
      if (!cmd.a1) on = true;
      else if (!cmd.a2) on = match(cmd.a1, n, l, last);
      else { let r = ranges.get(k); if (!r && match(cmd.a1, n, l, last)) { r = true; ranges.set(k, true); on = true; if (cmd.a2.line && cmd.a2.line <= n) ranges.delete(k); } else if (r) { on = true; if (match(cmd.a2, n, l, last)) ranges.delete(k); } else on = false; }
      if (cmd.neg) on = !on;
      if (!on) continue;
      if (cmd.c === "s") { cmd.re.lastIndex = 0; const was = l; l = l.replace(cmd.re, sedReplacement(cmd.rep)); if (cmd.print && l !== was) out.push(l); }
      else if (cmd.c === "d") { del = true; break; }
      else if (cmd.c === "p") out.push(l);
      else if (cmd.c === "=") out.push(String(n));
      else if (cmd.c === "a") after.push(cmd.txt);
      else if (cmd.c === "i") out.push(cmd.txt);
      else if (cmd.c === "c") { out.push(cmd.txt); del = true; break; }
      else if (cmd.c === "q") { if (!quiet) out.push(l); return out.join("\n") + (out.length ? "\n" : ""); }
    }
    if (!del && !quiet) out.push(l);
    out.push(...after);
  }
  return out.join("\n") + (out.length ? "\n" : "");
}

/* ===================== awk ===================== */
/* Sous-ensemble : BEGIN / END, motifs (regex, expressions), print, printf, variables,
   tableaux associatifs, if / else, for (k in t), for(;;), while, NR, NF, FS, OFS, $n,
   fonctions length, substr, index, split, toupper, tolower, int, sprintf, gsub, sub. */
function awkLex(src) {
  const t = []; let i = 0;
  const regexOk = () => { const p = t[t.length - 1]; return !p || (p.k === "op" && !["]", ")"].includes(p.v)) || p.k === "nl" || (p.k === "id" && ["print", "printf", "return", "in"].includes(p.v)); };
  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "\t") { i++; continue; }
    if (c === "\\" && src[i + 1] === "\n") { i += 2; continue; }
    if (c === "#") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "\n" || c === ";") { t.push({ k: "nl" }); i++; continue; }
    if (c === '"') { let s = "", j = i + 1; while (j < src.length && src[j] !== '"') { if (src[j] === "\\") { const d = src[j + 1]; s += d === "n" ? "\n" : d === "t" ? "\t" : d; j += 2; } else s += src[j++]; } t.push({ k: "str", v: s }); i = j + 1; continue; }
    if (c === "/" && regexOk()) { let s = "", j = i + 1; while (j < src.length && src[j] !== "/") { if (src[j] === "\\" && src[j + 1] === "/") { s += "/"; j += 2; continue; } s += src[j++]; } t.push({ k: "re", v: s }); i = j + 1; continue; }
    const num = /^\d+(\.\d+)?/.exec(src.slice(i)); if (num) { t.push({ k: "num", v: +num[0] }); i += num[0].length; continue; }
    const id = /^[A-Za-z_]\w*/.exec(src.slice(i)); if (id) { t.push({ k: "id", v: id[0] }); i += id[0].length; continue; }
    const op = ["+=", "-=", "*=", "/=", "%=", "++", "--", "==", "!=", "<=", ">=", "&&", "||", "!~", "~", "+", "-", "*", "/", "%", "<", ">", "!", "=", "(", ")", "{", "}", "[", "]", ",", "$", "?", ":", "^"].find((o) => src.startsWith(o, i));
    if (!op) throw new Error("syntax error at source line 1: " + c);
    t.push({ k: "op", v: op }); i += op.length;
  }
  t.push({ k: "eof" });
  return t;
}
function awkParse(src) {
  const t = awkLex(src); let p = 0;
  const peek = () => t[p], next = () => t[p++];
  const isOp = (v) => peek().k === "op" && peek().v === v;
  const isId = (v) => peek().k === "id" && peek().v === v;
  const eat = (v) => { if (!isOp(v)) throw new Error("syntax error: expected " + v); p++; };
  const nls = () => { while (peek().k === "nl") p++; };
  function block() { nls(); eat("{"); const body = []; nls(); while (!isOp("}")) { body.push(stmt()); nls(); } eat("}"); return body; }
  function simpleOrBlock() { nls(); if (isOp("{")) return block(); return [stmt()]; }
  function stmt() {
    if (isOp("{")) return { k: "blk", body: block() };
    if (isId("print") || isId("printf")) {
      const kind = next().v; const args = [];
      if (!(peek().k === "nl" || isOp("}") || isOp(">"))) { args.push(expr(true)); while (isOp(",")) { p++; args.push(expr(true)); } }
      let dest = null; if (isOp(">") || (peek().k === "op" && peek().v === ">>")) { p++; dest = expr(); }
      return { k: kind, args, dest };
    }
    if (isId("if")) { p++; eat("("); const c = expr(); eat(")"); const th = simpleOrBlock(); let el = null; const save = p; nls(); if (isId("else")) { p++; el = simpleOrBlock(); } else p = save; return { k: "if", c, th, el }; }
    if (isId("while")) { p++; eat("("); const c = expr(); eat(")"); return { k: "while", c, body: simpleOrBlock() }; }
    if (isId("for")) {
      p++; eat("(");
      if (peek().k === "id" && t[p + 1].k === "id" && t[p + 1].v === "in") { const v = next().v; p++; const arr = next().v; eat(")"); return { k: "forin", v, arr, body: simpleOrBlock() }; }
      const init = isOp(";") ? null : expr(); if (peek().k === "nl") p++; const c = expr(); if (peek().k === "nl") p++; const step = isOp(")") ? null : expr(); eat(")");
      return { k: "for", init, c, step, body: simpleOrBlock() };
    }
    if (isId("next")) { p++; return { k: "next" }; }
    if (isId("exit")) { p++; return { k: "exit" }; }
    if (isId("delete")) { p++; return { k: "delete", e: expr() }; }
    return { k: "expr", e: expr() };
  }
  // Expressions (précédence d'awk, simplifiée)
  function expr(noGt) { return ternary(noGt); }
  function ternary(noGt) { const c = or(noGt); if (isOp("?")) { p++; const a = ternary(noGt); eat(":"); const b = ternary(noGt); return { k: "?", c, a, b }; } return c; }
  function or(noGt) { let l = and(noGt); while (isOp("||")) { p++; l = { k: "||", l, r: and(noGt) }; } return l; }
  function and(noGt) { let l = inExpr(noGt); while (isOp("&&")) { p++; l = { k: "&&", l, r: inExpr(noGt) }; } return l; }
  function inExpr(noGt) { let l = match(noGt); if (isId("in")) { p++; l = { k: "in", key: l, arr: next().v }; } return l; }
  function match(noGt) { let l = cmp(noGt); while (isOp("~") || isOp("!~")) { const o = next().v; l = { k: o, l, r: cmp(noGt) }; } return l; }
  function cmp(noGt) { let l = concat(); while (["<", "<=", "==", "!=", ">=", ...(noGt ? [] : [">"])].some((o) => isOp(o))) { const o = next().v; l = { k: "cmp", o, l, r: concat() }; } return l; }
  function concat() {
    let l = add();
    while (peek().k === "str" || peek().k === "num" || (peek().k === "id" && !["in", "if", "else"].includes(peek().v)) || isOp("$") || isOp("(") || (isOp("!") && false) || (isOp("-") && false)) l = { k: "cat", l, r: add() };
    return l;
  }
  function add() { let l = mul(); while (isOp("+") || isOp("-")) { const o = next().v; l = { k: "bin", o, l, r: mul() }; } return l; }
  function mul() { let l = pow(); while (isOp("*") || isOp("/") || isOp("%")) { const o = next().v; l = { k: "bin", o, l, r: pow() }; } return l; }
  function pow() { const l = unary(); if (isOp("^")) { p++; return { k: "bin", o: "^", l, r: pow() }; } return l; }
  function unary() { if (isOp("!")) { p++; return { k: "not", e: unary() }; } if (isOp("-")) { p++; return { k: "neg", e: unary() }; } if (isOp("+")) { p++; return unary(); } return assign(); }
  function assign() {
    const l = postfix();
    if (["=", "+=", "-=", "*=", "/=", "%="].some((o) => isOp(o)) && (l.k === "var" || l.k === "idx" || l.k === "field")) { const o = next().v; return { k: "asg", o, l, r: expr() }; }
    if ((isOp("++") || isOp("--")) && (l.k === "var" || l.k === "idx" || l.k === "field")) { const o = next().v; return { k: "post", o, l }; }
    return l;
  }
  function postfix() {
    if (isOp("++") || isOp("--")) { const o = next().v; const l = primary(); return { k: "asg", o: o === "++" ? "+=" : "-=", l, r: { k: "num", v: 1 } }; }
    return primary();
  }
  function primary() {
    const x = next();
    if (x.k === "num") return { k: "num", v: x.v };
    if (x.k === "str") return { k: "str", v: x.v };
    if (x.k === "re") return { k: "re", v: x.v };
    if (x.k === "op" && x.v === "$") return { k: "field", e: primary() };
    if (x.k === "op" && x.v === "(") { const e = expr(); eat(")"); return e; }
    if (x.k === "id") {
      if (isOp("(")) { p++; const args = []; if (!isOp(")")) { args.push(expr()); while (isOp(",")) { p++; args.push(expr()); } } eat(")"); return { k: "call", f: x.v, args }; }
      if (isOp("[")) { p++; const keys = [expr()]; while (isOp(",")) { p++; keys.push(expr()); } eat("]"); return { k: "idx", a: x.v, keys }; }
      return { k: "var", v: x.v };
    }
    throw new Error("syntax error at source line 1");
  }
  const rules = [];
  nls();
  while (peek().k !== "eof") {
    let pat = null;
    if (isId("BEGIN") || isId("END")) pat = next().v;
    else if (!isOp("{")) { pat = expr(); if (isOp(",")) { p++; pat = { k: "range", a: pat, b: expr() }; } }
    const body = isOp("{") ? block() : null;
    rules.push({ pat, body });
    nls();
  }
  return rules;
}
const num = (v) => { if (typeof v === "number") return v; const m = /^\s*[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?/.exec(String(v)); return m ? parseFloat(m[0]) : 0; };
const fmtNum = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 1e6) / 1e6));
const str = (v) => (typeof v === "number" ? fmtNum(v) : v === undefined ? "" : String(v));
const looksNum = (v) => typeof v === "number" || /^\s*[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?\s*$/.test(String(v));
export function sprintf(fmt, args) {
  let i = 0;
  return fmt.replace(/%([-+ 0#]*)(\d+|\*)?(?:\.(\d+))?([sdifgeExXoc%])/g, (m, fl, w, prec, c) => {
    if (c === "%") return "%";
    let v = args[i++]; let s;
    if (w === "*") { w = String(num(v)); v = args[i++]; }
    if (c === "d" || c === "i") s = String(Math.trunc(num(v)));
    else if (c === "f") s = num(v).toFixed(prec === undefined ? 6 : +prec);
    else if (c === "g") s = fmtNum(num(v));
    else if (c === "e" || c === "E") s = num(v).toExponential(prec === undefined ? 6 : +prec);
    else if (c === "x" || c === "X") { s = Math.trunc(num(v)).toString(16); if (c === "X") s = s.toUpperCase(); }
    else if (c === "o") s = Math.trunc(num(v)).toString(8);
    else if (c === "c") s = typeof v === "number" ? String.fromCharCode(v) : str(v).charAt(0);
    else { s = str(v); if (prec !== undefined) s = s.slice(0, +prec); }
    if (fl.includes("+") && /[dif]/.test(c) && num(v) >= 0) s = "+" + s;
    const width = w ? +w : 0;
    if (s.length < width) s = fl.includes("-") ? s.padEnd(width) : fl.includes("0") && /[difx]/.test(c) ? s.padStart(width, "0") : s.padStart(width);
    return s;
  });
}
export function awk(input, program, { fs = null, vars = {} } = {}) {
  const rules = awkParse(program);
  const V = Object.assign({ FS: fs === null ? " " : fs, OFS: " ", ORS: "\n", NR: 0, NF: 0, SUBSEP: "\x1c" }, vars);
  const A = {}; let out = ""; let fields = [""]; let exiting = false;
  const split = (line) => {
    if (V.FS === " ") return line.trim() === "" ? [] : line.trim().split(/[ \t]+/);
    if (V.FS.length === 1 && V.FS !== "\\") return line.split(V.FS);
    return line.split(new RegExp(V.FS));
  };
  const setRecord = (line) => { fields = [line, ...split(line)]; V.NF = fields.length - 1; };
  const rebuild = () => { fields[0] = fields.slice(1).join(V.OFS); };
  const getv = (n) => (n in V ? V[n] : "");
  class Next {} class Exit {}
  const ev = (e) => {
    switch (e.k) {
      case "num": return e.v;
      case "str": return e.v;
      case "re": return posixRegex(e.v, { extended: true }).test(fields[0]) ? 1 : 0;
      case "field": { const n = Math.trunc(num(ev(e.e))); return n === 0 ? fields[0] : fields[n] ?? ""; }
      case "var": return getv(e.v);
      case "idx": { const t = A[e.a] || (A[e.a] = {}); const k = e.keys.map((x) => str(ev(x))).join(V.SUBSEP); return t[k] ?? ""; }
      case "in": { const t = A[e.arr] || {}; return str(ev(e.key)) in t ? 1 : 0; }
      case "cat": return str(ev(e.l)) + str(ev(e.r));
      case "bin": { const a = num(ev(e.l)), b = num(ev(e.r)); return e.o === "+" ? a + b : e.o === "-" ? a - b : e.o === "*" ? a * b : e.o === "/" ? a / b : e.o === "%" ? a % b : Math.pow(a, b); }
      case "neg": return -num(ev(e.e));
      case "not": return truthy(ev(e.e)) ? 0 : 1;
      case "&&": return truthy(ev(e.l)) && truthy(ev(e.r)) ? 1 : 0;
      case "||": return truthy(ev(e.l)) || truthy(ev(e.r)) ? 1 : 0;
      case "?": return truthy(ev(e.c)) ? ev(e.a) : ev(e.b);
      case "~": case "!~": { const r = e.r.k === "re" ? e.r.v : str(ev(e.r)); const ok = posixRegex(r, { extended: true }).test(str(ev(e.l))); return (e.k === "~") === ok ? 1 : 0; }
      case "cmp": {
        const a = ev(e.l), b = ev(e.r);
        const both = looksNum(a) && looksNum(b);
        const x = both ? num(a) : str(a), y = both ? num(b) : str(b);
        return ({ "<": x < y, "<=": x <= y, "==": x === y, "!=": x !== y, ">=": x >= y, ">": x > y })[e.o] ? 1 : 0;
      }
      case "asg": {
        const cur = ev(e.l); const r = ev(e.r);
        const v = e.o === "=" ? r : e.o === "+=" ? num(cur) + num(r) : e.o === "-=" ? num(cur) - num(r) : e.o === "*=" ? num(cur) * num(r) : e.o === "/=" ? num(cur) / num(r) : num(cur) % num(r);
        setl(e.l, v); return v;
      }
      case "post": { const cur = num(ev(e.l)); setl(e.l, e.o === "++" ? cur + 1 : cur - 1); return cur; }
      case "call": return call(e);
      case "range": return 0;
    }
    throw new Error("awk: expression non gérée");
  };
  const truthy = (v) => (typeof v === "number" ? v !== 0 : v !== "" && !(looksNum(v) && num(v) === 0 && /^\s*[-+]?0*\.?0*\s*$/.test(v)));
  const setl = (l, v) => {
    if (l.k === "var") V[l.v] = v;
    else if (l.k === "idx") { const t = A[l.a] || (A[l.a] = {}); t[l.keys.map((x) => str(ev(x))).join(V.SUBSEP)] = v; }
    else if (l.k === "field") { const n = Math.trunc(num(ev(l.e))); if (n === 0) setRecord(str(v)); else { while (fields.length <= n) fields.push(""); fields[n] = str(v); V.NF = fields.length - 1; rebuild(); } }
  };
  const call = (e) => {
    const a = e.args;
    switch (e.f) {
      case "length": return a.length ? (A[a[0].v] && a[0].k === "var" ? Object.keys(A[a[0].v]).length : str(ev(a[0])).length) : fields[0].length;
      case "substr": { const s = str(ev(a[0])); const st = Math.round(num(ev(a[1]))); const n = a[2] ? Math.round(num(ev(a[2]))) : Infinity; const b = Math.max(st, 1); const e2 = n === Infinity ? s.length + 1 : st + n; return s.slice(b - 1, Math.max(e2 - 1, b - 1)); }
      case "index": return str(ev(a[0])).indexOf(str(ev(a[1]))) + 1;
      case "toupper": return str(ev(a[0])).toUpperCase();
      case "tolower": return str(ev(a[0])).toLowerCase();
      case "int": return Math.trunc(num(ev(a[0])));
      case "sqrt": return Math.sqrt(num(ev(a[0])));
      case "sprintf": return sprintf(str(ev(a[0])), a.slice(1).map(ev));
      case "split": { const s = str(ev(a[0])); const sep = a[2] ? (a[2].k === "re" ? new RegExp(a[2].v) : str(ev(a[2]))) : V.FS === " " ? /[ \t]+/ : V.FS; const parts = (V.FS === " " && !a[2] ? s.trim() : s).split(sep); A[a[1].v] = {}; parts.forEach((x, i) => { A[a[1].v][i + 1] = x; }); return parts.length; }
      case "gsub": case "sub": {
        const re = a[0].k === "re" ? a[0].v : str(ev(a[0])); const rep = str(ev(a[1])); const target = a[2] || { k: "field", e: { k: "num", v: 0 } };
        const rx = posixRegex(re, { extended: true, flags: e.f === "gsub" ? "g" : "" }); let n = 0;
        const res = str(ev(target)).replace(rx, (m) => { n++; return rep.replace(/\\&|&/g, (x) => (x === "&" ? m : "&")); });
        setl(target, res); return n;
      }
    }
    throw new Error("function " + e.f + " never defined");
  };
  const exec = (body) => {
    for (const s of body) {
      switch (s.k) {
        case "print": case "printf": {
          let text;
          if (s.k === "print") text = (s.args.length ? s.args.map((x) => str(ev(x))).join(V.OFS) : fields[0]) + V.ORS;
          else text = sprintf(str(ev(s.args[0])), s.args.slice(1).map(ev));
          out += text; break;
        }
        case "expr": ev(s.e); break;
        case "blk": exec(s.body); break;
        case "if": if (truthy(ev(s.c))) exec(s.th); else if (s.el) exec(s.el); break;
        case "while": { let g = 0; while (truthy(ev(s.c))) { exec(s.body); if (++g > 1e5) throw new Error("boucle trop longue"); } break; }
        case "for": { if (s.init) ev(s.init); let g = 0; while (!s.c || truthy(ev(s.c))) { exec(s.body); if (s.step) ev(s.step); if (++g > 1e5) throw new Error("boucle trop longue"); } break; }
        case "forin": for (const k of Object.keys(A[s.arr] || {})) { V[s.v] = k; exec(s.body); } break;
        case "delete": if (s.e.k === "idx") { const t = A[s.e.a] || {}; delete t[s.e.keys.map((x) => str(ev(x))).join(V.SUBSEP)]; } else if (s.e.k === "var") A[s.e.v] = {}; break;
        case "next": throw new Next();
        case "exit": throw new Exit();
      }
    }
  };
  const inRange = new Map();
  const matches = (r, i) => {
    if (r.pat === null) return true;
    if (r.pat.k === "range") { if (inRange.get(i)) { if (truthy(ev(r.pat.b))) inRange.delete(i); return true; } if (truthy(ev(r.pat.a))) { if (!truthy(ev(r.pat.b))) inRange.set(i, true); return true; } return false; }
    return truthy(ev(r.pat));
  };
  try {
    for (const r of rules) if (r.pat === "BEGIN") exec(r.body || []);
    const lines = input.split("\n"); if (lines[lines.length - 1] === "") lines.pop();
    if (rules.some((r) => r.pat !== "BEGIN")) for (const line of lines) {
      V.NR++; setRecord(line);
      try { rules.forEach((r, i) => { if (r.pat === "BEGIN" || r.pat === "END") return; if (matches(r, i)) { if (r.body) exec(r.body); else out += fields[0] + V.ORS; } }); }
      catch (e) { if (e instanceof Next) continue; throw e; }
    }
  } catch (e) { if (!(e instanceof Exit)) throw e; exiting = true; }
  for (const r of rules) if (r.pat === "END") { try { exec(r.body || []); } catch (e) { if (!(e instanceof Exit)) throw e; } }
  void exiting;
  return out;
}
