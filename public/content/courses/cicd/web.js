/* Cours CI/CD — chapitre « Mettre un site en production » : hors ligne (service worker) et en-têtes de sécurité
   (CSP). Les mêmes choses ont été faites sur Boucle lui-même (AUDIT #19 et #21) : public/sw.js, index.html. */
import { Y } from "./tag.js";

export default [
  {
    id: "ci-23", section: "Mettre un site en production", title: "Un site qui marche hors ligne : service worker et cache", xp: 90, lang: "py",
    theory: Y`<p>Une <strong>PWA</strong> (Progressive Web App) est un site qui s'installe comme une application et s'ouvre sans réseau. Trois ingrédients :</p>
<ul><li>le <strong>HTTPS</strong> (obligatoire, sauf sur @@localhost@@) ;</li><li>un <strong>manifeste</strong> (@@manifest.webmanifest@@) : nom, icônes 192 et 512 px, couleurs, @@"display": "standalone"@@ ;</li><li>un <strong>service worker</strong> : un script qui s'intercale entre la page et le réseau, et répond à chaque requête, depuis le réseau ou depuis son cache.</li></ul>
<p>Son cycle de vie tient en trois événements :</p>
~~~text
register("sw.js")  →  install   : mettre en cache les fichiers du site (précache)
                   →  activate  : supprimer les caches des anciennes versions
                   →  fetch     : pour chaque requête, choisir une stratégie
~~~
<p>Les trois stratégies classiques :</p>
<table><tr><th>Stratégie</th><th>Comportement</th><th>Pour quoi</th></tr>
<tr><td>Cache d'abord</td><td>Le cache s'il a la réponse, sinon le réseau (et on garde la réponse)</td><td>Fichiers <strong>versionnés</strong>, dont l'adresse change à chaque version : @@pyodide/v0.29.5/…@@, @@app.3f9a2c.js@@</td></tr>
<tr><td>Réseau d'abord</td><td>Le réseau, et le cache seulement s'il échoue</td><td>Pages et fichiers à adresse fixe (@@index.html@@, @@main.js@@) : toujours à jour en ligne</td></tr>
<tr><td>Cache, puis mise à jour</td><td>Le cache tout de suite, et le réseau en arrière-plan rafraîchit le cache pour la prochaine fois</td><td>Ce qui peut avoir une version de retard : polices, avatars</td></tr></table>
<p><strong>Le piège classique</strong> : « cache d'abord » sur @@index.html@@. Le site se fige à la version de la première visite, et un correctif publié n'arrive jamais chez l'utilisateur.</p>
<p><strong>Versionner le précache</strong> : le cache porte un nom qui contient une empreinte du contenu (@@site-3f9a2c…@@). Si un fichier change, l'empreinte change, donc @@sw.js@@ change d'un octet : le navigateur installe le nouveau service worker, qui remplit un nouveau cache, et l'activation supprime l'ancien. La liste et l'empreinte se génèrent par un script en CI, jamais à la main.</p>
<p>La CI de Boucle fait exactement cela : @@scripts/precache.mjs@@ écrit la liste dans @@public/sw.js@@, et un test échoue si elle est périmée. Un test de bout en bout coupe le réseau (@@context.set_offline(True)@@ dans Playwright) et vérifie que le site s'ouvre.</p>
<p>Simulons les deux premières stratégies, avec un dictionnaire pour cache et une fonction qui lève @@ConnectionError@@ quand le réseau manque :</p>
~~~py
cache = {}
en_ligne = True

def reseau(url):
    if not en_ligne:
        raise ConnectionError(url)
    return "contenu de " + url

def reseau_dabord(url):
    try:
        cache[url] = reseau(url)
        return cache[url], "réseau"
    except ConnectionError:
        return cache[url], "cache"

print(reseau_dabord("/index.html"))
en_ligne = False
print(reseau_dabord("/index.html"))
~~~`,
    quiz: [
      { q: "Quelle stratégie convient à @@https://cdn.jsdelivr.net/pyodide/v0.29.5/full/pyodide.js@@ ?", options: ["Réseau d'abord", "Cache d'abord : l'adresse contient la version, son contenu ne changera jamais", "Aucun cache", "Cache, puis mise à jour"], answer: 1, explain: "Un fichier dont l'adresse est versionnée est immuable : le relire sur le réseau ne sert à rien." },
      { q: "Un site met @@index.html@@ en « cache d'abord ». Que se passe-t-il au déploiement suivant ?", options: ["Rien de grave", "Les visiteurs déjà venus gardent l'ancienne page, et donc l'ancienne version du site", "Le navigateur vide le cache automatiquement", "Le service worker est supprimé"], answer: 1, explain: "La page vient toujours du cache : le correctif n'est jamais téléchargé. Réseau d'abord pour les pages." },
      { q: "Comment le navigateur sait-il qu'il doit installer une nouvelle version du service worker ?", options: ["Il compare sw.js octet par octet avec la version installée", "Il regarde la date du fichier index.html", "Il ne le sait jamais : il faut vider le cache", "Le serveur envoie un événement"], answer: 0, explain: "D'où l'empreinte du contenu écrite dans sw.js : tout changement du site change sw.js." },
      { q: "Qu'est-ce qu'un service worker ne peut <em>pas</em> faire ?", options: ["Répondre à une requête depuis son cache", "Tourner sur une page HTTP non sécurisée d'un vrai domaine", "Supprimer d'anciens caches", "Intercepter les requêtes d'un Web Worker de la page"], answer: 1, explain: "Le HTTPS est obligatoire (sauf localhost) : un service worker détourné sur HTTP contrôlerait tout le site." }
    ],
    challenge: {
      prompt: Y`<p>Écris les deux stratégies d'un service worker, sur un cache simulé :</p><ul><li>@@cache_dabord(url, cache, reseau)@@ : si @@url@@ est dans le dictionnaire @@cache@@, renvoie @@(contenu, "cache")@@ ; sinon appelle @@reseau(url)@@, range le contenu dans le cache et renvoie @@(contenu, "réseau")@@ ;</li><li>@@reseau_dabord(url, cache, reseau)@@ : appelle d'abord le réseau (et range le contenu dans le cache) ; si @@reseau@@ lève @@ConnectionError@@, renvoie la copie du cache avec @@"cache"@@ ; sans copie, renvoie @@(None, "hors ligne")@@.</li></ul>`,
      starter: "def cache_dabord(url, cache, reseau):\n    return reseau(url), \"réseau\"\n\n\ndef reseau_dabord(url, cache, reseau):\n    return reseau(url), \"réseau\"\n",
      solution: Y`def cache_dabord(url, cache, reseau):
    if url in cache:
        return cache[url], "cache"
    contenu = reseau(url)
    cache[url] = contenu
    return contenu, "réseau"


def reseau_dabord(url, cache, reseau):
    try:
        contenu = reseau(url)
    except ConnectionError:
        if url in cache:
            return cache[url], "cache"
        return None, "hors ligne"
    cache[url] = contenu
    return contenu, "réseau"
`,
      tests: Y`appels = []
version = {"n": 1}
en_ligne = {"ok": True}

def reseau(url):
    appels.append(url)
    if not en_ligne["ok"]:
        raise ConnectionError(url)
    return url + " v" + str(version["n"])

cdn, site = {}, {}
print(cache_dabord("pyodide.js", cdn, reseau), cache_dabord("pyodide.js", cdn, reseau), len(appels))
print(reseau_dabord("index.html", site, reseau))
version["n"] = 2
print(reseau_dabord("index.html", site, reseau))
en_ligne["ok"] = False
print(reseau_dabord("index.html", site, reseau), reseau_dabord("cours.js", site, reseau), cache_dabord("pyodide.js", cdn, reseau))
`,
      expected: "('pyodide.js v1', 'réseau') ('pyodide.js v1', 'cache') 1\n('index.html v1', 'réseau')\n('index.html v2', 'réseau')\n('index.html v2', 'cache') (None, 'hors ligne') ('pyodide.js v1', 'cache')",
      hints: ["cache_dabord : un simple test « url in cache » avant d'appeler le réseau.", "reseau_dabord : appelle le réseau dans un try ; dans except ConnectionError, cherche une copie dans le cache.", "Dans les deux cas, une réponse venue du réseau est rangée dans le cache : c'est elle qui servira hors ligne."]
    }
  },
  {
    id: "ci-24", section: "Mettre un site en production", title: "En-têtes de sécurité et Content-Security-Policy", xp: 90, lang: "py",
    theory: Y`<p>Quelques en-têtes HTTP ferment des familles entières d'attaques, sans toucher au code :</p>
<table><tr><th>En-tête</th><th>Contre quoi</th></tr>
<tr><td>@@Content-Security-Policy@@</td><td>Le XSS : du script injecté ne s'exécute pas s'il ne vient pas d'une origine autorisée</td></tr>
<tr><td>@@Strict-Transport-Security: max-age=31536000; includeSubDomains@@</td><td>Le retour forcé en HTTP : le navigateur n'utilisera que HTTPS pendant un an</td></tr>
<tr><td>@@X-Content-Type-Options: nosniff@@</td><td>Un fichier texte interprété comme script parce que le navigateur « devine » son type</td></tr>
<tr><td>@@frame-ancestors 'none'@@ (CSP) ou @@X-Frame-Options: DENY@@</td><td>Le clickjacking : ton site affiché, invisible, dans un cadre d'un autre site</td></tr>
<tr><td>@@Referrer-Policy: strict-origin-when-cross-origin@@</td><td>Les adresses complètes (avec jetons dans l'URL) envoyées aux autres sites</td></tr></table>
<p>Une <strong>CSP</strong> est une liste de directives séparées par des points-virgules ; chaque directive liste les sources permises pour un type de ressource :</p>
~~~text
default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline';
img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'
~~~
<ul><li>@@default-src@@ sert pour toute directive absente (@@img-src@@, @@connect-src@@, @@font-src@@…) ;</li><li>@@'self'@@ = même origine que la page (même schéma, hôte et port) ; @@'none'@@ = rien ; @@https://cdn.jsdelivr.net@@ = cet hôte en HTTPS ; @@data:@@ = les adresses @@data:@@ ;</li><li>@@'unsafe-inline'@@ dans @@script-src@@ annule l'essentiel de la protection : un script injecté dans la page est inline. Pour un script inline légitime, on préfère un <strong>nonce</strong> ou un <strong>hash</strong> ;</li><li>@@'unsafe-eval'@@ autorise @@eval@@ et @@new Function@@ ; @@'wasm-unsafe-eval'@@ seulement la compilation de WebAssembly.</li></ul>
<p><strong>Où la mettre ?</strong> En en-tête HTTP de préférence (@@vercel.json@@, nginx, CloudFront). Un hébergeur sans en-têtes (GitHub Pages) accepte une balise @@meta@@ avec @@http-equiv="Content-Security-Policy"@@, mais @@frame-ancestors@@ y est ignoré.</p>
<p><strong>Déployer sans casser</strong> : d'abord @@Content-Security-Policy-Report-Only@@, qui signale les violations sans rien bloquer ; on corrige pendant quelques jours ; puis on applique. Vérification : @@curl -sI https://site | grep -i content-security@@, la console du navigateur, et des tests e2e qui échouent sur une violation.</p>
<p>Sur Boucle, l'interpréteur C++ utilisait @@eval@@ sur la page. Plutôt que d'autoriser @@'unsafe-eval'@@ pour tout le site, il tourne maintenant dans un Web Worker : la page garde une politique stricte.</p>
~~~py
csp = "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; object-src 'none'"
directives = {}
for morceau in csp.split(";"):
    mots = morceau.split()
    if mots:
        directives[mots[0]] = mots[1:]
print(directives["script-src"])
print(directives.get("img-src", directives["default-src"]))
~~~`,
    quiz: [
      { q: "Une CSP contient @@default-src 'self'@@ et aucune directive @@img-src@@. Une image de @@https://images.exemple.com@@ est-elle chargée ?", options: ["Oui, img-src n'est pas restreint", "Non : sans img-src, default-src s'applique, et seule la même origine est permise", "Oui, les images ne sont jamais bloquées", "Seulement en HTTPS"], answer: 1, explain: "default-src sert de valeur de repli à toutes les directives de type -src absentes." },
      { q: "Pourquoi @@script-src 'self' 'unsafe-inline'@@ protège-t-il mal contre le XSS ?", options: ["Il bloque les scripts du site", "Un XSS injecte justement du script inline dans la page : 'unsafe-inline' l'autorise", "Il interdit les fichiers .js", "Il n'a aucun effet"], answer: 1, explain: "Pour un script inline nécessaire, un nonce ou un hash autorise ce script-là seulement." },
      { q: "Le site est sur GitHub Pages, qui ne permet pas d'en-têtes. Que perd-on avec une CSP en balise meta ?", options: ["Rien", "frame-ancestors (et le signalement par report-uri), ignorés dans une balise meta", "script-src", "Toute la politique"], answer: 1, explain: "Contre le clickjacking, il faut alors un en-tête ailleurs (un CDN devant le site) ou accepter le risque." },
      { q: "Comment introduire une CSP sur un gros site existant sans risquer de le casser ?", options: ["L'appliquer un vendredi soir", "D'abord en Content-Security-Policy-Report-Only, corriger les violations signalées, puis l'appliquer", "Mettre default-src *", "Attendre une attaque"], answer: 1, explain: "Le mode Report-Only signale sans bloquer : on voit ce que la politique casserait." }
    ],
    challenge: {
      prompt: Y`<p>Écris @@autorise(csp, directive, url, page)@@ : vrai si la politique @@csp@@ (une chaîne) permet de charger @@url@@ pour @@directive@@ (par exemple @@"script-src"@@), sur une page d'origine @@page@@ (par exemple @@"https://boucle.dev"@@). Règles à gérer :</p><ul><li>si la directive est absente, @@default-src@@ s'applique ; si elle aussi est absente, tout est permis ;</li><li>@@'none'@@ ne permet rien ; @@'self'@@ permet une @@url@@ de même origine que @@page@@ (schéma et hôte identiques) ;</li><li>une source comme @@https://cdn.jsdelivr.net@@ permet les adresses de cet hôte avec ce schéma ;</li><li>@@data:@@ permet les adresses qui commencent par @@data:@@.</li></ul><p>@@origine(url)@@ est fournie : elle renvoie @@"https://hote"@@ pour une adresse complète.</p>`,
      starter: "def origine(url):\n    schema, reste = url.split(\"://\", 1)\n    return schema + \"://\" + reste.split(\"/\", 1)[0]\n\n\ndef autorise(csp, directive, url, page):\n    return True\n",
      solution: Y`def origine(url):
    schema, reste = url.split("://", 1)
    return schema + "://" + reste.split("/", 1)[0]


def autorise(csp, directive, url, page):
    directives = {}
    for morceau in csp.split(";"):
        mots = morceau.split()
        if mots:
            directives[mots[0].lower()] = mots[1:]
    sources = directives.get(directive, directives.get("default-src"))
    if sources is None:
        return True
    for s in sources:
        if s == "'none'":
            return False
        if s == "'self'" and "://" in url and origine(url) == origine(page):
            return True
        if s == "data:" and url.startswith("data:"):
            return True
        if "://" in s and "://" in url and origine(url) == s.rstrip("/"):
            return True
    return False
`,
      tests: Y`csp = "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; img-src 'self' data:; object-src 'none'"
page = "https://boucle.dev"
print(autorise(csp, "script-src", "https://cdn.jsdelivr.net/pyodide/v0.29.5/full/pyodide.js", page), autorise(csp, "script-src", "https://evil.example/x.js", page), autorise(csp, "script-src", "https://boucle.dev/main.js", page))
print(autorise(csp, "img-src", "data:image/png;base64,AAAA", page), autorise(csp, "connect-src", "https://api.exemple.com/v1", page), autorise(csp, "connect-src", "https://boucle.dev/data.csv", page))
print(autorise(csp, "object-src", "https://boucle.dev/flash.swf", page), autorise(csp, "script-src", "http://cdn.jsdelivr.net/a.js", page), autorise("img-src 'self'", "font-src", "https://fonts.gstatic.com/f.woff2", page))
`,
      expected: "True False True\nTrue False True\nFalse False True",
      hints: ["Découpe la politique sur « ; », puis chaque morceau sur les espaces : le premier mot est la directive, les suivants ses sources.", "Directive absente : default-src ; absente aussi : tout est permis.", "Compare des origines (schéma + hôte) : http://cdn.jsdelivr.net n'est pas https://cdn.jsdelivr.net."]
    }
  }
];
