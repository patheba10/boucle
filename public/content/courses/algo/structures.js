/* Cours Algorithmique — chapitre 1 : complexité et structures de données, implémentées à la main en Python pur
   (tout tourne hors ligne). Les tests de performance utilisent des entrées assez grandes pour qu'une solution
   quadratique dépasse le temps alloué. */
const PY = String.raw;

export const LAB = `<p><strong>Sur ta machine</strong> : refais chaque défi dans un fichier Python avec @@pytest@@, puis entraîne-toi sur des problèmes du même type (LeetCode, NeetCode, Codewars). En entretien, explique toujours ton raisonnement à voix haute : l'idée, la complexité en temps et en mémoire, puis les cas limites, avant de coder.</p>`;

export default [
  {
    id: "al-01", section: "Structures de données", title: "Complexité : la notation O", xp: 90,
    theory: `<p>La <strong>complexité</strong> décrit comment le temps (ou la mémoire) d'un algorithme grandit avec la taille @@n@@ de l'entrée, en ignorant les constantes. C'est la première question d'un entretien après « est-ce que ça marche ? » :</p>
~~~text
O(1)         accès à un élément de liste par indice, ajout dans un dict
O(log n)     recherche binaire, opération sur un tas ou un arbre équilibré
O(n)         parcourir une liste une fois
O(n log n)   trier (sorted, tri fusion)
O(n²)        deux boucles imbriquées sur la même liste
O(2ⁿ)        essayer tous les sous-ensembles
~~~
<p>Ordres de grandeur à retenir : un ordinateur fait environ 10⁷ à 10⁸ opérations Python simples par seconde. Pour n = 100 000, O(n log n) prend quelques dixièmes de seconde, O(n²) des minutes. Les coûts cachés comptent : @@x in liste@@ est O(n), @@x in ensemble@@ est O(1) en moyenne ; @@liste.pop(0)@@ est O(n), @@deque.popleft()@@ est O(1).</p>
~~~py
import time

n = 20_000
donnees = list(range(n))
ensemble = set(donnees)

t = time.perf_counter()
trouves = sum(1 for x in range(0, n, 100) if x in donnees)     # O(n) par recherche
t_liste = time.perf_counter() - t
t = time.perf_counter()
trouves = sum(1 for x in range(0, n, 100) if x in ensemble)    # O(1) par recherche
t_ens = time.perf_counter() - t
print(trouves, "trouvés ; la liste est", "plus lente" if t_liste > t_ens else "aussi rapide", "que l'ensemble")
~~~
<p>On parle du <strong>pire cas</strong> par défaut, parfois du cas moyen (les tables de hachage) ou du coût <strong>amorti</strong> (l'ajout en fin de liste : parfois cher, en moyenne O(1)).</p>`,
    setup: LAB,
    quiz: [
      { q: "Quelle est la complexité de deux boucles imbriquées, la seconde allant de i à n ?", options: ["O(n)", "O(n log n)", "O(n²)", "O(2ⁿ)"], answer: 2, explain: "n + (n − 1) + … + 1 = n(n + 1) / 2, soit O(n²) : on ignore la constante 1/2." },
      { q: "Pourquoi « if x in ma_liste » dans une boucle sur n éléments peut-il être lent ?", options: ["Ce n'est jamais lent", "Chaque test parcourt la liste : O(n) par test, donc O(n²) au total ; un set ramène le test à O(1)", "Parce que in est une fonction", "À cause du ramasse-miettes"], answer: 1, explain: "C'est l'optimisation la plus fréquente en entretien." }
    ],
    challenge: {
      prompt: `<p>Écris @@premier_doublon(seq)@@ qui renvoie le premier élément qui apparaît pour la deuxième fois en parcourant @@seq@@ de gauche à droite, ou @@None@@ s'il n'y en a pas. La solution doit être en <strong>O(n)</strong> : le dernier test porte sur 200 000 éléments.</p>`,
      starter: PY`def premier_doublon(seq):
    return None
`,
      solution: PY`def premier_doublon(seq):
    vus = set()
    for x in seq:
        if x in vus:
            return x
        vus.add(x)
    return None
`,
      tests: PY`print(premier_doublon([3, 1, 4, 1, 5, 9, 2, 6, 5]))
print(premier_doublon("algorithmique"))
print(premier_doublon([1, 2, 3]), premier_doublon([]))
grand = list(range(200_000)) + [199_999]
print(premier_doublon(grand))
`,
      expected: "1\ni\nNone None\n199999\n",
      hint: "Un ensemble des éléments déjà vus : pour chaque x, s'il est dans l'ensemble, c'est le doublon ; sinon ajoute-le."
    }
  },
  {
    id: "al-02", section: "Structures de données", title: "Tableaux dynamiques et coût amorti", xp: 100,
    theory: `<p>Une liste Python est un <strong>tableau dynamique</strong> : une zone mémoire contiguë, plus grande que le nombre d'éléments. L'accès par indice est O(1) : l'adresse se calcule. Quand la zone est pleine, @@append@@ alloue une zone plus grande (environ 1,125 fois en CPython, 2 fois dans beaucoup d'autres langages) et recopie tout : cette opération est O(n), mais elle est rare.</p>
<p>Avec un doublement, après n ajouts on a recopié 1 + 2 + 4 + … + n/2 < n éléments : le coût total est O(n), donc O(1) <strong>amorti</strong> par ajout. Insérer ou retirer au début ou au milieu reste O(n), car il faut décaler tout ce qui suit.</p>
~~~py
import sys

l = []
tailles = set()
for i in range(64):
    l.append(i)
    tailles.add(sys.getsizeof(l))
print(len(tailles), "réallocations pour 64 ajouts")
~~~
<p>En entretien, on cite ce raisonnement pour justifier qu'un algorithme qui fait n @@append@@ reste O(n).</p>`,
    setup: LAB,
    quiz: [
      { q: "Quelle opération est O(n) sur une liste Python ?", options: ["liste[i]", "liste.append(x)", "liste.insert(0, x)", "len(liste)"], answer: 2, explain: "Insérer au début décale tous les éléments." },
      { q: "Que signifie « O(1) amorti » pour append ?", options: ["Toujours instantané", "Parfois cher (réallocation), mais le coût total de n ajouts est O(n)", "O(1) en moyenne sur des données aléatoires", "O(log n)"], answer: 1, explain: "Le coût des recopies est réparti sur tous les ajouts." }
    ],
    challenge: {
      prompt: `<p>Écris une classe @@TableauDynamique@@ avec @@capacite@@ (1 au départ), @@taille@@, @@copies@@ (le nombre total d'éléments recopiés lors des agrandissements) et un tableau interne de longueur @@capacite@@. Méthodes : @@ajouter(x)@@ (double la capacité quand c'est plein, en recopiant les éléments un par un), @@obtenir(i)@@ (lève @@IndexError@@ hors de @@[0, taille)@@) et @@retirer_fin()@@ (renvoie le dernier élément ; @@IndexError@@ si vide).</p>`,
      starter: PY`class TableauDynamique:
    def __init__(self):
        self.capacite = 1
        self.taille = 0
        self.copies = 0
        self._cases = [None]

    def ajouter(self, x):
        self._cases.append(x)
        self.taille += 1

    def obtenir(self, i):
        return self._cases[i]

    def retirer_fin(self):
        return self._cases.pop()
`,
      solution: PY`class TableauDynamique:
    def __init__(self):
        self.capacite = 1
        self.taille = 0
        self.copies = 0
        self._cases = [None]

    def ajouter(self, x):
        if self.taille == self.capacite:
            nouvelles = [None] * (2 * self.capacite)
            for i in range(self.taille):
                nouvelles[i] = self._cases[i]
                self.copies += 1
            self._cases = nouvelles
            self.capacite *= 2
        self._cases[self.taille] = x
        self.taille += 1

    def obtenir(self, i):
        if not 0 <= i < self.taille:
            raise IndexError("indice hors du tableau")
        return self._cases[i]

    def retirer_fin(self):
        if self.taille == 0:
            raise IndexError("tableau vide")
        self.taille -= 1
        x = self._cases[self.taille]
        self._cases[self.taille] = None
        return x
`,
      tests: PY`t = TableauDynamique()
for i in range(10):
    t.ajouter(i * i)
print(t.taille, t.capacite, t.copies, t.obtenir(9))
print(t.retirer_fin(), t.taille)
for essai in (lambda: t.obtenir(9), lambda: t.obtenir(-1)):
    try:
        essai()
    except IndexError:
        print("IndexError")
grand = TableauDynamique()
for i in range(100_000):
    grand.ajouter(i)
print(grand.capacite, grand.copies, grand.copies < 2 * grand.taille)
vide = TableauDynamique()
try:
    vide.retirer_fin()
except IndexError:
    print("vide : IndexError")
`,
      expected: "10 16 15 81\n81 9\nIndexError\nIndexError\n131072 131071 True\nvide : IndexError\n",
      hint: "Quand taille == capacite, crée une liste [None] × (2 × capacite), recopie les taille éléments en comptant les copies, puis double capacite. obtenir vérifie 0 ≤ i < taille."
    }
  },
  {
    id: "al-03", section: "Structures de données", title: "Tables de hachage", xp: 120,
    theory: `<p>Le @@dict@@ et le @@set@@ de Python sont des <strong>tables de hachage</strong> : une fonction de hachage transforme la clé en entier, et cet entier modulo la taille du tableau donne la case où ranger la valeur. Recherche, ajout et suppression sont O(1) en moyenne.</p>
<p>Deux clés peuvent tomber dans la même case : c'est une <strong>collision</strong>. Deux stratégies : le <em>chaînage</em> (chaque case contient une petite liste de paires) ou l'<em>adressage ouvert</em> (on cherche la case libre suivante, ce que fait CPython). Pour garder des listes courtes, on agrandit le tableau quand le <strong>facteur de charge</strong> (éléments / cases) dépasse un seuil, en <em>rehachant</em> tout : O(n), mais rare, donc O(1) amorti.</p>
~~~py
cases = 8
for cle in ["rouge", "vert", "bleu", 42, (1, 2)]:
    print(repr(cle), "→ case", hash(cle) % cases if isinstance(cle, int) else "selon hash()")
print("une liste n'est pas hachable :", end=" ")
try:
    hash([1, 2])
except TypeError as e:
    print(e)
~~~
<p>Seuls les objets immuables sont hachables : une clé qui changerait de valeur changerait de case. Dans le pire cas (toutes les clés dans la même case), les opérations deviennent O(n) : c'est la base des attaques par collisions contre les serveurs web, d'où le hachage aléatoire des chaînes en Python.</p>`,
    setup: LAB,
    quiz: [
      { q: "Pourquoi un tuple peut-il être une clé de dict, mais pas une liste ?", options: ["Les tuples sont plus petits", "Un tuple est immuable : son hachage ne change pas, alors qu'une liste modifiée changerait de case", "Par convention", "Les listes ne sont pas comparables"], answer: 1, explain: "Hachable implique immuable (pour ce qui sert au hachage)." },
      { q: "Quelle est la complexité dans le pire cas d'une recherche dans une table de hachage ?", options: ["O(1)", "O(log n)", "O(n)", "O(n²)"], answer: 2, explain: "Si toutes les clés entrent en collision, on parcourt une seule longue chaîne." }
    ],
    challenge: {
      prompt: `<p>Écris une classe @@TableHachage@@ à chaînage : @@cases@@ (8 au départ), une liste de @@cases@@ listes de paires @@[cle, valeur]@@, et @@taille@@. Méthodes : @@mettre(cle, valeur)@@ (remplace la valeur si la clé existe), @@obtenir(cle)@@ (@@KeyError@@ si absente), @@retirer(cle)@@ (@@KeyError@@ si absente). La case d'une clé est @@hash(cle) % self.cases@@. Après un ajout, si @@taille / cases > 0.75@@, double le nombre de cases et rehache toutes les paires.</p>`,
      starter: PY`class TableHachage:
    def __init__(self):
        self.cases = 8
        self.taille = 0
        self._seaux = [[] for _ in range(self.cases)]

    def mettre(self, cle, valeur):
        self._seaux[0].append([cle, valeur])
        self.taille += 1

    def obtenir(self, cle):
        for k, v in self._seaux[0]:
            if k == cle:
                return v

    def retirer(self, cle):
        pass
`,
      solution: PY`class TableHachage:
    def __init__(self):
        self.cases = 8
        self.taille = 0
        self._seaux = [[] for _ in range(self.cases)]

    def _seau(self, cle):
        return self._seaux[hash(cle) % self.cases]

    def mettre(self, cle, valeur):
        seau = self._seau(cle)
        for paire in seau:
            if paire[0] == cle:
                paire[1] = valeur
                return
        seau.append([cle, valeur])
        self.taille += 1
        if self.taille / self.cases > 0.75:
            anciennes = [p for s in self._seaux for p in s]
            self.cases *= 2
            self._seaux = [[] for _ in range(self.cases)]
            for k, v in anciennes:
                self._seau(k).append([k, v])

    def obtenir(self, cle):
        for k, v in self._seau(cle):
            if k == cle:
                return v
        raise KeyError(cle)

    def retirer(self, cle):
        seau = self._seau(cle)
        for i, (k, _) in enumerate(seau):
            if k == cle:
                del seau[i]
                self.taille -= 1
                return
        raise KeyError(cle)
`,
      tests: PY`t = TableHachage()
for i, mot in enumerate(["un", "deux", "trois", "quatre", "cinq", "six"]):
    t.mettre(mot, i + 1)
print(t.taille, t.cases, t.obtenir("quatre"))
t.mettre("deux", 22)
print(t.taille, t.obtenir("deux"))
t.mettre(7, "sept")
print(t.cases, t.obtenir(7))
t.retirer("un")
for essai in (lambda: t.obtenir("un"), lambda: t.retirer("zéro")):
    try:
        essai()
    except KeyError:
        print("KeyError")
grande = TableHachage()
for i in range(50_000):
    grande.mettre(i, i * 2)
print(grande.taille, grande.cases, grande.obtenir(49_999), max(len(s) for s in grande._seaux))
`,
      expected: "6 8 4\n6 22\n16 sept\nKeyError\nKeyError\n50000 131072 99998 1\n",
      hint: "Une méthode _seau(cle) renvoie self._seaux[hash(cle) % self.cases]. Dans mettre, cherche d'abord la clé dans son seau ; sinon ajoute la paire, puis rehache si taille / cases > 0.75."
    }
  },
  {
    id: "al-04", section: "Structures de données", title: "Piles et files", xp: 100,
    theory: `<p>Une <strong>pile</strong> (LIFO, dernier entré premier sorti) s'utilise avec @@append@@ et @@pop@@ sur une liste, en O(1). Elle sert à tout ce qui s'imbrique : parenthèses, appels de fonctions (la pile d'appels), annuler une action, parcours en profondeur.</p>
<p>Une <strong>file</strong> (FIFO, premier entré premier sorti) se fait avec @@collections.deque@@ : @@append@@ et @@popleft@@ en O(1). Jamais @@liste.pop(0)@@, qui est O(n). Elle sert aux traitements dans l'ordre d'arrivée et au parcours en largeur.</p>
~~~py
from collections import deque

pile = []
for c in "abc":
    pile.append(c)
print("pile :", pile.pop(), pile.pop())

file = deque()
for c in "abc":
    file.append(c)
print("file :", file.popleft(), file.popleft())
~~~
<p>Question d'entretien classique : réaliser une file avec deux piles. On empile à l'entrée ; pour sortir, si la pile de sortie est vide, on y renverse toute la pile d'entrée, ce qui inverse l'ordre. Chaque élément est déplacé une seule fois : O(1) amorti par opération.</p>`,
    setup: LAB,
    quiz: [
      { q: "Pour vérifier qu'une expression est bien parenthésée, quelle structure ?", options: ["Une file", "Une pile", "Un tas", "Un dictionnaire seul"], answer: 1, explain: "Chaque fermante doit correspondre à la dernière ouvrante encore ouverte." },
      { q: "Pourquoi deque plutôt qu'une liste pour une file ?", options: ["Une liste ne peut pas contenir de chaînes", "liste.pop(0) est O(n), deque.popleft() est O(1)", "deque trie automatiquement", "Pour économiser la mémoire seulement"], answer: 1, explain: "Retirer au début d'une liste décale tous les éléments." }
    ],
    challenge: {
      prompt: `<p>Écris @@bien_parenthese(s)@@ : vrai si les @@()@@, @@[]@@ et @@{}@@ de la chaîne sont correctement appariés et imbriqués (les autres caractères sont ignorés). Puis une classe @@FileDeuxPiles@@ avec @@enfiler(x)@@, @@defiler()@@ (@@IndexError@@ si vide) et @@__len__@@, réalisée uniquement avec deux listes utilisées comme piles.</p>`,
      starter: PY`def bien_parenthese(s):
    return s.count("(") == s.count(")")


class FileDeuxPiles:
    def __init__(self):
        self.entree = []
        self.sortie = []

    def enfiler(self, x):
        self.entree.append(x)

    def defiler(self):
        return self.entree.pop()

    def __len__(self):
        return len(self.entree)
`,
      solution: PY`PAIRES = {")": "(", "]": "[", "}": "{"}


def bien_parenthese(s):
    pile = []
    for c in s:
        if c in "([{":
            pile.append(c)
        elif c in PAIRES:
            if not pile or pile.pop() != PAIRES[c]:
                return False
    return not pile


class FileDeuxPiles:
    def __init__(self):
        self.entree = []
        self.sortie = []

    def enfiler(self, x):
        self.entree.append(x)

    def defiler(self):
        if not self.sortie:
            while self.entree:
                self.sortie.append(self.entree.pop())
        if not self.sortie:
            raise IndexError("file vide")
        return self.sortie.pop()

    def __len__(self):
        return len(self.entree) + len(self.sortie)
`,
      tests: PY`for s in ["f(a[i]) + {x: (1, 2)}", "(]", "((", "", ")(", "{[()()]}"]:
    print(repr(s), bien_parenthese(s))
f = FileDeuxPiles()
for x in range(5):
    f.enfiler(x)
print(f.defiler(), f.defiler(), len(f))
f.enfiler(5)
print([f.defiler() for _ in range(len(f))])
try:
    f.defiler()
except IndexError:
    print("IndexError")
g = FileDeuxPiles()
for i in range(100_000):
    g.enfiler(i)
    if i % 2:
        g.defiler()
print(len(g), g.defiler())
`,
      expected: "'f(a[i]) + {x: (1, 2)}' True\n'(]' False\n'((' False\n'' True\n')(' False\n'{[()()]}' True\n0 1 3\n[2, 3, 4, 5]\nIndexError\n50000 50000\n",
      hint: "Parenthèses : empile les ouvrantes ; pour une fermante, la pile ne doit pas être vide et son sommet doit être l'ouvrante correspondante ; à la fin, la pile doit être vide. File : ne renverse entree dans sortie que si sortie est vide."
    }
  },
  {
    id: "al-05", section: "Structures de données", title: "Listes chaînées", xp: 110,
    theory: `<p>Une <strong>liste chaînée</strong> est une suite de nœuds, chacun contenant une valeur et une référence vers le suivant. Ajouter ou retirer en tête est O(1), sans rien décaler ; en revanche, accéder au i-ème élément est O(n). On la croise peu en Python (la liste suffit), mais énormément en entretien, et partout en C embarqué (listes de tâches d'un RTOS, tampons).</p>
~~~py
class Noeud:
    def __init__(self, valeur, suivant=None):
        self.valeur, self.suivant = valeur, suivant

tete = Noeud(1, Noeud(2, Noeud(3)))
n = tete
while n:
    print(n.valeur, end=" → " if n.suivant else "\\n")
    n = n.suivant
~~~
<p>Trois techniques reviennent sans cesse :</p>
<ul><li><strong>inverser</strong> en place avec trois références (@@precedent@@, @@courant@@, @@suivant@@) ;</li><li>les <strong>deux pointeurs</strong> lent et rapide (algorithme de Floyd) : le rapide avance de deux nœuds, le lent d'un seul. S'il y a un cycle, ils finissent par se rencontrer ; sinon, le rapide atteint la fin. Le même procédé trouve le milieu d'une liste en un passage ;</li><li>un <strong>nœud sentinelle</strong> en tête pour éviter les cas particuliers de la liste vide.</li></ul>`,
    setup: LAB,
    quiz: [
      { q: "Quelle est la complexité pour accéder au 1000e élément d'une liste chaînée ?", options: ["O(1)", "O(log n)", "O(n)", "O(n²)"], answer: 2, explain: "Il faut suivre les liens un par un depuis la tête." },
      { q: "Comment détecter un cycle en mémoire constante ?", options: ["Avec un ensemble des nœuds vus", "Avec deux pointeurs, l'un avançant deux fois plus vite : ils se rencontrent s'il y a un cycle", "En comptant jusqu'à 1 000", "C'est impossible"], answer: 1, explain: "L'ensemble marche aussi, mais coûte O(n) en mémoire." }
    ],
    challenge: {
      prompt: `<p>La classe @@Noeud@@ est fournie. Écris @@inverser(tete)@@ (inverse la liste en place et renvoie la nouvelle tête), @@milieu(tete)@@ (la valeur du nœud du milieu, le second des deux milieux pour une longueur paire ; @@None@@ si vide) et @@a_un_cycle(tete)@@ en mémoire constante.</p>`,
      starter: PY`class Noeud:
    def __init__(self, valeur, suivant=None):
        self.valeur, self.suivant = valeur, suivant


def inverser(tete):
    return tete


def milieu(tete):
    return tete.valeur if tete else None


def a_un_cycle(tete):
    return False
`,
      solution: PY`class Noeud:
    def __init__(self, valeur, suivant=None):
        self.valeur, self.suivant = valeur, suivant


def inverser(tete):
    precedent, courant = None, tete
    while courant:
        suivant = courant.suivant
        courant.suivant = precedent
        precedent, courant = courant, suivant
    return precedent


def milieu(tete):
    lent = rapide = tete
    while rapide and rapide.suivant:
        lent, rapide = lent.suivant, rapide.suivant.suivant
    return lent.valeur if lent else None


def a_un_cycle(tete):
    lent = rapide = tete
    while rapide and rapide.suivant:
        lent, rapide = lent.suivant, rapide.suivant.suivant
        if lent is rapide:
            return True
    return False
`,
      tests: PY`def construire(valeurs):
    tete = None
    for v in reversed(valeurs):
        tete = Noeud(v, tete)
    return tete


def valeurs(tete):
    out = []
    while tete:
        out.append(tete.valeur)
        tete = tete.suivant
    return out


print(valeurs(inverser(construire([1, 2, 3, 4, 5]))), valeurs(inverser(None)), valeurs(inverser(construire([7]))))
print(milieu(construire([1, 2, 3, 4, 5])), milieu(construire([1, 2, 3, 4])), milieu(None))
boucle = construire([1, 2, 3, 4, 5, 6])
fin = boucle
while fin.suivant:
    fin = fin.suivant
fin.suivant = boucle.suivant.suivant
print(a_un_cycle(boucle), a_un_cycle(construire([1, 2, 3])), a_un_cycle(None))
longue = construire(list(range(100_000)))
print(milieu(longue), valeurs(inverser(longue))[:3])
`,
      expected: "[5, 4, 3, 2, 1] [] [7]\n3 3 None\nTrue False False\n50000 [99999, 99998, 99997]\n",
      hint: "Inverser : precedent = None ; à chaque pas, garde courant.suivant, fais pointer courant vers precedent, puis avance les deux. Milieu et cycle : lent avance d'un, rapide de deux, tant que rapide et rapide.suivant existent."
    }
  },
  {
    id: "al-06", section: "Structures de données", title: "Arbres binaires de recherche", xp: 120,
    theory: `<p>Un <strong>arbre binaire</strong> : chaque nœud a au plus deux enfants. Dans un <strong>arbre binaire de recherche</strong> (ABR), tout ce qui est à gauche d'un nœud est plus petit que lui, tout ce qui est à droite plus grand. Recherche, insertion et suppression suivent un seul chemin depuis la racine : O(h), où h est la hauteur.</p>
~~~text
            8               parcours infixe (gauche, nœud, droite) : 1 3 6 8 10 14
          /   \             → les valeurs sortent triées
         3     10
        / \      \          hauteur 3 ; avec les mêmes valeurs insérées dans l'ordre
       1   6      14        croissant, l'arbre dégénère en liste : hauteur 6
~~~
<p>Si l'arbre est équilibré, h = O(log n) ; s'il dégénère, h = n. Les arbres auto-équilibrés (AVL, rouge-noir, B-arbres des bases de données) garantissent O(log n). Les parcours se codent naturellement en récursif : <strong>préfixe</strong> (nœud d'abord), <strong>infixe</strong> (trié pour un ABR), <strong>suffixe</strong> (enfants d'abord, pour libérer ou évaluer).</p>
~~~py
def hauteur(arbre):
    """arbre : None ou un tuple (gauche, valeur, droite)"""
    if arbre is None:
        return 0
    gauche, _, droite = arbre
    return 1 + max(hauteur(gauche), hauteur(droite))

arbre = ((None, 1, None), 3, ((None, 6, None)))
print(hauteur(arbre), hauteur(None))
~~~`,
    setup: LAB,
    quiz: [
      { q: "Quel parcours d'un ABR donne les valeurs triées ?", options: ["Préfixe", "Infixe", "Suffixe", "En largeur"], answer: 1, explain: "Gauche (plus petits), nœud, droite (plus grands)." },
      { q: "On insère 1, 2, 3, …, 1000 dans un ABR simple. Coût d'une recherche ?", options: ["O(1)", "O(log n)", "O(n) : l'arbre a dégénéré en liste", "O(n log n)"], answer: 2, explain: "D'où les arbres auto-équilibrés." }
    ],
    challenge: {
      prompt: `<p>Écris une classe @@ABR@@ (arbre vide au départ) avec : @@inserer(v)@@ (ignore les doublons), @@contient(v)@@, @@infixe()@@ (liste des valeurs dans l'ordre), @@hauteur()@@ (0 pour l'arbre vide) et @@min()@@ (@@ValueError@@ si vide). Les méthodes d'insertion et de recherche doivent être <strong>itératives</strong> (le dernier test insère 3 000 valeurs croissantes : une récursion dépasserait la pile de Python).</p>`,
      starter: PY`class ABR:
    def __init__(self):
        self.valeurs = []

    def inserer(self, v):
        self.valeurs.append(v)

    def contient(self, v):
        return v in self.valeurs

    def infixe(self):
        return self.valeurs

    def hauteur(self):
        return len(self.valeurs)

    def min(self):
        return self.valeurs[0]
`,
      solution: PY`class _Noeud:
    __slots__ = ("v", "g", "d")

    def __init__(self, v):
        self.v, self.g, self.d = v, None, None


class ABR:
    def __init__(self):
        self.racine = None

    def inserer(self, v):
        if self.racine is None:
            self.racine = _Noeud(v)
            return
        n = self.racine
        while True:
            if v == n.v:
                return
            cote = "g" if v < n.v else "d"
            enfant = getattr(n, cote)
            if enfant is None:
                setattr(n, cote, _Noeud(v))
                return
            n = enfant

    def contient(self, v):
        n = self.racine
        while n:
            if v == n.v:
                return True
            n = n.g if v < n.v else n.d
        return False

    def infixe(self):
        out, pile, n = [], [], self.racine
        while pile or n:
            while n:
                pile.append(n)
                n = n.g
            n = pile.pop()
            out.append(n.v)
            n = n.d
        return out

    def hauteur(self):
        h, niveau = 0, [self.racine] if self.racine else []
        while niveau:
            h += 1
            niveau = [e for n in niveau for e in (n.g, n.d) if e]
        return h

    def min(self):
        if self.racine is None:
            raise ValueError("arbre vide")
        n = self.racine
        while n.g:
            n = n.g
        return n.v
`,
      tests: PY`a = ABR()
for v in [8, 3, 10, 1, 6, 14, 4, 7, 13, 6]:
    a.inserer(v)
print(a.infixe())
print(a.contient(7), a.contient(5), a.hauteur(), a.min())
vide = ABR()
print(vide.infixe(), vide.hauteur(), vide.contient(1))
try:
    vide.min()
except ValueError:
    print("ValueError")
degenere = ABR()
for v in range(3000):
    degenere.inserer(v)
print(degenere.hauteur(), degenere.contient(2999), degenere.infixe()[-1])
`,
      expected: "[1, 3, 4, 6, 7, 8, 10, 13, 14]\nTrue False 4 1\n[] 0 False\nValueError\n3000 True 2999\n",
      hint: "Insertion : descends à gauche si v < n.v, à droite sinon, jusqu'à un emplacement vide. Infixe itératif : une pile ; descends à gauche en empilant, dépile, note la valeur, puis passe à droite. Hauteur : compte les niveaux d'un parcours en largeur."
    }
  },
  {
    id: "al-07", section: "Structures de données", title: "Tas et files de priorité", xp: 120,
    theory: `<p>Un <strong>tas</strong> (heap) binaire est un arbre presque complet rangé dans une liste : les enfants de la case @@i@@ sont aux cases @@2i + 1@@ et @@2i + 2@@, son parent à @@(i − 1) // 2@@. Dans un <strong>tas min</strong>, chaque parent est inférieur ou égal à ses enfants : le minimum est toujours en case 0.</p>
<ul><li><strong>ajouter</strong> : placer à la fin, puis faire <em>remonter</em> l'élément tant qu'il est plus petit que son parent : O(log n) ;</li><li><strong>retirer le minimum</strong> : remplacer la racine par le dernier élément, puis le faire <em>descendre</em> en l'échangeant avec le plus petit de ses enfants : O(log n).</li></ul>
<p>C'est la structure des <strong>files de priorité</strong> : ordonnanceurs, algorithme de Dijkstra, fusion de k listes triées, et le classique « les k plus grands éléments » : un tas min de taille k qu'on parcourt une fois, O(n log k). En Python : le module @@heapq@@.</p>
~~~py
import heapq

taches = []
for prio, nom in [(3, "sauvegarde"), (1, "alerte"), (2, "rapport")]:
    heapq.heappush(taches, (prio, nom))
print([heapq.heappop(taches)[1] for _ in range(3)])
print(heapq.nlargest(3, [5, 1, 9, 3, 7, 8]))
~~~`,
    setup: LAB,
    quiz: [
      { q: "Dans un tas rangé dans une liste, où sont les enfants de la case 4 ?", options: ["5 et 6", "8 et 9", "9 et 10", "2 et 3"], answer: 2, explain: "2 × 4 + 1 = 9 et 2 × 4 + 2 = 10." },
      { q: "Les 10 plus grands éléments d'un flux de 10 millions de valeurs : quelle approche ?", options: ["Tout trier : O(n log n)", "Un tas min de taille 10 : O(n log 10), mémoire O(10)", "Une pile", "Un dictionnaire"], answer: 1, explain: "On ne garde que les 10 meilleurs vus jusqu'ici ; la racine du tas est le plus petit d'entre eux." }
    ],
    challenge: {
      prompt: `<p>Sans utiliser @@heapq@@, écris une classe @@TasMin@@ rangée dans la liste @@self.t@@, avec @@ajouter(x)@@, @@retirer_min()@@ (@@IndexError@@ si vide), @@__len__@@. Puis @@k_plus_grands(valeurs, k)@@, qui renvoie les k plus grandes valeurs dans l'ordre décroissant en utilisant un @@TasMin@@ de taille au plus k.</p>`,
      starter: PY`class TasMin:
    def __init__(self):
        self.t = []

    def ajouter(self, x):
        self.t.append(x)

    def retirer_min(self):
        return self.t.pop(0)

    def __len__(self):
        return len(self.t)


def k_plus_grands(valeurs, k):
    return sorted(valeurs)[:k]
`,
      solution: PY`class TasMin:
    def __init__(self):
        self.t = []

    def ajouter(self, x):
        t = self.t
        t.append(x)
        i = len(t) - 1
        while i > 0:
            p = (i - 1) // 2
            if t[p] <= t[i]:
                break
            t[p], t[i] = t[i], t[p]
            i = p

    def retirer_min(self):
        t = self.t
        if not t:
            raise IndexError("tas vide")
        dernier = t.pop()
        if not t:
            return dernier
        mini, t[0] = t[0], dernier
        i, n = 0, len(t)
        while True:
            g, d, plus_petit = 2 * i + 1, 2 * i + 2, i
            if g < n and t[g] < t[plus_petit]:
                plus_petit = g
            if d < n and t[d] < t[plus_petit]:
                plus_petit = d
            if plus_petit == i:
                return mini
            t[i], t[plus_petit] = t[plus_petit], t[i]
            i = plus_petit

    def __len__(self):
        return len(self.t)


def k_plus_grands(valeurs, k):
    tas = TasMin()
    for v in valeurs:
        if len(tas) < k:
            tas.ajouter(v)
        elif k and v > tas.t[0]:
            tas.retirer_min()
            tas.ajouter(v)
    out = [tas.retirer_min() for _ in range(len(tas))]
    return out[::-1]
`,
      tests: PY`import random

tas = TasMin()
for x in [5, 3, 8, 1, 9, 2, 7]:
    tas.ajouter(x)
print(tas.t[0], [tas.retirer_min() for _ in range(len(tas))])
try:
    tas.retirer_min()
except IndexError:
    print("IndexError")
print(k_plus_grands([5, 1, 9, 3, 7, 8, 2], 3), k_plus_grands([4, 4, 1], 2), k_plus_grands([1, 2], 0))
random.seed(1)
grand = [random.randint(0, 10**9) for _ in range(100_000)]
print(k_plus_grands(grand, 5) == sorted(grand, reverse=True)[:5])
tri = TasMin()
for v in grand[:20_000]:
    tri.ajouter(v)
sortie = [tri.retirer_min() for _ in range(len(tri))]
print(sortie == sorted(grand[:20_000]))
`,
      expected: "1 [1, 2, 3, 5, 7, 8, 9]\nIndexError\n[9, 8, 7] [4, 4] []\nTrue\nTrue\n",
      hint: "Remonter : tant que i > 0 et que le parent (i − 1) // 2 est plus grand, échange. Descendre : compare avec les enfants 2i + 1 et 2i + 2, échange avec le plus petit tant qu'il est plus petit. Pour les k plus grands, remplace la racine quand une valeur la dépasse."
    }
  },
  {
    id: "al-08", section: "Structures de données", title: "Graphes et parcours en largeur", xp: 130,
    theory: `<p>Un <strong>graphe</strong> relie des sommets par des arêtes : un réseau de serveurs, des dépendances entre paquets, un plan de ville, des amis. On le représente le plus souvent par une <strong>liste d'adjacence</strong>, un dictionnaire qui associe à chaque sommet la liste de ses voisins (mémoire O(sommets + arêtes)). La matrice d'adjacence (O(n²)) ne se justifie que pour les graphes denses.</p>
<p>Le <strong>parcours en largeur</strong> (BFS) visite les sommets par distance croissante depuis le départ, avec une file. Dans un graphe non pondéré, il donne les plus courts chemins en nombre d'arêtes, en O(sommets + arêtes). On marque un sommet comme vu au moment où on l'enfile, pour ne jamais l'enfiler deux fois.</p>
~~~py
from collections import deque

reseau = {"routeur": ["web", "db"], "web": ["routeur", "cache"], "db": ["routeur"], "cache": ["web"]}
distance = {"routeur": 0}
file = deque(["routeur"])
while file:
    s = file.popleft()
    for v in reseau[s]:
        if v not in distance:
            distance[v] = distance[s] + 1
            file.append(v)
print(distance)
~~~
<p>Pour reconstruire le chemin, on note le <em>parent</em> de chaque sommet découvert, puis on remonte depuis l'arrivée. Le parcours en profondeur (DFS, une pile ou la récursion) sert plutôt à explorer : composantes connexes, détection de cycles, tri topologique des dépendances. Avec des arêtes pondérées, on passe à Dijkstra (un tas).</p>`,
    setup: LAB,
    quiz: [
      { q: "Pourquoi BFS donne-t-il le plus court chemin dans un graphe non pondéré ?", options: ["Par hasard", "Il visite les sommets par distance croissante : le premier chemin trouvé vers un sommet est le plus court", "Parce qu'il utilise une pile", "Il ne le donne pas"], answer: 1, explain: "Tous les sommets à distance d sont traités avant ceux à distance d + 1." },
      { q: "Quelle structure pour un graphe de 1 million de sommets et 3 millions d'arêtes ?", options: ["Une matrice d'adjacence", "Une liste d'adjacence", "Une liste de sommets seulement", "Un tas"], answer: 1, explain: "La matrice ferait 10¹² cases, presque toutes vides." }
    ],
    challenge: {
      prompt: `<p>Le graphe est un dictionnaire @@{sommet: [voisins]}@@, non orienté. Écris @@plus_court_chemin(graphe, depart, arrivee)@@ qui renvoie la liste des sommets du plus court chemin (départ et arrivée compris), ou @@None@@ s'il n'existe pas. Les voisins sont explorés dans l'ordre de leur liste. Puis @@composantes(graphe)@@ : le nombre de composantes connexes.</p>`,
      starter: PY`def plus_court_chemin(graphe, depart, arrivee):
    return [depart, arrivee]


def composantes(graphe):
    return 1
`,
      solution: PY`from collections import deque


def plus_court_chemin(graphe, depart, arrivee):
    parent = {depart: None}
    file = deque([depart])
    while file:
        s = file.popleft()
        if s == arrivee:
            chemin = []
            while s is not None:
                chemin.append(s)
                s = parent[s]
            return chemin[::-1]
        for v in graphe.get(s, []):
            if v not in parent:
                parent[v] = s
                file.append(v)
    return None


def composantes(graphe):
    vus, n = set(), 0
    for depart in graphe:
        if depart in vus:
            continue
        n += 1
        vus.add(depart)
        pile = [depart]
        while pile:
            s = pile.pop()
            for v in graphe[s]:
                if v not in vus:
                    vus.add(v)
                    pile.append(v)
    return n
`,
      tests: PY`metro = {
    "Gare": ["Mairie", "Musée"], "Mairie": ["Gare", "Parc", "Port"], "Musée": ["Gare", "Parc"],
    "Parc": ["Mairie", "Musée", "Stade"], "Port": ["Mairie", "Stade"], "Stade": ["Parc", "Port"],
    "Île": ["Phare"], "Phare": ["Île"],
}
print(plus_court_chemin(metro, "Gare", "Stade"))
print(plus_court_chemin(metro, "Musée", "Port"))
print(plus_court_chemin(metro, "Gare", "Gare"), plus_court_chemin(metro, "Gare", "Phare"))
print(composantes(metro), composantes({}), composantes({1: [], 2: [], 3: []}))
grille = {}
for i in range(120):
    for j in range(120):
        grille[(i, j)] = [(i + di, j + dj) for di, dj in ((0, 1), (1, 0), (0, -1), (-1, 0)) if 0 <= i + di < 120 and 0 <= j + dj < 120]
chemin = plus_court_chemin(grille, (0, 0), (119, 119))
print(len(chemin) - 1, composantes(grille))
`,
      expected: "['Gare', 'Mairie', 'Parc', 'Stade']\n['Musée', 'Gare', 'Mairie', 'Port']\n['Gare'] None\n2 0 3\n238 1\n",
      hint: "BFS avec un dictionnaire parent (départ → None) et une deque ; marque un voisin au moment de l'enfiler. À l'arrivée, remonte les parents et inverse. Composantes : un parcours depuis chaque sommet pas encore vu."
    }
  },
  {
    id: "al-09", section: "Structures de données", title: "Choisir la bonne structure : questions d'entretien", xp: 60, theoryOnly: true,
    theory: `<p>Le tableau à connaître par cœur, puis les questions qui tombent le plus. Réponds toujours avec la complexité en temps et en mémoire.</p>
~~~text
                     accès     recherche   insertion          suppression        remarque
liste (tableau)      O(1)      O(n)        O(1)* fin, O(n)    O(1) fin, O(n)     * amorti
dict / set           -         O(1) moy.   O(1) moy.          O(1) moy.          pire cas O(n)
pile / file (deque)  -         O(n)        O(1)               O(1)               aux extrémités
liste chaînée        O(n)      O(n)        O(1) en tête       O(1) si on a le nœud
ABR équilibré        -         O(log n)    O(log n)           O(log n)           ordonné
tas                  min O(1)  O(n)        O(log n)           O(log n) le min
~~~
<div class="qa">
<details><summary>Comment trouver si un tableau contient deux nombres dont la somme vaut une cible ?</summary><p>Un dictionnaire des valeurs déjà vues : pour chaque x, chercher cible − x. O(n) en temps et en mémoire, contre O(n²) pour deux boucles. Si le tableau est trié, deux pointeurs aux extrémités en O(1) de mémoire.</p></details>
<details><summary>Comment implémenter un cache LRU avec get et put en O(1) ?</summary><p>Un dictionnaire clé → nœud, et une liste doublement chaînée dans l'ordre d'utilisation : on déplace un nœud en tête à chaque accès et on retire la queue quand c'est plein. En Python, collections.OrderedDict fait les deux.</p></details>
<details><summary>Quand préférer un ABR (ou une liste triée) à une table de hachage ?</summary><p>Quand l'ordre compte : parcourir dans l'ordre, chercher le plus proche successeur, des requêtes par intervalle. Un dictionnaire ne répond qu'à « cette clé est-elle là ? ».</p></details>
<details><summary>Comment fusionner k listes triées ?</summary><p>Un tas qui contient le premier élément de chaque liste : on retire le minimum, on ajoute le suivant de sa liste. O(n log k) pour n éléments au total.</p></details>
<details><summary>Pile d'appels et récursion : quel risque ?</summary><p>Chaque appel récursif consomme de la pile : une récursion de profondeur n (un arbre dégénéré, une liste chaînée) peut la dépasser (RecursionError en Python vers 1 000 niveaux). On passe alors à une version itérative avec une pile explicite.</p></details>
</div>`,
    practice: { title: "S'entraîner", body: `<p>Sans regarder, refais au tableau blanc (ou sur papier) un tas min et un parcours en largeur, en expliquant à voix haute chaque invariant. Puis résous trois problèmes « Easy » et deux « Medium » sur LeetCode par structure vue dans ce chapitre, en annonçant la complexité avant de coder.</p>` },
    quiz: [
      { q: "Quelle structure pour un correcteur orthographique qui teste des millions de mots ?", options: ["Une liste", "Un ensemble (set) ou un trie", "Une pile", "Un tas"], answer: 1, explain: "Test d'appartenance en O(1) moyen (set), ou O(longueur du mot) avec un trie qui permet aussi les préfixes." },
      { q: "Les 100 événements les plus récents d'un flux, avec ajout et retrait du plus ancien en O(1) ?", options: ["Une liste et pop(0)", "Une deque de taille maximale 100 (maxlen)", "Un dictionnaire", "Un ABR"], answer: 1, explain: "deque(maxlen=100) retire automatiquement le plus ancien." }
    ]
  }
];
