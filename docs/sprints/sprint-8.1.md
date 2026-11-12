# Sprint 8.1

**Objectif** : ouvrir l'étape 7 (hardware et embarqué) avec les bases de l'électronique.

| Story | Points | Statut |
|-------|--------|--------|
| #82 US-8a Électronique : du courant au transistor | 8 | Terminé |

## Conception

- Étape découpée en quatre stories (#82 à #85, milestone 7) : électronique, logique numérique, C pour microcontrôleur, outils et TinyML.
- Nouveau cours « Électronique » (`elec`, route `#electronique`) en Python pur : aucun paquet à charger, donc il tourne hors ligne et entre dans le test de parité navigateur même en local.
- Les « calculateurs interactifs » du plan deviennent des défis de dimensionnement : chaque fonction écrite par l'élève est un calculateur réutilisable (résistance de LED, résistance de base, choix d'un MOSFET, autonomie sur batterie), et le résultat est une valeur qu'on peut acheter (série E12, puissances nominales). Les fonctions `e12_au_dessus` et `e12_en_dessous` sont fournies dans le code de départ là où elles servent.
- Pour voir le circuit, chaque leçon renvoie au simulateur Falstad (gratuit, dans le navigateur) et à une plaque d'essai.
- Constat pour #84 : JSCPP, l'interpréteur C++ du site, ne gère ni `struct`, ni `enum`, ni `volatile`, ni `<cstdint>`, et lève une erreur au débordement d'un entier non signé. Il ne suffira pas pour le C embarqué : à étudier au sprint 8.3.

## Journal

- 12 nov. : cours en 12 leçons (deux chapitres : les bases, les composants) et entretien ; 11 défis. Sorties attendues calculées par script ; les valeurs des MOSFET ont été recoupées avec leurs datasheets (AO3400 : 32 mΩ à 2,5 V). 944 vérifications, 94 tests unitaires, 15 tests de bout en bout hors ligne, parité navigateur comprise.

## Revue de sprint

| Story | Points | Livré |
|-------|--------|-------|
| #82 Électronique | 8 | Oui |

Vélocité : 8 points sur 8. Version 0.22.0.

## Rétrospective

**Ce qui a marché.** Des défis qui produisent une valeur achetable plutôt qu'un nombre brut ; le Python pur, qui rend tout le cours vérifiable hors ligne.

**Ce qui a coincé.** Une valeur de datasheet approximative dans un premier jet (AO3400) : les chiffres de composants réels se vérifient comme le reste.

**À essayer.** Pour la logique numérique (#83), simuler les circuits porte par porte, et réutiliser ces simulations pour les registres du C embarqué.
