/* Écrit public/config.js à partir des variables d'environnement SUPABASE_URL et SUPABASE_ANON_KEY (étape de
   déploiement). Sans variables, laisse les comptes désactivés. Refuse une valeur mal formée plutôt que de
   publier un site cassé, et refuse une clé « service_role », qui ne doit jamais quitter le serveur. */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function verifier(url, cle) {
  if (!url && !cle) return null;
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url || "")) throw new Error("SUPABASE_URL attendue de la forme https://<projet>.supabase.co");
  if (/^sb_secret_/.test(cle || "")) throw new Error("SUPABASE_ANON_KEY : c'est une clé secrète. Mets la clé publique (anon ou publishable).");
  if (/^eyJ/.test(cle || "")) {
    let role = "";
    try { role = JSON.parse(Buffer.from(cle.split(".")[1], "base64url").toString()).role; } catch { throw new Error("SUPABASE_ANON_KEY : jeton illisible"); }
    if (role !== "anon") throw new Error("SUPABASE_ANON_KEY : rôle « " + role + " ». Seule la clé anon est publique.");
  } else if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(cle || "")) {
    throw new Error("SUPABASE_ANON_KEY attendue : clé anon (eyJ…) ou publishable (sb_publishable_…)");
  }
  return { url, cle };
}

export function contenu(conf) {
  return "/* Généré au déploiement par scripts/config.mjs. */\n" +
    "export const SUPABASE_URL = " + JSON.stringify(conf ? conf.url : "") + ";\n" +
    "export const SUPABASE_ANON_KEY = " + JSON.stringify(conf ? conf.cle : "") + ";\n";
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const conf = verifier(process.env.SUPABASE_URL || "", process.env.SUPABASE_ANON_KEY || "");
  if (!conf) { console.log("Comptes désactivés : SUPABASE_URL et SUPABASE_ANON_KEY absentes."); process.exit(0); }
  writeFileSync(new URL("../public/config.js", import.meta.url), contenu(conf));
  console.log("public/config.js écrit pour " + conf.url);
}
