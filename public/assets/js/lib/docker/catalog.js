/* Images de base et paquets connus du simulateur Docker.
   Tailles décompressées, telles que `docker images` les affiche (Docker Hub, fin 2026, arrondies). */

const MB = 1e6;

/* os : famille (apt, apk ou rien) ; bins : programmes présents ; users : comptes déjà créés. */
const DEBIAN = { os: "debian", pkg: "apt", shell: true, bins: ["sh", "bash", "ls", "cat", "env", "id", "whoami", "mkdir", "rm", "chown", "chmod", "useradd", "groupadd", "adduser", "addgroup", "apt-get", "pwd", "echo", "printenv"] };
const ALPINE = { os: "alpine", pkg: "apk", shell: true, bins: ["sh", "ls", "cat", "env", "id", "whoami", "mkdir", "rm", "chown", "chmod", "adduser", "addgroup", "apk", "pwd", "echo", "printenv", "wget"] };
const PY = ["python", "python3", "pip", "pip3"];
const NODE = ["node", "npm", "npx"];

function img(base, size, extra = {}) { return { ...base, size: size * MB, users: ["root"], env: {}, cmd: null, entrypoint: null, exposes: [], workdir: "/", created: "3 weeks ago", ...extra, bins: [...base.bins, ...(extra.bins || [])] }; }
const py = (size, base, v = "3.12.8") => img(base, size, { bins: PY, env: { PYTHON_VERSION: v, PATH: "/usr/local/bin:/usr/local/sbin:/usr/sbin:/usr/bin:/sbin:/bin" }, cmd: ["python3"] });
const node = (size, base) => img(base, size, { bins: NODE, users: ["root", "node"], env: { NODE_VERSION: "20.18.1" }, cmd: ["node"] });
const nginx = (size, base) => img(base, size, { bins: ["nginx"], cmd: ["nginx", "-g", "daemon off;"], exposes: [80], app: "nginx", files: { "/usr/share/nginx/html/index.html": "<!DOCTYPE html>\n<html>\n<head>\n<title>Welcome to nginx!</title>\n</head>\n<body>\n<h1>Welcome to nginx!</h1>\n</body>\n</html>\n", "/etc/nginx/conf.d/default.conf": "server {\n    listen       80;\n    server_name  localhost;\n    location / {\n        root   /usr/share/nginx/html;\n        index  index.html index.htm;\n    }\n}\n" } });

export const IMAGES = {
  "python:3.12": py(1020, DEBIAN), "python:3.12-slim": py(130, DEBIAN), "python:3.12-alpine": py(57.4, ALPINE),
  "python:3.13": py(1020, DEBIAN, "3.13.1"), "python:3.13-slim": py(126, DEBIAN, "3.13.1"), "python:3.13-alpine": py(52.9, ALPINE, "3.13.1"),
  "python:latest": py(1020, DEBIAN, "3.13.1"),
  "node:20": node(1100, DEBIAN), "node:20-slim": node(200, DEBIAN), "node:20-alpine": node(135, ALPINE), "node:22-alpine": node(160, ALPINE), "node:latest": node(1120, DEBIAN),
  "nginx:1.27": nginx(192, DEBIAN), "nginx:1.27-alpine": nginx(47.9, ALPINE), "nginx:latest": nginx(192, DEBIAN), "nginx:alpine": nginx(47.9, ALPINE),
  "alpine:3.20": img(ALPINE, 7.8, { cmd: ["/bin/sh"] }), "alpine:latest": img(ALPINE, 7.8, { cmd: ["/bin/sh"] }),
  "ubuntu:24.04": img(DEBIAN, 78.1, { os: "ubuntu", cmd: ["/bin/bash"] }), "ubuntu:latest": img(DEBIAN, 78.1, { os: "ubuntu", cmd: ["/bin/bash"] }),
  "debian:bookworm-slim": img(DEBIAN, 74.8, { cmd: ["bash"] }),
  "busybox:1.36": img(ALPINE, 4.3, { os: "busybox", pkg: null, cmd: ["sh"] }), "busybox:latest": img(ALPINE, 4.3, { os: "busybox", pkg: null, cmd: ["sh"] }),
  "postgres:16": img(DEBIAN, 432, { users: ["root", "postgres"], env: { PGDATA: "/var/lib/postgresql/data" }, cmd: ["postgres"], exposes: [5432], app: "postgres", bins: ["postgres", "psql", "pg_isready"] }),
  "postgres:16-alpine": img(ALPINE, 243, { users: ["root", "postgres"], env: { PGDATA: "/var/lib/postgresql/data" }, cmd: ["postgres"], exposes: [5432], app: "postgres", bins: ["postgres", "psql", "pg_isready"] }),
  "redis:7": img(DEBIAN, 117, { users: ["root", "redis"], cmd: ["redis-server"], exposes: [6379], app: "redis", bins: ["redis-server", "redis-cli"] }),
  "redis:7-alpine": img(ALPINE, 41.2, { users: ["root", "redis"], cmd: ["redis-server"], exposes: [6379], app: "redis", bins: ["redis-server", "redis-cli"] }),
  "gcr.io/distroless/python3-debian12": img({ os: "distroless", pkg: null, shell: false, bins: [] }, 52.8, { bins: PY.slice(0, 2), entrypoint: ["/usr/bin/python3.11"] }),
  "gcr.io/distroless/python3-debian12:nonroot": img({ os: "distroless", pkg: null, shell: false, bins: [] }, 52.8, { bins: PY.slice(0, 2), users: ["root", "nonroot"], user: "nonroot", entrypoint: ["/usr/bin/python3.11"] }),
  "hello-world:latest": img({ os: "scratch", pkg: null, shell: false, bins: ["hello"] }, 0.0131, { cmd: ["/hello"], app: "hello" })
};
for (const [ref, i] of Object.entries(IMAGES)) i.ref = ref;

/** Nom canonique : « python » → « python:latest », « docker.io/library/nginx:1.27 » → « nginx:1.27 ». */
export function canon(ref) {
  let r = String(ref).replace(/^docker\.io\/(library\/)?/, "");
  const at = r.indexOf("@"); if (at > 0) r = r.slice(0, at);
  const slash = r.lastIndexOf("/"); if (r.indexOf(":", slash + 1) < 0) r += ":latest";
  return r;
}
/** Nom complet affiché par BuildKit : docker.io/library/python:3.12-slim. */
export function fullName(ref) { const c = canon(ref); return /^[^/]+\.[^/]+\//.test(c) ? c : "docker.io/" + (c.includes("/") ? "" : "library/") + c; }

/* Tailles approximatives (Mo) des paquets installés. */
export const APT = { curl: 15, "ca-certificates": 1, git: 45, "build-essential": 240, gcc: 120, "libpq-dev": 12, "postgresql-client": 18, vim: 40, wget: 4, gnupg: 9, tzdata: 3, "python3-dev": 30, procps: 2 };
export const APT_RECOMMENDS = { curl: 2, git: 1.6, "build-essential": 1.4, gcc: 1.3, vim: 1.2, "python3-dev": 2 };
export const APK = { curl: 3.2, git: 18, "build-base": 210, gcc: 105, "postgresql-client": 6, "libpq-dev": 4, bash: 1.6, tzdata: 3 };
export const PIP = { fastapi: 4, uvicorn: 1.5, "uvicorn[standard]": 9, flask: 4, gunicorn: 1, requests: 2, sqlalchemy: 14, "psycopg2-binary": 9, "psycopg[binary]": 12, pydantic: 7, pandas: 70, numpy: 38, "scikit-learn": 45, pytest: 6, redis: 2.5, httpx: 2, "python-dotenv": 0.2 };
export const NPM = { express: 2.2, pg: 0.8, redis: 1.4, jest: 30, nodemon: 6, dotenv: 0.1 };
/* Dépendances tirées par chaque paquet pip (pour que « import pydantic » marche après « pip install fastapi »). */
export const PIP_DEPS = { fastapi: ["pydantic", "starlette"], "uvicorn[standard]": ["uvicorn"], flask: ["werkzeug", "jinja2"], "psycopg[binary]": ["psycopg"], "scikit-learn": ["numpy", "scipy"], pandas: ["numpy"], httpx: [], requests: ["urllib3"] };
/* Module Python importé → paquet pip. */
export const MODULE_PKG = { psycopg2: "psycopg2-binary", sklearn: "scikit-learn", dotenv: "python-dotenv", yaml: "pyyaml" };

/** « 186MB », « 1.02GB », « 13.1kB », comme la CLI Docker (puissances de 10). */
export function human(bytes) {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(bytes >= 1e10 ? 1 : 2).replace(/\.?0+$/, "") + "GB";
  if (bytes >= 1e6) return (bytes >= 1e8 ? Math.round(bytes / 1e6) : +(bytes / 1e6).toFixed(1)) + "MB";
  if (bytes >= 1e3) return +(bytes / 1e3).toFixed(1) + "kB";
  return Math.round(bytes) + "B";
}
