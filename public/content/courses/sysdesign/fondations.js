/* Cours System design (étape 8, US-9c #96) : la méthode d'entretien, puis les briques d'une architecture distribuée.
   Chaque brique est modélisée en Python pur (répartiteur, cache, hachage cohérent, seau à jetons…) et testée. */
const PY = String.raw;

export const LAB = `<p><strong>Sur ta machine</strong> : dessine chaque architecture (Excalidraw, draw.io, ou au tableau), puis confronte-la à un vrai système : le cours AWS de Boucle (ELB, ElastiCache, RDS, SQS) et les guides publics comme <em>System Design Primer</em> sur GitHub. En entretien, on dessine en parlant : chaque boîte doit répondre à une exigence.</p>`;

export default [
  {
    id: "sd-01", section: "Méthode", title: "L'entretien de system design et les estimations", xp: 100,
    theory: `<p>Un entretien de <strong>system design</strong> (45 à 60 minutes) demande de concevoir un service : un raccourcisseur d'URL, un fil d'actualité, une messagerie. Il n'y a pas de réponse unique : on évalue la démarche, les compromis et la communication. Le déroulé attendu :</p>
~~~text
1. Exigences         fonctionnelles (que fait le service ?) et non fonctionnelles (latence, disponibilité, cohérence)
2. Estimations       utilisateurs, requêtes par seconde, stockage, bande passante
3. API               les points d'entrée principaux (POST /urls, GET /{code})
4. Données           le modèle et le choix de stockage
5. Architecture      un premier schéma simple, de bout en bout
6. Approfondir       les goulots d'étranglement : cache, réplication, partitionnement, files de messages
7. Compromis         ce qu'on sacrifie et pourquoi (cohérence contre disponibilité, coût contre latence)
~~~
<p>Les <strong>estimations</strong> (back-of-the-envelope) se font de tête, avec des ordres de grandeur : un jour compte environ 100 000 secondes (86 400), le pic vaut souvent 2 à 3 fois la moyenne, 1 million de requêtes par jour font environ 12 requêtes par seconde.</p>
~~~py
utilisateurs = 10_000_000          # utilisateurs actifs par jour
lectures_par_jour = 20
qps = utilisateurs * lectures_par_jour / 86_400
print(round(qps), "requêtes/s en moyenne, environ", round(qps * 3), "au pic")
print(round(utilisateurs * 2 * 1_000 * 365 / 1e12, 1), "To par an pour 2 objets de 1 Ko par utilisateur et par jour")
~~~
<p>Ces chiffres décident de l'architecture : 200 requêtes par seconde tiennent sur un seul serveur et une base PostgreSQL ; 200 000 demandent cache, réplicas et partitionnement.</p>`,
    setup: LAB,
    quiz: [
      { q: "Combien de requêtes par seconde pour 50 millions de requêtes par jour ?", options: ["Environ 60", "Environ 600", "Environ 6 000", "Environ 50 000"], answer: 1, explain: "50 000 000 / 86 400 ≈ 580." },
      { q: "Par quoi commencer un entretien de system design ?", options: ["Dessiner Kubernetes", "Clarifier les exigences fonctionnelles et non fonctionnelles, puis estimer la charge", "Choisir la base de données", "Écrire le code"], answer: 1, explain: "Sans exigences ni chiffres, aucun choix d'architecture n'est justifiable." }
    ],
    challenge: {
      prompt: `<p>Écris @@estimer(utilisateurs, ecritures, lectures, taille_ko, annees, pic=3)@@ : @@utilisateurs@@ actifs par jour, chacun faisant @@ecritures@@ écritures et @@lectures@@ lectures par jour, chaque écriture stockant @@taille_ko@@ kilo-octets. Renvoie un dictionnaire avec @@"ecritures_s"@@ et @@"lectures_s"@@ (moyennes par seconde, sur 86 400 s, arrondies à l'unité), @@"pic_lectures_s"@@ (moyenne des lectures × pic, arrondie), et @@"stockage_to"@@ (stockage cumulé sur @@annees@@ années de 365 jours, en téraoctets de 10¹² octets avec 1 Ko = 1 000 octets, arrondi à 0,1).</p>`,
      starter: PY`def estimer(utilisateurs, ecritures, lectures, taille_ko, annees, pic=3):
    return {"ecritures_s": utilisateurs * ecritures, "lectures_s": utilisateurs * lectures,
            "pic_lectures_s": 0, "stockage_to": 0}
`,
      solution: PY`def estimer(utilisateurs, ecritures, lectures, taille_ko, annees, pic=3):
    jour = 86_400
    lectures_s = utilisateurs * lectures / jour
    octets = utilisateurs * ecritures * taille_ko * 1_000 * 365 * annees
    return {
        "ecritures_s": round(utilisateurs * ecritures / jour),
        "lectures_s": round(lectures_s),
        "pic_lectures_s": round(lectures_s * pic),
        "stockage_to": round(octets / 1e12, 1),
    }
`,
      tests: PY`print(estimer(10_000_000, 2, 20, 1, 1))
print(estimer(100_000_000, 0.1, 100, 0.5, 5, pic=2))
print(estimer(1_000, 1, 1, 1, 1))
`,
      expected: "{'ecritures_s': 231, 'lectures_s': 2315, 'pic_lectures_s': 6944, 'stockage_to': 7.3}\n{'ecritures_s': 116, 'lectures_s': 115741, 'pic_lectures_s': 231481, 'stockage_to': 9.1}\n{'ecritures_s': 0, 'lectures_s': 0, 'pic_lectures_s': 0, 'stockage_to': 0.0}\n",
      hint: "Divise les volumes quotidiens par 86 400 ; le stockage vaut utilisateurs × écritures × taille_ko × 1 000 octets × 365 × années, divisé par 10¹²."
    }
  },
  {
    id: "sd-02", section: "Briques", title: "Répartiteurs de charge", xp: 100,
    theory: `<p>Un <strong>répartiteur de charge</strong> (load balancer) distribue les requêtes entre plusieurs serveurs identiques : on monte en charge horizontalement, et la panne d'un serveur n'arrête pas le service (il est retiré grâce aux <em>health checks</em>). Il peut agir en couche 4 (TCP, très rapide) ou en couche 7 (HTTP : routage par chemin, terminaison TLS, en-têtes).</p>
<ul><li><strong>tourniquet</strong> (round robin) : chacun son tour ; simple, efficace si les requêtes se ressemblent ;</li><li><strong>moins de connexions</strong> : vers le serveur le moins occupé ; mieux quand les requêtes durent plus ou moins longtemps ;</li><li><strong>hachage</strong> de l'adresse IP ou d'une clé : un même client va toujours au même serveur (affinité de session), au prix d'un déséquilibre possible.</li></ul>
<p>Pour que n'importe quel serveur puisse répondre, les serveurs d'application doivent être <strong>sans état</strong> : la session vit dans un cache partagé (Redis) ou un jeton signé, pas en mémoire locale. Le répartiteur lui-même ne doit pas être un point unique de panne : on en déploie deux, ou on utilise un service managé (AWS ELB).</p>
~~~py
import itertools

serveurs = ["web-1", "web-2", "web-3"]
tour = itertools.cycle(serveurs)
print([next(tour) for _ in range(5)])
~~~`,
    setup: LAB,
    quiz: [
      { q: "Pourquoi les serveurs derrière un répartiteur doivent-ils être sans état ?", options: ["Pour consommer moins", "Pour que n'importe lequel puisse traiter n'importe quelle requête, et qu'on puisse en ajouter ou en perdre un sans perdre de sessions", "Parce que le répartiteur l'exige", "Pour le chiffrement"], answer: 1, explain: "L'état part dans un stockage partagé (base, cache)." },
      { q: "Des requêtes durent de 10 ms à 30 s selon les cas. Quelle stratégie ?", options: ["Tourniquet", "Moins de connexions", "Aléatoire", "Hachage de l'IP"], answer: 1, explain: "Le tourniquet enverrait autant de requêtes longues à un serveur déjà chargé." }
    ],
    challenge: {
      prompt: `<p>Écris deux classes avec la même interface : @@choisir()@@ renvoie le serveur pour une nouvelle requête (et la compte comme active), @@terminer(serveur)@@ signale la fin d'une requête, @@retirer(serveur)@@ retire un serveur en panne. @@Tourniquet(serveurs)@@ tourne dans l'ordre de la liste en sautant les serveurs retirés ; @@MoinsDeConnexions(serveurs)@@ choisit le serveur qui a le moins de requêtes actives (le premier dans l'ordre de la liste en cas d'égalité). @@choisir()@@ lève @@RuntimeError@@ s'il ne reste aucun serveur.</p>`,
      starter: PY`class Tourniquet:
    def __init__(self, serveurs):
        self.serveurs = list(serveurs)

    def choisir(self):
        return self.serveurs[0]

    def terminer(self, serveur):
        pass

    def retirer(self, serveur):
        pass


class MoinsDeConnexions(Tourniquet):
    pass
`,
      solution: PY`class Tourniquet:
    def __init__(self, serveurs):
        self.serveurs = list(serveurs)
        self.actifs = {s: 0 for s in self.serveurs}
        self.i = 0

    def choisir(self):
        if not self.serveurs:
            raise RuntimeError("aucun serveur disponible")
        s = self.serveurs[self.i % len(self.serveurs)]
        self.i = (self.i + 1) % len(self.serveurs)
        self.actifs[s] += 1
        return s

    def terminer(self, serveur):
        if self.actifs.get(serveur, 0) > 0:
            self.actifs[serveur] -= 1

    def retirer(self, serveur):
        if serveur in self.serveurs:
            k = self.serveurs.index(serveur)
            self.serveurs.pop(k)
            if k < self.i:
                self.i -= 1
            if self.serveurs:
                self.i %= len(self.serveurs)
            else:
                self.i = 0


class MoinsDeConnexions(Tourniquet):
    def choisir(self):
        if not self.serveurs:
            raise RuntimeError("aucun serveur disponible")
        s = min(self.serveurs, key=lambda x: self.actifs[x])
        self.actifs[s] += 1
        return s
`,
      tests: PY`t = Tourniquet(["a", "b", "c"])
print([t.choisir() for _ in range(4)])
t.retirer("c")
print([t.choisir() for _ in range(4)])
m = MoinsDeConnexions(["a", "b", "c"])
print([m.choisir() for _ in range(3)])
m.terminer("b")
print(m.choisir(), m.choisir())
m.retirer("b")
print(m.choisir(), m.actifs)
vide = Tourniquet(["x"])
vide.retirer("x")
try:
    vide.choisir()
except RuntimeError:
    print("RuntimeError")
`,
      expected: "['a', 'b', 'c', 'a']\n['b', 'a', 'b', 'a']\n['a', 'b', 'c']\nb a\nc {'a': 2, 'b': 1, 'c': 2}\nRuntimeError\n",
      hint: "Tourniquet : un indice i modulo le nombre de serveurs ; quand on retire un serveur placé avant i, recule i. Moins de connexions : min(self.serveurs, key=lambda s: self.actifs[s]), qui garde le premier en cas d'égalité."
    }
  },
  {
    id: "sd-03", section: "Briques", title: "Caches : LRU, TTL et invalidation", xp: 120,
    theory: `<p>Un <strong>cache</strong> garde en mémoire rapide (Redis, Memcached, ou la mémoire du processus) le résultat de calculs ou de lectures coûteuses. Lire Redis prend environ une demi-milliseconde, une requête SQL complexe des dizaines. Le schéma le plus courant, <strong>cache-aside</strong> : l'application lit d'abord le cache ; en cas d'absence (<em>miss</em>), elle lit la base, puis remplit le cache.</p>
<ul><li><strong>éviction</strong> : la mémoire est limitée, on retire l'entrée utilisée le moins récemment (LRU) ;</li><li><strong>expiration</strong> (TTL) : chaque entrée vit un temps limité, ce qui borne la durée pendant laquelle une donnée peut être périmée ;</li><li><strong>invalidation</strong> : à chaque écriture en base, supprimer la clé du cache. « Il n'y a que deux choses difficiles en informatique : l'invalidation de cache et nommer les choses. »</li></ul>
<p>Pièges : le <em>thundering herd</em> (une clé populaire expire, mille requêtes frappent la base en même temps), les clés qui ne sont jamais en cache (on met aussi en cache l'absence), et le taux de succès (hit ratio), la métrique qui dit si le cache sert à quelque chose.</p>
~~~py
from functools import lru_cache

@lru_cache(maxsize=128)
def profil(uid):
    print("  lecture en base pour", uid)
    return {"id": uid}

profil(1); profil(1); profil(2)
print(profil.cache_info())
~~~`,
    setup: LAB,
    quiz: [
      { q: "Dans le schéma cache-aside, que faire quand la donnée est modifiée en base ?", options: ["Rien, le TTL suffira toujours", "Supprimer (invalider) la clé du cache, pour que la prochaine lecture recharge la valeur à jour", "Vider tout le cache", "Redémarrer Redis"], answer: 1, explain: "Supprimer plutôt que mettre à jour évite des courses entre deux écritures." },
      { q: "Le taux de succès d'un cache est de 5 %. Que conclure ?", options: ["Tout va bien", "Le cache ne sert presque à rien : clés trop variées, TTL trop court ou cache trop petit", "Il faut plus de serveurs d'application", "La base est trop rapide"], answer: 1, explain: "Un cache utile dépasse en général 80 à 90 % de succès." }
    ],
    challenge: {
      prompt: `<p>Écris une classe @@CacheLRU(capacite, ttl=None)@@ avec une horloge injectée (les méthodes reçoivent l'instant @@t@@ en secondes) : @@lire(cle, t)@@ renvoie la valeur ou @@None@@ (absente ou expirée : une entrée écrite à @@t0@@ expire à partir de @@t0 + ttl@@), @@ecrire(cle, valeur, t)@@ ; une lecture réussie ou une écriture rend la clé la plus récemment utilisée, et quand le cache est plein, une nouvelle clé évince la moins récemment utilisée. Compte @@succes@@ et @@echecs@@ des lectures. Toutes les opérations en O(1) (tu peux utiliser @@collections.OrderedDict@@ et @@move_to_end@@).</p>`,
      starter: PY`class CacheLRU:
    def __init__(self, capacite, ttl=None):
        self.capacite = capacite
        self.ttl = ttl
        self.donnees = {}
        self.succes = self.echecs = 0

    def lire(self, cle, t):
        return self.donnees.get(cle)

    def ecrire(self, cle, valeur, t):
        self.donnees[cle] = valeur
`,
      solution: PY`from collections import OrderedDict


class CacheLRU:
    def __init__(self, capacite, ttl=None):
        self.capacite = capacite
        self.ttl = ttl
        self.donnees = OrderedDict()
        self.succes = self.echecs = 0

    def lire(self, cle, t):
        entree = self.donnees.get(cle)
        if entree is None or (self.ttl is not None and t >= entree[1] + self.ttl):
            if entree is not None:
                del self.donnees[cle]
            self.echecs += 1
            return None
        self.donnees.move_to_end(cle)
        self.succes += 1
        return entree[0]

    def ecrire(self, cle, valeur, t):
        if cle in self.donnees:
            self.donnees.move_to_end(cle)
        self.donnees[cle] = (valeur, t)
        if len(self.donnees) > self.capacite:
            self.donnees.popitem(last=False)
`,
      tests: PY`c = CacheLRU(2)
c.ecrire("a", 1, 0)
c.ecrire("b", 2, 0)
print(c.lire("a", 1))
c.ecrire("c", 3, 2)
print(c.lire("b", 3), c.lire("a", 3), c.lire("c", 3))
print(c.succes, c.echecs, list(c.donnees))
e = CacheLRU(10, ttl=60)
e.ecrire("profil:42", {"nom": "Awa"}, 100)
print(e.lire("profil:42", 159), e.lire("profil:42", 160), len(e.donnees))
grand = CacheLRU(1000)                  # 1 500 clés lues en boucle pour 1 000 places : le pire cas du LRU
for i in range(200_000):
    if grand.lire(i % 1500, i) is None:
        grand.ecrire(i % 1500, i, i)
print(grand.succes, grand.echecs, len(grand.donnees))
`,
      expected: "1\nNone 1 3\n3 1 ['a', 'c']\n{'nom': 'Awa'} None 0\n0 200000 1000\n",
      hint: "Range (valeur, instant d'écriture) dans un OrderedDict. À la lecture : absente ou expirée (t ≥ instant + ttl) → échec ; sinon move_to_end et succès. À l'écriture, popitem(last=False) quand la taille dépasse la capacité."
    }
  },
  {
    id: "sd-04", section: "Briques", title: "Bases de données : réplication et partitionnement", xp: 130,
    theory: `<p>La base est souvent le premier goulot. Les leviers, dans l'ordre où on les sort :</p>
<ul><li><strong>index</strong> et requêtes optimisées (cours SQL) ;</li><li><strong>réplicas de lecture</strong> : une base principale reçoit les écritures, des copies servent les lectures. La réplication est souvent asynchrone : un réplica peut avoir un léger retard (cohérence à terme) ;</li><li><strong>partitionnement</strong> (sharding) : répartir les données sur plusieurs bases selon une clé (l'identifiant de l'utilisateur). Chaque base ne voit qu'une partie de la charge, mais les jointures et les transactions entre partitions deviennent difficiles.</li></ul>
<p><strong>SQL ou NoSQL ?</strong> SQL (PostgreSQL, MySQL) pour les relations, les transactions et les requêtes variées ; NoSQL clé-valeur ou document (DynamoDB, Cassandra, MongoDB) pour des accès simples par clé à très grande échelle. Le théorème <strong>CAP</strong> rappelle qu'en cas de coupure réseau, il faut choisir entre cohérence et disponibilité.</p>
<p>Pour répartir des clés sur N serveurs, @@hash(cle) % N@@ semble naturel, mais passer de N à N + 1 serveurs déplace presque toutes les clés : le cache se vide d'un coup. Le <strong>hachage cohérent</strong> place serveurs et clés sur un anneau ; une clé va au premier serveur rencontré dans le sens des aiguilles d'une montre. Ajouter un serveur ne déplace qu'environ 1/N des clés. Chaque serveur apparaît plusieurs fois sur l'anneau (nœuds virtuels) pour équilibrer la charge.</p>
~~~py
cles = range(10_000)
deplacees = sum(1 for k in cles if k % 4 != k % 5)
print(deplacees / 100, "% des clés changent de serveur en passant de 4 à 5 avec le modulo")
~~~`,
    setup: LAB,
    quiz: [
      { q: "Pourquoi un utilisateur peut-il ne pas voir sa propre modification juste après l'avoir faite ?", options: ["Un bogue du navigateur", "La lecture est servie par un réplica qui n'a pas encore reçu l'écriture (réplication asynchrone)", "Le cache est trop grand", "Le partitionnement"], answer: 1, explain: "Remède courant : lire sur la base principale juste après une écriture (read-your-writes)." },
      { q: "Quel est l'intérêt du hachage cohérent ?", options: ["Chiffrer les clés", "Ajouter ou retirer un serveur ne déplace qu'environ 1/N des clés, au lieu de presque toutes avec un modulo", "Trier les clés", "Accélérer le hachage"], answer: 1, explain: "Utilisé par Cassandra, DynamoDB, les CDN et les caches distribués." }
    ],
    challenge: {
      prompt: `<p>Écris une classe @@Anneau(virtuels=100)@@ de hachage cohérent. La position d'une chaîne est @@int(hashlib.md5(s.encode()).hexdigest(), 16) % 2**32@@ ; le serveur @@nom@@ occupe les positions des chaînes @@f"{nom}#{i}"@@ pour @@i@@ de 0 à @@virtuels − 1@@. Méthodes : @@ajouter(nom)@@, @@retirer(nom)@@, @@serveur(cle)@@ (le premier serveur dont la position est ≥ celle de la clé, en revenant au début de l'anneau si besoin ; @@RuntimeError@@ si l'anneau est vide). Utilise une liste triée et @@bisect@@ : O(log n) par recherche.</p>`,
      starter: PY`import hashlib


class Anneau:
    def __init__(self, virtuels=100):
        self.serveurs = []

    def ajouter(self, nom):
        self.serveurs.append(nom)

    def retirer(self, nom):
        self.serveurs.remove(nom)

    def serveur(self, cle):
        return self.serveurs[hash(cle) % len(self.serveurs)]
`,
      solution: PY`import bisect
import hashlib


def position(s):
    return int(hashlib.md5(s.encode()).hexdigest(), 16) % 2**32


class Anneau:
    def __init__(self, virtuels=100):
        self.virtuels = virtuels
        self.positions = []
        self.proprietaire = {}

    def ajouter(self, nom):
        for i in range(self.virtuels):
            p = position(f"{nom}#{i}")
            if p not in self.proprietaire:
                bisect.insort(self.positions, p)
                self.proprietaire[p] = nom

    def retirer(self, nom):
        self.positions = [p for p in self.positions if self.proprietaire[p] != nom]
        self.proprietaire = {p: n for p, n in self.proprietaire.items() if n != nom}

    def serveur(self, cle):
        if not self.positions:
            raise RuntimeError("anneau vide")
        i = bisect.bisect_left(self.positions, position(cle))
        return self.proprietaire[self.positions[i % len(self.positions)]]
`,
      tests: PY`a = Anneau()
for s in ["cache-1", "cache-2", "cache-3", "cache-4"]:
    a.ajouter(s)
cles = [f"session:{i}" for i in range(20_000)]
avant = {k: a.serveur(k) for k in cles}
charge = {}
for s in avant.values():
    charge[s] = charge.get(s, 0) + 1
print(sorted(charge), min(charge.values()) > 3000)
a.ajouter("cache-5")
deplacees = [k for k in cles if a.serveur(k) != avant[k]]
print(round(100 * len(deplacees) / len(cles)), "% déplacées, toutes vers cache-5 :", all(a.serveur(k) == "cache-5" for k in deplacees))
a.retirer("cache-5")
print(all(a.serveur(k) == avant[k] for k in cles))
vide = Anneau(3)
try:
    vide.serveur("x")
except RuntimeError:
    print("RuntimeError")
`,
      expected: "['cache-1', 'cache-2', 'cache-3', 'cache-4'] True\n20 % déplacées, toutes vers cache-5 : True\nTrue\nRuntimeError\n",
      hint: "Garde une liste triée des positions et un dictionnaire position → serveur. serveur(cle) : bisect_left(positions, position(cle)), puis l'indice modulo la longueur pour faire le tour de l'anneau."
    }
  },
  {
    id: "sd-05", section: "Briques", title: "Files de messages, asynchrone et idempotence", xp: 120,
    theory: `<p>Une <strong>file de messages</strong> (SQS, RabbitMQ) ou un journal d'événements (Kafka) découple celui qui produit un travail de celui qui le traite. L'API répond tout de suite (« commande reçue »), et des workers traitent à leur rythme : envoi d'e-mails, génération de PDF, encodage vidéo. Avantages : absorber les pics, survivre à la panne d'un worker, ajouter des consommateurs pour aller plus vite.</p>
<p>La plupart des systèmes garantissent une livraison <strong>au moins une fois</strong> : un message peut arriver deux fois (le worker a planté après le traitement mais avant l'acquittement). Les consommateurs doivent donc être <strong>idempotents</strong> : traiter deux fois le même message donne le même résultat qu'une fois. On mémorise les identifiants déjà traités, ou on écrit de façon idempotente (« mettre le statut à payé » plutôt que « ajouter 10 € »).</p>
<p>Quand un traitement échoue, on <strong>réessaie avec un délai exponentiel</strong> (1 s, 2 s, 4 s, 8 s…, plafonné), souvent avec une part d'aléatoire (<em>jitter</em>) pour éviter que mille clients réessaient à la même seconde. Après N échecs, le message part dans une file des messages morts (DLQ) pour examen.</p>
~~~py
delais = [min(1 * 2 ** n, 30) for n in range(7)]
print(delais, "secondes")
~~~`,
    setup: LAB,
    quiz: [
      { q: "Pourquoi un consommateur de file doit-il être idempotent ?", options: ["Pour aller plus vite", "La livraison est « au moins une fois » : un même message peut être traité deux fois", "Pour chiffrer les messages", "Ce n'est pas nécessaire avec Kafka"], answer: 1, explain: "Exemple classique : ne pas débiter deux fois une carte bancaire." },
      { q: "À quoi sert le jitter dans les réessais ?", options: ["À décorer les journaux", "À désynchroniser les clients pour éviter qu'ils réessaient tous au même instant et écrasent le service qui redémarre", "À réduire le nombre d'essais", "À chiffrer"], answer: 1, explain: "Sans jitter, les vagues de réessais synchronisées entretiennent la panne." }
    ],
    challenge: {
      prompt: `<p>Écris @@delais(base, facteur, plafond, essais)@@ : la liste des @@essais@@ délais @@min(base × facteur^n, plafond)@@ pour n = 0, 1, 2… Puis une classe @@Consommateur@@ dont la méthode @@traiter(message)@@ reçoit un dictionnaire @@{"id", "compte", "montant"}@@ : elle crédite @@self.soldes[compte]@@ du montant, sauf si un message de même @@id@@ a déjà été traité, et renvoie @@True@@ si le message a été appliqué, @@False@@ si c'était un doublon.</p>`,
      starter: PY`def delais(base, facteur, plafond, essais):
    return [base] * essais


class Consommateur:
    def __init__(self):
        self.soldes = {}

    def traiter(self, message):
        c = message["compte"]
        self.soldes[c] = self.soldes.get(c, 0) + message["montant"]
        return True
`,
      solution: PY`def delais(base, facteur, plafond, essais):
    return [min(base * facteur ** n, plafond) for n in range(essais)]


class Consommateur:
    def __init__(self):
        self.soldes = {}
        self.traites = set()

    def traiter(self, message):
        if message["id"] in self.traites:
            return False
        c = message["compte"]
        self.soldes[c] = self.soldes.get(c, 0) + message["montant"]
        self.traites.add(message["id"])
        return True
`,
      tests: PY`print(delais(1, 2, 30, 7), delais(0.5, 3, 100, 5), delais(1, 2, 30, 0))
c = Consommateur()
flux = [{"id": "m1", "compte": "A", "montant": 50}, {"id": "m2", "compte": "B", "montant": 20},
        {"id": "m1", "compte": "A", "montant": 50}, {"id": "m3", "compte": "A", "montant": -10},
        {"id": "m2", "compte": "B", "montant": 20}]
print([c.traiter(m) for m in flux], c.soldes)
`,
      expected: "[1, 2, 4, 8, 16, 30, 30] [0.5, 1.5, 4.5, 13.5, 40.5] []\n[True, True, False, True, False] {'A': 40, 'B': 20}\n",
      hint: "Une compréhension de liste pour les délais. Pour l'idempotence, un ensemble des identifiants traités, consulté avant d'appliquer le message et complété après."
    }
  },
  {
    id: "sd-06", section: "Briques", title: "Limiter le débit : le seau à jetons", xp: 120,
    theory: `<p>Une API publique doit se protéger : contre les abus, les scripts qui bouclent, et pour partager équitablement la capacité. La <strong>limitation de débit</strong> (rate limiting) refuse les requêtes au-delà d'un quota, avec le code HTTP @@429 Too Many Requests@@ et un en-tête @@Retry-After@@.</p>
<p>L'algorithme le plus utilisé est le <strong>seau à jetons</strong> (token bucket) : un seau de capacité C se remplit de r jetons par seconde ; chaque requête consomme un jeton ; sans jeton, elle est refusée. Il autorise des rafales jusqu'à C, puis un débit moyen r. On ne simule pas le remplissage en continu : à chaque requête, on ajoute @@(t − t_précédent) × r@@ jetons, sans dépasser C.</p>
<p>Alternatives : la <em>fenêtre fixe</em> (100 requêtes par minute calendaire, simple mais laisse passer 200 requêtes autour d'un changement de minute) et la <em>fenêtre glissante</em> (plus juste, plus coûteuse). En production distribuée, l'état du seau vit dans Redis, avec une opération atomique, pour que tous les serveurs appliquent le même quota.</p>
~~~py
capacite, debit = 5, 1.0      # rafale de 5, puis 1 requête par seconde
jetons, dernier = capacite, 0.0
for t in [0, 0, 0, 0, 0, 0, 0.5, 1.2, 3.0]:
    jetons = min(capacite, jetons + (t - dernier) * debit)
    dernier = t
    ok = jetons >= 1
    jetons -= 1 if ok else 0
    print(t, "acceptée" if ok else "refusée (429)")
~~~`,
    setup: LAB,
    quiz: [
      { q: "Quel code HTTP renvoyer quand le quota est dépassé ?", options: ["403", "429 Too Many Requests, avec Retry-After", "500", "503"], answer: 1, explain: "503 signifie que le service lui-même est indisponible." },
      { q: "Pourquoi stocker les seaux dans Redis quand l'API tourne sur 10 serveurs ?", options: ["Pour la persistance", "Sinon chaque serveur applique son propre quota et un client obtient 10 fois sa limite", "Pour aller plus vite", "Ce n'est pas utile"], answer: 1, explain: "Le compteur doit être partagé et mis à jour de façon atomique." }
    ],
    challenge: {
      prompt: `<p>Écris une classe @@Limiteur(capacite, debit)@@ qui gère un seau à jetons <strong>par client</strong> : @@autoriser(client, t)@@ renvoie @@True@@ ou @@False@@ (un nouveau client commence avec un seau plein ; le temps @@t@@ en secondes ne décroît jamais). Puis @@attente(client, t)@@ : le nombre de secondes avant qu'une requête soit acceptée (0 si elle le serait tout de suite), sans consommer de jeton, arrondi à 3 décimales.</p>`,
      starter: PY`class Limiteur:
    def __init__(self, capacite, debit):
        self.capacite = capacite
        self.debit = debit

    def autoriser(self, client, t):
        return True

    def attente(self, client, t):
        return 0
`,
      solution: PY`class Limiteur:
    def __init__(self, capacite, debit):
        self.capacite = capacite
        self.debit = debit
        self.seaux = {}

    def _remplir(self, client, t):
        jetons, dernier = self.seaux.get(client, (self.capacite, t))
        jetons = min(self.capacite, jetons + (t - dernier) * self.debit)
        self.seaux[client] = (jetons, t)
        return jetons

    def autoriser(self, client, t):
        jetons = self._remplir(client, t)
        if jetons >= 1:
            self.seaux[client] = (jetons - 1, t)
            return True
        return False

    def attente(self, client, t):
        jetons = self._remplir(client, t)
        return 0 if jetons >= 1 else round((1 - jetons) / self.debit, 3)
`,
      tests: PY`lim = Limiteur(capacite=3, debit=0.5)
print([lim.autoriser("awa", 0) for _ in range(4)])
print(lim.attente("awa", 0.5), lim.autoriser("awa", 1.9), lim.autoriser("awa", 2.0), lim.attente("awa", 2.0))
print(lim.autoriser("louis", 2.0), lim.autoriser("awa", 100), lim.seaux["awa"][0])
api = Limiteur(capacite=10, debit=5)
acceptees = sum(api.autoriser("bot", i * 0.01) for i in range(1000))
print(acceptees)
`,
      expected: "[True, True, True, False]\n1.5 False True 2.0\nTrue True 2\n59\n",
      hint: "Garde pour chaque client (jetons, dernier instant). À chaque appel : jetons = min(capacite, jetons + (t − dernier) × debit). Autoriser retire un jeton s'il y en a au moins un ; l'attente vaut (1 − jetons) / debit."
    }
  },
  {
    id: "sd-07", section: "Briques", title: "Disponibilité, redondance et reprise", xp: 110,
    theory: `<p>La <strong>disponibilité</strong> se mesure en « neuf » : 99,9 % (trois neuf) autorise 8 h 46 d'arrêt par an, 99,99 % environ 53 minutes. Chaque neuf supplémentaire coûte beaucoup plus cher. On la calcule pour une chaîne de composants :</p>
~~~text
en série (tous nécessaires)        A = A1 × A2 × … × An              la chaîne est plus fragile que chaque maillon
en parallèle (un seul suffit)      A = 1 − (1 − A1) × … × (1 − An)    la redondance multiplie les neuf
~~~
~~~py
web, base = 0.999, 0.999
print("série :", round(web * base, 6))
print("deux web en parallèle, puis la base :", round((1 - (1 - web) ** 2) * base, 6))
~~~
<p>La redondance se décline à chaque niveau : plusieurs instances derrière un répartiteur, plusieurs zones de disponibilité, une base avec réplica de secours et bascule automatique. Pour les sinistres, on fixe deux objectifs : le <strong>RTO</strong> (en combien de temps le service doit revenir) et le <strong>RPO</strong> (combien de données on accepte de perdre, donc la fréquence des sauvegardes ou de la réplication). Et on teste la reprise, sinon elle ne marche pas le jour venu. Le lien avec le cours SRE : les SLO se fixent sur ces chiffres.</p>`,
    setup: LAB,
    quiz: [
      { q: "Trois composants à 99,9 % en série donnent environ :", options: ["99,9 %", "99,7 %", "99,99 %", "97 %"], answer: 1, explain: "0,999³ ≈ 0,997 : environ 26 heures d'arrêt par an." },
      { q: "Une sauvegarde est faite chaque nuit à minuit. Quel est le RPO ?", options: ["0", "Jusqu'à 24 heures de données perdues", "Le temps de restauration", "1 heure"], answer: 1, explain: "Le RTO, lui, est le temps pour remettre le service en route." }
    ],
    challenge: {
      prompt: `<p>Écris @@serie(*dispos)@@, @@parallele(*dispos)@@ et @@arret_annuel(dispo)@@ : la durée d'arrêt sur une année de 365 jours, sous forme de chaîne @@"8 h 46 min"@@ (heures et minutes entières, minutes arrondies au plus proche ; @@"53 min"@@ s'il y a moins d'une heure ; @@"0 min"@@ pour 100 %).</p>`,
      starter: PY`def serie(*dispos):
    return min(dispos)


def parallele(*dispos):
    return max(dispos)


def arret_annuel(dispo):
    return str(round((1 - dispo) * 365 * 24)) + " h"
`,
      solution: PY`def serie(*dispos):
    a = 1.0
    for d in dispos:
        a *= d
    return a


def parallele(*dispos):
    panne = 1.0
    for d in dispos:
        panne *= 1 - d
    return 1 - panne


def arret_annuel(dispo):
    minutes = round((1 - dispo) * 365 * 24 * 60)
    h, m = divmod(minutes, 60)
    return f"{h} h {m} min" if h else f"{m} min"
`,
      tests: PY`print(round(serie(0.999, 0.999, 0.999), 6), round(parallele(0.99, 0.99), 6), round(parallele(0.9, 0.9, 0.9), 6))
archi = serie(parallele(0.999, 0.999), parallele(0.9995, 0.9995), 0.9999)
print(round(archi, 6), arret_annuel(archi))
print(arret_annuel(0.999), arret_annuel(0.9999), arret_annuel(0.99), arret_annuel(1.0))
`,
      expected: "0.997003 0.9999 0.999\n0.999899 53 min\n8 h 46 min 53 min 87 h 36 min 0 min\n",
      hint: "Série : produit des disponibilités. Parallèle : 1 − produit des (1 − d). Arrêt : minutes = round((1 − dispo) × 365 × 24 × 60), puis divmod(minutes, 60)."
    }
  },
  {
    id: "sd-08", section: "Étude de cas", title: "Concevoir un raccourcisseur d'URL", xp: 130,
    theory: `<p>Le grand classique, déroulé selon la méthode :</p>
~~~text
Exigences       créer un lien court ; rediriger ; expiration optionnelle ; 100 M liens créés par mois ;
                100 lectures par écriture ; redirection en moins de 50 ms ; très haute disponibilité en lecture
Estimations     écritures : 100 M / (30 × 86 400) ≈ 40/s ; lectures ≈ 4 000/s (12 000 au pic)
                stockage : 100 M × 12 mois × 5 ans × 500 octets ≈ 3 To
API             POST /api/liens {url} → {code}        GET /{code} → 301 ou 302 vers l'URL
Données         table liens(code PK, url, cree_le, expire_le) ; accès par clé : base clé-valeur ou SQL indexé
Code court      un compteur global (ou des plages de compteurs par serveur) encodé en base 62 :
                62⁷ ≈ 3 500 milliards de codes sur 7 caractères
Architecture    répartiteur → API sans état → cache Redis (liens populaires) → base partitionnée par code
Approfondir     301 (mis en cache par le navigateur, moins de charge) ou 302 (chaque clic passe : statistiques) ;
                codes non devinables si besoin (mélange du compteur) ; liste noire anti-hameçonnage
~~~
<p>Pourquoi un compteur plutôt qu'un hachage tronqué de l'URL ? Le hachage tronqué crée des collisions qu'il faut détecter et résoudre ; un compteur garantit l'unicité. Pour éviter qu'un seul compteur soit un goulot, chaque serveur réserve des plages de 1 000 identifiants à la fois.</p>`,
    setup: LAB,
    quiz: [
      { q: "Redirection 301 ou 302 si l'on veut compter chaque clic ?", options: ["301", "302 : le navigateur ne la met pas en cache, chaque clic repasse par le service", "Aucune différence", "200"], answer: 1, explain: "La 301 allège la charge, la 302 garde la visibilité." },
      { q: "Combien de codes différents sur 6 caractères en base 62 ?", options: ["Environ 57 milliards", "Environ 1 million", "Environ 6 milliards", "Environ 3 500 milliards"], answer: 0, explain: "62⁶ ≈ 5,7 × 10¹⁰ ; sur 7 caractères, environ 3,5 × 10¹²." }
    ],
    challenge: {
      prompt: `<p>Avec l'alphabet @@ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"@@, écris @@encoder(n)@@ (entier ≥ 0 vers base 62, @@"0"@@ pour 0) et @@decoder(code)@@ (l'inverse ; @@ValueError@@ pour un caractère hors alphabet). Puis une classe @@Raccourcisseur@@ : @@raccourcir(url)@@ attribue au nouvel URL le prochain identifiant d'un compteur qui commence à 100 000 (pour des codes d'au moins 4 caractères), mais renvoie le même code si l'URL a déjà été raccourcie ; @@resoudre(code)@@ renvoie l'URL ou @@None@@.</p>`,
      starter: PY`ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"


def encoder(n):
    return str(n)


def decoder(code):
    return int(code)


class Raccourcisseur:
    def __init__(self):
        self.liens = {}

    def raccourcir(self, url):
        code = str(len(self.liens))
        self.liens[code] = url
        return code

    def resoudre(self, code):
        return self.liens.get(code)
`,
      solution: PY`ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
INDEX = {c: i for i, c in enumerate(ALPHABET)}


def encoder(n):
    if n == 0:
        return "0"
    chiffres = []
    while n:
        n, r = divmod(n, 62)
        chiffres.append(ALPHABET[r])
    return "".join(reversed(chiffres))


def decoder(code):
    n = 0
    for c in code:
        if c not in INDEX:
            raise ValueError("caractère invalide : " + c)
        n = n * 62 + INDEX[c]
    return n


class Raccourcisseur:
    def __init__(self):
        self.compteur = 100_000
        self.par_code = {}
        self.par_url = {}

    def raccourcir(self, url):
        if url in self.par_url:
            return self.par_url[url]
        code = encoder(self.compteur)
        self.compteur += 1
        self.par_code[code] = url
        self.par_url[url] = code
        return code

    def resoudre(self, code):
        return self.par_code.get(code)
`,
      tests: PY`print([encoder(n) for n in (0, 9, 10, 61, 62, 3843, 100_000, 62**7 - 1)])
print([decoder(c) for c in ("0", "z", "10", "ZZZZZZZ")], all(decoder(encoder(n)) == n for n in range(0, 10**6, 997)))
try:
    decoder("ab-c")
except ValueError:
    print("ValueError")
r = Raccourcisseur()
a = r.raccourcir("https://patheba10.github.io/boucle/#embarque")
b = r.raccourcir("https://example.com/un/long/chemin?avec=parametres")
print(a, b, r.raccourcir("https://patheba10.github.io/boucle/#embarque") == a)
print(r.resoudre(b), r.resoudre("inconnu"))
`,
      expected: "['0', '9', 'a', 'Z', '10', 'ZZ', 'q0U', 'ZZZZZZZ']\n[0, 35, 62, 3521614606207] True\nValueError\nq0U q0V True\nhttps://example.com/un/long/chemin?avec=parametres None\n",
      hint: "Encoder : divmod(n, 62) répété, les restes donnent les chiffres de droite à gauche. Décoder : n = n × 62 + indice du caractère. Deux dictionnaires (code → URL et URL → code) pour retrouver un lien déjà raccourci."
    }
  },
  {
    id: "sd-09", section: "Étude de cas", title: "Questions d'entretien : system design", xp: 60, theoryOnly: true,
    theory: `<p>Les sujets les plus fréquents, avec les points que l'on attend de toi. Entraîne-toi à en dérouler un en 40 minutes, au tableau, en suivant la méthode.</p>
<div class="qa">
<details><summary>Concevoir un fil d'actualité (type réseau social).</summary><p>Lecture bien plus fréquente que l'écriture. Deux stratégies : construire le fil à la lecture (fan-out on read) ou pousser chaque publication dans les fils des abonnés à l'écriture (fan-out on write), avec un traitement à part pour les comptes à millions d'abonnés. Cache des fils récents, pagination par curseur.</p></details>
<details><summary>Concevoir une messagerie instantanée.</summary><p>Connexions persistantes (WebSocket), un service de présence, stockage des messages partitionné par conversation, accusés de réception, file pour les utilisateurs hors ligne et notifications push. Ordre des messages par conversation (horodatage serveur ou numéro de séquence).</p></details>
<details><summary>Concevoir un limiteur de débit distribué.</summary><p>Seau à jetons par client stocké dans Redis, mise à jour atomique (script Lua), clés avec expiration, réponse 429 avec Retry-After ; tolérer la panne de Redis (laisser passer ou refuser, selon le risque).</p></details>
<details><summary>Concevoir le stockage de métriques d'une flotte de serveurs.</summary><p>Écritures massives et séquentielles : base de séries temporelles (Prometheus, TimescaleDB), agrégation et sous-échantillonnage des données anciennes, rétention par paliers. Le lien avec le cours SRE : alertes sur des SLO, pas sur des seuils bruts.</p></details>
<details><summary>Cohérence forte ou à terme ?</summary><p>Forte quand une incohérence coûte cher (solde bancaire, stock d'un billet unique) ; à terme quand un léger retard est acceptable (compteur de « j'aime », fil d'actualité) et que la disponibilité et la latence comptent plus.</p></details>
<details><summary>Le système est lent. Comment l'analyses-tu ?</summary><p>Mesurer avant d'agir : latences par composant (traces), saturation (CPU, connexions, files), requêtes lentes en base. Puis le levier adapté : index, cache, réplicas, traitement asynchrone, partitionnement.</p></details>
</div>`,
    practice: { title: "S'entraîner", body: `<p>Choisis deux sujets ci-dessus et déroule-les en entier, chronomètre en main, sur papier : exigences, estimations chiffrées, API, données, schéma, puis deux approfondissements. Ensuite, compare ton schéma avec un service AWS réel (ELB, ElastiCache, RDS avec réplicas, SQS) et note ce que tu changerais.</p>` },
    quiz: [
      { q: "Un service est lu 1 000 fois plus souvent qu'il n'est écrit. Premier levier ?", options: ["Partitionner tout de suite", "Un cache devant la base et des réplicas de lecture", "Changer de langage", "Plus de CPU sur la base principale"], answer: 1, explain: "Les lectures se multiplient facilement ; les écritures, beaucoup moins." },
      { q: "Qu'attend-on à la fin d'un entretien de system design ?", options: ["Un schéma parfait", "Les compromis assumés, les limites du design et ce qu'on ferait ensuite à plus grande échelle", "Le code complet", "Le coût exact en dollars"], answer: 1, explain: "Savoir dire ce qu'on a sacrifié montre la maturité." }
    ]
  }
];
