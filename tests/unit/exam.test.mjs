/* Moteur des examens blancs : quotas par domaine, tirage déterministe, correction, contrôle des banques. */
import test from "node:test";
import assert from "node:assert/strict";
import { quotas, buildExam, grade, isRight, lintCert } from "../../public/assets/js/lib/exam.js";
import { CERTS } from "../../public/content/certifs/index.js";

const mini = {
  id: "mini", count: 10, passing: 700,
  domains: [{ id: "a", name: "A", weight: 50 }, { id: "b", name: "B", weight: 30 }, { id: "c", name: "C", weight: 20 }],
  bank: [
    ...Array.from({ length: 6 }, (_, i) => ({ id: "a" + i, d: "a", q: "Question A" + i, options: ["w", "x", "y", "z"], answer: 0, explain: "e" })),
    ...Array.from({ length: 4 }, (_, i) => ({ id: "b" + i, d: "b", q: "Question B" + i + " ? Choisis-en deux.", options: ["v", "w", "x", "y", "z"], answer: [1, 3], explain: "e" })),
    ...Array.from({ length: 2 }, (_, i) => ({ id: "c" + i, d: "c", q: "Question C" + i, options: ["w", "x", "y", "z"], answer: 2, explain: "e" }))
  ]
};

test("quotas : poids des domaines, plus fort reste, bornés par la banque", () => {
  assert.deepEqual(quotas(mini, 10), { a: 5, b: 3, c: 2 });
  assert.deepEqual(quotas(mini, 7), { a: 4, b: 2, c: 1 });
  // le domaine c n'a que 2 questions : le surplus va ailleurs
  assert.deepEqual(quotas({ ...mini, domains: [{ id: "a", weight: 20 }, { id: "b", weight: 20 }, { id: "c", weight: 60 }] }, 10), { a: 4, b: 4, c: 2 });
});

test("tirage : déterministe pour une graine, options mélangées, domaine seul pour l'entraînement", () => {
  const e1 = buildExam(mini, { seed: 7 }), e2 = buildExam(mini, { seed: 7 }), e3 = buildExam(mini, { seed: 8 });
  assert.deepEqual(e1, e2);
  assert.notDeepEqual(e1.items.map((x) => x.id), e3.items.map((x) => x.id));
  assert.equal(new Set(e1.items.map((x) => x.id)).size, 10);
  for (const it of e1.items) assert.deepEqual([...it.order].sort(), mini.bank.find((q) => q.id === it.id).options.map((_, i) => i));
  const p = buildExam(mini, { domain: "b", seed: 3 });
  assert.equal(p.items.length, 4); assert.ok(p.items.every((x) => x.id.startsWith("b")));
});

test("correction : réponses multiples exactes, sans réponse = faux, score 100-1000 et détail par domaine", () => {
  const b = mini.bank.find((q) => q.id === "b0");
  assert.ok(isRight(b, [3, 1])); assert.ok(!isRight(b, [1])); assert.ok(!isRight(b, [1, 3, 0])); assert.ok(!isRight(b, undefined));
  const ex = buildExam(mini, { seed: 1 });
  const ans = Object.fromEntries(ex.items.map((x) => { const q = mini.bank.find((y) => y.id === x.id); return [x.id, q.answer]; }));
  assert.equal(grade(mini, ex, ans).score, 1000);
  delete ans[ex.items[0].id]; ans[ex.items[1].id] = 99; ans[ex.items[2].id] = 99;
  const g = grade(mini, ex, ans);
  assert.equal(g.right, 7); assert.equal(g.score, 730); assert.ok(g.pass); assert.equal(g.wrong.length, 3);
  assert.equal(g.byDomain.reduce((s, d) => s + d.total, 0), 10);
  assert.equal(grade(mini, ex, {}).score, 100);
});

test("contrôle des banques : la banque de test et les vraies banques", () => {
  assert.deepEqual(lintCert(mini), []);
  const bad = { ...mini, bank: [...mini.bank, { id: "a0", d: "z", q: "Q ? Choisis-en deux.", options: ["a", "a", "b"], answer: [0, 5], explain: "" }] };
  const errs = lintCert(bad).join("\n");
  for (const m of ["identifiant en double", "domaine inconnu", "au moins 4 options", "options en double", "réponse hors des options", "énoncé ou explication"]) assert.match(errs, new RegExp(m));
  for (const c of CERTS) { assert.deepEqual(lintCert(c), [], c.id); assert.equal(buildExam(c, { seed: 5 }).items.length, c.count); }
});
