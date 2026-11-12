# Sprint 3.3

**Objectif** : terminer le cours CI/CD, des tests dans le pipeline jusqu'au projet final et aux questions d'entretien, et appliquer à la CI de Boucle ce que le cours enseigne.

| Story | Points | Statut |
|-------|--------|--------|
| #12 US-3c Cours CI/CD, chapitres 4 à 12 | 8 | Terminé |
| Moteur des workflows : nouveaux critères (enabler, rattaché à #12) | 2 | Terminé |
| CI de Boucle : actions épinglées par SHA, Dependabot (rattaché à #12) | 1 | Terminé |

**Capacité** : 11 points.

**Choix techniques**
- Les leçons citent les versions majeures actuelles des actions (vérifiées le 11 novembre 2026 : checkout v7, setup-python v7, upload-artifact v7, download-artifact v8, cache v6, docker/login v4, metadata v6, build-push v7, configure-aws-credentials v6, setup-terraform v4).
- La CI de Boucle garde ses versions actuelles mais les épingle par SHA : monter de version se fera par les PR de Dependabot, relues une par une, et non en même temps qu'un changement de contenu.
- Diagnostic : les logs d'échec sont reproduits fidèlement (format `##[error]`, codes de sortie 1, 2, 127, 137) et l'exercice consiste à corriger le workflow qui les a produits.

## Livré

- 16 leçons (ci-07 à ci-22), 14 défis YAML vérifiés et simulés, une leçon de questions d'entretien avec 10 réponses modèles.
- Le cours CI/CD est complet : 22 leçons en 12 chapitres.

## Rétrospective

**Ce qui a marché**
- Étendre le moteur avant d'écrire : neuf critères ajoutés en une fois, puis 14 défis passés au validateur, presque tous du premier coup.
- Le moteur a trouvé un vrai bug dans un exemple du cours : `echo "PR : $TITRE"` sans bloc `|` est un YAML invalide, à cause du « : » suivi d'un espace. C'est devenu un exemple de plus pour le chapitre YAML.
- Le moteur vérifie maintenant la vraie CI de Boucle à chaque exécution des tests unitaires.

**Ce qui a coincé**
- Les étapes nommées (`name:`) ne se reconnaissaient plus par leur action dans les scénarios : corrigé, une étape se repère par son nom, son action ou sa commande.
- Sur mobile, les titres longs des leçons CI/CD faisaient déborder le pied de page. Le test e2e ne parcourait pas ces pages : elles sont ajoutées à la liste.

**On change**
- Ajouter systématiquement au test des pages au moins une leçon de chaque nouveau chapitre.
- Relire les PR de Dependabot à leur arrivée : ce sont les premières montées de version de la CI.
