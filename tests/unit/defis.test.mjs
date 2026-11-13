/* Défis gradués : ordre des onglets, progression par niveau, XP. */
import test from "node:test";
import assert from "node:assert/strict";
import { defisDe, defiFait, solutionVue, cleCode, xpDefi, marquerFait, marquerSolution, ongletsHTML } from "../../public/assets/js/lib/defis.js";

const l = { id: "al-10", xp: 100, challenge: { prompt: "p" }, defis: [{ niveau: "entretien" }, { niveau: "facile" }] };

test("ordre : défi principal, puis du plus facile au plus difficile", () => {
  assert.deepEqual(defisDe(l).map((d) => d.niveau || "principal"), ["principal", "facile", "entretien"]);
  assert.deepEqual(defisDe({ id: "x", theoryOnly: true }), []);
  assert.equal(defisDe({ challenge: {} }).length, 1);
});

test("progression : le principal garde L.ch et L.sol, les autres sont rangés par niveau", () => {
  const L = { quiz: {}, ch: false, sol: false };
  const [p, f, e] = defisDe(l);
  assert.ok(marquerFait(L, f));
  assert.ok(!marquerFait(L, f));
  assert.deepEqual(L.defis, { facile: true });
  assert.ok(!defiFait(L, p) && defiFait(L, f) && !defiFait(L, e));
  marquerSolution(L, e);
  assert.ok(solutionVue(L, e) && !solutionVue(L, p));
  assert.ok(marquerFait(L, p));
  assert.equal(L.ch, true);
  assert.equal(cleCode(l, p), "al-10");
  assert.equal(cleCode(l, e), "al-10~entretien");
});

test("XP : 60 % de la leçon pour le principal, barème par niveau sinon, moitié avec la solution", () => {
  const [p, f, e] = defisDe(l);
  assert.equal(xpDefi(l, p, false), 60);
  assert.equal(xpDefi(l, p, true), 30);
  assert.equal(xpDefi(l, f, false), 10);
  assert.equal(xpDefi(l, e, true), 15);
});

test("onglets : absents sans défi supplémentaire, coche sur les défis réussis", () => {
  assert.equal(ongletsHTML([l.challenge], {}, 0, "✓"), "");
  const html = ongletsHTML(defisDe(l), { defis: { entretien: true } }, 1, "✓");
  assert.match(html, /data-defi="1" aria-selected="true">Facile/);
  assert.match(html, /class="onglet fait" data-defi="2" aria-selected="false">✓Entretien/);
});
