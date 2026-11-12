/* Cours Docker — chapitre 1 : conteneurs, cycle de vie, images. */
import { R, API, MAIN_PY_ENV, apiSetup } from "./commun.js";

export default [
  {
    id: "dk-01", section: "Premiers pas", title: "Conteneurs et images", xp: 60,
    theory: R`<p>« Ça marche sur ma machine » : Docker règle ce problème en livrant l'application <strong>avec</strong> tout ce dont elle a besoin (Python, bibliothèques, configuration) dans une <strong>image</strong>. Une image est un modèle en lecture seule, fait de <strong>couches</strong> empilées. Un <strong>conteneur</strong> est une image en train de tourner : un processus isolé, avec son propre système de fichiers, son réseau et ses limites de ressources.</p>
<ul><li>Une <strong>machine virtuelle</strong> embarque un système d'exploitation complet et démarre en minutes ; un conteneur partage le noyau de l'hôte et démarre en une fraction de seconde. Moins d'isolation, beaucoup moins de poids ;</li><li>une image s'identifie par un nom et un <strong>tag</strong> : @@python:3.12-slim@@, @@nginx:1.27-alpine@@. Sans tag, Docker prend @@latest@@ ;</li><li>les images viennent d'un <strong>registre</strong>, par défaut Docker Hub.</li></ul>
<p>Les commandes de base :</p>
~~~sh
docker run --rm alpine:3.20 echo bonjour
docker run --rm alpine:3.20 cat /etc/os-release
docker images
docker run -d --name web -p 8080:80 nginx:1.27-alpine
docker ps
curl -s localhost:8080 | head -4
~~~
<p>@@-d@@ lance en arrière-plan, @@--name@@ nomme le conteneur, @@-p 8080:80@@ <strong>publie</strong> le port 80 du conteneur sur le port 8080 de la machine (hôte d'abord, conteneur ensuite). @@--rm@@ supprime le conteneur quand il se termine. @@docker ps@@ liste les conteneurs en marche, @@docker ps -a@@ tous.</p>`,
    setup: R`<p><strong>Sur ta machine</strong> : installe Docker Desktop (Windows, macOS) ou Docker Engine (Ubuntu : <em>docs.docker.com/engine/install/ubuntu</em>), puis @@docker run hello-world@@. Sous Linux, ajoute-toi au groupe @@docker@@ (@@sudo usermod -aG docker $USER@@, puis reconnecte-toi) pour ne pas taper @@sudo@@ à chaque commande.</p>`,
    quiz: [
      { q: "Quelle est la différence entre une image et un conteneur ?", options: ["Aucune", "L'image est le modèle en lecture seule ; le conteneur est une instance de cette image en train de tourner", "Le conteneur est plus gros que l'image", "L'image tourne, le conteneur est stocké"], answer: 1, explain: "Comme une classe et ses objets : une image, autant de conteneurs qu'on veut." },
      { q: "Dans docker run -p 8080:80 nginx, que désigne 8080 ?", options: ["Le port dans le conteneur", "Le port de la machine hôte, redirigé vers le port 80 du conteneur", "Le numéro du conteneur", "La taille de l'image"], answer: 1, explain: "Hôte à gauche, conteneur à droite : on visite http://localhost:8080." },
      { q: "Pourquoi un conteneur démarre-t-il bien plus vite qu'une machine virtuelle ?", options: ["Il est écrit en Go", "Il partage le noyau de l'hôte : pas de système d'exploitation à démarrer, juste un processus isolé", "Il n'a pas de système de fichiers", "Il est compressé"], answer: 1, explain: "C'est aussi pourquoi un conteneur Linux a besoin d'un noyau Linux (WSL 2 sous Windows)." }
    ],
    challenge: {
      prompt: R`<p>Lance un serveur web nginx :</p><ol><li>image @@nginx:1.27-alpine@@, en arrière-plan, nommé @@web@@ ;</li><li>le port 80 du conteneur publié sur le port @@8080@@ de la machine ;</li><li>termine par @@curl -s localhost:8080@@ : la page d'accueil de nginx doit s'afficher.</li></ol>`,
      setup: { docker: { images: ["nginx:1.27-alpine"] } },
      checks: { containers: { web: { state: "running", ports: ["8080:80"] } }, outputHas: ["Welcome to nginx!"] },
      solution: ["docker run -d --name web -p 8080:80 nginx:1.27-alpine", "docker ps", "curl -s localhost:8080"],
      hint: "docker run -d --name web -p 8080:80 nginx:1.27-alpine, puis curl."
    }
  },
  {
    id: "dk-02", section: "Premiers pas", title: "Cycle de vie : logs, exec, stop, rm", xp: 75,
    theory: R`<p>Un conteneur passe par plusieurs états : créé, en marche (@@Up@@), arrêté (@@Exited (code)@@), éventuellement en redémarrage. Quand il s'arrête tout seul, son <strong>code de sortie</strong> et ses <strong>journaux</strong> disent pourquoi.</p>
<ul><li>@@docker logs api@@ : ce que le programme a écrit sur sa sortie standard et d'erreur ; @@--tail 20@@, @@-f@@ pour suivre ;</li><li>@@docker exec api commande@@ : lancer une commande dans un conteneur <strong>en marche</strong> (@@docker exec -it api sh@@ ouvre un shell sur ta machine) ;</li><li>@@docker stop@@ envoie SIGTERM puis SIGKILL après 10 s ; @@docker start@@ relance un conteneur arrêté ;</li><li>@@docker rm@@ supprime un conteneur arrêté, @@docker rm -f@@ le force ;</li><li>@@-e NOM=valeur@@ passe une variable d'environnement : c'est ainsi qu'on configure un conteneur (douze facteurs : la configuration vient de l'environnement, pas de l'image).</li></ul>
~~~sh
docker run -d --name cache redis:7-alpine
docker logs cache | tail -2
docker exec cache redis-cli ping
docker stop cache
docker ps -a
! docker exec cache redis-cli ping
docker rm cache
~~~
<p>Un conteneur ne se modifie pas : on ne change pas ses variables ou ses ports après coup. On le <strong>supprime et on le recrée</strong> avec les bons paramètres. C'est voulu : un conteneur est jetable, son état important vit ailleurs (volumes, base de données).</p>`,
    quiz: [
      { q: "docker ps n'affiche plus ton conteneur api. Comment savoir ce qui s'est passé ?", options: ["Réinstaller Docker", "docker ps -a pour voir son état et son code de sortie, puis docker logs api", "docker images", "Redémarrer la machine"], answer: 1, explain: "Un conteneur arrêté existe toujours : ses journaux restent lisibles tant qu'on ne l'a pas supprimé." },
      { q: "Comment changer une variable d'environnement d'un conteneur existant ?", options: ["docker exec api export X=1", "Le supprimer et le recréer avec -e X=1", "docker restart -e X=1 api", "Modifier l'image"], answer: 1, explain: "La configuration d'un conteneur est fixée à sa création. Compose fait la même chose pour toi quand tu relances docker compose up." }
    ],
    challenge: {
      prompt: R`<p>L'image @@boutique-api:1.0@@ a été lancée ce matin dans un conteneur @@api@@, mais l'API ne répond pas.</p><ol><li>trouve pourquoi le conteneur s'est arrêté ;</li><li>supprime-le et recrée-le, toujours nommé @@api@@, sur le port @@8000@@, avec ce qui lui manquait (la configuration attendue est celle de la <strong>production</strong>) ;</li><li>supprime aussi le vieux conteneur de test @@essai@@ ;</li><li>termine par @@curl -s localhost:8000/health@@.</li></ol>`,
      setup: apiSetup({ files: { [API + "/main.py"]: MAIN_PY_ENV }, app: { env: ["APP_ENV"], routes: { "/health": [200, '{"status":"ok","env":"{env.APP_ENV}"}'] } }, commands: ["#docker build -q -t boutique-api:1.0 " + API, "#docker run -d --name api -p 8000:8000 boutique-api:1.0", "#docker run --name essai alpine:3.20 echo test"], images: ["alpine:3.20"] }),
      checks: { containers: { api: { state: "running", ports: ["8000:8000"], env: { APP_ENV: "production" } }, essai: null }, outputHas: ['"status":"ok"', '"env":"production"'] },
      solution: ["docker ps -a", "docker logs api", "docker rm api", "docker run -d --name api -p 8000:8000 -e APP_ENV=production boutique-api:1.0", "docker rm essai", "curl -s localhost:8000/health"],
      hint: "docker ps -a montre api en « Exited (1) » ; docker logs api se termine par KeyError: 'APP_ENV'. docker rm api, puis docker run -d --name api -p 8000:8000 -e APP_ENV=production boutique-api:1.0."
    }
  },
  {
    id: "dk-03", section: "Premiers pas", title: "Images, tags et couches", xp: 70,
    theory: R`<p>Une image est une pile de <strong>couches</strong> : chaque instruction du Dockerfile qui modifie des fichiers en ajoute une. Les couches sont partagées : dix images construites sur @@python:3.12-slim@@ ne stockent cette base qu'une fois. @@docker history image@@ montre les couches et leur taille.</p>
<ul><li><strong>Tags</strong> : un tag est une étiquette mobile. @@latest@@ change sans prévenir : en production, on fixe une version (@@python:3.12-slim@@), voire un <strong>digest</strong> (@@python:3.12-slim@sha256:…@@), seul identifiant immuable ;</li><li><strong>Variantes</strong> : @@python:3.12@@ (Debian complet, environ 1 Go, avec compilateurs), @@-slim@@ (environ 130 Mo), @@-alpine@@ (environ 57 Mo, mais musl au lieu de glibc : certaines bibliothèques Python doivent y être compilées) ;</li><li><strong>Ménage</strong> : les images s'accumulent vite. @@docker system df@@ fait le bilan, @@docker image prune@@ supprime les images sans tag, @@docker container prune@@ les conteneurs arrêtés, @@docker rmi@@ une image précise.</li></ul>
~~~sh
docker pull python:3.12-slim
docker history python:3.12-slim
docker tag python:3.12-slim mon-python:base
docker images
docker system df
~~~
<p>On ne peut pas supprimer une image qu'un conteneur utilise encore, même arrêté : Docker refuse et nomme le conteneur.</p>`,
    quiz: [
      { q: "Pourquoi éviter FROM python:latest dans un Dockerfile de production ?", options: ["latest est plus lent", "latest pointe vers une version différente au fil du temps : la même construction peut changer du jour au lendemain", "latest n'existe pas", "C'est interdit par Docker"], answer: 1, explain: "On fixe un tag précis, et on met à jour volontairement (Dependabot sait le faire)." },
      { q: "Tu as 10 images construites FROM python:3.12-slim. Combien de fois la base est-elle stockée ?", options: ["10 fois", "Une fois : les couches sont partagées", "Aucune", "Deux fois"], answer: 1, explain: "C'est le principe des couches : seule la partie propre à chaque image coûte de la place." }
    ],
    challenge: {
      prompt: R`<p>Le disque du serveur se remplit. Fais le ménage sans casser ce qui tourne :</p><ol><li>supprime tous les <strong>conteneurs arrêtés</strong> ;</li><li>supprime l'image @@python:3.12@@ (la version complète, plus d'un gigaoctet), que plus personne n'utilise ;</li><li>garde @@nginx:1.27-alpine@@ et le conteneur @@web@@, qui sert le site.</li></ol><p>Commence par @@docker system df@@ et @@docker ps -a@@ pour voir l'état des lieux.</p>`,
      setup: { docker: { images: ["nginx:1.27-alpine", "python:3.12", "alpine:3.20"] }, commands: ["#docker run -d --name web -p 8080:80 nginx:1.27-alpine", "#docker run --name script-1 python:3.12 python3 -c 'print(1)'", "#docker run --name script-2 python:3.12 python3 -c 'print(2)'", "#docker run --name essai alpine:3.20 true"] },
      checks: { images: { "python:3.12": null, "nginx:1.27-alpine": {} }, containers: { web: { state: "running" }, "script-1": null, "script-2": null, essai: null } },
      solution: ["docker system df", "docker ps -a", "docker container prune -f", "docker rmi python:3.12", "docker ps"],
      hint: "docker rmi python:3.12 échoue tant que les conteneurs script-1 et script-2 (arrêtés) l'utilisent. docker container prune -f supprime d'abord tous les conteneurs arrêtés."
    }
  }
];
