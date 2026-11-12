/* Indices progressifs : découpage des indices existants en phrases, sans couper le code ni perdre de texte. */
import test from "node:test";
import assert from "node:assert/strict";
import { indicesDe, libelleIndice } from "../../public/assets/js/lib/indices.js";
import { COURSES } from "../../public/content/index.js";

test("découpage : phrases, code protégé, phrase courte rattachée", () => {
  assert.deepEqual(indicesDe({ hint: "Un dictionnaire. Pour chaque x, cherche @@cible - x@@. Ensuite range-le." }),
    ["Un dictionnaire. Pour chaque x, cherche @@cible - x@@.", "Ensuite range-le."]);
  assert.deepEqual(indicesDe({ hint: "Utilise @@os.path.join(a, b)@@ puis @@print(x.y)@@. Teste. Puis vérifie le résultat final." }),
    ["Utilise @@os.path.join(a, b)@@ puis @@print(x.y)@@.", "Teste. Puis vérifie le résultat final."]);
  assert.deepEqual(indicesDe({ hints: ["a", "b"], hint: "ignoré" }), ["a", "b"]);
  assert.deepEqual(indicesDe({}), []);
  assert.equal(libelleIndice(["a"], 0), "Indice");
  assert.equal(libelleIndice(["a", "b", "c"], 0), "Indice (1 / 3)");
  assert.equal(libelleIndice(["a", "b", "c"], 1), "Indice suivant (2 / 3)");
  assert.equal(libelleIndice(["a", "b", "c"], 3), "Indices (3 / 3)");
});

test("tous les défis : le découpage ne perd aucun texte et ne coupe jamais un @@code@@", () => {
  let multi = 0, total = 0;
  for (const c of COURSES) for (const l of c.lessons) {
    if (!l.challenge || !l.challenge.hint) continue;
    const morceaux = indicesDe(l.challenge);
    total++;
    if (morceaux.length > 1) multi++;
    assert.equal(morceaux.join(" ").replace(/\s+/g, " "), l.challenge.hint.trim().replace(/\s+/g, " "), l.id);
    for (const m of morceaux) assert.equal((m.match(/@@/g) || []).length % 2, 0, l.id + " : @@ coupé dans « " + m + " »");
  }
  assert.ok(total > 150 && multi > total / 3, total + " indices, " + multi + " découpés");
});
