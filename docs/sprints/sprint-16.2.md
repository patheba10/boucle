# Sprint 16.2

**Objectif** : se connecter à Boucle avec GitHub, Google ou une adresse e-mail.

| Story | Points | Statut |
|-------|--------|--------|
| #156 E-2 Page de connexion | 8 | Terminé |

## Conception

- **Configuration au déploiement** : `public/config.js` est vide dans le dépôt, donc les comptes sont désactivés et le site marche comme avant (pas de lien Connexion). Le déploiement (GitHub Pages et Vercel) le remplit avec `scripts/config.mjs` à partir de deux variables. Le script refuse une adresse qui n'est pas un projet Supabase, et surtout une clé secrète ou `service_role` : une erreur de copier-coller ne doit pas publier la clé qui contourne la sécurité.
- **supabase-js servi par le site** (copie exacte du paquet npm, empreinte testée), chargé seulement si les comptes sont actifs. La CSP n'ouvre que `connect-src https://*.supabase.co` et les avatars de GitHub et Google.
- **Flux PKCE** pour GitHub, Google et les liens reçus par e-mail : le code de retour ne sert qu'avec un secret resté dans le navigateur. L'adresse est nettoyée (`?code=`) après l'échange.
- **Formulaires** : connexion, inscription (nom facultatif), mot de passe oublié, nouveau mot de passe. Les règles du mot de passe (10 caractères, lettres et chiffres) sont vérifiées avant l'envoi, avec les mêmes valeurs que `supabase/config.toml`. Les erreurs de Supabase sont traduites. « Mot de passe oublié » répond pareil qu'un compte existe ou non, pour ne pas révéler les adresses inscrites.
- **Politique de confidentialité** (Loi 25 du Québec) : quelles données, pourquoi, où (Canada), qui y accède, combien de temps, comment les exporter, les corriger ou les supprimer.
- **Tests** : une API Supabase simulée (`tests/e2e/faux_supabase.py`) imite les réponses et les erreurs d'Auth et de PostgREST. Les règles d'accès réelles restent testées en pgTAP sur la vraie base (sprint 16.1).

## Journal

- 13 nov. : `lib/compte.js` (client, session, actions, erreurs) et `lib/compteview.js` (pages, lien de l'en-tête) ; routes `#connexion`, `#inscription`, `#mot-de-passe-oublie`, `#nouveau-mot-de-passe`, `#compte`, `#confidentialite`.
- 13 nov. : un test e2e échouait une fois sur deux. La déconnexion renvoyait vers l'accueil après la fin de l'appel réseau, pendant que le test avait déjà ouvert la page suivante. Le test attend maintenant la fin de la déconnexion, comme le ferait quelqu'un qui clique.
- 13 nov. : 132 tests unitaires, 30 e2e, audit sans faille non traitée.
- 13 nov. : PR #160, CI verte (dont CodeQL et la base Supabase). Fusionnée ; publiée en 0.45.0.

## Revue de sprint

8 points livrés sur 8 (PR #160).
