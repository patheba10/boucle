/* Révision espacée : calendrier J+1, J+3, J+7, sortie après trois réussites, retour au début après une erreur. */
import test from "node:test";
import assert from "node:assert/strict";
import { plusJours, rater, reussir, aReviser, prochaine, cle, decoder } from "../../public/assets/js/lib/revision.js";

test("dates : passage de mois, d'année et de l'heure d'été", () => {
  assert.equal(plusJours("2026-11-12", 1), "2026-11-13");
  assert.equal(plusJours("2026-11-30", 1), "2026-12-01");
  assert.equal(plusJours("2026-12-29", 7), "2027-01-05");
  assert.equal(plusJours("2027-03-13", 1), "2027-03-14");
  assert.equal(plusJours("2028-02-28", 1), "2028-02-29");
});

test("calendrier : J+1, J+3, J+7 puis sortie ; une erreur recommence", () => {
  const rev = {};
  const k = cle("sql-04", 1);
  rater(rev, k, "2026-11-12");
  assert.deepEqual(aReviser(rev, "2026-11-12"), []);
  assert.equal(prochaine(rev, "2026-11-12"), "2026-11-13");
  assert.deepEqual(aReviser(rev, "2026-11-13"), [k]);
  assert.equal(reussir(rev, k, "2026-11-13").due, "2026-11-16");
  assert.deepEqual(aReviser(rev, "2026-11-15"), []);
  rater(rev, k, "2026-11-16");
  assert.equal(rev[k].due, "2026-11-17");
  reussir(rev, k, "2026-11-17");
  assert.equal(reussir(rev, k, "2026-11-20").due, "2026-11-27");
  assert.equal(reussir(rev, k, "2026-11-27"), null);
  assert.deepEqual(rev, {});
  assert.equal(prochaine(rev, "2026-11-27"), null);
});

test("ordre : les plus en retard d'abord ; les clés se décodent", () => {
  const rev = { "a/0": { serie: 0, due: "2026-11-10" }, "b/2": { serie: 1, due: "2026-11-08" }, "c/1": { serie: 0, due: "2026-11-20" } };
  assert.deepEqual(aReviser(rev, "2026-11-12"), ["b/2", "a/0"]);
  assert.deepEqual(decoder("dl-17/1"), { lessonId: "dl-17", qi: 1 });
  assert.equal(reussir(rev, "inconnue", "2026-11-12"), null);
});
