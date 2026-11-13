/* Exercices courts du cours Algorithmique (format : README, « exercices »). Chaque réponse est vérifiée par exécution. */
const R = String.raw;

export default {
  "al-01": [
    { type: "sortie", consigne: "Le programme compte les opérations de chaque version.", code: R`n = 1000
ops_double = 0
for i in range(n):
    for j in range(i + 1, n):
        ops_double += 1
ops_simple = 0
vus = set()
for i in range(n):
    ops_simple += 1
    vus.add(i)
print(ops_double, ops_simple)`, reponse: "499500 1000",
      explain: "La double boucle fait n(n − 1)/2 comparaisons, soit O(n²) ; le parcours avec un ensemble en fait n, soit O(n). À n = 1 000, l'écart est déjà de 500 fois." },
    { type: "trous", consigne: "Rends la fonction O(n) : l'appartenance doit coûter O(1).", code: R`def a_un_doublon(seq):
    vus = ⟦set()⟧
    for x in seq:
        if x ⟦in⟧ vus:
            return True
        vus.add(x)
    return False

print(a_un_doublon([3, 1, 4, 1]), a_un_doublon("abc"))`, attendu: "True False",
      explain: R`@@x in vus@@ est O(1) en moyenne sur un @@set@@, O(n) sur une liste : la fonction entière passe de O(n²) à O(n).` }
  ],
  "al-02": [
    { type: "sortie", code: R`capacite, taille, copies = 1, 0, 0
for _ in range(9):
    if taille == capacite:
        copies += taille
        capacite *= 2
    taille += 1
print(capacite, copies)`, reponse: "16 15",
      explain: "Les agrandissements recopient 1, 2, 4 puis 8 éléments : 15 copies pour 9 ajouts, moins de 2 par ajout. C'est le coût amorti O(1)." },
    { type: "trous", code: R`def ajouter(tab, taille, x):
    if taille == len(tab):
        tab = tab + [None] * ⟦len(tab)§max(1, len(tab))⟧
    tab[taille] = x
    return tab, taille + 1

tab, taille = [None], 0
for x in "abcde":
    tab, taille = ajouter(tab, taille, x)
print(len(tab), tab[:taille])`, attendu: "8 ['a', 'b', 'c', 'd', 'e']",
      explain: "Quand le tableau est plein, on double sa capacité : 1, 2, 4, 8. Doubler (et non ajouter une case) garantit le coût amorti constant." }
  ],
  "al-03": [
    { type: "sortie", code: R`cases = 8
cles = [3, 11, 19, 5]
table = [[] for _ in range(cases)]
for k in cles:
    table[k % cases].append(k)
print(table[3], len(table[5]), sum(1 for c in table if c))`, reponse: "[3, 11, 19] 1 2",
      explain: "3, 11 et 19 valent tous 3 modulo 8 : trois collisions dans la même case, chaînées dans une liste. Seules deux cases sont occupées." },
    { type: "trous", code: R`class Table:
    def __init__(self, n=8):
        self.cases = [[] for _ in range(n)]

    def mettre(self, cle, valeur):
        case = self.cases[hash(cle) ⟦%⟧ len(self.cases)]
        for paire in case:
            if paire[0] ⟦==⟧ cle:
                paire[1] = valeur
                return
        case.append([cle, valeur])

t = Table()
t.mettre(10, "a")
t.mettre(18, "b")
t.mettre(10, "c")
print(t.cases[2])`, attendu: "[[10, 'c'], [18, 'b']]",
      explain: "Le reste de la division par le nombre de cases donne la case. Une clé déjà présente voit sa valeur remplacée, pas dupliquée." }
  ],
  "al-04": [
    { type: "sortie", code: R`from collections import deque
pile, file = [], deque()
for x in [1, 2, 3]:
    pile.append(x)
    file.append(x)
print(pile.pop(), file.popleft())
pile.append(4)
file.append(4)
print(list(pile), list(file))`, reponse: "3 1\n[1, 2, 4] [2, 3, 4]",
      explain: "La pile rend le dernier entré (3), la file le premier (1). Ensuite chacune ajoute 4 à la fin." },
    { type: "ordre", consigne: "La fonction vérifie que les parenthèses sont bien appariées.", avant: "def equilibre(s):\n    pile = []\n    for c in s:", lignes: ["        if c == \"(\":", "            pile.append(c)", "        elif c == \")\":", "            if not pile:", "                return False", "            pile.pop()"], apres: "    return not pile\n\nprint(equilibre(\"(()())\"), equilibre(\"())(\"), equilibre(\"((\"))", attendu: "True False False",
      explain: "On empile chaque ouvrante ; une fermante doit trouver une ouvrante à dépiler, sinon la chaîne est fausse. À la fin, la pile doit être vide." }
  ],
  "al-05": [
    { type: "sortie", code: R`class Noeud:
    def __init__(self, v, suivant=None):
        self.v, self.suivant = v, suivant

tete = Noeud(1, Noeud(2, Noeud(3)))
tete = Noeud(0, tete)
tete.suivant.suivant = tete.suivant.suivant.suivant
n, vals = tete, []
while n:
    vals.append(n.v)
    n = n.suivant
print(vals)`, reponse: "[0, 1, 3]",
      explain: "Ajouter en tête crée un nœud qui pointe vers l'ancienne tête. Faire pointer le nœud 1 vers le suivant de son suivant retire le nœud 2 de la chaîne." },
    { type: "trous", code: R`class Noeud:
    def __init__(self, v, suivant=None):
        self.v, self.suivant = v, suivant

def inverser(tete):
    precedent = None
    while tete:
        suivant = tete.suivant
        tete.suivant = ⟦precedent⟧
        precedent = ⟦tete⟧
        tete = suivant
    return precedent

n = inverser(Noeud(1, Noeud(2, Noeud(3))))
print(n.v, n.suivant.v, n.suivant.suivant.v)`, attendu: "3 2 1",
      explain: "Chaque nœud est retourné vers le précédent ; on garde le suivant de côté avant de casser le lien. À la fin, le précédent est la nouvelle tête." }
  ],
  "al-06": [
    { type: "sortie", code: R`def inserer(arbre, v):
    if arbre is None:
        return [v, None, None]
    if v < arbre[0]:
        arbre[1] = inserer(arbre[1], v)
    elif v > arbre[0]:
        arbre[2] = inserer(arbre[2], v)
    return arbre

def infixe(a):
    return infixe(a[1]) + [a[0]] + infixe(a[2]) if a else []

def hauteur(a):
    return 1 + max(hauteur(a[1]), hauteur(a[2])) if a else 0

a = None
for v in [8, 3, 10, 1, 6, 14]:
    a = inserer(a, v)
b = None
for v in [1, 3, 6, 8, 10, 14]:
    b = inserer(b, v)
print(infixe(a), hauteur(a), hauteur(b))`, reponse: "[1, 3, 6, 8, 10, 14] 3 6",
      explain: "Le parcours infixe d'un ABR sort les valeurs triées. Les mêmes valeurs insérées dans l'ordre croissant donnent une chaîne de hauteur 6 : l'arbre a dégénéré en liste." },
    { type: "trous", code: R`def contient(arbre, v):
    while arbre:
        if v ⟦==⟧ arbre[0]:
            return True
        arbre = arbre[1] if v ⟦<⟧ arbre[0] else arbre[2]
    return False

a = [8, [3, None, [6, None, None]], [10, None, None]]
print(contient(a, 6), contient(a, 9))`, attendu: "True False",
      explain: "Plus petit : on descend à gauche (case 1) ; plus grand : à droite (case 2). On ne suit qu'un chemin : O(h)." }
  ],
  "al-07": [
    { type: "sortie", code: R`t = [1, 3, 2, 7, 4]
i = 4
print(t[(i - 1) // 2], 2 * 1 + 1, 2 * 1 + 2)
t.append(0)
i = len(t) - 1
while i > 0 and t[i] < t[(i - 1) // 2]:
    p = (i - 1) // 2
    t[i], t[p] = t[p], t[i]
    i = p
print(t)`, reponse: "3 3 4\n[0, 3, 1, 7, 4, 2]",
      explain: "Le parent de la case 4 est la case 1 (valeur 3), les enfants de la case 1 sont les cases 3 et 4. Le 0 ajouté remonte en échangeant avec 2 puis avec 1 : il devient la racine." },
    { type: "trous", code: R`import heapq
taches = [(3, "sauvegarde"), (1, "alerte"), (2, "rapport")]
tas = []
for t in taches:
    heapq.⟦heappush⟧(tas, t)
while tas:
    print(heapq.⟦heappop⟧(tas)[1])`, attendu: "alerte\nrapport\nsauvegarde",
      explain: R`@@heappush@@ ajoute, @@heappop@@ retire toujours le plus petit : les tuples se comparent sur la priorité d'abord.` }
  ],
  "al-08": [
    { type: "sortie", code: R`from collections import deque
g = {"A": ["B", "C"], "B": ["A", "D"], "C": ["A", "D"], "D": ["B", "C", "E"], "E": ["D"]}
dist = {"A": 0}
file = deque(["A"])
while file:
    s = file.popleft()
    for v in g[s]:
        if v not in dist:
            dist[v] = dist[s] + 1
            file.append(v)
print(dist)`, reponse: "{'A': 0, 'B': 1, 'C': 1, 'D': 2, 'E': 3}",
      explain: "Le BFS visite par distance croissante : B et C à 1, D à 2, E à 3. Un sommet déjà vu n'est jamais revisité." },
    { type: "trous", code: R`from collections import deque
g = {1: [2, 3], 2: [4], 3: [4], 4: []}
vus = {1}
file = deque([1])
ordre = []
while file:
    s = file.⟦popleft⟧()
    ordre.append(s)
    for v in g[s]:
        if v ⟦not in⟧ vus:
            vus.add(v)
            file.append(v)
print(ordre)`, attendu: "[1, 2, 3, 4]",
      explain: R`On retire le sommet le plus ancien (@@popleft@@ : une file, pas une pile), puis on ajoute ses voisins encore inconnus, marqués vus dès leur ajout pour ne jamais les mettre deux fois.` }
  ],
  "al-10": [
    { type: "sortie", code: R`from collections import Counter, defaultdict
print(Counter("mississippi").most_common(2))
groupes = defaultdict(list)
for mot in ["chien", "niche", "chat", "tache", "chine"]:
    groupes["".join(sorted(mot))].append(mot)
print([g for g in groupes.values() if len(g) > 1])`, reponse: "[('i', 4), ('s', 4)]\n[['chien', 'niche', 'chine']]",
      explain: R`@@most_common@@ départage les égalités par ordre de première apparition. Des anagrammes ont les mêmes lettres triées : c'est la clé de regroupement.` },
    { type: "trous", code: R`def deux_sommes(nums, cible):
    vus = {}
    for i, x in enumerate(nums):
        if cible ⟦-⟧ x in vus:
            return (vus[cible - x], i)
        vus[x] = ⟦i⟧
    return None

print(deux_sommes([2, 7, 11, 15], 9), deux_sommes([3, 2, 4], 6))`, attendu: "(0, 1) (1, 2)",
      explain: "Pour chaque nombre, on cherche son complément parmi ceux déjà vus, puis on mémorise son indice : un seul parcours, O(n)." }
  ],
  "al-11": [
    { type: "sortie", code: R`nums = [1, 2, 4, 7, 11, 15]
g, d = 0, len(nums) - 1
etapes = 0
while g < d:
    etapes += 1
    s = nums[g] + nums[d]
    if s == 15:
        break
    if s < 15:
        g += 1
    else:
        d -= 1
print(nums[g], nums[d], etapes)`, reponse: "4 11 4",
      explain: "1 + 15 = 16 : trop grand, d recule. 1 + 11 = 12 : trop petit, g avance. 2 + 11 = 13 : g avance. 4 + 11 = 15 : trouvé en 4 étapes." },
    { type: "trous", code: R`def palindrome(s):
    g, d = 0, len(s) ⟦-⟧ 1
    while g < d:
        if s[g] != s[d]:
            return False
        g ⟦+=⟧ 1
        d ⟦-=⟧ 1
    return True

print(palindrome("kayak"), palindrome("radar"), palindrome("route"))`, attendu: "True True False",
      explain: "Un pointeur part de chaque bout et ils se rapprochent : O(n) en temps, O(1) en mémoire." }
  ],
  "al-12": [
    { type: "sortie", code: R`nums = [4, 2, 1, 7, 8, 1, 2]
k = 3
s = sum(nums[:k])
meilleure = s
for d in range(k, len(nums)):
    s += nums[d] - nums[d - k]
    meilleure = max(meilleure, s)
print(meilleure)`, reponse: "16",
      explain: "Les sommes des fenêtres de 3 valent 7, 10, 16, 16, 11 : à chaque pas, un élément entre et un sort, sans tout recalculer." },
    { type: "trous", code: R`def plus_longue_sans_repetition(s):
    dernier = {}
    g = meilleur = 0
    for d, c in enumerate(s):
        if c in dernier and dernier[c] >= g:
            g = dernier[c] ⟦+⟧ 1
        dernier[c] = d
        meilleur = max(meilleur, d ⟦-⟧ g + 1)
    return meilleur

print(plus_longue_sans_repetition("abcabcbb"), plus_longue_sans_repetition("pwwkew"))`, attendu: "3 3",
      explain: "Quand un caractère se répète dans la fenêtre, le bord gauche saute juste après sa dernière position. La longueur de la fenêtre [g, d] est d − g + 1." }
  ],
  "al-13": [
    { type: "sortie", code: R`def premiere_position(n, condition):
    g, d = 0, n
    while g < d:
        m = (g + d) // 2
        if condition(m):
            d = m
        else:
            g = m + 1
    return g

t = [1, 3, 3, 3, 8, 9]
print(premiere_position(len(t), lambda i: t[i] >= 3), premiere_position(len(t), lambda i: t[i] > 3), premiere_position(len(t), lambda i: t[i] > 9))`, reponse: "1 4 6",
      explain: "On cherche la première position où la condition devient vraie. Si elle ne l'est jamais, on obtient n : 6." },
    { type: "trous", code: R`def racine_entiere(n):
    g, d = 0, n
    while g < d:
        m = (g + d + 1) // 2
        if m * m ⟦<=⟧ n:
            g = ⟦m⟧
        else:
            d = m - 1
    return g

print(racine_entiere(26), racine_entiere(49), racine_entiere(0))`, attendu: "5 7 0",
      explain: R`On cherche le plus grand r tel que r² ≤ n : si @@m@@ convient, la réponse est au moins @@m@@. Le milieu arrondi vers le haut évite la boucle infinie quand g et d sont voisins.` }
  ],
  "al-14": [
    { type: "sortie", code: R`t = [21, 19, 23, 22, 18, 25]
attente = [0] * len(t)
pile = []
for i, x in enumerate(t):
    while pile and t[pile[-1]] < x:
        j = pile.pop()
        attente[j] = i - j
    pile.append(i)
print(attente)`, reponse: "[2, 1, 3, 2, 1, 0]",
      explain: "Chaque température attend la prochaine plus chaude : 21 attend deux jours (23), 23 en attend trois (25). 25 n'a pas de successeur plus chaud : 0." },
    { type: "trous", code: R`def prochain_plus_petit(nums):
    res = [-1] * len(nums)
    pile = []
    for i, x in enumerate(nums):
        while pile and nums[pile[-1]] ⟦>⟧ x:
            res[pile.⟦pop⟧()] = x
        pile.append(i)
    return res

print(prochain_plus_petit([4, 8, 5, 2, 7]))`, attendu: "[2, 5, 2, -1, -1]",
      explain: "La pile garde les indices dont les valeurs croissent ; une valeur plus petite répond à tous les plus grands du sommet, qu'on dépile." }
  ],
  "al-15": [
    { type: "sortie", code: R`from collections import deque
deps = {"build": ["test"], "test": ["deploy"], "lint": ["deploy"], "deploy": []}
entrants = {t: 0 for t in deps}
for t in deps:
    for s in deps[t]:
        entrants[s] += 1
file = deque(t for t in deps if entrants[t] == 0)
ordre = []
while file:
    t = file.popleft()
    ordre.append(t)
    for s in deps[t]:
        entrants[s] -= 1
        if entrants[s] == 0:
            file.append(s)
print(ordre)`, reponse: "['build', 'lint', 'test', 'deploy']",
      explain: "build et lint n'ont aucune dépendance : ils partent en premier. deploy n'est libéré qu'une fois test et lint terminés." },
    { type: "trous", code: R`grille = ["##..", "#..#", "...#", "##.."]
vus = set()
iles = 0
for i in range(len(grille)):
    for j in range(len(grille[0])):
        if grille[i][j] == "#" and (i, j) not in vus:
            iles += 1
            pile = [(i, j)]
            vus.add((i, j))
            while pile:
                a, b = pile.⟦pop⟧()
                for x, y in ((a + 1, b), (a - 1, b), (a, b + 1), (a, b - 1)):
                    if 0 <= x < len(grille) and 0 <= y < len(grille[0]) and grille[x][y] == "#" and (x, y) ⟦not in⟧ vus:
                        vus.add((x, y))
                        pile.append((x, y))
print(iles)`, attendu: "3",
      explain: "Chaque case de terre non vue démarre une île ; le DFS avec une pile explicite marque toute la terre reliée pour ne pas la recompter." }
  ],
  "al-16": [
    { type: "sortie", code: R`import heapq
nums = [5, 1, 9, 3, 7, 2]
tas = []
for x in nums:
    heapq.heappush(tas, x)
    if len(tas) > 3:
        heapq.heappop(tas)
print(sorted(tas, reverse=True), tas[0])`, reponse: "[9, 7, 5] 5",
      explain: "Un tas min de taille k garde les k plus grands : on retire le plus petit dès qu'on dépasse k. Sa racine est le k-ième plus grand." },
    { type: "trous", code: R`import heapq
flux = [[1, 4, 9], [2, 3], [5]]
tas = [(l[0], i, 0) for i, l in enumerate(flux)]
heapq.⟦heapify⟧(tas)
fusion = []
while tas:
    v, i, j = heapq.heappop(tas)
    fusion.append(v)
    if j + 1 < len(flux[i]):
        heapq.heappush(tas, (flux[i][j ⟦+⟧ 1], i, j + 1))
print(fusion)`, attendu: "[1, 2, 3, 4, 5, 9]",
      explain: "Le tas contient le plus petit élément restant de chaque flux ; quand on en retire un, on pousse le suivant du même flux." }
  ],
  "al-17": [
    { type: "sortie", code: R`intervalles = [(1, 3), (8, 10), (2, 6), (15, 18), (6, 7)]
fusion = []
for d, f in sorted(intervalles):
    if fusion and d <= fusion[-1][1]:
        fusion[-1] = (fusion[-1][0], max(fusion[-1][1], f))
    else:
        fusion.append((d, f))
print(fusion)`, reponse: "[(1, 7), (8, 10), (15, 18)]",
      explain: "Triés par début, (1, 3), (2, 6) et (6, 7) se chevauchent ou se touchent : ils fusionnent en (1, 7)." },
    { type: "trous", code: R`reunions = [(9, 10), (9, 12), (11, 13), (12, 14)]
debuts = sorted(d for d, f in reunions)
fins = sorted(f for d, f in reunions)
salles = maxi = j = 0
for d in debuts:
    while fins[j] ⟦<=⟧ d:
        salles ⟦-=⟧ 1
        j += 1
    salles += 1
    maxi = max(maxi, salles)
print(maxi)`, attendu: "2",
      explain: "On balaie les débuts dans l'ordre ; chaque réunion terminée avant (ou pile à) ce début libère sa salle. Le maximum atteint est le nombre de salles nécessaires." }
  ],
  "al-18": [
    { type: "sortie", code: R`def permutations(elements):
    res = []
    def explorer(courant, restants):
        if not restants:
            res.append("".join(courant))
            return
        for i in range(len(restants)):
            courant.append(restants[i])
            explorer(courant, restants[:i] + restants[i + 1:])
            courant.pop()
    explorer([], elements)
    return res

print(permutations("abc"))`, reponse: "['abc', 'acb', 'bac', 'bca', 'cab', 'cba']",
      explain: "À chaque niveau, on choisit un élément parmi les restants, on explore, puis on annule le choix : 3 × 2 × 1 = 6 permutations." },
    { type: "trous", code: R`def sous_ensembles(elements):
    resultats, courant = [], []
    def explorer(i):
        if i == len(elements):
            resultats.append(⟦courant[:]§list(courant)§courant.copy()⟧)
            return
        courant.append(elements[i])
        explorer(i + 1)
        courant.⟦pop⟧()
        explorer(i + 1)
    explorer(0)
    return resultats

print(sous_ensembles([1, 2]))`, attendu: "[[1, 2], [1], [2], []]",
      explain: R`On enregistre une copie (@@courant[:]@@), car la liste va encore changer ; @@pop@@ annule le choix avant d'explorer la branche « sans ».` }
  ],
  "al-19": [
    { type: "sortie", code: R`n = 6
dp = [0] * (n + 1)
dp[0], dp[1] = 1, 1
for i in range(2, n + 1):
    dp[i] = dp[i - 1] + dp[i - 2]
print(dp)`, reponse: "[1, 1, 2, 3, 5, 8, 13]",
      explain: "Pour arriver à la marche i, on vient de i − 1 ou de i − 2 : dp[i] = dp[i − 1] + dp[i − 2]. Chaque état est calculé une seule fois." },
    { type: "trous", code: R`def rendu_monnaie(pieces, montant):
    inf = float("inf")
    dp = [0] + [inf] * montant
    for m in range(1, montant + 1):
        for p in pieces:
            if p <= m:
                dp[m] = ⟦min⟧(dp[m], dp[m ⟦-⟧ p] + 1)
    return dp[montant] if dp[montant] != inf else -1

print(rendu_monnaie([1, 3, 4], 6), rendu_monnaie([2], 3))`, attendu: "2 -1",
      explain: "Le meilleur rendu de m utilise une dernière pièce p, plus le meilleur rendu de m − p. Avec 1, 3 et 4, 6 = 3 + 3 (le glouton 4 + 1 + 1 en prend trois)." }
  ]
};
