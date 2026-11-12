# Sprint 4.4

**Objectif** : un cluster Kubernetes simulé dans le terminal (`kubectl`), puis le cours Kubernetes.

| Story | Points | Statut |
|-------|--------|--------|
| #33 US-4.2 Cluster Kubernetes simulé (enabler) | 8 | En cours |
| #34 US-4c Cours Kubernetes | 8 | À faire |

**Capacité** : 16 points. Le sprint court sur plusieurs sessions : le journal ci-dessous dit où reprendre.

## Conception du simulateur

- `lib/k8s/` se branche sur le terminal Linux comme `lib/docker/` : commande `kubectl` (et `helm` plus tard), critères déclaratifs, mise en place `setup.k8s`.
- `manifest.js` : lecture des manifests YAML (js-yaml, plusieurs documents par fichier), validation comme l'API server (champs requis, types, `selector` qui correspond aux `labels` du gabarit, ports nommés, `apiVersion`/`kind` connus), messages réels de `kubectl apply`.
- `cluster.js` : objets (Namespace, Pod, Deployment, ReplicaSet, Service, ConfigMap, Secret, Ingress, PVC, HPA, ServiceAccount, Role, RoleBinding) et boucle de réconciliation : Deployment → ReplicaSet (hash du gabarit) → Pods ; rollouts avec `maxSurge`/`maxUnavailable`, historique et `rollout undo` ; Services → endpoints selon les labels et la readiness ; ordonnanceur avec requêtes de ressources (Pending si le nœud est plein).
- Les conteneurs des Pods tournent dans le moteur Docker du simulateur (`lib/docker/engine.js`) : mêmes images, mêmes comportements d'application (port, routes, variables requises, base de données), donc `CrashLoopBackOff`, `ImagePullBackOff`, sondes qui échouent et `kubectl logs` réalistes sans tout réécrire.
- `kubectl.js` : `apply -f`, `get` (`-o wide|yaml|json`, `-l`, `-A`, `-w` non simulé), `describe` (avec événements), `logs` (`--previous`), `exec`, `delete`, `scale`, `set image`, `rollout status|history|undo|restart`, `port-forward` (pour `curl`), `create`, `expose`, `top` (non simulé au départ), `auth can-i`. Sorties au format de kubectl 1.31.

## Journal

- 12 nov. (nuit) : branche `us-4.2/cluster-k8s` créée, conception ci-dessus. Prochaine étape : `manifest.js` et `cluster.js`, puis tests unitaires.
