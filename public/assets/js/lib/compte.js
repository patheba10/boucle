/* Comptes utilisateurs (Supabase) : connexion GitHub, Google ou e-mail, session, profil.
   Sans configuration (config.js vide), tout est désactivé et le site marche comme avant.
   supabase-js est servi par le site (vendor/, copie exacte du paquet npm) et chargé seulement si les comptes
   sont actifs. La sécurité des données repose sur les règles RLS de la base (supabase/migrations). */
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../../../config.js";

const LIB = new URL("../vendor/supabase-2.118.0.js", import.meta.url).href;
const APRES = "boucle-apres-connexion"; // page où revenir après une connexion GitHub ou Google

export const actif = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY);

let client = null, chargement = null, sessionCourante = null;
const abonnes = new Set();

function chargerLib() {
  if (window.supabase) return Promise.resolve();
  return new Promise((ok, ko) => {
    const s = document.createElement("script");
    s.src = LIB; s.onload = () => ok(); s.onerror = () => ko(new Error("Impossible de charger le module de connexion."));
    document.head.appendChild(s);
  });
}

/** Le client Supabase (créé au premier appel), ou null si les comptes sont désactivés. */
export async function obtenirClient() {
  if (!actif()) return null;
  if (client) return client;
  if (!chargement) {
    chargement = chargerLib().then(() => {
      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "boucle-auth" }
      });
      client.auth.onAuthStateChange((evenement, session) => {
        sessionCourante = session;
        // Retour d'un fournisseur ou d'un lien reçu par e-mail : on nettoie l'adresse (?code=…).
        if (session && /[?&]code=/.test(location.search)) history.replaceState(null, "", location.pathname + location.hash);
        // setTimeout : ne pas appeler Supabase depuis le rappel lui-même (verrou interne de supabase-js).
        setTimeout(() => abonnes.forEach((f) => f(evenement, session)), 0);
      });
      return client;
    });
  }
  return chargement;
}

/** Être prévenu des connexions et déconnexions (événements de supabase-js). */
export function surChangement(f) { abonnes.add(f); return () => abonnes.delete(f); }
export const session = () => sessionCourante;
export const utilisateur = () => (sessionCourante ? sessionCourante.user : null);

/** Nom à afficher : profil, sinon métadonnées du fournisseur, sinon début de l'adresse e-mail. */
export function nomAffiche(user, profil) {
  if (profil && profil.nom) return profil.nom;
  if (!user) return "";
  const m = user.user_metadata || {};
  return m.full_name || m.name || m.user_name || (user.email || "").split("@")[0] || "Mon compte";
}

/** Messages d'erreur de Supabase Auth, en français. */
export function messageErreur(err) {
  if (!err) return "";
  const code = err.code || "", msg = String(err.message || err);
  const parCode = {
    invalid_credentials: "Adresse e-mail ou mot de passe incorrect.",
    user_already_exists: "Un compte existe déjà avec cette adresse. Connecte-toi, ou utilise « Mot de passe oublié ».",
    email_exists: "Un compte existe déjà avec cette adresse. Connecte-toi, ou utilise « Mot de passe oublié ».",
    email_not_confirmed: "Adresse pas encore confirmée : ouvre le lien reçu par e-mail.",
    weak_password: "Mot de passe trop faible : au moins 10 caractères, avec des lettres et des chiffres.",
    same_password: "Le nouveau mot de passe doit être différent de l'ancien.",
    over_email_send_rate_limit: "Trop d'e-mails envoyés : réessaie dans quelques minutes.",
    over_request_rate_limit: "Trop de tentatives : réessaie dans quelques minutes.",
    validation_failed: "Adresse e-mail invalide.",
    email_address_invalid: "Adresse e-mail invalide.",
    signup_disabled: "Les inscriptions sont fermées pour le moment."
  };
  if (parCode[code]) return parCode[code];
  if (/Invalid login credentials/i.test(msg)) return parCode.invalid_credentials;
  if (/already registered/i.test(msg)) return parCode.user_already_exists;
  if (/Email not confirmed/i.test(msg)) return parCode.email_not_confirmed;
  if (/Password should|weak/i.test(msg)) return parCode.weak_password;
  if (/rate limit/i.test(msg)) return parCode.over_request_rate_limit;
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return "Impossible de joindre le serveur : vérifie ta connexion.";
  return "Erreur : " + msg;
}

/** Vérifications faites avant d'appeler le serveur (mêmes règles que supabase/config.toml). */
export function verifierFormulaire({ email, motDePasse, confirmation, inscription }) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "")) return "Adresse e-mail invalide.";
  if (motDePasse === undefined) return "";
  if (inscription || confirmation !== undefined) {
    if (motDePasse.length < 10 || !/[A-Za-z]/.test(motDePasse) || !/\d/.test(motDePasse)) return "Mot de passe : au moins 10 caractères, avec des lettres et des chiffres.";
    if (confirmation !== undefined && confirmation !== motDePasse) return "Les deux mots de passe ne sont pas identiques.";
  } else if (!motDePasse) return "Saisis ton mot de passe.";
  return "";
}

const base = () => location.origin + location.pathname;

export async function connexion(email, motDePasse) {
  const c = await obtenirClient();
  const { error } = await c.auth.signInWithPassword({ email, password: motDePasse });
  if (error) throw error;
}

/** Renvoie true si le compte est actif tout de suite, false s'il faut confirmer l'adresse par e-mail. */
export async function inscription(email, motDePasse, nom) {
  const c = await obtenirClient();
  const { data, error } = await c.auth.signUp({ email, password: motDePasse, options: { data: nom ? { full_name: nom } : {}, emailRedirectTo: base() } });
  if (error) throw error;
  return !!data.session;
}

export async function connexionFournisseur(fournisseur, retour) {
  const c = await obtenirClient();
  try { sessionStorage.setItem(APRES, retour || "#compte"); } catch { /* navigation privée */ }
  const { error } = await c.auth.signInWithOAuth({ provider: fournisseur, options: { redirectTo: base() } });
  if (error) throw error;
}

/** Page à ouvrir après le retour d'un fournisseur (une seule fois). */
export function pageApresConnexion() {
  try { const p = sessionStorage.getItem(APRES); sessionStorage.removeItem(APRES); return p; } catch { return null; }
}

export async function motDePasseOublie(email) {
  const c = await obtenirClient();
  const { error } = await c.auth.resetPasswordForEmail(email, { redirectTo: base() });
  if (error) throw error;
}

export async function changerMotDePasse(motDePasse) {
  const c = await obtenirClient();
  const { error } = await c.auth.updateUser({ password: motDePasse });
  if (error) throw error;
}

export async function deconnexion() {
  const c = await obtenirClient();
  if (c) await c.auth.signOut();
}

export async function lireProfil() {
  const c = await obtenirClient();
  if (!c || !sessionCourante) return null;
  const { data, error } = await c.from("profils").select("nom, avatar_url, objectif, roadmap").maybeSingle();
  if (error) throw error;
  return data;
}
