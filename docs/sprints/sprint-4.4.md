# Sprint 4.4

**Objectif** : un cluster Kubernetes simulé dans le terminal (`kubectl`), puis le cours Kubernetes.

| Story | Points | Statut |
|-------|--------|--------|
| #33 US-4.2 Cluster Kubernetes simulé (enabler) | 8 | Terminé |
| #34 US-4c Cours Kubernetes | 8 | En cours |

**Capacité** : 16 points. Le sprint court sur plusieurs sessions : le journal ci-dessous dit où reprendre.

## Conception du simulateur

- `lib/k8s/` se branche sur le terminal Linux comme `lib/docker/` : commande `kubectl` (et `helm` plus tard), critères déclaratifs, mise en place `setup.k8s`.
- `manifest.js` : lecture des manifests YAML (js-yaml, plusieurs documents par fichier), validation comme l'API server (champs requis, types, `selector` qui correspond aux `labels` du gabarit, ports nommés, `apiVersion`/`kind` connus), messages réels de `kubectl apply`.
- `cluster.js` : objets (Namespace, Pod, Deployment, ReplicaSet, Service, ConfigMap, Secret, Ingress, PVC, HPA, ServiceAccount, Role, RoleBinding) et boucle de réconciliation : Deployment → ReplicaSet (hash du gabarit) → Pods ; rollouts avec `maxSurge`/`maxUnavailable`, historique et `rollout undo` ; Services → endpoints selon les labels et la readiness ; ordonnanceur avec requêtes de ressources (Pending si le nœud est plein).
- Les conteneurs des Pods tournent dans le moteur Docker du simulateur (`lib/docker/engine.js`) : mêmes images, mêmes comportements d'application (port, routes, variables requises, base de données), donc `CrashLoopBackOff`, `ImagePullBackOff`, sondes qui échouent et `kubectl logs` réalistes sans tout réécrire.
- `kubectl.js` : `apply -f`, `get` (`-o wide|yaml|json`, `-l`, `-A`, `-w` non simulé), `describe` (avec événements), `logs` (`--previous`), `exec`, `delete`, `scale`, `set image`, `rollout status|history|undo|restart`, `port-forward` (pour `curl`), `create`, `expose`, `top` (non simulé au départ), `auth can-i`. Sorties au format de kubectl 1.31.

## Journal

- 12 nov. (nuit) : branche `us-4.2/cluster-k8s` créée, conception ci-dessus. Prochaine étape : `manifest.js` et `cluster.js`, puis tests unitaires.
- 12 nov. (nuit) : `lib/k8s/cluster.js` écrit (validation, réconciliation Deployment → ReplicaSet → Pods, rollouts, sondes, CrashLoopBackOff, ImagePullBackOff, Pending, DNS des Services, HPA). Pas encore testé. Prochaine étape : `lib/k8s/kubectl.js` (commandes, sorties, critères, branchement au terminal), puis tests unitaires.
- 12 nov. (nuit) : `lib/k8s/kubectl.js` écrit et branché (apply, get, describe, logs, exec, delete, scale, set, rollout, expose, port-forward, run, create, auth can-i ; critères `k8s` et `pods` ; `kind load docker-image`). Premier scénario OK : apply Deployment + Service, port-forward, curl, set image vers une image absente (ImagePullBackOff, anciens Pods gardés), rollout undo. Prochaine étape : tests unitaires (`tests/unit/k8s.test.mjs`), puis PR #33.
- 12 nov. (nuit) : 7 tests unitaires Kubernetes verts (apply et idempotence, validation, ImagePullBackOff, CrashLoopBackOff, CreateContainerConfigError, Pending, targetPort, DNS, sondes, base de données, rollouts, ConfigMap, namespaces, expose, RBAC). Prochaine étape : panneau du terminal pour Kubernetes (optionnel), documentation, PR #33 ; puis le cours (#34).
- 12 nov. (nuit) : PR #45 (cluster) fusionnée, #33 fermée. Branche `us-4c/kubernetes` pour le cours (#34). Les objets `setup.k8s.apply` sont créés après les commandes de mise en place.
