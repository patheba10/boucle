/* Boucle — routeur et pages. */
import { COURSES, ROADMAPS, INSTALL } from "../../content/index.js";
import { I } from "./lib/icons.js";
import { esc, $, $$, inl, norm, color, today, toast as rawToast } from "./lib/util.js";
import { S, save, resetAll, markDay, streak, level, ls, XP_PER_LEVEL } from "./lib/state.js";
import { highlight } from "./lib/highlight.js";
import { editorHTML, mountEditor } from "./lib/editor.js";
import { run, isPyReady, preloadPy } from "./lib/engines.js";
import { check, consoleHTML, statusHTML, loadFailHTML } from "./lib/checker.js";

const toast = (msg) => rawToast(msg, I.bolt);
function gain(n, msg) { S.xp += n; markDay(); save(); updateStats(); toast("+" + n + " XP · " + msg); }
const firstLoad = (lang) => lang === "py"
  ? (isPyReady() ? "Exécution…" : "Démarrage de Python (quelques secondes la première fois)…")
  : "Exécution…";

/* ===================== Données dérivées ===================== */
const ALL = [];
COURSES.forEach(c => c.lessons.forEach((l, i) => ALL.push({ c, l, i })));
const byId = id => ALL.find(x => x.l.id === id);
function lessonState(l) {
  const st = S.lessons[l.id]; const nq = (l.quiz || []).length;
  const q = st ? Object.values(st.quiz).filter(Boolean).length : 0;
  const quizDone = q >= nq; const chDone = !l.challenge || (st && st.ch);
  return { quizDone, chDone, done: quizDone && chDone, started: !!st && (q > 0 || st.ch) };
}
function courseProgress(c) { const d = c.lessons.filter(l => lessonState(l).done).length; return { d, n: c.lessons.length, pct: Math.round(100 * d / c.lessons.length) }; }
function nextLesson(c) { return (c || null) ? c.lessons.find(l => !lessonState(l).done) : null; }
function rmProgress(r) { const ids = r.stages.flatMap(s => s.nodes.map(n => n.id)); const d = ids.filter(id => S.roadmap[id]).length; return { d, n: ids.length, pct: Math.round(100 * d / ids.length) }; }

/** Tout le code Python d'une leçon (pour précharger les paquets qu'elle importe). */
function lessonCode(l) {
  const blocks = [...l.theory.matchAll(/~~~py[^\n]*\n([\s\S]*?)\n~~~/g)].map(m => m[1]);
  const ch = l.challenge || {};
  return blocks.concat([ch.starter || "", ch.solution || "", ch.tests || ""]).join("\n");
}

/* ===================== Théorie (texte + extraits exécutables) ===================== */
const LANG_LABEL = { py: "python", cpp: "c++", bash: "terminal", ps: "powershell", text: "texte" };
function theoryHTML(src, lang, canRun) {
  const parts = src.split(/~~~(\w+)([^\n]*)\n([\s\S]*?)\n~~~/);
  let h = "";
  for (let i = 0; i < parts.length; i += 4) {
    if (parts[i].trim()) h += inl(parts[i]);
    if (i + 3 < parts.length) {
      const l = parts[i + 1], opts = parts[i + 2], code = parts[i + 3];
      const runnable = canRun && (l === "py" || l === "cpp") && !/norun/.test(opts);
      const stdin = (/stdin:(.*)$/.exec(opts) || [])[1];
      h += '<div class="snippet" data-lang="' + l + '"' + (stdin ? ' data-stdin="' + esc(stdin.trim()) + '"' : "") + '><div class="snippet-bar"><span class="lbl">' + (LANG_LABEL[l] || l) + (stdin ? " · entrée : " + esc(stdin.trim()) : "") + "</span>" +
        (runnable ? '<button class="run" type="button">' + I.play + "Exécuter</button>" : "") + "</div><pre>" + highlight(code, l) + '</pre><textarea hidden>' + esc(code) + "</textarea></div>";
    }
  }
  return h;
}
function bindSnippets(root) {
  $$(".snippet", root).forEach(sn => {
    const b = $(".run", sn); if (!b) return;
    b.addEventListener("click", async () => {
      const lang = sn.dataset.lang, code = $("textarea", sn).value;
      let res = $(".res", sn); if (!res) { res = document.createElement("pre"); res.className = "res"; sn.appendChild(res); }
      b.disabled = true; res.innerHTML = statusHTML(firstLoad(lang));
      try { const r = await run(lang, code, sn.dataset.stdin || "", t => { res.innerHTML = statusHTML(t); }); res.innerHTML = consoleHTML(r, lang); }
      catch (e) { res.innerHTML = loadFailHTML(lang, e); }
      b.disabled = false;
    });
  });
}

/* ===================== Rendu des pages ===================== */
const app = () => $("#app");
function setNav(route) {
  const lesson = byId(route);
  $$(".nav a").forEach(a => {
    const t = a.getAttribute("href").slice(1);
    const on = t === route || (lesson && lesson.c.route === t) || (t === "roadmaps" && ROADMAPS.some(r => r.id === route));
    if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
}
function updateStats() {
  $("#xp").textContent = S.xp + " XP"; $("#streak").textContent = streak() + " j";
  $("#streak-pill").title = "Série : " + streak() + " jour(s) consécutif(s) avec au moins un exercice réussi";
}

function dailyPick() {
  const pool = ALL.filter(x => x.l.challenge); const d = today(); let h = 0;
  for (const ch of d) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return pool[h % pool.length];
}

function pageHome() {
  const lv = level(), inLv = S.xp % XP_PER_LEVEL;
  const doneL = ALL.filter(x => lessonState(x.l).done).length;
  const lastC = S.last && byId(S.last) ? byId(S.last).c : COURSES[0];
  let nx = nextLesson(lastC); let nxC = lastC;
  if (!nx) { for (const c of COURSES) { const n = nextLesson(c); if (n) { nx = n; nxC = c; break; } } }
  const dp = dailyPick(); const dDone = lessonState(dp.l).chDone;
  const name = dp.c.name;
  return '<section class="hero">' +
    '<div class="card hero-main"><svg class="hero-loop" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M8 20.5a7 7 0 1 1 7-7v5a7 7 0 1 0 7-7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>' +
      '<span class="eyebrow">Python · C++ · DevOps · Cloud · ML</span>' +
      "<h1>Une petite boucle de code <em>chaque jour</em>.</h1>" +
      '<p class="lead">Lis la théorie, réponds au quiz, réussis le défi. Tout s\'exécute dans ton navigateur, et les roadmaps te montrent où mène chaque compétence.</p>' +
      (nx ? '<a class="continue" href="#' + nx.id + '"><div><b>' + (S.xp ? "Reprendre" : "Commencer") + " : " + esc(nx.title) + "</b><span>" + nxC.name + " · leçon " + (nxC.lessons.indexOf(nx) + 1) + " sur " + nxC.lessons.length + '</span></div><span class="go">' + I.arrow + "</span></a>"
          : '<div class="continue"><div><b>Tous les cours sont terminés.</b><span>Passe aux mini-projets des roadmaps.</span></div></div>') +
    "</div>" +
    '<div class="card level"><div class="level-top"><span class="eyebrow">Niveau</span><span class="chip acc">' + inLv + " / 150 XP</span></div>" +
      '<div class="level-num">' + lv + '</div><div class="bar"><i style="width:' + Math.round(100 * inLv / 150) + '%"></i></div>' +
      '<div class="kv"><div><b>' + S.xp + "</b><span>XP au total</span></div><div><b>" + streak() + "</b><span>jours de série</span></div><div><b>" + doneL + "/" + ALL.length + "</b><span>leçons finies</span></div></div>" +
    "</div></section>" +
    '<section class="card daily"><div class="daily-ic">' + I.target + '</div><div class="daily-txt"><b>Défi du jour</b><p>' + name + " · " + esc(dp.l.title) + (dDone ? " · déjà réussi, bravo." : " · un défi tiré au sort chaque jour.") + '</p></div><a class="btn ' + (dDone ? "" : "primary") + '" href="#' + dp.l.id + '">' + (dDone ? "Revoir" : "Relever le défi") + "</a></section>" +
    '<section style="display:flex;flex-direction:column;gap:14px"><div class="sec-h"><h2>Cours</h2><a href="#installer">Installer ton environnement</a></div><div class="grid-courses">' +
      COURSES.map(c => { const p = courseProgress(c); return '<a class="card course-card" href="#' + c.route + '" style="--c:' + color(c.id) + '"><div class="course-head"><span class="badge-lang">' + esc(c.badge) + "</span><div><h3>" + c.name + '</h3><span class="mono">' + esc(c.tag) + " " + c.lessons.length + " leçons</span></div></div><p>" + esc(c.blurb) + '</p><div class="bar"><i style="width:' + p.pct + '%"></i></div><div class="meta-row"><span>' + p.d + " / " + p.n + " terminées</span><span>" + p.pct + " %</span></div></a>"; }).join("") +
    "</div></section>" +
    '<section style="display:flex;flex-direction:column;gap:14px"><div class="sec-h"><h2>Roadmaps métier</h2><a href="#roadmaps">Tout voir</a></div><div class="grid3">' +
      ROADMAPS.map(r => { const p = rmProgress(r); return '<a class="card rm-card" href="#' + r.id + '" style="--c:' + color(r.id) + '"><span class="k">' + esc(r.kicker) + "</span><h3>" + r.name + "</h3><p>" + esc(r.intro) + '</p><div class="bar"><i style="width:' + p.pct + '%"></i></div><div class="meta-row"><span>' + p.d + " / " + p.n + " étapes acquises</span><span>" + p.pct + " %</span></div></a>"; }).join("") +
    "</div></section>";
}

function pageCourse(c) {
  const p = courseProgress(c); const nx = nextLesson(c);
  return '<div style="--c:' + color(c.id) + ';display:flex;flex-direction:column;gap:24px">' +
    '<div class="crumbs"><a href="#home">Accueil</a><span>/</span><span>' + c.name + "</span></div>" +
    '<section class="course-hero"><span class="badge-lang">' + esc(c.badge) + '</span><div class="txt"><h1>' + c.name + '</h1><p class="lead">' + esc(c.blurb) + "</p></div>" +
      '<div class="course-prog"><span class="eyebrow">Progression</span><b>' + p.d + " / " + p.n + '</b><div class="bar"><i style="width:' + p.pct + '%"></i></div></div></section>' +
    (c.note ? '<div class="note">' + I.info + "<span>" + esc(c.note) + "</span></div>" : "") +
    '<ol class="path">' + c.lessons.map((l, i) => {
      const sec = l.section && (i === 0 || c.lessons[i - 1].section !== l.section) ? '<li class="sec"><h2>' + esc(l.section) + "</h2></li>" : "";
      const st = lessonState(l); const cls = st.done ? "done" : (nx && nx.id === l.id ? "next" : (st.started ? "part" : ""));
      const chips = (l.theoryOnly ? '<span class="chip">Théorie + quiz</span>' : "") +
        '<span class="chip' + (st.quizDone ? " ok" : "") + '">' + (st.quizDone ? I.check : "") + "Quiz</span>" +
        (l.challenge ? '<span class="chip' + (st.chDone ? " ok" : "") + '">' + (st.chDone ? I.check : "") + "Défi</span>" : "") +
        '<span class="chip acc">' + l.xp + " XP</span>";
      return sec + '<li class="' + cls + '"><span class="node">' + (st.done ? I.check : i + 1) + '</span><a class="card lesson-row" href="#' + l.id + '"><div class="t"><b>' + esc(l.title) + "</b><span>" + (cls === "next" ? "Prochaine leçon" : st.done ? "Terminée" : st.started ? "Commencée" : "À faire") + '</span></div><div class="chips">' + chips + "</div></a></li>";
    }).join("") + "</ol></div>";
}

function quizHTML(l) {
  const st = S.lessons[l.id];
  return (l.quiz || []).map((q, qi) => {
    const solved = st && st.quiz[qi];
    return '<div class="quiz" data-qi="' + qi + '"><p class="quiz-q">' + inl(q.q) + '</p><div class="opts">' +
      q.options.map((o, oi) => '<button type="button" class="opt' + (solved && oi === q.answer ? " right" : "") + '" data-oi="' + oi + '"' + (solved ? " disabled" : "") + '><span class="l">' + "ABCD"[oi] + "</span><span>" + esc(o) + "</span></button>").join("") +
      "</div>" + (solved ? '<p class="explain"><b>Exact.</b> ' + esc(q.explain) + "</p>" : "") + "</div>";
  }).join("");
}

function pageLesson(x) {
  const { c, l, i } = x; const lang = c.lang; const st = lessonState(l); const L = ls(l.id);
  S.last = l.id; save();
  const prev = c.lessons[i - 1], next = c.lessons[i + 1];
  const ch = l.challenge;
  const code = (S.code[l.id] != null ? S.code[l.id] : (ch ? ch.starter : ""));
  const file = lang === "py" ? "main.py" : "main.cpp";
  const nQuiz = (l.quiz || []).length;
  let right = "";
  if (ch) {
    right = '<section class="card block" id="defi"><div class="block-h"><span class="n">3</span><h2>Défi</h2><span class="chip' + (st.chDone ? " ok" : " acc") + '">' + (st.chDone ? I.check + "Réussi" : "+" + Math.round(l.xp * 0.6) + " XP") + "</span></div>" +
      '<div class="prose">' + inl(ch.prompt) + "</div>" +
      '<div class="ide" style="--c:' + color(c.id) + '"><div class="ide-bar"><span class="file"><i></i>' + file + "</span>" +
        '<button class="tb" type="button" data-act="hint">' + I.bulb + "Indice</button>" +
        '<button class="tb" type="button" data-act="sol">' + I.eye + "Solution</button>" +
        '<button class="tb" type="button" data-act="reset">' + I.reset + "Réinitialiser</button></div>" +
        editorHTML("ed-" + l.id, lang, code) +
        '<div class="ide-actions"><button class="btn sm" type="button" data-act="run">' + I.play + 'Exécuter</button><button class="btn sm primary" type="button" data-act="check">' + I.check + 'Vérifier</button><span class="kbd">Ctrl + Entrée pour exécuter</span></div>' +
        '<div class="console" aria-live="polite"><span class="lbl">Console</span><span class="dim">Exécute ton code pour voir la sortie ici.' + (lang === "cpp" ? " Pour « Exécuter », l'entrée du premier test est utilisée." : "") + "</span></div>" +
      "</div><div data-slot=\"hint\"></div><div data-slot=\"verdict\"></div></section>";
  } else {
    right = '<section class="card block"><div class="block-h"><span class="n">3</span><h2>Pratique sur ta machine</h2></div><div class="prose"><p>Cette leçon utilise des parties du C++ que l\'interpréteur du navigateur ne gère pas. Copie les exemples dans un fichier @@main.cpp@@ et compile-les :</p></div>'.replace(/@@([^@]+)@@/g, "<code>$1</code>") +
      '<pre class="out">g++ -std=c++17 -Wall main.cpp -o main\n./main</pre><div class="prose"><p>Sur Windows, MSYS2 ou WSL fournissent g++. Les compilateurs en ligne comme Compiler Explorer fonctionnent aussi.</p></div><p><a class="btn sm" href="https://godbolt.org/" target="_blank" rel="noopener">Ouvrir Compiler Explorer</a></p></section>';
  }
  return '<div style="--c:' + color(c.id) + ';display:flex;flex-direction:column;gap:22px">' +
    '<div class="lesson-head"><div class="crumbs"><a href="#home">Accueil</a><span>/</span><a href="#' + c.route + '">' + c.name + "</a><span>/</span><span>Leçon " + (i + 1) + "</span></div>" +
      "<h1>" + esc(l.title) + '</h1><div class="steps"><a href="#theorie" data-jump="theorie">' + I.book + 'Théorie</a><a href="#quiz" data-jump="quiz" class="' + (st.quizDone ? "ok" : "") + '">' + (st.quizDone ? I.check : "") + "Quiz</a>" +
      (ch ? '<a href="#defi" data-jump="defi" class="' + (st.chDone ? "ok" : "") + '">' + (st.chDone ? I.check : "") + "Défi</a>" : "") + "</div></div>" +
    '<div class="lesson-grid"><div class="lesson-col">' +
      '<section class="card block" id="theorie"><div class="block-h"><span class="n">1</span><h2>Théorie</h2></div><div class="prose">' + theoryHTML(l.theory, lang, true) + "</div></section>" +
      (l.setup ? '<details class="card block setup"><summary><span class="block-h"><span class="n">' + I.info + '</span><h2>Sur ta machine</h2></span></summary><div class="prose">' + theoryHTML(l.setup, "bash", false) + "</div></details>" : "") +
      '<section class="card block" id="quiz"><div class="block-h"><span class="n">2</span><h2>Quiz</h2><span class="chip' + (st.quizDone ? " ok" : " acc") + '">' + (st.quizDone ? I.check + "Réussi" : "+" + (ch ? Math.round(l.xp * 0.4) : l.xp) + " XP") + "</span></div>" + quizHTML(l) + "</section>" +
    '</div><div class="lesson-col sticky">' + right + "</div></div>" +
    '<nav class="lesson-nav">' + (prev ? '<a class="btn" href="#' + prev.id + '">' + I.back + esc(prev.title) + "</a>" : '<a class="btn" href="#' + c.route + '">' + I.back + "Sommaire</a>") +
      (next ? '<a class="btn primary" href="#' + next.id + '">' + esc(next.title) + I.arrow + "</a>" : '<a class="btn primary" href="#roadmaps">Voir les roadmaps' + I.arrow + "</a>") + "</nav></div>";
}

function bindLesson(x) {
  const { c, l } = x; const lang = c.lang; const L = ls(l.id); const ch = l.challenge;
  bindSnippets(app());
  if (lang === "py") preloadPy(lessonCode(l));
  $$("[data-jump]").forEach(a => a.addEventListener("click", e => { e.preventDefault(); const t = document.getElementById(a.dataset.jump); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" }); }));
  const qXP = ch ? Math.round(l.xp * 0.4) : l.xp, nQ = (l.quiz || []).length;
  $$(".quiz").forEach(qd => {
    const qi = +qd.dataset.qi, q = l.quiz[qi];
    $$(".opt", qd).forEach(b => b.addEventListener("click", () => {
      const oi = +b.dataset.oi; const old = $(".explain", qd); if (old) old.remove();
      const p = document.createElement("p");
      if (oi === q.answer) {
        $$(".opt", qd).forEach(o => { o.disabled = true; o.classList.remove("wrong"); });
        b.classList.add("right"); p.className = "explain"; p.innerHTML = "<b>Exact.</b> " + esc(q.explain);
        if (!L.quiz[qi]) {
          L.quiz[qi] = true; const allDone = Object.values(L.quiz).filter(Boolean).length >= nQ;
          if (allDone) gain(qXP, "quiz réussi"); else { markDay(); save(); }
          if (allDone) refreshSteps(x);
        }
      } else {
        b.classList.add("wrong"); b.disabled = true; p.className = "explain no"; p.innerHTML = "<b>Pas tout à fait.</b> Réessaie : relis la théorie juste au-dessus.";
      }
      qd.appendChild(p);
    }));
  });
  if (!ch) return;
  const root = $('[data-ed="ed-' + l.id + '"]'); const cons = $(".console");
  let tSave;
  const ed = mountEditor(root, v => { clearTimeout(tSave); tSave = setTimeout(() => { S.code[l.id] = v; save(); }, 300); }, () => doRun());
  const btnRun = $('[data-act="run"]'), btnCheck = $('[data-act="check"]');
  const busy = on => { btnRun.disabled = on; btnCheck.disabled = on; };
  async function doRun() {
    busy(true); const lbl = '<span class="lbl">Console</span>'; cons.innerHTML = lbl + statusHTML(firstLoad(lang));
    try {
      const stdin = lang === "cpp" ? ch.tests[0].input : "";
      const r = await run(lang, ed.get(), stdin, t => { cons.innerHTML = lbl + statusHTML(t); });
      cons.innerHTML = '<span class="lbl">Console' + (stdin ? " · entrée : " + esc(stdin.replace(/\n/g, " ⏎ ")) : "") + "</span>" + consoleHTML(r, lang);
    } catch (e) { cons.innerHTML = '<span class="lbl">Console</span>' + loadFailHTML(lang, e); }
    busy(false);
  }
  async function doCheck() {
    busy(true); const lbl = '<span class="lbl">Console</span>'; cons.innerHTML = lbl + statusHTML(firstLoad(lang));
    const slot = $('[data-slot="verdict"]');
    try {
      const r = await check(lang, ch, ed.get(), t => { cons.innerHTML = lbl + statusHTML(t); });
      cons.innerHTML = lbl + consoleHTML({ out: r.pre || "", err: r.err, line: r.line, figs: r.figs }, lang, r.userLines);
      slot.innerHTML = verdictHTML(r, lang);
      if (r.ok && !L.ch) {
        L.ch = true; const xp = Math.round(l.xp * 0.6) * (L.sol ? 0.5 : 1);
        gain(Math.round(xp), L.sol ? "défi réussi (solution vue)" : "défi réussi"); refreshSteps(x);
      } else if (!r.ok) { L.fails = (L.fails || 0) + 1; save(); }
    } catch (e) { cons.innerHTML = '<span class="lbl">Console</span>' + loadFailHTML(lang, e); }
    busy(false);
  }
  btnRun.addEventListener("click", doRun);
  btnCheck.addEventListener("click", doCheck);
  $('[data-act="reset"]').addEventListener("click", () => { ed.set(ch.starter); delete S.code[l.id]; save(); $('[data-slot="verdict"]').innerHTML = ""; });
  $('[data-act="hint"]').addEventListener("click", () => { $('[data-slot="hint"]').innerHTML = '<div class="hint-box"><b>Indice.</b> ' + inl(esc(ch.hint)) + "</div>"; });
  const solBtn = $('[data-act="sol"]'); let armed = false;
  solBtn.addEventListener("click", () => {
    if (L.ch || L.sol || armed) {
      if (!L.ch && !L.sol) { L.sol = true; save(); }
      ed.set(ch.solution); armed = false; solBtn.innerHTML = I.eye + "Solution";
      $('[data-slot="hint"]').innerHTML = '<div class="hint-box"><b>Solution chargée.</b> Lis-la ligne par ligne, puis clique sur Vérifier.' + (L.ch ? "" : " Le défi rapportera la moitié des XP.") + "</div>";
    } else {
      armed = true; solBtn.innerHTML = I.eye + "Confirmer (½ XP)";
      setTimeout(() => { if (armed) { armed = false; solBtn.innerHTML = I.eye + "Solution"; } }, 4000);
    }
  });
}

function verdictHTML(r, lang) {
  const head = r.ok ? '<div class="verdict-h">' + I.check + (lang === "cpp" && r.cases.length > 1 ? "Tous les tests passent (" + r.cases.length + "/" + r.cases.length + ")." : "Bravo, c'est exactement ça.") + "</div>"
    : '<div class="verdict-h">' + I.x + (r.err ? "Ton programme s'est arrêté sur une erreur." : "La sortie ne correspond pas encore.") + "</div>";
  if (r.ok) return '<div class="verdict ok">' + head + "</div>";
  let cases = "";
  if (lang === "cpp") {
    cases = r.cases.filter(c => !c.ok).slice(0, 2).map(c => '<div class="case"><div class="inp"><span class="h">Entrée</span><pre>' + esc(c.input || "(vide)") + '</pre></div><div><span class="h">Attendu</span><pre>' + esc(c.expected) + '</pre></div><div><span class="h">Obtenu</span><pre>' + esc(norm(c.got) || "(rien)") + "</pre></div></div>").join("");
    const passed = r.cases.filter(c => c.ok).length;
    if (!r.err) cases = '<span style="font-size:13.5px">' + passed + " test(s) sur " + r.cases.length + " réussi(s).</span>" + cases;
  } else if (!r.err || r.cases[0].got) {
    const c = r.cases[0];
    cases = '<div class="case"><div><span class="h">Attendu</span><pre>' + esc(c.expected) + '</pre></div><div><span class="h">Obtenu</span><pre>' + esc(norm(c.got) || "(rien)") + "</pre></div></div>";
  }
  return '<div class="verdict no">' + head + '<div class="cases">' + cases + "</div></div>";
}

function refreshSteps(x) {
  const st = lessonState(x.l); const s = $(".steps"); if (!s) return;
  const q = $('[data-jump="quiz"]', s), d = $('[data-jump="defi"]', s);
  if (st.quizDone) { q.className = "ok"; q.innerHTML = I.check + "Quiz"; const c = $("#quiz .block-h .chip"); if (c) { c.className = "chip ok"; c.innerHTML = I.check + "Réussi"; } }
  if (d && st.chDone) { d.className = "ok"; d.innerHTML = I.check + "Défi"; const c = $("#defi .block-h .chip"); if (c) { c.className = "chip ok"; c.innerHTML = I.check + "Réussi"; } }
  if (st.done) toast("Leçon terminée · " + x.l.title);
}

function pageRoadmaps() {
  return '<div class="crumbs"><a href="#home">Accueil</a><span>/</span><span>Roadmaps</span></div>' +
    '<section style="display:flex;flex-direction:column;gap:10px"><h1 style="font-size:clamp(30px,4vw,42px);font-weight:800">Roadmaps métier</h1><p class="lead">Trois parcours pour viser un poste : chaque étape liste les compétences, un mini-projet pour ton portfolio et des ressources officielles. Coche ce que tu maîtrises.</p></section>' +
    '<div class="grid3">' + ROADMAPS.map(r => { const p = rmProgress(r); const nodes = r.stages.reduce((a, s) => a + s.nodes.length, 0); return '<a class="card rm-card" href="#' + r.id + '" style="--c:' + color(r.id) + '"><span class="k">' + esc(r.kicker) + "</span><h3>" + r.name + "</h3><p>" + esc(r.intro) + '</p><div class="skills"><span class="chip">' + r.stages.length + " paliers</span><span class=\"chip\">" + nodes + " étapes</span><span class=\"chip\">" + r.certs.length + ' certifications</span></div><div class="bar"><i style="width:' + p.pct + '%"></i></div><div class="meta-row"><span>' + p.d + " / " + p.n + " acquises</span><span>" + p.pct + " %</span></div></a>"; }).join("") + "</div>";
}

function pageRoadmap(r) {
  const p = rmProgress(r);
  return '<div style="--c:' + color(r.id) + ';display:flex;flex-direction:column;gap:26px">' +
    '<div class="crumbs"><a href="#home">Accueil</a><span>/</span><a href="#roadmaps">Roadmaps</a><span>/</span><span>' + r.name + "</span></div>" +
    '<section class="card rm-hero"><span class="k">' + esc(r.kicker) + "</span><h1>Roadmap " + r.name + '</h1><p class="lead">' + esc(r.intro) + '</p><div class="prog"><div class="bar"><i id="rm-bar" style="width:' + p.pct + '%"></i></div><b id="rm-count">' + p.d + " / " + p.n + "</b></div></section>" +
    r.stages.map((s, si) => '<section class="stage"><div class="stage-h"><span class="no">' + String(si + 1).padStart(2, "0") + "</span><h2>" + esc(s.title) + "</h2><span>" + s.nodes.length + ' étapes</span></div><div class="nodes">' +
      s.nodes.map(n => {
        const on = !!S.roadmap[n.id];
        const lessons = (n.lessons || []).map(id => { const x = byId(id); return x ? '<a class="int" href="#' + id + '">Leçon : ' + esc(x.l.title) + "</a>" : ""; }).join("");
        return '<article class="card rnode' + (on ? " done" : "") + '" data-node="' + n.id + '"><div class="rnode-h"><h3>' + esc(n.title) + '</h3><label class="check"><input type="checkbox" id="chk-' + n.id + '"' + (on ? " checked" : "") + '><span class="bx">' + I.check + "</span>Acquis</label></div>" +
          "<p>" + esc(n.desc) + '</p><div class="skills">' + n.skills.map(k => '<span class="chip">' + esc(k) + "</span>").join("") + "</div>" +
          '<div class="project"><b>Mini-projet</b>' + esc(n.project) + "</div>" +
          '<div class="links">' + lessons + n.links.map(([t, u]) => '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(t) + "</a>").join("") + "</div></article>";
      }).join("") + "</div></section>").join("") +
    '<section class="rm-foot"><div class="card"><h3>Certifications utiles</h3><ul>' + r.certs.map(c => "<li>" + esc(c) + "</li>").join("") + '</ul><p style="font-size:13.5px">Les intitulés et codes d\'examen évoluent : vérifie la version en cours sur le site de l\'éditeur.</p></div>' +
      '<div class="card"><h3>Projet portfolio</h3><p>' + esc(r.portfolio) + "</p></div></section></div>";
}
function bindRoadmap(r) {
  $$("[data-node] input").forEach(inp => inp.addEventListener("change", () => {
    const art = inp.closest("[data-node]"); const id = art.dataset.node;
    if (inp.checked) { S.roadmap[id] = true; art.classList.add("done"); markDay(); toast("Étape acquise"); } else { delete S.roadmap[id]; art.classList.remove("done"); }
    save(); const p = rmProgress(r); $("#rm-bar").style.width = p.pct + "%"; $("#rm-count").textContent = p.d + " / " + p.n; updateStats();
  }));
}

function pageInstaller() {
  return '<div class="crumbs"><a href="#home">Accueil</a><span>/</span><span>Installer</span></div>' +
    '<section style="display:flex;flex-direction:column;gap:10px"><h1 style="font-size:clamp(30px,4vw,42px);font-weight:800">' + esc(INSTALL.title) + '</h1><p class="lead">' + inl(INSTALL.intro) + "</p></section>" +
    INSTALL.sections.map((sec, i) => '<section class="card block" id="' + sec.id + '"><div class="block-h"><span class="n">' + (i + 1) + "</span><h2>" + esc(sec.title) + '</h2></div><div class="prose">' + theoryHTML(sec.body, "bash", false) + "</div></section>").join("");
}

const STARTERS = {
  py: '# Bac à sable Python : écris, exécute, expérimente.\nnoms = ["Ada", "Linus", "Grace"]\nfor i, nom in enumerate(noms, start=1):\n    print(f"{i}. {nom} ({len(nom)} lettres)")\n',
  cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    int n;\n    cin >> n;\n    for (int i = 1; i <= n; i++) {\n        cout << i << " au carre = " << i * i << endl;\n    }\n    return 0;\n}\n'
};
function pageAtelier() {
  const A = S.atelier; const lang = A.lang; const code = A[lang] || STARTERS[lang];
  return '<div class="crumbs"><a href="#home">Accueil</a><span>/</span><span>Atelier</span></div>' +
    '<section class="sec-h" style="align-items:center"><div style="display:flex;flex-direction:column;gap:6px"><h1 style="font-size:clamp(28px,3.6vw,40px);font-weight:800">Atelier</h1><p class="lead">Un éditeur libre pour tester une idée ou t\'entraîner sur un exercice LeetCode. Ton code reste dans ce navigateur.</p></div>' +
    '<div class="seg" role="group" aria-label="Langage"><button type="button" data-lang="py" aria-pressed="' + (lang === "py") + '">Python</button><button type="button" data-lang="cpp" aria-pressed="' + (lang === "cpp") + '">C++</button></div></section>' +
    '<div class="ide" style="--c:' + color(lang) + '"><div class="ide-bar"><span class="file"><i></i>' + (lang === "py" ? "atelier.py" : "atelier.cpp") + '</span><button class="tb" type="button" data-act="reset">' + I.reset + "Exemple</button></div>" +
      editorHTML("ed-atelier", lang, code) +
      '<div class="stdin"><label for="atelier-stdin">Entrée (stdin)' + (lang === "py" ? " · lue par input()" : " · lue par cin") + '</label><textarea id="atelier-stdin" rows="2" spellcheck="false">' + esc(A.stdin || (lang === "cpp" ? "5" : "")) + "</textarea></div>" +
      '<div class="ide-actions"><button class="btn sm primary" type="button" data-act="run">' + I.play + 'Exécuter</button><span class="kbd">Ctrl + Entrée</span></div>' +
      '<div class="console" aria-live="polite"><span class="lbl">Console</span><span class="dim">La sortie s\'affiche ici.</span></div></div>' +
    (lang === "cpp" ? '<div class="note" style="--c:var(--cpp)">' + I.info + "<span>Interpréteur pédagogique : iostream, cstdio, types de base, boucles, fonctions, tableaux, pointeurs, récursion. Pour string, vector ou les classes, compile avec g++.</span></div>" : "");
}
function bindAtelier() {
  const A = S.atelier; const lang = A.lang; let tSave;
  if (lang === "py") preloadPy("");
  const ed = mountEditor($('[data-ed="ed-atelier"]'), v => { clearTimeout(tSave); tSave = setTimeout(() => { A[lang] = v; save(); }, 300); }, () => go());
  const sIn = $("#atelier-stdin"); sIn.addEventListener("input", () => { A.stdin = sIn.value; save(); });
  const btn = $('[data-act="run"]'), cons = $(".console");
  async function go() {
    const lbl = '<span class="lbl">Console</span>';
    btn.disabled = true; cons.innerHTML = lbl + statusHTML(firstLoad(lang));
    try { const r = await run(lang, ed.get(), sIn.value, t => { cons.innerHTML = lbl + statusHTML(t); }); cons.innerHTML = lbl + consoleHTML(r, lang); }
    catch (e) { cons.innerHTML = lbl + loadFailHTML(lang, e); }
    btn.disabled = false;
  }
  btn.addEventListener("click", go);
  $('[data-act="reset"]').addEventListener("click", () => { ed.set(STARTERS[lang]); });
  $$(".seg button").forEach(b => b.addEventListener("click", () => { if (b.dataset.lang !== A.lang) { A[A.lang] = ed.get(); A.lang = b.dataset.lang; save(); render(); } }));
}

/* ===================== Routeur ===================== */
function render() {
  const route = (location.hash || "#home").slice(1) || "home";
  const el = app(); let bind = null;
  const course = COURSES.find(c => c.route === route);
  if (course) { el.innerHTML = pageCourse(course); }
  else if (route === "installer") { el.innerHTML = pageInstaller(); bind = () => bindSnippets(app()); }
  else if (route === "roadmaps") el.innerHTML = pageRoadmaps();
  else if (route === "atelier") { el.innerHTML = pageAtelier(); bind = bindAtelier; }
  else if (ROADMAPS.some(r => r.id === route)) { const r = ROADMAPS.find(r => r.id === route); el.innerHTML = pageRoadmap(r); bind = () => bindRoadmap(r); }
  else if (byId(route)) { const x = byId(route); el.innerHTML = pageLesson(x); bind = () => bindLesson(x); }
  else el.innerHTML = pageHome();
  el.insertAdjacentHTML("beforeend", '<p class="foot">Ta progression est enregistrée dans ce navigateur. <button type="button" id="wipe">Réinitialiser la progression</button></p>');
  setNav(route); updateStats(); if (bind) bind();
  const w = $("#wipe"); let armed = false;
  w.addEventListener("click", () => {
    if (!armed) { armed = true; w.textContent = "Confirmer : tout effacer ?"; setTimeout(() => { armed = false; w.textContent = "Réinitialiser la progression"; }, 4000); return; }
    resetAll(); render(); toast("Progression remise à zéro", I.bolt);
  });
}
window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });
render();

