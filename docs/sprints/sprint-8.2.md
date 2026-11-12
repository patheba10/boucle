# Sprint 8.2

**Objectif** : la logique numérique, des portes au processeur, comme pont entre l'électronique et le C embarqué.

| Story | Points | Statut |
|-------|--------|--------|
| #83 US-8b Logique numérique | 5 | Terminé |

## Conception

- Nouveau cours « Logique numérique » (`logique`, route `#logique`), en Python pur comme l'électronique : vérifiable hors ligne et dans le test de parité.
- Les circuits sont simulés au niveau où on les dessine : portes sur des bits, additionneurs sur des listes de bits, bascules et registres comme objets à état, machine à états avec un compteur de temps.
- Les défis préparent le C embarqué : opérateurs bit à bit, complément à deux et dépassement, registre à décalage chaîné (74HC595), compteur et débordement (timers), encodeur de priorité (interruptions), drapeaux ZNCV d'une ALU.
- Le défi NAND compte les portes utilisées en remplaçant `nand` dans les tests : il faut 1, 2, 3 et 4 NAND pour NON, ET, OU et OU exclusif.

## Journal

- 12 nov. : cours en 10 leçons et 9 défis ; deux scénarios du feu tricolore recalibrés après calcul (un appui pendant le rouge ne testait rien). 967 vérifications, 94 tests unitaires, 15 tests de bout en bout hors ligne, parité comprise.

## Revue de sprint

| Story | Points | Livré |
|-------|--------|-------|
| #83 Logique numérique | 5 | Oui |

Vélocité : 5 points sur 5. Version 0.23.0.

## Rétrospective

**Ce qui a marché.** Écrire les tests en scénarios de temps (chaîne « vvvvoorrrr ») : une ligne lisible qui montre tout le comportement de la machine à états.

**Ce qui a coincé.** Un scénario de test sans effet (bouton pressé pendant le rouge) n'a été repéré qu'en lisant la sortie calculée : relire chaque sortie attendue, pas seulement vérifier qu'elle passe.

**À essayer.** Pour le C embarqué (#84), choisir le moteur d'exécution avant d'écrire une ligne de cours, et le mesurer contre gcc.
