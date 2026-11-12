/* Pages des certifications : liste, page d'une certification, entraînement par domaine, examen blanc chronométré. */
import { esc, $, $$, inl } from "./util.js";
import { buildExam, grade, isMulti, isRight, answers } from "./exam.js";

const L = "ABCDEFGH";
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
const mmss = (s) => String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
/** Progression d'une certification dans l'état de l'élève (créée à la demande). */
export const cs = (S, id) => ((S.certs = S.certs || {})[id] = S.certs[id] || { seen: {}, exams: [], current: null });

export function certProgress(S, cert) { const st = (S.certs || {})[cert.id]; const n = cert.bank.length; const d = st ? cert.bank.filter((q) => st.seen[q.id]).length : 0; return { d, n, pct: pct(d, n), best: st && st.exams.length ? Math.max(...st.exams.map((e) => e.score)) : null }; }

export function pageCerts(S, CERTS, color) {
  return '<section style="display:flex;flex-direction:column;gap:10px"><span class="eyebrow">Préparation</span><h1 style="font-size:clamp(30px,4vw,42px);font-weight:800">Certifications</h1><p class="lead">Des banques de questions originales, écrites dans le style des examens, classées par domaine officiel. Entraîne-toi domaine par domaine, puis passe des examens blancs chronométrés dans les conditions réelles.</p></section>' +
    '<div class="grid3">' + CERTS.map((c) => { const p = certProgress(S, c); return '<a class="card rm-card" href="#cert-' + c.id + '" style="--c:' + color(c.id) + '"><span class="k">' + esc(c.code) + "</span><h3>" + esc(c.name) + "</h3><p>" + esc(c.intro) + '</p><div class="skills"><span class="chip">' + c.bank.length + ' questions</span><span class="chip">' + c.domains.length + ' domaines</span><span class="chip">' + c.minutes + ' min</span></div><div class="bar"><i style="width:' + p.pct + '%"></i></div><div class="meta-row"><span>' + p.d + " / " + p.n + " réussies à l'entraînement</span><span>" + (p.best != null ? "meilleur examen : " + p.best : "aucun examen") + "</span></div></a>"; }).join("") + "</div>";
}

export function pageCert(S, cert) {
  const st = cs(S, cert.id); const short = Math.min(20, cert.bank.length); const shortMin = Math.max(5, Math.round((cert.minutes * short) / cert.count));
  const dom = cert.domains.map((d) => { const qs = cert.bank.filter((q) => q.d === d.id); const ok = qs.filter((q) => st.seen[q.id]).length; return '<div class="cert-dom"><div><b>' + esc(d.name) + '</b><span class="mono">' + d.weight + " % de l'examen · " + ok + " / " + qs.length + ' réussies</span><div class="bar"><i style="width:' + pct(ok, qs.length) + '%"></i></div></div><button class="btn sm" type="button" data-practice="' + d.id + '">S\'entraîner</button></div>'; }).join("");
  const hist = st.exams.slice(-6).reverse().map((e) => '<li><span>' + esc(e.date) + " · " + e.total + " questions</span><b class=\"" + (e.pass ? "ok" : "no") + '">' + e.score + " · " + (e.pass ? "réussi" : "échoué") + "</b></li>").join("");
  return '<div class="crumbs"><a href="#home">Accueil</a><span>/</span><a href="#certifs">Certifications</a><span>/</span><span>' + esc(cert.code) + "</span></div>" +
    '<section style="display:flex;flex-direction:column;gap:10px"><span class="eyebrow">' + esc(cert.code) + '</span><h1 style="font-size:clamp(28px,4vw,40px);font-weight:800">' + esc(cert.name) + '</h1><p class="lead">' + inl(cert.about) + '</p><div class="skills"><span class="chip">' + cert.count + ' questions</span><span class="chip">' + cert.minutes + ' minutes</span><span class="chip">score minimal ' + cert.passing + ' / 1000</span><span class="chip">' + esc(cert.price) + "</span></div></section>" +
    '<div id="cert-zone">' +
    (st.current ? '<section class="card block"><div class="block-h"><span class="n">!</span><h2>Examen en cours</h2></div><p>Un examen blanc de ' + st.current.items.length + ' questions n\'est pas terminé.</p><div class="row"><button class="btn primary" type="button" data-resume>Reprendre</button><button class="btn ghost" type="button" data-abandon>Abandonner</button></div></section>' : "") +
    '<section class="card block"><div class="block-h"><span class="n">1</span><h2>Examens blancs</h2></div><p>Le tirage respecte le poids officiel de chaque domaine. Pas de correction avant la fin, comme le jour de l\'examen ; ensuite, le détail par domaine et l\'explication de chaque erreur.</p><div class="row"><button class="btn primary" type="button" data-exam="' + cert.count + '" data-min="' + cert.minutes + '">Examen complet · ' + cert.count + " questions · " + cert.minutes + ' min</button><button class="btn" type="button" data-exam="' + short + '" data-min="' + shortMin + '">Examen court · ' + short + " questions · " + shortMin + " min</button></div>" + (hist ? '<ul class="cert-hist">' + hist + "</ul>" : "") + "</section>" +
    '<section class="card block"><div class="block-h"><span class="n">2</span><h2>Entraînement par domaine</h2></div><p>Correction immédiate et explication après chaque question.</p>' + dom + "</section>" +
    '<section class="card block"><div class="block-h"><span class="n">3</span><h2>Conseils</h2></div><div class="prose">' + inl(cert.tips) + "</div></section></div>";
}

/** Options d'une question, dans l'ordre du tirage ; data-oi garde l'indice d'origine. */
function optsHTML(q, order, chosen, reveal) {
  const multi = isMulti(q); const ch = new Set([].concat(chosen ?? [])); const good = new Set(answers(q));
  return '<div class="opts one" role="' + (multi ? "group" : "radiogroup") + '">' + order.map((oi, k) => {
    const cls = reveal ? (good.has(oi) ? " right" : ch.has(oi) ? " wrong" : "") + (ch.has(oi) ? " mine" : "") : ch.has(oi) ? " picked" : "";
    return '<button type="button" class="opt txt' + cls + '" data-oi="' + oi + '" role="' + (multi ? "checkbox" : "radio") + '" aria-checked="' + ch.has(oi) + '"' + (reveal ? " disabled" : "") + '><span class="l">' + L[k] + "</span><span>" + esc(q.options[oi]) + "</span></button>";
  }).join("") + "</div>";
}

export function bindCert(S, cert, { save, gain, today, rerender }) {
  const zone = () => $("#cert-zone"); const st = cs(S, cert.id);
  const byId = Object.fromEntries(cert.bank.map((q) => [q.id, q]));
  let timer = null;
  const stop = () => { if (timer) clearInterval(timer); timer = null; };
  window.addEventListener("hashchange", stop, { once: true });

  $$("[data-practice]").forEach((b) => b.addEventListener("click", () => practice(b.dataset.practice)));
  $$("[data-exam]").forEach((b) => b.addEventListener("click", () => { st.current = { ...buildExam(cert, { n: +b.dataset.exam }), answers: {}, flags: {}, i: 0, end: Date.now() + +b.dataset.min * 60000 }; save(); exam(); }));
  const r = $("[data-resume]"); if (r) r.addEventListener("click", exam);
  const a = $("[data-abandon]"); if (a) a.addEventListener("click", () => { st.current = null; save(); rerender(); });

  /* ----- entraînement : une question à la fois, correction immédiate ----- */
  function practice(domain) {
    const d = cert.domains.find((x) => x.id === domain); const ex = buildExam(cert, { domain }); let i = 0, right = 0;
    const show = () => {
      if (i >= ex.items.length) { zone().innerHTML = '<section class="card block"><div class="block-h"><span class="n">✓</span><h2>' + esc(d.name) + "</h2></div><p>" + right + " bonnes réponses sur " + ex.items.length + ' (' + pct(right, ex.items.length) + ' %).</p><div class="row"><a class="btn primary" href="#cert-' + cert.id + '" data-back>Retour</a></div></section>'; $("[data-back]").addEventListener("click", (e) => { e.preventDefault(); rerender(); }); return; }
      const it = ex.items[i]; const q = byId[it.id]; let chosen = [];
      zone().innerHTML = '<section class="card block exam"><div class="exam-bar"><span>' + esc(d.name) + '</span><span class="mono">Question ' + (i + 1) + " / " + ex.items.length + " · " + right + ' juste' + (right > 1 ? "s" : "") + '</span></div><p class="quiz-q">' + inl(esc(q.q)) + "</p>" + optsHTML(q, it.order, [], false) + '<div data-slot="fb"></div><div class="row"><button class="btn primary" type="button" data-valid' + (isMulti(q) ? "" : " hidden") + ">Valider</button><a class=\"btn ghost\" href=\"#cert-" + cert.id + '" data-quit>Arrêter</a></div></section>';
      $("[data-quit]").addEventListener("click", (e) => { e.preventDefault(); rerender(); });
      const reveal = () => {
        const ok = isRight(q, chosen); if (ok) { right++; if (!st.seen[q.id]) { st.seen[q.id] = true; gain(2, "bonne réponse"); } } else save();
        $(".opts", zone()).outerHTML = optsHTML(q, it.order, chosen, true);
        $("[data-slot=fb]").innerHTML = '<p class="explain' + (ok ? "" : " no") + '"><b>' + (ok ? "Exact." : "Non.") + "</b> " + esc(q.explain) + '</p><div class="row"><button class="btn primary" type="button" data-next>' + (i + 1 < ex.items.length ? "Question suivante" : "Voir le bilan") + "</button></div>";
        $("[data-valid]").hidden = true; $("[data-next]").addEventListener("click", () => { i++; show(); }); $("[data-next]").focus();
      };
      $$(".opt", zone()).forEach((b) => b.addEventListener("click", () => {
        const oi = +b.dataset.oi;
        if (!isMulti(q)) { chosen = [oi]; reveal(); return; }
        chosen = chosen.includes(oi) ? chosen.filter((x) => x !== oi) : [...chosen, oi];
        b.classList.toggle("picked"); b.setAttribute("aria-checked", chosen.includes(oi));
      }));
      const v = $("[data-valid]"); v.addEventListener("click", () => { if (chosen.length === answers(q).length) reveal(); else $("[data-slot=fb]").innerHTML = '<p class="explain no"><b>Attention.</b> Choisis exactement ' + answers(q).length + " réponses.</p>"; });
    };
    show(); zone().scrollIntoView({ block: "start" });
  }

  /* ----- examen blanc : chronométré, sans correction avant la fin ----- */
  function exam() {
    const cur = st.current;
    const draw = () => {
      const it = cur.items[cur.i]; const q = byId[it.id]; const left = Math.max(0, Math.round((cur.end - Date.now()) / 1000));
      const answered = Object.keys(cur.answers).filter((k) => [].concat(cur.answers[k]).length).length;
      zone().innerHTML = '<section class="card block exam"><div class="exam-bar"><span class="mono">Question ' + (cur.i + 1) + " / " + cur.items.length + '</span><span class="timer mono" data-timer>' + mmss(left) + '</span></div><p class="quiz-q">' + inl(esc(q.q)) + "</p>" + optsHTML(q, it.order, cur.answers[it.id], false) +
        '<div class="row"><button class="btn" type="button" data-prev' + (cur.i ? "" : " disabled") + '>Précédente</button><button class="btn" type="button" data-next' + (cur.i + 1 < cur.items.length ? "" : " disabled") + '>Suivante</button><button class="btn ghost" type="button" data-flag aria-pressed="' + !!cur.flags[it.id] + '">' + (cur.flags[it.id] ? "Retirer la marque" : "Marquer pour revoir") + "</button></div>" +
        '<div class="exam-grid" aria-label="Questions">' + cur.items.map((x, k) => '<button type="button" class="cell' + ([].concat(cur.answers[x.id] ?? []).length ? " done" : "") + (cur.flags[x.id] ? " flag" : "") + (k === cur.i ? " now" : "") + '" data-go="' + k + '">' + (k + 1) + "</button>").join("") + "</div>" +
        '<div class="row end"><span class="mono">' + answered + " / " + cur.items.length + " répondues · " + Object.values(cur.flags).filter(Boolean).length + ' marquées</span><button class="btn primary" type="button" data-finish>Terminer l\'examen</button></div><div data-slot="confirm"></div></section>';
      $$(".opt", zone()).forEach((b) => b.addEventListener("click", () => {
        const oi = +b.dataset.oi; const prev = [].concat(cur.answers[it.id] ?? []);
        cur.answers[it.id] = isMulti(q) ? (prev.includes(oi) ? prev.filter((x) => x !== oi) : [...prev, oi]) : oi; save(); draw();
      }));
      $("[data-prev]").addEventListener("click", () => { cur.i--; save(); draw(); });
      $("[data-next]").addEventListener("click", () => { cur.i++; save(); draw(); });
      $("[data-flag]").addEventListener("click", () => { cur.flags[it.id] = !cur.flags[it.id]; save(); draw(); });
      $$("[data-go]").forEach((b) => b.addEventListener("click", () => { cur.i = +b.dataset.go; save(); draw(); }));
      $("[data-finish]").addEventListener("click", () => {
        const miss = cur.items.length - answered;
        $("[data-slot=confirm]").innerHTML = '<div class="hint-box">' + (miss ? "<b>" + miss + " question" + (miss > 1 ? "s" : "") + " sans réponse.</b> Une question sans réponse compte comme fausse. " : "") + 'Terminer et voir le résultat ?<div class="row"><button class="btn primary" type="button" data-yes>Oui, terminer</button><button class="btn ghost" type="button" data-no>Continuer</button></div></div>';
        $("[data-yes]").addEventListener("click", finish); $("[data-no]").addEventListener("click", () => { $("[data-slot=confirm]").innerHTML = ""; });
      });
    };
    stop(); timer = setInterval(() => { const left = Math.round((cur.end - Date.now()) / 1000); const t = $("[data-timer]"); if (left <= 0) { finish(); return; } if (t) { t.textContent = mmss(left); t.classList.toggle("low", left < 300); } }, 1000);
    draw(); zone().scrollIntoView({ block: "start" });
  }
  function finish() {
    stop(); const cur = st.current; if (!cur) return;
    const g = grade(cert, cur, cur.answers);
    st.exams.push({ date: today(), total: g.total, score: g.score, pass: g.pass, byDomain: g.byDomain.map((d) => [d.id, d.right, d.total]) }); st.exams = st.exams.slice(-30);
    for (const it of cur.items) if (isRight(byId[it.id], cur.answers[it.id])) st.seen[it.id] = true;
    st.current = null; gain(g.total >= cert.count ? (g.pass ? 60 : 25) : g.pass ? 20 : 8, "examen blanc terminé");
    zone().innerHTML = '<section class="card block exam-res"><div class="block-h"><span class="n">' + (g.pass ? "✓" : "✗") + '</span><h2>' + (g.pass ? "Réussi" : "Pas encore") + " : " + g.score + ' / 1000</h2></div><p>' + g.right + " bonnes réponses sur " + g.total + ". Score minimal : " + cert.passing + ". AWS ne publie pas sa mise à l'échelle : ce score est une estimation linéaire.</p>" +
      g.byDomain.map((d) => '<div class="cert-dom"><div><b>' + esc(d.name) + '</b><span class="mono">' + d.right + " / " + d.total + " · " + pct(d.right, d.total) + ' %</span><div class="bar"><i style="width:' + pct(d.right, d.total) + '%;--c:var(' + (pct(d.right, d.total) >= 70 ? "--ok" : "--bad") + ')"></i></div></div></div>').join("") +
      (g.wrong.length ? "<h3>À revoir</h3>" + g.wrong.map((id) => { const q = byId[id]; const it = cur.items.find((x) => x.id === id); const mine = cur.answers[id]; return '<div class="quiz"><p class="quiz-q">' + inl(esc(q.q)) + "</p>" + optsHTML(q, it.order, mine, true) + '<p class="explain no"><b>' + ([].concat(mine ?? []).length ? "Ta réponse était fausse." : "Sans réponse.") + "</b> " + esc(q.explain) + "</p></div>"; }).join("") : "<p>Aucune erreur.</p>") +
      '<div class="row"><a class="btn primary" href="#cert-' + cert.id + '" data-back>Retour à la certification</a></div></section>';
    $("[data-back]").addEventListener("click", (e) => { e.preventDefault(); rerender(); });
    zone().scrollIntoView({ block: "start" });
  }
}
