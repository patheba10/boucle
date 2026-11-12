# Sprint 4.3

**Objectif** : un simulateur Docker dans le terminal Linux, puis le cours Docker et Compose.

| Story | Points | Statut |
|-------|--------|--------|
| #31 US-4.1 Simulateur Docker (enabler) | 8 | Terminé |
| #32 US-4b Cours Docker et Compose | 8 | Terminé |

**Capacité** : 16 points. Le sprint court sur plusieurs sessions : le journal ci-dessous dit où reprendre.

## Conception du simulateur

- `lib/docker/` s'ajoute au terminal Linux : les commandes `docker` et `hadolint` s'y branchent, le reste du terminal (fichiers, `curl`, `cat`) reste le même.
- `catalog.js` : images de base (tailles de Docker Hub), paquets apt, apk, pip et npm avec leur taille.
- `dockerfile.js` : analyse d'un Dockerfile et règles de hadolint (codes et messages réels).
- `engine.js` : construction avec cache de couches, contexte et `.dockerignore`, conteneurs, ports publiés, réseaux et DNS, volumes et montages, registre, Compose.
- `cli.js` : sorties au format de Docker 27 (BuildKit, `docker ps`, `docker images`, Compose v2) et critères déclaratifs.
- Le comportement d'une application (port, routes, modules Python requis, variables d'environnement, base de données) est décrit dans la mise en place du défi et rattaché au fichier source copié dans l'image : l'élève doit vraiment copier le bon fichier, installer les dépendances, écouter sur 0.0.0.0, publier le bon port, mettre les conteneurs sur le même réseau.

## Journal

- 11 nov. : branche `us-4.1/simulateur-docker` créée, conception ci-dessus.
- 11 nov. (soir) : `catalog.js`, `dockerfile.js` (hadolint + vérifications BuildKit), `engine.js` (build avec cache, conteneurs, réseaux, volumes, registre, HTTP), `cli.js` (commande docker, hadolint, critères), `compose.js` écrits. Premier scénario OK : build, cache, run -p, curl, logs. À faire ensuite : tests unitaires (erreurs de build, réseau et DNS, volumes, Compose, registre), panneau latéral du terminal, validateur, puis PR #31.
- 12 nov. (nuit) : 12 tests unitaires Docker, panneau des conteneurs dans le terminal, défis de type fichier (`run`, `editorLang`), coloration des Dockerfile, documentation. PR #31 ouverte. Ensuite : cours Docker et Compose (#32), branche `us-4b/docker`.
- 12 nov. (nuit) : PR #42 (simulateur) fusionnée. Branche `us-4b/docker` : cours enregistré (`courses/docker.js`, nav), chapitre 1 écrit et validé (dk-01 à dk-03). Prévu : dk-04 à dk-06 images (Dockerfile, cache et .dockerignore, images légères et sûres), dk-07 et dk-08 réseaux et volumes, dk-09 Compose, dk-10 registres et CI, dk-11 incident, dk-12 entretien.
- 12 nov. (nuit) : cours complet, dk-01 à dk-12, validé (656 vérifications), tests unitaires et e2e verts. PR du cours puis release 0.11.0.

## Livré

- Simulateur Docker branché sur le terminal Linux (PR #42) : construction avec cache, hadolint, conteneurs, réseaux, volumes, registre, Compose. 12 tests unitaires.
- Cours Docker et Compose (PR #43) : 12 leçons, 11 défis dont 3 fichiers écrits dans l'éditeur (deux Dockerfile, un `compose.yaml`), 26 questions de quiz.
- Version 0.11.0.

## Rétrospective

**Ce qui a marché**
- Le simulateur avant le contenu : chaque défi s'est écrit en quelques minutes une fois le moteur testé.
- Lire la transcription de chaque solution. Elle a montré des traces d'erreur qui ne correspondaient pas au code de l'application (numéros de ligne, variable), maintenant alignés, et un `ping` absent d'Alpine.
- Le validateur a attrapé une variable hors de portée dans le moteur (`fileExe`) dès le premier extrait qui l'utilisait.

**Ce qui a coincé**
- Le sprint a couru sur plusieurs sessions, coupées par la limite d'utilisation. À une reprise, un fichier déjà écrit (`catalog.js`) a été écrasé par une nouvelle version avant que l'état du dépôt soit relu. Git l'a restauré aussitôt.

**On change**
- À chaque reprise : lire le journal du sprint et `git status` avant d'écrire quoi que ce soit, et committer à la fin de chaque étape, même en cours de story.
