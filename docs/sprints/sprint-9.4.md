# Sprint 9.4

**Objectif** : les entretiens par métier et le comportemental ; clore l'étape 8.

| Story | Points | Statut |
|-------|--------|--------|
| #97 US-9d Entretiens par métier et comportemental | 5 | Terminé |

## Conception

- Comme prévu à la rétrospective 9.3, l'entraînement réutilise le moteur des examens blancs (`lib/exam.js`) : trois banques de type `entretien` (DevOps, SRE et Cloud : 30 questions ; ML et MLOps : 20 ; embarqué et firmware : 20), toutes des mises en situation, avec entraînement par domaine et entretien blanc chronométré. La page Certifs devient « Certifications et entretiens », en deux sections.
- Nouveau cours « Entretiens » (6 leçons de théorie avec quiz) : processus de recrutement, méthode STAR et banque d'histoires, questions comportementales en français et en anglais, présenter un projet technique, entretiens par métier (avec liens vers les entretiens blancs), questions à poser, négociation et suivi.

## Journal

- 12 nov. : banques et cours écrits ; `npm run validate` vérifie les banques (lintCert). Une erreur de guillemets dans la vue des certifications cassait tout le site : seuls les tests de bout en bout l'ont vue (15 échecs). Ajout d'un test unitaire `node --check` sur tout le JavaScript de `public/`, vérifié en réinjectant l'erreur. 1 110 vérifications, 102 tests unitaires, 15 tests de bout en bout.

## Revue de sprint

| Story | Points | Livré |
|-------|--------|-------|
| #97 Entretiens par métier et comportemental | 5 | Oui |

Vélocité : 5 points sur 5. Version 0.29.0. L'étape 8 est terminée : Algorithmique (20 leçons), System design (9), Entretiens (6) et trois entretiens blancs.

## Rétrospective de l'étape 8

**Ce qui a marché.** Des défis qui mesurent la complexité (entrées de 100 000 éléments) et des briques de system design codées ; la réutilisation du moteur d'examen pour les entretiens blancs.

**Ce qui a coincé.** Le bogue de Pyodide sur les longues chaînes d'objets (corrigé au sprint 9.1) et une erreur de syntaxe vue tard : deux trous de test comblés.

**À essayer.** Étape 9 (projets capstone) : des cahiers des charges avec jalons vérifiables, reliés aux roadmaps.
