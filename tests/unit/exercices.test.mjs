/* Exercices courts : correction des trois formats et mélange déterministe. */
import test from "node:test";
import assert from "node:assert/strict";
import { trous, codeComplet, codeOrdre, verifierSortie, verifierTrous, verifierOrdre, melange } from "../../public/assets/js/lib/exercices.js";

test("sortie : espaces de fin et lignes vides finales ignorés", () => {
  const ex = { reponse: "3\n[1, 2]" };
  assert.ok(verifierSortie(ex, "3  \n[1, 2]\n\n"));
  assert.ok(!verifierSortie(ex, "3\n[1,2,]"));
  assert.ok(!verifierSortie(ex, "[1, 2]\n3"));
});

test("trous : réponses multiples, espaces autour des opérateurs", () => {
  const ex = { code: "for i in ⟦range⟧(3):\n    total ⟦+=§= total +⟧ i" };
  assert.deepEqual(trous(ex.code), [["range"], ["+=", "= total +"]]);
  assert.equal(codeComplet(ex.code), "for i in range(3):\n    total += i");
  assert.deepEqual(verifierTrous(ex, ["range", "+="]), [true, true]);
  assert.deepEqual(verifierTrous(ex, [" range ", "=total+"]), [true, true]);
  assert.deepEqual(verifierTrous(ex, ["len", ""]), [false, false]);
  assert.deepEqual(verifierTrous({ code: "x = ⟦len( a )⟧" }, ["len(a)"]), [true]);
  // du vrai code avec des listes de listes ne crée pas de faux trous
  assert.deepEqual(trous("t = [[] for _ in range(3)]\nm = [[1, 2], [3]]\nx = t[⟦0⟧]"), [["0"]]);
});

test("ordre : juste seulement dans l'ordre exact ; lignes identiques interchangeables", () => {
  const ex = { lignes: ["a", "b", "c"] };
  assert.ok(verifierOrdre(ex, [0, 1, 2]));
  assert.ok(!verifierOrdre(ex, [1, 0, 2]));
  assert.ok(verifierOrdre({ lignes: ["x", "}", "}"] }, [0, 2, 1]));
});

test("mélange : permutation stable, jamais l'ordre correct", () => {
  for (let n = 2; n <= 9; n++) {
    for (const g of ["py-01/0", "em-03/1", "al-02/4", "z"]) {
      const o = melange(n, g);
      assert.deepEqual([...o].sort((a, b) => a - b), [...Array(n).keys()]);
      assert.ok(o.some((k, i) => k !== i), n + " " + g);
      assert.deepEqual(melange(n, g), o);
    }
  }
  assert.deepEqual(melange(1, "a"), [0]);
});

test("ordre : le programme complet entoure les lignes du code fixe", () => {
  assert.equal(codeOrdre({ avant: "#include <stdio.h>\n", lignes: ["a", "b"], apres: "\nfin" }), "#include <stdio.h>\na\nb\nfin");
  assert.equal(codeOrdre({ lignes: ["a", "b"] }), "a\nb");
});
