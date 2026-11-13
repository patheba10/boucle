/* Défis gradués du cours Algorithmique : un problème d'entretien classique par leçon de patterns (format : README,
   « defis »). npm run validate vérifie que la solution passe et que le code de départ échoue. */
const R = String.raw;

export default {
  "al-10": [{
    niveau: "entretien",
    prompt: R`<p>Écris @@plus_longue_suite(nums)@@ : la longueur de la plus longue suite d'entiers consécutifs présents dans @@nums@@ (dans n'importe quel ordre). Par exemple, @@[100, 4, 200, 1, 3, 2]@@ contient 1, 2, 3, 4 : la réponse est 4. Vise O(n) : pas de tri.</p>`,
    starter: "def plus_longue_suite(nums):\n    return 0\n",
    solution: R`def plus_longue_suite(nums):
    ens = set(nums)
    meilleur = 0
    for x in ens:
        if x - 1 not in ens:          # x commence une suite
            y = x
            while y + 1 in ens:
                y += 1
            meilleur = max(meilleur, y - x + 1)
    return meilleur
`,
    tests: R`print(plus_longue_suite([100, 4, 200, 1, 3, 2]), plus_longue_suite([]), plus_longue_suite([0, 3, 7, 2, 5, 8, 4, 6, 0, 1]), plus_longue_suite([5]))
print(plus_longue_suite(list(range(200_000, 0, -1))))
`,
    expected: "4 0 9 1\n200000",
    hints: ["Mets tous les nombres dans un set : tester « x + 1 existe-t-il ? » coûte alors O(1).", "Ne compte une suite qu'à partir de son début : un x tel que x − 1 n'est pas dans le set.", "Depuis chaque début, avance tant que y + 1 est présent. Chaque nombre n'est parcouru qu'une fois au total : O(n)."]
  }],
  "al-11": [{
    niveau: "entretien",
    prompt: R`<p>Écris @@trois_sommes(nums)@@ : la liste de tous les triplets @@(a, b, c)@@ de valeurs de @@nums@@ (trois positions différentes) tels que @@a + b + c == 0@@, sans doublon, chaque triplet trié (@@a ≤ b ≤ c@@) et la liste triée. Vise O(n²).</p>`,
    starter: "def trois_sommes(nums):\n    return []\n",
    solution: R`def trois_sommes(nums):
    nums = sorted(nums)
    res = []
    for i in range(len(nums) - 2):
        if i > 0 and nums[i] == nums[i - 1]:
            continue                      # même premier élément : mêmes triplets
        g, d = i + 1, len(nums) - 1
        while g < d:
            s = nums[i] + nums[g] + nums[d]
            if s < 0:
                g += 1
            elif s > 0:
                d -= 1
            else:
                res.append((nums[i], nums[g], nums[d]))
                g += 1
                d -= 1
                while g < d and nums[g] == nums[g - 1]:
                    g += 1
    return res
`,
    tests: R`print(trois_sommes([-1, 0, 1, 2, -1, -4]))
print(trois_sommes([0, 0, 0, 0]), trois_sommes([1, 2, -2, -1]), trois_sommes([]))
print(len(trois_sommes(list(range(-400, 400)))))
`,
    expected: "[(-1, -1, 2), (-1, 0, 1)]\n[(0, 0, 0)] [] []\n79800",
    hints: ["Trie d'abord : les doublons deviennent voisins, et deux pointeurs deviennent possibles.", "Fixe le premier élément nums[i], puis cherche une paire de somme −nums[i] dans la suite avec deux pointeurs g et d.", "Saute un nums[i] égal au précédent, et après un triplet trouvé, avance g tant qu'il répète la même valeur."]
  }],
  "al-12": [{
    niveau: "entretien",
    prompt: R`<p>Écris @@plus_longue_k_distincts(s, k)@@ : la longueur de la plus longue sous-chaîne de @@s@@ qui contient au plus @@k@@ caractères différents. Par exemple @@("eceba", 2)@@ donne 3 (« ece »). Vise O(n).</p>`,
    starter: "def plus_longue_k_distincts(s, k):\n    return len(s)\n",
    solution: R`def plus_longue_k_distincts(s, k):
    compte = {}
    g = meilleur = 0
    for d, c in enumerate(s):
        compte[c] = compte.get(c, 0) + 1
        while len(compte) > k:           # fenêtre invalide : on réduit à gauche
            compte[s[g]] -= 1
            if compte[s[g]] == 0:
                del compte[s[g]]
            g += 1
        meilleur = max(meilleur, d - g + 1)
    return meilleur
`,
    tests: R`print(plus_longue_k_distincts("eceba", 2), plus_longue_k_distincts("aa", 1), plus_longue_k_distincts("abcabc", 3), plus_longue_k_distincts("abc", 0), plus_longue_k_distincts("", 2))
print(plus_longue_k_distincts("ab" * 100_000 + "c", 2))
`,
    expected: "3 2 6 0 0\n200000",
    hints: ["Fenêtre [g, d] et un dictionnaire caractère → nombre d'apparitions dans la fenêtre.", "Ajoute s[d] ; tant que le dictionnaire a plus de k clés, retire s[g] (supprime la clé à 0) et avance g.", "Après chaque réduction, la fenêtre est valide : mets à jour le maximum avec d − g + 1."]
  }],
  "al-13": [{
    niveau: "entretien",
    prompt: R`<p>Une liste triée sans doublon a été « tournée » : @@[0, 1, 2, 4, 5, 6, 7]@@ est devenue @@[4, 5, 6, 7, 0, 1, 2]@@. Écris @@minimum_tourne(t)@@, qui renvoie son plus petit élément en O(log n) lectures. Le test compte les lectures de la liste : @@min(t)@@ ne suffit pas.</p>`,
    starter: "def minimum_tourne(t):\n    return min(t)\n",
    solution: R`def minimum_tourne(t):
    g, d = 0, len(t) - 1
    while g < d:
        m = (g + d) // 2
        if t[m] > t[d]:
            g = m + 1          # le minimum est à droite du milieu
        else:
            d = m              # le minimum est au milieu ou à gauche
    return t[g]
`,
    tests: R`class Espion(list):
    lectures = 0
    def __getitem__(self, i):
        Espion.lectures += 1
        return list.__getitem__(self, i)
    def __iter__(self):
        Espion.lectures += len(self)
        return list.__iter__(self)

print(minimum_tourne([4, 5, 6, 7, 0, 1, 2]), minimum_tourne([3, 4, 5, 1, 2]), minimum_tourne([11, 13, 15, 17]), minimum_tourne([2, 1]), minimum_tourne([5]))
e = Espion(list(range(1000, 100_000)) + list(range(1000)))
print(minimum_tourne(e), Espion.lectures <= 60)
`,
    expected: "0 1 11 1 5\n0 True",
    hints: ["Compare le milieu au dernier élément de l'intervalle.", "Si t[m] > t[d], la cassure (et le minimum) est strictement à droite : g = m + 1. Sinon, le minimum est en m ou à sa gauche : d = m.", "Quand g == d, t[g] est le minimum."]
  }],
  "al-14": [{
    niveau: "entretien",
    prompt: R`<p>@@h@@ donne les hauteurs de barres de largeur 1, côte à côte. Écris @@plus_grand_rectangle(h)@@ : l'aire du plus grand rectangle contenu dans l'histogramme. Pour @@[2, 1, 5, 6, 2, 3]@@, c'est 10 (hauteur 5 sur les barres 5 et 6). Vise O(n).</p>`,
    starter: "def plus_grand_rectangle(h):\n    return max(h, default=0)\n",
    solution: R`def plus_grand_rectangle(h):
    pile = []                     # (début, hauteur), hauteurs croissantes
    meilleur = 0
    for i, x in enumerate(h + [0]):   # le 0 final vide la pile
        debut = i
        while pile and pile[-1][1] > x:
            j, hauteur = pile.pop()
            meilleur = max(meilleur, hauteur * (i - j))
            debut = j             # x peut s'étendre jusqu'au début de la barre dépilée
        pile.append((debut, x))
    return meilleur
`,
    tests: R`print(plus_grand_rectangle([2, 1, 5, 6, 2, 3]), plus_grand_rectangle([2, 4]), plus_grand_rectangle([]), plus_grand_rectangle([3, 3, 3]), plus_grand_rectangle([1]))
print(plus_grand_rectangle(list(range(1, 100_001))))
`,
    expected: "10 4 0 9 1\n2500050000",
    hints: ["Une pile garde des barres de hauteurs croissantes, avec l'indice où chacune peut commencer.", "Quand une barre plus basse arrive, chaque barre plus haute dépilée ne peut plus s'étendre à droite : son rectangle va de son début à i − 1.", "La nouvelle barre peut commencer au début de la dernière barre dépilée. Ajoute une hauteur 0 à la fin pour tout dépiler."]
  }],
  "al-15": [{
    niveau: "entretien",
    prompt: R`<p>@@n@@ paquets sont numérotés de 0 à n − 1 ; chaque couple @@(a, b)@@ de @@deps@@ signifie « a a besoin de b ». Écris @@peut_tout_installer(n, deps)@@ : vrai s'il existe un ordre d'installation, faux s'il y a un cycle. Le test enchaîne 100 000 dépendances : une récursion dépasserait la pile de Python.</p>`,
    starter: "def peut_tout_installer(n, deps):\n    return True\n",
    solution: R`from collections import deque

def peut_tout_installer(n, deps):
    entrants = [0] * n
    suivants = [[] for _ in range(n)]
    for a, b in deps:
        suivants[b].append(a)
        entrants[a] += 1
    file = deque(i for i in range(n) if entrants[i] == 0)
    faits = 0
    while file:
        x = file.popleft()
        faits += 1
        for y in suivants[x]:
            entrants[y] -= 1
            if entrants[y] == 0:
                file.append(y)
    return faits == n                 # sinon, un cycle a bloqué des paquets
`,
    tests: R`print(peut_tout_installer(2, [(1, 0)]), peut_tout_installer(2, [(1, 0), (0, 1)]), peut_tout_installer(4, [(1, 0), (2, 1), (3, 2)]), peut_tout_installer(3, [(0, 0)]), peut_tout_installer(3, []))
chaine = [(i + 1, i) for i in range(99_999)]
print(peut_tout_installer(100_000, chaine), peut_tout_installer(100_000, chaine + [(0, 99_999)]))
`,
    expected: "True False True False True\nTrue False",
    hints: ["Algorithme de Kahn : compte pour chaque paquet le nombre de dépendances qu'il attend.", "Une file part des paquets qui n'attendent rien ; installer un paquet libère ceux qui en dépendent.", "S'il y a un cycle, ses paquets n'arrivent jamais à 0 : on en installe moins que n."]
  }],
  "al-16": [{
    niveau: "entretien",
    prompt: R`<p>Écris une classe @@MedianeFlux@@ : @@ajouter(x)@@ reçoit un nombre, @@mediane()@@ renvoie la médiane de tous les nombres reçus (la moyenne des deux du milieu, en flottant, si leur nombre est pair). Vise O(log n) par ajout et O(1) par médiane, avec deux tas.</p>`,
    starter: "class MedianeFlux:\n    def __init__(self):\n        self.valeurs = []\n\n    def ajouter(self, x):\n        pass\n\n    def mediane(self):\n        return None\n",
    solution: R`import heapq

class MedianeFlux:
    def __init__(self):
        self.bas = []    # moitié basse, tas max (valeurs opposées)
        self.haut = []   # moitié haute, tas min

    def ajouter(self, x):
        heapq.heappush(self.bas, -x)
        heapq.heappush(self.haut, -heapq.heappop(self.bas))
        if len(self.haut) > len(self.bas):
            heapq.heappush(self.bas, -heapq.heappop(self.haut))

    def mediane(self):
        if len(self.bas) > len(self.haut):
            return -self.bas[0]
        return (-self.bas[0] + self.haut[0]) / 2
`,
    tests: R`m = MedianeFlux()
for x in [5, 15, 1, 3]:
    m.ajouter(x)
    print(m.mediane(), end=" ")
print()
m = MedianeFlux()
v = 7
for _ in range(200_000):
    v = (v * 1103515245 + 12345) % 2_147_483_648
    m.ajouter(v % 1_000_000)
print(m.mediane())
`,
    expected: "5 10.0 5 4.0\n498726.0",
    hints: ["Coupe les nombres en deux moitiés : un tas max pour la moitié basse (valeurs opposées avec heapq), un tas min pour la moitié haute.", "Pour ajouter : pousse dans le bas, fais passer le plus grand du bas vers le haut, puis rééquilibre pour que le bas ait autant d'éléments que le haut, ou un de plus.", "La médiane est le sommet du bas si les tailles diffèrent, sinon la moyenne des deux sommets."]
  }],
  "al-17": [{
    niveau: "entretien",
    prompt: R`<p>@@intervalles@@ est une liste triée d'intervalles @@(debut, fin)@@ disjoints. Écris @@inserer_intervalle(intervalles, nouveau)@@ : la liste après insertion de @@nouveau@@, toujours triée et disjointe (les intervalles qui se chevauchent ou se touchent fusionnent). Vise O(n), sans retrier.</p>`,
    starter: "def inserer_intervalle(intervalles, nouveau):\n    return intervalles + [nouveau]\n",
    solution: R`def inserer_intervalle(intervalles, nouveau):
    res = []
    d, f = nouveau
    place = False
    for a, b in intervalles:
        if b < d:                      # entièrement avant
            res.append((a, b))
        elif a > f:                    # entièrement après
            if not place:
                res.append((d, f))
                place = True
            res.append((a, b))
        else:                          # chevauche : on agrandit le nouveau
            d, f = min(d, a), max(f, b)
    if not place:
        res.append((d, f))
    return res
`,
    tests: R`print(inserer_intervalle([(1, 3), (6, 9)], (2, 5)))
print(inserer_intervalle([(1, 2), (3, 5), (6, 7), (8, 10), (12, 16)], (4, 8)))
print(inserer_intervalle([], (5, 7)), inserer_intervalle([(1, 5)], (6, 8)), inserer_intervalle([(1, 5)], (5, 7)), inserer_intervalle([(3, 4)], (0, 1)))
`,
    expected: "[(1, 5), (6, 9)]\n[(1, 2), (3, 10), (12, 16)]\n[(5, 7)] [(1, 5), (6, 8)] [(1, 7)] [(0, 1), (3, 4)]",
    hints: ["Trois cas pour chaque intervalle existant : entièrement avant le nouveau, entièrement après, ou chevauchant.", "Ceux qui chevauchent sont absorbés : le nouveau prend le min des débuts et le max des fins.", "Place le nouveau juste avant le premier intervalle situé entièrement après lui, ou à la fin."]
  }],
  "al-18": [{
    niveau: "entretien",
    prompt: R`<p>Écris @@n_reines(n)@@ : le nombre de façons de placer @@n@@ reines sur un échiquier @@n × n@@ sans qu'aucune n'en menace une autre (même ligne, même colonne ou même diagonale). Pour @@n = 8@@, il y en a 92.</p>`,
    starter: "def n_reines(n):\n    return 1\n",
    solution: R`def n_reines(n):
    cols, diag1, diag2 = set(), set(), set()

    def placer(ligne):
        if ligne == n:
            return 1
        total = 0
        for c in range(n):
            if c in cols or ligne - c in diag1 or ligne + c in diag2:
                continue
            cols.add(c); diag1.add(ligne - c); diag2.add(ligne + c)
            total += placer(ligne + 1)
            cols.remove(c); diag1.remove(ligne - c); diag2.remove(ligne + c)
        return total

    return placer(0)
`,
    tests: R`print([n_reines(n) for n in range(1, 9)])
`,
    expected: "[1, 0, 0, 2, 10, 4, 40, 92]",
    hints: ["Place une reine par ligne : il reste à choisir la colonne, ligne après ligne.", "Une case (ligne, c) est menacée si sa colonne, sa diagonale ligne − c ou son antidiagonale ligne + c est déjà prise : trois ensembles.", "Choisir, explorer la ligne suivante, puis retirer la reine : c'est le retour sur trace."]
  }],
  "al-19": [{
    niveau: "entretien",
    prompt: R`<p>Écris @@distance_edition(a, b)@@ : le nombre minimal d'opérations (insérer, supprimer ou remplacer un caractère) pour transformer @@a@@ en @@b@@ (distance de Levenshtein). « kitten » → « sitting » coûte 3. Vise O(len(a) × len(b)).</p>`,
    starter: "def distance_edition(a, b):\n    return abs(len(a) - len(b))\n",
    solution: R`def distance_edition(a, b):
    prec = list(range(len(b) + 1))          # transformer "" en b[:j] : j insertions
    for i in range(1, len(a) + 1):
        cour = [i] + [0] * len(b)
        for j in range(1, len(b) + 1):
            if a[i - 1] == b[j - 1]:
                cour[j] = prec[j - 1]
            else:
                cour[j] = 1 + min(prec[j],          # supprimer a[i - 1]
                                  cour[j - 1],      # insérer b[j - 1]
                                  prec[j - 1])      # remplacer
        prec = cour
    return prec[-1]
`,
    tests: R`print(distance_edition("kitten", "sitting"), distance_edition("", "abc"), distance_edition("intention", "execution"), distance_edition("abc", "abc"), distance_edition("chien", "niche"))
print(distance_edition("ab" * 200, "ba" * 200))
`,
    expected: "3 3 5 0 4\n2",
    hints: ["dp[i][j] = distance entre les i premiers caractères de a et les j premiers de b. Cas de base : dp[0][j] = j, dp[i][0] = i.", "Si a[i − 1] == b[j − 1], dp[i][j] = dp[i − 1][j − 1] ; sinon 1 + le minimum de supprimer, insérer, remplacer.", "Chaque ligne ne dépend que de la précédente : deux listes suffisent."]
  }]
};
