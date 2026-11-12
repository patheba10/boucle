/* Cours Docker — chapitre 5 : incident et entretien. */
import { R, DOCKERFILE } from "./commun.js";
import { projetBoutique } from "./compose.js";

const P = "/home/eleve/boutique";
const COMPOSE_CASSE = `services:
  api:
    build: ./api
    port:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://boutique:\${DB_PASSWORD}@localhost:5432/boutique
    depends_on:
      db:
        condition: service_healthy

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

volumes:
  pgdata:
`;

export default [
  {
    id: "dk-11", section: "Mises en situation", title: "Incident : la pile ne démarre plus", xp: 130,
    theory: R`<p>Lundi matin, un collègue a « nettoyé » le projet vendredi soir, et plus rien ne démarre. Avec Docker, le diagnostic suit toujours le même chemin, de l'extérieur vers l'intérieur :</p>
<ol><li><strong>Le fichier est-il valide ?</strong> @@docker compose config@@ affiche le fichier interprété ou l'erreur de validation, avec la clé fautive ;</li><li><strong>Les conteneurs tournent-ils ?</strong> @@docker compose ps -a@@ : état, code de sortie, @@(healthy)@@ ;</li><li><strong>Que disent-ils ?</strong> @@docker compose logs api@@ : la trace d'erreur est presque toujours là ;</li><li><strong>Le réseau est-il bon ?</strong> Le service écoute-t-il sur @@0.0.0.0@@ ? Le port publié est-il le bon ? Les noms d'hôte sont-ils ceux des services, et pas @@localhost@@ ?</li><li><strong>Corriger, puis relancer</strong> : @@docker compose up -d@@ recrée ce qui a changé ; @@--build@@ si le Dockerfile ou le code a changé.</li></ol>
<p>Une seule correction à la fois, et une vérification après chacune : plusieurs pannes peuvent se cacher l'une derrière l'autre.</p>`,
    quiz: [
      { q: "Tu modifies le CMD du Dockerfile de l'API. docker compose up -d ne change rien. Pourquoi ?", options: ["Compose est en panne", "Compose réutilise l'image déjà construite : il faut docker compose up -d --build", "Il faut supprimer le volume", "Il faut redémarrer Docker"], answer: 1, explain: "Sans --build, Compose ne reconstruit une image que si elle n'existe pas." }
    ],
    challenge: {
      prompt: R`<p>Dans @@~/boutique@@, @@docker compose up -d@@ échoue. Remets la pile en état de marche :</p><ul><li>l'API doit répondre sur @@http://localhost:8000/health@@ ;</li><li>la base reste dans son volume, et son mot de passe dans @@.env@@ ;</li><li>corrige les fichiers (@@compose.yaml@@, @@api/Dockerfile@@), pas les conteneurs à la main.</li></ul><p>Termine par @@curl -s localhost:8000/health@@. Il y a plus d'une panne.</p>`,
      setup: projetBoutique({ [P + "/compose.yaml"]: COMPOSE_CASSE, [P + "/api/Dockerfile"]: DOCKERFILE.replace('"--host", "0.0.0.0", ', "") }),
      checks: {
        files: { [P + "/compose.yaml"]: { contains: ["ports:", "@db:5432"], lacks: ["s3cret"] }, [P + "/api/Dockerfile"]: { contains: ["0.0.0.0"] } },
        containers: { "boutique-api-1": { state: "running", ports: ["8000:8000"] }, "boutique-db-1": { state: "running" } },
        outputHas: ['{"status":"ok"}']
      },
      solution: [
        "docker compose up -d", "docker compose config",
        "sed -i 's/^    port:/    ports:/' compose.yaml", "docker compose up -d", "docker compose ps -a", "docker compose logs api",
        "sed -i 's/@localhost:5432/@db:5432/' compose.yaml", "docker compose up -d", "curl -s localhost:8000/health", "docker compose logs api",
        "sed -i 's/\"main:app\", \"--port\"/\"main:app\", \"--host\", \"0.0.0.0\", \"--port\"/' api/Dockerfile", "docker compose up -d --build", "curl -s localhost:8000/health"
      ],
      allowFail: ["docker compose up -d", "docker compose config", "curl -s localhost:8000/health"],
      hint: "Trois pannes, dans l'ordre où elles apparaissent : une clé mal orthographiée dans compose.yaml (lis l'erreur de validation), une adresse de base qui vise localhost au lieu du service db (docker compose logs api), et une API qui n'écoute que sur 127.0.0.1 (curl : « Connection reset by peer »). Après avoir changé le Dockerfile : docker compose up -d --build."
    }
  },
  {
    id: "dk-12", section: "Entretien", title: "Questions d'entretien Docker", xp: 60, theoryOnly: true,
    theory: R`<p>Docker revient dans presque tous les entretiens DevOps, cloud et back-end. Réponds à voix haute avant d'ouvrir chaque réponse.</p>
<div class="qa">
<details><summary>Quelle différence entre un conteneur et une machine virtuelle ?</summary><p>Une VM émule une machine complète avec son propre noyau, via un hyperviseur : isolation forte, mais lourde (Go de disque, démarrage en minutes). Un conteneur est un processus de l'hôte isolé par les <em>namespaces</em> (ce qu'il voit : processus, réseau, fichiers) et limité par les <em>cgroups</em> (ce qu'il consomme : CPU, mémoire). Il partage le noyau de l'hôte : léger, démarrage en millisecondes, isolation plus faible.</p></details>
<details><summary>Image, conteneur, couche : définis-les.</summary><p>Une image est un modèle en lecture seule fait de couches empilées, chacune issue d'une instruction du Dockerfile. Un conteneur est une instance en cours d'exécution d'une image, avec une couche inscriptible par-dessus, perdue à sa suppression. Les couches sont partagées entre images et mises en cache à la construction.</p></details>
<details><summary>Comment réduire la taille d'une image ?</summary><p>Base minimale et fixée (slim, alpine, distroless), construction multi-étapes pour laisser compilateurs et sources dans une étape intermédiaire, nettoyage dans le même @@RUN@@ (@@rm -rf /var/lib/apt/lists/*@@, @@pip --no-cache-dir@@), @@.dockerignore@@, ordre des instructions pour profiter du cache. @@docker history@@ montre quelle couche pèse.</p></details>
<details><summary>CMD et ENTRYPOINT ?</summary><p>@@ENTRYPOINT@@ fixe l'exécutable ; @@CMD@@ donne ses arguments par défaut, remplacés par ceux de @@docker run image args@@. Sans ENTRYPOINT, CMD est la commande entière. En forme JSON, le programme est le PID 1 et reçoit SIGTERM ; en forme texte, @@/bin/sh -c@@ s'intercale et le signal se perd : arrêt brutal après 10 s.</p></details>
<details><summary>Comment les conteneurs communiquent-ils ?</summary><p>Par des réseaux Docker. Sur un réseau défini par l'utilisateur (ou celui que crée Compose), un DNS intégré résout le nom de chaque conteneur ou service. @@localhost@@ dans un conteneur désigne ce conteneur. Les ports publiés (@@-p@@) ne servent qu'à joindre un conteneur depuis l'extérieur.</p></details>
<details><summary>Où vont les données d'une base dans Docker ?</summary><p>Dans un volume nommé monté sur le dossier de données, qui survit à la suppression du conteneur. Un bind mount convient au développement. Et un volume se sauvegarde : un volume n'est pas une sauvegarde.</p></details>
<details><summary>Comment gérer les secrets ?</summary><p>Jamais dans l'image (@@ENV@@, @@ARG@@, fichier copié) : ils resteraient lisibles dans les couches. Ils arrivent à l'exécution : variables d'environnement venant d'un @@.env@@ non versionné, secrets Compose ou Kubernetes, gestionnaire de secrets (AWS Secrets Manager, Vault). Pour un secret nécessaire à la construction : @@RUN --mount=type=secret@@.</p></details>
<details><summary>Comment sécuriser une image et un conteneur ?</summary><p>Utilisateur non root, base minimale mise à jour, scan de vulnérabilités en CI (Trivy, Docker Scout), image signée et tirée par digest, système de fichiers en lecture seule (@@--read-only@@), capacités retirées (@@--cap-drop ALL@@), limites de ressources (@@--memory@@, @@--cpus@@), jamais @@--privileged@@ ni le socket Docker monté dans un conteneur.</p></details>
<details><summary>Un conteneur redémarre en boucle. Ta démarche ?</summary><p>@@docker ps -a@@ pour le code de sortie (137 : tué, souvent par manque de mémoire ; 1 : erreur de l'application), @@docker logs@@ pour la trace, @@docker inspect@@ pour la configuration réelle (variables, montages, réseau, OOMKilled). Puis : dépendance absente (base injoignable), variable manquante, mauvais hôte d'écoute, fichier non copié dans l'image. Corriger, reconstruire si besoin, vérifier.</p></details>
<details><summary>Docker Compose ou Kubernetes ?</summary><p>Compose décrit une pile sur <em>une</em> machine : parfait pour le développement, les tests d'intégration en CI et les petits déploiements. Kubernetes orchestre des conteneurs sur un <em>cluster</em> : répartition, mise à l'échelle, redémarrage, déploiements progressifs, au prix d'une complexité bien plus grande. C'est le prochain cours.</p></details>
</div>`,
    practice: { title: "S'entraîner", body: R`<p>Choisis trois questions et réponds en deux minutes chacune, à voix haute. Ensuite, sur ta machine, conteneurise un de tes projets (LeetCode, un script, une API) avec un Dockerfile qui passe hadolint et un @@compose.yaml@@ : c'est un excellent dépôt à montrer en entretien.</p>` },
    quiz: [
      { q: "Un conteneur sort avec le code 137. Première hypothèse ?", options: ["Erreur de syntaxe Python", "Il a été tué par SIGKILL, souvent parce qu'il dépassait sa limite de mémoire (OOMKilled)", "Le port est déjà pris", "L'image n'existe pas"], answer: 1, explain: "137 = 128 + 9 (SIGKILL). docker inspect indique OOMKilled: true le cas échéant." },
      { q: "Pourquoi le CMD en forme JSON est-il recommandé ?", options: ["Il est plus court", "Le programme devient le PID 1 et reçoit SIGTERM : il s'arrête proprement à docker stop", "Il est plus rapide à construire", "Il évite le cache"], answer: 1, explain: "En forme texte, /bin/sh -c reçoit le signal et ne le transmet pas : Docker tue le conteneur au bout de 10 s." }
    ]
  }
];
