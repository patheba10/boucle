/* Examens blancs : tirage pondéré par domaine, mélange des options, correction et score à l'échelle AWS.
   Une certification : { id, code, name, minutes, count, passing, domains: [{ id, name, weight }], bank: [question] }.
   Une question : { id, d (domaine), q, options: [..], answer: index | [index, ...], explain }. */

/** Générateur pseudo-aléatoire déterministe (mulberry32), pour rejouer un tirage à partir de sa graine. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function shuffle(xs, rand) { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export const answers = (q) => [].concat(q.answer);
export const isMulti = (q) => Array.isArray(q.answer);

/** Nombre de questions par domaine pour n questions : poids officiels, méthode du plus fort reste, bornés par la banque. */
export function quotas(cert, n) {
  const avail = Object.fromEntries(cert.domains.map((d) => [d.id, cert.bank.filter((q) => q.d === d.id).length]));
  const total = cert.domains.reduce((s, d) => s + d.weight, 0);
  const raw = cert.domains.map((d) => ({ id: d.id, x: (n * d.weight) / total }));
  const out = Object.fromEntries(raw.map((r) => [r.id, Math.min(Math.floor(r.x), avail[r.id])]));
  let left = n - Object.values(out).reduce((s, v) => s + v, 0);
  for (const r of [...raw].sort((a, b) => (b.x - Math.floor(b.x)) - (a.x - Math.floor(a.x)))) { if (left <= 0) break; if (out[r.id] < avail[r.id]) { out[r.id]++; left--; } }
  // s'il manque encore des questions (banque trop petite pour un domaine), on complète ailleurs
  while (left > 0) { const open = cert.domains.filter((d) => out[d.id] < avail[d.id]); if (!open.length) break; for (const d of open) if (left > 0) { out[d.id]++; left--; } }
  return out;
}

/**
 * Prépare un examen : { seed, items: [{ id, order: [indices des options mélangées] }] }.
 * domain : limiter à un domaine (entraînement) ; n : nombre de questions (défaut : cert.count, borné par la banque).
 */
export function buildExam(cert, { n, seed = Date.now() % 2147483647, domain } = {}) {
  const rand = rng(seed);
  const pool = domain ? cert.bank.filter((q) => q.d === domain) : cert.bank;
  const size = Math.min(n || cert.count, pool.length);
  let picked;
  if (domain) picked = shuffle(pool, rand).slice(0, size);
  else { const qt = quotas(cert, size); picked = shuffle(cert.domains.flatMap((d) => shuffle(cert.bank.filter((q) => q.d === d.id), rand).slice(0, qt[d.id])), rand); }
  return { seed, cert: cert.id, domain: domain || null, items: picked.map((q) => ({ id: q.id, order: shuffle(q.options.map((_, i) => i), rand) })) };
}

/** Une réponse est juste si l'ensemble des indices choisis (indices d'origine) est exactement celui attendu. */
export function isRight(q, chosen) { const a = answers(q).slice().sort(); const c = [].concat(chosen ?? []).slice().sort(); return a.length === c.length && a.every((x, i) => x === c[i]); }

/**
 * Corrige : answersById { id: index | [index] } (indices d'origine). Renvoie le nombre de bonnes réponses, le score
 * à l'échelle 100-1000 (linéaire, approximation : AWS ne publie pas sa mise à l'échelle), la réussite et le détail par domaine.
 */
export function grade(cert, exam, answersById) {
  const byId = Object.fromEntries(cert.bank.map((q) => [q.id, q]));
  const dom = Object.fromEntries(cert.domains.map((d) => [d.id, { id: d.id, name: d.name, right: 0, total: 0 }]));
  const wrong = []; let right = 0;
  for (const it of exam.items) {
    const q = byId[it.id]; const ok = isRight(q, answersById[it.id]);
    dom[q.d].total++; if (ok) { right++; dom[q.d].right++; } else wrong.push(q.id);
  }
  const total = exam.items.length; const score = total ? Math.round(100 + (900 * right) / total) : 100;
  return { right, total, score, pass: score >= cert.passing, byDomain: Object.values(dom).filter((d) => d.total), wrong };
}

/** Problèmes de structure d'une banque (pour npm run validate). */
export function lintCert(cert) {
  const errs = []; const ids = new Set(); const doms = new Set(cert.domains.map((d) => d.id));
  if (Math.abs(cert.domains.reduce((s, d) => s + d.weight, 0) - 100) > 0.01) errs.push(cert.id + " : les poids des domaines ne font pas 100");
  for (const q of cert.bank) {
    const w = (m) => errs.push(cert.id + "/" + q.id + " : " + m);
    if (ids.has(q.id)) w("identifiant en double"); ids.add(q.id);
    if (!doms.has(q.d)) w("domaine inconnu " + q.d);
    if (!q.q || !q.explain) w("énoncé ou explication manquant");
    if (/\b(première|deuxième|troisième|dernière) (option|réponse)\b|\b(option|réponse) [A-E]\b/i.test(q.explain || "")) w("l'explication cite une position d'option, or les options sont mélangées");
    if (!Array.isArray(q.options) || q.options.length < 4) w("il faut au moins 4 options");
    if (new Set(q.options).size !== q.options.length) w("options en double");
    const a = answers(q);
    if (!a.length || a.some((x) => !Number.isInteger(x) || x < 0 || x >= q.options.length)) w("réponse hors des options");
    if (new Set(a).size !== a.length) w("réponse en double");
    if (isMulti(q)) { const m = /Choisis-en (deux|trois)\b/.exec(q.q); const k = m ? { deux: 2, trois: 3 }[m[1]] : 0; if (k !== a.length) w("question à réponses multiples : l'énoncé doit finir par « Choisis-en deux/trois. » et compter " + a.length + " réponses"); if (q.options.length < a.length + 3) w("trop peu d'options pour une question à réponses multiples"); }
    else if (/Choisis-en/.test(q.q)) w("« Choisis-en » sur une question à réponse unique");
  }
  for (const d of cert.domains) { const n = cert.bank.filter((q) => q.d === d.id).length; const need = Math.ceil((cert.minBank || cert.count) * d.weight / 100); if (n < need) errs.push(cert.id + " : domaine « " + d.name + " » : " + n + " questions, il en faut au moins " + need); }
  return errs;
}
