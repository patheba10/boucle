/* Analyseur HCL (sous-ensemble de HCL2 utilisé par Terraform) et évaluation des expressions.
   Les erreurs suivent le format de Terraform : « Error: titre », « on fichier line N », détail. */

export class HclErr extends Error {
  constructor(title, detail, file, line, snippet) { super(title); this.title = title; this.detail = detail; this.file = file; this.line = line; this.snippet = snippet; }
  render(src) {
    let s = "╷\n│ Error: " + this.title + "\n│ \n";
    if (this.file) { s += "│   on " + this.file + " line " + this.line + (this.block ? ", in " + this.block : "") + ":\n"; const l = (src || "").split("\n")[this.line - 1]; if (l !== undefined) s += "│ " + String(this.line).padStart(3) + ": " + l + "\n│ \n"; }
    return s + (this.detail || "").split("\n").map((x) => "│ " + x).join("\n") + "\n╵\n";
  }
}
export class Unknown { constructor(why = "") { this.why = why; } toString() { return "(known after apply)"; } }
export const UNKNOWN = new Unknown();
class SplatList extends Array {}
export const isUnknown = (v) => v instanceof Unknown || (Array.isArray(v) && v.some(isUnknown)) || (v && typeof v === "object" && !(v instanceof Unknown) && !Array.isArray(v) && Object.values(v).some(isUnknown));

/* ===================== lexer ===================== */
function lex(src, file) {
  const toks = []; let i = 0, line = 1;
  const push = (t, v, extra) => toks.push({ t, v, line, ...extra });
  while (i < src.length) {
    const c = src[i];
    if (c === "\n") { push("nl", "\n"); line++; i++; continue; }
    if (c === " " || c === "\t" || c === "\r") { i++; continue; }
    if (c === "#" || (c === "/" && src[i + 1] === "/")) { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i + 1] === "*") { const e = src.indexOf("*/", i + 2); const chunk = src.slice(i, e < 0 ? src.length : e + 2); line += (chunk.match(/\n/g) || []).length; i += chunk.length; continue; }
    if (c === "<" && src[i + 1] === "<") {
      const m = /^<<(-?)([A-Z_]+)\n/.exec(src.slice(i)); if (!m) throw new HclErr("Invalid character", "This character is not used within the language.", file, line);
      const start = i + m[0].length; const endRe = new RegExp("^\\s*" + m[2] + "\\s*$", "m"); const rest = src.slice(start); const em = endRe.exec(rest);
      if (!em) throw new HclErr("Unterminated template string", "No closing marker was found for the string.", file, line);
      let body = rest.slice(0, em.index); if (m[1]) { const ind = Math.min(...body.split("\n").filter((x) => x.trim()).map((x) => x.match(/^ */)[0].length)); body = body.split("\n").map((x) => x.slice(ind)).join("\n"); }
      push("tpl", body, { heredoc: true }); line += (src.slice(i, start + em.index + em[0].length).match(/\n/g) || []).length; i = start + em.index + em[0].length; continue;
    }
    if (c === '"') {
      let j = i + 1, s = "", depth = 0;
      while (j < src.length) {
        if (src[j] === "\\" && depth === 0) { const n = src[j + 1]; s += { n: "\n", t: "\t", '"': '"', "\\": "\\", r: "\r" }[n] ?? "\\" + n; j += 2; continue; }
        if (src[j] === "$" && src[j + 1] === "{") { depth++; s += "${"; j += 2; continue; }
        if (src[j] === "}" && depth) { depth--; s += "}"; j++; continue; }
        if (src[j] === '"' && depth === 0) break;
        if (src[j] === "\n") throw new HclErr("Invalid multi-line string", "Quoted strings may not be split over multiple lines. To produce a multi-line string, either use the \\n escape to represent a newline character or use the \"heredoc\" multi-line template syntax.", file, line);
        s += src[j++];
      }
      if (j >= src.length) throw new HclErr("Unterminated template string", "No closing marker was found for the string.", file, line);
      push("tpl", s); i = j + 1; continue;
    }
    let m;
    if ((m = /^\d+(\.\d+)?([eE][+-]?\d+)?/.exec(src.slice(i)))) { push("num", +m[0]); i += m[0].length; continue; }
    if ((m = /^[A-Za-z_][\w-]*/.exec(src.slice(i)))) { push("id", m[0]); i += m[0].length; continue; }
    if ((m = /^(==|!=|<=|>=|&&|\|\||=>|\.\.\.|[{}[\]().,=:?!<>+\-*/%])/.exec(src.slice(i)))) { push(m[0], m[0]); i += m[0].length; continue; }
    throw new HclErr("Invalid character", "This character is not used within the language.", file, line);
  }
  push("eof", "");
  return toks;
}

/* ===================== parser ===================== */
/** Renvoie le corps d'un fichier : { attrs: {nom: {expr, line}}, blocks: [{type, labels, body, line}] }. */
export function parseHcl(src, file = "main.tf") {
  const toks = lex(src, file); let p = 0;
  const peek = (k = 0) => toks[p + k]; const next = () => toks[p++];
  const skipNl = () => { while (peek().t === "nl") p++; };
  const err = (title, detail, t = peek()) => new HclErr(title, detail, file, t.line);
  const expect = (t, title, detail) => { if (peek().t !== t) throw err(title, detail); return next(); };
  function body(closing, openLine) {
    const b = { attrs: {}, blocks: [] };
    for (;;) {
      skipNl();
      if (closing && peek().t === "}") { next(); return b; }
      if (peek().t === "eof") { if (closing) throw new HclErr("Unclosed configuration block", "There is no closing brace for this block before the end of the file. This may be caused by incorrect brace nesting elsewhere in this file.", file, openLine); return b; }
      const name = peek(); if (name.t !== "id") throw err("Argument or block definition required", "An argument or block definition is required here.");
      next();
      if (peek().t === "=") {
        next(); const line = name.line; const e = expr();
        if (b.attrs[name.v]) throw new HclErr("Attribute redefined", 'The argument "' + name.v + '" was already set at ' + file + ":" + b.attrs[name.v].line + ",3-" + (3 + name.v.length) + ". Each argument may be set only once.", file, line);
        b.attrs[name.v] = { expr: e, line };
        if (!["nl", "eof", "}"].includes(peek().t)) throw err("Missing newline after argument", "An argument definition must end with a newline.");
        continue;
      }
      const labels = [];
      while (peek().t === "tpl" || peek().t === "id") { const l = next(); labels.push(l.v); }
      if (peek().t !== "{") throw err(labels.length || peek().t === "nl" || peek().t === "eof" ? "Invalid block definition" : "Argument or block definition required", labels.length || peek().t !== "=" ? 'Either a quoted string block label or an opening brace ("{") is expected here.' : "An argument or block definition is required here. To set an argument, use the equals sign \"=\" to introduce the argument value.");
      next();
      b.blocks.push({ type: name.v, labels, body: body(true, name.line), line: name.line });
    }
  }
  const PREC = [["||"], ["&&"], ["==", "!="], ["<", ">", "<=", ">="], ["+", "-"], ["*", "/", "%"]];
  function expr() {
    const c = binary(0);
    if (peek().t === "?") { next(); const a = expr(); expect(":", "Missing false expression in conditional", "The conditional operator (...?...:...) requires a false expression, delimited by a colon."); const b = expr(); return { k: "cond", c, a, b }; }
    return c;
  }
  function binary(level) {
    if (level >= PREC.length) return unary();
    let left = binary(level + 1);
    while (PREC[level].includes(peek().t)) { const op = next().t; const right = binary(level + 1); left = { k: "bin", op, left, right }; }
    return left;
  }
  function unary() {
    if (peek().t === "!" || peek().t === "-") { const op = next().t; return { k: "un", op, e: unary() }; }
    return postfix(primary());
  }
  function postfix(e) {
    for (;;) {
      if (peek().t === "." ) {
        next(); const t = next();
        if (t.t === "id") e = { k: "attr", e, name: t.v, line: t.line };
        else if (t.t === "num") e = { k: "index", e, i: { k: "lit", v: t.v } };
        else if (t.t === "*") e = { k: "splat", e };
        else throw err("Invalid attribute name", "An attribute name is required after a dot.", t);
        continue;
      }
      if (peek().t === "[") { next(); if (peek().t === "*") { next(); expect("]"); e = { k: "splat", e }; continue; } const i = expr(); expect("]", "Missing close bracket on index", "The index operator must end with a closing bracket (\"]\")."); e = { k: "index", e, i }; continue; }
      return e;
    }
  }
  function collection(close, isObj) {
    const items = [];
    for (;;) {
      skipNl(); if (peek().t === close) { next(); return items; }
      if (isObj) {
        const kt = peek(); let key;
        if (kt.t === "id") { next(); key = { k: "lit", v: kt.v }; } else if (kt.t === "tpl") { next(); key = { k: "tpl", v: kt.v, line: kt.line }; } else if (kt.t === "(") { next(); key = expr(); expect(")"); } else throw err("Invalid object key", "An object key must be an identifier, a string, or an expression in parentheses.");
        if (peek().t !== "=" && peek().t !== ":") throw err("Missing key/value separator", 'Expected an equals sign ("=") to mark the beginning of the attribute value.');
        next(); items.push([key, expr()]);
      } else items.push(expr());
      if (peek().t === ",") { next(); continue; }
      if (peek().t === "nl") { skipNl(); if (isObj || peek().t === close) continue; }
      if (peek().t !== close) throw err(isObj ? "Missing attribute separator" : "Missing item separator", isObj ? "Expected a newline or comma to mark the beginning of the next attribute." : "Expected a comma to mark the beginning of the next item.");
    }
  }
  function primary() {
    const t = peek();
    if (t.t === "num") { next(); return { k: "lit", v: t.v }; }
    if (t.t === "tpl") { next(); return { k: "tpl", v: t.v, line: t.line }; }
    if (t.t === "(") { next(); const e = expr(); expect(")", "Unbalanced parentheses", "Expected a closing parenthesis to terminate the expression."); return e; }
    if (t.t === "[") {
      next(); skipNl();
      if (peek().t === "id" && peek().v === "for") return forExpr("]");
      return { k: "list", items: collection("]", false) };
    }
    if (t.t === "{") {
      next(); skipNl();
      if (peek().t === "id" && peek().v === "for") return forExpr("}");
      return { k: "obj", items: collection("}", true) };
    }
    if (t.t === "id") {
      next();
      if (t.v === "true" || t.v === "false") return { k: "lit", v: t.v === "true" };
      if (t.v === "null") return { k: "lit", v: null };
      if (peek().t === "(") { next(); const args = []; skipNl(); while (peek().t !== ")") { args.push(expr()); skipNl(); if (peek().t === "...") next(); if (peek().t === ",") { next(); skipNl(); } else if (peek().t !== ")") throw err("Missing argument separator", "A comma is required to separate each function argument from the next."); } next(); return { k: "call", fn: t.v, args, line: t.line }; }
      return { k: "ref", name: t.v, line: t.line };
    }
    if (t.t === "nl" || t.t === "eof") throw err("Invalid expression", "Expected the start of an expression, but found the end of the file.");
    throw err("Invalid expression", 'Expected the start of an expression, but found an invalid expression token.');
  }
  function forExpr(close) {
    next(); const v1 = expect("id").v; let v2 = null; if (peek().t === ",") { next(); v2 = expect("id").v; }
    if (!(peek().t === "id" && peek().v === "in")) throw err("Invalid 'for' expression", "In keyword is required."); next();
    const coll = expr(); expect(":");
    let key = null; let val = expr();
    if (close === "}") { expect("=>", "Invalid 'for' expression", "Key expression is required when building an object."); key = val; val = expr(); }
    let cond = null; if (peek().t === "id" && peek().v === "if") { next(); cond = expr(); }
    skipNl(); expect(close);
    return { k: "for", v1, v2, coll, key, val, cond, obj: close === "}" };
  }
  return body(false);
}

/* ===================== évaluation ===================== */
function cidrsubnet(prefix, newbits, netnum) {
  const [ip, len] = prefix.split("/"); const n = ip.split(".").reduce((a, b) => a * 256 + +b, 0);
  const nl = +len + newbits; if (nl > 32) throw new Error('Invalid value for "newbits" parameter: insufficient address space to extend prefix of ' + len + " by " + newbits + ".");
  const out = n + netnum * 2 ** (32 - nl);
  return [24, 16, 8, 0].map((s) => Math.floor(out / 2 ** s) % 256).join(".") + "/" + nl;
}
export const FUNCTIONS = {
  length: (x) => (typeof x === "string" ? x.length : Array.isArray(x) ? x.length : Object.keys(x || {}).length),
  upper: (s) => String(s).toUpperCase(), lower: (s) => String(s).toLowerCase(), title: (s) => String(s).replace(/\b\w/g, (c) => c.toUpperCase()),
  join: (sep, l) => l.join(sep), split: (sep, s) => String(s).split(sep), replace: (s, a, b) => String(s).split(a).join(b), trimspace: (s) => String(s).trim(),
  format: (f, ...a) => { let i = 0; return String(f).replace(/%(\d*)([sdv%])/g, (m, w, c) => (c === "%" ? "%" : String(a[i++]).padStart(+w || 0, c === "d" ? "0" : " "))); },
  lookup: (m, k, d) => (m && k in m ? m[k] : d), merge: (...ms) => Object.assign({}, ...ms), keys: (m) => Object.keys(m).sort(), values: (m) => Object.keys(m).sort().map((k) => m[k]),
  concat: (...ls) => ls.flat(), contains: (l, v) => l.includes(v), element: (l, i) => l[i % l.length], index: (l, v) => l.indexOf(v), distinct: (l) => [...new Set(l)], flatten: (l) => l.flat(Infinity), compact: (l) => l.filter((x) => x !== "" && x !== null),
  tolist: (l) => [...l], toset: (l) => [...new Set(l)].sort(), tomap: (m) => ({ ...m }), tostring: (x) => String(x), tonumber: (x) => +x,
  min: (...a) => Math.min(...a), max: (...a) => Math.max(...a), abs: Math.abs, ceil: Math.ceil, floor: Math.floor,
  cidrsubnet, coalesce: (...a) => a.find((x) => x !== null && x !== "" && x !== undefined),
  jsonencode: (x) => JSON.stringify(x), base64encode: (s) => btoa(unescape(encodeURIComponent(s))), md5: (s) => "5d41402abc4b2a76b9719d911017c592".slice(0, 32),
  range: (a, b, s = 1) => { if (b === undefined) { b = a; a = 0; } const o = []; for (let i = a; s > 0 ? i < b : i > b; i += s) o.push(i); return o; },
  zipmap: (k, v) => Object.fromEntries(k.map((x, i) => [x, v[i]])), try: (...a) => a[0], can: () => true, file: null, templatefile: null
};

/** Évalue une expression. scope.ref(name, node) résout les références (var, local, aws_x, data, module, count, each…). */
export function evaluate(node, scope) {
  const ev = (n) => evaluate(n, scope);
  switch (node.k) {
    case "lit": return node.v;
    case "tpl": {
      const s = node.v;
      if (/^\$\{[^}]*\}$/.test(s) && !s.slice(2, -1).includes("${")) { return evalSrc(s.slice(2, -1), scope, node.line); }
      let out = ""; let unknown = false; let i = 0;
      while (i < s.length) {
        if (s[i] === "$" && s[i + 1] === "{") {
          let d = 1, j = i + 2; while (j < s.length && d) { if (s[j] === "{") d++; if (s[j] === "}") d--; j++; }
          const v = evalSrc(s.slice(i + 2, j - 1), scope, node.line);
          if (isUnknown(v)) unknown = true; else if (v !== null && typeof v === "object") throw new HclErr("Invalid template interpolation value", "Cannot include the given value in a string template: string required.", scope.file, node.line);
          else out += v;
          i = j; continue;
        }
        if (s[i] === "%" && s[i + 1] === "{") { const j = s.indexOf("}", i); i = j + 1; continue; }
        out += s[i++];
      }
      return unknown ? new Unknown() : out;
    }
    case "list": return node.items.map(ev);
    case "obj": return Object.fromEntries(node.items.map(([k, v]) => [k.k === "lit" ? k.v : ev(k), ev(v)]));
    case "ref": return scope.ref(node.name, node);
    case "attr": {
      if (node.e.k === "ref" && scope.refPath) { const r = scope.refPath(node.e.name, node.name, node); if (r !== undefined) return r.value; }
      if (node.e.k === "attr" && node.e.e.k === "ref" && scope.refPath3) { const r = scope.refPath3(node.e.e.name, node.e.name, node.name, node); if (r !== undefined) return r.value; }
      const base = ev(node.e);
      if (base instanceof Unknown) return base;
      if (base instanceof SplatList) return SplatList.from(base.map((x) => (x instanceof Unknown ? x : x && typeof x === "object" ? x[node.name] : undefined)));
      if (base === null || base === undefined || typeof base !== "object") throw new HclErr("Unsupported attribute", "This object does not have an attribute named \"" + node.name + "\".", scope.file, node.line);
      if (Array.isArray(base)) throw new HclErr("Unsupported attribute", "Can't access attributes on a list of objects. Did you mean to access attribute \"" + node.name + "\" for a specific element of the list, or across all elements of the list?", scope.file, node.line);
      if (!(node.name in base)) throw new HclErr("Unsupported attribute", "This object does not have an attribute named \"" + node.name + "\".", scope.file, node.line);
      return base[node.name];
    }
    case "index": { const b = ev(node.e); const i = ev(node.i); if (b instanceof Unknown || i instanceof Unknown) return new Unknown(); if (Array.isArray(b) && (i < 0 || i >= b.length)) throw new HclErr("Invalid index", "The given key does not identify an element in this collection value: the given index is greater than or equal to the length of the collection.", scope.file, node.line || 0); if (b && typeof b === "object" && !(i in b)) throw new HclErr("Invalid index", "The given key does not identify an element in this collection value.", scope.file, node.line || 0); return b[i]; }
    case "splat": { const b = ev(node.e); return SplatList.from(Array.isArray(b) ? b : b === null || b === undefined ? [] : [b]); }
    case "un": { const v = ev(node.e); if (v instanceof Unknown) return v; return node.op === "!" ? !v : -v; }
    case "bin": {
      const a = ev(node.left), b = ev(node.right); if (a instanceof Unknown || b instanceof Unknown) return new Unknown();
      switch (node.op) { case "+": return a + b; case "-": return a - b; case "*": return a * b; case "/": return a / b; case "%": return a % b; case "==": return JSON.stringify(a) === JSON.stringify(b); case "!=": return JSON.stringify(a) !== JSON.stringify(b); case "<": return a < b; case ">": return a > b; case "<=": return a <= b; case ">=": return a >= b; case "&&": return a && b; case "||": return a || b; }
      break;
    }
    case "cond": { const c = ev(node.c); if (c instanceof Unknown) return new Unknown(); return c ? ev(node.a) : ev(node.b); }
    case "call": {
      const f = FUNCTIONS[node.fn];
      if (f === undefined) throw new HclErr("Call to unknown function", 'There is no function named "' + node.fn + '".', scope.file, node.line);
      if (node.fn === "file" || node.fn === "templatefile") { const p = ev(node.args[0]); const txt = scope.readFile(p, node); if (node.fn === "file") return txt; const vars = ev(node.args[1]) || {}; return evaluate({ k: "tpl", v: txt, line: node.line }, { ...scope, ref: (n, nd) => (n in vars ? vars[n] : scope.ref(n, nd)) }); }
      const args = node.args.map(ev); if (args.some(isUnknown)) return new Unknown();
      try { return f(...args); } catch (e) { throw new HclErr("Invalid function argument", e.message, scope.file, node.line); }
    }
    case "for": {
      const c = ev(node.coll); if (c instanceof Unknown) return new Unknown();
      const entries = Array.isArray(c) ? c.map((v, i) => [i, v]) : Object.entries(c).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)); // ordre lexical, comme Terraform
      const out = node.obj ? {} : [];
      for (const [k, v] of entries) {
        const s2 = { ...scope, ref: (n, nd) => (n === node.v1 ? (node.v2 ? k : v) : n === node.v2 ? v : scope.ref(n, nd)) };
        if (node.cond && !evaluate(node.cond, s2)) continue;
        if (node.obj) out[evaluate(node.key, s2)] = evaluate(node.val, s2); else out.push(evaluate(node.val, s2));
      }
      return out;
    }
  }
  throw new HclErr("Invalid expression", "Expression non prise en charge.", scope.file, 0);
}
function evalSrc(src, scope, line) {
  const b = parseHcl("x = " + src + "\n", scope.file);
  const e = b.attrs.x.expr; const fix = (n) => { if (n && typeof n === "object") { if (n.line) n.line = line; for (const v of Object.values(n)) if (v && typeof v === "object") fix(v); } }; fix(e);
  return evaluate(e, scope);
}
/** Références d'une expression (pour le graphe de dépendances). */
export function refsOf(node, out = []) {
  if (!node || typeof node !== "object") return out;
  if (node.k === "ref") out.push([node.name]);
  if (node.k === "attr") { const chain = []; let n = node; while (n.k === "attr") { chain.unshift(n.name); n = n.e; } if (n.k === "ref") { out.push([n.name, ...chain]); return out; } }
  if (node.k === "tpl") for (const m of node.v.matchAll(/\$\{([^}]*)\}/g)) { try { refsOf(parseHcl("x = " + m[1] + "\n").attrs.x.expr, out); } catch (e) { /* ignorée */ } }
  for (const v of Object.values(node)) if (v && typeof v === "object") { if (Array.isArray(v)) v.forEach((x) => (Array.isArray(x) ? x.forEach((y) => refsOf(y, out)) : refsOf(x, out))); else refsOf(v, out); }
  return out;
}
