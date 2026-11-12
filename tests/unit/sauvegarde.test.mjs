/* Sauvegarde de la progression : aller-retour exact, et refus clair des fichiers invalides. */
import test from "node:test";
import assert from "node:assert/strict";
import { exporter, importer, nomFichier } from "../../public/assets/js/lib/sauvegarde.js";

const ETAT = { xp: 420, lessons: { "py-01": { quiz: { 0: true }, ch: true, sol: false } }, roadmap: { "do-git": true }, projets: {}, revision: { "sql-04/1": { serie: 1, due: "2026-11-16" } }, days: ["2026-11-11", "2026-11-12"], code: {}, last: "py-01", atelier: { lang: "py", py: "", cpp: "", stdin: "" } };

test("aller-retour : l'état importé est identique à l'état exporté", () => {
  const r = importer(exporter(ETAT, "2026-11-12T20:00:00Z"));
  assert.equal(r.ok, true);
  assert.deepEqual(r.etat, ETAT);
  assert.equal(r.date, "2026-11-12T20:00:00Z");
  assert.equal(nomFichier("2026-11-12"), "boucle-progression-2026-11-12.json");
});

test("fichiers refusés avec un message clair", () => {
  const cas = [
    ["pas du json", /JSON valide/],
    [JSON.stringify({ format: "autre" }), /pas une sauvegarde/],
    [JSON.stringify({ format: "boucle-progression", version: 99, progression: ETAT }), /plus récente/],
    [JSON.stringify({ format: "boucle-progression", version: 1 }), /pas de progression/],
    [JSON.stringify({ format: "boucle-progression", version: 1, progression: { ...ETAT, xp: -5 } }), /XP/],
    [JSON.stringify({ format: "boucle-progression", version: 1, progression: { ...ETAT, lessons: [] } }), /lessons/],
    [JSON.stringify({ format: "boucle-progression", version: 1, progression: { ...ETAT, days: ["hier"] } }), /jours/]
  ];
  for (const [texte, rx] of cas) {
    const r = importer(texte);
    assert.equal(r.ok, false, texte);
    assert.match(r.erreur, rx);
  }
});
