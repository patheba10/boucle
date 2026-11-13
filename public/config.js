/* Configuration publique des comptes (Supabase). Vide : les comptes sont désactivés et le site marche sans,
   comme avant. Remplie au déploiement par scripts/config.mjs, à partir des variables SUPABASE_URL et
   SUPABASE_ANON_KEY de GitHub (Settings → Variables) ou de Vercel. La clé « anon » (ou « publishable ») est
   publique par conception : ce sont les règles de sécurité par ligne de la base qui protègent les données. */
export const SUPABASE_URL = "";
export const SUPABASE_ANON_KEY = "";
