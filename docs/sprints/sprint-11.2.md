# Sprint 11.2

**Objectif** : la révision espacée des quiz (audit #3).

| Story | Points | Statut |
|-------|--------|--------|
| #116 A-2 Révision espacée des quiz | 5 | Terminé |

## Conception

- Logique pure dans `lib/revision.js`, testée à part : une question ratée dans un quiz entre en révision pour le lendemain ; chaque bonne réponse l'espace (J+1, J+3, J+7) ; trois réussites de suite la font sortir ; une erreur la renvoie au début. Les dates se calculent en UTC (pas de décalage à l'heure d'été).
- L'état vit dans la progression (`S.revision`, clé « leçon/question »). L'accueil affiche une carte « Révisions » quand une question est due (ou la date de la prochaine) ; la page `#revision` présente les questions dues une par une, les plus en retard d'abord, avec l'explication et un lien vers la leçon.

## Journal

- 12 nov. : module, interface et tests (unitaires pour le calendrier, de bout en bout pour le parcours complet : erreur dans un quiz, trois révisions en avançant l'horloge, sortie de la liste). 1 118 vérifications, 105 tests unitaires, 18 tests de bout en bout.

## Revue de sprint

| Story | Points | Livré |
|-------|--------|-------|
| #116 Révision espacée des quiz | 5 | Oui |

Vélocité : 5 points sur 5. Version 0.34.0.

## Rétrospective

**Ce qui a marché.** Séparer la règle (fonctions pures) de l'affichage : le calendrier se teste en millisecondes.

**Ce qui a coincé.** Rien.

**À essayer.** #117 : des indices progressifs, en gardant la compatibilité avec le champ `hint` existant.
