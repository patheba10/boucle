# Sprint 10.2

**Objectif** : les projets capstone des roadmaps Cloud et ML.

| Story | Points | Statut |
|-------|--------|--------|
| #107 US-10b Capstones Cloud et ML | 5 | Terminé |

## Conception

- Même format que les projets DevOps. Comme prévu à la rétrospective 10.1, chaque projet a des critères chiffrés : temps d'erreur lors d'une bascule, coût mensuel documenté, latence de l'API au 95e centile, perte d'exactitude après quantification, taille du modèle.
- Cloud : une application web hautement disponible sur deux zones (Terraform, ALB, Auto Scaling, RDS Multi-AZ, CloudFront, reprise testée dans une autre région) ; un traitement de fichiers événementiel serverless (S3, SQS, Lambda, DynamoDB, DLQ, idempotence).
- ML : du jeu de données à l'API de prédiction surveillée (pipeline scikit-learn sans fuite, MLflow, FastAPI, rapport de dérive, fiche du modèle) ; un classifieur d'images pour mobile, de Keras à LiteRT int8 sur un vrai appareil.

## Journal

- 12 nov. : quatre projets, reliés aux leçons AWS, Terraform, System design, SQL, API et Deep learning. Les accents graves sont convertis en @@ @@ à l'écriture (règle de validation du sprint 10.1). 1 116 vérifications, tests de bout en bout.
- 12 nov. : PR #111, les trois jobs verts. Fusionnée ; version 0.31.0.

## Revue de sprint

| Story | Points | Livré |
|-------|--------|-------|
| #107 Capstones Cloud et ML | 5 | Oui (PR #111) |

Vélocité : 5 points sur 5. Version 0.31.0.

## Rétrospective

**Ce qui a marché.** Un format de données stable : quatre projets sans toucher au code.

**Ce qui a coincé.** Rien.

**À essayer.** #108 : relier la progression des roadmaps aux leçons terminées, en plus des cases cochées à la main.
