/* Défis gradués du bloc DevOps (leçons Python du cours CI/CD) : questions d'entretien sur la mise en production
   d'un site (format : README, « defis »). */
const R = String.raw;

export default {
  "ci-23": [{
    niveau: "entretien",
    prompt: R`<p>Le script de CI qui prépare le service worker. Écris :</p><ul><li>@@precache(fichiers)@@ : @@fichiers@@ associe un chemin à son contenu (texte). Renvoie @@(version, liste)@@ : la liste triée des chemins, sans fichiers cachés (une partie du chemin commence par @@.@@) ni @@__pycache__@@ ; la version est les 12 premiers caractères hexadécimaux du SHA-256 de chaque chemin de la liste suivi de @@"\0"@@ et de son contenu, dans l'ordre de la liste ;</li><li>@@a_supprimer(cles, version)@@ : les noms de caches à supprimer à l'activation, triés : ceux qui commencent par @@site-@@ et ne valent pas @@"site-" + version@@.</li></ul>`,
    starter: "import hashlib\n\n\ndef precache(fichiers):\n    return \"\", sorted(fichiers)\n\n\ndef a_supprimer(cles, version):\n    return []\n",
    solution: R`import hashlib


def precache(fichiers):
    liste = sorted(f for f in fichiers
                   if not any(p.startswith(".") or p == "__pycache__" for p in f.split("/")))
    h = hashlib.sha256()
    for f in liste:
        h.update((f + "\0" + fichiers[f]).encode())
    return h.hexdigest()[:12], liste


def a_supprimer(cles, version):
    return sorted(k for k in cles if k.startswith("site-") and k != "site-" + version)
`,
    tests: R`site = {"index.html": "<h1>v1</h1>", "main.js": "go()", ".nojekyll": "", "py/__pycache__/x.pyc": "??", "py/harness.py": "x = 1"}
v1, liste = precache(site)
print(liste, len(v1))
melange = dict(reversed(list(site.items())))
print(precache(melange)[0] == v1)
site["main.js"] = "go(2)"
v2 = precache(site)[0]
print(v2 != v1, precache({**site, ".git/HEAD": "ref"})[0] == v2)
print(a_supprimer(["site-" + v1, "site-" + v2, "cdn-v1", "autre"], v2))
print(v1)
`,
    expected: "['index.html', 'main.js', 'py/harness.py'] 12\nTrue\nTrue True\n['site-7dceb1bf8893']\n7dceb1bf8893",
    hints: ["Filtre les chemins avec any(...) sur leurs parties f.split(\"/\"), puis trie.", "Un seul hashlib.sha256() alimenté dans l'ordre de la liste triée : l'ordre du dictionnaire ne change donc pas la version.", "a_supprimer : startswith(\"site-\") et différent du cache courant ; le cache du CDN reste."]
  }],
  "ci-24": [{
    niveau: "entretien",
    prompt: R`<p>On te demande d'auditer les en-têtes HTTP d'un site. Écris @@auditer(entetes)@@ : @@entetes@@ est un dictionnaire (noms en casse quelconque). Renvoie la liste triée des problèmes parmi :</p><ul><li>@@"csp absente"@@ ;</li><li>@@"script inline autorisé"@@ : @@'unsafe-inline'@@ dans @@script-src@@, ou dans @@default-src@@ si @@script-src@@ est absente ;</li><li>@@"eval autorisé"@@ : @@'unsafe-eval'@@, avec la même règle ;</li><li>@@"hsts absent"@@, ou @@"hsts trop court"@@ si @@max-age@@ est inférieur à 15 552 000 secondes (180 jours) ;</li><li>@@"nosniff absent"@@ si @@X-Content-Type-Options@@ ne vaut pas @@nosniff@@ ;</li><li>@@"clickjacking"@@ si la CSP n'a pas @@frame-ancestors@@ et que @@X-Frame-Options@@ ne vaut ni @@DENY@@ ni @@SAMEORIGIN@@.</li></ul>`,
    starter: "def auditer(entetes):\n    if \"Content-Security-Policy\" not in entetes:\n        return [\"csp absente\"]\n    return []\n",
    solution: R`def auditer(entetes):
    e = {k.lower(): v.strip() for k, v in entetes.items()}
    problemes = []
    csp = {}
    if "content-security-policy" in e:
        for morceau in e["content-security-policy"].split(";"):
            mots = morceau.split()
            if mots:
                csp[mots[0].lower()] = mots[1:]
    else:
        problemes.append("csp absente")
    scripts = csp.get("script-src", csp.get("default-src", []))
    if "'unsafe-inline'" in scripts:
        problemes.append("script inline autorisé")
    if "'unsafe-eval'" in scripts:
        problemes.append("eval autorisé")
    hsts = e.get("strict-transport-security")
    if hsts is None:
        problemes.append("hsts absent")
    else:
        age = 0
        for partie in hsts.split(";"):
            partie = partie.strip().lower()
            if partie.startswith("max-age="):
                age = int(partie.split("=", 1)[1])
        if age < 15552000:
            problemes.append("hsts trop court")
    if e.get("x-content-type-options", "").lower() != "nosniff":
        problemes.append("nosniff absent")
    if "frame-ancestors" not in csp and e.get("x-frame-options", "").upper() not in ("DENY", "SAMEORIGIN"):
        problemes.append("clickjacking")
    return sorted(problemes)
`,
    tests: R`print(auditer({}))
print(auditer({"content-security-policy": "default-src 'self' 'unsafe-inline' 'unsafe-eval'", "Strict-Transport-Security": "max-age=86400", "X-Frame-Options": "sameorigin"}))
print(auditer({"Content-Security-Policy": "default-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'", "Strict-Transport-Security": "max-age=31536000; includeSubDomains", "X-Content-Type-Options": "nosniff"}))
`,
    expected: "['clickjacking', 'csp absente', 'hsts absent', 'nosniff absent']\n['eval autorisé', 'hsts trop court', 'nosniff absent', 'script inline autorisé']\n[]",
    hints: ["Normalise d'abord les noms d'en-têtes en minuscules, puis découpe la CSP en directives comme dans le défi principal.", "script-src, sinon default-src : c'est la liste qui décide pour les scripts.", "HSTS : cherche la partie qui commence par max-age= et compare l'entier à 15 552 000."]
  }]
};
