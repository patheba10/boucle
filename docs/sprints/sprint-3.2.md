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

## Livré

- Moteur des workflows GitHub Actions : lint avec numéros de ligne, évaluateur d'expressions, simulation d'événements, graphe du pipeline, 14 tests unitaires.
- Cours CI/CD, chapitres 1 à 3 : 6 leçons, dont un exercice de diagnostic et un guide pour lancer son premier workflow sur GitHub.
- Chapitre « Collaborer sur GitHub » : 5 leçons, 2 défis dans le terminal Git, 3 leçons de pratique sur GitHub, mises en situation tirées de Boucle.

## Rétrospective

**Ce qui a marché**
- Simuler les événements plutôt qu'exécuter : un défi comme « sur une PR, deploy est sauté » se vérifie en quelques millisecondes, sans runner ni compte.
- Les critères écrits sous forme de scénarios se lisent comme une spécification : le libellé du critère dit à l'élève ce que son pipeline doit faire.
- Construire le moteur avant le contenu : les six exercices CI/CD sont passés au validateur du premier coup.

**Ce qui a coincé**
- La CI de la PR #23 est restée en file d'attente plus d'une heure côté GitHub, sans job ni erreur. Fermer puis rouvrir la PR a créé une nouvelle exécution, qui est passée en 5 minutes.
- Le sprint mélangeait trois stories sur une même branche de travail : il a fallu découper les commits et empiler deux PR.
- Les numéros de version des actions évoluent vite (checkout est passé en v7 en juin 2026, avec un blocage des « pwn requests »). Les leçons utilisent les versions actuelles ; la CI de Boucle est encore en checkout v4.

**On change**
- Une branche par story dès le début, même quand les stories se suivent.
- Mettre à jour les actions de la CI de Boucle au chapitre 6 (sécurité de la chaîne d'approvisionnement, Dependabot) : ce sera la mise en situation.
- Si une exécution reste en file d'attente plus de 20 minutes, la relancer en rouvrant la PR.
