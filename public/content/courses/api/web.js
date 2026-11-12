/* Cours API — chapitre 1 et 2 : HTTP et REST, appeler une API, puis construire une API avec FastAPI. */

const LAB = `<p><strong>Sur ta machine</strong> : @@python -m venv .venv@@, active-le, puis @@pip install "fastapi[standard]"@@. Mets l'application dans @@main.py@@ et lance @@fastapi dev main.py@@ : l'API répond sur @@http://127.0.0.1:8000@@, et sa documentation interactive (générée depuis le code) sur @@/docs@@. Teste aussi avec @@curl -i http://127.0.0.1:8000/produits/1@@ pour voir la ligne de statut et les en-têtes.</p>`;

/* Catalogue de départ partagé par les exercices FastAPI (recréé à chaque exécution). */
const CATALOGUE = `PRODUITS = {
    1: {"id": 1, "nom": "Clavier mécanique", "categorie": "Informatique", "prix": 129.99},
    2: {"id": 2, "nom": "Souris sans fil", "categorie": "Informatique", "prix": 39.5},
    3: {"id": 3, "nom": "Casque audio", "categorie": "Audio", "prix": 149.0},
    4: {"id": 4, "nom": "Lampe de bureau", "categorie": "Maison", "prix": 59.9},
}`;

export default [
  {
    id: "api-01", section: "HTTP et REST", title: "HTTP : requêtes, réponses et codes de statut", xp: 70,
    theory: `<p>Une API web répond à des <strong>requêtes HTTP</strong>. Une requête a une <strong>méthode</strong>, un <strong>chemin</strong>, des <strong>en-têtes</strong> et parfois un <strong>corps</strong> ; la réponse a un <strong>code de statut</strong>, des en-têtes et un corps, le plus souvent en JSON :</p>
~~~text
POST /v1/produits HTTP/1.1               HTTP/1.1 201 Created
Host: api.boutique.ca                    Content-Type: application/json
Authorization: Bearer eyJhbGciOi…        Location: /v1/produits/5
Content-Type: application/json
                                         {"id": 5, "nom": "Webcam HD", "prix": 79.0}
{"nom": "Webcam HD", "prix": 79.0}
~~~
<p>Le style <strong>REST</strong> organise l'API autour de <em>ressources</em> désignées par des noms (@@/produits@@, @@/produits/5@@, @@/clients/2/commandes@@) et manipulées par les méthodes :</p>
<ul><li>@@GET@@ lit, sans rien modifier (méthode <em>sûre</em>) ;</li><li>@@POST@@ crée une ressource (ou déclenche une action) ;</li><li>@@PUT@@ remplace une ressource entière ; @@PATCH@@ en modifie une partie ;</li><li>@@DELETE@@ supprime.</li></ul>
<p>Une méthode est <strong>idempotente</strong> si la répéter donne le même état que l'exécuter une fois : @@GET@@, @@PUT@@ et @@DELETE@@ le sont, @@POST@@ non (deux appels créent deux commandes). C'est ce qui permet de rejouer sans risque une requête après une coupure réseau.</p>
<p>Les codes de statut se lisent par famille : <strong>2xx</strong> succès (200 OK, 201 Created, 204 No Content), <strong>3xx</strong> redirection (301, 304 Not Modified), <strong>4xx</strong> erreur du client (400 requête invalide, 401 non authentifié, 403 interdit, 404 introuvable, 409 conflit, 422 données invalides, 429 trop de requêtes), <strong>5xx</strong> erreur du serveur (500, 502 Bad Gateway, 503 indisponible). Un 4xx dit au client de corriger sa requête ; un 5xx dit qu'il peut réessayer plus tard.</p>`,
    setup: LAB,
    quiz: [
      { q: "Un paiement est envoyé par POST et la connexion coupe avant la réponse. Pourquoi est-il risqué de simplement renvoyer la requête ?", options: ["Ce n'est pas risqué", "POST n'est pas idempotent : la requête a peut-être été traitée, et la rejouer pourrait payer deux fois", "Le serveur refuse les doublons automatiquement", "Il faudrait utiliser GET"], answer: 1, explain: "D'où les clés d'idempotence (un identifiant envoyé dans un en-tête) qu'utilisent les API de paiement." },
      { q: "Le client envoie un prix négatif dans un formulaire. Quel code renvoyer ?", options: ["500", "422 (ou 400) : la requête est bien formée mais ses données sont invalides", "404", "200 avec un message d'erreur"], answer: 1, explain: "Une erreur de donnée du client est un 4xx ; un 500 ferait croire à une panne du serveur." },
      { q: "Quelle différence entre 401 et 403 ?", options: ["Aucune", "401 : on ne sait pas qui tu es (identifiants absents ou invalides) ; 403 : on sait qui tu es, mais tu n'as pas le droit", "401 est pour les API, 403 pour les pages", "403 veut dire introuvable"], answer: 1, explain: "Un 401 invite à s'authentifier ; un 403 ne changera pas avec les mêmes identifiants." }
    ],
    challenge: {
      prompt: `<p>Un client d'API doit savoir réagir à chaque réponse. Écris deux fonctions :</p><ul><li>@@famille(code)@@ renvoie @@"succès"@@ (2xx), @@"redirection"@@ (3xx), @@"erreur client"@@ (4xx), @@"erreur serveur"@@ (5xx), sinon @@"inconnu"@@ ;</li><li>@@peut_reessayer(methode, code)@@ renvoie @@True@@ seulement si la réponse est une erreur serveur, ou un 429, <em>et</em> que la méthode est idempotente (@@GET@@, @@PUT@@, @@DELETE@@, @@HEAD@@, @@OPTIONS@@). La méthode peut arriver en minuscules.</li></ul>`,
      starter: 'def famille(code):\n    if code < 300:\n        return "succès"\n    return "erreur"\n\n\ndef peut_reessayer(methode, code):\n    return code >= 500\n',
      solution: 'IDEMPOTENTES = {"GET", "PUT", "DELETE", "HEAD", "OPTIONS"}\n\n\ndef famille(code):\n    if 200 <= code < 300:\n        return "succès"\n    if 300 <= code < 400:\n        return "redirection"\n    if 400 <= code < 500:\n        return "erreur client"\n    if 500 <= code < 600:\n        return "erreur serveur"\n    return "inconnu"\n\n\ndef peut_reessayer(methode, code):\n    reessayable = code >= 500 or code == 429\n    return reessayable and methode.upper() in IDEMPOTENTES\n',
      tests: 'for c in [200, 201, 204, 304, 404, 422, 503, 102, 600]:\n    print(c, famille(c))\nfor m, c in [("GET", 503), ("get", 429), ("POST", 503), ("PUT", 500), ("DELETE", 404), ("PATCH", 502)]:\n    print(m, c, peut_reessayer(m, c))\n',
      expected: "200 succès\n201 succès\n204 succès\n304 redirection\n404 erreur client\n422 erreur client\n503 erreur serveur\n102 inconnu\n600 inconnu\nGET 503 True\nget 429 True\nPOST 503 False\nPUT 500 True\nDELETE 404 False\nPATCH 502 False\n",
      hint: "Teste chaque plage avec 200 <= code < 300, etc. Pour peut_reessayer : (code >= 500 or code == 429) and methode.upper() in {…}."
    }
  },
  {
    id: "api-02", section: "HTTP et REST", title: "Appeler une API depuis Python", xp: 80,
    theory: `<p>En Python, on appelle une API avec <strong>httpx</strong> ou <strong>requests</strong>. Le client de test de FastAPI, @@TestClient@@, a exactement la même interface, et parle directement à l'application, sans réseau : c'est lui qu'on utilise ici, et dans les tests.</p>
~~~py
from fastapi import FastAPI
from fastapi.testclient import TestClient

app = FastAPI()

@app.get("/meteo/{ville}")
def meteo(ville: str):
    return {"ville": ville, "temperature": -4}

client = TestClient(app)
r = client.get("/meteo/Gatineau")
print(r.status_code, r.headers["content-type"])
print(r.json())
print(r.json()["temperature"])
~~~
<p>Sur une vraie API, le code est le même avec @@httpx@@ :</p>
~~~py norun
import httpx

r = httpx.get("https://api.exemple.ca/meteo/Gatineau", params={"unites": "metric"}, timeout=5)
r.raise_for_status()          # lève une exception sur un 4xx ou un 5xx
donnees = r.json()
r = httpx.post("https://api.exemple.ca/commandes", json={"produit": 3, "quantite": 1},
               headers={"Authorization": "Bearer …"})
~~~
<p>Trois réflexes de production : toujours un <strong>délai d'expiration</strong> (@@timeout@@), vérifier le statut avant de lire le corps, et ne jamais écrire un jeton dans le code (variable d'environnement ou gestionnaire de secrets).</p>`,
    setup: LAB,
    quiz: [
      { q: "Pourquoi fixer un timeout sur chaque appel HTTP ?", options: ["Pour aller plus vite", "Sans délai, un serveur qui ne répond pas bloque ton programme indéfiniment", "C'est obligatoire avec httpx", "Pour chiffrer la requête"], answer: 1, explain: "Un appel bloqué occupe un thread ou une connexion, et la panne d'un service se propage à ceux qui l'appellent." },
      { q: "Que fait r.json() ?", options: ["Envoie du JSON", "Décode le corps de la réponse JSON en objets Python (dict, list…)", "Vérifie le statut", "Ferme la connexion"], answer: 1, explain: "Pour envoyer du JSON, on passe json=… à post, put ou patch." }
    ],
    challenge: {
      prompt: `<p>L'API du catalogue est fournie en haut du code (ne la modifie pas). Écris la fonction @@ajouter_puis_relire(client, nom, prix)@@ qui :</p><ol><li>crée le produit avec @@POST /produits@@ et le corps JSON @@{"nom": …, "prix": …}@@ ;</li><li>relit le produit créé avec @@GET /produits/{id}@@, l'@@id@@ étant dans la réponse du POST ;</li><li>renvoie le triplet (statut du POST, statut du GET, nom relu).</li></ol>`,
      starter: 'from fastapi import FastAPI\nfrom fastapi.testclient import TestClient\n\napp = FastAPI()\nPRODUITS = {}\n\n@app.post("/produits", status_code=201)\ndef creer(produit: dict):\n    pid = len(PRODUITS) + 1\n    PRODUITS[pid] = {"id": pid, **produit}\n    return PRODUITS[pid]\n\n@app.get("/produits/{pid}")\ndef lire(pid: int):\n    return PRODUITS[pid]\n\n# ---- ton code ----\n\ndef ajouter_puis_relire(client, nom, prix):\n    r = client.get("/produits/1")\n    return r.status_code, None, None\n',
      solution: 'from fastapi import FastAPI\nfrom fastapi.testclient import TestClient\n\napp = FastAPI()\nPRODUITS = {}\n\n@app.post("/produits", status_code=201)\ndef creer(produit: dict):\n    pid = len(PRODUITS) + 1\n    PRODUITS[pid] = {"id": pid, **produit}\n    return PRODUITS[pid]\n\n@app.get("/produits/{pid}")\ndef lire(pid: int):\n    return PRODUITS[pid]\n\n# ---- ton code ----\n\ndef ajouter_puis_relire(client, nom, prix):\n    cree = client.post("/produits", json={"nom": nom, "prix": prix})\n    pid = cree.json()["id"]\n    lu = client.get(f"/produits/{pid}")\n    return cree.status_code, lu.status_code, lu.json()["nom"]\n',
      tests: 'client = TestClient(app)\nprint(ajouter_puis_relire(client, "Webcam HD", 79.0))\nprint(ajouter_puis_relire(client, "Micro de bureau", 119.0))\nprint(len(PRODUITS))\n',
      expected: "(201, 200, 'Webcam HD')\n(201, 200, 'Micro de bureau')\n2\n",
      hint: "cree = client.post(\"/produits\", json={\"nom\": nom, \"prix\": prix}), puis pid = cree.json()[\"id\"], puis client.get(f\"/produits/{pid}\")."
    }
  },
  {
    id: "api-03", section: "Construire une API", title: "FastAPI : routes et paramètres", xp: 100,
    theory: `<p><strong>FastAPI</strong> associe une fonction Python à une méthode et un chemin. Les <strong>paramètres de chemin</strong> (@@{pid}@@) et les <strong>paramètres de requête</strong> (@@?categorie=Audio@@) deviennent des arguments de la fonction ; les annotations de type servent à les convertir et à les valider, et alimentent la documentation @@/docs@@.</p>
~~~py
from fastapi import FastAPI, HTTPException, Query
from fastapi.testclient import TestClient

app = FastAPI()
VILLES = {"gatineau": 291_041, "ottawa": 1_017_449}

@app.get("/villes/{nom}")
def ville(nom: str):
    if nom not in VILLES:
        raise HTTPException(status_code=404, detail="Ville introuvable")
    return {"nom": nom, "population": VILLES[nom]}

@app.get("/villes")
def lister(min_pop: int = 0, limit: int = Query(10, ge=1, le=100)):
    return [n for n, p in VILLES.items() if p >= min_pop][:limit]

client = TestClient(app)
print(client.get("/villes/ottawa").json())
print(client.get("/villes/laval").status_code, client.get("/villes/laval").json())
print(client.get("/villes?min_pop=500000").json())
print(client.get("/villes?limit=0").status_code)
~~~
<ul><li>un paramètre avec une valeur par défaut est facultatif ; sans valeur par défaut, il est obligatoire ;</li><li>une valeur qui ne se convertit pas (@@/produits/abc@@ pour un @@int@@) donne automatiquement un <strong>422</strong> avec le détail ;</li><li>@@HTTPException@@ arrête le traitement et renvoie le code choisi, avec @@{"detail": …}@@ ;</li><li>une fonction peut renvoyer un dict, une liste ou un modèle : FastAPI le convertit en JSON.</li></ul>`,
    setup: LAB,
    quiz: [
      { q: "Que renvoie FastAPI pour GET /produits/abc si pid est annoté int ?", options: ["500", "422, avec le détail de l'erreur de validation", "404", "200 avec pid = 0"], answer: 1, explain: "La conversion échoue avant même d'appeler ta fonction." },
      { q: "Comment rendre un paramètre de requête facultatif ?", options: ["Le mettre dans le chemin", "Lui donner une valeur par défaut (par exemple None)", "L'annoter str", "Impossible"], answer: 1, explain: "categorie: str | None = None : absent, il vaut None." }
    ],
    challenge: {
      prompt: `<p>Le catalogue est dans @@PRODUITS@@. Écris deux routes :</p><ul><li>@@GET /produits/{pid}@@ renvoie le produit, ou une erreur <strong>404</strong> avec le détail @@"Produit introuvable"@@ ;</li><li>@@GET /produits@@ renvoie la liste des produits, filtrée par le paramètre facultatif @@categorie@@ s'il est donné, et limitée par @@limit@@ (10 par défaut, entre 1 et 50).</li></ul>`,
      starter: 'from fastapi import FastAPI, HTTPException, Query\nfrom fastapi.testclient import TestClient\n\napp = FastAPI()\n' + CATALOGUE + '\n\n@app.get("/produits/{pid}")\ndef lire(pid):\n    return PRODUITS[pid]\n\n@app.get("/produits")\ndef lister():\n    return list(PRODUITS.values())\n',
      solution: 'from fastapi import FastAPI, HTTPException, Query\nfrom fastapi.testclient import TestClient\n\napp = FastAPI()\n' + CATALOGUE + '\n\n@app.get("/produits/{pid}")\ndef lire(pid: int):\n    if pid not in PRODUITS:\n        raise HTTPException(status_code=404, detail="Produit introuvable")\n    return PRODUITS[pid]\n\n@app.get("/produits")\ndef lister(categorie: str | None = None, limit: int = Query(10, ge=1, le=50)):\n    produits = [p for p in PRODUITS.values() if categorie is None or p["categorie"] == categorie]\n    return produits[:limit]\n',
      tests: 'c = TestClient(app)\nr = c.get("/produits/2"); print(r.status_code, r.json()["nom"])\nr = c.get("/produits/9"); print(r.status_code, r.json())\nprint(c.get("/produits/abc").status_code)\nprint([p["id"] for p in c.get("/produits").json()])\nprint([p["id"] for p in c.get("/produits?categorie=Informatique").json()])\nprint([p["id"] for p in c.get("/produits", params={"limit": 2}).json()])\nprint(c.get("/produits?limit=100").status_code)\n',
      expected: "200 Souris sans fil\n404 {'detail': 'Produit introuvable'}\n422\n[1, 2, 3, 4]\n[1, 2]\n[1, 2]\n422\n",
      hint: "Annote pid: int, et lève HTTPException(status_code=404, detail=\"Produit introuvable\") si l'id manque. Pour la liste : categorie: str | None = None et limit: int = Query(10, ge=1, le=50)."
    }
  },
  {
    id: "api-04", section: "Construire une API", title: "Valider les données avec Pydantic", xp: 110,
    theory: `<p>Le corps d'une requête se décrit avec un <strong>modèle Pydantic</strong> : une classe dont les attributs typés définissent les champs attendus. FastAPI lit le JSON, le valide, et refuse la requête avec un <strong>422</strong> détaillé si quelque chose ne va pas ; ta fonction ne reçoit que des données propres.</p>
~~~py
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel, Field

app = FastAPI()

class Inscription(BaseModel):
    nom: str = Field(min_length=2, max_length=80)
    age: int = Field(ge=16)
    ville: str = "Gatineau"

@app.post("/inscriptions", status_code=201)
def inscrire(i: Inscription):
    return {"message": f"Bienvenue {i.nom}", "ville": i.ville}

client = TestClient(app)
print(client.post("/inscriptions", json={"nom": "Awa", "age": 24}).json())
r = client.post("/inscriptions", json={"nom": "A", "age": "douze"})
print(r.status_code)
for e in r.json()["detail"]:
    print(e["loc"], e["msg"])
~~~
<p>Un modèle sert aussi pour la <strong>réponse</strong> (@@response_model=@@) : FastAPI ne renvoie alors que les champs déclarés, ce qui évite de laisser fuir un mot de passe haché ou un champ interne. On sépare souvent le modèle d'entrée (sans @@id@@) du modèle de sortie (avec @@id@@). @@status_code=201@@ indique qu'un POST a créé une ressource.</p>`,
    setup: LAB,
    quiz: [
      { q: "Le client envoie {\"prix\": \"abc\"} pour un champ prix: float. Que se passe-t-il ?", options: ["prix vaut 0", "FastAPI répond 422 sans appeler ta fonction, avec l'emplacement de l'erreur (body, prix)", "Une erreur 500", "Le champ est ignoré"], answer: 1, explain: "La validation a lieu avant la logique métier." },
      { q: "À quoi sert response_model ?", options: ["À valider l'entrée", "À définir et filtrer ce que la route renvoie (et à le documenter)", "À changer le code de statut", "À mettre en cache"], answer: 1, explain: "Seuls les champs du modèle de sortie partent au client." }
    ],
    challenge: {
      prompt: `<p>Ajoute la création de produits : @@POST /produits@@ avec un corps @@ProduitIn@@ :</p><ul><li>@@nom@@ : texte de 2 à 60 caractères ;</li><li>@@categorie@@ : texte ;</li><li>@@prix@@ : nombre strictement positif ;</li></ul><p>La route répond <strong>201</strong> avec le produit créé (son @@id@@ est le plus grand id existant plus 1). Une donnée invalide doit donner un 422, sans rien créer.</p>`,
      starter: 'from fastapi import FastAPI\nfrom fastapi.testclient import TestClient\nfrom pydantic import BaseModel, Field\n\napp = FastAPI()\n' + CATALOGUE + '\n\n\nclass ProduitIn(BaseModel):\n    nom: str\n    categorie: str\n    prix: float\n\n\n@app.post("/produits")\ndef creer(p: ProduitIn):\n    pid = max(PRODUITS) + 1\n    PRODUITS[pid] = {"id": pid, **p.model_dump()}\n    return PRODUITS[pid]\n',
      solution: 'from fastapi import FastAPI\nfrom fastapi.testclient import TestClient\nfrom pydantic import BaseModel, Field\n\napp = FastAPI()\n' + CATALOGUE + '\n\n\nclass ProduitIn(BaseModel):\n    nom: str = Field(min_length=2, max_length=60)\n    categorie: str\n    prix: float = Field(gt=0)\n\n\n@app.post("/produits", status_code=201)\ndef creer(p: ProduitIn):\n    pid = max(PRODUITS) + 1\n    PRODUITS[pid] = {"id": pid, **p.model_dump()}\n    return PRODUITS[pid]\n',
      tests: 'c = TestClient(app)\nr = c.post("/produits", json={"nom": "Webcam HD", "categorie": "Informatique", "prix": 79})\nprint(r.status_code, r.json())\nfor corps in [{"nom": "W", "categorie": "Audio", "prix": 10}, {"nom": "Micro", "categorie": "Audio", "prix": 0}, {"nom": "Micro", "prix": 10}]:\n    r = c.post("/produits", json=corps)\n    print(r.status_code, [e["loc"][-1] for e in r.json()["detail"]])\nprint(len(PRODUITS))\n',
      expected: "201 {'id': 5, 'nom': 'Webcam HD', 'categorie': 'Informatique', 'prix': 79.0}\n422 ['nom']\n422 ['prix']\n422 ['categorie']\n5\n",
      hint: "nom: str = Field(min_length=2, max_length=60), prix: float = Field(gt=0), et status_code=201 dans le décorateur @app.post."
    }
  },
  {
    id: "api-05", section: "Construire une API", title: "CRUD complet et codes de statut", xp: 110,
    theory: `<p>Une ressource complète se lit, se crée, se remplace, se modifie et se supprime : c'est le <strong>CRUD</strong>. Chaque opération a son code de réponse attendu :</p>
~~~text
GET    /produits          200  liste
GET    /produits/5        200  le produit        404 s'il n'existe pas
POST   /produits          201  le produit créé   409 si le nom existe déjà, 422 si invalide
PUT    /produits/5        200  le produit        404, 422
DELETE /produits/5        204  (pas de corps)    404
~~~
<p>Le <strong>409 Conflict</strong> signale une contradiction avec l'état actuel (un doublon, une version périmée). Le <strong>204</strong> se renvoie sans corps : avec FastAPI, @@status_code=204@@ dans le décorateur et la fonction ne renvoie rien.</p>
~~~py
from fastapi import FastAPI, HTTPException, Response
from fastapi.testclient import TestClient

app = FastAPI()
TACHES = {1: "Écrire les tests", 2: "Déployer"}

@app.delete("/taches/{tid}", status_code=204)
def supprimer(tid: int):
    if tid not in TACHES:
        raise HTTPException(404, "Tâche introuvable")
    del TACHES[tid]

client = TestClient(app)
r = client.delete("/taches/2")
print(r.status_code, repr(r.text))
print(client.delete("/taches/2").status_code, TACHES)
~~~
<p>Un @@DELETE@@ répété donne 404 la deuxième fois, mais l'état est le même : la méthode reste idempotente. Certaines API préfèrent renvoyer 204 dans les deux cas.</p>`,
    setup: LAB,
    quiz: [
      { q: "Quel code pour un POST qui crée un client avec un courriel déjà utilisé ?", options: ["200", "409 Conflict", "404", "500"], answer: 1, explain: "La requête est valide en soi, mais contredit l'état existant." },
      { q: "PUT ou PATCH pour changer seulement le prix d'un produit ?", options: ["PUT, toujours", "PATCH : modification partielle ; PUT remplace la ressource entière", "DELETE puis POST", "GET"], answer: 1, explain: "Avec PUT, un champ absent du corps serait considéré comme supprimé ou invalide." }
    ],
    challenge: {
      prompt: `<p>Complète l'API du catalogue :</p><ul><li>@@POST /produits@@ refuse un nom déjà présent (comparaison sans tenir compte des majuscules) avec un <strong>409</strong> et le détail @@"Ce produit existe déjà"@@ ;</li><li>@@PUT /produits/{pid}@@ remplace le produit (404 s'il n'existe pas, détail @@"Produit introuvable"@@) et renvoie le produit mis à jour ;</li><li>@@DELETE /produits/{pid}@@ supprime le produit et répond <strong>204</strong> (404 s'il n'existe pas).</li></ul>`,
      starter: 'from fastapi import FastAPI, HTTPException\nfrom fastapi.testclient import TestClient\nfrom pydantic import BaseModel, Field\n\napp = FastAPI()\n' + CATALOGUE + '\n\n\nclass ProduitIn(BaseModel):\n    nom: str = Field(min_length=2)\n    categorie: str\n    prix: float = Field(gt=0)\n\n\n@app.post("/produits", status_code=201)\ndef creer(p: ProduitIn):\n    pid = max(PRODUITS) + 1\n    PRODUITS[pid] = {"id": pid, **p.model_dump()}\n    return PRODUITS[pid]\n\n\n@app.put("/produits/{pid}")\ndef remplacer(pid: int, p: ProduitIn):\n    PRODUITS[pid] = {"id": pid, **p.model_dump()}\n    return PRODUITS[pid]\n\n\n@app.delete("/produits/{pid}")\ndef supprimer(pid: int):\n    del PRODUITS[pid]\n',
      solution: 'from fastapi import FastAPI, HTTPException\nfrom fastapi.testclient import TestClient\nfrom pydantic import BaseModel, Field\n\napp = FastAPI()\n' + CATALOGUE + '\n\n\nclass ProduitIn(BaseModel):\n    nom: str = Field(min_length=2)\n    categorie: str\n    prix: float = Field(gt=0)\n\n\ndef introuvable(pid):\n    if pid not in PRODUITS:\n        raise HTTPException(status_code=404, detail="Produit introuvable")\n\n\n@app.post("/produits", status_code=201)\ndef creer(p: ProduitIn):\n    if any(x["nom"].lower() == p.nom.lower() for x in PRODUITS.values()):\n        raise HTTPException(status_code=409, detail="Ce produit existe déjà")\n    pid = max(PRODUITS) + 1\n    PRODUITS[pid] = {"id": pid, **p.model_dump()}\n    return PRODUITS[pid]\n\n\n@app.put("/produits/{pid}")\ndef remplacer(pid: int, p: ProduitIn):\n    introuvable(pid)\n    PRODUITS[pid] = {"id": pid, **p.model_dump()}\n    return PRODUITS[pid]\n\n\n@app.delete("/produits/{pid}", status_code=204)\ndef supprimer(pid: int):\n    introuvable(pid)\n    del PRODUITS[pid]\n',
      tests: 'c = TestClient(app)\nr = c.post("/produits", json={"nom": "casque AUDIO", "categorie": "Audio", "prix": 99}); print(r.status_code, r.json())\nr = c.put("/produits/4", json={"nom": "Lampe LED", "categorie": "Maison", "prix": 49.9}); print(r.status_code, r.json())\nr = c.put("/produits/9", json={"nom": "Lampe LED", "categorie": "Maison", "prix": 49.9}); print(r.status_code, r.json())\nr = c.delete("/produits/3"); print(r.status_code, repr(r.text))\nprint(c.delete("/produits/3").status_code, sorted(PRODUITS))\n',
      expected: "409 {'detail': 'Ce produit existe déjà'}\n200 {'id': 4, 'nom': 'Lampe LED', 'categorie': 'Maison', 'prix': 49.9}\n404 {'detail': 'Produit introuvable'}\n204 ''\n404 [1, 2, 4]\n",
      hint: "Une petite fonction introuvable(pid) qui lève HTTPException(404, …) évite de répéter le test. Pour le doublon : any(x[\"nom\"].lower() == p.nom.lower() for x in PRODUITS.values()). status_code=204 sur le DELETE."
    }
  },
  {
    id: "api-06", section: "Construire une API", title: "Authentification et dépendances", xp: 110,
    theory: `<p>Une API publique doit savoir <strong>qui</strong> appelle (authentification) et <strong>ce qu'il a le droit de faire</strong> (autorisation). Les mécanismes courants :</p>
<ul><li>une <strong>clé d'API</strong> dans un en-tête (@@X-API-Key@@), pour un service qui en appelle un autre ;</li><li>un <strong>jeton porteur</strong> (@@Authorization: Bearer …@@), souvent un <strong>JWT</strong> : un jeton signé qui contient l'identité et les rôles, vérifiable sans base de données, avec une date d'expiration ;</li><li><strong>OAuth 2</strong> et OpenID Connect pour déléguer la connexion à un fournisseur (Google, Microsoft, Keycloak) ; l'API ne voit jamais le mot de passe.</li></ul>
<p>Avec FastAPI, ce contrôle s'écrit une fois, dans une <strong>dépendance</strong> (@@Depends@@) : une fonction exécutée avant la route, qui lit les en-têtes, refuse avec 401 ou 403, ou renvoie l'utilisateur à la route.</p>
~~~py
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.testclient import TestClient

app = FastAPI()
CLES = {"cle-lecture": "lecture", "cle-admin": "admin"}

def role(x_api_key: str | None = Header(default=None)):
    if x_api_key not in CLES:
        raise HTTPException(status_code=401, detail="Clé d'API absente ou invalide")
    return CLES[x_api_key]

@app.get("/rapports")
def rapports(r: str = Depends(role)):
    return {"role": r}

client = TestClient(app)
print(client.get("/rapports").status_code)
print(client.get("/rapports", headers={"X-API-Key": "cle-admin"}).json())
~~~
<p>L'en-tête @@X-API-Key@@ devient le paramètre @@x_api_key@@ (tirets changés en soulignés). Les règles : HTTPS partout, des secrets hors du code, des jetons courts, et une limite de débit (429) contre les abus. Dans les tests, @@app.dependency_overrides@@ remplace une dépendance par une fausse, pour tester une route sans vrai jeton.</p>`,
    setup: LAB,
    quiz: [
      { q: "Pourquoi mettre la vérification du jeton dans une dépendance plutôt que dans chaque route ?", options: ["C'est obligatoire", "Écrite une seule fois, elle s'applique partout et se remplace facilement dans les tests", "Pour aller plus vite", "Pour que FastAPI chiffre le jeton"], answer: 1, explain: "Une route qui oublie la vérification est une faille ; une dépendance commune réduit ce risque." },
      { q: "Un JWT est lisible par quiconque l'intercepte. Qu'est-ce qui le protège ?", options: ["Son chiffrement", "Sa signature (impossible à modifier sans la clé), sa courte durée de vie et le transport en HTTPS", "Son encodage base64", "Rien"], answer: 1, explain: "Un JWT est signé, pas chiffré : n'y mets jamais de secret." }
    ],
    challenge: {
      prompt: `<p>Protège l'API : les clés valides sont dans @@CLES@@ (clé → rôle). Écris la dépendance @@utilisateur@@ qui lit l'en-tête @@X-API-Key@@ :</p><ul><li>clé absente ou inconnue : <strong>401</strong>, détail @@"Authentification requise"@@ ;</li><li>sinon, elle renvoie le rôle.</li></ul><p>Puis la dépendance @@admin@@, qui s'appuie sur @@utilisateur@@ et répond <strong>403</strong> (détail @@"Réservé aux administrateurs"@@) si le rôle n'est pas @@admin@@. @@GET /produits@@ exige un utilisateur, @@DELETE /produits/{pid}@@ un administrateur.</p>`,
      starter: 'from fastapi import Depends, FastAPI, Header, HTTPException\nfrom fastapi.testclient import TestClient\n\napp = FastAPI()\n' + CATALOGUE + '\nCLES = {"k-lecture-7f3a": "lecture", "k-admin-91c2": "admin"}\n\n\ndef utilisateur(x_api_key: str | None = Header(default=None)):\n    return "lecture"\n\n\ndef admin(role: str = Depends(utilisateur)):\n    return role\n\n\n@app.get("/produits")\ndef lister(role: str = Depends(utilisateur)):\n    return list(PRODUITS)\n\n\n@app.delete("/produits/{pid}", status_code=204)\ndef supprimer(pid: int, role: str = Depends(admin)):\n    PRODUITS.pop(pid, None)\n',
      solution: 'from fastapi import Depends, FastAPI, Header, HTTPException\nfrom fastapi.testclient import TestClient\n\napp = FastAPI()\n' + CATALOGUE + '\nCLES = {"k-lecture-7f3a": "lecture", "k-admin-91c2": "admin"}\n\n\ndef utilisateur(x_api_key: str | None = Header(default=None)):\n    if x_api_key not in CLES:\n        raise HTTPException(status_code=401, detail="Authentification requise")\n    return CLES[x_api_key]\n\n\ndef admin(role: str = Depends(utilisateur)):\n    if role != "admin":\n        raise HTTPException(status_code=403, detail="Réservé aux administrateurs")\n    return role\n\n\n@app.get("/produits")\ndef lister(role: str = Depends(utilisateur)):\n    return list(PRODUITS)\n\n\n@app.delete("/produits/{pid}", status_code=204)\ndef supprimer(pid: int, role: str = Depends(admin)):\n    PRODUITS.pop(pid, None)\n',
      tests: 'c = TestClient(app)\nL = {"X-API-Key": "k-lecture-7f3a"}; A = {"X-API-Key": "k-admin-91c2"}\nr = c.get("/produits"); print(r.status_code, r.json())\nr = c.get("/produits", headers={"X-API-Key": "devine"}); print(r.status_code)\nr = c.get("/produits", headers=L); print(r.status_code, r.json())\nr = c.delete("/produits/1", headers=L); print(r.status_code, r.json())\nr = c.delete("/produits/1"); print(r.status_code)\nr = c.delete("/produits/1", headers=A); print(r.status_code, sorted(PRODUITS))\n',
      expected: "401 {'detail': 'Authentification requise'}\n401\n200 [1, 2, 3, 4]\n403 {'detail': 'Réservé aux administrateurs'}\n401\n204 [2, 3, 4]\n",
      hint: "Dans utilisateur : if x_api_key not in CLES: raise HTTPException(status_code=401, …), puis return CLES[x_api_key]. Dans admin : if role != \"admin\": raise HTTPException(status_code=403, …)."
    }
  }
];
