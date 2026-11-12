/* Cours Docker — chapitre 3 : réseaux et données. */
import { R, API, MAIN_PY_DB, REQS_DB, DB_APP, apiSetup } from "./commun.js";

const URL_DB = "postgresql://boutique:s3cret@db:5432/boutique";

export default [
  {
    id: "dk-07", section: "Réseaux et données", title: "Réseaux : relier des conteneurs", xp: 95,
    theory: R`<p>Chaque conteneur a sa propre interface réseau et sa propre boucle locale. Dans le conteneur de l'API, @@localhost@@ désigne <strong>l'API elle-même</strong>, pas la base de données ni la machine hôte : l'erreur de débutant la plus fréquente.</p>
<ul><li>le réseau par défaut, @@bridge@@, relie les conteneurs mais <strong>sans résolution de noms</strong> ;</li><li>sur un <strong>réseau défini par l'utilisateur</strong> (@@docker network create boutique@@), Docker fournit un DNS : chaque conteneur joint les autres par leur <strong>nom</strong>, comme @@db:5432@@ ;</li><li>@@--network boutique@@ au lancement, ou @@docker network connect boutique db@@ pour un conteneur existant ;</li><li>seuls les ports <strong>publiés</strong> (@@-p@@) sont accessibles depuis la machine hôte. La base n'a pas à être publiée : seule l'API lui parle, à l'intérieur du réseau.</li></ul>
~~~sh
docker network create boutique
docker run -d --name cache --network boutique redis:7-alpine
docker run --rm --network boutique alpine:3.20 ping -c 1 cache
! docker run --rm alpine:3.20 ping -c 1 cache
docker network ls
~~~
<p>Compose (chapitre suivant) crée ce réseau pour toi : c'est pour cela que les services s'y appellent par leur nom.</p>`,
    quiz: [
      { q: "Dans le conteneur api, DATABASE_URL vaut postgresql://…@localhost:5432/…, et la base tourne dans le conteneur db. Que se passe-t-il ?", options: ["Ça marche", "Connexion refusée : localhost désigne le conteneur api lui-même", "Docker redirige automatiquement", "La base est créée dans api"], answer: 1, explain: "Il faut joindre db par son nom, sur un réseau commun." },
      { q: "Faut-il publier le port 5432 de la base pour que l'API s'y connecte ?", options: ["Oui, toujours", "Non : sur un réseau Docker commun, les conteneurs se parlent directement ; publier exposerait la base à l'extérieur", "Seulement en production", "Seulement avec Compose"], answer: 1, explain: "On ne publie que ce qui doit être joint depuis l'extérieur : ici, l'API." }
    ],
    challenge: {
      prompt: R`<p>Une base PostgreSQL tourne déjà dans le conteneur @@db@@ (utilisateur @@boutique@@, mot de passe @@s3cret@@, base @@boutique@@), et l'image @@boutique-api:1.0@@ est construite. L'API lit l'adresse de la base dans la variable @@DATABASE_URL@@.</p><ol><li>crée un réseau @@boutique@@ et branches-y @@db@@ ;</li><li>lance l'API dans un conteneur @@api@@ sur ce réseau, port @@8000@@ publié, avec @@DATABASE_URL=${URL_DB}@@ ;</li><li>ne publie pas le port de la base ;</li><li>termine par @@curl -s localhost:8000/health@@.</li></ol>`,
      setup: apiSetup({ files: { [API + "/main.py"]: MAIN_PY_DB, [API + "/requirements.txt"]: REQS_DB }, app: DB_APP, images: ["postgres:16"], commands: ["#docker build -q -t boutique-api:1.0 " + API, "#docker run -d --name db -e POSTGRES_USER=boutique -e POSTGRES_PASSWORD=s3cret -e POSTGRES_DB=boutique postgres:16"] }),
      checks: { networks: ["boutique"], containers: { db: { state: "running", network: "boutique" }, api: { state: "running", network: "boutique", ports: ["8000:8000"], env: { DATABASE_URL: URL_DB } } }, outputHas: ['{"status":"ok"}'] },
      solution: ["docker ps", "docker network create boutique", "docker network connect boutique db", "docker run -d --name api --network boutique -p 8000:8000 -e DATABASE_URL=" + URL_DB + " boutique-api:1.0", "docker logs api", "curl -s localhost:8000/health"],
      hint: "docker network create boutique ; docker network connect boutique db ; puis docker run -d --name api --network boutique -p 8000:8000 -e DATABASE_URL=… boutique-api:1.0. Si l'API s'arrête, docker logs api dit pourquoi."
    }
  },
  {
    id: "dk-08", section: "Réseaux et données", title: "Volumes et montages", xp: 95,
    theory: R`<p>Le système de fichiers d'un conteneur disparaît avec lui. Tout ce qui doit survivre (une base de données, des fichiers envoyés par les utilisateurs) va ailleurs :</p>
<ul><li>un <strong>volume nommé</strong>, géré par Docker : @@-v pgdata:/var/lib/postgresql/data@@. Il survit à @@docker rm@@, se sauvegarde, se partage entre conteneurs. C'est le bon choix pour les données ;</li><li>un <strong>montage de dossier</strong> (bind mount) : @@-v "$PWD/site":/usr/share/nginx/html:ro@@ rend un dossier de l'hôte visible dans le conteneur. Idéal en développement : on modifie le fichier, le conteneur le voit tout de suite. @@:ro@@ le monte en lecture seule ;</li><li>@@docker volume ls@@, @@docker volume inspect@@, @@docker volume rm@@ (impossible tant qu'un conteneur l'utilise).</li></ul>
~~~sh
docker run -d --name db -e POSTGRES_PASSWORD=pw -v pgdata:/var/lib/postgresql/data postgres:16
docker logs db | tail -1
docker rm -f db
docker run -d --name db -e POSTGRES_PASSWORD=pw -v pgdata:/var/lib/postgresql/data postgres:16
docker logs db | head -2
docker volume ls
~~~
<p>Au second lancement, PostgreSQL trouve ses données (« Skipping initialization ») : rien n'est perdu. Attention, @@docker compose down -v@@ et @@docker volume rm@@ suppriment <strong>vraiment</strong> les données.</p>`,
    quiz: [
      { q: "Tu supprimes le conteneur db (docker rm -f db). Que deviennent les données du volume pgdata ?", options: ["Elles sont perdues", "Elles restent dans le volume : un nouveau conteneur qui monte pgdata les retrouve", "Elles sont copiées dans l'image", "Elles vont dans /tmp"], answer: 1, explain: "C'est tout l'intérêt d'un volume : son cycle de vie est indépendant du conteneur." },
      { q: "Pour servir en développement un site que tu modifies en continu, que choisir ?", options: ["Reconstruire l'image à chaque modification", "Un montage du dossier de l'hôte dans le conteneur", "Un volume nommé", "docker cp toutes les minutes"], answer: 1, explain: "Le bind mount montre les fichiers de l'hôte en direct. En production, on construit plutôt une image qui contient le site." }
    ],
    challenge: {
      prompt: R`<p>Deux besoins pour l'équipe :</p><ol><li>servir le site @@~/site@@ avec @@nginx:1.27-alpine@@ dans un conteneur @@site@@, port @@8080@@, en montant le dossier sur @@/usr/share/nginx/html@@ <strong>en lecture seule</strong> ;</li><li>lancer PostgreSQL 16 dans un conteneur @@db@@ (mot de passe @@s3cret@@) dont les données sont dans un volume nommé @@pgdata@@.</li></ol><p>Ensuite, modifie le titre de @@~/site/index.html@@ en @@<h1>Soldes</h1>@@ et termine par @@curl -s localhost:8080@@ : la modification doit apparaître sans relancer le conteneur.</p>`,
      setup: { files: { "/home/eleve/site/index.html": "<!DOCTYPE html>\n<h1>Boutique</h1>\n<p>Bienvenue</p>\n" }, docker: { images: ["nginx:1.27-alpine", "postgres:16"] }, cwd: "/home/eleve/site" },
      checks: {
        containers: { site: { state: "running", ports: ["8080:80"], bind: { "/home/eleve/site": "/usr/share/nginx/html" }, readOnly: ["/usr/share/nginx/html"] }, db: { state: "running", volume: { pgdata: "/var/lib/postgresql/data" } } },
        volumes: ["pgdata"], outputHas: ["<h1>Soldes</h1>"]
      },
      solution: ["docker run -d --name site -p 8080:80 -v \"$PWD\":/usr/share/nginx/html:ro nginx:1.27-alpine", "docker run -d --name db -e POSTGRES_PASSWORD=s3cret -v pgdata:/var/lib/postgresql/data postgres:16", "sed -i 's|<h1>Boutique</h1>|<h1>Soldes</h1>|' index.html", "curl -s localhost:8080"],
      hint: "-v \"$PWD\":/usr/share/nginx/html:ro pour le site (tu es dans ~/site) ; -v pgdata:/var/lib/postgresql/data pour la base. sed -i modifie le fichier sur l'hôte, nginx le sert aussitôt."
    }
  }
];
