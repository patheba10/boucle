/* Analyse d'un script Bash : découpage en jetons puis arbre de commandes.
   Sous-ensemble couvert : listes (; && || &), pipelines, redirections, here-docs,
   if / for / while / until / case, fonctions, groupes { } et ( ), [[ ]] et (( )). */

export class ParseError extends Error {}
const eofError = (msg) => { const e = new ParseError(msg || "syntax error: unexpected end of file"); e.eof = true; return e; };

const META = " \t\n;&|<>()";
const KEYWORDS = new Set(["if", "then", "elif", "else", "fi", "for", "in", "do", "done", "while", "until", "case", "esac", "function", "{", "}", "!"]);

/** Lit un mot brut (guillemets et substitutions conservés) à partir de i. */
function readWord(src, i) {
  let j = i;
  const skipParen = (k) => { // $( … ) avec imbrication et guillemets
    let depth = 1;
    while (k < src.length && depth) {
      const c = src[k];
      if (c === "'") { k = src.indexOf("'", k + 1); if (k < 0) throw eofError("unexpected EOF while looking for matching `''"); k++; continue; }
      if (c === '"') { k = skipDq(k + 1); continue; }
      if (c === "\\") { k += 2; continue; }
      if (c === "(") depth++;
      else if (c === ")") depth--;
      k++;
    }
    if (depth) throw eofError("unexpected EOF while looking for matching `)'");
    return k;
  };
  const skipDq = (k) => {
    while (k < src.length && src[k] !== '"') {
      if (src[k] === "\\") k += 2;
      else if (src[k] === "$" && src[k + 1] === "(") k = skipParen(k + 2);
      else if (src[k] === "`") { k = src.indexOf("`", k + 1); if (k < 0) throw eofError("unexpected EOF while looking for matching ``'"); k++; }
      else k++;
    }
    if (k >= src.length) throw eofError("unexpected EOF while looking for matching `\"'");
    return k + 1;
  };
  while (j < src.length && !META.includes(src[j])) {
    const c = src[j];
    if (c === "\\") { j += src[j + 1] === "\n" ? 2 : 2; continue; }
    if (c === "'") { const e = src.indexOf("'", j + 1); if (e < 0) throw eofError("unexpected EOF while looking for matching `''"); j = e + 1; continue; }
    if (c === '"') { j = skipDq(j + 1); continue; }
    if (c === "`") { const e = src.indexOf("`", j + 1); if (e < 0) throw eofError("unexpected EOF while looking for matching ``'"); j = e + 1; continue; }
    if (c === "$" && src[j + 1] === "(") { j = skipParen(j + 2); continue; }
    if (c === "$" && src[j + 1] === "{") { const e = src.indexOf("}", j + 2); if (e < 0) throw eofError("unexpected EOF while looking for matching `}'"); j = e + 1; continue; }
    j++;
  }
  return j;
}

export function tokenize(src) {
  const toks = []; const pending = []; let i = 0, line = 1;
  const push = (t) => { t.line = line; toks.push(t); };
  const atCmdStart = () => { const p = toks[toks.length - 1]; return !p || p.k === "nl" || (p.k === "op" && ["&&", "||", ";", "|", "(", "&", ";;"].includes(p.v)) || (p.k === "w" && KEYWORDS.has(p.v) && p.v !== "in"); };
  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "\t") { i++; continue; }
    if (c === "\\" && src[i + 1] === "\n") { i += 2; line++; continue; }
    if (c === "#") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "\n") {
      push({ k: "nl" }); i++; line++;
      for (const h of pending.splice(0)) { // corps des here-docs
        const lines = [];
        for (;;) {
          if (i >= src.length) { h.open = true; break; }
          let e = src.indexOf("\n", i); if (e < 0) e = src.length;
          const l = src.slice(i, e); i = e + 1; line++;
          if ((h.strip ? l.replace(/^\t+/, "") : l) === h.delim) break;
          lines.push(h.strip ? l.replace(/^\t+/, "") : l);
        }
        h.body = lines.length ? lines.join("\n") + "\n" : "";
      }
      continue;
    }
    if (src.startsWith("[[", i) && /\s/.test(src[i + 2] || "") && atCmdStart()) {
      const e = src.indexOf("]]", i + 2); if (e < 0) throw eofError("unexpected EOF while looking for `]]'");
      push({ k: "dbl", v: src.slice(i + 2, e).trim() }); i = e + 2; continue;
    }
    if (src.startsWith("((", i) && atCmdStart()) {
      const e = src.indexOf("))", i + 2); if (e < 0) throw eofError("unexpected EOF while looking for `))'");
      push({ k: "arith", v: src.slice(i + 2, e) }); i = e + 2; continue;
    }
    const ops = ["&>>", "<<<", "<<-", "&&", "||", ";;", ">>", "<<", ">&", "<&", "&>", ";", "&", "|", "(", ")", "<", ">"];
    // Redirection avec descripteur : 2> 2>> 2>&1 1>&2
    const fd = /^(\d)(>>|>&|<&|>|<)/.exec(src.slice(i));
    const op = fd ? null : ops.find((o) => src.startsWith(o, i));
    if (fd || op) {
      let v = fd ? fd[2] : op, n = fd ? +fd[1] : null; i += fd ? fd[0].length : op.length;
      if (v === "<<" || v === "<<-") {
        while (src[i] === " " || src[i] === "\t") i++;
        const e = readWord(src, i), raw = src.slice(i, e); i = e;
        const quoted = /['"\\]/.test(raw), delim = raw.replace(/['"\\]/g, "");
        const h = { k: "op", v: "<<", fd: 0, delim, quoted, strip: v === "<<-", body: "" };
        push(h); pending.push(h); continue;
      }
      if (["<", ">", ">>", ">&", "<&", "&>", "&>>", "<<<"].includes(v)) { push({ k: "op", v, fd: n ?? (v[0] === "<" ? 0 : 1), redir: true }); continue; }
      push({ k: "op", v }); continue;
    }
    const e = readWord(src, i);
    push({ k: "w", v: src.slice(i, e) }); i = e;
  }
  if (pending.length) for (const h of pending) h.open = true;
  const open = toks.find((x) => x.open); if (open) { const e = eofError("warning: here-document delimited by end-of-file (wanted `" + open.delim + "')"); throw e; }
  push({ k: "nl" });
  return toks;
}

export function parse(src) {
  const t = tokenize(src); let p = 0;
  const peek = () => t[p], next = () => t[p++];
  const isW = (v) => peek() && peek().k === "w" && peek().v === v;
  const isOp = (v) => peek() && peek().k === "op" && peek().v === v;
  const skipNl = () => { while (peek() && peek().k === "nl") p++; };
  const atEnd = () => p >= t.length - 1 && (!peek() || peek().k === "nl");
  const expectW = (v) => { skipNl(); if (!isW(v)) { if (atEnd()) throw eofError(); throw new ParseError("syntax error near unexpected token `" + (peek() ? peek().v || "newline" : "EOF") + "'"); } p++; };

  function list(stop) { // stop : mots-clés ou opérateurs qui terminent la liste
    const items = [];
    skipNl();
    while (peek() && !(peek().k === "w" && stop.includes(peek().v)) && !(peek().k === "op" && stop.includes(peek().v))) {
      if (p >= t.length - 1 && peek().k === "nl") break;
      const node = andOr();
      let sep = ";";
      if (isOp(";") || isOp("&")) sep = next().v;
      items.push({ node, bg: sep === "&" });
      skipNl();
      if (p >= t.length) break;
    }
    return { type: "list", items };
  }
  function andOr() {
    let left = pipeline();
    while (isOp("&&") || isOp("||")) { const op = next().v; skipNl(); if (atEnd()) throw eofError(); left = { type: "andor", op, left, right: pipeline() }; }
    return left;
  }
  function pipeline() {
    let neg = false; if (isW("!")) { p++; neg = true; }
    const cmds = [command()];
    while (isOp("|")) { p++; skipNl(); if (atEnd()) throw eofError(); cmds.push(command()); }
    return cmds.length === 1 && !neg ? cmds[0] : { type: "pipeline", cmds, neg };
  }
  function redirs(node) {
    while (peek() && peek().k === "op" && (peek().redir || peek().v === "<<")) {
      const r = next();
      if (r.v === "<<") { node.redirs.push({ op: "<<", fd: 0, heredoc: r }); continue; }
      const w = next(); if (!w || w.k !== "w") throw new ParseError("syntax error near unexpected token `newline'");
      node.redirs.push({ op: r.v, fd: r.fd, target: w.v });
    }
    return node;
  }
  function command() {
    const tk = peek(); if (!tk || atEnd()) throw eofError();
    const line = tk.line;
    if (tk.k === "dbl") { p++; return redirs({ type: "dbl", expr: tk.v, redirs: [], line }); }
    if (tk.k === "arith") { p++; return redirs({ type: "arithcmd", expr: tk.v, redirs: [], line }); }
    if (tk.k === "op" && tk.v === "(") { p++; const body = list([")"]); if (!isOp(")")) throw new ParseError("syntax error: unexpected end of file"); p++; return redirs({ type: "subshell", body, redirs: [], line }); }
    if (tk.k === "w") {
      switch (tk.v) {
        case "{": { p++; const body = list(["}"]); expectW("}"); return redirs({ type: "group", body, redirs: [], line }); }
        case "if": {
          p++; const clauses = []; let otherwise = null;
          const cond = list(["then"]); expectW("then"); clauses.push({ cond, body: list(["elif", "else", "fi"]) });
          while (isW("elif")) { p++; const c = list(["then"]); expectW("then"); clauses.push({ cond: c, body: list(["elif", "else", "fi"]) }); }
          if (isW("else")) { p++; otherwise = list(["fi"]); }
          expectW("fi"); return redirs({ type: "if", clauses, otherwise, redirs: [], line });
        }
        case "while": case "until": {
          p++; const cond = list(["do"]); expectW("do"); const body = list(["done"]); expectW("done");
          return redirs({ type: "while", until: tk.v === "until", cond, body, redirs: [], line });
        }
        case "for": {
          p++; const v = next(); if (!v || v.k !== "w") throw new ParseError("syntax error near `for'");
          let words = null; skipNl();
          if (isW("in")) { p++; words = []; while (peek() && peek().k === "w") words.push(next().v); }
          if (isOp(";")) p++;
          expectW("do"); const body = list(["done"]); expectW("done");
          return redirs({ type: "for", name: v.v, words, body, redirs: [], line });
        }
        case "case": {
          p++; const word = next().v; skipNl(); expectW("in"); const items = []; skipNl();
          while (peek() && !isW("esac")) {
            if (isOp("(")) p++;
            const pats = [next().v]; while (isOp("|")) { p++; pats.push(next().v); }
            if (!isOp(")")) throw new ParseError("syntax error near unexpected token `" + (peek() ? peek().v : "") + "'"); p++;
            const body = list([";;", "esac"]); items.push({ pats, body });
            if (isOp(";;")) p++; skipNl();
          }
          expectW("esac"); return redirs({ type: "case", word, items, redirs: [], line });
        }
        case "function": { p++; const name = next().v; if (isOp("(")) { p++; p++; } skipNl(); return { type: "func", name, body: command(), line }; }
      }
      if (t[p + 1] && t[p + 1].k === "op" && t[p + 1].v === "(" && t[p + 2] && t[p + 2].k === "op" && t[p + 2].v === ")" && /^[A-Za-z_][\w-]*$/.test(tk.v)) {
        p += 3; skipNl(); return { type: "func", name: tk.v, body: command(), line };
      }
    }
    // Commande simple
    const node = { type: "simple", assigns: [], words: [], redirs: [], line };
    for (;;) {
      const x = peek(); if (!x) break;
      if (x.k === "op" && (x.redir || x.v === "<<")) { redirs(node); continue; }
      if (x.k !== "w") break;
      if (!node.words.length && /^[A-Za-z_]\w*\+?=/.test(x.v)) { const m = /^([A-Za-z_]\w*)(\+?)=([\s\S]*)$/.exec(x.v); node.assigns.push([m[1], m[3], !!m[2]]); p++; continue; }
      node.words.push(x.v); p++;
    }
    if (!node.words.length && !node.assigns.length && !node.redirs.length) throw new ParseError("syntax error near unexpected token `" + (x0(peek())) + "'");
    return node;
  }
  const x0 = (x) => (!x ? "newline" : x.k === "nl" ? "newline" : x.v);
  const ast = list([]);
  if (p < t.length - 1) throw new ParseError("syntax error near unexpected token `" + x0(peek()) + "'");
  return ast;
}
