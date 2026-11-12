/* Cours Docker — chapitre 2 : construire ses images. */
import { R, API, DOCKERFILE, apiSetup } from "./commun.js";

const RUN_API = ["docker build -t api:1.0 .", "docker run -d --name api -p 8080:8000 api:1.0", "curl -s localhost:8080/health"];
const MAL_ORDONNE = `FROM python:3.12-slim
WORKDIR /app
COPY . .
RUN pip install --no-cache-dir -r requirements.txt
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
`;
const NAIF = `FROM python:latest
ADD . /app
WORKDIR /app
RUN apt-get update && apt-get install -y curl
RUN pip install -r requirements.txt
ENV API_KEY=sk_live_51Hx9QbT2vK
CMD uvicorn main:app --host 0.0.0.0 --port 8000
`;
const SUR = `FROM python:3.12-slim
RUN useradd --create-home app
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY --chown=app:app . .
USER app
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
`;

export default [
  {
    id: "dk-04", section: "Construire des images", title: "Écrire un Dockerfile", xp: 90,
    theory: R`<p>Un <strong>Dockerfile</strong> est la recette d'une image. Chaque instruction s'exécute dans l'ordre, au-dessus du résultat de la précédente :</p>
~~~text
FROM python:3.12-slim            # image de départ
WORKDIR /app                     # dossier de travail (créé au besoin)
COPY requirements.txt .          # copie depuis le contexte de construction
RUN pip install --no-cache-dir -r requirements.txt   # commande exécutée À LA CONSTRUCTION
COPY . .                         # le code de l'application
EXPOSE 8000                      # documente le port écouté
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]   # commande lancée AU DÉMARRAGE
~~~
<ul><li>@@RUN@@ s'exécute pendant @@docker build@@ et produit une couche ; @@CMD@@ ne s'exécute qu'au lancement du conteneur, et @@docker run image autre-commande@@ le remplace ;</li><li>@@CMD@@ en forme <strong>JSON</strong> (@@["uvicorn", "main:app"]@@) lance le programme directement : il reçoit les signaux d'arrêt. En forme texte, il passe par @@/bin/sh -c@@, qui les avale ;</li><li>@@--host 0.0.0.0@@ est indispensable : par défaut uvicorn, Flask et beaucoup d'autres n'écoutent que sur @@127.0.0.1@@, donc uniquement <strong>dans</strong> le conteneur. Le port publié mène alors dans le vide ;</li><li>@@docker build -t nom:tag .@@ : le point est le <strong>contexte</strong>, le dossier envoyé au moteur Docker, d'où @@COPY@@ lit ses fichiers.</li></ul>`,
    snippetSetup: apiSetup(),
    setup: R`<p><strong>Sur ta machine</strong> : crée un dossier avec @@main.py@@, @@requirements.txt@@ et le Dockerfile ci-contre, puis @@docker build -t api .@@ et @@docker run --rm -p 8000:8000 api@@ ; ouvre <em>http://localhost:8000/docs</em>.</p>`,
    quiz: [
      { q: "Quelle instruction s'exécute au démarrage du conteneur, et pas pendant la construction ?", options: ["RUN", "COPY", "CMD", "WORKDIR"], answer: 2, explain: "RUN prépare l'image ; CMD dit quoi lancer quand on démarre un conteneur à partir d'elle." },
      { q: "Le conteneur tourne, le port est publié avec -p 8080:8000, mais curl renvoie « Connection reset by peer ». Cause probable ?", options: ["Le pare-feu de Windows", "L'application n'écoute que sur 127.0.0.1 dans le conteneur : il faut --host 0.0.0.0", "Le port 8080 est trop haut", "L'image est trop grosse"], answer: 1, explain: "Le trafic publié arrive sur l'interface réseau du conteneur, pas sur sa boucle locale." }
    ],
    challenge: {
      kind: "script", file: API + "/Dockerfile", editorLang: "docker", run: RUN_API,
      checkLabel: "Construire et lancer", checkNote: "docker build, docker run -p 8080:8000, puis curl", okMsg: "Bravo, ton image se construit et l'API répond.",
      prompt: R`<p>Le dossier @@~/api@@ contient une API FastAPI : @@main.py@@ (l'objet @@app@@) et @@requirements.txt@@ (fastapi et uvicorn). Écris son @@Dockerfile@@ :</p><ul><li>à partir de @@python:3.12-slim@@, dans le dossier @@/app@@ ;</li><li>installe les dépendances avec pip (sans cache), puis copie le code ;</li><li>au démarrage, lance @@uvicorn main:app@@ sur le port @@8000@@, joignable depuis l'extérieur du conteneur.</li></ul><p>Le test construit l'image, la lance avec @@-p 8080:8000@@ et appelle @@/health@@.</p>`,
      starter: "FROM python:3.12-slim\n\n",
      solution: DOCKERFILE,
      setup: apiSetup({ dockerfile: null }),
      tests: [{ label: "L'image se construit, le conteneur tourne et /health répond", outHas: '{"status":"ok"}', checks: { images: { "api:1.0": { hasFile: "/app/main.py", jsonCmd: true } }, containers: { api: { state: "running" } } } }],
      hint: "Six lignes : FROM, WORKDIR /app, COPY requirements.txt ., RUN pip install --no-cache-dir -r requirements.txt, COPY . ., puis CMD [\"uvicorn\", \"main:app\", \"--host\", \"0.0.0.0\", \"--port\", \"8000\"]."
    }
  },
  {
    id: "dk-05", section: "Construire des images", title: "Cache de construction et .dockerignore", xp: 85,
    theory: R`<p>Docker garde chaque couche en <strong>cache</strong>. À la construction suivante, il réutilise une couche tant que son instruction <em>et</em> ce qu'elle lit n'ont pas changé ; dès qu'une couche change, <strong>toutes les suivantes</strong> sont reconstruites.</p>
<p>D'où la règle d'or : <strong>ce qui change rarement en haut, ce qui change souvent en bas</strong>. Si @@COPY . .@@ vient avant @@pip install@@, chaque modification du code invalide la copie, donc réinstalle toutes les dépendances : des minutes perdues à chaque construction, en local comme en CI. En copiant d'abord @@requirements.txt@@ seul, l'installation reste en cache tant que les dépendances ne changent pas.</p>
~~~sh
docker build -t api:1.0 .
echo '# correctif' >> main.py
docker build -t api:1.0 .
~~~
<p>Le <strong>contexte</strong> (le @@.@@ de @@docker build@@) est envoyé en entier au moteur. Sans précaution, il embarque l'environnement virtuel, l'historique Git, les fichiers @@.env@@ et leurs secrets. Le fichier @@.dockerignore@@ les exclut, avec la même syntaxe que @@.gitignore@@ :</p>
~~~text
.venv
.git
__pycache__
*.pyc
.env
~~~
<p>Bonus : un contexte plus petit, c'est une construction plus rapide, une image plus légère et aucun secret copié par accident.</p>`,
    snippetSetup: apiSetup(),
    quiz: [
      { q: "Dans un Dockerfile, COPY . . est placé avant RUN pip install. Que se passe-t-il quand on modifie une ligne de main.py ?", options: ["Rien n'est reconstruit", "La couche COPY change, donc pip install est relancé : toutes les dépendances sont réinstallées", "Seul main.py est recopié", "La construction échoue"], answer: 1, explain: "Une couche invalidée invalide toutes celles qui suivent." },
      { q: "À quoi sert .dockerignore ?", options: ["À ignorer des erreurs de construction", "À exclure des fichiers du contexte envoyé à Docker (.venv, .git, .env…)", "À ne pas publier l'image", "À ignorer des instructions du Dockerfile"], answer: 1, explain: "Les fichiers exclus ne sont ni envoyés ni copiables par COPY." }
    ],
    challenge: {
      prompt: R`<p>Dans @@~/api@@, chaque construction réinstalle toutes les dépendances, et l'image pèse plusieurs centaines de mégaoctets. Corrige le projet :</p><ol><li>réordonne le @@Dockerfile@@ pour que l'installation des dépendances reste en cache quand seul le code change ;</li><li>crée un @@.dockerignore@@ qui exclut au moins @@.venv@@, @@.git@@ et @@__pycache__@@ ;</li><li>construis l'image @@api:1.1@@ : elle doit peser moins de 200 Mo et ne plus contenir @@/app/.venv@@.</li></ol><p>Pour écrire un fichier de plusieurs lignes : @@printf '…\n…\n' > Dockerfile@@, ou @@cat > Dockerfile <<'EOF'@@ suivi des lignes et d'une ligne @@EOF@@.</p>`,
      setup: apiSetup({ dockerfile: MAL_ORDONNE, files: { [API + "/.venv/lib/python3.12/site-packages/torch/lib/libtorch_cpu.so"]: { content: "binaire", bytes: 214e6 }, [API + "/.git/objects/pack/pack-3f2a.pack"]: { content: "git", bytes: 38e6 }, [API + "/__pycache__/main.cpython-312.pyc"]: "pyc" } }),
      checks: {
        dockerfile: { [API + "/Dockerfile"]: { contains: ["COPY requirements.txt", "pip install"] } },
        files: { [API + "/.dockerignore"]: { contains: [".venv", ".git", "__pycache__"] } },
        images: { "api:1.1": { maxMB: 200, lacksFile: "/app/.venv", hasFile: "/app/main.py" } }
      },
      solution: ["cat Dockerfile", "printf 'FROM python:3.12-slim\\nWORKDIR /app\\nCOPY requirements.txt .\\nRUN pip install --no-cache-dir -r requirements.txt\\nCOPY . .\\nEXPOSE 8000\\nCMD [\"uvicorn\", \"main:app\", \"--host\", \"0.0.0.0\", \"--port\", \"8000\"]\\n' > Dockerfile", "printf '.venv\\n.git\\n__pycache__\\n*.pyc\\n.env\\n' > .dockerignore", "docker build -t api:1.1 .", "docker images"],
      hint: "Copie requirements.txt seul, lance pip install, puis seulement COPY . . . Le .dockerignore liste un motif par ligne. Regarde la ligne « transferring context » de docker build avant et après."
    }
  },
  {
    id: "dk-06", section: "Construire des images", title: "Images légères et sûres", xp: 110,
    theory: R`<p>Une image de production doit être <strong>petite</strong> (téléchargement, démarrage, surface d'attaque) et <strong>sûre</strong>. Les règles qu'un relecteur vérifie :</p>
<ul><li><strong>Une base fixée et minimale</strong> : @@python:3.12-slim@@ plutôt que @@python:latest@@ (1 Go, version mouvante) ;</li><li><strong>Pas de root</strong> : par défaut le processus tourne en root ; une faille dans l'application donne alors root dans le conteneur. On crée un utilisateur (@@RUN useradd --create-home app@@) et on bascule avec @@USER app@@ ;</li><li><strong>Pas de secrets dans l'image</strong> : un @@ENV API_KEY=…@@ se lit avec @@docker history@@ ou @@docker inspect@@ par quiconque a l'image. Les secrets arrivent à l'exécution (@@-e@@, fichiers de secrets, gestionnaire de secrets) ;</li><li><strong>Pas d'outils inutiles</strong> : chaque paquet est du poids et une faille potentielle. Avec apt : @@--no-install-recommends@@ et @@rm -rf /var/lib/apt/lists/*@@ dans le <em>même</em> @@RUN@@ ; avec pip : @@--no-cache-dir@@ ;</li><li>@@COPY@@ plutôt qu'@@ADD@@ (qui décompresse et télécharge des URL en silence), @@CMD@@ en JSON.</li></ul>
<p><strong>hadolint</strong> vérifie ces règles automatiquement ; on le lance en CI à côté des tests :</p>
~~~sh
printf 'FROM python:latest\nADD . /app\nCMD python app.py\n' > Dockerfile
! hadolint Dockerfile
~~~
<p><strong>Construction multi-étapes</strong> : quand il faut des compilateurs pour construire (Go, Rust, dépendances Python en C, front-end), une première étape construit, la seconde ne copie que le résultat. L'image finale ne garde ni compilateurs ni sources :</p>
~~~text
FROM node:20 AS build
WORKDIR /src
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /src/dist /usr/share/nginx/html
~~~`,
    snippetSetup: apiSetup(),
    quiz: [
      { q: "Pourquoi « ENV DB_PASSWORD=… » dans un Dockerfile est-il dangereux ?", options: ["ENV ralentit l'image", "Le secret est gravé dans l'image : docker history ou docker inspect le révèlent à quiconque peut la télécharger", "Les variables sont limitées à 8 caractères", "Ce n'est pas dangereux"], answer: 1, explain: "Le secret se passe au lancement (-e, secrets Compose ou Kubernetes), jamais à la construction." },
      { q: "Pourquoi nettoyer /var/lib/apt/lists dans le même RUN que apt-get install ?", options: ["Par convention", "Chaque RUN est une couche : supprimer dans une couche suivante masque les fichiers mais ne réduit pas l'image", "apt l'exige", "Pour que hadolint se taise"], answer: 1, explain: "Les couches s'additionnent : ce qui est écrit dans une couche y reste." },
      { q: "Quel est l'intérêt d'une construction multi-étapes ?", options: ["Construire plus vite", "Garder les outils de construction dans une étape intermédiaire : l'image finale ne contient que le résultat", "Avoir plusieurs CMD", "Lancer plusieurs conteneurs"], answer: 1, explain: "Une image Go peut passer de 800 Mo à 15 Mo." }
    ],
    challenge: {
      kind: "script", file: API + "/Dockerfile", editorLang: "docker",
      run: ["hadolint Dockerfile", "docker build -t api:secure .", "docker run -d --name api -p 8080:8000 -e API_KEY=cle-de-test api:secure", "curl -s localhost:8080/health"],
      checkLabel: "Analyser, construire et lancer", checkNote: "hadolint, docker build, docker run, puis curl", okMsg: "Bravo : image légère, sans root ni secret, et hadolint ne trouve rien.",
      prompt: R`<p>Ce Dockerfile fonctionne, mais il ne passerait pas une revue. Réécris-le pour que :</p><ul><li>@@hadolint@@ ne signale <strong>plus rien</strong> ;</li><li>l'image pèse <strong>moins de 200 Mo</strong> ;</li><li>l'application tourne avec un <strong>utilisateur non root</strong> ;</li><li>la clé @@API_KEY@@ ne soit plus dans l'image (le test la passe au lancement avec @@-e@@) ;</li><li>l'API réponde toujours sur @@/health@@ (le test publie @@-p 8080:8000@@).</li></ul><p>@@curl@@ n'est utilisé par personne dans le conteneur.</p>`,
      starter: NAIF,
      solution: SUR,
      setup: apiSetup({ dockerfile: null, images: ["python:3.13"] }),
      tests: [{ label: "hadolint, construction, lancement et /health", outHas: '{"status":"ok"}', checks: { files: { [API + "/Dockerfile"]: { lacks: ["sk_live"] } }, dockerfile: { [API + "/Dockerfile"]: { clean: true } }, images: { "api:secure": { maxMB: 200, nonRoot: true } }, containers: { api: { state: "running" } } } }],
      hint: "Base python:3.12-slim ; RUN useradd --create-home app avant WORKDIR (pour ne pas enchaîner deux RUN) ; COPY requirements.txt puis pip install --no-cache-dir ; COPY --chown=app:app . . ; USER app ; CMD en JSON. Supprime l'ENV et l'installation de curl."
    }
  }
];
