/* Cours Kubernetes : images de l'API (déjà construites et poussées sur ghcr.io) et manifests réutilisés. */
import { MAIN_PY, MAIN_PY_ENV, REQS, DOCKERFILE, apiApp } from "../docker/commun.js";
export { R } from "../linux/tag.js";

export const IMG = "ghcr.io/eleve/boutique-api";
export const K = "/home/eleve/k8s";
const SRC = "/opt/src/boutique-api-";
const version = (v) => ({ "/version": [200, '{"version":"' + v + '"}'] });

/** Mise en place : trois versions de l'API dans le registre (1.0, 1.1, et une 2.0 qui plante sans PAYMENT_URL). */
export function k8sSetup({ files = {}, apply = [], images = [], apps = {}, cwd = K, versions = ["1.0", "1.1", "2.0"] } = {}) {
  const src = {}; const app = {}; const cmds = [];
  for (const v of versions) {
    src[SRC + v + "/main.py"] = v === "2.0" ? MAIN_PY_ENV.replace(/APP_ENV/g, "PAYMENT_URL") : MAIN_PY;
    src[SRC + v + "/requirements.txt"] = REQS; src[SRC + v + "/Dockerfile"] = DOCKERFILE;
    app[SRC + v + "/main.py"] = apiApp({ routes: { "/health": [200, '{"status":"ok"}'], ...version(v), ...(v === "2.0" ? {} : {}) }, ...(v === "2.0" ? { env: ["PAYMENT_URL"] } : {}), ...(apps[v] || {}) });
    cmds.push("#docker build -q -t " + IMG + ":" + v + " " + SRC + v, "#docker push " + IMG + ":" + v);
  }
  return {
    files: { ...src, [K + "/.gitkeep"]: "", ...files },
    docker: { images: ["python:3.12-slim", ...images], logins: { "ghcr.io": "eleve" }, apps: { ...app, ...(apps.extra || {}) } },
    commands: cmds, k8s: { images, apply }, cwd
  };
}

export const DEPLOY = (v = "1.0", replicas = 3) => `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  labels:
    app: api
spec:
  replicas: ${replicas}
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: ${IMG}:${v}
          ports:
            - name: http
              containerPort: 8000
`;
export const SERVICE = `apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  selector:
    app: api
  ports:
    - port: 80
      targetPort: http
`;
