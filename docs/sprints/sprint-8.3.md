# Sprint 8.3

**Objectif** : le C des microcontrôleurs, exécuté dans le navigateur et vérifié contre gcc.

| Story | Points | Statut |
|-------|--------|--------|
| #84 US-8c C pour microcontrôleur | 13 | Terminé |

## Conception

- Mesure d'abord, comme prévu à la rétrospective 8.2 : JSCPP ne gère ni `struct`, ni `enum`, ni `volatile`, ni `<cstdint>`, et refuse le débordement des non signés. Trois options pesées dans l'ADR 0002 (compilateur wasm, simulateur AVR, interpréteur maison). Choix : **minic**, un interpréteur C en Python sur pycparser 2.22, exécuté par Pyodide.
- Garde-fou : `npm run validate` compile chaque défi et chaque extrait avec gcc (`-Wall -Wextra -Werror -fwrapv`) et exige la même sortie qu'avec minic. minic suit donc le modèle LP64 de gcc (tailles, alignements, petit-boutiste).
- Le matériel est un en-tête C commun aux deux, `mcu.h` : structures de registres façon CMSIS (GPIO, TIM, ADC, USART) et fonctions `sim_…` appelées par les tests (appliquer BSRR, faire avancer un timer et appeler l'ISR, terminer une conversion).
- Défis au format « fonctions de l'élève + main des tests » ; « Exécuter » lance le code avec ce main.

## Journal

- 12 nov. : minic (préprocesseur, types, mémoire octet par octet, structures, unions, pointeurs de fonction, printf, bibliothèque standard utile), mesuré contre gcc sur trois programmes de couverture : sorties identiques. Un bogue trouvé tout de suite : une instruction-expression valant 0 était prise pour un signal de contrôle et terminait la fonction.
- 12 nov. : cours « C embarqué » en 13 leçons et 12 défis. Trois corrections après comparaison avec gcc : la somme NMEA de l'exemple (0x31, pas 0x1D), une constante trop large refusée par `-Werror`, et un test qui dépendait de l'ordre d'évaluation des arguments (non spécifié en C) ; l'extrait sur la comparaison signé/non signé est marqué `avertissement`.
- 12 nov. : parité Pyodide vérifiée en local avec la roue pycparser : les 12 défis passent dans le navigateur en 9 s. 1 014 vérifications, 100 tests unitaires, 15 tests de bout en bout hors ligne.
- 12 nov. : PR #90, les trois jobs verts ; en CI, les 12 défis C passent aussi dans le vrai Pyodide (test de parité en ligne). Fusionnée ; version 0.24.0.

## Revue de sprint

| Story | Points | Livré |
|-------|--------|-------|
| #84 C pour microcontrôleur | 13 | Oui (PR #90) |

Vélocité : 13 points sur 13. Version 0.24.0.

## Rétrospective

**Ce qui a marché.** Comparer à gcc à chaque étape : trois erreurs de contenu repérées avant de publier, dont une qu'une relecture n'aurait pas vue (l'ordre d'évaluation). Un en-tête de matériel en C plutôt qu'un simulateur caché dans l'interpréteur : le même code tourne partout.

**Ce qui a coincé.** La somme de contrôle NMEA écrite de mémoire était fausse ; les constantes tirées de mémoire se calculent ou se vérifient.

**À essayer.** Pour #85 (outils et TinyML), relier la boucle : modèle LiteRT for Microcontrollers, quantifié à l'étape 6, et la roadmap Embarqué.
