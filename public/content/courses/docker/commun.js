/* Cours Docker : gabarit et petite application FastAPI réutilisée par les défis. */
export { R } from "../linux/tag.js";

export const API = "/home/eleve/api";
export const MAIN_PY = `from fastapi import FastAPI

app = FastAPI(title="Boutique")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/produits")
def produits():
    return [{"id": 1, "nom": "Clavier", "prix": 49.9}, {"id": 2, "nom": "Souris", "prix": 19.9}]
`;
export const REQS = "fastapi==0.115.6\nuvicorn==0.32.1\n";
export const DOCKERFILE = `FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
`;
const HEALTH = '{"status":"ok"}';
/** Variante qui lit sa configuration au démarrage (ligne 5) : sans APP_ENV, elle plante. */
export const MAIN_PY_ENV = `import os
from fastapi import FastAPI

app = FastAPI(title="Boutique")
app_env = os.environ["APP_ENV"]


@app.get("/health")
def health():
    return {"status": "ok", "env": app_env}
`;
/** Variante reliée à PostgreSQL : elle vérifie la connexion au démarrage (lignes 7 et 9). */
export const MAIN_PY_DB = `import os

import psycopg2
from fastapi import FastAPI

app = FastAPI(title="Boutique")
database_url = os.environ["DATABASE_URL"]
# Connexion vérifiée au démarrage : sans base joignable, l'API ne démarre pas.
conn = psycopg2.connect(database_url)


@app.get("/health")
def health():
    return {"status": "ok"}
`;
export const REQS_DB = "fastapi==0.115.6\nuvicorn==0.32.1\npsycopg2-binary==2.9.10\n";
export const DB_APP = { env: ["DATABASE_URL"], deps: [{ env: "DATABASE_URL" }], envLine: 7, dbLine: 9 };
const PRODUITS = '[{"id":1,"nom":"Clavier","prix":49.9},{"id":2,"nom":"Souris","prix":19.9}]';

/** Comportement simulé de l'application : rattaché au fichier source, il suit ce fichier dans les images. */
export const apiApp = (extra = {}) => ({ requires: ["fastapi"], routes: { "/health": [200, HEALTH], "/produits": [200, PRODUITS] }, ...extra });

/** Mise en place : le projet de l'API dans ~/api, Docker installé avec quelques images déjà téléchargées. */
export const apiSetup = ({ files = {}, images = [], app = {}, dockerfile = DOCKERFILE, commands = [], cwd = API } = {}) => ({
  files: { [API + "/main.py"]: MAIN_PY, [API + "/requirements.txt"]: REQS, ...(dockerfile ? { [API + "/Dockerfile"]: dockerfile } : {}), ...files },
  docker: { images: ["python:3.12-slim", ...images], apps: { [API + "/main.py"]: apiApp(app) } },
  commands, cwd
});

/** Images disponibles pour les extraits de théorie. */
export const SNIPPETS = { docker: { images: ["alpine:3.20", "nginx:1.27-alpine", "python:3.12-slim", "postgres:16", "redis:7-alpine"] } };
