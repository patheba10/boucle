/* Cours Python — bases */
const R = String.raw;

export default {
  id: "py", route: "python", badge: "py", name: "Python", tag: ">>>", lang: "py",
  blurb: "Des bases à la POO et aux algorithmes. Chaque défi s'exécute dans ton navigateur.",
  lessons: [
  {
    id: "py-01", title: "Afficher avec print()", xp: 30,
    theory: R`<p>Un programme Python s'exécute ligne par ligne, de haut en bas. La fonction @@print()@@ affiche dans la console ce qu'on lui donne.</p>
~~~py
print("Bonjour !")
print("J'ai", 25, "ans")   # les virgules ajoutent un espace
# Ceci est un commentaire : Python l'ignore
~~~
<ul><li>Le texte (une <em>chaîne</em>) s'écrit entre @@"..."@@ ou @@'...'@@.</li><li>Chaque @@print()@@ termine sa ligne par un retour à la ligne.</li><li>@@#@@ commence un commentaire.</li></ul>`,
    quiz: [
      { q: R`Qu'affiche @@print("a", "b")@@ ?`, options: ["ab", "a b", "a,b", "Une erreur"], answer: 1,
        explain: "Les virgules séparent les arguments et print() insère un espace entre eux." }
    ],
    challenge: {
      prompt: R`<p>Affiche exactement ces deux lignes :</p><pre class="out">Bonjour, monde !
Je code en Python.</pre>`,
      starter: "# Écris ton code ici\n",
      solution: R`print("Bonjour, monde !")
print("Je code en Python.")`,
      expected: "Bonjour, monde !\nJe code en Python.",
      hint: "Deux appels à print(), un par ligne. Attention à l'espace avant le point d'exclamation."
    }
  },
  {
    id: "py-02", title: "Variables et opérations", xp: 30,
    theory: R`<p>Une variable est un nom qui pointe vers une valeur. Python devine le type tout seul.</p>
~~~py
age = 25          # int (entier)
prix = 19.99      # float (décimal)
nom = "Ada"       # str (chaîne)
actif = True      # bool
print(type(age), type(prix))
print(7 / 2, 7 // 2, 7 % 2, 2 ** 10)
~~~
<ul><li>@@/@@ donne toujours un float ; @@//@@ est la division entière ; @@%@@ le reste.</li><li>@@**@@ est la puissance.</li><li>@@round(x, 2)@@ arrondit à 2 décimales.</li></ul>`,
    quiz: [
      { q: R`Que vaut @@17 // 5@@ ?`, options: ["3.4", "3", "2", "4"], answer: 1,
        explain: "// garde la partie entière de la division : 17 / 5 = 3,4 → 3." },
      { q: R`Que vaut @@17 % 5@@ ?`, options: ["2", "3", "0.4", "12"], answer: 0,
        explain: "17 = 5 × 3 + 2, le reste est 2." }
    ],
    challenge: {
      prompt: R`<p>Un article coûte <strong>80 $</strong>. Au Québec, TPS + TVQ = <strong>14,975 %</strong>.</p><p>Range le prix dans @@prix@@, le taux dans @@taxe@@ (en décimal), puis affiche le prix taxes incluses arrondi à 2 décimales.</p><pre class="out">91.98</pre>`,
      starter: "prix = 80\ntaxe = 0  # à corriger\n\n",
      solution: R`prix = 80
taxe = 0.14975
print(round(prix * (1 + taxe), 2))`,
      expected: "91.98",
      hint: "14,975 % s'écrit 0.14975. Le total vaut prix × (1 + taxe)."
    }
  },
  {
    id: "py-03", title: "Chaînes et f-strings", xp: 30,
    theory: R`<p>Les chaînes se découpent, se mesurent et se transforment.</p>
~~~py
mot = "python"
print(len(mot))        # 6
print(mot[0], mot[-1]) # p n
print(mot[1:4])        # yth  (de 1 inclus à 4 exclu)
print(mot.upper(), mot.capitalize())

pi = 3.14159
print(f"{mot} a {len(mot)} lettres, pi ≈ {pi:.2f}")
~~~
<p>Une <strong>f-string</strong> commence par @@f@@ et remplace chaque @@{expression}@@ par sa valeur. @@:.2f@@ formate un nombre avec 2 décimales.</p>`,
    quiz: [
      { q: R`Que vaut @@"python"[1:4]@@ ?`, options: ["pyt", "yth", "ytho", "ython"], answer: 1,
        explain: "L'indice 1 est inclus, l'indice 4 est exclu : y, t, h." }
    ],
    exercices: [
      { type: "sortie", code: R`mot = "boucle"
print(mot[1:3], mot[-2])
print(len(mot) * 2)`, reponse: "ou l\n12",
        explain: R`@@mot[1:3]@@ prend les indices 1 et 2 (o, u), @@mot[-2]@@ est l'avant-dernière lettre. print sépare ses arguments par une espace. La chaîne a 6 lettres.` },
      { type: "trous", code: R`nom = "ada"
print([[f]]"Bonjour {nom.[[capitalize§title]]()} !")`, attendu: "Bonjour Ada !",
        explain: R`Le préfixe @@f@@ active le remplacement des accolades ; @@capitalize()@@ met la première lettre en majuscule.` },
      { type: "ordre", lignes: ["prenom = \"grace\"", "initiale = prenom[0].upper()", "message = f\"Initiale : {initiale}\"", "print(message)"], attendu: "Initiale : G",
        explain: "Une variable doit exister avant d'être lue : chaque ligne utilise le résultat de la précédente." }
    ],
    challenge: {
      prompt: R`<p>Avec les variables fournies, affiche cette phrase grâce à une f-string, @@capitalize()@@ et @@len()@@ :</p><pre class="out">Ada habite à Montreal (8 lettres).</pre>`,
      starter: "prenom = \"ada\"\nville = \"montreal\"\n\n",
      solution: R`prenom = "ada"
ville = "montreal"
print(f"{prenom.capitalize()} habite à {ville.capitalize()} ({len(ville)} lettres).")`,
      expected: "Ada habite à Montreal (8 lettres).",
      hint: R`print(f"{prenom.capitalize()} habite à ...")`
    }
  },
  {
    id: "py-04", title: "Conditions", xp: 30,
    theory: R`<p>@@if@@, @@elif@@ et @@else@@ choisissent quel bloc exécuter. Python utilise l'<strong>indentation</strong> (4 espaces) pour délimiter les blocs.</p>
~~~py
temperature = -12
if temperature < -20:
    print("Grand froid")
elif temperature < 0:
    print("Il gèle")
else:
    print("Ça va")

# Combiner : and, or, not
print(5 > 3 and 2 > 4)   # False
~~~
<p>Comparateurs : @@==@@ @@!=@@ @@<@@ @@<=@@ @@>@@ @@>=@@.</p>`,
    quiz: [
      { q: R`Que donne @@not (3 > 2 or 1 > 5)@@ ?`, options: ["True", "False", "Une erreur", "None"], answer: 1,
        explain: "3 > 2 est vrai, donc le or est vrai, et not le rend faux." }
    ],
    challenge: {
      prompt: R`<p>Écris une fonction @@mention(note)@@ qui renvoie :</p><ul><li>@@"A"@@ si note ≥ 90, @@"B"@@ si ≥ 80, @@"C"@@ si ≥ 70, @@"D"@@ si ≥ 60</li><li>@@"E"@@ sinon</li></ul><p>On utilisera @@def@@ et @@return@@ (vus en détail plus loin) : le squelette est fourni. Ta fonction sera testée sur plusieurs notes.</p>`,
      starter: "def mention(note):\n    # ton code ici\n    return \"?\"\n",
      solution: R`def mention(note):
    if note >= 90:
        return "A"
    elif note >= 80:
        return "B"
    elif note >= 70:
        return "C"
    elif note >= 60:
        return "D"
    else:
        return "E"`,
      tests: R`for n in [95, 90, 85, 78, 60, 59, 0]:
    print(n, mention(n))`,
      expected: "95 A\n90 A\n85 B\n78 C\n60 D\n59 E\n0 E",
      hint: "Teste du plus haut seuil au plus bas, avec >= à chaque fois."
    }
  },
  {
    id: "py-05", title: "Boucles for et range()", xp: 30,
    theory: R`<p>@@for@@ parcourt une séquence. @@range(a, b)@@ produit les entiers de a (inclus) à b (exclu).</p>
~~~py
for i in range(3):
    print("tour", i)        # 0, 1, 2

for i in range(10, 0, -3):  # départ, arrêt, pas
    print(i)                # 10, 7, 4, 1

for lettre in "abc":
    print(lettre.upper())
~~~`,
    quiz: [
      { q: R`Combien de nombres produit @@range(2, 8)@@ ?`, options: ["6", "7", "8", "5"], answer: 0,
        explain: "De 2 à 7 inclus : 2, 3, 4, 5, 6, 7." }
    ],
    challenge: {
      prompt: R`<p>Affiche la table de 7, de 1 à 5, avec une boucle :</p><pre class="out">7 x 1 = 7
7 x 2 = 14
7 x 3 = 21
7 x 4 = 28
7 x 5 = 35</pre>`,
      starter: "for i in range(1, 2):\n    pass\n",
      solution: R`for i in range(1, 6):
    print(f"7 x {i} = {7 * i}")`,
      expected: "7 x 1 = 7\n7 x 2 = 14\n7 x 3 = 21\n7 x 4 = 28\n7 x 5 = 35",
      hint: R`range(1, 6) donne 1 à 5. Puis print(f"7 x {i} = {7 * i}").`
    }
  },
  {
    id: "py-06", title: "Boucle while", xp: 30,
    theory: R`<p>@@while@@ répète tant qu'une condition est vraie. Pense toujours à faire évoluer la variable testée, sinon la boucle ne s'arrête jamais.</p>
~~~py
solde = 1000
annees = 0
while solde < 2000:
    solde = solde * 1.07   # +7 % par an
    annees += 1
print(annees, "ans pour doubler")

# break sort immédiatement de la boucle
n = 0
while True:
    n += 1
    if n == 3:
        break
print(n)
~~~`,
    quiz: [
      { q: "Que fait le mot-clé break ?", options: ["Saute au tour suivant", "Sort de la boucle", "Met le programme en pause", "Lève une erreur"], answer: 1,
        explain: "break quitte la boucle. continue, lui, passe au tour suivant." }
    ],
    challenge: {
      prompt: R`<p><strong>Suite de Syracuse</strong> : en partant de @@n = 6@@, si n est pair on le divise par 2, sinon on fait 3n + 1. On s'arrête à 1.</p><p>Compte le nombre d'étapes et affiche :</p><pre class="out">8 étapes</pre>`,
      starter: "n = 6\netapes = 0\n\n",
      solution: R`n = 6
etapes = 0
while n != 1:
    if n % 2 == 0:
        n = n // 2
    else:
        n = 3 * n + 1
    etapes += 1
print(etapes, "étapes")`,
      expected: "8 étapes",
      hint: "while n != 1: ... et n % 2 == 0 pour tester la parité. Utilise // pour rester en entier."
    }
  },
  {
    id: "py-07", title: "Listes", xp: 35,
    theory: R`<p>Une liste range plusieurs valeurs dans l'ordre. Elle est modifiable.</p>
~~~py
notes = [12, 15, 9]
notes.append(18)
print(notes, len(notes))
print(notes[0], notes[-1])
print(sum(notes), max(notes), min(notes))
print(sorted(notes, reverse=True))
print(15 in notes)

for n in notes:
    if n >= 12:
        print("réussi :", n)
~~~`,
    quiz: [
      { q: R`Après @@l = [1, 2]; l.append([3])@@, que vaut @@len(l)@@ ?`, options: ["2", "3", "4", "Erreur"], answer: 1,
        explain: "append ajoute UN élément, ici la liste [3]. Pour ajouter les éléments un par un, on utilise extend." }
    ],
    challenge: {
      prompt: R`<p>Voici les températures d'une semaine à Gatineau. Affiche le nombre de jours sous zéro, puis la moyenne arrondie à 1 décimale :</p><pre class="out">Jours sous zéro : 4
Moyenne : -4.3</pre>`,
      starter: "temperatures = [-12, -5, 3, -8, 0, 7, -15]\n\n",
      solution: R`temperatures = [-12, -5, 3, -8, 0, 7, -15]
negatifs = 0
for t in temperatures:
    if t < 0:
        negatifs += 1
print("Jours sous zéro :", negatifs)
print("Moyenne :", round(sum(temperatures) / len(temperatures), 1))`,
      expected: "Jours sous zéro : 4\nMoyenne : -4.3",
      hint: "0 n'est pas sous zéro : utilise t < 0. La moyenne vaut sum(...) / len(...)."
    }
  },
  {
    id: "py-08", title: "Dictionnaires", xp: 35,
    theory: R`<p>Un dictionnaire associe des <strong>clés</strong> à des <strong>valeurs</strong>. C'est la structure de base d'un JSON.</p>
~~~py
stock = {"pommes": 12, "poires": 4}
stock["kiwis"] = 7
stock["pommes"] -= 2
print(stock["pommes"])
print(stock.get("mangues", 0))   # valeur par défaut si absente

for fruit, qte in stock.items():
    print(fruit, "->", qte)
print(sorted(stock))             # les clés triées
~~~`,
    quiz: [
      { q: R`Que renvoie @@{"a": 1}.get("b")@@ ?`, options: ["0", "None", "Une KeyError", "\"b\""], answer: 1,
        explain: "get renvoie None quand la clé manque (ou la valeur par défaut donnée en 2e argument). Avec d[\"b\"], on aurait une KeyError." }
    ],
    challenge: {
      prompt: R`<p>Compte les mots de la phrase avec un dictionnaire, puis affiche chaque mot et son nombre d'apparitions, <strong>triés par ordre alphabétique</strong> :</p><pre class="out">chat: 1
chien: 1
et: 2
le: 3
poisson: 1</pre>`,
      starter: "phrase = \"le chat et le chien et le poisson\"\ncompte = {}\n\n",
      solution: R`phrase = "le chat et le chien et le poisson"
compte = {}
for mot in phrase.split():
    compte[mot] = compte.get(mot, 0) + 1
for mot in sorted(compte):
    print(f"{mot}: {compte[mot]}")`,
      expected: "chat: 1\nchien: 1\net: 2\nle: 3\npoisson: 1",
      hint: R`phrase.split() découpe en mots. compte[mot] = compte.get(mot, 0) + 1 incrémente proprement.`
    }
  },
  {
    id: "py-09", title: "Fonctions", xp: 40,
    theory: R`<p>Une fonction regroupe du code réutilisable. Elle reçoit des <strong>paramètres</strong> et peut <strong>renvoyer</strong> une valeur avec @@return@@.</p>
~~~py
def mensualite(capital, taux_annuel, mois=60):
    t = taux_annuel / 12
    return capital * t / (1 - (1 + t) ** -mois)

print(round(mensualite(25000, 0.06), 2))
print(round(mensualite(25000, 0.06, mois=36), 2))
~~~
<p>@@mois=60@@ est un paramètre avec valeur par défaut. Sans @@return@@, une fonction renvoie @@None@@.</p>`,
    quiz: [
      { q: R`Que renvoie une fonction qui n'a pas de @@return@@ ?`, options: ["0", "\"\"", "None", "Une erreur"], answer: 2,
        explain: "Python renvoie implicitement None." }
    ],
    challenge: {
      prompt: R`<p>Écris @@est_premier(n)@@ qui renvoie @@True@@ si n est un nombre premier, @@False@@ sinon. 0 et 1 ne sont pas premiers.</p><p>Le test affichera les premiers entre 1 et 30.</p>`,
      starter: "def est_premier(n):\n    # ton code ici\n    return False\n",
      solution: R`def est_premier(n):
    if n < 2:
        return False
    d = 2
    while d * d <= n:
        if n % d == 0:
            return False
        d += 1
    return True`,
      tests: R`print([n for n in range(1, 31) if est_premier(n)])`,
      expected: "[2, 3, 5, 7, 11, 13, 17, 19, 23, 29]",
      hint: "Essaie chaque diviseur d à partir de 2 tant que d × d ≤ n. Si n % d == 0, n n'est pas premier."
    }
  },
  {
    id: "py-10", title: "Compréhensions de liste", xp: 40,
    theory: R`<p>Une compréhension construit une liste en une ligne : @@[expression for x in séquence if condition]@@.</p>
~~~py
nombres = [1, 2, 3, 4, 5, 6]
doubles = [n * 2 for n in nombres]
impairs = [n for n in nombres if n % 2 == 1]
print(doubles)
print(impairs)

# Même idée pour un dictionnaire
carres = {n: n * n for n in range(4)}
print(carres)
~~~`,
    quiz: [
      { q: R`Que vaut @@[c for c in "abc" if c != "b"]@@ ?`, options: ["['a', 'c']", "['b']", "\"ac\"", "['a', 'b', 'c']"], answer: 0,
        explain: "On garde chaque caractère différent de \"b\", dans une liste." }
    ],
    challenge: {
      prompt: R`<p>Écris @@carres_pairs(nums)@@ qui renvoie, avec une compréhension, la liste des carrés des nombres <strong>pairs</strong> de @@nums@@.</p><pre class="out">carres_pairs([1, 2, 3, 4, 5, 6])  →  [4, 16, 36]</pre>`,
      starter: "def carres_pairs(nums):\n    return []\n",
      solution: R`def carres_pairs(nums):
    return [n * n for n in nums if n % 2 == 0]`,
      tests: R`print(carres_pairs([1, 2, 3, 4, 5, 6]))
print(carres_pairs([]))
print(carres_pairs([-2, 7, 10]))`,
      expected: "[4, 16, 36]\n[]\n[4, 100]",
      hint: "[n * n for n in nums if n % 2 == 0]"
    }
  },
  {
    id: "py-11", title: "Gérer les erreurs", xp: 40,
    theory: R`<p>Quand une opération échoue, Python lève une <strong>exception</strong>. @@try / except@@ permet de la rattraper au lieu de planter.</p>
~~~py
def diviser(a, b):
    try:
        return a / b
    except ZeroDivisionError:
        return None

print(diviser(10, 4))
print(diviser(1, 0))

try:
    int("douze")
except ValueError as e:
    print("Conversion impossible")
~~~
<p>Rattrape des exceptions précises (@@ValueError@@, @@KeyError@@...) plutôt qu'un @@except@@ nu qui masquerait de vrais bogues.</p>`,
    quiz: [
      { q: R`Quelle exception lève @@int("abc")@@ ?`, options: ["TypeError", "ValueError", "KeyError", "SyntaxError"], answer: 1,
        explain: "Le type (str) est accepté par int(), mais la valeur n'est pas convertible : ValueError." }
    ],
    challenge: {
      prompt: R`<p>Écris @@convertir(texte)@@ qui renvoie l'entier correspondant, ou @@None@@ si la conversion échoue.</p>`,
      starter: "def convertir(texte):\n    return int(texte)\n",
      solution: R`def convertir(texte):
    try:
        return int(texte)
    except ValueError:
        return None`,
      tests: R`print(convertir("42"), convertir("abc"), convertir("-7"), convertir(""))`,
      expected: "42 None -7 None",
      hint: "Entoure int(texte) d'un try et renvoie None dans except ValueError."
    }
  },
  {
    id: "py-12", title: "Classes et objets", xp: 50,
    theory: R`<p>Une <strong>classe</strong> décrit un type d'objet : ses données (attributs) et ses comportements (méthodes). @@__init__@@ initialise chaque nouvel objet ; @@self@@ désigne l'objet lui-même.</p>
~~~py
class Serveur:
    def __init__(self, nom, cpu=2):
        self.nom = nom
        self.cpu = cpu
        self.actif = False

    def demarrer(self):
        self.actif = True
        return f"{self.nom} démarré ({self.cpu} vCPU)"

web = Serveur("web-01", cpu=4)
print(web.demarrer())
print(web.actif)
~~~`,
    quiz: [
      { q: R`À quoi sert @@self@@ dans une méthode ?`, options: ["À appeler la classe parente", "À désigner l'objet sur lequel la méthode est appelée", "À déclarer une variable globale", "Rien, c'est optionnel"], answer: 1,
        explain: "web.demarrer() équivaut à Serveur.demarrer(web) : self reçoit l'objet web." }
    ],
    challenge: {
      prompt: R`<p>Crée une classe @@CompteBancaire@@ :</p><ul><li>@@__init__(self, titulaire, solde=0)@@</li><li>@@deposer(montant)@@ ajoute au solde</li><li>@@retirer(montant)@@ renvoie @@False@@ sans rien changer si le solde est insuffisant, sinon retire et renvoie @@True@@</li></ul>`,
      starter: "class CompteBancaire:\n    pass\n",
      solution: R`class CompteBancaire:
    def __init__(self, titulaire, solde=0):
        self.titulaire = titulaire
        self.solde = solde

    def deposer(self, montant):
        self.solde += montant

    def retirer(self, montant):
        if montant > self.solde:
            return False
        self.solde -= montant
        return True`,
      tests: R`c = CompteBancaire("Ada")
c.deposer(100)
print(c.retirer(30), c.solde)
print(c.retirer(500), c.solde)
print(CompteBancaire("Bob", 50).solde)`,
      expected: "True 70\nFalse 70\n50",
      hint: "Stocke self.solde dans __init__. Dans retirer, teste d'abord si montant > self.solde."
    }
  },
  {
    id: "py-13", title: "Algo : recherche binaire", xp: 60,
    theory: R`<p>Dans une liste <strong>triée</strong>, on trouve un élément en coupant l'intervalle en deux à chaque étape : O(log n) au lieu de O(n). C'est un classique des entretiens techniques.</p>
~~~py
liste = [2, 5, 8, 12, 16, 23, 38]
# On compare la cible au milieu :
# plus petite → on garde la moitié gauche
# plus grande → on garde la moitié droite
gauche, droite = 0, len(liste) - 1
milieu = (gauche + droite) // 2
print(milieu, liste[milieu])
~~~
<p>Pour 1 million d'éléments, il faut au plus 20 comparaisons.</p>`,
    quiz: [
      { q: "Quelle condition est indispensable pour une recherche binaire ?", options: ["La liste contient des entiers", "La liste est triée", "La liste n'a pas de doublons", "La liste a une taille paire"], answer: 1,
        explain: "Sans tri, on ne peut pas savoir de quel côté se trouve la cible." }
    ],
    challenge: {
      prompt: R`<p>Écris @@recherche_binaire(liste, cible)@@ qui renvoie l'indice de @@cible@@ dans la liste triée, ou @@-1@@ si elle n'y est pas. N'utilise pas @@.index()@@.</p>`,
      starter: "def recherche_binaire(liste, cible):\n    gauche, droite = 0, len(liste) - 1\n    # ton code ici\n    return -1\n",
      solution: R`def recherche_binaire(liste, cible):
    gauche, droite = 0, len(liste) - 1
    while gauche <= droite:
        milieu = (gauche + droite) // 2
        if liste[milieu] == cible:
            return milieu
        if liste[milieu] < cible:
            gauche = milieu + 1
        else:
            droite = milieu - 1
    return -1`,
      tests: R`l = [1, 3, 5, 7, 9, 11]
print(recherche_binaire(l, 7), recherche_binaire(l, 4), recherche_binaire(l, 1), recherche_binaire(l, 11), recherche_binaire([], 1))`,
      expected: "3 -1 0 5 -1",
      hint: "Boucle while gauche <= droite. Déplace gauche = milieu + 1 ou droite = milieu - 1."
    }
  }
  ]
};
