/* Projets capstone : liste par roadmap, page d'un projet (cahier des charges, jalons cochables, critères de réussite). */
import { esc, $$, inl } from "./util.js";

const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
/** Jalons atteints d'un projet, dans l'état de l'élève. */
export function projetProgress(S, p) {
  const fait = (S.projets = S.projets || {});
  const d = p.jalons.filter((j) => fait[p.id + "/" + j.id]).length;
  return { d, n: p.jalons.length, pct: pct(d, p.jalons.length) };
}

function carte(S, p, color) {
  const g = projetProgress(S, p);
  return '<a class="card rm-card" href="#' + p.id + '" style="--c:' + color(p.roadmap) + '"><span class="k">' + esc(p.niveau) + " · " + esc(p.duree) + "</span><h3>" + esc(p.titre) + "</h3><p>" + esc(p.resume) + '</p><div class="skills">' + p.technos.slice(0, 5).map((t) => '<span class="chip">' + esc(t) + "</span>").join("") + '</div><div class="bar"><i style="width:' + g.pct + '%"></i></div><div class="meta-row"><span>' + g.d + " / " + g.n + " jalons</span><span>" + g.pct + " %</span></div></a>";
}

/** Cartes des projets d'une roadmap (affichées en bas de la page de la roadmap). */
export function projetsDeRoadmap(S, PROJETS, roadmapId, color) {
  const liste = PROJETS.filter((p) => p.roadmap === roadmapId);
  if (!liste.length) return "";
  return '<section style="display:flex;flex-direction:column;gap:14px"><h2 style="font-size:24px;font-weight:800">Projets capstone</h2><p class="lead" style="font-size:15px">Des projets de niveau portfolio, avec cahier des charges, jalons et critères de réussite : ce qu\'un recruteur peut ouvrir et juger.</p><div class="grid3">' + liste.map((p) => carte(S, p, color)).join("") + "</div></section>";
}

export function pageProjets(S, PROJETS, ROADMAPS, color) {
  return '<div class="crumbs"><a href="#home">Accueil</a><span>/</span><span>Projets</span></div>' +
    '<section style="display:flex;flex-direction:column;gap:10px"><span class="eyebrow">Portfolio</span><h1 style="font-size:clamp(30px,4vw,42px);font-weight:800">Projets capstone</h1><p class="lead">Des projets complets, pensés pour un portfolio : un cahier des charges, une architecture cible, des jalons à cocher et des critères de réussite mesurables. Chacun réutilise ce que tu as appris dans les cours.</p></section>' +
    ROADMAPS.filter((r) => PROJETS.some((p) => p.roadmap === r.id)).map((r) =>
      '<section style="display:flex;flex-direction:column;gap:14px"><h2 style="font-size:22px;font-weight:800"><a href="#' + r.id + '">Roadmap ' + esc(r.name) + "</a></h2>" +
      '<div class="grid3">' + PROJETS.filter((p) => p.roadmap === r.id).map((p) => carte(S, p, color)).join("") + "</div></section>").join("");
}

export function pageProjet(S, p, ROADMAPS, byId, color, I) {
  const r = ROADMAPS.find((x) => x.id === p.roadmap); const g = projetProgress(S, p);
  const lecons = p.lecons.map((id) => { const x = byId(id); return x ? '<a class="int" href="#' + id + '">' + esc(x.l.title) + "</a>" : ""; }).join("");
  return '<div style="--c:' + color(p.roadmap) + ';display:flex;flex-direction:column;gap:22px">' +
    '<div class="crumbs"><a href="#home">Accueil</a><span>/</span><a href="#projets">Projets</a><span>/</span><span>' + esc(p.titre) + "</span></div>" +
    '<section class="card rm-hero"><span class="k">Roadmap ' + esc(r.name) + " · " + esc(p.niveau) + " · " + esc(p.duree) + "</span><h1>" + esc(p.titre) + '</h1><p class="lead">' + esc(p.resume) + '</p><div class="skills">' + p.technos.map((t) => '<span class="chip">' + esc(t) + "</span>").join("") + '</div><div class="prog"><div class="bar"><i id="pj-bar" style="width:' + g.pct + '%"></i></div><b id="pj-count">' + g.d + " / " + g.n + "</b></div></section>" +
    '<section class="card block"><div class="block-h"><span class="n">1</span><h2>Contexte et cahier des charges</h2></div><div class="prose">' + inl(p.contexte) + "<h3>Exigences</h3><ul>" + p.exigences.map((e) => "<li>" + inl(e) + "</li>").join("") + "</ul></div></section>" +
    '<section class="card block"><div class="block-h"><span class="n">2</span><h2>Architecture cible</h2></div><pre class="out">' + esc(p.architecture) + "</pre></section>" +
    '<section class="card block"><div class="block-h"><span class="n">3</span><h2>Jalons</h2></div><p>Coche un jalon quand tous ses livrables sont dans ton dépôt et que la CI est verte.</p><div class="nodes">' +
    p.jalons.map((j, k) => { const on = !!S.projets[p.id + "/" + j.id]; return '<article class="card rnode' + (on ? " done" : "") + '" data-jalon="' + j.id + '"><div class="rnode-h"><h3>' + (k + 1) + ". " + esc(j.titre) + '</h3><label class="check"><input type="checkbox"' + (on ? " checked" : "") + '><span class="bx">' + I.check + "</span>Atteint</label></div><ul>" + j.livrables.map((l) => "<li>" + inl(l) + "</li>").join("") + "</ul></article>"; }).join("") +
    "</div></section>" +
    '<section class="card block"><div class="block-h"><span class="n">4</span><h2>Critères de réussite</h2></div><ul class="prose">' + p.criteres.map((c) => "<li>" + inl(c) + "</li>").join("") + "</ul></section>" +
    '<section class="card block"><div class="block-h"><span class="n">5</span><h2>Pour aller plus loin</h2></div><div class="prose"><ul>' + p.extensions.map((e) => "<li>" + inl(e) + "</li>").join("") + '</ul><h3>À revoir dans les cours</h3></div><div class="links">' + lecons + p.liens.map(([t, u]) => '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(t) + "</a>").join("") + "</div></section></div>";
}

export function bindProjet(S, p, { save, toast, markDay, updateStats }) {
  $$("[data-jalon] input").forEach((inp) => inp.addEventListener("change", () => {
    const art = inp.closest("[data-jalon]"); const cle = p.id + "/" + art.dataset.jalon;
    if (inp.checked) { S.projets[cle] = true; art.classList.add("done"); markDay(); toast("Jalon atteint"); } else { delete S.projets[cle]; art.classList.remove("done"); }
    save(); const g = projetProgress(S, p);
    document.getElementById("pj-bar").style.width = g.pct + "%"; document.getElementById("pj-count").textContent = g.d + " / " + g.n; updateStats();
  }));
}
