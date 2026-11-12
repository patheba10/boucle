/* Terminal Linux simulé : saisie avec historique, prompt, contenu du dossier courant et services.
   Aussi : extraits de théorie exécutables et tests des défis de scripts. */
import { esc, $ } from "./util.js";
import { createShell, evaluate } from "./shell/shell.js";
import { parse } from "./shell/parse.js";
import { modeString } from "./shell/fs.js";

export function shTermHTML(id) {
  return '<div class="gterm shterm" data-shterm="' + id + '">' +
    '<div class="gterm-screen" aria-live="polite"><pre class="gterm-out"></pre>' +
    '<label class="gterm-line"><span class="gterm-ps1" aria-hidden="true"></span>' +
    '<input id="' + id + '" class="gterm-in" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Commande du terminal" placeholder="tape une commande, ex. ls -l"></label></div>' +
    '<div class="gterm-side"><div class="gterm-head"><span class="eyebrow">Dossier courant</span><span class="gterm-branch sh-cwd"></span></div><ul class="sh-ls"></ul>' +
    '<div class="sh-svc-wrap" hidden><div class="gterm-head"><span class="eyebrow">Services</span></div><ul class="sh-svc"></ul></div></div></div>';
}

/** Découpe un texte en commandes complètes (une boucle ou un here-doc peuvent tenir sur plusieurs lignes). */
export function splitCommands(text) {
  const out = []; let buf = [];
  for (const line of text.split("\n")) {
    if (!buf.length && (!line.trim() || line.trim().startsWith("#"))) continue;
    buf.push(line);
    try { parse(buf.join("\n").replace(/^!\s*/, "")); out.push(buf.join("\n")); buf = []; }
    catch (e) { if (!e.eof) { out.push(buf.join("\n")); buf = []; } }
  }
  if (buf.length) out.push(buf.join("\n"));
  return out;
}

export function mountShTerm(root, { setup = {}, history = [], onCommand } = {}) {
  const out = $(".gterm-out", root), input = $(".gterm-in", root), screen = $(".gterm-screen", root), ps1 = $(".gterm-ps1", root);
  let sh, typed, cursor, pending = [];
  const print = (cmd, prompt, res, echoed) => {
    const b = document.createElement("span");
    b.innerHTML = (echoed ? "" : '<span class="gterm-cmd"><span class="gterm-dollar">' + esc(prompt) + "</span>" + esc(cmd) + "</span>\n") +
      res.chunks.map(([k, s]) => (k === "err" ? '<span class="gterm-err">' + esc(s) + "</span>" : esc(s))).join("");
    out.appendChild(b);
  };
  function start(cmds) {
    sh = createShell(setup);
    typed = []; pending = []; out.innerHTML = '<span class="gterm-dim">Terminal Linux simulé (Ubuntu 24.04) : les commandes n\'affectent que cet exercice. Flèche du haut : commande précédente.</span>\n';
    for (const c of cmds) exec(c, false);
    cursor = typed.length; render();
  }
  function exec(cmd, notify, echoed) {
    typed.push(cmd);
    if (cmd.trim() === "clear") { out.innerHTML = ""; sh.history.push(cmd); return; }
    const prompt = sh.prompt();
    const res = sh.run(cmd);
    print(cmd, prompt, res, echoed);
    if (notify && onCommand) onCommand(typed.slice(), res);
  }
  function render() {
    ps1.textContent = sh.prompt().trimEnd();
    $(".sh-cwd", root).textContent = sh.cwd + (sh.user === "root" ? " · root" : "");
    let rows = [];
    try {
      const dir = sh.fs.stat(sh.cwd, "root");
      rows = Object.entries(dir.children).filter(([n]) => !n.startsWith(".") || n === ".env").sort(([a], [b]) => a.localeCompare(b)).map(([n, c]) =>
        '<li><code class="sh-mode">' + modeString(c) + '</code><span class="sh-own">' + esc(c.owner) + '</span><code class="' + (c.t === "d" ? "sh-dir" : c.mode & 0o111 && c.t === "f" ? "sh-exe" : "") + '">' + esc(n) + (c.t === "d" ? "/" : "") + (c.t === "l" ? " → " + esc(c.target) : "") + "</code></li>");
    } catch (e) { rows = []; }
    $(".sh-ls", root).innerHTML = rows.join("") || '<li class="gterm-dim">dossier vide (fichiers cachés non affichés)</li>';
    const svc = Object.entries(sh.services).filter(([n]) => n !== "cron");
    $(".sh-svc-wrap", root).hidden = !svc.length;
    $(".sh-svc", root).innerHTML = svc.map(([n, s]) => '<li><code>' + esc(n) + '</code><span class="gtag ' + (s.active ? "ok" : s.failed ? "bad" : "dim") + '">' + (s.active ? "actif" : s.failed ? "en échec" : "arrêté") + "</span>" + (s.enabled ? '<span class="gtag dim">au démarrage</span>' : "") + "</li>").join("");
    screen.scrollTop = screen.scrollHeight;
  }
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const line = input.value; input.value = "";
      if (!line.trim() && !pending.length) return;
      // Commande incomplète (boucle, here-doc, guillemet ouvert) : on attend la suite, comme bash avec « > ».
      const whole = [...pending, line].join("\n");
      let incomplete = false; try { parse(whole); } catch (err) { incomplete = !!err.eof; }
      if (incomplete) { out.appendChild(document.createTextNode((pending.length ? "> " : sh.prompt()) + line + "\n")); pending.push(line); ps1.textContent = ">"; screen.scrollTop = screen.scrollHeight; return; }
      if (pending.length) out.appendChild(document.createTextNode("> " + line + "\n"));
      const cmd = whole; const shown = pending.length; pending = [];
      exec(cmd, true, shown); cursor = typed.length; render();
    }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (cursor > 0) { cursor--; input.value = typed[cursor]; } }
    else if (e.key === "ArrowDown") { e.preventDefault(); if (cursor < typed.length - 1) { cursor++; input.value = typed[cursor]; } else { cursor = typed.length; input.value = ""; } }
    else if (e.key === "l" && e.ctrlKey) { e.preventDefault(); out.innerHTML = ""; }
    else if (e.key === "c" && e.ctrlKey && !window.getSelection().toString()) { e.preventDefault(); out.appendChild(document.createTextNode((pending.length ? "> " : sh.prompt()) + input.value + "^C\n")); input.value = ""; pending = []; ps1.textContent = sh.prompt().trimEnd(); }
  });
  screen.addEventListener("click", () => { if (!window.getSelection().toString()) input.focus(); });
  start(history);
  return { get sh() { return sh; }, commands: () => typed.slice(), reset: () => { start([]); if (onCommand) onCommand([], null); }, run: (c) => { exec(c, true); cursor = typed.length; render(); } };
}

/** Extrait de théorie : chaque commande s'exécute dans un shell neuf ; « ! » en tête = doit échouer. */
export function runShSnippet(code, setup = {}) {
  const sh = createShell(setup);
  let html = "";
  for (const raw of splitCommands(code)) {
    const expectFail = raw.startsWith("!"); const cmd = expectFail ? raw.replace(/^!\s*/, "") : raw;
    const prompt = sh.prompt(); const r = sh.run(cmd);
    html += '<span class="gterm-cmd"><span class="gterm-dollar">' + esc(prompt) + "</span>" + esc(cmd) + "</span>\n" + r.chunks.map(([k, s]) => (k === "err" ? '<span class="gterm-err">' + esc(s) + "</span>" : esc(s))).join("");
  }
  return html;
}

/** Défi de script : chaque test écrit le script, puis le lance avec ses arguments. */
export function runScriptTests(ch, src) {
  const file = ch.file || "/home/eleve/script.sh";
  return ch.tests.map((t) => {
    const sh = createShell({ ...(ch.setup || {}), ...(t.setup || {}), files: { ...((ch.setup || {}).files || {}), ...((t.setup || {}).files || {}) } });
    sh.fs.write(file, src, "eleve"); const n = sh.fs.stat(file, "root"); n.owner = "eleve"; n.group = "eleve"; n.mode = 0o755;
    const argStr = (t.args || []).map((a) => (/^[\w./:=@-]+$/.test(a) ? a : "'" + a.replace(/'/g, "'\\''") + "'")).join(" ");
    const cmd = "bash " + file.replace(sh.home() + "/", "") + (argStr ? " " + argStr : "");
    const r = sh.run(cmd, { stdin: t.stdin || "" });
    const norm = (s) => String(s).replace(/[ \t]+$/gm, "").replace(/\n+$/, "");
    const fails = [];
    if (t.out !== undefined && norm(r.out) !== norm(t.out)) fails.push("sortie");
    if (t.outHas !== undefined && ![].concat(t.outHas).every((x) => r.out.includes(x))) fails.push("sortie");
    if (t.code !== undefined && r.code !== t.code) fails.push("code de sortie " + r.code + " au lieu de " + t.code);
    if (t.err !== undefined && !r.err.includes(t.err)) fails.push("message d'erreur");
    const crit = t.checks ? evaluate(sh, t.checks).filter((c) => !c.ok) : [];
    const ok = !fails.length && !crit.length;
    return { ok, label: (t.label || "$ " + cmd + (t.stdin ? " (avec une entrée)" : "")), cmd, got: r, detail: [...fails, ...crit.map((c) => c.label)].join(" ; "), expected: t.out };
  });
}
