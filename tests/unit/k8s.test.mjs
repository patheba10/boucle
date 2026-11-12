/* Cluster Kubernetes simulé : validation, réconciliation, rollouts, pannes classiques, Services, critères. */
import test from "node:test";
import assert from "node:assert/strict";
import { createShell, evaluate } from "../../public/assets/js/lib/shell/shell.js";

const run = (sh, c) => sh.run(c);
const API = "/home/eleve/api";
const DF = 'FROM python:3.12-slim\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install --no-cache-dir -r requirements.txt\nCOPY . .\nCMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]\n';
const dep = ({ name = "api", replicas = 2, image = "ghcr.io/eleve/boutique-api:1.0", labels = "app: api", tplLabels = labels, extra = "", probe = true } = {}) => `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
spec:
  replicas: ${replicas}
  selector:
    matchLabels:
      ${labels}
  template:
    metadata:
      labels:
        ${tplLabels}
    spec:
      containers:
        - name: ${name}
          image: ${image}
          ports:
            - containerPort: 8000
${probe ? "          readinessProbe:\n            httpGet:\n              path: /health\n              port: 8000\n" : ""}${extra}`;
const svc = (target = 8000, name = "api") => `apiVersion: v1
kind: Service
metadata:
  name: ${name}
spec:
  selector:
    app: ${name}
  ports:
    - port: 80
      targetPort: ${target}
`;
const world = (files = {}, app = {}, k8s = {}) => createShell({
  files: { [API + "/main.py"]: "x\n", [API + "/requirements.txt"]: "fastapi\nuvicorn\n", [API + "/Dockerfile"]: DF, ...files },
  docker: { images: ["python:3.12-slim"], logins: { "ghcr.io": "eleve" }, apps: { [API + "/main.py"]: { requires: ["fastapi"], routes: { "/health": [200, '{"status":"ok"}'] }, ...app } } },
  commands: ["#docker build -q -t ghcr.io/eleve/boutique-api:1.0 " + API, "#docker push ghcr.io/eleve/boutique-api:1.0"],
  k8s, cwd: "/home/eleve"
});
const write = (sh, p, t) => sh.fs.write(sh.abs(p), t, "eleve");

test("apply : création, idempotence, Service, port-forward et curl", () => {
  const sh = world();
  write(sh, "api.yaml", dep() + "---\n" + svc());
  assert.equal(run(sh, "kubectl apply -f api.yaml").out, "deployment.apps/api created\nservice/api created\n");
  assert.equal(run(sh, "kubectl apply -f api.yaml").out, "deployment.apps/api unchanged\nservice/api unchanged\n");
  assert.match(run(sh, "kubectl get pods").out, /^NAME\s+READY\s+STATUS\s+RESTARTS\s+AGE\napi-[a-z0-9]{10}-[a-z0-9]{5}\s+1\/1\s+Running\s+0\s+\d+s\n/);
  assert.match(run(sh, "kubectl get endpoints api").out, /api\s+10\.244\.0\.\d+:8000,10\.244\.0\.\d+:8000/);
  run(sh, "kubectl port-forward svc/api 8080:80");
  assert.equal(run(sh, "curl -s localhost:8080/health").out, '{"status":"ok"}');
  // Un Pod supprimé est recréé par son ReplicaSet.
  const pod = run(sh, "kubectl get pods -o name").out.split("\n")[0];
  run(sh, "kubectl delete " + pod);
  assert.equal(run(sh, "kubectl get pods -o name").out.trim().split("\n").length, 2);
  run(sh, "kubectl scale deploy/api --replicas=4");
  assert.deepEqual(evaluate(sh, { k8s: { "deploy/api": { replicas: 4, rolledOut: true }, "svc/api": { endpoints: 4 } }, pods: { selector: "app=api", running: 4 } }).filter((r) => !r.ok), []);
  assert.equal(run(sh, "kubectl get deploy api -o jsonpath='{.spec.replicas}'").out, "4");
});

test("validation : sélecteur, champ inconnu, type, YAML invalide", () => {
  const sh = world();
  write(sh, "a.yaml", dep({ tplLabels: "app: web" }));
  assert.match(run(sh, "kubectl apply -f a.yaml").err, /The Deployment "api" is invalid: spec.template.metadata.labels: Invalid value: map\[string\]string\{"app":"web"\}: `selector` does not match template `labels`/);
  write(sh, "b.yaml", dep().replace("replicas: 2", "replica: 2"));
  assert.match(run(sh, "kubectl apply -f b.yaml").err, /strict decoding error: unknown field "spec.replica"/);
  write(sh, "c.yaml", dep().replace("containerPort: 8000", 'containerPort: "8000"'));
  assert.match(run(sh, "kubectl apply -f c.yaml").err, /cannot unmarshal string into Go struct field ContainerPort/);
  write(sh, "d.yaml", "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: x\n   labels: {}\n");
  assert.match(run(sh, "kubectl apply -f d.yaml").err, /error converting YAML to JSON: yaml: line \d+/);
  write(sh, "e.yaml", dep().replace("apps/v1", "v1"));
  assert.match(run(sh, "kubectl apply -f e.yaml").err, /no matches for kind "Deployment" in version "v1"/);
  assert.equal(run(sh, "kubectl get deploy").err, "No resources found in default namespace.\n");
});

test("pannes : ImagePullBackOff, CrashLoopBackOff, CreateContainerConfigError, Pending", () => {
  const sh = world({}, { env: ["DATABASE_URL"] });
  write(sh, "img.yaml", dep({ name: "faute", labels: "app: faute", image: "ghcr.io/eleve/boutique-apii:1.0" }));
  run(sh, "kubectl apply -f img.yaml"); run(sh, "kubectl get pods");
  assert.match(run(sh, "kubectl get pods").out, /faute-\S+\s+0\/1\s+ImagePullBackOff/);
  assert.match(run(sh, "kubectl describe pod -l app=faute").out, /Failed to pull image "ghcr.io\/eleve\/boutique-apii:1.0"/);
  run(sh, "kubectl delete deploy faute");
  write(sh, "api.yaml", dep());
  run(sh, "kubectl apply -f api.yaml");
  assert.match(run(sh, "kubectl get pods").out, /api-\S+\s+0\/1\s+CrashLoopBackOff\s+\d+ \(\d+s ago\)/);
  const pod = run(sh, "kubectl get pods -o name").out.split("\n")[0].replace("pod/", "");
  assert.match(run(sh, "kubectl logs " + pod + " --previous").out, /KeyError: 'DATABASE_URL'/);
  assert.match(run(sh, "kubectl describe pod " + pod).out, /Last State:     Terminated\n      Reason:       Error\n      Exit Code:    1/);
  // Secret manquant puis créé.
  write(sh, "api.yaml", dep({ extra: "          env:\n            - name: DATABASE_URL\n              valueFrom:\n                secretKeyRef:\n                  name: db\n                  key: url\n" }));
  run(sh, "kubectl apply -f api.yaml");
  assert.match(run(sh, "kubectl get pods").out, /CreateContainerConfigError/);
  run(sh, "kubectl create secret generic db --from-literal=url=postgresql://u:p@db/boutique");
  assert.match(run(sh, "kubectl get secret db -o yaml").out, /url: cG9zdGdyZXNxbDovL3U6cEBkYi9ib3V0aXF1ZQ==/);
  assert.equal(run(sh, "kubectl rollout status deploy/api").out, 'deployment "api" successfully rolled out\n');
  // Ressources demandées trop grosses : Pending.
  write(sh, "gros.yaml", dep({ name: "gros", labels: "app: gros", probe: false, extra: "          resources:\n            requests:\n              memory: 8Gi\n" }));
  run(sh, "kubectl apply -f gros.yaml");
  assert.match(run(sh, "kubectl get pods -l app=gros").out, /0\/1\s+Pending/);
  assert.match(run(sh, "kubectl describe pods -l app=gros").out, /FailedScheduling\s+.*0\/1 nodes are available: 1 Insufficient memory/);
});

test("Services : mauvais targetPort, DNS entre Pods, sonde de disponibilité", () => {
  const sh = world({}, {}, {});
  write(sh, "api.yaml", dep() + "---\n" + svc(80));
  run(sh, "kubectl apply -f api.yaml");
  run(sh, "kubectl port-forward svc/api 8080:80");
  assert.match(run(sh, "curl localhost:8080/health").err, /curl: \(52\) Empty reply from server/);
  write(sh, "api.yaml", dep() + "---\n" + svc(8000));
  assert.match(run(sh, "kubectl apply -f api.yaml").out, /service\/api configured/);
  assert.equal(run(sh, "kubectl run t --rm -it --image=alpine:3.20 --restart=Never -- wget -qO- http://api/health").out, '{"status":"ok"}pod "t" deleted\n');
  // Sonde qui échoue : le Pod tourne mais ne reçoit pas de trafic.
  write(sh, "api.yaml", dep().replace("path: /health", "path: /sante") + "---\n" + svc(8000));
  run(sh, "kubectl apply -f api.yaml");
  assert.match(run(sh, "kubectl get pods").out, /0\/1\s+Running/);
  assert.match(run(sh, "kubectl describe pods").out, /Readiness probe failed: HTTP probe failed with statuscode: 404/);
});

test("base de données dans le cluster : l'API rejoint le Service postgres par son nom", () => {
  const sh = world({}, { env: ["DATABASE_URL"], deps: [{ env: "DATABASE_URL" }] }, { images: ["postgres:16"] });
  write(sh, "db.yaml", "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: db\nspec:\n  selector:\n    matchLabels:\n      app: db\n  template:\n    metadata:\n      labels:\n        app: db\n    spec:\n      containers:\n        - name: db\n          image: postgres:16\n          env:\n            - name: POSTGRES_PASSWORD\n              value: pw\n          ports:\n            - containerPort: 5432\n---\napiVersion: v1\nkind: Service\nmetadata:\n  name: db\nspec:\n  selector:\n    app: db\n  ports:\n    - port: 5432\n");
  write(sh, "api.yaml", dep({ extra: "          env:\n            - name: DATABASE_URL\n              value: postgresql://postgres:pw@db:5432/postgres\n" }));
  run(sh, "kubectl apply -f api.yaml");
  assert.match(run(sh, "kubectl logs deploy/api").out, /could not translate host name "db" to address/);
  run(sh, "kubectl apply -f db.yaml");
  run(sh, "kubectl get pods");
  assert.deepEqual(evaluate(sh, { pods: { selector: "app=api", running: 2 }, k8s: { "deploy/api": { rolledOut: true } } }).filter((r) => !r.ok), []);
});

test("rollout : historique, échec puis retour arrière, restart", () => {
  const sh = world();
  write(sh, "api.yaml", dep({ replicas: 4 }));
  run(sh, "kubectl apply -f api.yaml");
  run(sh, "kubectl set image deploy/api api=ghcr.io/eleve/boutique-api:2.0");
  const pods = run(sh, "kubectl get pods").out;
  assert.equal((pods.match(/1\/1\s+Running/g) || []).length, 3, pods); // maxUnavailable 25 % de 4 : un ancien Pod remplacé
  assert.match(pods, /ImagePullBackOff/);
  assert.equal(run(sh, "kubectl rollout status deploy/api").code, 1);
  assert.match(run(sh, "kubectl rollout history deploy/api").out, /REVISION  CHANGE-CAUSE\n1         <none>\n2         <none>/);
  run(sh, "kubectl rollout undo deploy/api");
  assert.equal(run(sh, "kubectl rollout status deploy/api").out, 'deployment "api" successfully rolled out\n');
  assert.match(run(sh, "kubectl rollout history deploy/api").out, /2         <none>\n3         <none>/);
  assert.equal(run(sh, "kubectl rollout restart deploy/api").out, "deployment.apps/api restarted\n");
  assert.deepEqual(evaluate(sh, { k8s: { "deploy/api": { rolledOut: true, image: "ghcr.io/eleve/boutique-api:1.0", revision: 4 } } }).filter((r) => !r.ok), []);
});

test("ConfigMap, namespaces, expose, dry-run, droits RBAC", () => {
  const sh = world();
  assert.equal(run(sh, "kubectl create namespace boutique").out, "namespace/boutique created\n");
  run(sh, "kubectl create configmap reglages --from-literal=APP_ENV=production -n boutique");
  assert.match(run(sh, "kubectl describe cm reglages -n boutique").out, /APP_ENV:\n----\nproduction/);
  assert.match(run(sh, "kubectl create deployment web --image=nginx:1.27-alpine --dry-run=client -o yaml").out, /kind: Deployment\n[\s\S]*image: nginx:1.27-alpine/);
  run(sh, "kubectl create deployment web --image=nginx:1.27-alpine --port=80 -n boutique");
  assert.equal(run(sh, "kubectl expose deployment web --port=80 --type=NodePort -n boutique").out, "service/web exposed\n");
  assert.match(run(sh, "kubectl get svc -n boutique").out, /web\s+NodePort\s+10\.96\.\S+\s+<none>\s+80:3\d{4}\/TCP/);
  assert.equal(run(sh, "kubectl get pods").err, "No resources found in default namespace.\n");
  assert.match(run(sh, "kubectl get pods -A").out, /^NAMESPACE\s+NAME/);
  write(sh, "rbac.yaml", "apiVersion: rbac.authorization.k8s.io/v1\nkind: Role\nmetadata:\n  name: lecteur\n  namespace: boutique\nrules:\n  - apiGroups: [\"\"]\n    resources: [\"pods\"]\n    verbs: [\"get\", \"list\"]\n---\napiVersion: rbac.authorization.k8s.io/v1\nkind: RoleBinding\nmetadata:\n  name: lecteur\n  namespace: boutique\nsubjects:\n  - kind: ServiceAccount\n    name: ci\n    namespace: boutique\nroleRef:\n  kind: Role\n  name: lecteur\n  apiGroup: rbac.authorization.k8s.io\n");
  run(sh, "kubectl apply -f rbac.yaml");
  assert.equal(run(sh, "kubectl auth can-i list pods -n boutique --as=system:serviceaccount:boutique:ci").out, "yes\n");
  assert.equal(run(sh, "kubectl auth can-i delete pods -n boutique --as=system:serviceaccount:boutique:ci").out, "no\n");
  assert.equal(createShell({}).run("kubectl get pods").code, 127);
});
