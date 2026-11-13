# Sprint 16.3

**Objectif** : retrouver sa progression sur tous ses appareils, sans jamais perdre ce qu'on a réussi.

| Story | Points | Statut |
|-------|--------|--------|
| #157 E-3 Synchronisation de la progression | 8 | Terminé |

## Conception

- **Fusion plutôt qu'écrasement** (`fusionner`, fonction pure) : deux appareils ont pu avancer chacun de leur côté, hors ligne ou avant la connexion. Ce qui est réussi s'additionne : leçons, quiz, exercices, défis, étapes et jalons cochés, questions de certif vues, jours d'activité. Les XP gardent le maximum : on ne peut pas savoir quelle part est commune, et additionner compterait deux fois. Pour le code écrit et la dernière leçon ouverte, l'état le plus récent l'emporte. En révision espacée, si les deux appareils suivent la même question, on garde la série la plus courte, la plus prudente.
- **Concurrence optimiste** : chaque écriture porte la révision lue ; si un autre appareil a écrit entre-temps, la base refuse (40001). Le client relit, fusionne et réessaie, trois fois au plus.
- **Rythme** : à la connexion, lecture, fusion, et envoi seulement si la fusion apporte du neuf. Ensuite, chaque sauvegarde déclenche un envoi groupé deux secondes plus tard. Au retour du réseau, ou quand on revient sur l'onglet, on resynchronise. Hors ligne, rien n'est perdu : la progression reste dans le navigateur et part au retour du réseau.
- **Un navigateur partagé** : la progression porte l'identifiant du compte. Une progression laissée par un autre compte n'est pas mélangée à celle de la personne qui se connecte ; une progression anonyme est adoptée par le premier compte connecté.
- **Tests** : unitaires sur la fusion et sur des scénarios complets avec une base simulée (connexion, rien à réécrire, autre compte, conflit, réseau coupé), puis un test e2e qui provoque un vrai conflit entre deux « appareils » via l'API simulée.

## Journal

- 13 nov. : `lib/synchro.js`, sauvegarde « silencieuse » dans `lib/state.js` (un état venu du compte ne repart pas aussitôt et garde son horodatage), état de la synchronisation en bas de page.
- 13 nov. : `render()` lit l'état de la synchronisation dès le premier affichage, avant que la fin du module ait été exécutée : variables déclarées avec `var` pour éviter l'erreur de zone morte temporelle de `let`.
- 13 nov. : 140 tests unitaires, 31 e2e verts.
- 13 nov. : PR #161, CI verte (dont CodeQL et la base Supabase). Fusionnée ; publiée en 0.45.0.

## Revue de sprint

8 points livrés sur 8 (PR #161).
