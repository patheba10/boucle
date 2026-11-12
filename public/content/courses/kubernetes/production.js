/* Cours Kubernetes — chapitre 3 : dépannage, exposition, base de données. */
import { R, IMG, K, k8sSetup, DEPLOY, SERVICE } from "./commun.js";
import { MAIN_PY_DB, DB_APP } from "../docker/commun.js";

const simple = (name, image, extra = "", replicas = 2) => `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
spec:
  replicas: ${replicas}
  selector:
    matchLabels:
      app: ${name}
  template:
    metadata:
      labels:
        app: ${name}
    spec:
      containers:
        - name: ${name}
          image: ${image}
${extra}`;
const WEB = simple("web", "nginx:1.27-alpin", "          ports:\n            - containerPort: 80\n");
const API_SECRET = simple("api", IMG + ":1.0", "          ports:\n            - name: http\n              containerPort: 8000\n          env:\n            - name: SECRET_KEY\n              valueFrom:\n                secretKeyRef:\n                  name: api-secrets\n                  key: SECRET_KEY\n");
const WORKER = simple("worker", IMG + ":1.0", "          resources:\n            requests:\n              cpu: 250m\n              memory: 6Gi\n", 1);
const withIngress = (st) => ({ ...st, k8s: { ...st.k8s, ingress: true } });
const WEB_SVC = `apiVersion: v1
kind: Service
metadata:
  name: web
spec:
  selector:
    app: web
  ports:
    - port: 80
      targetPort: 80
`;
const INGRESS = `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: boutique
spec:
  ingressClassName: nginx
  rules:
    - host: boutique.localhost
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: api
                port:
                  number: 80
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web
                port:
                  number: 80
`;
const DB = `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: pgdata
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: db
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: db
  template:
    metadata:
      labels:
        app: db
    spec:
      containers:
        - name: postgres
          image: postgres:16
          ports:
            - containerPort: 5432
          env:
            - name: POSTGRES_USER
              value: boutique
            - name: POSTGRES_DB
              value: boutique
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: db-secrets
                  key: password
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: pgdata
---
apiVersion: v1
kind: Service
metadata:
  name: db
spec:
  selector:
    app: db
  ports:
    - port: 5432
`;
const API_DB = simple("api", IMG + ":1.0", "          ports:\n            - name: http\n              containerPort: 8000\n          env:\n            - name: DATABASE_URL\n              valueFrom:\n                secretKeyRef:\n                  name: db-secrets\n                  key: url\n") + "---\n" + SERVICE;

export default [
  {
    id: "k8s-07", section: "En production", title: "Dépannage : les pannes classiques", xp: 130,
    theory: R`<p>Quatre états reviennent dans presque tous les incidents (et tous les entretiens) :</p>
<ul><li>@@ImagePullBackOff@@ / @@ErrImagePull@@ : l'image ne peut pas être tirée (nom ou tag faux, registre privé sans @@imagePullSecrets@@). @@kubectl describe pod@@ montre le message du registre ;</li><li>@@CrashLoopBackOff@@ : le conteneur démarre puis s'arrête, et Kubernetes attend de plus en plus longtemps avant de réessayer. La cause est dans @@kubectl logs POD --previous@@ (le journal de l'exécution qui a planté) ;</li><li>@@CreateContainerConfigError@@ : un ConfigMap ou un Secret référencé manque ;</li><li>@@Pending@@ : le scheduler ne trouve aucun nœud où placer le Pod (requests trop grandes, nœuds pleins, contraintes). L'événement @@FailedScheduling@@ dit pourquoi.</li></ul>
<p>La démarche : @@kubectl get pods@@ (l'état), @@kubectl describe pod@@ (la section <em>Events</em> en bas), @@kubectl logs --previous@@ (la trace de l'application), puis @@kubectl get events --sort-by=.lastTimestamp@@ pour la vue d'ensemble. On corrige le <strong>manifest</strong> et on réapplique : modifier un objet à la main laisse le YAML versionné faux.</p>`,
    quiz: [
      { q: "Un Pod est en CrashLoopBackOff. Quelle commande montre l'erreur de l'application ?", options: ["kubectl get nodes", "kubectl logs POD --previous", "kubectl top pod", "kubectl get svc"], answer: 1, explain: "--previous lit le journal de l'exécution qui a planté, pas celle qui démarre." },
      { q: "Que signifie Pending avec l'événement « 0/3 nodes are available: 3 Insufficient cpu » ?", options: ["L'image est absente", "Les requests CPU du Pod ne tiennent sur aucun nœud", "Le Pod a planté", "Le Service est mal configuré"], answer: 1, explain: "Baisser les requests, libérer de la place, ou ajouter des nœuds (autoscaler de cluster)." }
    ],
    challenge: {
      prompt: R`<p>Trois équipes ont déployé ce matin dans @@~/k8s@@ (@@web.yaml@@, @@api.yaml@@, @@worker.yaml@@), et rien ne marche. Pour chaque Deployment, trouve la panne et corrige-la :</p><ul><li>corrige les manifests et réapplique-les, plutôt que de modifier les objets à la main ;</li><li>s'il manque un Secret, crée-le : la clé attendue est @@SECRET_KEY@@ (n'importe quelle valeur) ;</li><li>le @@worker@@ n'a besoin que de @@256Mi@@ de mémoire.</li></ul><p>À la fin, @@kubectl get pods@@ ne doit montrer que des Pods @@Running@@ et prêts.</p>`,
      setup: k8sSetup({ versions: ["1.0"], images: ["nginx:1.27-alpine"], files: { [K + "/web.yaml"]: WEB, [K + "/api.yaml"]: API_SECRET, [K + "/worker.yaml"]: WORKER }, apply: [WEB, API_SECRET, WORKER] }),
      checks: { pods: { noCrash: true }, k8s: { "deploy/web": { rolledOut: true, image: "nginx:1.27-alpine" }, "deploy/api": { rolledOut: true }, "deploy/worker": { rolledOut: true }, "secret/api-secrets": { hasKeys: ["SECRET_KEY"] } } },
      solution: ["kubectl get pods", "kubectl describe pods -l app=web", "sed -i 's/nginx:1.27-alpin$/nginx:1.27-alpine/' web.yaml", "kubectl apply -f web.yaml", "kubectl describe pods -l app=api", "kubectl create secret generic api-secrets --from-literal=SECRET_KEY=s3cret", "kubectl describe pods -l app=worker", "sed -i 's/memory: 6Gi/memory: 256Mi/' worker.yaml", "kubectl apply -f worker.yaml", "kubectl get pods"],
      hint: "web : ImagePullBackOff, une faute de frappe dans le tag (describe le montre). api : CreateContainerConfigError, le Secret api-secrets n'existe pas (kubectl create secret generic). worker : Pending, il demande 6Gi alors que le nœud n'en a que 4."
    }
  },
  {
    id: "k8s-08", section: "En production", title: "Exposer : NodePort, LoadBalancer, Ingress", xp: 100,
    theory: R`<p>Comment le trafic du monde extérieur atteint-il un Service ?</p>
<ul><li>@@NodePort@@ : un port (30000 à 32767) ouvert sur chaque nœud. Simple, mais peu pratique en production ;</li><li>@@LoadBalancer@@ : chez un fournisseur cloud, crée un équilibreur de charge (sur AWS, un NLB ou un ALB) avec une IP publique. Un par Service : vite coûteux ;</li><li><strong>Ingress</strong> : <em>un</em> point d'entrée HTTP (un contrôleur comme ingress-nginx) qui route selon le nom d'hôte et le chemin vers plusieurs Services, et gère le TLS. C'est le schéma habituel pour un site et son API.</li></ul>
~~~text
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: boutique
spec:
  ingressClassName: nginx
  rules:
    - host: boutique.localhost
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: api
                port:
                  number: 80
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web
                port:
                  number: 80
~~~
<p>Le chemin est transmis tel quel : une requête sur @@/api/health@@ arrive à l'API avec ce chemin complet. Ses routes doivent donc commencer par @@/api@@ (ou on ajoute une règle de réécriture au contrôleur).</p>
<p>Le cluster de ce cours a ingress-nginx publié sur le port 80 de la machine, comme un cluster kind configuré pour (et @@*.localhost@@ pointe vers ta machine). Le successeur d'Ingress, la <em>Gateway API</em>, suit les mêmes idées avec plus de souplesse.</p>`,
    quiz: [
      { q: "Tu as un site et une API dans le même cluster, à exposer sous un seul domaine. Que choisir ?", options: ["Deux Services LoadBalancer", "Un Ingress qui route / vers le site et /api vers l'API", "Deux NodePort", "kubectl port-forward en production"], answer: 1, explain: "Un seul point d'entrée, un seul certificat TLS, un routage par chemin." },
      { q: "L'Ingress répond 503 sur /api. Piste ?", options: ["Le DNS", "Le Service visé n'existe pas ou n'a aucun Endpoint prêt", "Le pathType est Prefix", "Le cluster est plein"], answer: 1, explain: "Le contrôleur n'a personne à qui transmettre : vérifier le nom et le port du Service, puis kubectl get endpoints." }
    ],
    challenge: {
      kind: "script", file: K + "/ingress.yaml", editorLang: "yaml",
      run: ["kubectl apply -f ingress.yaml", "curl -s http://boutique.localhost/api/health", "curl -s http://boutique.localhost/"],
      checkLabel: "Appliquer et tester", checkNote: "apply, puis curl sur boutique.localhost", okMsg: "Bravo : un seul point d'entrée pour le site et l'API.",
      prompt: R`<p>Le site (Deployment et Service @@web@@, port 80) et l'API (Service @@api@@, port 80, routes préfixées par @@/api@@ comme @@/api/health@@) tournent. Écris @@ingress.yaml@@ : un Ingress @@boutique@@ (classe @@nginx@@) pour l'hôte @@boutique.localhost@@ qui envoie les chemins commençant par @@/api@@ vers @@api@@ et tout le reste vers @@web@@.</p>`,
      starter: "apiVersion: networking.k8s.io/v1\nkind: Ingress\nmetadata:\n  name: boutique\nspec:\n  ingressClassName: nginx\n",
      solution: INGRESS,
      setup: withIngress(k8sSetup({ versions: ["1.0"], images: ["nginx:1.27-alpine"], apps: { "1.0": { routes: { "/api/health": [200, '{"status":"ok"}'], "/api/produits": [200, "[]"] } } }, apply: [DEPLOY("1.0", 2) + "---\n" + SERVICE, simple("web", "nginx:1.27-alpine", "          ports:\n            - containerPort: 80\n") + "---\n" + WEB_SVC] })),
      tests: [{ label: "/api va vers l'API, / vers le site", outHas: ['{"status":"ok"}', "Welcome to nginx!"], checks: { k8s: { "ingress/boutique": {} } } }],
      hint: "Une règle (rules) avec host: boutique.localhost et deux chemins sous http.paths : /api (pathType: Prefix, backend.service name: api, port.number: 80), puis / (vers web). Chaque chemin a besoin d'un pathType."
    }
  },
  {
    id: "k8s-09", section: "En production", title: "Une base de données dans le cluster", xp: 110,
    theory: R`<p>Les Pods sont jetables ; les données ne le sont pas. Une base dans Kubernetes demande :</p>
<ul><li>un <strong>PersistentVolumeClaim</strong> (PVC) : une demande de stockage (« 1 Gi, en lecture-écriture par un nœud »), satisfaite par un <em>StorageClass</em> (un disque EBS sur AWS). Le volume survit aux Pods ;</li><li>un seul Pod qui écrit, et la stratégie @@Recreate@@ (l'ancien Pod s'arrête avant que le nouveau ne monte le disque) ; pour plusieurs répliques avec chacune son disque et un nom stable, un <strong>StatefulSet</strong> ;</li><li>un Service devant la base, pour que l'API l'appelle par son nom (@@db:5432@@) ;</li><li>le mot de passe dans un Secret, lu par la base <em>et</em> par l'API.</li></ul>
<p>En production, on préfère souvent une base managée (Amazon RDS) : sauvegardes, mises à jour et haute disponibilité sont alors le problème du fournisseur. Savoir faire tourner PostgreSQL dans le cluster reste utile en développement, en CI et en entretien.</p>`,
    quiz: [
      { q: "Pourquoi la stratégie Recreate pour une base à un seul Pod ?", options: ["Elle est plus rapide", "Un disque ReadWriteOnce ne peut être monté que sur un nœud : l'ancien Pod doit le libérer avant que le nouveau démarre", "RollingUpdate est interdit", "Pour économiser de la mémoire"], answer: 1, explain: "Avec RollingUpdate, le nouveau Pod attendrait le disque tenu par l'ancien." },
      { q: "Base dans le cluster ou base managée (RDS) en production ?", options: ["Toujours dans le cluster", "Souvent managée : sauvegardes, haute disponibilité et mises à jour assurées, au prix d'un coût et d'un contrôle moindres", "Toujours sur un serveur à part", "Ça n'a pas d'importance"], answer: 1, explain: "Une bonne réponse d'entretien pèse les deux, selon l'équipe et les contraintes." }
    ],
    challenge: {
      kind: "script", file: K + "/db.yaml", editorLang: "yaml",
      run: ["kubectl create secret generic db-secrets --from-literal=password=s3cret --from-literal=url=postgresql://boutique:s3cret@db:5432/boutique", "kubectl apply -f db.yaml", "kubectl apply -f api.yaml", "kubectl rollout status deploy/api", "kubectl get pvc,pods"],
      checkLabel: "Déployer la base et l'API", checkNote: "Secret, db.yaml, api.yaml, puis rollout status", okMsg: "Bravo, l'API joint la base par son Service, avec un stockage persistant.",
      prompt: R`<p>L'API (déjà décrite dans @@api.yaml@@) lit @@DATABASE_URL@@ dans le Secret @@db-secrets@@ et se connecte à @@db:5432@@ au démarrage. Le test crée ce Secret (clés @@password@@ et @@url@@), applique ton @@db.yaml@@, puis l'API.</p><p>Écris @@db.yaml@@ (trois documents séparés par @@---@@) :</p><ul><li>un PVC @@pgdata@@ de @@1Gi@@ (@@ReadWriteOnce@@) ;</li><li>un Deployment @@db@@ : 1 réplique, stratégie @@Recreate@@, image @@postgres:16@@, port @@5432@@, @@POSTGRES_USER@@ et @@POSTGRES_DB@@ à @@boutique@@, @@POSTGRES_PASSWORD@@ lu dans le Secret (clé @@password@@), le PVC monté sur @@/var/lib/postgresql/data@@ ;</li><li>un Service @@db@@ sur le port @@5432@@.</li></ul>`,
      starter: "apiVersion: v1\nkind: PersistentVolumeClaim\nmetadata:\n  name: pgdata\n",
      solution: DB,
      setup: k8sSetup({ versions: ["1.0"], images: ["postgres:16"], sources: { "1.0": MAIN_PY_DB }, apps: { "1.0": DB_APP }, files: { [K + "/api.yaml"]: API_DB } }),
      tests: [{ label: "La base démarre et l'API s'y connecte", outHas: 'deployment "api" successfully rolled out', checks: { k8s: { "pvc/pgdata": {}, "svc/db": { endpoints: 1 }, "deploy/db": { rolledOut: true, envFromSecret: "db-secrets" } }, pods: { noCrash: true } } }],
      hint: "Trois documents : PersistentVolumeClaim (spec.accessModes et spec.resources.requests.storage), Deployment (strategy.type: Recreate ; env avec valueFrom.secretKeyRef pour le mot de passe ; volumeMounts dans le conteneur et volumes au niveau du Pod, avec persistentVolumeClaim.claimName: pgdata), Service (selector app: db, port 5432)."
    }
  }
];
