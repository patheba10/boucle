# Sprint 3.2

**Objectif** : collaborer sur GitHub, puis écrire ses premiers workflows GitHub Actions, vérifiés dans le navigateur.

| Story | Points | Statut |
|-------|--------|--------|
| #22 US-3.1 Exercices de workflows YAML (enabler) | 8 | Terminé |
| #11 US-3b Collaborer sur GitHub | 5 | Terminé |
| #12 US-3c Cours CI/CD, chapitres 1 à 3 (sur 12) | 5 | Terminé (story ouverte jusqu'au chapitre 12) |

**Capacité** : 18 points, un peu au-dessus du sprint 3.1 (16). Les chapitres 4 à 12 du cours CI/CD passent au sprint 3.3.

**Choix techniques**
- YAML lu par js-yaml 4.1.0, copié dans le dépôt (`assets/js/vendor/`) : même code en CI et dans le navigateur, aucun CDN de plus.
- Pas de vrai runner : on vérifie la **structure** du workflow et on **simule** les événements (quels jobs tournent sur une PR, sur un push dans `main`…). C'est ce qu'on attend d'un ingénieur DevOps en entretien : raisonner sur un pipeline avant de le lancer.
- Le cours CI/CD est un cours à part (`#cicd`), affiché juste après Git dans la navigation.
