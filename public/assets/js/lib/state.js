/* Progression de l'élève, stockée dans localStorage (propre à ce navigateur). */
import { today, dayKey } from "./util.js";

const KEY = "boucle-v1";
const blank = () => ({ xp: 0, lessons: {}, roadmap: {}, projets: {}, revision: {}, days: [], code: {}, last: null, atelier: { lang: "py", py: "", cpp: "", stdin: "" } });

export let S = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return Object.assign(blank(), JSON.parse(raw));
  } catch (e) { /* stockage indisponible : on garde un état en mémoire */ }
  return blank();
}
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignoré */ }
}
export function resetAll() { S = blank(); save(); }
/** Remplace toute la progression (import d'une sauvegarde déjà validée). */
export function remplacer(etat) { S = Object.assign(blank(), etat); save(); }

export function markDay() {
  const t = today();
  if (!S.days.includes(t)) { S.days.push(t); S.days = S.days.slice(-400); }
}
export function streak() {
  const set = new Set(S.days);
  const d = new Date();
  let n = 0;
  if (!set.has(dayKey(d))) d.setDate(d.getDate() - 1);
  while (set.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

export const XP_PER_LEVEL = 150;
export const level = () => Math.floor(S.xp / XP_PER_LEVEL) + 1;

/** Entrée de progression d'une leçon (créée à la demande). */
export const ls = (id) => (S.lessons[id] = S.lessons[id] || { quiz: {}, ch: false, sol: false });
