/* Cours Algorithmique — chapitre 2 : les patterns d'algorithmes qui reviennent en entretien. Chaque leçon : reconnaître
   le pattern, le schéma de code, un défi type entretien avec un test sur une grande entrée. */
import { LAB } from "./structures.js";
const PY = String.raw;

export default [
  {
    id: "al-10", section: "Patterns d'algorithmes", title: "Hachage : compter et retrouver en O(1)", xp: 100,
    theory: `<p>Premier réflexe en entretien : <em>« est-ce qu'un dictionnaire transforme ma double boucle en une seule ? »</em>. Le pattern : parcourir une fois, et pour chaque élément, chercher dans un dictionnaire ce qu'on a déjà vu (son complément, sa clé de regroupement, son nombre d'apparitions).</p>
~~~py
from collections import Counter, defaultdict

print(Counter("abracadabra").most_common(2))
par_longueur = defaultdict(list)
for mot in ["git", "pod", "docker", "helm", "aws"]:
    par_longueur[len(mot)].append(mot)
print(dict(par_longueur))
~~~
<p>Le problème le plus célèbre, <strong>deux sommes</strong> : trouver deux indices dont les valeurs donnent une cible. Pour chaque @@x@@, on cherche @@cible − x@@ parmi les valeurs déjà vues (dictionnaire valeur → indice) : O(n) au lieu de O(n²). Autre classique, les <strong>anagrammes</strong> : deux mots sont anagrammes s'ils ont la même « signature », par exemple leurs lettres triées, qui sert de clé de regroupement.</p>`,
    setup: LAB,
    quiz: [
      { q: "Quelle est la complexité de « deux sommes » avec un dictionnaire ?", options: ["O(n²) en temps", "O(n) en temps et O(n) en mémoire", "O(n log n) en temps, O(1) en mémoire", "O(1)"], answer: 1, explain: "Un seul passage, chaque recherche en O(1) moyen ; le dictionnaire coûte O(n) de mémoire." },
      { q: "Quelle clé pour regrouper des anagrammes ?", options: ["La longueur du mot", "Les lettres triées (ou le compte de chaque lettre)", "La première lettre", "Le mot à l'envers"], answer: 1, explain: "Deux anagrammes ont exactement les mêmes lettres." }
    ],
    challenge: {
      prompt: `<p>Écris @@deux_sommes(nums, cible)@@ qui renvoie le couple d'indices @@(i, j)@@, @@i < j@@, de la première paire trouvée en parcourant de gauche à droite (la plus petite valeur de @@j@@ possible), ou @@None@@. Puis @@grouper_anagrammes(mots)@@ : la liste des groupes, chaque groupe dans l'ordre d'apparition, les groupes dans l'ordre de leur premier mot.</p>`,
      starter: PY`def deux_sommes(nums, cible):
    return None


def grouper_anagrammes(mots):
    return [mots]
`,
      solution: PY`def deux_sommes(nums, cible):
    vus = {}
    for j, x in enumerate(nums):
        if cible - x in vus:
            return (vus[cible - x], j)
        if x not in vus:
            vus[x] = j
    return None


def grouper_anagrammes(mots):
    groupes = {}
    for m in mots:
        groupes.setdefault("".join(sorted(m)), []).append(m)
    return list(groupes.values())
`,
      tests: PY`print(deux_sommes([2, 7, 11, 15], 9), deux_sommes([3, 2, 4], 6), deux_sommes([3, 3], 6), deux_sommes([1, 2], 7))
print(grouper_anagrammes(["chien", "niche", "chine", "lion", "loin", "noeud"]))
grand = list(range(1, 150_001))
print(deux_sommes(grand, 299_999))
`,
      expected: "(0, 1) (1, 2) (0, 1) None\n[['chien', 'niche', 'chine'], ['lion', 'loin'], ['noeud']]\n(149998, 149999)\n",
      hint: "Un dictionnaire valeur → premier indice vu ; pour chaque j, si cible − nums[j] y est, c'est la réponse. Pour les anagrammes, la clé est \"\".join(sorted(mot))."
    }
  },
  {
    id: "al-11", section: "Patterns d'algorithmes", title: "Deux pointeurs", xp: 100,
    theory: `<p>Sur un tableau <strong>trié</strong>, ou quand on compare des éléments des deux bouts, deux indices qui se rapprochent remplacent la double boucle : O(n) en temps, O(1) en mémoire.</p>
~~~py
def paire(nums, cible):          # nums trié
    g, d = 0, len(nums) - 1
    while g < d:
        s = nums[g] + nums[d]
        if s == cible:
            return nums[g], nums[d]
        if s < cible:
            g += 1                   # il faut plus grand
        else:
            d -= 1                   # il faut plus petit
    return None

print(paire([1, 3, 4, 6, 8, 11], 10))
~~~
<p>L'argument à donner en entretien : à chaque pas, on élimine une valeur qui ne peut faire partie d'aucune solution. Variantes : supprimer les doublons d'un tableau trié en place (un pointeur de lecture, un d'écriture), vérifier un palindrome, et le problème du <strong>plus grand réservoir</strong> : deux murs aux extrémités, on déplace toujours le plus bas, car garder le plus bas ne peut jamais donner mieux.</p>`,
    setup: LAB,
    quiz: [
      { q: "Pourquoi déplace-t-on le mur le plus bas dans le problème du réservoir ?", options: ["Au hasard", "La hauteur est limitée par le plus bas : en le gardant, toute largeur plus petite donnerait moins d'eau", "Pour aller plus vite", "Parce que le tableau est trié"], answer: 1, explain: "C'est l'argument d'élimination qui prouve que l'algorithme est correct." },
      { q: "Supprimer les doublons d'un tableau trié en O(1) de mémoire supplémentaire ?", options: ["Avec un set", "Avec un pointeur de lecture et un pointeur d'écriture", "En triant à nouveau", "Impossible"], answer: 1, explain: "On recopie chaque nouvelle valeur à la position d'écriture." }
    ],
    challenge: {
      prompt: `<p>Écris @@sans_doublons(nums)@@ qui retire <strong>en place</strong> les doublons d'une liste triée (les k premières cases contiennent les valeurs distinctes) et renvoie k, sans liste auxiliaire. Puis @@eau_max(hauteurs)@@ : l'aire maximale @@min(h[g], h[d]) × (d − g)@@ entre deux murs, en O(n).</p>`,
      starter: PY`def sans_doublons(nums):
    return len(set(nums))


def eau_max(hauteurs):
    return 0
`,
      solution: PY`def sans_doublons(nums):
    if not nums:
        return 0
    ecriture = 1
    for lecture in range(1, len(nums)):
        if nums[lecture] != nums[ecriture - 1]:
            nums[ecriture] = nums[lecture]
            ecriture += 1
    return ecriture


def eau_max(hauteurs):
    g, d, meilleur = 0, len(hauteurs) - 1, 0
    while g < d:
        meilleur = max(meilleur, min(hauteurs[g], hauteurs[d]) * (d - g))
        if hauteurs[g] < hauteurs[d]:
            g += 1
        else:
            d -= 1
    return meilleur
`,
      tests: PY`t = [1, 1, 2, 3, 3, 3, 7, 9, 9]
k = sans_doublons(t)
print(k, t[:k])
print(sans_doublons([]), sans_doublons([5]))
print(eau_max([1, 8, 6, 2, 5, 4, 8, 3, 7]), eau_max([1, 1]), eau_max([4, 3, 2, 1, 4]))
grand = list(range(1, 100_001))
print(eau_max(grand))
`,
      expected: "5 [1, 2, 3, 7, 9]\n0 1\n49 1 16\n2500000000\n",
      hint: "sans_doublons : un indice d'écriture ; recopie nums[lecture] quand il diffère de la dernière valeur écrite. eau_max : g = 0, d = fin ; calcule l'aire, puis avance le plus bas des deux."
    }
  },
  {
    id: "al-12", section: "Patterns d'algorithmes", title: "Fenêtre glissante", xp: 110,
    theory: `<p>Pour un problème sur des <strong>sous-tableaux ou sous-chaînes contigus</strong> (la plus longue, la plus courte, la somme maximale de taille k), on fait glisser une fenêtre @@[g, d]@@ : on étend à droite, et on réduit à gauche quand la fenêtre devient invalide. Chaque élément entre et sort au plus une fois : O(n).</p>
~~~py
def somme_max(nums, k):              # fenêtre de taille fixe
    s = sum(nums[:k])
    meilleure = s
    for d in range(k, len(nums)):
        s += nums[d] - nums[d - k]   # un entre, un sort
        meilleure = max(meilleure, s)
    return meilleure

print(somme_max([2, 1, 5, 1, 3, 2], 3))
~~~
<p>Fenêtre de taille variable, schéma type : un dictionnaire décrit le contenu de la fenêtre ; pour chaque @@d@@, on ajoute @@s[d]@@, puis tant que la fenêtre ne respecte plus la contrainte, on retire @@s[g]@@ et on avance @@g@@. Exemples : la plus longue sous-chaîne sans caractère répété, le plus petit sous-tableau de somme ≥ cible, les journaux d'un service sur les 5 dernières minutes.</p>`,
    setup: LAB,
    quiz: [
      { q: "Pourquoi la fenêtre glissante est-elle O(n) malgré la boucle while interne ?", options: ["Elle ne l'est pas", "Chaque indice entre une fois (avance de d) et sort au plus une fois (avance de g) : 2n opérations au total", "Grâce au dictionnaire", "Parce que k est petit"], answer: 1, explain: "C'est un raisonnement amorti, comme pour le tableau dynamique." },
      { q: "Quel indice signale un problème de fenêtre glissante ?", options: ["Le mot « contigu » ou « sous-chaîne », avec un maximum ou un minimum à trouver", "Un arbre", "Des intervalles", "Le mot « chemin »"], answer: 0, explain: "Pour des sous-ensembles non contigus, c'est plutôt du retour sur trace ou de la programmation dynamique." }
    ],
    challenge: {
      prompt: `<p>Écris @@plus_longue_sans_repetition(s)@@ (la longueur de la plus longue sous-chaîne sans caractère répété) et @@plus_court_sous_tableau(nums, cible)@@ (la longueur minimale d'un sous-tableau contigu de somme ≥ cible, nombres positifs ; 0 s'il n'y en a pas). Les deux en O(n).</p>`,
      starter: PY`def plus_longue_sans_repetition(s):
    return len(set(s))


def plus_court_sous_tableau(nums, cible):
    return 1
`,
      solution: PY`def plus_longue_sans_repetition(s):
    dernier, g, meilleur = {}, 0, 0
    for d, c in enumerate(s):
        if c in dernier and dernier[c] >= g:
            g = dernier[c] + 1
        dernier[c] = d
        meilleur = max(meilleur, d - g + 1)
    return meilleur


def plus_court_sous_tableau(nums, cible):
    g, somme, meilleur = 0, 0, None
    for d, x in enumerate(nums):
        somme += x
        while somme >= cible:
            longueur = d - g + 1
            meilleur = longueur if meilleur is None else min(meilleur, longueur)
            somme -= nums[g]
            g += 1
    return meilleur or 0
`,
      tests: PY`for s in ["abcabcbb", "bbbbb", "pwwkew", "", "dvdf", "kubernetes"]:
    print(repr(s), plus_longue_sans_repetition(s))
print(plus_court_sous_tableau([2, 3, 1, 2, 4, 3], 7), plus_court_sous_tableau([1, 4, 4], 4), plus_court_sous_tableau([1, 1, 1], 10))
import string
grande = (string.ascii_letters * 4000)[:200_000]
print(plus_longue_sans_repetition(grande), plus_court_sous_tableau([1] * 200_000, 150_000))
`,
      expected: "'abcabcbb' 3\n'bbbbb' 1\n'pwwkew' 3\n'' 0\n'dvdf' 3\n'kubernetes' 6\n2 1 0\n52 150000\n",
      hint: "Garde la dernière position de chaque caractère ; si le caractère courant a été vu dans la fenêtre (position ≥ g), avance g juste après. Pour la somme, étends à droite puis réduis à gauche tant que la somme atteint la cible."
    }
  },
  {
    id: "al-13", section: "Patterns d'algorithmes", title: "Recherche binaire", xp: 110,
    theory: `<p>Dans un tableau <strong>trié</strong>, on coupe l'intervalle en deux à chaque comparaison : O(log n). 30 comparaisons suffisent pour un milliard d'éléments. La version la plus utile n'est pas « trouver x » mais « trouver la <strong>première position</strong> où une condition devient vraie » :</p>
~~~py
def premiere_position(n, condition):
    """Plus petit i dans [0, n] tel que condition(i) soit vraie (condition monotone : faux…faux, vrai…vrai)."""
    g, d = 0, n
    while g < d:
        m = (g + d) // 2
        if condition(m):
            d = m          # m peut être la réponse
        else:
            g = m + 1      # la réponse est après m
    return g

notes = [2, 5, 5, 8, 13]
print(premiere_position(len(notes), lambda i: notes[i] >= 5), premiere_position(len(notes), lambda i: notes[i] > 13))
~~~
<p>On peut aussi chercher sur la <strong>réponse</strong> elle-même, dès que « la réponse convient » est monotone : la racine carrée entière, la plus petite capacité de camion pour tout livrer en k jours, le premier commit qui casse les tests (c'est exactement @@git bisect@@). Les pièges : les bornes (intervalle semi-ouvert @@[g, d)@@ ici), et une boucle infinie si @@g@@ n'avance pas.</p>`,
    setup: LAB,
    quiz: [
      { q: "Combien de comparaisons au plus pour chercher dans 1 000 000 d'éléments triés ?", options: ["1 000", "Environ 20", "1 000 000", "Environ 100"], answer: 1, explain: "2²⁰ ≈ 1 million." },
      { q: "Quel outil Git applique la recherche binaire ?", options: ["git log", "git bisect", "git blame", "git rebase"], answer: 1, explain: "Il coupe l'historique en deux jusqu'au premier commit fautif." }
    ],
    challenge: {
      prompt: `<p>Sans @@bisect@@, écris @@borne_inf(t, x)@@ (le premier indice @@i@@ tel que @@t[i] >= x@@ dans la liste triée @@t@@, ou @@len(t)@@) et @@racine_entiere(n)@@ (le plus grand entier r tel que r² ≤ n, pour n ≥ 0, par recherche binaire sur la réponse, sans @@math.isqrt@@ ni @@** 0.5@@).</p>`,
      starter: PY`def borne_inf(t, x):
    return 0


def racine_entiere(n):
    return n // 2
`,
      solution: PY`def borne_inf(t, x):
    g, d = 0, len(t)
    while g < d:
        m = (g + d) // 2
        if t[m] >= x:
            d = m
        else:
            g = m + 1
    return g


def racine_entiere(n):
    g, d = 0, n + 1
    while g < d:
        m = (g + d) // 2
        if m * m > n:
            d = m
        else:
            g = m + 1
    return g - 1
`,
      tests: PY`t = [2, 5, 5, 8, 13, 21]
print([borne_inf(t, x) for x in (1, 2, 5, 6, 21, 22)], borne_inf([], 3))
print([racine_entiere(n) for n in (0, 1, 2, 3, 4, 15, 16, 17, 99)])
print(racine_entiere(10**30), racine_entiere(10**30 - 1))
grand = list(range(0, 2_000_000, 2))
print(sum(borne_inf(grand, x) for x in range(0, 200_000, 7)))
`,
      expected: "[0, 0, 1, 3, 5, 6] 0\n[0, 1, 1, 1, 2, 3, 4, 4, 9]\n1000000000000000 999999999999999\n1428585714\n",
      hint: "Intervalle [g, d) : tant que g < d, m = (g + d) // 2 ; si la condition est vraie en m, d = m, sinon g = m + 1. Pour la racine, la condition est m × m > n, et la réponse est g − 1."
    }
  },
  {
    id: "al-14", section: "Patterns d'algorithmes", title: "Pile monotone", xp: 110,
    theory: `<p>Pour chaque élément, trouver le <strong>prochain élément plus grand</strong> (ou plus petit) : la double boucle est O(n²). Une pile qui garde des indices dans l'ordre décroissant de leurs valeurs le fait en O(n) : quand une valeur plus grande arrive, elle « répond » à tous les éléments plus petits du sommet de la pile, qu'on dépile.</p>
~~~py
temperatures = [21, 19, 23, 22, 18, 25]
attente = [0] * len(temperatures)
pile = []                                  # indices, températures décroissantes
for i, t in enumerate(temperatures):
    while pile and temperatures[pile[-1]] < t:
        j = pile.pop()
        attente[j] = i - j                 # jours avant une journée plus chaude
    pile.append(i)
print(attente)
~~~
<p>Chaque indice est empilé et dépilé au plus une fois : O(n). Le même schéma résout le plus grand rectangle dans un histogramme, les cours de bourse (« depuis combien de jours le prix est-il le plus haut ? ») et la suppression de chiffres pour obtenir le plus petit nombre.</p>`,
    setup: LAB,
    quiz: [
      { q: "Pourquoi la pile monotone est-elle O(n) ?", options: ["Parce qu'elle est courte", "Chaque indice est empilé une fois et dépilé au plus une fois", "Grâce au tri", "Elle ne l'est pas"], answer: 1, explain: "Même raisonnement amorti que la fenêtre glissante." },
      { q: "Que contient la pile à la fin du parcours ?", options: ["Rien", "Les indices sans élément plus grand à leur droite", "Les plus grands éléments triés", "Le maximum seul"], answer: 1, explain: "Leur réponse reste la valeur par défaut (0 ou -1)." }
    ],
    challenge: {
      prompt: `<p>Écris @@prochain_plus_grand(nums)@@ : pour chaque position, la valeur du prochain élément strictement plus grand à sa droite, ou -1. Puis @@jours_depuis_record(prix)@@ : pour chaque jour, le nombre de jours consécutifs (en comptant ce jour) où le prix a été inférieur ou égal au prix du jour, en remontant dans le passé. Les deux en O(n).</p>`,
      starter: PY`def prochain_plus_grand(nums):
    return [-1] * len(nums)


def jours_depuis_record(prix):
    return [1] * len(prix)
`,
      solution: PY`def prochain_plus_grand(nums):
    reponse, pile = [-1] * len(nums), []
    for i, x in enumerate(nums):
        while pile and nums[pile[-1]] < x:
            reponse[pile.pop()] = x
        pile.append(i)
    return reponse


def jours_depuis_record(prix):
    reponse, pile = [], []
    for i, p in enumerate(prix):
        while pile and prix[pile[-1]] <= p:
            pile.pop()
        reponse.append(i + 1 if not pile else i - pile[-1])
        pile.append(i)
    return reponse
`,
      tests: PY`print(prochain_plus_grand([2, 1, 2, 4, 3]), prochain_plus_grand([]), prochain_plus_grand([5, 4, 3]))
print(jours_depuis_record([100, 80, 60, 70, 60, 75, 85]))
grand = list(range(200_000, 0, -1)) + [10**9]
print(prochain_plus_grand(grand)[:2], jours_depuis_record(grand)[-1])
`,
      expected: "[4, 2, 4, -1, -1] [] [-1, -1, -1]\n[1, 1, 1, 2, 1, 4, 6]\n[1000000000, 1000000000] 200001\n",
      hint: "Garde une pile d'indices. Pour le prochain plus grand, dépile tant que la valeur du sommet est plus petite que x et donne-lui x. Pour les jours, dépile tant que le prix du sommet est ≤ p ; la réponse est i − sommet (ou i + 1 si la pile est vide)."
    }
  },
  {
    id: "al-15", section: "Patterns d'algorithmes", title: "Parcours en profondeur et tri topologique", xp: 120,
    theory: `<p>Le <strong>parcours en profondeur</strong> (DFS) explore une branche jusqu'au bout avant de revenir. Avec une pile explicite (ou la récursion, si la profondeur reste faible), il compte les composantes, détecte les cycles, et explore les grilles : nombre d'îles, zones à remplir, labyrinthes.</p>
<p>Le <strong>tri topologique</strong> ordonne des tâches qui dépendent les unes des autres : l'ordre d'installation de paquets, l'ordre des jobs d'un pipeline CI (@@needs@@), l'ordre de création de ressources Terraform. Algorithme de Kahn : compter les dépendances entrantes de chaque tâche, partir de celles qui n'en ont aucune, et « libérer » leurs successeurs. S'il reste des tâches à la fin, il y a un cycle.</p>
~~~py
from collections import deque

needs = {"build": [], "test": ["build"], "lint": [], "deploy": ["test", "lint"]}
restant = {t: len(d) for t, d in needs.items()}
suivants = {t: [] for t in needs}
for t, deps in needs.items():
    for d in deps:
        suivants[d].append(t)
file, ordre = deque(t for t in needs if restant[t] == 0), []
while file:
    t = file.popleft()
    ordre.append(t)
    for s in suivants[t]:
        restant[s] -= 1
        if restant[s] == 0:
            file.append(s)
print(ordre)
~~~`,
    setup: LAB,
    quiz: [
      { q: "Le tri topologique de Kahn se termine avec des tâches non traitées. Que signifie-t-il ?", options: ["Un bogue de l'algorithme", "Le graphe des dépendances contient un cycle", "Des tâches indépendantes", "Il faut un DFS"], answer: 1, explain: "Dans un cycle, aucune tâche n'atteint zéro dépendance restante." },
      { q: "Pourquoi éviter la récursion pour un DFS sur une grille de 1000 × 1000 en Python ?", options: ["C'est plus lent", "La profondeur peut atteindre un million : RecursionError ; une pile explicite n'a pas de limite", "La récursion est interdite", "Pour économiser des lignes"], answer: 1, explain: "La limite par défaut de Python est d'environ 1 000 appels imbriqués." }
    ],
    challenge: {
      prompt: `<p>Écris @@nb_iles(grille)@@ : la grille est une liste de chaînes de @@"#"@@ (terre) et @@"."@@ (eau) ; compte les îles (terre reliée horizontalement ou verticalement), avec une pile explicite. Puis @@ordre_installation(dependances)@@ : @@dependances@@ associe à chaque paquet la liste des paquets dont il dépend ; renvoie un ordre d'installation par l'algorithme de Kahn, en traitant les paquets disponibles <strong>par ordre alphabétique</strong> (utilise un tas), ou @@None@@ s'il y a un cycle.</p>`,
      starter: PY`def nb_iles(grille):
    return sum(ligne.count("#") for ligne in grille)


def ordre_installation(dependances):
    return sorted(dependances)
`,
      solution: PY`import heapq


def nb_iles(grille):
    if not grille:
        return 0
    h, l = len(grille), len(grille[0])
    vus, iles = set(), 0
    for i in range(h):
        for j in range(l):
            if grille[i][j] != "#" or (i, j) in vus:
                continue
            iles += 1
            vus.add((i, j))
            pile = [(i, j)]
            while pile:
                a, b = pile.pop()
                for x, y in ((a + 1, b), (a - 1, b), (a, b + 1), (a, b - 1)):
                    if 0 <= x < h and 0 <= y < l and grille[x][y] == "#" and (x, y) not in vus:
                        vus.add((x, y))
                        pile.append((x, y))
    return iles


def ordre_installation(dependances):
    restant = {p: len(d) for p, d in dependances.items()}
    suivants = {p: [] for p in dependances}
    for p, deps in dependances.items():
        for d in deps:
            suivants[d].append(p)
    prets = [p for p, n in restant.items() if n == 0]
    heapq.heapify(prets)
    ordre = []
    while prets:
        p = heapq.heappop(prets)
        ordre.append(p)
        for s in suivants[p]:
            restant[s] -= 1
            if restant[s] == 0:
                heapq.heappush(prets, s)
    return ordre if len(ordre) == len(dependances) else None
`,
      tests: PY`carte = ["##..#",
         "#...#",
         "..#..",
         "....#",
         "##.##"]
print(nb_iles(carte), nb_iles([]), nb_iles(["...", "..."]))
deps = {"app": ["flask", "requests"], "flask": ["werkzeug", "jinja2"], "jinja2": ["markupsafe"],
        "requests": ["urllib3", "idna"], "werkzeug": ["markupsafe"], "markupsafe": [], "urllib3": [], "idna": []}
print(ordre_installation(deps))
print(ordre_installation({"a": ["b"], "b": ["c"], "c": ["a"], "d": []}))
grande = ["#" * 400 for _ in range(400)]
print(nb_iles(grande), nb_iles(["#." * 200 if i % 2 == 0 else "." * 400 for i in range(400)]))
`,
      expected: "5 0 0\n['idna', 'markupsafe', 'jinja2', 'urllib3', 'requests', 'werkzeug', 'flask', 'app']\nNone\n1 40000\n",
      hint: "Îles : pour chaque case de terre pas encore vue, compte une île et marque toute sa terre reliée avec une pile. Kahn : compte les dépendances restantes, un tas des paquets à zéro ; en sortir un libère ses successeurs. Si l'ordre ne contient pas tous les paquets, il y a un cycle."
    }
  },
  {
    id: "al-16", section: "Patterns d'algorithmes", title: "Tas : top-k et fusion", xp: 110,
    theory: `<p>Dès qu'un énoncé dit « les k plus… », « le k-ième », « fusionner des flux triés » ou « toujours traiter le plus urgent », pense <strong>tas</strong>. En Python, @@heapq@@ fournit un tas min sur une liste ; pour un tas max, on stocke les valeurs opposées, et les tuples se comparent élément par élément (priorité d'abord, puis départage).</p>
~~~py
import heapq

flux = [[1, 4, 9], [2, 3, 10], [5, 6]]
tas = [(l[0], i, 0) for i, l in enumerate(flux)]      # (valeur, n° de liste, position)
heapq.heapify(tas)
fusion = []
while tas:
    v, i, j = heapq.heappop(tas)
    fusion.append(v)
    if j + 1 < len(flux[i]):
        heapq.heappush(tas, (flux[i][j + 1], i, j + 1))
print(fusion)
~~~
<p>Complexités : top-k sur n éléments en O(n log k) ; fusion de k listes de n éléments au total en O(n log k). C'est aussi le cœur de l'algorithme de Dijkstra (plus court chemin avec des poids), des ordonnanceurs et des systèmes qui agrègent les journaux de centaines de serveurs triés par date.</p>`,
    setup: LAB,
    quiz: [
      { q: "Comment obtenir un tas max avec heapq ?", options: ["heapq.maxheap()", "En stockant l'opposé des valeurs (ou des tuples avec la priorité négative)", "En triant à l'envers", "Impossible"], answer: 1, explain: "heapq n'offre qu'un tas min." },
      { q: "Fusionner les journaux triés de 100 serveurs, 1 milliard de lignes au total : complexité ?", options: ["O(n log n) en triant tout", "O(n log 100) avec un tas de 100 éléments, en flux", "O(n²)", "O(100)"], answer: 1, explain: "On ne garde en mémoire qu'une ligne par serveur." }
    ],
    challenge: {
      prompt: `<p>Avec @@heapq@@, écris @@k_plus_frequents(mots, k)@@ : les k mots les plus fréquents, par fréquence décroissante puis ordre alphabétique en cas d'égalité, en O(n log k) (un tas de taille k, pas de tri complet). Puis @@fusionner(listes)@@ : fusionne des listes triées en une seule liste triée.</p>`,
      starter: PY`import heapq


def k_plus_frequents(mots, k):
    return mots[:k]


def fusionner(listes):
    return [x for l in listes for x in l]
`,
      solution: PY`import heapq
from collections import Counter


class _Entree:
    """Ordre « moins bon d'abord » pour le tas min : fréquence plus faible, puis mot plus loin dans l'alphabet."""
    __slots__ = ("n", "mot")

    def __init__(self, n, mot):
        self.n, self.mot = n, mot

    def __lt__(self, autre):
        return self.n < autre.n or (self.n == autre.n and self.mot > autre.mot)


def k_plus_frequents(mots, k):
    tas = []
    for mot, n in Counter(mots).items():
        heapq.heappush(tas, _Entree(n, mot))
        if len(tas) > k:
            heapq.heappop(tas)
    out = []
    while tas:
        out.append(heapq.heappop(tas).mot)
    return out[::-1]


def fusionner(listes):
    tas = [(l[0], i, 0) for i, l in enumerate(listes) if l]
    heapq.heapify(tas)
    out = []
    while tas:
        v, i, j = heapq.heappop(tas)
        out.append(v)
        if j + 1 < len(listes[i]):
            heapq.heappush(tas, (listes[i][j + 1], i, j + 1))
    return out
`,
      tests: PY`journal = "erreur avertissement info info erreur debug info erreur alerte info".split()
print(k_plus_frequents(journal, 2), k_plus_frequents(journal, 4), k_plus_frequents([], 3))
print(fusionner([[1, 4, 9], [2, 3, 10], [], [5, 6]]), fusionner([]))
import random
random.seed(3)
listes = [sorted(random.randint(0, 10**6) for _ in range(5000)) for _ in range(40)]
f = fusionner(listes)
print(len(f), f == sorted(x for l in listes for x in l))
mots = [f"m{random.randint(0, 5000)}" for _ in range(200_000)]
print(k_plus_frequents(mots, 3) == [m for m, _ in sorted(Counter(mots).items(), key=lambda p: (-p[1], p[0]))[:3]])
`,
      expected: "['info', 'erreur'] ['info', 'erreur', 'alerte', 'avertissement'] []\n[1, 2, 3, 4, 5, 6, 9, 10] []\n200000 True\nTrue\n",
      hint: "Compte avec Counter, puis garde un tas min de taille k dont la racine est le « moins bon » (fréquence la plus faible, puis mot le plus loin dans l'alphabet). Pour fusionner, un tas de tuples (valeur, n° de liste, position)."
    }
  },
  {
    id: "al-17", section: "Patterns d'algorithmes", title: "Intervalles", xp: 100,
    theory: `<p>Créneaux de réunion, plages d'adresses IP, périodes de maintenance, fenêtres d'astreinte : les problèmes d'<strong>intervalles</strong> commencent presque toujours par un <strong>tri par début</strong>, O(n log n), puis un seul parcours.</p>
~~~py
creneaux = [(9, 10), (14, 16), (9.5, 11), (15, 17), (18, 19)]
fusion = []
for debut, fin in sorted(creneaux):
    if fusion and debut <= fusion[-1][1]:            # chevauche le dernier
        fusion[-1] = (fusion[-1][0], max(fusion[-1][1], fin))
    else:
        fusion.append((debut, fin))
print(fusion)
~~~
<p>Autre classique : le nombre minimal de <strong>salles</strong> pour tenir toutes les réunions, soit le maximum de réunions simultanées. On trie les débuts et les fins séparément, et on balaie le temps : un début ajoute une salle, une fin en libère une (si une réunion finit exactement quand une autre commence, la salle se libère d'abord). Même idée pour dimensionner un pool de connexions ou compter les instances nécessaires au pic de charge.</p>`,
    setup: LAB,
    quiz: [
      { q: "Pourquoi trier les intervalles par début avant de les fusionner ?", options: ["Par habitude", "Après le tri, un intervalle ne peut chevaucher que le dernier intervalle fusionné : un seul parcours suffit", "Pour l'affichage", "Ce n'est pas nécessaire"], answer: 1, explain: "Sans tri, il faudrait comparer chaque paire : O(n²)." },
      { q: "Réunions [1, 3) et [3, 5) : combien de salles ?", options: ["2", "1, car la première finit quand la seconde commence", "0", "3"], answer: 1, explain: "D'où la règle : traiter les fins avant les débuts au même instant." }
    ],
    challenge: {
      prompt: `<p>Écris @@fusionner_intervalles(intervalles)@@ (liste de couples @@(debut, fin)@@ ; renvoie les intervalles fusionnés, triés ; deux intervalles qui se touchent, comme (1, 3) et (3, 5), fusionnent) et @@salles_min(reunions)@@ : le nombre minimal de salles pour des réunions @@[debut, fin)@@ (une salle libérée à l'instant t peut resservir à t).</p>`,
      starter: PY`def fusionner_intervalles(intervalles):
    return sorted(intervalles)


def salles_min(reunions):
    return len(reunions)
`,
      solution: PY`def fusionner_intervalles(intervalles):
    fusion = []
    for debut, fin in sorted(intervalles):
        if fusion and debut <= fusion[-1][1]:
            fusion[-1] = (fusion[-1][0], max(fusion[-1][1], fin))
        else:
            fusion.append((debut, fin))
    return fusion


def salles_min(reunions):
    evenements = sorted([(f, -1) for _, f in reunions] + [(d, 1) for d, _ in reunions])
    courant = maximum = 0
    for _, delta in evenements:
        courant += delta
        maximum = max(maximum, courant)
    return maximum
`,
      tests: PY`print(fusionner_intervalles([(1, 3), (2, 6), (8, 10), (15, 18)]))
print(fusionner_intervalles([(1, 4), (4, 5)]), fusionner_intervalles([(5, 7), (1, 2), (1, 10)]), fusionner_intervalles([]))
print(salles_min([(0, 30), (5, 10), (15, 20)]), salles_min([(1, 3), (3, 5)]), salles_min([(9, 12), (9, 10), (10, 11), (11, 12)]), salles_min([]))
grand = [(i, i + 10) for i in range(0, 300_000, 3)]
print(len(fusionner_intervalles(grand)), salles_min(grand))
`,
      expected: "[(1, 6), (8, 10), (15, 18)]\n[(1, 5)] [(1, 10)] []\n2 1 2 0\n1 4\n",
      hint: "Fusion : trie, puis compare chaque début à la fin du dernier intervalle fusionné. Salles : une liste d'événements (fin, −1) et (début, +1) triée ; le tri place −1 avant +1 au même instant ; garde le maximum du compteur."
    }
  },
  {
    id: "al-18", section: "Patterns d'algorithmes", title: "Retour sur trace", xp: 120,
    theory: `<p>Quand il faut <strong>énumérer</strong> des solutions (tous les sous-ensembles, les permutations, les combinaisons qui atteignent une somme, les placements valides sur un plateau), on construit la solution pas à pas, et on <strong>revient en arrière</strong> dès qu'un choix ne peut plus mener à rien. Le schéma :</p>
~~~py
def sous_ensembles(elements):
    resultats, courant = [], []
    def explorer(i):
        if i == len(elements):
            resultats.append(courant[:])        # une copie : courant va changer
            return
        courant.append(elements[i])             # choisir elements[i]
        explorer(i + 1)
        courant.pop()                           # annuler le choix
        explorer(i + 1)                         # ne pas le choisir
    explorer(0)
    return resultats

print(sous_ensembles(["a", "b", "c"]))
~~~
<p>La complexité est exponentielle par nature (2ⁿ sous-ensembles, n! permutations) : tout l'art est d'<strong>élaguer</strong> tôt. Si les candidats sont triés et que la somme partielle dépasse déjà la cible, inutile d'essayer les candidats suivants. En entretien, annonce la complexité dans le pire cas, puis l'élagage.</p>`,
    setup: LAB,
    quiz: [
      { q: "Combien de permutations de 10 éléments ?", options: ["100", "1 024", "3 628 800", "10 000"], answer: 2, explain: "10! : d'où l'importance de l'élagage." },
      { q: "Pourquoi ajouter courant[:] et pas courant aux résultats ?", options: ["Pour trier", "courant est modifié ensuite : sans copie, tous les résultats pointeraient vers la même liste, vide à la fin", "Pour aller plus vite", "C'est pareil"], answer: 1, explain: "L'erreur la plus fréquente sur ce pattern en Python." }
    ],
    challenge: {
      prompt: `<p>Écris @@combinaisons(candidats, cible)@@ : toutes les combinaisons de nombres de @@candidats@@ (entiers positifs distincts, chacun réutilisable autant de fois qu'on veut) dont la somme vaut @@cible@@. Chaque combinaison est une liste croissante, et les combinaisons sont renvoyées dans l'ordre lexicographique. Élague : arrête d'essayer des candidats dès qu'un candidat dépasse le reste à atteindre.</p>`,
      starter: PY`def combinaisons(candidats, cible):
    return [[c] for c in candidats if c == cible]
`,
      solution: PY`def combinaisons(candidats, cible):
    candidats = sorted(candidats)
    resultats, courant = [], []

    def explorer(debut, reste):
        if reste == 0:
            resultats.append(courant[:])
            return
        for i in range(debut, len(candidats)):
            c = candidats[i]
            if c > reste:
                break
            courant.append(c)
            explorer(i, reste - c)
            courant.pop()

    explorer(0, cible)
    return resultats
`,
      tests: PY`print(combinaisons([2, 3, 6, 7], 7))
print(combinaisons([3, 5, 2], 8))
print(combinaisons([2], 1), combinaisons([7], 7))
r = combinaisons([2, 3, 5, 7, 11, 13], 40)
print(len(r), r[0], r[-1])
`,
      expected: "[[2, 2, 3], [7]]\n[[2, 2, 2, 2], [2, 3, 3], [3, 5]]\n[] [[7]]\n206 [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2] [7, 11, 11, 11]\n",
      hint: "Trie les candidats. explorer(debut, reste) : si reste vaut 0, ajoute une copie ; sinon, pour i depuis debut, arrête si candidats[i] > reste, sinon ajoute-le, explore (i, reste − c) pour pouvoir le réutiliser, puis retire-le."
    }
  },
  {
    id: "al-19", section: "Patterns d'algorithmes", title: "Programmation dynamique", xp: 140,
    theory: `<p>Quand un problème se découpe en <strong>sous-problèmes qui se répètent</strong>, on calcule chacun une seule fois et on le range dans un tableau. Les signes : « nombre de façons de… », « minimum / maximum de… », « est-il possible de… », avec des choix à chaque étape. Méthode en quatre temps :</p>
<ol><li>définir l'état : @@dp[i]@@ = la réponse pour les @@i@@ premiers éléments, ou pour un montant @@i@@ ;</li><li>écrire la transition : comment @@dp[i]@@ se déduit des états précédents ;</li><li>fixer les cas de base ;</li><li>choisir l'ordre de calcul (du plus petit au plus grand).</li></ol>
~~~py
def nb_facons(n):                  # monter n marches par pas de 1 ou 2
    dp = [0] * (n + 1)
    dp[0] = 1
    for i in range(1, n + 1):
        dp[i] = dp[i - 1] + (dp[i - 2] if i >= 2 else 0)
    return dp[n]

print([nb_facons(n) for n in range(1, 8)])   # la suite de Fibonacci
~~~
<p>Deux classiques à savoir écrire de mémoire : le <strong>rendu de monnaie</strong> (@@dp[m]@@ = nombre minimal de pièces pour le montant m, en essayant chaque pièce comme dernière) et la <strong>plus longue sous-séquence commune</strong> de deux chaînes (tableau 2D, base de @@diff@@ et de @@git diff@@). On peut souvent réduire la mémoire en ne gardant que la ligne précédente.</p>`,
    setup: LAB,
    quiz: [
      { q: "Pièces 1, 3, 4 et montant 6 : que donne l'algorithme glouton (la plus grosse pièce d'abord) ?", options: ["2 pièces (3 + 3), l'optimum", "3 pièces (4 + 1 + 1), alors que 2 suffisent : d'où la programmation dynamique", "1 pièce", "Il échoue"], answer: 1, explain: "Le glouton n'est optimal que pour certains systèmes de pièces." },
      { q: "Complexité de la plus longue sous-séquence commune de deux chaînes de longueurs m et n ?", options: ["O(m + n)", "O(m × n)", "O(2^(m+n))", "O(m log n)"], answer: 1, explain: "Une case du tableau par paire de préfixes." }
    ],
    challenge: {
      prompt: `<p>Écris @@rendu_monnaie(pieces, montant)@@ (le nombre minimal de pièces pour atteindre exactement le montant, chaque pièce utilisable sans limite ; -1 si impossible) et @@plus_longue_sous_sequence_commune(a, b)@@ (sa longueur), les deux par programmation dynamique.</p>`,
      starter: PY`def rendu_monnaie(pieces, montant):
    n = 0
    for p in sorted(pieces, reverse=True):
        n += montant // p
        montant %= p
    return n


def plus_longue_sous_sequence_commune(a, b):
    return len(set(a) & set(b))
`,
      solution: PY`def rendu_monnaie(pieces, montant):
    infini = montant + 1
    dp = [0] + [infini] * montant
    for m in range(1, montant + 1):
        for p in pieces:
            if p <= m and dp[m - p] + 1 < dp[m]:
                dp[m] = dp[m - p] + 1
    return dp[montant] if dp[montant] <= montant else -1


def plus_longue_sous_sequence_commune(a, b):
    precedente = [0] * (len(b) + 1)
    for x in a:
        ligne = [0]
        for j, y in enumerate(b, 1):
            ligne.append(precedente[j - 1] + 1 if x == y else max(precedente[j], ligne[j - 1]))
        precedente = ligne
    return precedente[-1]
`,
      tests: PY`print(rendu_monnaie([1, 3, 4], 6), rendu_monnaie([1, 2, 5], 11), rendu_monnaie([2], 3), rendu_monnaie([1], 0))
print(rendu_monnaie([186, 419, 83, 408], 6249), rendu_monnaie([7, 13], 5000))
print(plus_longue_sous_sequence_commune("abcde", "ace"), plus_longue_sous_sequence_commune("kubernetes", "terraform"), plus_longue_sous_sequence_commune("", "abc"))
print(plus_longue_sous_sequence_commune("ACGT" * 150, "GATTACA" * 80))
`,
      expected: "2 3 -1 0\n20 386\n3 2 0\n389\n",
      hint: "Monnaie : dp[0] = 0 et dp[m] = 1 + min(dp[m − p]) sur les pièces p ≤ m ; un grand nombre sert d'infini. Sous-séquence : si x == y, diagonale + 1, sinon max(haut, gauche) ; une seule ligne précédente suffit."
    }
  },
  {
    id: "al-20", section: "Entretien", title: "Mener un entretien de code", xp: 60, theoryOnly: true,
    theory: `<p>Un entretien de code évalue autant la <strong>démarche</strong> que la solution. Le déroulé qui rassure un recruteur, en 45 minutes :</p>
~~~text
1. Reformuler      redire le problème, poser les questions : taille des entrées ? doublons ? négatifs ? trié ?
2. Exemples        dérouler un petit exemple à la main, et un cas limite (vide, un élément, tout identique)
3. Force brute     l'annoncer avec sa complexité, même sans la coder : c'est une base
4. Optimiser       chercher le pattern (hachage, deux pointeurs, fenêtre, tas, DP…) et annoncer la nouvelle complexité
5. Coder           proprement, en parlant ; des noms clairs ; pas d'optimisation prématurée
6. Tester          dérouler le code sur l'exemple, puis les cas limites ; corriger à voix haute
7. Conclure        complexité finale en temps et en mémoire, pistes d'amélioration
~~~
<div class="qa">
<details><summary>Comment reconnaître le bon pattern ?</summary><p>Tableau trié ou paires : deux pointeurs ou recherche binaire. Sous-tableau contigu : fenêtre glissante. « Déjà vu », compter, regrouper : hachage. k plus grands, flux triés : tas. Dépendances, chemins : graphes (BFS, DFS, tri topologique). Toutes les solutions : retour sur trace. Optimum avec des choix qui se répètent : programmation dynamique.</p></details>
<details><summary>Je bloque. Que faire ?</summary><p>Le dire, puis revenir à la force brute et à un petit exemple. Chercher ce qui se répète dans le calcul. Demander un indice n'élimine pas : rester silencieux, si.</p></details>
<details><summary>Quelles questions poser au début ?</summary><p>Les bornes (n jusqu'à combien ? valeurs négatives ? très grandes ?), le format de sortie, le comportement attendu sur une entrée vide ou invalide, s'il faut optimiser le temps ou la mémoire.</p></details>
<details><summary>Comment parler de complexité ?</summary><p>Toujours les deux : temps et mémoire, dans le pire cas, en justifiant en une phrase (« chaque élément entre et sort une fois de la pile »).</p></details>
</div>`,
    practice: { title: "S'entraîner", body: `<p>Fais un entretien blanc chronométré à deux : l'un pose un problème de ce chapitre, l'autre le résout au tableau en suivant les sept étapes, à voix haute, en 35 minutes. Inversez. Ensuite, entraîne-toi sur la liste « NeetCode 150 », regroupée par pattern, en notant pour chaque problème le pattern reconnu et la complexité.</p>` },
    quiz: [
      { q: "Au début d'un entretien de code, que faire avant de coder ?", options: ["Coder tout de suite pour gagner du temps", "Reformuler, poser des questions sur les entrées, dérouler un exemple et annoncer une première approche avec sa complexité", "Demander la solution", "Écrire les tests unitaires"], answer: 1, explain: "Les recruteurs évaluent la démarche et la communication autant que le code." },
      { q: "Un problème demande « le nombre de façons d'atteindre n avec des pas de 1, 2 ou 3 ». Quel pattern ?", options: ["Deux pointeurs", "Programmation dynamique", "Tas", "Fenêtre glissante"], answer: 1, explain: "dp[i] = dp[i − 1] + dp[i − 2] + dp[i − 3]." }
    ]
  }
];
