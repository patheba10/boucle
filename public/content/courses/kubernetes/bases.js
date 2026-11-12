/* Cours Kubernetes — chapitre 1 : architecture, Pods, Deployments, Services. */
import { R, IMG, K, k8sSetup, DEPLOY, SERVICE } from "./commun.js";

export default [
  {
    id: "k8s-01", section: "Les bases", title: "Architecture et premiers Pods", xp: 70,
    theory: R`<p>Docker lance des conteneurs sur <em>une</em> machine. <strong>Kubernetes</strong> les orchestre sur un <em>cluster</em> : il choisit où les placer, les relance quand ils tombent, les met à jour sans coupure et répartit le trafic.</p>
<ul><li>le <strong>plan de contrôle</strong> : l'<em>API server</em> (tout passe par lui, @@kubectl@@ compris), <em>etcd</em> (la base qui stocke l'état voulu), le <em>scheduler</em> (place les Pods sur les nœuds), le <em>controller manager</em> (les boucles qui corrigent l'écart entre l'état voulu et l'état réel) ;</li><li>les <strong>nœuds</strong> : le <em>kubelet</em> (lance les conteneurs demandés et les surveille), le runtime (containerd), <em>kube-proxy</em> (le réseau des Services).</li></ul>
<p>Le principe central est <strong>déclaratif</strong> : on ne dit pas « lance trois conteneurs », on décrit « je veux trois répliques », et les contrôleurs <strong>réconcilient</strong> sans fin la réalité avec cette description. Un Pod meurt ? Il est remplacé.</p>
<p>Le <strong>Pod</strong> est la plus petite unité : un ou plusieurs conteneurs qui partagent une adresse IP et des volumes. On le crée rarement à la main, mais c'est ce qui tourne.</p>
~~~sh
kubectl get nodes
kubectl run web --image=nginx:1.27-alpine --port=80
kubectl get pods -o wide
kubectl describe pod web
kubectl delete pod web
~~~
<p>Le cluster de ce cours est un cluster <strong>kind</strong> d'un seul nœud, @@boucle-control-plane@@, comme celui que tu installeras sur ta machine.</p>`,
    setup: R`<p><strong>Sur ta machine</strong> : installe @@kubectl@@ et <strong>kind</strong> (Kubernetes dans Docker), puis @@kind create cluster --name boucle@@ et @@kubectl get nodes@@. Docker Desktop propose aussi un cluster intégré (Settings → Kubernetes).</p>`,
    quiz: [
      { q: "Quel composant décide sur quel nœud un nouveau Pod va tourner ?", options: ["etcd", "Le scheduler", "kube-proxy", "Le kubelet"], answer: 1, explain: "Le scheduler choisit un nœud selon les ressources disponibles et les contraintes ; le kubelet de ce nœud lance ensuite les conteneurs." },
      { q: "Que veut dire « Kubernetes est déclaratif » ?", options: ["On écrit des scripts de commandes", "On décrit l'état voulu, et des contrôleurs corrigent en continu l'écart avec l'état réel", "Il faut déclarer chaque conteneur à la main", "Les fichiers sont en JSON"], answer: 1, explain: "C'est la boucle de réconciliation : un Pod supprimé est recréé parce que l'état voulu dit qu'il doit exister." }
    ],
    challenge: {
      prompt: R`<p>Premiers pas dans le cluster :</p><ol><li>crée un namespace @@boutique@@ (un espace de noms isole les objets d'une équipe ou d'un projet) ;</li><li>lances-y un Pod @@web@@ avec l'image @@nginx:1.27-alpine@@, port @@80@@ ;</li><li>vérifie qu'il tourne avec @@kubectl get pods -n boutique@@.</li></ol>`,
      setup: { docker: { images: ["nginx:1.27-alpine"] }, k8s: { images: ["nginx:1.27-alpine"] } },
      checks: { k8s: { "ns/boutique": {}, "pod/web": { namespace: "boutique" } }, pods: { namespace: "boutique", running: 1 } },
      solution: ["kubectl get nodes", "kubectl create namespace boutique", "kubectl run web --image=nginx:1.27-alpine --port=80 -n boutique", "kubectl get pods -n boutique"],
      hint: "kubectl create namespace boutique, puis kubectl run web --image=nginx:1.27-alpine --port=80 -n boutique. Sans -n, kubectl travaille dans le namespace default."
    }
  },
  {
    id: "k8s-02", section: "Les bases", title: "Deployments et ReplicaSets", xp: 95,
    theory: R`<p>Un Pod créé à la main n'est relancé par personne. En production, on décrit un <strong>Deployment</strong> : un gabarit de Pod et un nombre de <strong>répliques</strong>. Le Deployment crée un <strong>ReplicaSet</strong>, qui maintient le bon nombre de Pods.</p>
~~~text
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api          # les Pods que ce Deployment gère…
  template:
    metadata:
      labels:
        app: api        # …doivent porter ces labels
    spec:
      containers:
        - name: api
          image: ghcr.io/eleve/boutique-api:1.0
          ports:
            - name: http
              containerPort: 8000
~~~
<ul><li>les <strong>labels</strong> sont des étiquettes ; les <strong>sélecteurs</strong> s'en servent pour relier les objets entre eux. Le sélecteur doit correspondre aux labels du gabarit, sinon l'API refuse le Deployment ;</li><li>@@kubectl apply -f fichier.yaml@@ crée ou met à jour ; relancé sans changement, il répond « unchanged » : c'est idempotent, comme Ansible ou Terraform ;</li><li>@@kubectl get deploy,rs,pods@@ montre les trois étages ; un Pod supprimé est aussitôt remplacé.</li></ul>`,
    quiz: [
      { q: "Tu supprimes un Pod géré par un Deployment de 3 répliques. Que se passe-t-il ?", options: ["Il reste 2 Pods", "Le ReplicaSet en recrée un aussitôt pour revenir à 3", "Le Deployment est supprimé", "Le cluster redémarre"], answer: 1, explain: "L'état voulu (3 répliques) n'a pas changé : la réconciliation recrée le Pod manquant." },
      { q: "L'API refuse un Deployment avec « selector does not match template labels ». Que corriger ?", options: ["L'image", "Faire correspondre spec.selector.matchLabels et spec.template.metadata.labels", "Le nombre de répliques", "Le namespace"], answer: 1, explain: "Sans correspondance, le Deployment ne pourrait jamais retrouver les Pods qu'il crée." }
    ],
    challenge: {
      kind: "script", file: K + "/deployment.yaml", editorLang: "yaml",
      run: ["kubectl apply -f deployment.yaml", "kubectl rollout status deploy/api", "kubectl get deploy,pods"],
      checkLabel: "Appliquer", checkNote: "kubectl apply -f, puis kubectl rollout status", okMsg: "Bravo, le Deployment tourne avec ses trois répliques.",
      prompt: R`<p>Écris @@deployment.yaml@@ : un Deployment @@api@@ avec <strong>3 répliques</strong> de l'image @@${IMG}:1.0@@. Le conteneur, nommé @@api@@, écoute sur le port @@8000@@ (donne-lui le nom @@http@@). Les Pods portent le label @@app: api@@.</p>`,
      starter: "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: api\nspec:\n",
      solution: DEPLOY("1.0", 3),
      setup: k8sSetup({ versions: ["1.0"] }),
      tests: [{ label: "kubectl apply, puis trois Pods prêts", outHas: "deployment.apps/api", checks: { k8s: { "deploy/api": { replicas: 3, rolledOut: true, image: IMG + ":1.0" } }, pods: { selector: "app=api", running: 3 } } }],
      hint: "Quatre blocs sous spec : replicas, selector.matchLabels (app: api), template.metadata.labels (app: api) et template.spec.containers (name, image, ports avec name: http et containerPort: 8000). Attention à l'indentation : deux espaces par niveau, et un tiret devant chaque élément de liste."
    }
  },
  {
    id: "k8s-03", section: "Les bases", title: "Services et DNS", xp: 95,
    theory: R`<p>Les Pods sont éphémères : chacun a sa propre IP, qui change à chaque remplacement. Un <strong>Service</strong> donne une adresse <strong>stable</strong> (et un nom DNS) devant un groupe de Pods choisis par sélecteur, et répartit le trafic entre ceux qui sont <strong>prêts</strong>.</p>
~~~text
apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  selector:
    app: api
  ports:
    - port: 80            # port du Service
      targetPort: http    # port (ou nom de port) du conteneur
~~~
<ul><li>dans le cluster, n'importe quel Pod joint @@http://api@@ (même namespace) ou @@http://api.boutique.svc.cluster.local@@ ;</li><li>@@kubectl get endpoints api@@ montre les IP des Pods derrière le Service : une liste vide signale un sélecteur ou un label faux, ou des Pods pas prêts ;</li><li>depuis ta machine, @@kubectl port-forward svc/api 8080:80@@ ouvre un tunnel pour tester avec @@curl localhost:8080@@ ;</li><li>types : @@ClusterIP@@ (interne, par défaut), @@NodePort@@ (un port de chaque nœud), @@LoadBalancer@@ (un équilibreur du fournisseur cloud).</li></ul>
<p>Pour tester depuis l'intérieur du cluster : @@kubectl run test --rm -it --image=alpine:3.20 --restart=Never -- wget -qO- http://api/health@@.</p>`,
    quiz: [
      { q: "kubectl get endpoints api affiche <none>. Cause probable ?", options: ["Le Service est de type ClusterIP", "Aucun Pod prêt ne correspond au sélecteur du Service (label faux, ou Pods pas prêts)", "Le port 80 est interdit", "Il manque un Ingress"], answer: 1, explain: "Les Endpoints sont la liste des Pods prêts qui correspondent au sélecteur." },
      { q: "Le Service a port: 80 et targetPort: 8000. Sur quel port les autres Pods appellent-ils l'API ?", options: ["8000", "80, sur le nom du Service", "30080", "443"], answer: 1, explain: "Les clients parlent au Service sur son port (80) ; il transmet au port 8000 des conteneurs." }
    ],
    challenge: {
      kind: "script", file: K + "/service.yaml", editorLang: "yaml",
      run: ["kubectl apply -f service.yaml", "kubectl get endpoints api", "kubectl port-forward svc/api 8080:80", "curl -s localhost:8080/health"],
      checkLabel: "Appliquer et tester", checkNote: "apply, port-forward, puis curl", okMsg: "Bravo, le Service répartit le trafic entre les trois Pods.",
      prompt: R`<p>Le Deployment @@api@@ de la leçon précédente tourne (3 Pods, label @@app: api@@, port de conteneur nommé @@http@@, numéro @@8000@@). Écris @@service.yaml@@ : un Service @@api@@ qui expose ces Pods sur le port @@80@@.</p>`,
      starter: "apiVersion: v1\nkind: Service\nmetadata:\n  name: api\nspec:\n  ports:\n    - port: 80\n",
      solution: SERVICE,
      setup: k8sSetup({ versions: ["1.0"], apply: [DEPLOY("1.0", 3)] }),
      tests: [{ label: "Le Service a trois Endpoints et /health répond", outHas: '{"status":"ok"}', checks: { k8s: { "svc/api": { endpoints: 3 } } } }],
      hint: "Il manque le sélecteur (selector: app: api) pour trouver les Pods, et targetPort: http (ou 8000) pour joindre le conteneur."
    }
  }
];
