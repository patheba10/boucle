/* Simulateur Docker : construction, cache, lint, conteneurs, ports, réseaux, volumes, registre, Compose, critères. */
import test from "node:test";
import assert from "node:assert/strict";
import { createShell, evaluate } from "../../public/assets/js/lib/shell/shell.js";
import { lint } from "../../public/assets/js/lib/docker/dockerfile.js";

const run = (sh, c) => sh.run(c);
const API = "/home/eleve/api";
const DF = 'FROM python:3.12-slim\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install --no-cache-dir -r requirements.txt\nCOPY . .\nEXPOSE 8000\nCMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]\n';
const world = (extra = {}, dockerExtra = {}) => createShell({
  files: { [API + "/main.py"]: "from fastapi import FastAPI\n", [API + "/requirements.txt"]: "fastapi==0.115.6\nuvicorn==0.32.1\n", [API + "/Dockerfile"]: DF, ...extra },
  docker: { images: ["python:3.12-slim"], apps: { [API + "/main.py"]: { requires: ["fastapi"], routes: { "/health": [200, '{"status":"ok"}'], "/env": [200, "{env.APP_ENV}"] } } }, ...dockerExtra },
  cwd: API
});

test("build : étapes, cache, taille, .dockerignore", () => {
  const sh = world({ [API + "/.venv/lib/torch.so"]: { content: "x", bytes: 180e6 } });
  const b = run(sh, "docker build -t api:1.0 .");
  assert.equal(b.code, 0);
  assert.match(b.err, /\[4\/5\] RUN pip install --no-cache-dir -r requirements.txt/);
  assert.match(b.err, /transferring context: 180MB/);
  assert.match(run(sh, "docker images").out, /api\s+1\.0\s+\w{12}\s+.*\s3\d\dMB/);
  // Modifier le code ne relance pas l'installation des dépendances.
  run(sh, "echo '# v2' >> main.py");
  const b2 = run(sh, "docker build -t api:1.0 .");
  assert.match(b2.err, /CACHED \[4\/5\] RUN pip/);
  assert.doesNotMatch(b2.err, /CACHED \[5\/5\]/);
  // Le .dockerignore exclut le virtualenv : contexte et image fondent.
  run(sh, "printf '.venv\\n.git\\n__pycache__\\n' > .dockerignore");
  run(sh, "docker build -t api:1.1 .");
  assert.deepEqual(evaluate(sh, { images: { "api:1.1": { maxMB: 200, lacksFile: "/app/.venv" }, "api:1.0": { hasFile: "/app/.venv/lib/torch.so" } } }).filter((r) => !r.ok), []);
  assert.match(run(sh, "docker images").out, /<none>\s+<none>/);
  assert.match(run(sh, "docker history api:1.1").out, /RUN \/bin\/sh -c pip install --no-cache-dir -r…/);
});

test("build : erreurs de BuildKit avec extrait du Dockerfile", () => {
  const sh = world({ [API + "/Dockerfile"]: 'FROM python:3.12-slim\nWORKDIR /app\nRUN pip install -r requirements.txt\nCOPY . .\nCMD python main.py\n' });
  const b = run(sh, "docker build -t api .");
  assert.equal(b.code, 1);
  assert.match(b.err, /ERROR \[3\/4\] RUN pip install -r requirements.txt/);
  assert.match(b.err, /ERROR: Could not open requirements file: \[Errno 2\] No such file or directory: 'requirements.txt'/);
  assert.match(b.err, /   3 \| >>> RUN pip install -r requirements.txt/);
  assert.match(b.err, /ERROR: failed to solve: process "\/bin\/sh -c pip install -r requirements.txt" did not complete successfully: exit code: 1/);
  assert.match(b.err, /JSONArgsRecommended: JSON arguments recommended for CMD/);
  run(sh, "printf 'FROM python:3.12-slim\\nRUN apt-get install -y curl\\n' > Dockerfile");
  assert.match(run(sh, "docker build .").err, /E: Unable to locate package curl/);
  run(sh, "printf 'FROM python:3.12-alpine\\nRUN apt-get update\\n' > Dockerfile");
  assert.match(run(sh, "docker build .").err, /\/bin\/sh: apt-get: not found/);
  run(sh, "printf 'FROM python:3.12-slim\\nCOPY app.py /app/\\n' > Dockerfile");
  assert.match(run(sh, "docker build .").err, /failed to compute cache key: failed to calculate checksum of ref \w+::\w+: "\/app.py": not found/);
  run(sh, "printf 'FROM pyhton:3.12\\n' > Dockerfile");
  assert.match(run(sh, "docker build .").err, /pull access denied, repository does not exist/);
  assert.match(run(sh, "docker build").err, /requires exactly 1 argument/);
});

test("hadolint : codes et messages réels", () => {
  const f = lint("FROM python:latest\nADD . /app\nRUN apt-get update && apt-get install -y curl\nRUN pip install flask\nUSER root\nCMD python app.py\n").map((x) => x.code);
  assert.deepEqual(f, ["DL3007", "DL3020", "DL3008", "DL3009", "DL3015", "DL3013", "DL3042", "DL3059", "DL3002", "DL3025"]);
  assert.deepEqual(lint(DF), []);
  const sh = world({ [API + "/Dockerfile"]: "FROM ubuntu\nRUN cd /app && make\n" });
  const r = run(sh, "hadolint Dockerfile");
  assert.equal(r.code, 1);
  assert.equal(r.out, "Dockerfile:1 DL3006 warning: Always tag the version of an image explicitly\nDockerfile:2 DL3003 warning: Use WORKDIR to switch to a directory\n");
});

test("multi-étapes et utilisateur non root", () => {
  const sh = world({ [API + "/Dockerfile"]: "FROM python:3.12 AS build\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install --no-cache-dir --prefix=/install -r requirements.txt\n\nFROM python:3.12-slim\nCOPY --from=build /app/requirements.txt /app/requirements.txt\nRUN pip install --no-cache-dir -r /app/requirements.txt\nRUN useradd --create-home app\nWORKDIR /app\nCOPY --chown=app:app . .\nUSER app\nCMD [\"uvicorn\", \"main:app\", \"--host\", \"0.0.0.0\"]\n" });
  const b = run(sh, "docker build -t api:2 .");
  assert.equal(b.code, 0, b.err);
  assert.match(b.err, /\[build 1\/4\] FROM docker.io\/library\/python:3.12@/);
  assert.match(b.err, /\[stage-1 2\/6\] COPY --from=build/);
  assert.deepEqual(evaluate(sh, { images: { "api:2": { nonRoot: true, base: "python:3.12-slim", maxMB: 200 } } }).filter((r) => !r.ok), []);
  run(sh, "docker run -d --name api api:2");
  assert.equal(run(sh, "docker exec api whoami").out, "app\n");
  assert.equal(run(sh, "docker run --rm -u nobody2 api:2").code, 126);
});

test("conteneurs : ports, 127.0.0.1, conflits, journaux, exec", () => {
  const sh = world();
  run(sh, "docker build -t api .");
  run(sh, "docker run -d -p 8080:8000 -e APP_ENV=prod --name api api");
  assert.equal(run(sh, "curl -s localhost:8080/health").out, '{"status":"ok"}');
  assert.equal(run(sh, "curl -s localhost:8080/env").out, "prod");
  assert.match(run(sh, "docker ps").out, /0\.0\.0\.0:8080->8000\/tcp, \[::\]:8080->8000\/tcp\s+api\n/);
  const dup = run(sh, "docker run -d -p 8080:8000 --name api2 api");
  assert.equal(dup.code, 125); assert.match(dup.err, /Bind for 0\.0\.0\.0:8080 failed: port is already allocated/);
  assert.match(run(sh, "docker run -d --name api api").err, /Conflict\. The container name "\/api" is already in use/);
  assert.match(run(sh, "docker rm api").err, /container is running: stop the container before removing or force remove/);
  // Mauvais port publié, ou application liée à 127.0.0.1 : la connexion est réinitialisée.
  run(sh, "docker run -d -p 9000:80 --name mauvais-port api");
  assert.match(run(sh, "curl localhost:9000/health").err, /curl: \(56\) Recv failure: Connection reset by peer/);
  run(sh, "docker run -d -p 9001:8000 --name local api uvicorn main:app");
  assert.match(run(sh, "curl localhost:9001/health").err, /\(56\)/);
  assert.match(run(sh, "docker logs local").out, /Uvicorn running on http:\/\/127\.0\.0\.1:8000/);
  assert.match(run(sh, "docker exec api curl -s localhost:8000/health").err, /exec: "curl": executable file not found in \$PATH/);
  assert.equal(run(sh, "docker exec api printenv APP_ENV").out, "prod\n");
  assert.match(run(sh, "docker logs api").out, /"GET \/health HTTP\/1\.1" 200 OK/);
  run(sh, "docker stop api");
  assert.match(run(sh, "curl localhost:8080/health").err, /Couldn't connect to server/);
  assert.match(run(sh, "docker ps -a").out, /Exited \(0\)/);
  run(sh, "docker rm api");
  assert.deepEqual(evaluate(sh, { containers: { api: null, "mauvais-port": { state: "running", ports: ["9000:80"] } } }).filter((r) => !r.ok), []);
});

test("plantages : module manquant, variable absente, fichier introuvable, port de l'hôte occupé", () => {
  const sh = world({}, { apps: { [API + "/main.py"]: { requires: ["fastapi"], env: ["DATABASE_URL"], routes: {} } } });
  run(sh, "printf 'FROM python:3.12-slim\\nWORKDIR /app\\nRUN pip install --no-cache-dir uvicorn\\nCOPY . .\\nCMD [\"uvicorn\", \"main:app\", \"--host\", \"0.0.0.0\"]\\n' > Dockerfile");
  run(sh, "docker build -t api .");
  run(sh, "docker run -d --name a1 api");
  assert.match(run(sh, "docker logs a1").out, /ModuleNotFoundError: No module named 'fastapi'/);
  assert.match(run(sh, "docker ps -a").out, /Exited \(1\)/);
  run(sh, "docker build -t api2 -f Dockerfile .");
  run(sh, "printf 'FROM python:3.12-slim\\nWORKDIR /app\\nCOPY . .\\nRUN pip install --no-cache-dir -r requirements.txt\\nCMD [\"uvicorn\", \"main:app\", \"--host\", \"0.0.0.0\"]\\n' > Dockerfile");
  run(sh, "docker build -t api3 .");
  run(sh, "docker run -d --name a3 api3");
  assert.match(run(sh, "docker logs a3").out, /KeyError: 'DATABASE_URL'/);
  assert.match(run(sh, "docker run --rm api3 python app.py").out, /can't open file '\/app\/app.py': \[Errno 2\] No such file or directory/);
  assert.match(run(sh, "docker run --rm api3 gunicorn app:app").err, /exec: "gunicorn": executable file not found in \$PATH/);
  run(sh, "sudo apt install -y nginx");
  assert.match(run(sh, "docker run -d -p 80:80 nginx:1.27").err, /address already in use/);
});

test("réseaux : pas de DNS sur bridge, DNS sur un réseau utilisateur ; volumes persistants", () => {
  const sh = createShell({ files: { "/home/eleve/app/app.py": "import psycopg2\n" }, docker: { images: ["postgres:16", "python:3.12-slim"], apps: { "/home/eleve/app/app.py": { deps: [{ env: "DATABASE_URL" }], routes: { "/": [200, "ok"] }, port: 8000, host: "0.0.0.0" } } }, cwd: "/home/eleve/app" });
  assert.match(run(sh, "docker run -d --name db postgres:16").out, /^\w{64}\n$/);
  assert.match(run(sh, "docker logs db").out, /superuser password is not specified/);
  run(sh, "docker rm db");
  run(sh, "docker run -d --name db -e POSTGRES_PASSWORD=pw -v pgdata:/var/lib/postgresql/data postgres:16");
  run(sh, "printf 'FROM python:3.12-slim\\nWORKDIR /app\\nCOPY app.py .\\nCMD [\"python\", \"app.py\"]\\n' > Dockerfile");
  run(sh, "docker build -t app .");
  run(sh, "docker run -d --name app1 -e DATABASE_URL=postgresql://postgres:pw@db:5432/postgres app");
  assert.match(run(sh, "docker logs app1").out, /could not translate host name "db" to address/);
  run(sh, "docker run -d --name app0 -e DATABASE_URL=postgresql://postgres:pw@localhost:5432/postgres app");
  assert.match(run(sh, "docker logs app0").out, /connection to server at "localhost" \(127\.0\.0\.1\), port 5432 failed: Connection refused/);
  run(sh, "docker network create boutique");
  run(sh, "docker network connect boutique db");
  run(sh, "docker run -d --name app2 --network boutique -e DATABASE_URL=postgresql://postgres:mauvais@db:5432/postgres app");
  assert.match(run(sh, "docker logs app2").out, /password authentication failed for user "postgres"/);
  run(sh, "docker run -d --name app3 --network boutique -p 8000:8000 -e DATABASE_URL=postgresql://postgres:pw@db:5432/postgres app");
  assert.equal(run(sh, "curl -s localhost:8000/").out, "ok");
  // Le volume survit au conteneur : pas de réinitialisation.
  run(sh, "docker rm -f db");
  run(sh, "docker run -d --name db2 -v pgdata:/var/lib/postgresql/data postgres:16");
  assert.match(run(sh, "docker logs db2").out, /Skipping initialization/);
  assert.match(run(sh, "docker volume rm pgdata").err, /volume is in use/);
  assert.deepEqual(evaluate(sh, { volumes: ["pgdata"], networks: ["boutique"], containers: { app3: { state: "running", network: "boutique" }, db2: { volume: { pgdata: "/var/lib/postgresql/data" } } } }).filter((r) => !r.ok), []);
});

test("restart : un conteneur qui plante redémarre et se rétablit quand sa dépendance arrive", () => {
  const sh = createShell({ files: { "/home/eleve/app/app.py": "x\n" }, docker: { images: ["postgres:16", "python:3.12-slim"], apps: { "/home/eleve/app/app.py": { deps: [{ env: "DATABASE_URL" }], routes: { "/": [200, "ok"] }, host: "0.0.0.0" } } }, cwd: "/home/eleve/app" });
  run(sh, "printf 'FROM python:3.12-slim\\nCOPY app.py .\\nCMD [\"python\", \"app.py\"]\\n' > Dockerfile");
  run(sh, "docker build -t app . && docker network create net");
  run(sh, "docker run -d --name app --network net --restart unless-stopped -e DATABASE_URL=postgresql://postgres:pw@db/postgres app");
  assert.match(run(sh, "docker ps").out, /Restarting \(1\)/);
  run(sh, "docker run -d --name db --network net -e POSTGRES_PASSWORD=pw postgres:16");
  assert.match(run(sh, "docker ps").out, /Up [^\n]+\s+app\n/);
});

test("bind mount en lecture seule, nginx, registre", () => {
  const sh = createShell({ files: { "/home/eleve/site/index.html": "<h1>Boutique</h1>\n" }, docker: { images: ["nginx:1.27-alpine"] }, cwd: "/home/eleve/site" });
  run(sh, "docker run -d --name web -p 8080:80 -v \"$PWD\":/usr/share/nginx/html:ro nginx:1.27-alpine");
  assert.equal(run(sh, "curl -s localhost:8080").out, "<h1>Boutique</h1>\n");
  run(sh, "echo '<h1>Soldes</h1>' > index.html");
  assert.equal(run(sh, "curl -s localhost:8080/").out, "<h1>Soldes</h1>\n");
  assert.match(run(sh, "docker exec web touch /usr/share/nginx/html/x").err, /Read-only file system/);
  assert.match(run(sh, "docker logs web").out, /"GET \/ HTTP\/1\.1" 200/);
  assert.match(run(sh, "docker push nginx:1.27-alpine").err, /denied: requested access to the resource is denied/);
  run(sh, "docker tag nginx:1.27-alpine eleve/site:1.0");
  assert.match(run(sh, "docker push eleve/site:1.0").err, /denied/);
  assert.equal(run(sh, "echo jeton | docker login -u eleve --password-stdin").out, "\nLogin Succeeded\n");
  const p = run(sh, "docker push eleve/site:1.0");
  assert.equal(p.code, 0); assert.match(p.out, /1\.0: digest: sha256:\w{64} size: \d+/);
  assert.deepEqual(evaluate(sh, { pushed: ["eleve/site:1.0"], containers: { web: { readOnly: ["/usr/share/nginx/html"] } }, http: { "http://localhost:8080/": [200, "Soldes"] } }).filter((r) => !r.ok), []);
});

test("Compose : interpolation, healthcheck, DNS des services, down -v, validation", () => {
  const P = "/home/eleve/boutique";
  const sh = createShell({
    files: {
      [P + "/api/main.py"]: "x\n", [P + "/api/requirements.txt"]: "fastapi\nuvicorn\npsycopg2-binary\n",
      [P + "/api/Dockerfile"]: DF.replace(', "--port", "8000"', ""), [P + "/.env"]: "DB_PASSWORD=s3cret\n",
      [P + "/compose.yaml"]: 'services:\n  api:\n    build: ./api\n    ports:\n      - "8000:8000"\n    environment:\n      DATABASE_URL: postgresql://boutique:${DB_PASSWORD}@db:5432/boutique\n    depends_on:\n      db:\n        condition: service_healthy\n  db:\n    image: postgres:16\n    environment:\n      POSTGRES_USER: boutique\n      POSTGRES_PASSWORD: ${DB_PASSWORD}\n      POSTGRES_DB: boutique\n    volumes:\n      - pgdata:/var/lib/postgresql/data\n    healthcheck:\n      test: ["CMD-SHELL", "pg_isready -U boutique"]\nvolumes:\n  pgdata:\n'
    },
    docker: { images: ["python:3.12-slim", "postgres:16"], apps: { [P + "/api/main.py"]: { requires: ["fastapi"], env: ["DATABASE_URL"], deps: [{ env: "DATABASE_URL" }], routes: { "/health": [200, '{"status":"ok"}'] } } } },
    cwd: P
  });
  const up = run(sh, "docker compose up -d");
  assert.equal(up.code, 0, up.err);
  assert.match(up.err, / ✔ Container boutique-db-1\s+Healthy/);
  assert.equal(run(sh, "curl -s localhost:8000/health").out, '{"status":"ok"}');
  assert.match(run(sh, "docker compose ps").out, /boutique-api-1\s+boutique-api\s+"uvicorn main:app --…"\s+api/);
  assert.equal(run(sh, "docker compose exec db pg_isready").out, "/var/run/postgresql:5432 - accepting connections\n");
  assert.match(run(sh, "docker compose config").out, /DATABASE_URL: postgresql:\/\/boutique:s3cret@db:5432\/boutique/);
  assert.match(run(sh, "docker compose up -d").err, /Container boutique-api-1\s+Running/);
  run(sh, "docker compose down -v");
  assert.deepEqual(evaluate(sh, { noVolumes: ["boutique_pgdata"], containers: { "boutique-api-1": null } }).filter((r) => !r.ok), []);
  // Erreurs de validation au format de Compose.
  run(sh, "sed -i 's/    ports:/    port:/' compose.yaml");
  assert.match(run(sh, "docker compose up -d").err, /validating \/home\/eleve\/boutique\/compose.yaml: services.api additional properties 'port' not allowed/);
  run(sh, "sed -i 's/    port:/    ports:/; s/condition: service_healthy/condition: service_started/' compose.yaml");
  run(sh, "sed -i '/healthcheck:/d; /test: /d' compose.yaml");
  run(sh, "sed -i 's/      - pgdata:/      - donnees:/' compose.yaml");
  assert.match(run(sh, "docker compose up -d").err, /service "db" refers to undefined volume donnees: invalid compose project/);
  run(sh, "rm compose.yaml");
  assert.match(run(sh, "docker compose ps").err, /no configuration file provided: not found/);
});

test("droits : sans le groupe docker, permission refusée", () => {
  const sh = createShell({ docker: { group: false } });
  assert.match(run(sh, "docker ps").err, /permission denied while trying to connect to the Docker daemon socket/);
  assert.equal(run(sh, "sudo docker ps").code, 0);
  run(sh, "sudo usermod -aG docker eleve");
  assert.equal(run(sh, "docker ps").code, 0);
  assert.equal(createShell({}).run("docker ps").code, 127);
});

test("défi « fichier » : un Dockerfile testé par une suite de commandes", async () => {
  const { runScriptTests } = await import("../../public/assets/js/lib/shterm.js");
  const ch = { file: API + "/Dockerfile", run: ["docker build -t api:1.0 .", "docker run -d --name api -p 8080:8000 api:1.0", "curl -s localhost:8080/health"],
    setup: { files: { [API + "/main.py"]: "x\n", [API + "/requirements.txt"]: "fastapi\nuvicorn\n" }, docker: { images: ["python:3.12-slim"], apps: { [API + "/main.py"]: { requires: ["fastapi"], routes: { "/health": [200, "ok"] } } } }, cwd: API },
    tests: [{ outHas: "ok", checks: { containers: { api: { status: "running" } } } }] };
  assert.equal(runScriptTests(ch, DF)[0].ok, true);
  assert.equal(runScriptTests(ch, DF.replace('"--host", "0.0.0.0", ', ""))[0].ok, false);
});
