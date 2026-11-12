/* Révision espacée des quiz (audit #3). Une question ratée entre dans une boîte de révision ; elle revient à J+1,
   puis J+3, puis J+7 tant qu'elle est réussie, et quitte la révision après trois réussites de suite. Une erreur la
   renvoie au début. Fonctions pures sur l'objet `rev` (S.revision), testées dans tests/unit/revision.test.mjs. */

export const INTERVALLES = [1, 3, 7];

/** Date AAAA-MM-JJ décalée de n jours (calcul en UTC : pas de piège d'heure d'été). */
export function plusJours(jour, n) {
  const [a, m, j] = jour.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1, j + n));
  return d.toISOString().slice(0, 10);
}

/** Une erreur : la question (re)commence sa révision demain. */
export function rater(rev, cle, aujourdhui) {
  rev[cle] = { serie: 0, due: plusJours(aujourdhui, INTERVALLES[0]) };
  return rev[cle];
}

/** Une bonne réponse pendant une révision : intervalle suivant, ou sortie de la révision après la dernière. */
export function reussir(rev, cle, aujourdhui) {
  const e = rev[cle];
  if (!e) return null;
  e.serie += 1;
  if (e.serie >= INTERVALLES.length) {
    delete rev[cle];
    return null;
  }
  e.due = plusJours(aujourdhui, INTERVALLES[e.serie]);
  return e;
}

/** Les clés à réviser aujourd'hui (échéance passée ou du jour), les plus en retard d'abord. */
export function aReviser(rev, aujourdhui) {
  return Object.keys(rev).filter((k) => rev[k].due <= aujourdhui).sort((a, b) => (rev[a].due < rev[b].due ? -1 : rev[a].due > rev[b].due ? 1 : a < b ? -1 : 1));
}

/** Prochaine échéance future (pour dire « rien aujourd'hui, la suivante le … »), ou null. */
export function prochaine(rev, aujourdhui) {
  const futures = Object.values(rev).map((e) => e.due).filter((d) => d > aujourdhui).sort();
  return futures[0] || null;
}

export const cle = (lessonId, qi) => lessonId + "/" + qi;
export function decoder(cle) {
  const i = cle.lastIndexOf("/");
  return { lessonId: cle.slice(0, i), qi: +cle.slice(i + 1) };
}
