/* Défis gradués du cours Python : un défi « moyen » par leçon, un cran au-dessus du défi principal
   (format : README, « defis »). */
const R = String.raw;

export default {
  "py-04": [{
    niveau: "moyen",
    prompt: R`<p>Écris @@bissextile(annee)@@ : vrai si l'année est bissextile. Règle du calendrier grégorien : divisible par 4, sauf les siècles (divisibles par 100), sauf ceux divisibles par 400. 2000 est bissextile, 1900 ne l'est pas.</p>`,
    starter: "def bissextile(annee):\n    return annee % 4 == 0\n",
    solution: R`def bissextile(annee):
    if annee % 400 == 0:
        return True
    if annee % 100 == 0:
        return False
    return annee % 4 == 0
`,
    tests: R`print([bissextile(a) for a in [1900, 2000, 2024, 2023, 2100, 2400]])`,
    expected: "[False, True, True, False, False, True]",
    hints: ["Teste les cas du plus particulier au plus général.", "D'abord % 400 (bissextile), puis % 100 (pas bissextile), enfin % 4."]
  }],
  "py-05": [{
    niveau: "moyen",
    prompt: R`<p>Affiche les nombres de 1 à 15, un par ligne, en remplaçant les multiples de 3 par @@Fizz@@, ceux de 5 par @@Buzz@@ et ceux de 15 par @@FizzBuzz@@.</p>`,
    starter: "for i in range(1, 16):\n    print(i)\n",
    solution: R`for i in range(1, 16):
    if i % 15 == 0:
        print("FizzBuzz")
    elif i % 3 == 0:
        print("Fizz")
    elif i % 5 == 0:
        print("Buzz")
    else:
        print(i)
`,
    expected: "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz",
    hints: ["Une boucle for sur range(1, 16) et une chaîne if / elif / else.", "Teste 15 en premier : un multiple de 15 est aussi multiple de 3, et elif s'arrête à la première condition vraie."]
  }],
  "py-06": [{
    niveau: "moyen",
    prompt: R`<p>Écris @@racine_numerique(n)@@ : additionne les chiffres de @@n@@, puis recommence sur le résultat, tant qu'il a plus d'un chiffre. 9875 → 29 → 11 → 2. Utilise @@while@@, @@% 10@@ et @@// 10@@, sans convertir en chaîne.</p>`,
    starter: "def racine_numerique(n):\n    return n % 10\n",
    solution: R`def racine_numerique(n):
    while n >= 10:
        somme = 0
        while n > 0:
            somme += n % 10
            n //= 10
        n = somme
    return n
`,
    tests: R`print([racine_numerique(n) for n in [9875, 0, 9, 38, 123456789]])`,
    expected: "[2, 0, 9, 2, 9]",
    hints: ["n % 10 donne le dernier chiffre, n // 10 retire ce chiffre.", "Une boucle intérieure additionne les chiffres ; une boucle extérieure recommence tant que n ≥ 10."]
  }],
  "py-07": [{
    niveau: "moyen",
    prompt: R`<p>Écris @@deuxieme_plus_grand(nums)@@ : la deuxième plus grande valeur <em>distincte</em> de la liste, ou @@None@@ s'il n'y en a pas. @@[3, 9, 9, 4]@@ donne 4.</p>`,
    starter: "def deuxieme_plus_grand(nums):\n    return sorted(nums)[-2]\n",
    solution: R`def deuxieme_plus_grand(nums):
    distinctes = sorted(set(nums))
    if len(distinctes) < 2:
        return None
    return distinctes[-2]
`,
    tests: R`print(deuxieme_plus_grand([3, 9, 9, 4]), deuxieme_plus_grand([5, 5]), deuxieme_plus_grand([1, 2]), deuxieme_plus_grand([-3, -1, -2]), deuxieme_plus_grand([]))`,
    expected: "4 None 1 -2 None",
    hints: ["set() retire les doublons.", "Trie les valeurs distinctes ; s'il en reste moins de deux, renvoie None, sinon l'avant-dernière."]
  }],
  "py-08": [{
    niveau: "moyen",
    prompt: R`<p>Écris @@inverser(d)@@ : un nouveau dictionnaire qui associe chaque valeur de @@d@@ à la liste triée des clés qui la portaient. @@{"a": 1, "b": 2, "c": 1}@@ donne @@{1: ["a", "c"], 2: ["b"]}@@.</p>`,
    starter: "def inverser(d):\n    return {v: k for k, v in d.items()}\n",
    solution: R`def inverser(d):
    res = {}
    for cle, valeur in d.items():
        res.setdefault(valeur, []).append(cle)
    for valeur in res:
        res[valeur].sort()
    return res
`,
    tests: R`print(inverser({"a": 1, "b": 2, "c": 1}))
print(inverser({"web-02": "eu", "db-01": "us", "web-01": "eu"}), inverser({}))`,
    expected: "{1: ['a', 'c'], 2: ['b']}\n{'eu': ['web-01', 'web-02'], 'us': ['db-01']} {}",
    hints: ["Plusieurs clés peuvent porter la même valeur : chaque valeur doit pointer vers une liste.", "setdefault(valeur, []) crée la liste au premier passage ; trie chaque liste à la fin."]
  }],
  "py-09": [{
    niveau: "moyen",
    prompt: R`<p>Écris @@pgcd(a, b)@@ avec l'algorithme d'Euclide (tant que @@b@@ n'est pas nul, @@(a, b)@@ devient @@(b, a % b)@@), puis @@ppcm(a, b)@@ qui utilise @@pgcd@@. Sans @@math.gcd@@.</p>`,
    starter: "def pgcd(a, b):\n    return 1\n\n\ndef ppcm(a, b):\n    return a * b\n",
    solution: R`def pgcd(a, b):
    while b:
        a, b = b, a % b
    return a


def ppcm(a, b):
    return a * b // pgcd(a, b)
`,
    tests: R`print(pgcd(48, 18), pgcd(17, 5), pgcd(0, 9), pgcd(9, 0))
print(ppcm(4, 6), ppcm(21, 6), ppcm(7, 7))`,
    expected: "6 1 9 9\n12 42 7",
    hints: ["Une boucle while b : à chaque tour, a, b = b, a % b. Quand b vaut 0, a est le PGCD.", "ppcm(a, b) = a × b / pgcd(a, b), en division entière."]
  }],
  "py-10": [{
    niveau: "moyen",
    prompt: R`<p>Écris @@transposer(m)@@ : la transposée d'une matrice (liste de lignes de même longueur), avec une compréhension imbriquée. @@[[1, 2, 3], [4, 5, 6]]@@ donne @@[[1, 4], [2, 5], [3, 6]]@@.</p>`,
    starter: "def transposer(m):\n    return m\n",
    solution: R`def transposer(m):
    if not m:
        return []
    return [[ligne[j] for ligne in m] for j in range(len(m[0]))]
`,
    tests: R`print(transposer([[1, 2, 3], [4, 5, 6]]), transposer([[7]]), transposer([]))`,
    expected: "[[1, 4], [2, 5], [3, 6]] [[7]] []",
    hints: ["La ligne j de la transposée est la colonne j de m.", "[[ligne[j] for ligne in m] for j in range(len(m[0]))], et un cas à part pour la matrice vide."]
  }],
  "py-11": [{
    niveau: "moyen",
    prompt: R`<p>Écris @@moyenne_valide(textes)@@ : la moyenne des textes qui se convertissent en entier (les autres sont ignorés), ou @@None@@ s'il n'y en a aucun. Rattrape seulement @@ValueError@@.</p>`,
    starter: "def moyenne_valide(textes):\n    nombres = [int(t) for t in textes]\n    return sum(nombres) / len(nombres)\n",
    solution: R`def moyenne_valide(textes):
    nombres = []
    for t in textes:
        try:
            nombres.append(int(t))
        except ValueError:
            pass
    if not nombres:
        return None
    return sum(nombres) / len(nombres)
`,
    tests: R`print(moyenne_valide(["12", "x", "8", "", " 10 "]), moyenne_valide(["a"]), moyenne_valide([]), moyenne_valide(["-4", "4.5", "6"]))`,
    expected: "10.0 None None 1.0",
    hints: ["Un try / except ValueError autour de chaque int(t), dans la boucle.", "Attention à la division par zéro si aucun texte n'est valide : renvoie None avant."]
  }],
  "py-12": [{
    niveau: "moyen",
    prompt: R`<p>Crée une classe @@Rectangle@@ : @@__init__(self, largeur, hauteur)@@, @@aire()@@, @@perimetre()@@, @@agrandir(facteur)@@ (multiplie les deux côtés), @@est_carre()@@, et @@__str__@@ qui renvoie par exemple @@"Rectangle 3 x 4"@@.</p>`,
    starter: "class Rectangle:\n    def __init__(self, largeur, hauteur):\n        pass\n",
    solution: R`class Rectangle:
    def __init__(self, largeur, hauteur):
        self.largeur = largeur
        self.hauteur = hauteur

    def aire(self):
        return self.largeur * self.hauteur

    def perimetre(self):
        return 2 * (self.largeur + self.hauteur)

    def agrandir(self, facteur):
        self.largeur *= facteur
        self.hauteur *= facteur

    def est_carre(self):
        return self.largeur == self.hauteur

    def __str__(self):
        return f"Rectangle {self.largeur} x {self.hauteur}"
`,
    tests: R`r = Rectangle(3, 4)
print(r, r.aire(), r.perimetre(), r.est_carre())
r.agrandir(2)
print(r, r.aire())
print(Rectangle(5, 5).est_carre())`,
    expected: "Rectangle 3 x 4 12 14 False\nRectangle 6 x 8 48\nTrue",
    hints: ["Range largeur et hauteur dans self dans __init__ ; chaque méthode les relit par self.", "print(objet) appelle __str__ : renvoie une f-string."]
  }],
  "py-13": [{
    niveau: "moyen",
    prompt: R`<p>La liste triée peut contenir des doublons. Écris @@premiere_occurrence(liste, cible)@@ : l'indice de la <em>première</em> occurrence de @@cible@@, ou @@-1@@, en O(log n). Le test compte les lectures sur une liste d'un million d'éléments très répétés : un parcours un par un ne suffit pas.</p>`,
    starter: "def premiere_occurrence(liste, cible):\n    for i in range(len(liste)):\n        if liste[i] == cible:\n            return i\n    return -1\n",
    solution: R`def premiere_occurrence(liste, cible):
    g, d = 0, len(liste) - 1
    trouve = -1
    while g <= d:
        m = (g + d) // 2
        if liste[m] == cible:
            trouve = m
            d = m - 1          # on continue à gauche
        elif liste[m] < cible:
            g = m + 1
        else:
            d = m - 1
    return trouve
`,
    tests: R`print(premiere_occurrence([1, 2, 2, 2, 3], 2), premiere_occurrence([1, 2, 3], 4), premiere_occurrence([5, 5, 5], 5), premiere_occurrence([], 1))
class Espion(list):
    lectures = 0
    def __getitem__(self, i):
        Espion.lectures += 1
        return list.__getitem__(self, i)
    def __iter__(self):
        Espion.lectures += len(self)
        return list.__iter__(self)

grande = Espion([0] * 500_000 + [1] * 500_000)
print(premiere_occurrence(grande, 1), Espion.lectures <= 60)`,
    expected: "1 -1 0 -1\n500000 True",
    hints: ["Une recherche binaire classique, mais quand liste[m] == cible, ne t'arrête pas.", "Note m comme candidat, puis continue dans la moitié gauche (d = m − 1) pour trouver une occurrence plus tôt."]
  }]
};
