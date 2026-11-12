/* PromQL simulé : séries temporelles déterministes et évaluateur de requêtes instantanées.
   Sous-ensemble fidèle à Prometheus 2.55 : sélecteurs, plages, rate/irate/increase, *_over_time,
   agrégations by/without, opérateurs avec correspondance de labels, histogram_quantile, topk, absent. */

export class PromErr extends Error { constructor(msg) { super(msg); } }
export const NOW = 1794475800; // 12 nov. 2026, 09:30 UTC : instant de toutes les requêtes
const STEP = 15;

/* ===================== données ===================== */
/** Un compteur dont le débit vaut r1 avant t0 et r2 après : valeur exacte à l'instant t. */
const counter = (r1, r2 = r1, t0 = NOW - 600, base = 0) => (t) => base + r1 * (Math.min(t, t0) - (NOW - 86400)) + r2 * Math.max(0, t - t0);
const gauge = (v1, v2 = v1, t0 = NOW - 600) => (t) => (t < t0 ? v1 : v2);
const BUCKETS = ["0.05", "0.1", "0.25", "0.5", "1", "2.5", "+Inf"];
const PROFILE = { rapide: [0.62, 0.86, 0.96, 0.99, 0.997, 1, 1], lent: [0.08, 0.2, 0.45, 0.7, 0.88, 0.97, 1] };

/** Les séries d'une boutique en ligne : une API sur deux instances, des nœuds, et un incident sur /panier depuis 10 minutes. */
export function defaultSeries(opts = {}) {
  const S = [];
  const add = (labels, fn) => S.push({ labels, fn });
  const inst = ["api-1:8000", "api-2:8000"];
  const traffic = { "/produits": [12, 12], "/panier": [4, 4], "/health": [0.2, 0.2] };
  for (const instance of inst) {
    for (const [route, [r1, r2]] of Object.entries(traffic)) {
      const err1 = route === "/panier" ? 0.04 : route === "/produits" ? 0.012 : 0;
      const err2 = route === "/panier" ? (opts.incident === false ? 0.04 : 1.2) : err1;
      add({ __name__: "http_requests_total", job: "api", instance, method: route === "/panier" ? "POST" : "GET", route, code: "200" }, counter(r1 - err1, r2 - err2));
      if (err1 || err2) add({ __name__: "http_requests_total", job: "api", instance, method: route === "/panier" ? "POST" : "GET", route, code: "500" }, counter(err1, err2));
      if (route === "/produits") add({ __name__: "http_requests_total", job: "api", instance, method: "GET", route, code: "404" }, counter(0.3));
      const prof1 = PROFILE.rapide; const prof2 = route === "/panier" && opts.incident !== false ? PROFILE.lent : PROFILE.rapide;
      BUCKETS.forEach((le, i) => add({ __name__: "http_request_duration_seconds_bucket", job: "api", instance, route, le }, counter(r1 * prof1[i], r2 * prof2[i])));
      add({ __name__: "http_request_duration_seconds_count", job: "api", instance, route }, counter(r1, r2));
      add({ __name__: "http_request_duration_seconds_sum", job: "api", instance, route }, counter(r1 * 0.06, r2 * (route === "/panier" && opts.incident !== false ? 0.42 : 0.06)));
    }
    add({ __name__: "process_resident_memory_bytes", job: "api", instance }, gauge(instance === "api-1:8000" ? 182e6 : 176e6, instance === "api-1:8000" ? 412e6 : 180e6));
    add({ __name__: "up", job: "api", instance }, gauge(1));
  }
  for (const [instance, avail, cpuIdle] of [["node-1:9100", 2.1e9, 0.62], ["node-2:9100", 0.35e9, 0.08], ["worker-1:9100", 3.2e9, 0.9]]) {
    const down = instance === "worker-1:9100";
    add({ __name__: "up", job: "node", instance }, gauge(1, down ? 0 : 1, NOW - 420));
    if (down) continue;
    add({ __name__: "node_memory_MemTotal_bytes", job: "node", instance }, gauge(4e9));
    add({ __name__: "node_memory_MemAvailable_bytes", job: "node", instance }, gauge(avail));
    for (const mode of ["idle", "user", "system", "iowait"]) add({ __name__: "node_cpu_seconds_total", job: "node", instance, cpu: "0", mode }, counter(mode === "idle" ? cpuIdle : mode === "user" ? (1 - cpuIdle) * 0.7 : mode === "system" ? (1 - cpuIdle) * 0.25 : (1 - cpuIdle) * 0.05));
    add({ __name__: "node_filesystem_avail_bytes", job: "node", instance, mountpoint: "/", fstype: "ext4" }, gauge(instance === "node-2:9100" ? 2.4e9 : 31e9));
    add({ __name__: "node_filesystem_size_bytes", job: "node", instance, mountpoint: "/", fstype: "ext4" }, gauge(40e9));
  }
  return S;
}

/* ===================== analyse ===================== */
const DUR = { ms: 0.001, s: 1, m: 60, h: 3600, d: 86400, w: 604800, y: 31536000 };
const AGG = ["sum", "avg", "max", "min", "count", "topk", "bottomk", "stddev", "quantile", "count_values", "group"];
const FUNCS = {
  rate: ["range"], irate: ["range"], increase: ["range"], delta: ["range"], deriv: ["range"],
  avg_over_time: ["range"], max_over_time: ["range"], min_over_time: ["range"], sum_over_time: ["range"], count_over_time: ["range"], last_over_time: ["range"],
  histogram_quantile: ["scalar", "vector"], abs: ["vector"], ceil: ["vector"], floor: ["vector"], round: ["vector", "scalar?"], absent: ["vector"],
  clamp_min: ["vector", "scalar"], clamp_max: ["vector", "scalar"], time: [], vector: ["scalar"], scalar: ["vector"], sort: ["vector"], sort_desc: ["vector"], label_replace: ["vector", "string", "string", "string", "string"]
};
function lex(src) {
  const toks = []; let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "#") { while (i < src.length && src[i] !== "\n") i++; continue; }
    const at = i + 1;
    let m;
    if ((m = /^(\d+(?:\.\d+)?)(ms|s|m|h|d|w|y)(?![\w.])/.exec(src.slice(i))) && (toks.length && toks[toks.length - 1].t === "[" || toks.length && toks[toks.length - 1].v === "offset")) { toks.push({ t: "dur", v: +m[1] * DUR[m[2]], raw: m[0], at }); i += m[0].length; continue; }
    if ((m = /^(?:\d+\.?\d*(?:e[+-]?\d+)?|\.\d+|Inf|NaN)(?![\w])/i.exec(src.slice(i)))) { toks.push({ t: "num", v: +m[0], at }); i += m[0].length; continue; }
    if ((m = /^[a-zA-Z_:][\w:]*/.exec(src.slice(i)))) { toks.push({ t: "id", v: m[0], at }); i += m[0].length; continue; }
    if (c === '"' || c === "'") { let j = i + 1, s = ""; while (j < src.length && src[j] !== c) { if (src[j] === "\\") j++; s += src[j++]; } if (j >= src.length) throw new PromErr(at + ": parse error: unterminated quoted string " + src.slice(i)); toks.push({ t: "str", v: s, at }); i = j + 1; continue; }
    if ((m = /^(==|!=|>=|<=|=~|!~|[-+*/%^<>=(){}[\],:])/.exec(src.slice(i)))) { toks.push({ t: m[0], v: m[0], at }); i += m[0].length; continue; }
    throw new PromErr("1:" + at + ': parse error: unexpected character: "' + c + '"');
  }
  toks.push({ t: "eof", v: "", at: src.length + 1 });
  return toks;
}
const PREC = { or: 1, and: 2, unless: 2, "==": 3, "!=": 3, "<": 3, ">": 3, "<=": 3, ">=": 3, "+": 4, "-": 4, "*": 5, "/": 5, "%": 5, "^": 6 };
export function parse(src) {
  const toks = lex(src); let p = 0;
  const peek = () => toks[p]; const next = () => toks[p++];
  const err = (msg, t = peek()) => new PromErr("1:" + t.at + ": parse error: " + msg);
  const tokName = (t) => (t.t === "eof" ? "end of input" : t.t === "num" ? "number \"" + t.v + "\"" : t.t === "id" ? "identifier \"" + t.v + "\"" : t.t === "str" ? "string \"" + t.v + "\"" : "\"" + t.v + "\"");
  const expect = (t, what) => { if (peek().t !== t) throw err("unexpected " + tokName(peek()) + (what ? ", expected " + what : "")); return next(); };
  const labelList = () => { expect("("); const out = []; while (peek().t !== ")") { out.push(expect("id", "label").v); if (peek().t === ",") next(); } next(); return out; };
  function expr(minPrec = 1) {
    let left = unary();
    for (;;) {
      const t = peek(); const op = t.t === "id" && ["and", "or", "unless"].includes(t.v) ? t.v : t.t;
      const pr = PREC[op]; if (pr === undefined || pr < minPrec) break;
      next();
      const node = { k: "bin", op, left, bool: false, on: null, ignoring: null, group: null };
      if (peek().t === "id" && peek().v === "bool") { next(); node.bool = true; }
      if (peek().t === "id" && (peek().v === "on" || peek().v === "ignoring")) { const w = next().v; node[w] = labelList(); }
      if (peek().t === "id" && (peek().v === "group_left" || peek().v === "group_right")) { node.group = next().v; node.groupLabels = peek().t === "(" ? labelList() : []; }
      node.right = expr(op === "^" ? pr : pr + 1);
      left = node;
    }
    return left;
  }
  function unary() {
    if (peek().t === "-" || peek().t === "+") { const s = next().t; const e = unary(); return s === "-" ? { k: "bin", op: "*", left: { k: "num", v: -1 }, right: e } : e; }
    return postfix(primary());
  }
  function postfix(e) {
    if (peek().t === "[") {
      next(); const d = peek(); if (d.t !== "dur") throw err("bad number or duration syntax: \"" + (d.v ?? "") + "\"");
      next(); expect("]");
      if (e.k !== "sel") throw err("ranges only allowed for vector selectors");
      e = { k: "range", sel: e, dur: d.v, raw: d.raw };
    }
    if (peek().t === "id" && peek().v === "offset") { next(); const d = expect("dur", "duration"); (e.sel || e).offset = d.v; }
    return e;
  }
  function primary() {
    const t = peek();
    if (t.t === "num") { next(); return { k: "num", v: t.v }; }
    if (t.t === "str") { next(); return { k: "str", v: t.v }; }
    if (t.t === "(") { next(); const e = expr(); expect(")"); return { k: "paren", e }; }
    if (t.t === "{") return selector(null);
    if (t.t === "id") {
      next();
      if (AGG.includes(t.v) && (peek().t === "(" || (peek().t === "id" && ["by", "without"].includes(peek().v)))) {
        let by = null, without = null;
        if (peek().t === "id") { const w = next().v; (w === "by" ? (by = labelList()) : (without = labelList())); }
        expect("("); const args = [expr()]; while (peek().t === ",") { next(); args.push(expr()); } expect(")");
        if (peek().t === "id" && ["by", "without"].includes(peek().v)) { const w = next().v; (w === "by" ? (by = labelList()) : (without = labelList())); }
        return { k: "agg", op: t.v, args, by, without, at: t.at };
      }
      if (peek().t === "(") {
        if (!FUNCS[t.v]) throw new PromErr("1:" + t.at + ': parse error: unknown function with name "' + t.v + '"');
        next(); const args = []; if (peek().t !== ")") { args.push(expr()); while (peek().t === ",") { next(); args.push(expr()); } } expect(")");
        return { k: "call", fn: t.v, args, at: t.at };
      }
      return selector(t.v, t);
    }
    throw err("unexpected " + tokName(t));
  }
  function selector(name, t0) {
    const m = [];
    if (name) m.push({ l: "__name__", op: "=", v: name });
    if (peek().t === "{") {
      next();
      while (peek().t !== "}") {
        const l = expect("id", "label matching").v; const op = next();
        if (!["=", "!=", "=~", "!~"].includes(op.t)) throw err("unexpected " + tokName(op) + " in label matching, expected label matching operator", op);
        const v = peek(); if (v.t !== "str") throw err("unexpected " + tokName(v) + " in label matching, expected string"); next();
        if (op.t.includes("~")) { try { new RegExp(v.v); } catch (e) { throw new PromErr("1:" + v.at + ": parse error: error parsing regexp: invalid regular expression: `" + v.v + "`"); } }
        m.push({ l, op: op.t, v: v.v });
        if (peek().t === ",") next(); else if (peek().t !== "}") throw err("unexpected " + tokName(peek()) + " in label matching, expected \",\" or \"}\"");
      }
      next();
    }
    if (!m.length || m.every((x) => x.op !== "=" || x.v === "") && !name) throw new PromErr("1:" + (t0 ? t0.at : 1) + ": parse error: vector selector must contain at least one non-empty matcher");
    return { k: "sel", m };
  }
  const e = expr();
  if (peek().t !== "eof") throw err("unexpected " + tokName(peek()));
  return e;
}

/* ===================== évaluation ===================== */
const sig = (labels, keep) => JSON.stringify(Object.entries(labels).filter(([k]) => keep(k)).sort());
const dropName = (l) => { const o = { ...l }; delete o.__name__; return o; };
function typeOf(n) {
  if (n.k === "num") return "scalar";
  if (n.k === "str") return "string";
  if (n.k === "range") return "range vector";
  if (n.k === "paren") return typeOf(n.e);
  if (n.k === "call") return ["time", "scalar"].includes(n.fn) ? "scalar" : "instant vector";
  if (n.k === "bin") return typeOf(n.left) === "scalar" && typeOf(n.right) === "scalar" ? "scalar" : "instant vector";
  return "instant vector";
}
export class Prom {
  constructor(series = defaultSeries()) { this.series = series; }
  match(m, labels) {
    return m.every(({ l, op, v }) => {
      const x = labels[l] ?? "";
      if (op === "=") return x === v; if (op === "!=") return x !== v;
      const re = new RegExp("^(?:" + v + ")$"); return op === "=~" ? re.test(x) : !re.test(x);
    });
  }
  /** Requête instantanée : { type: "vector" | "scalar", result }. */
  query(src, t = NOW) {
    const ast = parse(src); const ty = typeOf(ast);
    if (ty === "range vector" || ty === "string") { /* autorisé : Prometheus renvoie une matrice ou une chaîne */ }
    const v = this.ev(ast, t);
    return { type: v.type, result: v.type === "vector" ? v.v.sort((a, b) => sig(a.l, () => true).localeCompare(sig(b.l, () => true))) : v.v };
  }
  ev(n, t) {
    switch (n.k) {
      case "num": return { type: "scalar", v: n.v };
      case "str": return { type: "string", v: n.v };
      case "paren": return this.ev(n.e, t);
      case "sel": { const off = n.offset || 0; return { type: "vector", v: this.series.filter((s) => this.match(n.m, s.labels) && s.fn(t - off) !== undefined).map((s) => ({ l: { ...s.labels }, v: s.fn(t - off) })) }; }
      case "range": {
        const off = n.sel.offset || 0;
        return { type: "matrix", v: this.series.filter((s) => this.match(n.sel.m, s.labels)).map((s) => { const pts = []; for (let x = t - off - n.dur + STEP; x <= t - off; x += STEP) { const y = s.fn(x); if (y !== undefined) pts.push([x, y]); } return { l: { ...s.labels }, pts }; }).filter((s) => s.pts.length), dur: n.dur };
      }
      case "call": return this.call(n, t);
      case "agg": return this.agg(n, t);
      case "bin": return this.bin(n, t);
    }
    throw new PromErr("expression non prise en charge");
  }
  call(n, t) {
    const spec = FUNCS[n.fn]; const need = spec.filter((x) => !x.endsWith("?")).length;
    if (n.args.length < need || n.args.length > spec.length) throw new PromErr("1:" + n.at + ": parse error: expected " + need + " argument(s) in call to \"" + n.fn + "\", got " + n.args.length);
    spec.forEach((want, i) => {
      if (!n.args[i]) return; const got = typeOf(n.args[i]); const w = want.replace("?", "");
      const exp = w === "range" ? "range vector" : w === "vector" ? "instant vector" : w;
      if (got !== exp) throw new PromErr("1:" + n.at + ": parse error: expected type " + exp + " in call to function \"" + n.fn + "\", got " + got);
    });
    const a = n.args.map((x) => this.ev(x, t));
    const keep = (r) => ({ type: "vector", v: r });
    const mapv = (f) => keep(a[0].v.map((s) => ({ l: dropName(s.l), v: f(s.v) })));
    switch (n.fn) {
      case "rate": case "increase": case "irate": case "delta": case "deriv": {
        return keep(a[0].v.filter((s) => s.pts.length >= 2).map((s) => {
          const [t0, v0] = s.pts[0]; const [t1, v1] = s.pts[s.pts.length - 1];
          if (n.fn === "irate") { const [ta, va] = s.pts[s.pts.length - 2]; return { l: dropName(s.l), v: (v1 - va) / (t1 - ta) }; }
          // Comme Prometheus : extrapolation de l'écart observé à toute la fenêtre.
          const inc = (v1 - v0) * a[0].dur / (t1 - t0);
          const r = n.fn === "rate" || n.fn === "deriv" ? inc / a[0].dur : inc;
          return { l: dropName(s.l), v: r };
        }));
      }
      case "avg_over_time": case "max_over_time": case "min_over_time": case "sum_over_time": case "count_over_time": case "last_over_time":
        return keep(a[0].v.map((s) => { const ys = s.pts.map((p) => p[1]); const r = { avg_over_time: ys.reduce((x, y) => x + y, 0) / ys.length, max_over_time: Math.max(...ys), min_over_time: Math.min(...ys), sum_over_time: ys.reduce((x, y) => x + y, 0), count_over_time: ys.length, last_over_time: ys[ys.length - 1] }[n.fn]; return { l: n.fn === "last_over_time" ? s.l : dropName(s.l), v: r }; }));
      case "abs": return mapv(Math.abs); case "ceil": return mapv(Math.ceil); case "floor": return mapv(Math.floor);
      case "round": { const to = a[1] ? a[1].v : 1; return mapv((x) => Math.round(x / to) * to); }
      case "clamp_min": return mapv((x) => Math.max(x, a[1].v)); case "clamp_max": return mapv((x) => Math.min(x, a[1].v));
      case "time": return { type: "scalar", v: t };
      case "vector": return keep([{ l: {}, v: a[0].v }]);
      case "scalar": return { type: "scalar", v: a[0].v.length === 1 ? a[0].v[0].v : NaN };
      case "sort": return keep(a[0].v.sort((x, y) => x.v - y.v)); case "sort_desc": return keep(a[0].v.sort((x, y) => y.v - x.v));
      case "absent": {
        if (a[0].v.length) return keep([]);
        const sel = n.args[0].k === "sel" ? n.args[0] : null; const l = {};
        if (sel) for (const m of sel.m) if (m.op === "=" && m.l !== "__name__") l[m.l] = m.v;
        return keep([{ l, v: 1 }]);
      }
      case "label_replace": {
        const [, dst, repl, src, re] = a.map((x) => x.v); const rx = new RegExp("^(?:" + re + ")$");
        return keep(a[0].v.map((s) => { const m = rx.exec(s.l[src] ?? ""); if (!m) return s; const l = { ...s.l, [dst]: repl.replace(/\$(\d)|\$\{(\d)\}/g, (_, x, y) => m[+(x || y)] ?? "") }; return { l, v: s.v }; }));
      }
      case "histogram_quantile": {
        const q = a[0].v; const groups = {};
        for (const s of a[1].v) { if (s.l.le === undefined) continue; const l = dropName(s.l); const le = l.le; delete l.le; const k = sig(l, () => true); (groups[k] = groups[k] || { l, b: [] }).b.push([le === "+Inf" ? Infinity : +le, s.v]); }
        return keep(Object.values(groups).map(({ l, b }) => {
          b.sort((x, y) => x[0] - y[0]); const total = b[b.length - 1][1];
          if (q < 0) return { l, v: -Infinity }; if (q > 1) return { l, v: Infinity }; if (!total) return { l, v: NaN };
          const rank = q * total; let i = b.findIndex((x) => x[1] >= rank);
          if (b[i][0] === Infinity) return { l, v: b[b.length - 2][0] };
          const [ub, cnt] = b[i]; const [lb, prev] = i ? b[i - 1] : [0, 0];
          return { l, v: lb + (ub - lb) * ((rank - prev) / (cnt - prev)) };
        }));
      }
    }
    throw new PromErr("fonction non prise en charge : " + n.fn);
  }
  agg(n, t) {
    const param = ["topk", "bottomk", "quantile", "count_values"].includes(n.op);
    const vecArg = param ? n.args[1] : n.args[0];
    if (!vecArg || typeOf(vecArg) !== "instant vector") throw new PromErr("1:" + n.at + ": parse error: expected type instant vector in aggregation expression, got " + (vecArg ? typeOf(vecArg) : "nothing"));
    const p = param ? this.ev(n.args[0], t).v : null; const vec = this.ev(vecArg, t).v;
    const keyLabels = (l) => { const o = {}; if (n.by) for (const k of n.by) { if (l[k] !== undefined) o[k] = l[k]; } else if (n.without) for (const [k, v] of Object.entries(l)) { if (k !== "__name__" && !n.without.includes(k)) o[k] = v; } return o; };
    const groups = {};
    for (const s of vec) { const kl = keyLabels(s.l); const k = sig(kl, () => true); (groups[k] = groups[k] || { l: kl, items: [] }).items.push(s); }
    const out = [];
    for (const g of Object.values(groups)) {
      const xs = g.items.map((s) => s.v);
      if (n.op === "topk" || n.op === "bottomk") { out.push(...g.items.slice().sort((a, b) => (n.op === "topk" ? b.v - a.v : a.v - b.v)).slice(0, p)); continue; }
      const v = { sum: xs.reduce((a, b) => a + b, 0), avg: xs.reduce((a, b) => a + b, 0) / xs.length, max: Math.max(...xs), min: Math.min(...xs), count: xs.length, group: 1, stddev: Math.sqrt(xs.reduce((a, b) => a + (b - xs.reduce((x, y) => x + y, 0) / xs.length) ** 2, 0) / xs.length), quantile: xs.sort((a, b) => a - b)[Math.min(xs.length - 1, Math.max(0, Math.round(p * (xs.length - 1))))] }[n.op];
      out.push({ l: g.l, v });
    }
    return { type: "vector", v: out };
  }
  bin(n, t) {
    const L = this.ev(n.left, t), R = this.ev(n.right, t); const op = n.op;
    const arith = { "+": (a, b) => a + b, "-": (a, b) => a - b, "*": (a, b) => a * b, "/": (a, b) => a / b, "%": (a, b) => a % b, "^": (a, b) => a ** b };
    const cmp = { "==": (a, b) => a === b, "!=": (a, b) => a !== b, ">": (a, b) => a > b, "<": (a, b) => a < b, ">=": (a, b) => a >= b, "<=": (a, b) => a <= b };
    const apply = (a, b) => (arith[op] ? arith[op](a, b) : cmp[op](a, b));
    if (L.type === "scalar" && R.type === "scalar") { if (cmp[op] && !n.bool) throw new PromErr("1:1: parse error: comparisons between scalars must use BOOL modifier"); return { type: "scalar", v: +apply(L.v, R.v) }; }
    if (["and", "or", "unless"].includes(op)) {
      if (L.type !== "vector" || R.type !== "vector") throw new PromErr('1:1: parse error: set operator "' + op + '" not allowed in binary scalar expression');
      const key = (l) => sig(l, (k) => k !== "__name__" && (n.on ? n.on.includes(k) : !(n.ignoring || []).includes(k)));
      const rk = new Set(R.v.map((s) => key(s.l)));
      if (op === "and") return { type: "vector", v: L.v.filter((s) => rk.has(key(s.l))) };
      if (op === "unless") return { type: "vector", v: L.v.filter((s) => !rk.has(key(s.l))) };
      const lk = new Set(L.v.map((s) => key(s.l))); return { type: "vector", v: [...L.v, ...R.v.filter((s) => !lk.has(key(s.l)))] };
    }
    const keepName = cmp[op] && !n.bool;
    if (L.type === "scalar" || R.type === "scalar") {
      const vec = L.type === "vector" ? L.v : R.v; const sc = L.type === "scalar" ? L.v : R.v;
      const out = [];
      for (const s of vec) { const [a, b] = L.type === "vector" ? [s.v, sc] : [sc, s.v]; const r = apply(a, b); if (cmp[op] && !n.bool) { if (r) out.push({ l: s.l, v: s.v }); } else out.push({ l: keepName ? s.l : dropName(s.l), v: +r }); }
      return { type: "vector", v: out };
    }
    // Vecteur et vecteur : correspondance un pour un sur les labels (sans __name__), ou on()/ignoring().
    const key = (l) => sig(l, (k) => k !== "__name__" && (n.on ? n.on.includes(k) : !(n.ignoring || []).includes(k)));
    const right = {}; for (const s of R.v) { const k = key(s.l); if (right[k] && !n.group) throw new PromErr("found duplicate series for the match group " + k.replace(/[[\]"]/g, "") + " on the right hand-side of the operation: many-to-many matching not allowed: matching labels must be unique on one side"); right[k] = s; }
    const out = [];
    for (const s of L.v) {
      const o = right[key(s.l)]; if (!o) continue;
      const r = apply(s.v, o.v);
      if (cmp[op] && !n.bool) { if (r) out.push({ l: s.l, v: s.v }); continue; }
      const l = n.on && !n.group ? Object.fromEntries(Object.entries(s.l).filter(([k]) => n.on.includes(k))) : dropName(s.l);
      out.push({ l, v: +r });
    }
    return { type: "vector", v: out };
  }
}

/** Affichage façon promtool : {labels} => valeur @[horodatage]. */
export function fmtValue(v) { if (Number.isNaN(v)) return "NaN"; if (v === Infinity) return "+Inf"; if (v === -Infinity) return "-Inf"; return String(+v.toPrecision(12)).replace(/e\+?/, "e+").replace("e+-", "e-"); }
export function fmtLabels(l) { const name = l.__name__ || ""; const rest = Object.entries(l).filter(([k]) => k !== "__name__").sort(([a], [b]) => a.localeCompare(b)); return name + "{" + rest.map(([k, v]) => k + '="' + v + '"').join(", ") + "}"; }
export function formatResult(r, t = NOW) {
  if (r.type === "scalar") return "scalar: " + fmtValue(r.result) + " @[" + t + "]\n";
  if (r.type === "string") return "string: " + r.result + " @[" + t + "]\n";
  if (r.type === "matrix") return r.result.map((s) => fmtLabels(s.l) + " =>\n" + s.pts.map(([x, y]) => fmtValue(y) + " @[" + x + "]").join("\n")).join("\n") + "\n";
  return r.result.map((s) => fmtLabels(s.l) + " => " + fmtValue(s.v) + " @[" + t + "]").join("\n") + (r.result.length ? "\n" : "");
}
