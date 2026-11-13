# Sprint 16.1

**Objectif** : la base de données des comptes, sûre avant d'écrire la moindre page (AUDIT #16).

| Story | Points | Statut |
|-------|--------|--------|
| #155 E-1 Base de données des comptes (Supabase, RLS) | 8 | En cours |

## Conception

- **Pourquoi Supabase** : Boucle est un site statique, sans serveur. Supabase fournit l'authentification (GitHub, Google, e-mail) et un PostgreSQL accessible depuis le navigateur, gratuitement. La sécurité ne repose donc pas sur un serveur à nous, mais sur les **règles de sécurité par ligne** (Row Level Security) de Postgres : c'est la base elle-même qui refuse.
- **Deux tables** : `profils` (nom, avatar, objectif, roadmap suivie) et `progressions` (l'objet de progression du navigateur, en JSON, tel que l'exporte déjà `lib/sauvegarde.js`). Garder le même format évite une deuxième représentation de la progression à maintenir.
- **Droits au plus juste** : Supabase donne par défaut toutes les tables aux rôles `anon` et `authenticated`. La migration retire tout, puis rend la lecture de ses propres lignes et la modification de quatre colonnes du profil. Pas d'insertion directe : un déclencheur crée profil et progression à l'inscription. Pas de suppression directe : `supprimer_mon_compte()` efface l'utilisateur, et tout part en cascade.
- **Concurrence entre appareils** : `enregistrer_progression(donnees, revision_attendue)` n'écrit que si la révision n'a pas bougé ; sinon erreur 40001, le client relit, fusionne et réessaie (sprint 16.3). Sans cela, le dernier appareil à écrire effacerait la progression des autres.
- **Entrées non fiables** : l'avatar vient du fournisseur OAuth ; seule une adresse https est gardée, et les contraintes de la table s'appliquent aussi aux modifications de l'utilisateur.
- **Tests** : 24 tests pgTAP jouent chaque rôle comme l'API (visiteur anonyme, Ada connectée qui tente de lire et modifier les données de Linus). En CI, sur un vrai Postgres Supabase (`supabase db start`, `supabase test db`), avec le lint de la base.

## Journal

- 13 nov. : `supabase/config.toml` (mot de passe d'au moins 10 caractères avec lettres et chiffres, fournisseurs GitHub et Google lus dans des variables d'environnement), migration, tests pgTAP. Mis au point en local sur PostgreSQL 16 avec une émulation minimale de Supabase (rôles, schéma `auth`, `auth.uid()`, droits par défaut) : 24 sur 24.
- 13 nov. : job CI « Base de données (Supabase, RLS) », requis avant publication.
