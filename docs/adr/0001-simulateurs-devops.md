# ADR 0001 — Simulateurs pour Linux, Docker et Kubernetes

**Statut** : accepté, 11 novembre 2026
**Contexte** : étape 4 (DevOps)

## Problème

Les cours DevOps demandent de pratiquer un shell Linux, Docker et Kubernetes. Boucle est un site statique, sans serveur, utilisé aussi sur téléphone et sur un réseau filtré. Les exercices doivent être vérifiés automatiquement, de la même façon dans le navigateur et en CI.

## Options étudiées

1. **Machine Linux émulée dans le navigateur** (v86, CheerpX/WebVM). Un vrai noyau et un vrai Bash. Mais 10 à 30 Mo à télécharger, un démarrage de plusieurs secondes, des performances faibles sur téléphone, pas de Docker ni de Kubernetes, et des vérifications difficiles (il faut lire l'état d'une machine qui tourne). Licence restrictive pour CheerpX.
2. **Serveur de bacs à sable** (conteneurs à la demande). Le vrai outil, mais un backend payant à exploiter et sécuriser : contraire au choix « site statique gratuit ».
3. **Simulateurs en JavaScript**, comme le simulateur Git (étape 3) et le moteur des workflows. Démarrage instantané, déterministes, légers, vérifiables par critères déclaratifs, mêmes octets en CI et dans le navigateur.

## Décision

Option 3, avec deux garde-fous :

- les sorties imitent fidèlement les vrais outils (messages GNU, format de `docker ps`, de `kubectl get`), en anglais comme sur une vraie machine ;
- chaque chapitre a un panneau « Sur ta machine » pour refaire l'exercice pour de vrai (WSL ou Ubuntu, Docker Desktop, kind ou minikube), déjà prévu par la page Installer.

## Conséquences

- Trois enablers : terminal Linux (#29), simulateur Docker (#31), cluster Kubernetes simulé (#33).
- Un simulateur ne couvre qu'un sous-ensemble : chaque commande non prise en charge répond clairement « non simulée ici », sans faire semblant.
- Le shell du simulateur Git reste séparé pour l'instant ; les unifier est noté dans l'audit.
