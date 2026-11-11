/* Terminal Git simulé : saisie avec historique, graphe des commits et état des fichiers. */
import { esc, $ } from "./util.js";
import { runScript, snapshot } from "./gitsim.js";

export function gitTermHTML(id) {
  return '<div class="gterm" data-gterm="' + id + '">' +
    '<div class="gterm-screen" aria-live="polite"><pre class="gterm-out"></pre>' +
    '<label class="gterm-line"><span class="gterm-ps1" aria-hidden="true">eleve@boucle:~/projet$</span>' +
    '<input id="' + id + '" class="gterm-in" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Commande du terminal" placeholder="tape une commande, ex. git status"></label></div>' +
    '<div class="gterm-side"><div class="gterm-head"><span class="eyebrow">Graphe des commits</span><span class="gterm-branch"></span></div><div class="gterm-graph"></div>' +
    '<div class="gterm-head"><span class="eyebrow">Fichiers</span></div><ul class="gterm-files"></ul></div></div>';
}

/** Monte le terminal. setup : commandes de mise en place (silencieuses) ; history : commandes déjà tapées (rejouées). */
export function mountGitTerm(root, { setup = [], history = [], onCommand } = {}) {
  const out = $(".gterm-out", root), input = $(".gterm-in", root), screen = $(".gterm-screen", root);
  let sim, typed, cursor;

  function print(cmd, res) {
    const block = document.createElement("span");
    block.innerHTML = '<span class="gterm-cmd"><span class="gterm-dollar">$</span> ' + esc(cmd) + "</span>\n" + (res.out ? '<span class="' + (res.ok ? "" : "gterm-err") + '">' + esc(res.out) + "</span>\n" : "");
    out.appendChild(block);
  }
  function start(cmds) {
    ({ sim } = runScript(setup, []));
    typed = []; out.innerHTML = '<span class="gterm-dim">Terminal simulé : les commandes n\'affectent que cet exercice. Tape help pour la liste des commandes.</span>\n';
    for (const c of cmds) exec(c, false);
    cursor = typed.length; render();
  }
  function exec(cmd, notify) {
    if (cmd.trim() === "clear") { out.innerHTML = ""; typed.push(cmd); return; }
    const res = sim.run(cmd);
    typed.push(cmd);
    print(cmd, res);
    if (notify && onCommand) onCommand(typed.slice(), res);
  }
  function render() {
    const snap = snapshot(sim);
    $(".gterm-branch", root).textContent = !snap.inited ? "pas de dépôt" : snap.detached ? "HEAD détachée" : "sur " + snap.branch + (snap.op ? " · " + ({ merge: "fusion", rebase: "rebase", "cherry-pick": "cherry-pick", revert: "revert" }[snap.op]) + " en cours" : "");
    $(".gterm-graph", root).innerHTML = graphSVG(snap);
    const g = $(".gterm-graph", root); g.scrollLeft = g.scrollWidth;
    $(".gterm-files", root).innerHTML = snap.files.length ? snap.files.map(fileRow).join("") : '<li class="gterm-dim">dossier vide</li>';
    screen.scrollTop = screen.scrollHeight;
  }

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const cmd = input.value; input.value = "";
      if (!cmd.trim()) return;
      exec(cmd, true); cursor = typed.length; render();
    } else if (e.key === "ArrowUp") {
      e.preventDefault(); if (cursor > 0) { cursor--; input.value = typed[cursor]; }
    } else if (e.key === "ArrowDown") {
      e.preventDefault(); if (cursor < typed.length - 1) { cursor++; input.value = typed[cursor]; } else { cursor = typed.length; input.value = ""; }
    } else if (e.key === "l" && e.ctrlKey) { e.preventDefault(); out.innerHTML = ""; }
  });
  screen.addEventListener("click", () => { if (!window.getSelection().toString()) input.focus(); });

  start(history);
  return {
    get sim() { return sim; },
    commands: () => typed.slice(),
    reset: () => { start([]); if (onCommand) onCommand([], { ok: true, out: "" }); },
    run: (cmd) => { exec(cmd, true); cursor = typed.length; render(); },
  };
}

function fileRow(f) {
  const tags = [];
  if (f.conflict) tags.push(["conflit", "bad"]);
  else {
    if (f.staged) tags.push([{ "new file": "nouveau, indexé", modified: "modifié, indexé", deleted: "supprimé, indexé" }[f.staged], "ok"]);
    if (f.unstaged) tags.push([{ modified: "modifié", deleted: "supprimé" }[f.unstaged], "warn"]);
    if (f.untracked) tags.push(["non suivi", "warn"]);
    if (f.ignored) tags.push(["ignoré", "dim"]);
  }
  return '<li><code>' + esc(f.path) + "</code>" + tags.map(([t, k]) => '<span class="gtag ' + k + '">' + t + "</span>").join("") + "</li>";
}

/** Graphe horizontal : le temps va de gauche à droite, une ligne par branche. */
export function graphSVG(snap) {
  if (!snap.commits.length) return '<p class="gterm-dim gterm-empty">' + (snap.inited ? "Aucun commit pour l'instant." : "Pas encore de dépôt : git init") + "</p>";
  const DX = 64, DY = 46, R = 9, TOP = 18;
  const refText = (r) => (r.kind === "tag" ? "tag: " + r.label : r.label);
  const refW = (r) => Math.max(30, refText(r).length * 6.6 + 10);
  const half = (c) => Math.max(30, ...c.refs.map((r) => refW(r) / 2 + 4));
  const first = snap.commits[0], last = snap.commits[snap.commits.length - 1];
  const PADL = half(first), PADR = half(last);
  const pos = {}; snap.commits.forEach((c, i) => { pos[c.id] = { x: PADL + i * DX, y: TOP + 26 + c.lane * DY }; });
  const maxRefs = Math.max(0, ...snap.commits.map((c) => c.refs.length));
  const width = PADL + PADR + (snap.commits.length - 1) * DX;
  const height = TOP + 26 + (snap.lanes - 1) * DY + R + 30;
  let edges = "", nodes = "", labels = "";
  for (const c of snap.commits) {
    const p = pos[c.id];
    c.parents.forEach((pid, k) => {
      const q = pos[pid]; if (!q) return;
      const d = q.y === p.y ? "M" + q.x + " " + q.y + " L" + p.x + " " + p.y : "M" + q.x + " " + q.y + " C" + (q.x + DX * 0.6) + " " + q.y + " " + (p.x - DX * 0.6) + " " + p.y + " " + p.x + " " + p.y;
      edges += '<path d="' + d + '" class="g-edge' + (k ? " merge" : "") + '"/>';
    });
    const isHead = c.refs.some((r) => r.kind === "head");
    nodes += '<g><title>' + esc(c.short + " " + c.message) + '</title><circle cx="' + p.x + '" cy="' + p.y + '" r="' + R + '" class="g-node' + (isHead ? " head" : "") + (c.parents.length > 1 ? " merge" : "") + '"/>' +
      '<text x="' + p.x + '" y="' + (p.y + R + 13) + '" class="g-hash" text-anchor="middle">' + c.short + "</text></g>";
    c.refs.slice().sort((a, b) => (a.kind === "head" ? -1 : b.kind === "head" ? 1 : 0)).forEach((r, i) => {
      const txt = refText(r);
      const w = refW(r);
      const ly = p.y - R - 10 - i * 16;
      labels += '<g class="g-ref ' + r.kind + '"><rect x="' + (p.x - w / 2) + '" y="' + (ly - 10) + '" width="' + w + '" height="14" rx="7"/><text x="' + p.x + '" y="' + (ly + 1) + '" text-anchor="middle">' + esc(txt) + "</text></g>";
    });
  }
  const extraTop = Math.max(0, maxRefs - 1) * 16;
  return '<svg class="g-svg" width="' + Math.max(width, 120) + '" height="' + (height + extraTop) + '" viewBox="0 ' + -extraTop + " " + Math.max(width, 120) + " " + (height + extraTop) + '" role="img" aria-label="Graphe de ' + snap.commits.length + ' commit(s)">' + edges + nodes + labels + "</svg>";
}

/** Exécute un extrait de théorie (lignes « ! » = échec attendu) et renvoie la transcription HTML. */
export function runSnippetHTML(code) {
  const lines = code.split("\n").filter((l) => l.trim() && !l.trim().startsWith("#")).map((l) => l.replace(/^!\s*/, ""));
  const { transcript } = runScript([], lines);
  return transcript.map((t) => '<span class="gterm-cmd"><span class="gterm-dollar">$</span> ' + esc(t.cmd) + "</span>" + (t.out ? "\n" + '<span class="' + (t.ok ? "" : "gterm-err") + '">' + esc(t.out) + "</span>" : "")).join("\n");
}
