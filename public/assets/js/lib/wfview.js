/* Affichage des workflows GitHub Actions : problèmes, graphe du pipeline et étapes. */
import { esc } from "./util.js";
import { analyze, normOn } from "./workflow.js";

const ICON = { success: "✓", failure: "✗", skipped: "–", off: "·" };
const FR = { success: "réussi", failure: "échoué", skipped: "sauté", off: "non déclenché" };

/** Événements à simuler par défaut, déduits de « on: ». */
export function defaultEvents(doc) {
  const on = doc && typeof doc === "object" ? normOn(doc.on) : {};
  const evs = [];
  if ("pull_request" in on) evs.push({ name: "pull_request", head: "feature/recherche", base: "main" });
  if ("push" in on) {
    evs.push({ name: "push", branch: "main" });
    const cfg = on.push && typeof on.push === "object" ? on.push : {};
    evs.push({ name: "push", branch: "feature/recherche" });
    if (cfg.tags) evs.push({ name: "push", tag: "v1.0.0" });
  }
  for (const n of ["workflow_dispatch", "schedule", "release"]) if (n in on) evs.push({ name: n });
  return evs.length ? evs : [{ name: "push", branch: "main" }];
}

export function issuesHTML(issues) {
  if (!issues.length) return '<div class="wf-ok">✓ Aucune erreur de structure.</div>';
  return '<ul class="wf-issues">' + issues.map((i) => '<li class="' + i.level + '"><span class="ln">ligne ' + i.line + "</span><span>" + (i.level === "warn" ? "Attention : " : "") + esc(i.msg) + "</span></li>").join("") + "</ul>";
}

/** Graphe des jobs : une colonne par niveau de dépendance, une flèche par « needs ». */
export function pipelineSVG(p) {
  const W = 168, H = 46, GX = 54, GY = 16, PAD = 10;
  const cols = {};
  p.jobs.forEach((j) => { (cols[j.stage] = cols[j.stage] || []).push(j); });
  const pos = {}; let maxRows = 0;
  Object.keys(cols).sort((a, b) => a - b).forEach((s) => { cols[s].forEach((j, r) => { pos[j.id] = { x: PAD + s * (W + GX), y: PAD + r * (H + GY) }; }); maxRows = Math.max(maxRows, cols[s].length); });
  const nCols = Object.keys(cols).length;
  const width = PAD * 2 + nCols * W + (nCols - 1) * GX, height = PAD * 2 + maxRows * H + (maxRows - 1) * GY;
  let edges = "", nodes = "";
  for (const j of p.jobs) for (const n of j.needs) {
    const a = pos[n], b = pos[j.id]; if (!a || !b) continue;
    const x1 = a.x + W, y1 = a.y + H / 2, x2 = b.x, y2 = b.y + H / 2, mx = (x1 + x2) / 2;
    edges += '<path class="wf-edge ' + j.status + '" d="M' + x1 + " " + y1 + " C" + mx + " " + y1 + " " + mx + " " + y2 + " " + (x2 - 6) + " " + y2 + '" marker-end="url(#wf-arrow)"/>';
  }
  for (const j of p.jobs) {
    const { x, y } = pos[j.id];
    const label = j.name.length > 19 ? j.name.slice(0, 18) + "…" : j.name;
    nodes += '<g class="wf-job ' + j.status + '"><title>' + esc(j.name + " : " + FR[j.status] + (j.why ? " (" + j.why + ")" : "")) + "</title>" +
      '<rect x="' + x + '" y="' + y + '" width="' + W + '" height="' + H + '" rx="9"/>' +
      '<text class="ic" x="' + (x + 14) + '" y="' + (y + 28) + '">' + ICON[j.status] + "</text>" +
      '<text class="nm" x="' + (x + 30) + '" y="' + (y + 20) + '">' + esc(label) + "</text>" +
      '<text class="st" x="' + (x + 30) + '" y="' + (y + 36) + '">' + FR[j.status] + (j.matrix > 1 && j.status !== "off" ? " · ×" + j.matrix : "") + "</text></g>";
  }
  return '<svg class="wf-graph" viewBox="0 0 ' + width + " " + height + '" width="' + width + '" height="' + height + '" role="img" aria-label="Graphe des jobs"><defs><marker id="wf-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 8 4 0 8z"/></marker></defs>' + edges + nodes + "</svg>";
}

export function planHTML(p) {
  const head = p.triggered ? "" : '<p class="wf-why">Le workflow ne démarre pas : ' + esc(p.why) + ".</p>";
  const skipped = p.jobs.filter((j) => j.status === "skipped" && j.why).map((j) => "<li><b>" + esc(j.id) + "</b> sauté : " + esc(j.why) + "</li>").join("");
  const steps = p.jobs.filter((j) => j.steps.length).map((j) => '<div class="wf-steps"><b>' + esc(j.name) + "</b><ol>" +
    j.steps.map((s) => '<li class="' + (s.failed ? "failure" : s.ran ? "success" : "skipped") + '"><span>' + (s.failed ? "✗" : s.ran ? "✓" : "–") + "</span>" + esc(s.label) + "</li>").join("") + "</ol></div>").join("");
  return head + '<div class="wf-graph-wrap">' + pipelineSVG(p) + "</div>" + (skipped ? '<ul class="wf-skip">' + skipped + "</ul>" : "") + (steps ? '<div class="wf-steps-grid">' + steps + "</div>" : "");
}

/**
 * Rapport complet : problèmes, onglets d'événements, graphe. `sel` = index de l'événement affiché.
 * `events` absent : déduits du workflow.
 */
export function reportHTML(text, events, sel = 0) {
  const first = analyze(text, []);
  const evs = events && events.length ? events : defaultEvents(first.doc);
  const a = analyze(text, evs);
  let h = issuesHTML(a.issues);
  if (a.plans.length) {
    const i = Math.min(sel, a.plans.length - 1);
    h += '<div class="wf-sim"><div class="wf-tabs" role="tablist" aria-label="Simuler un événement">' +
      a.plans.map((p, k) => '<button type="button" role="tab" data-ev="' + k + '" aria-selected="' + (k === i) + '">' + esc(p.label) + "</button>").join("") + "</div>" + planHTML(a.plans[i]) + "</div>";
  }
  return h;
}
