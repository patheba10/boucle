# ADR 0002 — Un interpréteur C écrit en Python pour le cours d'embarqué

**Statut** : accepté, 12 novembre 2026
**Contexte** : étape 7 (hardware et embarqué), story #84

## Problème

Le cours de C embarqué doit faire écrire du vrai C de microcontrôleur : `struct` de registres, `volatile`, `uint8_t` et `uint32_t`, masques de bits, débordements des non signés, pointeurs de fonction pour les interruptions. Boucle est un site statique : le code doit tourner dans le navigateur, et chaque exercice doit être vérifié de la même façon en CI.

L'interpréteur C++ déjà utilisé (JSCPP 2.0.6) a été mesuré avant de décider. Il ne gère ni `struct`, ni `enum`, ni `volatile`, ni `<cstdint>`, et il lève une erreur au lieu de faire le tour quand un entier non signé déborde. Il ne convient pas.

## Options étudiées

1. **Un compilateur C en WebAssembly** (clang ou tcc compilés en wasm). C'est le vrai compilateur, mais il pèse des dizaines de mégaoctets pour clang, doit être servi depuis un CDN autorisé, et ne livre aucun paquet stable et versionné à charger simplement. Il faudrait aussi un éditeur de liens et un environnement d'exécution wasm.
2. **Un simulateur de microcontrôleur** comme avr8js (le moteur de Wokwi). Il exécute un vrai binaire AVR, mais il faut d'abord compiler avec avr-gcc, donc un serveur.
3. **Un interpréteur C écrit pour Boucle** (minic), en Python sur pycparser, exécuté par Pyodide comme le reste du site. pycparser est un analyseur C99/C11 éprouvé, déjà présent dans la distribution Pyodide.

## Décision

Option 3, avec un garde-fou : chaque défi et chaque extrait du cours est aussi compilé par gcc en CI (`-Wall -Wextra -Werror -fwrapv`), et `npm run validate` exige que gcc et minic affichent exactement la même chose. minic suit le modèle LP64 de gcc sur x86-64 (tailles, alignements, ordre des octets) pour que cette comparaison ait un sens.

Les périphériques sont décrits par un en-tête C, `mcu.h`, commun aux deux : des structures de registres façon CMSIS (STM32) et des fonctions `sim_…` qui jouent le matériel. On n'intercepte pas les accès mémoire, ce que gcc ne permettrait pas : les tests font avancer le matériel en appelant ces fonctions.

## Conséquences

- Démarrage léger : le paquet pycparser ne pèse qu'environ 120 Ko de plus que Python, déjà chargé par le site. Un défi s'exécute en une fraction de seconde ; une boucle infinie est arrêtée au-delà de 2 millions d'étapes.
- minic couvre ce que le cours utilise, pas tout le C : pas de `goto`, pas de champs de bits, pas d'initialisation de tableau à plusieurs dimensions sans accolades. Ces cas donnent un message clair en français.
- Les exercices évitent ce que le C laisse non spécifié, comme l'ordre d'évaluation des arguments d'une fonction : minic évalue de gauche à droite, gcc souvent de droite à gauche.
- Les périphériques s'utilisent en mode non bloquant (lancer, tester, lire) plutôt qu'en boucle d'attente, puisque le matériel simulé n'avance que lorsque les tests l'appellent. C'est aussi la bonne pratique sur une vraie puce.
- Les tests unitaires (`tests/unit/minic.test.mjs`) comparent minic à gcc sur des programmes qui couvrent le langage.
