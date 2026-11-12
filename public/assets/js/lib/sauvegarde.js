/* Exporter et importer la progression (audit #16) : un fichier JSON à garder ou à recharger sur un autre navigateur.
   Fonctions pures, testées dans tests/unit/sauvegarde.test.mjs. */

export const FORMAT = "boucle-progression";
export const VERSION = 1;

/** Texte JSON du fichier de sauvegarde. */
export function exporter(etat, date = new Date().toISOString()) {
  return JSON.stringify({ format: FORMAT, version: VERSION, date, progression: etat }, null, 2);
}

const OBJETS = ["lessons", "roadmap", "projets", "revision", "code", "certs"];

/** Lit un fichier de sauvegarde ; renvoie { ok: true, etat } ou { ok: false, erreur } sans jamais lever d'exception. */
export function importer(texte) {
  let d;
  try { d = JSON.parse(texte); } catch (e) { return { ok: false, erreur: "Ce fichier n'est pas du JSON valide." }; }
  if (!d || typeof d !== "object" || d.format !== FORMAT) return { ok: false, erreur: "Ce fichier n'est pas une sauvegarde de Boucle." };
  if (typeof d.version !== "number" || d.version > VERSION) return { ok: false, erreur: "Sauvegarde d'une version plus récente de Boucle : mets la page à jour." };
  const p = d.progression;
  if (!p || typeof p !== "object" || Array.isArray(p)) return { ok: false, erreur: "La sauvegarde ne contient pas de progression." };
  if (typeof p.xp !== "number" || p.xp < 0 || !Number.isFinite(p.xp)) return { ok: false, erreur: "Le total d'XP est invalide." };
  for (const k of OBJETS) if (p[k] !== undefined && (typeof p[k] !== "object" || p[k] === null || Array.isArray(p[k]))) return { ok: false, erreur: "Le champ « " + k + " » est invalide." };
  if (p.days !== undefined && (!Array.isArray(p.days) || p.days.some((j) => !/^\d{4}-\d{2}-\d{2}$/.test(j)))) return { ok: false, erreur: "La liste des jours d'activité est invalide." };
  return { ok: true, etat: p, date: d.date || null };
}

/** Nom de fichier proposé : boucle-progression-AAAA-MM-JJ.json */
export const nomFichier = (jour) => "boucle-progression-" + jour + ".json";
