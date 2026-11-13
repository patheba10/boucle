/* Synchronisation : fusion de deux progressions, puis scénarios avec une base simulée (révisions, conflits). */
import test from "node:test";
import assert from "node:assert/strict";
import { fusionner, memes, Synchro } from "../../public/assets/js/lib/synchro.js";

const tel = { maj: 100, xp: 120, lessons: { "py-01": { quiz: { 0: true }, ch: true, sol: false }, "py-02": { quiz: { 1: true }, ch: false, sol: false, ex: { 0: true } } },
  roadmap: { "do-git": true }, projets: { "pj-x/a": true }, days: ["2026-11-10", "2026-11-12"], code: { "py-01": "print(1)" }, last: "py-02",
  revision: { "sql-04/1": { serie: 2, due: "2026-11-20" } }, certs: { aws: { seen: { q1: true }, exams: [{ score: 70, date: "a" }], current: null } } };
const pc = { maj: 200, xp: 90, lessons: { "py-02": { quiz: { 0: true }, ch: true, sol: true, defis: { moyen: true } }, "al-01": { quiz: {}, ch: true, sol: false } },
  roadmap: { "do-net": true }, projets: {}, days: ["2026-11-11", "2026-11-12"], code: { "py-01": "print(2)", "al-01": "x" }, last: "al-01",
  revision: { "sql-04/1": { serie: 0, due: "2026-11-14" }, "py-03/0": { serie: 1, due: "2026-11-15" } }, certs: { aws: { seen: { q2: true }, exams: [{ score: 70, date: "a" }, { score: 80, date: "b" }], current: { q: 1 } } } };

test("fusion : rien de réussi n'est perdu", () => {
  const f = fusionner(tel, pc);
  assert.equal(f.xp, 120);
  assert.deepEqual(f.lessons["py-01"], tel.lessons["py-01"]);
  assert.deepEqual(f.lessons["py-02"].quiz, { 0: true, 1: true });
  assert.equal(f.lessons["py-02"].ch, true);
  assert.deepEqual(f.lessons["py-02"].ex, { 0: true });
  assert.deepEqual(f.lessons["py-02"].defis, { moyen: true });
  assert.ok(f.lessons["al-01"].ch);
  assert.deepEqual(f.roadmap, { "do-git": true, "do-net": true });
  assert.deepEqual(f.projets, { "pj-x/a": true });
  assert.deepEqual(f.days, ["2026-11-10", "2026-11-11", "2026-11-12"]);
  assert.deepEqual(f.certs.aws.seen, { q1: true, q2: true });
  assert.equal(f.certs.aws.exams.length, 2);
});

test("fusion : le plus récent l'emporte pour le code et la dernière leçon ; la révision la plus prudente", () => {
  const f = fusionner(tel, pc);
  assert.equal(f.code["py-01"], "print(2)");
  assert.equal(f.code["al-01"], "x");
  assert.equal(f.last, "al-01");
  assert.equal(f.maj, 200);
  assert.deepEqual(f.revision["sql-04/1"], { serie: 0, due: "2026-11-14" });
  assert.ok(f.revision["py-03/0"]);
  assert.deepEqual(f.certs.aws.current, { q: 1 });
});

test("fusion : commutative sur ce qui compte, sans effet sur les entrées, tolère le vide", () => {
  const avant = JSON.stringify(tel);
  const ab = fusionner(tel, pc), ba = fusionner(pc, tel);
  assert.equal(JSON.stringify(tel), avant);
  for (const k of ["xp", "roadmap", "projets", "days", "code", "last"]) assert.deepEqual(ab[k], ba[k], k);
  assert.ok(memes(fusionner({}, tel), { ...fusionner({}, tel), maj: 1 }));
  assert.equal(fusionner(null, undefined).xp, 0);
  assert.ok(memes(fusionner(tel, tel), fusionner(tel, {})));
});

/* Base simulée : même contrat que la vraie (progressions + enregistrer_progression avec contrôle de révision). */
function base(donnees = {}, revision = 1) {
  const b = { donnees, revision, ecritures: 0, panne: false };
  b.client = {
    from: () => ({ select: () => ({ maybeSingle: async () => (b.panne ? { error: { message: "Failed to fetch" } } : { data: { donnees: b.donnees, revision: b.revision }, error: null }) }) }),
    rpc: async (nom, { donnees: d, revision_attendue }) => {
      if (b.panne) return { data: null, error: { message: "Failed to fetch" } };
      if (b.avantEcriture) { const f = b.avantEcriture; b.avantEcriture = null; f(); }
      if (revision_attendue !== b.revision) return { data: null, error: { code: "40001", message: "conflit" } };
      b.donnees = JSON.parse(JSON.stringify(d)); b.revision += 1; b.ecritures += 1;
      return { data: b.revision, error: null };
    }
  };
  return b;
}
const navigateur = (etat) => { const n = { etat }; n.lire = () => n.etat; n.remplacer = (e) => { n.etat = e; }; return n; };

test("connexion : la progression du navigateur rejoint celle du compte, dans les deux sens", async () => {
  const b = base(pc, 4), n = navigateur(tel);
  const s = new Synchro({ client: b.client, etat: n.lire, remplacer: n.remplacer, utilisateur: "u1", delai: 0 });
  await s.demarrer();
  assert.equal(n.etat.compte, "u1");
  assert.ok(n.etat.lessons["py-01"].ch && n.etat.lessons["al-01"].ch);
  assert.equal(b.revision, 5);
  assert.ok(b.donnees.lessons["py-01"].ch, "le compte a reçu les leçons du navigateur");
});

test("connexion : rien n'est réécrit si le compte a déjà tout", async () => {
  const b = base({ ...tel, compte: "u1" }, 3), n = navigateur({ ...tel, compte: "u1" });
  await new Synchro({ client: b.client, etat: n.lire, remplacer: n.remplacer, utilisateur: "u1" }).demarrer();
  assert.equal(b.ecritures, 0);
});

test("autre compte sur ce navigateur : sa progression n'est pas mélangée", async () => {
  const b = base(pc, 2), n = navigateur({ ...tel, compte: "u2" });
  await new Synchro({ client: b.client, etat: n.lire, remplacer: n.remplacer, utilisateur: "u1" }).demarrer();
  assert.equal(n.etat.lessons["py-01"], undefined);
  assert.equal(n.etat.compte, "u1");
});

test("conflit : un autre appareil a écrit entre-temps ; on relit, on fusionne, on réécrit", async () => {
  const b = base({}, 1), n = navigateur({ xp: 10, lessons: { "py-01": { quiz: {}, ch: true, sol: false } }, maj: 5 });
  const s = new Synchro({ client: b.client, etat: n.lire, remplacer: n.remplacer, utilisateur: "u1" });
  await s.demarrer();
  b.avantEcriture = () => { b.donnees = { xp: 50, lessons: { "al-02": { quiz: {}, ch: true, sol: false } }, maj: 6 }; b.revision += 1; };
  n.etat = { ...n.etat, xp: 15, maj: 7 };
  await s.envoyer();
  assert.ok(b.donnees.lessons["py-01"].ch && b.donnees.lessons["al-02"].ch, "les deux appareils sont dans la fusion");
  assert.equal(b.donnees.xp, 50);
  assert.equal(s.revision, b.revision);
});

test("réseau coupé : l'erreur est signalée, la progression locale reste intacte, l'envoi suivant réussit", async () => {
  const b = base({}, 1), n = navigateur({ xp: 10, maj: 1 });
  const statuts = [];
  const s = new Synchro({ client: b.client, etat: n.lire, remplacer: n.remplacer, utilisateur: "u1", onStatut: (x) => statuts.push(x) });
  await s.demarrer();
  b.panne = true; n.etat = { ...n.etat, xp: 30, maj: 2 };
  await assert.rejects(s.envoyer());
  assert.equal(statuts.at(-1), "erreur");
  assert.equal(n.etat.xp, 30);
  b.panne = false;
  await s.envoyer();
  assert.equal(b.donnees.xp, 30);
  assert.equal(statuts.at(-1), "ok");
});
