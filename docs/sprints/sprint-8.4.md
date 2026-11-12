# Sprint 8.4

**Objectif** : les outils du métier et le TinyML, puis la roadmap Embarqué ; clore l'étape 7.

| Story | Points | Statut |
|-------|--------|--------|
| #85 US-8d Outils, datasheets et TinyML | 5 | Terminé |

## Conception

- Plutôt qu'un nouveau cours, un chapitre « Outils et TinyML » du cours C embarqué : les mêmes défis en C, vérifiés contre gcc. L'entretien reste la dernière leçon du cours.
- Lire une datasheet : le registre `ctrl_meas` du BME280, à assembler depuis la carte des registres. Instruments : décoder une capture d'analyseur logique (UART), y compris l'erreur de trame et l'octet parasite qui suit, comme un vrai récepteur.
- TinyML : la couche dense quantifiée int8 telle que l'exécute LiteRT for Microcontrollers, écrite en C ; elle prolonge les leçons de quantification du cours de deep learning (dl-17, dl-18).
- Roadmap « Embarqué et IoT » (identifiant `iot`, puisque `embarque` est déjà la route du cours) : 5 paliers, 9 étapes, reliées aux leçons des trois cours de l'étape et à TinyML.

## Journal

- 12 nov. : chapitre en 4 leçons (3 défis), roadmap, page des roadmaps passée à quatre parcours. Deux réglages après calcul : le multiplicateur de la couche int8 saturait toutes les sorties (0,0125 → 0,003), et un octet parasite après l'erreur de trame est désormais annoncé dans l'énoncé. 1 024 vérifications, 100 tests unitaires, tests de bout en bout.
- 12 nov. : un test de bout en bout de l'examen blanc a échoué une fois puis réussi deux fois sans changement : noté dans l'audit (#29).

## Revue de sprint

| Story | Points | Livré |
|-------|--------|-------|
| #85 Outils, datasheets et TinyML | 5 | Oui |

Vélocité : 5 points sur 5. Version 0.25.0. L'étape 7 est terminée : trois cours (Électronique, Logique numérique, C embarqué), 39 leçons, et la roadmap Embarqué et IoT.

## Rétrospective de l'étape 7

**Ce qui a marché.** Mesurer l'outil avant d'écrire (JSCPP insuffisant, d'où minic) ; vérifier chaque sortie contre une référence (gcc) ; des cours en Python pur ou en C qui tournent aussi hors ligne.

**Ce qui a coincé.** La barre de navigation déborde avec 20 cours et pages (audit #27) ; un test e2e instable (audit #29).

**À essayer.** Étape 8 (entretiens) : réutiliser les questions d'entretien déjà écrites dans chaque cours, et ajouter les structures de données et les patterns d'algorithmes en défis Python.
