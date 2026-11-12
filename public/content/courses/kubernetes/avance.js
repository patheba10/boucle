/* Cours Kubernetes — chapitre 4 : mise à l'échelle, droits et Helm, entretien. */
import { R, IMG, K, k8sSetup, DEPLOY, SERVICE } from "./commun.js";

const NS = "apiVersion: v1\nkind: Namespace\nmetadata:\n  name: boutique\n";
const RBAC = `apiVersion: v1
kind: ServiceAccount
metadata:
  name: ci
  namespace: boutique
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: deployer
  namespace: boutique
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get", "list", "patch", "update"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: deployer
  namespace: boutique
subjects:
  - kind: ServiceAccount
    name: ci
    namespace: boutique
roleRef:
  kind: Role
  name: deployer
  apiGroup: rbac.authorization.k8s.io
`;
const AS = "--as=system:serviceaccount:boutique:ci -n boutique";

export default [
  {
    id: "k8s-10", section: "Aller plus loin", title: "Mise à l'échelle et autoscaling", xp: 90,
    theory: R`<p>Trois niveaux d'élasticité :</p>
<ul><li>à la main : @@kubectl scale deploy/api --replicas=5@@ (ou @@replicas@@ dans le YAML) ;</li><li><strong>HorizontalPodAutoscaler</strong> (HPA) : ajuste le nombre de répliques pour viser une utilisation moyenne du CPU (ou de la mémoire, ou une métrique métier), entre un minimum et un maximum. Il se base sur les <em>requests</em> : sans requests CPU, il ne peut rien calculer. Il lui faut aussi <em>metrics-server</em> (@@kubectl top pods@@ doit marcher) ;</li><li>l'<strong>autoscaler de cluster</strong> (ou Karpenter sur AWS) ajoute des nœuds quand des Pods restent @@Pending@@ faute de place, et en retire quand ils sont vides.</li></ul>
~~~sh
kubectl create deployment web --image=nginx:1.27-alpine --replicas=2
kubectl scale deploy/web --replicas=4
kubectl get deploy web
kubectl autoscale deploy web --min=2 --max=8 --cpu-percent=70
kubectl get hpa
~~~
<p>Calcul de l'HPA : répliques voulues = arrondi supérieur de (répliques actuelles × utilisation actuelle ÷ cible). À 4 répliques chargées à 140 % pour une cible de 70 %, il en veut 8. L'application doit donc être <strong>sans état</strong> : n'importe quelle réplique peut répondre à n'importe quelle requête.</p>`,
    quiz: [
      { q: "Un HPA affiche « cpu: <unknown>/70% ». Causes probables ?", options: ["Le Deployment n'existe pas", "metrics-server absent, ou conteneurs sans requests CPU : l'HPA ne peut pas calculer d'utilisation", "La cible est trop haute", "Le cluster a un seul nœud"], answer: 1, explain: "L'utilisation est un pourcentage des requests ; sans elles ou sans métriques, pas de calcul." },
      { q: "4 répliques à 140 % de CPU pour une cible de 70 %. Combien l'HPA en veut-il ?", options: ["4", "6", "8", "2"], answer: 2, explain: "⌈4 × 140 / 70⌉ = 8 (dans la limite de maxReplicas)." }
    ],
    challenge: {
      prompt: R`<p>Les soldes arrivent. Pour le Deployment @@api@@ (2 répliques, requests CPU de @@100m@@) :</p><ol><li>passe-le d'abord à <strong>4</strong> répliques à la main ;</li><li>puis crée un HPA : entre <strong>3</strong> et <strong>10</strong> répliques, cible <strong>60 %</strong> de CPU ;</li><li>regarde @@kubectl top pods@@ et @@kubectl get hpa@@ : la charge actuelle est faible, l'HPA ramène le Deployment à son minimum.</li></ol>`,
      setup: k8sSetup({ versions: ["1.0"], apply: [DEPLOY("1.0", 2).replace("              containerPort: 8000\n", "              containerPort: 8000\n          resources:\n            requests:\n              cpu: 100m\n              memory: 128Mi\n") + "---\n" + SERVICE] }),
      checks: { k8s: { "hpa/api": {}, "deploy/api": { replicas: 3, rolledOut: true } } },
      solution: ["kubectl scale deploy/api --replicas=4", "kubectl get deploy api", "kubectl autoscale deploy api --min=3 --max=10 --cpu-percent=60", "kubectl top pods", "kubectl get hpa", "kubectl get deploy api"],
      hint: "kubectl scale deploy/api --replicas=4, puis kubectl autoscale deploy api --min=3 --max=10 --cpu-percent=60."
    }
  },
  {
    id: "k8s-11", section: "Aller plus loin", title: "Droits (RBAC) et Helm", xp: 100,
    theory: R`<p><strong>RBAC</strong> : par défaut, un compte n'a aucun droit. On accorde le strict nécessaire :</p>
<ul><li>un <strong>ServiceAccount</strong> est l'identité d'un programme (un Pod, le pipeline de CI) ;</li><li>un <strong>Role</strong> liste des permissions dans un namespace : des <em>verbes</em> (@@get@@, @@list@@, @@watch@@, @@create@@, @@update@@, @@patch@@, @@delete@@) sur des <em>ressources</em> (@@pods@@, @@deployments@@ dans le groupe d'API @@apps@@…) ; un <strong>ClusterRole</strong> vaut pour tout le cluster ;</li><li>un <strong>RoleBinding</strong> donne un Role à des sujets (utilisateurs, groupes, ServiceAccounts) ;</li><li>@@kubectl auth can-i VERBE RESSOURCE --as=…@@ vérifie le résultat.</li></ul>
<p><strong>Helm</strong> est le gestionnaire de paquets de Kubernetes. Un <em>chart</em> est un ensemble de manifests à trous (des gabarits) remplis par un fichier @@values.yaml@@ ; chaque installation est une <em>release</em> versionnée :</p>
~~~text
helm repo add bitnami https://charts.bitnami.com/bitnami
helm install cache bitnami/redis --set auth.enabled=false -n boutique
helm upgrade cache bitnami/redis -f valeurs-prod.yaml
helm rollback cache 1
helm list -A
~~~
<p>Helm n'est pas simulé ici : refais ces commandes sur ton cluster kind. Kustomize (intégré à @@kubectl apply -k@@) est l'alternative sans gabarits : une base et des surcouches par environnement.</p>`,
    quiz: [
      { q: "Le pipeline de CI doit mettre à jour l'image d'un Deployment dans le namespace boutique. Quel droit lui donner ?", options: ["cluster-admin", "Un Role dans boutique avec get, list, patch et update sur deployments, lié à son ServiceAccount", "Tous les droits sur les Secrets", "Aucun : kubectl n'a pas besoin de droits"], answer: 1, explain: "Le moindre privilège : un namespace, une ressource, les verbes nécessaires." },
      { q: "À quoi sert values.yaml dans un chart Helm ?", options: ["À stocker les logs", "À remplir les gabarits du chart (image, répliques, ressources) sans modifier le chart", "À définir les droits", "À lister les nœuds"], answer: 1, explain: "Un même chart, des fichiers de valeurs par environnement." }
    ],
    challenge: {
      kind: "script", file: K + "/rbac.yaml", editorLang: "yaml",
      run: ["kubectl apply -f rbac.yaml", "kubectl auth can-i patch deployments " + AS, "kubectl auth can-i list pods " + AS, "kubectl auth can-i delete pods " + AS, "kubectl auth can-i get secrets " + AS],
      checkLabel: "Appliquer et vérifier", checkNote: "apply, puis kubectl auth can-i", okMsg: "Bravo : la CI peut déployer, et rien de plus.",
      prompt: R`<p>Le pipeline de CI va déployer dans le namespace @@boutique@@ avec un ServiceAccount @@ci@@. Écris @@rbac.yaml@@ (trois documents) :</p><ul><li>le ServiceAccount @@ci@@ ;</li><li>un Role @@deployer@@ : lire les Pods (@@get@@, @@list@@, @@watch@@) et lire et mettre à jour les Deployments (@@get@@, @@list@@, @@patch@@, @@update@@, groupe @@apps@@) ;</li><li>un RoleBinding @@deployer@@ qui donne ce Role à @@ci@@.</li></ul><p>Rien d'autre : pas de suppression, pas d'accès aux Secrets.</p>`,
      starter: "apiVersion: v1\nkind: ServiceAccount\nmetadata:\n  name: ci\n  namespace: boutique\n",
      solution: RBAC,
      setup: k8sSetup({ versions: [], apply: [NS] }),
      tests: [{ label: "patch deployments : oui ; delete pods et get secrets : non", outHas: ["deployments " + AS + "\nyes", "list pods " + AS + "\nyes", "delete pods " + AS + "\nno", "get secrets " + AS + "\nno"], checks: { k8s: { "sa/ci": { namespace: "boutique" }, "role/deployer": { namespace: "boutique" }, "rolebinding/deployer": { namespace: "boutique" } } } }],
      hint: "Role : rules avec deux entrées, apiGroups [\"\"] pour pods, [\"apps\"] pour deployments, chacune avec ses resources et verbs. RoleBinding : subjects (kind: ServiceAccount, name: ci, namespace: boutique) et roleRef (kind: Role, name: deployer, apiGroup: rbac.authorization.k8s.io)."
    }
  },
  {
    id: "k8s-12", section: "Entretien", title: "Questions d'entretien Kubernetes", xp: 60, theoryOnly: true,
    theory: R`<p>Kubernetes est au cœur des postes DevOps, SRE et cloud, et de la certification CKA. Réponds à voix haute avant d'ouvrir chaque réponse.</p>
<div class="qa">
<details><summary>Décris l'architecture de Kubernetes.</summary><p>Un plan de contrôle : API server (point d'entrée unique, authentification, validation), etcd (stockage de l'état voulu), scheduler (placement des Pods), controller manager (boucles de réconciliation : Deployments, ReplicaSets, nœuds…). Sur chaque nœud : kubelet (lance et surveille les conteneurs), runtime (containerd), kube-proxy (règles réseau des Services), et un plugin réseau (CNI).</p></details>
<details><summary>Que se passe-t-il quand tu fais kubectl apply d'un Deployment ?</summary><p>kubectl envoie l'objet à l'API server, qui l'authentifie, le valide et l'enregistre dans etcd. Le contrôleur de Deployment crée un ReplicaSet, qui crée les Pods. Le scheduler leur attribue un nœud. Le kubelet de ce nœud tire l'image, lance les conteneurs et rapporte leur état. Les Endpoints des Services se mettent à jour quand les Pods deviennent prêts.</p></details>
<details><summary>Pod, Deployment, StatefulSet, DaemonSet, Job : quand utiliser quoi ?</summary><p>Deployment pour les applications sans état ; StatefulSet quand chaque réplique a une identité et un disque à elle (bases, Kafka) ; DaemonSet pour un Pod par nœud (agents de logs ou de métriques) ; Job et CronJob pour des tâches qui se terminent. Un Pod seul, presque jamais.</p></details>
<details><summary>readiness ou liveness ?</summary><p>La readiness dit si le Pod peut recevoir du trafic (sinon il sort des Endpoints) ; la liveness s'il faut le redémarrer. La liveness ne doit pas dépendre d'un service externe, sinon une panne de base fait redémarrer toute l'API en boucle.</p></details>
<details><summary>Un Pod est en CrashLoopBackOff. Ta démarche ?</summary><p>@@kubectl describe pod@@ (événements, code de sortie, OOMKilled), @@kubectl logs --previous@@ (trace de l'application). Causes fréquentes : configuration ou secret manquant, dépendance injoignable, mauvaise commande, mémoire insuffisante (137). Corriger le manifest, réappliquer, suivre @@rollout status@@.</p></details>
<details><summary>Comment fonctionne un Service ?</summary><p>Il a une IP virtuelle stable et un nom DNS ; ses Endpoints listent les Pods prêts qui correspondent à son sélecteur ; kube-proxy (iptables ou IPVS) répartit les connexions entre eux. ClusterIP pour l'interne, NodePort et LoadBalancer pour l'extérieur, et un Ingress pour router du HTTP vers plusieurs Services.</p></details>
<details><summary>requests et limits ?</summary><p>Les requests servent au placement (réservées sur le nœud) et à l'autoscaling ; les limits plafonnent. Dépasser la limite mémoire tue le conteneur (OOMKilled) ; dépasser la limite CPU le ralentit. Requests et limits égales donnent la classe QoS Guaranteed, la dernière évincée en cas de pression.</p></details>
<details><summary>Comment faire une mise à jour sans coupure, et revenir en arrière ?</summary><p>RollingUpdate avec maxSurge et maxUnavailable, une readinessProbe fiable, plusieurs répliques, et un arrêt propre (SIGTERM géré, @@preStop@@ si besoin). Pour revenir : @@kubectl rollout undo@@, ou revert du commit dans un modèle GitOps. Pour limiter le risque : canary ou blue-green (Argo Rollouts, un service mesh).</p></details>
<details><summary>Comment gérer les secrets ?</summary><p>Les Secrets sont seulement encodés en base64 : RBAC strict, chiffrement d'etcd au repos, et jamais en clair dans Git. Sealed Secrets, ou External Secrets Operator branché sur AWS Secrets Manager ou Vault ; sur EKS, IRSA ou Pod Identity pour que les Pods obtiennent des droits AWS sans clé.</p></details>
<details><summary>Qu'est-ce que GitOps ?</summary><p>L'état voulu du cluster vit dans un dépôt Git ; un agent dans le cluster (Argo CD, Flux) l'applique et corrige toute dérive. On déploie par pull request, l'historique Git est l'historique des déploiements, et revenir en arrière, c'est un revert.</p></details>
</div>`,
    practice: { title: "S'entraîner", body: R`<p>Choisis trois questions et réponds en deux minutes chacune. Puis, sur ta machine avec kind : déploie l'API du cours Docker avec un Deployment, un Service, un Ingress, des sondes et un HPA, et pousse les manifests dans un dépôt. Avec un pipeline GitHub Actions qui construit l'image et applique les manifests, c'est un projet complet à présenter en entretien.</p>` },
    quiz: [
      { q: "Quelle est la différence entre un Deployment et un StatefulSet ?", options: ["Aucune", "Le StatefulSet donne à chaque réplique une identité stable (nom, ordre) et son propre volume : bases de données, files de messages", "Le StatefulSet n'a qu'une réplique", "Le Deployment ne gère pas les mises à jour"], answer: 1, explain: "db-0, db-1, db-2 gardent leur nom et leur disque d'un redémarrage à l'autre." },
      { q: "Les Pods d'un Deployment tournent, mais le Service n'a aucun Endpoint. Que vérifier en premier ?", options: ["La version de Kubernetes", "Que le sélecteur du Service correspond aux labels des Pods, et que les Pods sont prêts (readiness)", "Le nombre de nœuds", "L'Ingress"], answer: 1, explain: "kubectl get pods --show-labels et kubectl describe svc." }
    ]
  }
];
