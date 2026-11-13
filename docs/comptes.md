# Mettre en service les comptes

Tant que ces étapes ne sont pas faites, Boucle marche sans comptes, comme avant : `public/config.js` est vide, aucun lien « Connexion » n'apparaît. Compter environ 45 minutes. Tout est gratuit.

Aucune clé n'est à copier dans un fichier du dépôt ni à envoyer à qui que ce soit : les valeurs vont dans les réglages de GitHub, de Vercel et de Supabase.

## 1. Créer le projet Supabase

1. Sur [supabase.com](https://supabase.com), crée un compte (avec GitHub), puis **New project**.
2. Nom : `boucle`. **Region : Canada (Central)**. Les données restent au Canada, comme l'annonce la politique de confidentialité (Loi 25).
3. Choisis un mot de passe de base de données long et garde-le dans ton gestionnaire de mots de passe. Il sert au déploiement automatique des migrations (étape 6).

## 2. Créer les tables (migrations)

Deux possibilités :

- **Automatique (recommandé)**, avec le workflow « Base de données » (étape 6) : chaque migration fusionnée sur `main` est appliquée toute seule.
- **À la main, une seule fois** : Supabase → **SQL Editor** → colle le contenu de `supabase/migrations/20261113120000_comptes.sql` → **Run**.

Vérifie ensuite dans **Table Editor** que `profils` et `progressions` existent, avec « RLS enabled ».

## 3. Réglages de l'authentification

Supabase → **Authentication** :

- **URL Configuration**
  - Site URL : `https://patheba10.github.io/boucle/`
  - Redirect URLs : `https://patheba10.github.io/boucle/` et l'adresse Vercel du site (par exemple `https://boucle-patheba10.vercel.app/`). Pour les aperçus de PR Vercel : `https://*-patheba10.vercel.app/**`.
- **Sign In / Providers → Email** : laisse « Confirm email » activé.
- **Policies → Password** : longueur minimale 10, « Letters and digits » (mêmes règles que le site et que `supabase/config.toml`).
- **E-mails** : le service d'envoi fourni par Supabase est limité à quelques messages par heure, et seulement vers les membres de ton équipe Supabase. Pour de vrais utilisateurs, branche un SMTP gratuit dans **Authentication → Emails → SMTP Settings** (Resend ou Brevo, par exemple).

## 4. Connexion avec GitHub

1. GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**.
   - Application name : `Boucle`
   - Homepage URL : `https://patheba10.github.io/boucle/`
   - Authorization callback URL : `https://<ton-projet>.supabase.co/auth/v1/callback`. L'adresse exacte est affichée dans Supabase → Authentication → Providers → GitHub.
2. Copie le **Client ID**, génère un **Client secret**, et colle-les dans Supabase → **Authentication → Providers → GitHub** → Enable → Save.

## 5. Connexion avec Google

1. [Google Cloud Console](https://console.cloud.google.com/) → nouveau projet `Boucle`.
2. **APIs & Services → OAuth consent screen** : type External, nom `Boucle`, ton adresse de contact, portées `email` et `profile` seulement. Publie l'application (« In production ») pour que tout le monde puisse se connecter.
3. **Credentials → Create credentials → OAuth client ID** → Web application.
   - Authorized JavaScript origins : `https://patheba10.github.io` et l'adresse Vercel.
   - Authorized redirect URIs : `https://<ton-projet>.supabase.co/auth/v1/callback`.
4. Colle le Client ID et le Client secret dans Supabase → **Authentication → Providers → Google** → Enable → Save.

## 6. Brancher le site

Dans Supabase → **Project Settings → API**, note :

- l'**URL du projet** (`https://<ton-projet>.supabase.co`) ;
- la clé **publishable** (`sb_publishable_…`) ou **anon** (`eyJ…`). Elle est publique par conception. **Jamais la clé secret ni service_role** : le déploiement la refuserait de toute façon.

Puis :

1. **GitHub** → dépôt `boucle` → **Settings → Secrets and variables → Actions** :
   - onglet **Variables** : `SUPABASE_URL`, `SUPABASE_ANON_KEY`, et `SUPABASE_PROJECT_ID` (l'identifiant du projet, la partie avant `.supabase.co`) ;
   - onglet **Secrets**, pour le déploiement automatique des migrations : `SUPABASE_ACCESS_TOKEN` (Supabase → Account → Access Tokens) et `SUPABASE_DB_PASSWORD` (le mot de passe de l'étape 1).
2. **Vercel** → projet → **Settings → Environment Variables** : `SUPABASE_URL` et `SUPABASE_ANON_KEY` (Production et Preview).
3. Relance le déploiement : **Actions → CI → Run workflow** sur `main` (ou fusionne n'importe quelle PR), et **Redeploy** sur Vercel. Lance aussi **Actions → Base de données → Run workflow** si tu as choisi les migrations automatiques.

## 7. Vérifier

- Le lien « Connexion » apparaît en haut à droite du site.
- Inscription par e-mail : l'e-mail de confirmation arrive, le lien ouvre le site connecté.
- GitHub et Google : retour sur le site, connecté, avec ton nom et ton avatar.
- Progression : avance d'une leçon sur l'ordinateur, ouvre le site sur le téléphone avec le même compte, elle y est.
- Sécurité : dans Supabase → **Advisors → Security Advisor**, aucune alerte sur `profils` ni `progressions`.

## En cas de problème

| Symptôme | Cause probable |
|----------|----------------|
| Pas de lien « Connexion » | Variables absentes, ou déploiement pas relancé. Le journal de l'étape « Configurer les comptes » le dit. |
| « redirect_to is not allowed » | L'adresse du site n'est pas dans les Redirect URLs (étape 3). |
| GitHub ou Google : « redirect_uri mismatch » | L'URL de rappel déclarée chez GitHub ou Google n'est pas exactement celle de Supabase. |
| L'e-mail de confirmation n'arrive pas | Limite du service d'envoi par défaut : configurer un SMTP (étape 3). |
| Erreur « permission denied » dans la console | La migration n'a pas été appliquée (étape 2). |
