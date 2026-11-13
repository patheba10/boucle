# Sprint 16.4

**Objectif** : un espace personnel (profil, tableau de bord, sécurité), et de quoi mettre les comptes en service.

| Story | Points | Statut |
|-------|--------|--------|
| #158 E-4 Espace personnel et tableau de bord | 5 | En cours |

## Conception

- **Mon compte** (`#compte`) : en tête, le nom, l'avatar, le moyen de connexion et quatre chiffres (XP et niveau, série de jours, leçons terminées, révisions du jour). Le tableau de bord montre la roadmap suivie avec sa progression, les cours commencés et les projets en cours. Les chiffres sont calculés par les mêmes fonctions que le reste du site : une seule définition de « terminé ».
- **Profil** : nom, objectif (DevOps, Cloud, ML, IoT) et roadmap suivie, modifiables. La base n'autorise que ces colonnes, et seulement sur sa propre ligne.
- **Sécurité** : changer de mot de passe pour un compte e-mail (le fournisseur s'en charge pour GitHub et Google), se déconnecter.
- **Supprimer mon compte** (Loi 25) : il faut écrire SUPPRIMER pour activer le bouton. La base efface l'utilisateur, et profil et progression suivent en cascade. La copie du navigateur est effacée aussi, pour qu'un ordinateur partagé ne garde rien.
- **Mise en service** : `docs/comptes.md` guide pas à pas (projet Supabase au Canada, migrations, URLs de redirection, applications OAuth GitHub et Google, SMTP, variables GitHub et Vercel, vérifications). Un workflow « Base de données » applique les migrations à la production après fusion sur `main`, seulement si le projet est configuré.

## Journal

- 13 nov. : page Mon compte, `majProfil` et `supprimerCompte` dans `lib/compte.js`, tableau de bord calculé dans `main.js`.
- 13 nov. : la classe `.compte` servait déjà au lien de l'en-tête ; le test e2e l'a signalé (deux éléments trouvés). La page utilise `.espace`.
- 13 nov. : 140 tests unitaires, 32 e2e.
