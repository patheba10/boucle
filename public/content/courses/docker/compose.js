/* Cours Docker — chapitre 4 : Compose, registres et CI. */
import { R, API, MAIN_PY, MAIN_PY_DB, REQS, REQS_DB, DOCKERFILE, DB_APP, apiApp } from "./commun.js";

const P = "/home/eleve/boutique";
const COMPOSE = `services:
  api:
    build: ./api
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://boutique:\${DB_PASSWORD}@db:5432/boutique
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:16
    environment:
      POSTGRES_USER: boutique
      POSTGRES_PASSWORD: \${DB_PASSWORD}
      POSTGRES_DB: boutique
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U boutique"]
      interval: 5s
      retries: 5

volumes:
  pgdata:
`;
export const projetBoutique = (extraFiles = {}) => ({
  files: { [P + "/api/main.py"]: MAIN_PY_DB, [P + "/api/requirements.txt"]: REQS_DB, [P + "/api/Dockerfile"]: DOCKERFILE, [P + "/.env"]: "DB_PASSWORD=s3cret\n", ...extraFiles },
  docker: { images: ["python:3.12-slim", "postgres:16"], apps: { [P + "/api/main.py"]: apiApp(DB_APP) } },
  cwd: P
});

export default [
  {
    id: "dk-09", section: "Compose et livraison", title: "Docker Compose", xp: 110,
    theory: R`<p>Taper trois @@docker run@@ de vingt options à chaque démarrage n'est ni fiable ni partageable. <strong>Compose</strong> décrit toute la pile dans un fichier versionné, @@compose.yaml@@, et la pilote d'une commande :</p>
~~~text
services:
  api:
    build: ./api                  # construit l'image depuis ./api/Dockerfile
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://boutique:\${DB_PASSWORD}@db:5432/boutique
    depends_on:
      db:
        condition: service_healthy   # attendre que la base soit prête, pas juste lancée
  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: \${DB_PASSWORD}   # lu dans le fichier .env, jamais écrit en clair ici
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U boutique"]
volumes:
  pgdata:
~~~
<ul><li>Compose crée un réseau pour le projet : les services se joignent par leur <strong>nom</strong> (@@db@@) ;</li><li>@@\${VAR}@@ est remplacé par la variable d'environnement ou par le fichier @@.env@@ du dossier (à mettre dans @@.gitignore@@) ;</li><li>@@depends_on@@ seul n'attend que le <em>lancement</em> du conteneur ; avec @@condition: service_healthy@@ et un @@healthcheck@@, Compose attend que la base accepte les connexions ;</li><li>les commandes : @@docker compose up -d@@ (@@--build@@ pour reconstruire), @@ps@@, @@logs -f api@@, @@exec db psql -U boutique@@, @@down@@ (@@-v@@ supprime aussi les volumes, donc les données), @@config@@ (affiche le fichier interprété : parfait pour vérifier l'interpolation).</li></ul>`,
    setup: R`<p><strong>Sur ta machine</strong> : Docker Desktop inclut Compose v2 (@@docker compose version@@). L'ancienne commande @@docker-compose@@, avec un tiret, est obsolète, tout comme la clé @@version:@@ en tête de fichier.</p>`,
    quiz: [
      { q: "Pourquoi depends_on: [db] ne suffit-il pas toujours ?", options: ["Il ne fonctionne qu'avec Kubernetes", "Il attend seulement que le conteneur db soit lancé, pas que PostgreSQL accepte les connexions", "Il démarre db après api", "Il est obsolète"], answer: 1, explain: "La base met quelques secondes à s'initialiser : healthcheck + condition: service_healthy règle la course." },
      { q: "Que fait docker compose down -v ?", options: ["Arrête les conteneurs seulement", "Supprime conteneurs et réseau, et aussi les volumes : les données de la base sont perdues", "Met à jour les images", "Affiche la version"], answer: 1, explain: "Sans -v, les volumes nommés sont conservés." },
      { q: "Où mettre le mot de passe de la base pour un projet Compose versionné sur GitHub ?", options: ["En clair dans compose.yaml", "Dans un fichier .env non versionné, référencé par ${DB_PASSWORD}", "Dans le Dockerfile", "Dans le nom du service"], answer: 1, explain: "compose.yaml se partage ; .env reste sur la machine (et dans un gestionnaire de secrets en production)." }
    ],
    challenge: {
      kind: "script", file: P + "/compose.yaml", editorLang: "yaml",
      run: ["docker compose up -d", "docker compose ps", "curl -s localhost:8000/health"],
      checkLabel: "Lancer la pile", checkNote: "docker compose up -d, puis curl", okMsg: "Bravo, la pile démarre dans le bon ordre et l'API répond.",
      prompt: R`<p>Dans @@~/boutique@@ : le dossier @@api/@@ (avec son Dockerfile) et un fichier @@.env@@ qui définit @@DB_PASSWORD@@. Écris @@compose.yaml@@ :</p><ul><li>un service @@db@@ : @@postgres:16@@, utilisateur et base @@boutique@@, mot de passe tiré de @@DB_PASSWORD@@, données dans un volume nommé @@pgdata@@, et un @@healthcheck@@ avec @@pg_isready@@ ;</li><li>un service @@api@@ construit depuis @@./api@@, port @@8000@@ publié, @@DATABASE_URL=postgresql://boutique:MOT_DE_PASSE@db:5432/boutique@@ (le mot de passe, toujours depuis @@DB_PASSWORD@@), démarré seulement quand la base est <strong>prête</strong> ;</li><li>aucun mot de passe en clair dans le fichier.</li></ul>`,
      starter: "services:\n  db:\n    image: postgres:16\n",
      solution: COMPOSE,
      setup: projetBoutique(),
      tests: [{ label: "docker compose up -d, puis /health", outHas: '{"status":"ok"}', checks: {
        files: { [P + "/compose.yaml"]: { contains: ["${DB_PASSWORD}", "service_healthy", "healthcheck"], lacks: ["s3cret"] } },
        containers: { "boutique-db-1": { state: "running", health: "healthy", volume: { boutique_pgdata: "/var/lib/postgresql/data" } }, "boutique-api-1": { state: "running", ports: ["8000:8000"] } },
        volumes: ["boutique_pgdata"]
      } }],
      hint: "Deux services. Pour db : image, environment (POSTGRES_USER, POSTGRES_PASSWORD: ${DB_PASSWORD}, POSTGRES_DB), volumes (- pgdata:/var/lib/postgresql/data), healthcheck (test: [\"CMD-SHELL\", \"pg_isready -U boutique\"]). Pour api : build, ports, environment, depends_on avec condition: service_healthy. Et la section volumes: pgdata: en bas."
    }
  },
  {
    id: "dk-10", section: "Compose et livraison", title: "Registres et images en CI", xp: 90,
    theory: R`<p>Une image construite sur ta machine doit rejoindre les serveurs : on la <strong>pousse</strong> vers un registre (Docker Hub, GitHub Container Registry @@ghcr.io@@, Amazon ECR…), d'où les serveurs la <strong>tirent</strong>.</p>
<ul><li>le nom complet dit où va l'image : @@ghcr.io/patheba10/boutique-api:1.4.0@@ (registre, compte, dépôt, tag). Sans registre, c'est Docker Hub ; sans compte, la bibliothèque officielle, où tu n'as pas le droit de publier ;</li><li>@@docker tag image nouveau-nom@@ ajoute un nom à une image existante (sans la copier) ;</li><li>@@docker login@@ avec un <strong>jeton d'accès</strong> plutôt qu'un mot de passe, passé par l'entrée standard (@@--password-stdin@@) pour qu'il n'apparaisse ni dans l'historique ni dans la liste des processus ;</li><li>on publie une version immuable (@@1.4.0@@, ou le SHA du commit) ; @@latest@@ peut s'ajouter par commodité, mais on ne déploie jamais @@latest@@.</li></ul>
<p>En pratique, c'est la CI qui construit et pousse, à chaque tag Git, avec les actions officielles de Docker :</p>
~~~text
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          push: true
          tags: ghcr.io/\${{ github.repository }}:\${{ github.ref_name }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
~~~
<p>Le cache GitHub Actions (@@type=gha@@) rend les constructions en CI aussi rapides qu'en local. Ajoute un scanner de vulnérabilités (Trivy, Docker Scout) avant de pousser.</p>`,
    quiz: [
      { q: "docker push boutique-api:1.0 répond « denied: requested access to the resource is denied ». Pourquoi ?", options: ["Le réseau est coupé", "Sans compte dans le nom, l'image vise la bibliothèque officielle de Docker Hub : il faut la nommer compte/boutique-api:1.0 (et être connecté)", "L'image est trop grosse", "Le tag 1.0 est interdit"], answer: 1, explain: "docker tag boutique-api:1.0 eleve/boutique-api:1.0, docker login, puis docker push." },
      { q: "Pourquoi « echo $JETON | docker login -u eleve --password-stdin » plutôt que « docker login -u eleve -p $JETON » ?", options: ["C'est plus court", "Avec -p, le jeton apparaît dans l'historique du shell et dans la liste des processus", "-p n'existe pas", "Pour la vitesse"], answer: 1, explain: "Docker lui-même affiche un avertissement quand on utilise -p." }
    ],
    challenge: {
      prompt: R`<p>Publie la version @@1.0.0@@ de l'API sur Docker Hub, sous le compte @@eleve@@ :</p><ol><li>construis l'image depuis @@~/api@@ ;</li><li>nomme-la @@eleve/boutique-api:1.0.0@@ et aussi @@eleve/boutique-api:latest@@ ;</li><li>connecte-toi avec le jeton rangé dans @@~/.config/dockerhub/jeton@@, sans qu'il apparaisse dans la commande ;</li><li>pousse les deux tags.</li></ol>`,
      setup: { files: { [API + "/main.py"]: MAIN_PY, [API + "/requirements.txt"]: REQS, [API + "/Dockerfile"]: DOCKERFILE, "/home/eleve/.config/dockerhub/jeton": { content: "dckr_pat_Xq81fWmT0bQ\n", mode: "600" } }, docker: { images: ["python:3.12-slim"], apps: { [API + "/main.py"]: apiApp() } }, cwd: API },
      checks: { pushed: ["eleve/boutique-api:1.0.0", "eleve/boutique-api:latest"] },
      solution: ["docker build -t eleve/boutique-api:1.0.0 .", "docker tag eleve/boutique-api:1.0.0 eleve/boutique-api:latest", "cat ~/.config/dockerhub/jeton | docker login -u eleve --password-stdin", "docker push eleve/boutique-api:1.0.0", "docker push eleve/boutique-api:latest"],
      hint: "docker build -t eleve/boutique-api:1.0.0 . puis docker tag pour latest. Connexion : cat ~/.config/dockerhub/jeton | docker login -u eleve --password-stdin. Enfin un docker push par tag."
    }
  }
];
