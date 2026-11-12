# Sprint 5.3

**Objectif** : préparer les certifications AWS Cloud Practitioner et Solutions Architect Associate avec des examens blancs.

| Story | Points | Statut |
|-------|--------|--------|
| #63 US-5.2 Moteur d'examens blancs (enabler) | 3 | En cours |
| #56 US-5c Préparation aux certifications AWS | 5 | À faire |

**Capacité** : 8 points.

## Conception

- Format vérifié le 12 nov. 2026 sur les pages officielles : CLF-C02 (65 questions, 90 min, 100 USD) et SAA-C03 (65 questions, 130 min, 150 USD), toujours les versions en vigueur. Poids des domaines et scores minimaux (700 et 720) d'après les guides d'examen.
- `lib/exam.js` (pur, testable sous Node) : banque par certification et par domaine, questions à choix unique ou multiple ; quotas par domaine selon les poids officiels (plus fort reste, bornés par la banque) ; tirage déterministe par graine, options mélangées ; correction sans point partiel ; score linéaire 100-1000 (AWS ne publie pas sa mise à l'échelle, on le dit à l'élève) ; contrôle de structure des banques pour `npm run validate`.
- `lib/examview.js` : page des certifications, page d'une certification (domaines, progression, historique), entraînement par domaine avec correction immédiate, examen blanc chronométré (grille de navigation, marque pour revoir, confirmation de fin, fin automatique au temps écoulé, reprise après rechargement), résultat par domaine et revue des erreurs. Progression dans `S.certs`.
- Banques : questions originales, jamais copiées d'examens réels ; au moins un examen complet tirable en respectant les poids.

## Journal

- 12 nov. : issue #63 et branche `us-5.2/examens`. Moteur, vues, styles et 4 tests unitaires écrits ; parcours vérifié dans Chromium (bureau et mobile, sans débordement). Une revue des captures a ajouté la mention « ton choix » sur les réponses de l'élève : sans elle, une réponse multiple incomplète semblait juste. Le moteur part seul en PR ; les banques suivent dans #56.
