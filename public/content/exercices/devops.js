/* Exercices courts du bloc DevOps (leçons Python du cours CI/CD). Chaque réponse est vérifiée par exécution. */
const R = String.raw;

export default {
  "ci-23": [
    { type: "sortie", consigne: "La stratégie « cache, puis mise à jour », simulée.", code: R`cache = {"police.woff2": "v1"}
serveur = {"police.woff2": "v2"}
appels = []

def cache_puis_maj(url):
    reponse = cache.get(url)
    cache[url] = serveur[url]      # mise à jour en arrière-plan
    appels.append(url)
    return reponse or cache[url]

print(cache_puis_maj("police.woff2"), cache_puis_maj("police.woff2"), len(appels))`, reponse: "v1 v2 2",
      explain: "Le premier appel rend la copie en cache (v1) tout en la remplaçant par celle du serveur : le visiteur voit v2 à la visite suivante. Le réseau est appelé à chaque fois." },
    { type: "trous", consigne: "À l'activation, supprime les caches des anciennes versions du site, sans toucher au cache du CDN.", code: R`caches = ["site-a1b2c3", "site-d4e5f6", "cdn-v1"]
actuel = "site-d4e5f6"
a_supprimer = [k for k in caches if k.⟦startswith⟧("site-") and k ⟦!=§is not⟧ actuel]
print(a_supprimer)`, attendu: "['site-a1b2c3']",
      explain: R`Seuls les caches du site sont versionnés : on garde le courant et le cache du CDN, dont les fichiers ne changent jamais.` },
    { type: "ordre", consigne: "Le cycle de vie d'un service worker, dans l'ordre où le navigateur le déroule.", lignes: ["etapes = []", "etapes.append(\"register\")", "etapes.append(\"install\")", "etapes.append(\"activate\")", "etapes.append(\"fetch\")", "print(\" → \".join(etapes))"], attendu: "register → install → activate → fetch",
      explain: R`La page enregistre le script ; @@install@@ remplit le précache ; @@activate@@ nettoie les anciens caches ; ensuite seulement le service worker répond aux requêtes (@@fetch@@).` }
  ],
  "ci-24": [
    { type: "sortie", consigne: "Quelle liste de sources s'applique à chaque type de ressource ?", code: R`csp = "default-src 'self'; img-src * data:; script-src 'self' 'nonce-r4nd0m'"
d = {}
for morceau in csp.split(";"):
    mots = morceau.split()
    d[mots[0]] = mots[1:]
for directive in ["script-src", "font-src", "img-src"]:
    print(directive, " ".join(d.get(directive, d["default-src"])))`, reponse: "script-src 'self' 'nonce-r4nd0m'\nfont-src 'self'\nimg-src * data:",
      explain: R`@@font-src@@ est absente : @@default-src@@ s'applique. Le nonce autorise le seul script inline qui porte @@nonce="r4nd0m"@@, renouvelé à chaque réponse.` },
    { type: "trous", consigne: "Un an de HSTS, et pas de devinette sur le type des fichiers.", code: R`entetes = {}
entetes["Strict-Transport-Security"] = "max-age=" + str(365 * 24 * ⟦3600⟧) + "; includeSubDomains"
entetes["X-Content-Type-Options"] = "⟦nosniff⟧"
for nom, valeur in entetes.items():
    print(nom + ": " + valeur)`, attendu: "Strict-Transport-Security: max-age=31536000; includeSubDomains\nX-Content-Type-Options: nosniff",
      explain: R`@@max-age@@ est en secondes : 31 536 000 pour un an. @@nosniff@@ interdit au navigateur d'exécuter un fichier dont le type déclaré n'est pas un script.` },
    { type: "ordre", consigne: "Introduire une CSP sur un site en production sans le casser.", lignes: ["etapes = []", "etapes.append(\"inventorier ce que la page charge\")", "etapes.append(\"publier en Report-Only\")", "etapes.append(\"corriger les violations signalées\")", "etapes.append(\"appliquer la politique\")", "print(len(etapes), etapes[-1])"], attendu: "4 appliquer la politique",
      explain: "On ne bloque qu'une fois sûr de ne rien casser : le mode Report-Only signale sans bloquer, le temps de corriger." }
  ]
};
