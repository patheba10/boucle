/* Cours API — chapitre 3 : tests avec pytest (vérifiés par mutation), fixtures, tester une API, mocks ; entretien. */

const LAB = `<p><strong>Sur ta machine</strong> : @@pip install pytest@@, mets le code dans @@boutique.py@@ et les tests dans @@test_boutique.py@@, puis lance @@pytest -q@@ dans le dossier. @@pytest -x@@ s'arrête au premier échec, @@pytest -k remise@@ ne lance que les tests dont le nom contient « remise », et @@pip install pytest-cov@@ puis @@pytest --cov=boutique@@ mesure la couverture.</p>`;
const RUN = "boucle.pytest(MODULES)\n";
const CHECK = (mutants) => "boucle.mutants(MODULES, " + mutants + ")\n";
/* Tout ce qui suit #@boucle est exécuté ; le code de l'élève, avant, devient le fichier test_eleve.py lancé par pytest. */
const M = (modules) => "#@boucle\nimport pytest\nMODULES = " + JSON.stringify(modules) + "\n";
/* Chaque défi : l'élève écrit test_eleve.py ; le vérificateur lance ses tests sur le bon code, puis sur des versions fautives (mutants) qu'ils doivent faire échouer. */
const verdict = (n) => "sur le code correct : tous les tests réussissent\n" + n.map((d, i) => "erreur " + (i + 1) + " (" + d + ") : détectée").join("\n") + "\n";

const REMISE = `def prix_final(prix, code=None):
    """Prix après code promo, arrondi au cent. BIENVENUE : -10 %, ETE : -20 % ; prix négatif interdit."""
    if prix < 0:
        raise ValueError("prix négatif")
    remises = {"BIENVENUE": 0.10, "ETE": 0.20}
    if code is not None and code not in remises:
        raise ValueError("code inconnu")
    taux = remises.get(code, 0)
    return round(prix * (1 - taux), 2)
`;
const REMISE_MUTANTS = [
  ["remise de l'été mal appliquée", REMISE.replace('"ETE": 0.20', '"ETE": 0.02')],
  ["code inconnu accepté sans remise", REMISE.replace('    if code is not None and code not in remises:\n        raise ValueError("code inconnu")\n', "")],
  ["prix négatif accepté", REMISE.replace('    if prix < 0:\n        raise ValueError("prix négatif")\n', "")],
  ["pas d'arrondi", REMISE.replace("return round(prix * (1 - taux), 2)", "return prix * (1 - taux)")]
];

const LIVRAISON = `def frais_livraison(total, province):
    """Livraison : gratuite dès 75 $ ; sinon 9,99 $ au Québec et en Ontario, 14,99 $ ailleurs au Canada."""
    if province not in PROVINCES:
        raise ValueError("province inconnue")
    if total >= 75:
        return 0.0
    return 9.99 if province in ("QC", "ON") else 14.99


PROVINCES = {"QC", "ON", "NB", "NS", "PE", "NL", "MB", "SK", "AB", "BC", "YT", "NT", "NU"}
`;
const LIVRAISON_MUTANTS = [
  ["seuil strict (> 75)", LIVRAISON.replace("if total >= 75", "if total > 75")],
  ["Ontario au tarif national", LIVRAISON.replace('("QC", "ON")', '("QC",)')],
  ["province inconnue acceptée", LIVRAISON.replace('    if province not in PROVINCES:\n        raise ValueError("province inconnue")\n', "")],
  ["seuil à 50 $", LIVRAISON.replace("if total >= 75", "if total >= 50")]
];

const APP = `from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI()
PRODUITS = {1: {"id": 1, "nom": "Clavier", "prix": 129.99}}


class ProduitIn(BaseModel):
    nom: str = Field(min_length=2)
    prix: float = Field(gt=0)


@app.get("/produits/{pid}")
def lire(pid: int):
    if pid not in PRODUITS:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    return PRODUITS[pid]


@app.post("/produits", status_code=201)
def creer(p: ProduitIn):
    pid = max(PRODUITS) + 1
    PRODUITS[pid] = {"id": pid, **p.model_dump()}
    return PRODUITS[pid]
`;
const APP_MUTANTS = [
  ["création en 200 au lieu de 201", APP.replace('@app.post("/produits", status_code=201)', '@app.post("/produits")')],
  ["produit inexistant : erreur 500", APP.replace('    if pid not in PRODUITS:\n        raise HTTPException(status_code=404, detail="Produit introuvable")\n', "")],
  ["prix négatif accepté", APP.replace("prix: float = Field(gt=0)", "prix: float")],
  ["nom mal enregistré", APP.replace('PRODUITS[pid] = {"id": pid, **p.model_dump()}', 'PRODUITS[pid] = {"id": pid, "nom": p.nom.upper(), "prix": p.prix}')]
];

const BANQUE = `def taux(devise):
    """Interroge l'API de la banque (réseau) : indisponible pendant les tests."""
    raise ConnectionError("pas de réseau pendant les tests")
`;
const CONVERSION = `import banque


def en_dollars(montant, devise):
    """Convertit un montant en dollars canadiens, arrondi au cent. CAD est renvoyé tel quel, sans appel réseau."""
    if devise == "CAD":
        return round(montant, 2)
    return round(montant * banque.taux(devise), 2)
`;
const CONVERSION_MUTANTS = [
  ["division au lieu de multiplication", { conversion: CONVERSION.replace("montant * banque.taux(devise)", "montant / banque.taux(devise)") }],
  ["appel réseau même pour CAD", { conversion: CONVERSION.replace('    if devise == "CAD":\n        return round(montant, 2)\n', "") }],
  ["pas d'arrondi", { conversion: CONVERSION.replace("return round(montant * banque.taux(devise), 2)", "return montant * banque.taux(devise)") }]
];

export default [
  {
    id: "api-07", section: "Tester", title: "pytest : premiers tests", xp: 110,
    theory: `<p>Un test automatique appelle ton code avec des entrées choisies et vérifie le résultat. Avec <strong>pytest</strong>, un test est une simple fonction dont le nom commence par @@test_@@, dans un fichier @@test_*.py@@, et la vérification un simple @@assert@@ :</p>
~~~py norun
from boutique import prix_final

def test_sans_code():
    assert prix_final(100) == 100

def test_code_bienvenue():
    assert prix_final(80, "BIENVENUE") == 72.0
~~~
<p>Quand un @@assert@@ échoue, pytest montre les deux valeurs comparées : pas besoin de messages. Pour vérifier qu'une erreur est bien levée, on utilise @@pytest.raises@@ :</p>
~~~py norun
import pytest

def test_prix_negatif_refuse():
    with pytest.raises(ValueError):
        prix_final(-5)
~~~
<p>Un bon test vérifie un comportement précis et a un nom qui le décrit. On teste le cas normal, les <strong>cas limites</strong> (zéro, la borne exacte d'un seuil, une liste vide) et les <strong>cas d'erreur</strong>. Attention aux nombres décimaux : @@0.1 + 0.2 == 0.3@@ est faux ; on arrondit, ou on compare avec @@pytest.approx(0.3)@@.</p>
<p>Comment savoir si tes tests sont bons ? Ici, le vérificateur fait du <strong>test par mutation</strong> : il introduit des erreurs plausibles dans le code testé (une remise mal recopiée, un contrôle oublié). Des tests utiles doivent réussir sur le bon code <em>et</em> échouer sur chaque version fautive. Les outils @@mutmut@@ ou @@cosmic-ray@@ font la même chose sur un vrai projet.</p>`,
    setup: LAB,
    quiz: [
      { q: "Combien de tests faut-il au minimum pour un seuil « gratuit dès 75 $ » ?", options: ["Un seul, à 100 $", "Au moins un juste sous le seuil et un exactement au seuil (74,99 et 75)", "Aucun, c'est évident", "Un à 0 $"], answer: 1, explain: "Les erreurs se cachent aux bornes : > au lieu de >=." },
      { q: "Que vérifie pytest.raises(ValueError) ?", options: ["Que le code ne plante pas", "Que le bloc lève bien une ValueError ; le test échoue si rien n'est levé", "Que la valeur est correcte", "Qu'il n'y a pas de ValueError"], answer: 1, explain: "Sans erreur levée, pytest affiche « DID NOT RAISE »." }
    ],
    challenge: {
      prompt: `<p>Le module @@boutique@@ contient cette fonction (ne la recopie pas, importe-la) :</p><pre>${REMISE.replace(/</g, "&lt;")}</pre><p>Écris des tests pytest assez précis pour détecter chacune des quatre erreurs que le vérificateur va glisser dans ce code. « Exécuter » lance pytest sur le bon code.</p>`,
      starter: "from boutique import prix_final\n\n\ndef test_sans_code():\n    assert prix_final(100) == 100\n\n\ndef test_bienvenue():\n    assert prix_final(80, \"BIENVENUE\") == 72.0\n",
      solution: "import pytest\nfrom boutique import prix_final\n\n\ndef test_sans_code():\n    assert prix_final(100) == 100\n\n\ndef test_bienvenue():\n    assert prix_final(80, \"BIENVENUE\") == 72.0\n\n\ndef test_ete():\n    assert prix_final(50, \"ETE\") == 40.0\n\n\ndef test_arrondi_au_cent():\n    assert prix_final(19.99, \"BIENVENUE\") == 17.99\n\n\ndef test_code_inconnu():\n    with pytest.raises(ValueError):\n        prix_final(10, \"NOEL\")\n\n\ndef test_prix_negatif():\n    with pytest.raises(ValueError):\n        prix_final(-1)\n",
      runWith: M({ boutique: REMISE }) + RUN,
      tests: M({ boutique: REMISE }) + CHECK(JSON.stringify(REMISE_MUTANTS.map(([d, s]) => [d, { boutique: s }]))),
      expected: verdict(REMISE_MUTANTS.map((m) => m[0])),
      hint: "Il manque un test pour chaque comportement : le code ETE, un arrondi (19,99 avec BIENVENUE donne 17,99, pas 17,991), et deux pytest.raises(ValueError) : code inconnu et prix négatif."
    }
  },
  {
    id: "api-08", section: "Tester", title: "Fixtures et paramétrage", xp: 110,
    theory: `<p>Quand plusieurs tests ne diffèrent que par leurs données, @@@pytest.mark.parametrize@@ les écrit une seule fois. Chaque jeu de valeurs devient un test distinct dans le rapport :</p>
~~~py norun
import pytest
from boutique import frais_livraison

@pytest.mark.parametrize("total, province, attendu", [
    (20, "QC", 9.99),
    (20, "AB", 14.99),
    (75, "QC", 0.0),
])
def test_frais(total, province, attendu):
    assert frais_livraison(total, province) == attendu
~~~
<p>Une <strong>fixture</strong> prépare ce dont un test a besoin (des données, un client HTTP, une base temporaire) et le nettoie ensuite. pytest l'injecte en lisant le nom des paramètres du test :</p>
~~~py norun
import pytest

@pytest.fixture
def panier():
    p = {"articles": [("clavier", 129.99), ("souris", 39.5)]}
    yield p                     # le test s'exécute ici
    p["articles"].clear()       # nettoyage, même si le test échoue

def test_total(panier):
    assert round(sum(prix for _, prix in panier["articles"]), 2) == 169.49
~~~
<p>Les fixtures partagées vont dans @@conftest.py@@, découvert automatiquement. @@scope="session"@@ ne la crée qu'une fois pour toute la suite (utile pour une base de données de test) ; par défaut, elle est recréée pour chaque test, ce qui garantit des tests indépendants. pytest fournit aussi des fixtures prêtes : @@tmp_path@@ (un dossier temporaire), @@monkeypatch@@ (modifier une variable d'environnement ou un attribut le temps d'un test).</p>`,
    setup: LAB,
    quiz: [
      { q: "Pourquoi une fixture est-elle recréée pour chaque test par défaut ?", options: ["Par lenteur", "Pour que les tests restent indépendants : un test qui modifie les données n'en contamine pas un autre", "C'est une limite de pytest", "Pour économiser la mémoire"], answer: 1, explain: "Des tests qui dépendent de leur ordre d'exécution finissent toujours par échouer au hasard." },
      { q: "Que fait le code après yield dans une fixture ?", options: ["Rien", "Le nettoyage, exécuté après le test, qu'il réussisse ou non", "Un second test", "Il est ignoré si le test échoue"], answer: 1, explain: "C'est l'équivalent d'un try/finally autour du test." }
    ],
    challenge: {
      prompt: `<p>Le module @@boutique@@ contient :</p><pre>${LIVRAISON.replace(/</g, "&lt;")}</pre><p>Écris un test <strong>paramétré</strong> (@@@pytest.mark.parametrize@@) qui couvre les tarifs, et un test d'erreur, pour détecter les quatre fautes que le vérificateur va introduire. Pense aux bornes.</p>`,
      starter: "import pytest\nfrom boutique import frais_livraison\n\n\n@pytest.mark.parametrize(\"total, province, attendu\", [\n    (20, \"QC\", 9.99),\n    (100, \"QC\", 0.0),\n])\ndef test_frais(total, province, attendu):\n    assert frais_livraison(total, province) == attendu\n",
      solution: "import pytest\nfrom boutique import frais_livraison\n\n\n@pytest.mark.parametrize(\"total, province, attendu\", [\n    (20, \"QC\", 9.99),\n    (20, \"ON\", 9.99),\n    (20, \"AB\", 14.99),\n    (60, \"QC\", 9.99),\n    (74.99, \"BC\", 14.99),\n    (75, \"QC\", 0.0),\n    (100, \"NU\", 0.0),\n])\ndef test_frais(total, province, attendu):\n    assert frais_livraison(total, province) == attendu\n\n\ndef test_province_inconnue():\n    with pytest.raises(ValueError):\n        frais_livraison(20, \"XX\")\n",
      runWith: M({ boutique: LIVRAISON }) + RUN,
      tests: M({ boutique: LIVRAISON }) + CHECK(JSON.stringify(LIVRAISON_MUTANTS.map(([d, s]) => [d, { boutique: s }]))),
      expected: verdict(LIVRAISON_MUTANTS.map((m) => m[0])),
      hint: "Ajoute des cas : l'Ontario (9,99), une autre province (14,99), exactement 75 $ (gratuit), un total entre 50 et 75 $ (payant), et un test pytest.raises(ValueError) pour une province inconnue."
    }
  },
  {
    id: "api-09", section: "Tester", title: "Tester une API", xp: 120,
    theory: `<p>Les tests d'une API appellent ses routes avec @@TestClient@@, sans lancer de serveur, et vérifient le <strong>code de statut</strong> autant que le <strong>corps</strong> : un 200 au lieu d'un 201, ou un 500 au lieu d'un 404, sont de vraies régressions pour les clients de l'API.</p>
~~~py norun
import pytest
from fastapi.testclient import TestClient
from app import app

@pytest.fixture
def client():
    return TestClient(app)

def test_lire_existant(client):
    r = client.get("/produits/1")
    assert r.status_code == 200
    assert r.json()["nom"] == "Clavier"

def test_lire_inexistant(client):
    assert client.get("/produits/999").status_code == 404
~~~
<p>On teste chaque route sur ses chemins heureux et ses erreurs : données invalides (422), ressource absente (404), droits manquants (401, 403), doublons (409). Pour une route qui écrit, on vérifie aussi l'effet : relire ce qui vient d'être créé.</p>
<p>Ces tests se placent au milieu de la <strong>pyramide des tests</strong> : beaucoup de tests unitaires rapides à la base, des tests d'intégration (API, base de données) au milieu, quelques tests de bout en bout (un vrai navigateur, un vrai déploiement) au sommet. Tous tournent dans la CI à chaque pull request.</p>`,
    setup: LAB,
    quiz: [
      { q: "Une route de création renvoie 200 au lieu de 201 après un changement. Est-ce grave ?", options: ["Non, c'est un succès dans les deux cas", "Oui pour les clients qui s'appuient sur le code (et sur l'en-tête Location) : un test doit vérifier le statut exact", "Seulement en production", "Non, FastAPI corrige seul"], answer: 1, explain: "Le contrat d'une API, c'est aussi ses codes de statut." },
      { q: "Pourquoi relire la ressource après un POST dans un test ?", options: ["Par habitude", "Pour vérifier l'effet réel (ce qui a été enregistré), pas seulement la réponse", "Pour tester GET", "Pour vider le cache"], answer: 1, explain: "Une route peut répondre correctement et enregistrer une donnée fausse." }
    ],
    challenge: {
      prompt: `<p>Le module @@app@@ contient cette API :</p><pre>${APP.replace(/</g, "&lt;")}</pre><p>Écris ses tests avec @@TestClient@@ (en fixture), pour détecter les quatre fautes que le vérificateur va introduire : statuts, erreurs et données enregistrées.</p>`,
      starter: "import pytest\nfrom fastapi.testclient import TestClient\nfrom app import app\n\n\n@pytest.fixture\ndef client():\n    return TestClient(app)\n\n\ndef test_lire(client):\n    assert client.get(\"/produits/1\").status_code == 200\n",
      solution: "import pytest\nfrom fastapi.testclient import TestClient\nfrom app import app\n\n\n@pytest.fixture\ndef client():\n    return TestClient(app)\n\n\ndef test_lire(client):\n    r = client.get(\"/produits/1\")\n    assert r.status_code == 200\n    assert r.json()[\"nom\"] == \"Clavier\"\n\n\ndef test_lire_inexistant(client):\n    assert client.get(\"/produits/999\").status_code == 404\n\n\ndef test_creer_puis_relire(client):\n    r = client.post(\"/produits\", json={\"nom\": \"Webcam\", \"prix\": 79.0})\n    assert r.status_code == 201\n    pid = r.json()[\"id\"]\n    assert client.get(f\"/produits/{pid}\").json()[\"nom\"] == \"Webcam\"\n\n\ndef test_prix_invalide(client):\n    r = client.post(\"/produits\", json={\"nom\": \"Webcam\", \"prix\": -5})\n    assert r.status_code == 422\n",
      runWith: M({ app: APP }) + RUN,
      tests: M({ app: APP }) + CHECK(JSON.stringify(APP_MUTANTS.map(([d, s]) => [d, { app: s }]))),
      expected: verdict(APP_MUTANTS.map((m) => m[0])),
      hint: "Quatre tests : un GET inexistant attend 404, un POST valide attend 201 puis relit le nom avec GET, un POST avec prix négatif attend 422. Le TestClient relance les erreurs du serveur : avec la faute « erreur 500 », ton test échouera, c'est voulu."
    }
  },
  {
    id: "api-10", section: "Tester", title: "Doublures : mocks et dépendances", xp: 120,
    theory: `<p>Un test unitaire ne doit dépendre ni du réseau, ni d'une API externe, ni de l'heure : ce serait lent, instable et parfois payant. On remplace ces dépendances par des <strong>doublures</strong> le temps du test :</p>
<ul><li>un <strong>stub</strong> renvoie une valeur fixée (« le taux de l'euro vaut 1,5 ») ;</li><li>un <strong>mock</strong> enregistre aussi comment il a été appelé, pour vérifier l'interaction (« le service de paiement a été appelé une fois, avec 42 $ »).</li></ul>
~~~py norun
from unittest.mock import patch
import conversion

def test_euros():
    with patch("banque.taux", return_value=1.5) as faux_taux:
        assert conversion.en_dollars(10, "EUR") == 15.0
    faux_taux.assert_called_once_with("EUR")
~~~
<p>La règle d'or de @@patch@@ : on remplace le nom <strong>là où il est utilisé</strong>. Ici @@conversion@@ appelle @@banque.taux(...)@@, donc on patche @@banque.taux@@ ; si @@conversion@@ avait fait @@from banque import taux@@, il faudrait patcher @@conversion.taux@@. La fixture @@monkeypatch@@ de pytest fait de même : @@monkeypatch.setattr(banque, "taux", lambda d: 1.5)@@.</p>
<p>Avec FastAPI, on remplace une dépendance entière : @@app.dependency_overrides[utilisateur] = lambda: "admin"@@ pour tester une route protégée sans vrai jeton, ou une session de base de données de test. Attention à ne pas tout simuler : trop de mocks testent le mock, pas le code. Les tests d'intégration complètent avec de vraies dépendances (une base PostgreSQL dans un conteneur, par exemple).</p>`,
    setup: LAB,
    quiz: [
      { q: "conversion.py fait « from banque import taux ». Que faut-il patcher ?", options: ["banque.taux", "conversion.taux, le nom que conversion utilise réellement", "taux", "unittest.mock"], answer: 1, explain: "from … import copie la référence dans conversion : patcher banque.taux ne la change plus." },
      { q: "Différence entre un stub et un mock ?", options: ["Aucune", "Le stub renvoie des réponses prévues ; le mock permet en plus de vérifier comment il a été appelé", "Le mock est plus rapide", "Le stub ne marche qu'avec pytest"], answer: 1, explain: "unittest.mock.Mock fait les deux : return_value et assert_called_with." }
    ],
    challenge: {
      prompt: `<p>Deux modules :</p><pre>${("# banque.py\n" + BANQUE + "\n# conversion.py\n" + CONVERSION).replace(/</g, "&lt;")}</pre><p>@@banque.taux@@ appelle le réseau et échoue pendant les tests. Écris les tests de @@conversion.en_dollars@@ en remplaçant @@banque.taux@@ par une doublure, pour détecter les trois fautes que le vérificateur va introduire.</p>`,
      starter: "from unittest.mock import patch\nimport conversion\n\n\ndef test_cad():\n    assert conversion.en_dollars(10, \"CAD\") == 10\n",
      solution: "from unittest.mock import patch\nimport conversion\n\n\ndef test_cad_sans_reseau():\n    with patch(\"banque.taux\") as faux_taux:\n        assert conversion.en_dollars(10, \"CAD\") == 10\n    faux_taux.assert_not_called()\n\n\ndef test_euros():\n    with patch(\"banque.taux\", return_value=1.5) as faux_taux:\n        assert conversion.en_dollars(10, \"EUR\") == 15.0\n    faux_taux.assert_called_once_with(\"EUR\")\n\n\ndef test_arrondi():\n    with patch(\"banque.taux\", return_value=1.4733):\n        assert conversion.en_dollars(10, \"EUR\") == 14.73\n",
      runWith: M({ banque: BANQUE, conversion: CONVERSION }) + RUN,
      tests: M({ banque: BANQUE, conversion: CONVERSION }) + CHECK(JSON.stringify(CONVERSION_MUTANTS)),
      expected: verdict(CONVERSION_MUTANTS.map((m) => m[0])),
      hint: "with patch(\"banque.taux\", return_value=1.5): en_dollars(10, \"EUR\") doit donner 15.0. Pour CAD, vérifie que la doublure n'a pas été appelée (assert_not_called). Un taux comme 1.4733 révèle l'arrondi oublié."
    }
  },
  {
    id: "api-11", section: "Entretien", title: "Questions d'entretien API et tests", xp: 60, theoryOnly: true,
    theory: `<p>Les questions sur les API et les tests reviennent en entretien backend, DevOps et MLOps (une API qui sert un modèle, c'est une API). On attend des réponses concrètes, avec un exemple vécu si possible.</p>
<div class="qa">
<details><summary>Qu'est-ce qu'une API REST ?</summary><p>Une API organisée autour de ressources désignées par des URL et manipulées par les méthodes HTTP (GET, POST, PUT, PATCH, DELETE), sans état côté serveur entre deux requêtes, avec des codes de statut et des représentations (souvent JSON) standard.</p></details>
<details><summary>Quelles méthodes sont idempotentes, et pourquoi c'est important ?</summary><p>GET, PUT, DELETE (et HEAD, OPTIONS). Répéter la requête ne change pas le résultat : on peut la rejouer après un délai dépassé. Pour POST, on ajoute une clé d'idempotence.</p></details>
<details><summary>401 ou 403 ? 400 ou 422 ? 500 ou 503 ?</summary><p>401 : non authentifié ; 403 : authentifié mais pas autorisé. 400 : requête mal formée ; 422 : bien formée mais données invalides. 500 : erreur inattendue du serveur ; 503 : service temporairement indisponible (surcharge, maintenance), à réessayer.</p></details>
<details><summary>Comment versionner une API ?</summary><p>Dans le chemin (/v1/…), le plus lisible, ou dans un en-tête. On n'enlève ni ne renomme un champ dans une version publiée ; on ajoute, on annonce la fin de vie de l'ancienne version et on mesure qui l'utilise encore.</p></details>
<details><summary>Comment paginer une grande liste ?</summary><p>Par décalage (limit et offset), simple mais lent et instable sur de grosses tables qui bougent, ou par curseur (« après l'id 1234 »), stable et rapide grâce à l'index. On renvoie le lien ou le curseur de la page suivante.</p></details>
<details><summary>Comment sécuriser une API ?</summary><p>HTTPS, authentification (OAuth 2, OpenID Connect, JWT courts, clés d'API pour les services), autorisation vérifiée côté serveur sur chaque ressource, validation stricte des entrées, limites de débit (429), secrets hors du code, journaux sans données sensibles, CORS restreint.</p></details>
<details><summary>Qu'est-ce qu'un JWT ?</summary><p>Un jeton en trois parties (en-tête, contenu, signature) encodées en base64. Il est signé, pas chiffré : on vérifie sa signature et sa date d'expiration, et on n'y met pas de secret. Sa révocation est difficile, d'où des durées courtes et des jetons de rafraîchissement.</p></details>
<details><summary>Quelle différence entre tests unitaires, d'intégration et de bout en bout ?</summary><p>Unitaire : une fonction isolée, en millisecondes, dépendances remplacées. Intégration : plusieurs composants réels ensemble (API et base). Bout en bout : le système complet comme un utilisateur. La pyramide : beaucoup de premiers, moins de seconds, peu de derniers.</p></details>
<details><summary>Une couverture de 100 % garantit-elle des tests efficaces ?</summary><p>Non : elle dit quelles lignes ont été exécutées, pas si les résultats ont été vérifiés. Un test sans assert couvre du code. Le test par mutation mesure mieux l'efficacité : les tests attrapent-ils une erreur introduite exprès ?</p></details>
<details><summary>Quand utiliser un mock, et quand l'éviter ?</summary><p>Pour isoler une dépendance lente, instable, coûteuse ou non déterministe (réseau, horloge, paiement). L'éviter pour ce qu'on peut exécuter vraiment à faible coût, et ne pas simuler le code qu'on teste : trop de mocks figent l'implémentation et laissent passer les vrais bogues.</p></details>
<details><summary>Comment serviriez-vous un modèle de ML derrière une API ?</summary><p>Une route POST /predictions avec un modèle Pydantic pour les entrées, le modèle chargé une fois au démarrage, une réponse avec la prédiction et la version du modèle, des tests sur des cas connus, des métriques de latence et d'erreurs, puis un conteneur déployé derrière un équilibreur avec plusieurs instances.</p></details>
</div>`,
    practice: { title: "S'entraîner", body: `<p>Choisis trois questions et réponds à voix haute. Puis le projet qui rassemble l'étape : une API FastAPI branchée sur PostgreSQL (le schéma de la boutique du cours SQL), avec authentification par jeton, une suite pytest (unitaires, puis intégration avec une base dans un conteneur), un Dockerfile, une CI GitHub Actions qui lance les tests et publie l'image, et la documentation @@/docs@@ dans le README.</p>` },
    quiz: [
      { q: "Un client relance une requête PUT après un délai dépassé. Risque-t-il de créer un doublon ?", options: ["Oui", "Non : PUT remplace la ressource par la même représentation, l'état final est identique", "Seulement si le serveur est lent", "Oui, comme POST"], answer: 1, explain: "C'est la définition de l'idempotence." },
      { q: "Ta suite de tests atteint 95 % de couverture, mais aucun mutant n'est détecté. Que conclure ?", options: ["Tout va bien", "Les tests exécutent le code sans vraiment vérifier ses résultats : il manque des assertions précises", "La couverture est fausse", "Il faut plus de mocks"], answer: 1, explain: "Couvrir n'est pas vérifier." }
    ]
  }
];
