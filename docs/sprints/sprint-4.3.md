# Sprint 4.3

**Objectif** : un simulateur Docker dans le terminal Linux, puis le cours Docker et Compose.

| Story | Points | Statut |
|-------|--------|--------|
| #31 US-4.1 Simulateur Docker (enabler) | 8 | En cours |
| #32 US-4b Cours Docker et Compose | 8 | À faire |

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
