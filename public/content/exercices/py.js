/* Exercices courts du cours Python (format : README, « exercices »). Chaque réponse est vérifiée par exécution. */
const R = String.raw;

export default {
  "py-01": [
    { type: "sortie", code: R`print("Boucle", 1)
# print("caché")
print("a", "b", "c")
print('Il dit "oui"')`, reponse: "Boucle 1\na b c\nIl dit \"oui\"",
      explain: "Chaque virgule ajoute une espace ; la ligne commentée n'est pas exécutée ; des guillemets doubles peuvent vivre dans une chaîne entourée d'apostrophes." },
    { type: "ordre", lignes: [`print("1. Ouvrir le terminal")`, `print("2. Taper python3")`, `print("3. Lancer le script")`], attendu: "1. Ouvrir le terminal\n2. Taper python3\n3. Lancer le script",
      explain: "Le programme s'exécute de haut en bas : l'ordre des lignes est l'ordre de l'affichage." }
  ],
  "py-02": [
    { type: "sortie", code: R`a = 17
b = 5
print(a / b, a // b, a % b)
print(2 ** 3 + 1)`, reponse: "3.4 3 2\n9",
      explain: R`@@/@@ donne un décimal (3.4), @@//@@ le quotient entier (3), @@%@@ le reste (17 = 3 × 5 + 2). La puissance passe avant l'addition : 8 + 1.` },
    { type: "trous", code: R`minutes = 135
heures = minutes ⟦//⟧ 60
reste = minutes ⟦%⟧ 60
print(heures, "h", reste, "min")`, attendu: "2 h 15 min",
      explain: R`La division entière @@//@@ compte les heures pleines, le reste @@%@@ les minutes qui restent.` }
  ],
  "py-03": [
    { type: "sortie", code: R`mot = "boucle"
print(mot[1:3], mot[-2])
print(len(mot) * 2)`, reponse: "ou l\n12",
      explain: R`@@mot[1:3]@@ prend les indices 1 et 2 (o, u), @@mot[-2]@@ est l'avant-dernière lettre. print sépare ses arguments par une espace. La chaîne a 6 lettres.` },
    { type: "trous", code: R`nom = "ada"
print(⟦f⟧"Bonjour {nom.⟦capitalize§title⟧()} !")`, attendu: "Bonjour Ada !",
      explain: R`Le préfixe @@f@@ active le remplacement des accolades ; @@capitalize()@@ met la première lettre en majuscule.` },
    { type: "ordre", lignes: ["prenom = \"grace\"", "initiale = prenom[0].upper()", "message = f\"Initiale : {initiale}\"", "print(message)"], attendu: "Initiale : G",
      explain: "Une variable doit exister avant d'être lue : chaque ligne utilise le résultat de la précédente." }
  ],
  "py-04": [
    { type: "sortie", code: R`note = 14
if note >= 16:
    print("très bien")
elif note >= 12:
    print("bien")
elif note >= 10:
    print("passable")
else:
    print("insuffisant")`, reponse: "bien",
      explain: R`Les conditions sont testées dans l'ordre ; la première vraie (@@note >= 12@@) est la seule exécutée, même si @@note >= 10@@ est vraie aussi.` },
    { type: "trous", code: R`age = 20
membre = False
if age >= 18 ⟦and⟧ not membre:
    print("tarif adulte")`, attendu: "tarif adulte",
      explain: R`Les deux conditions doivent être vraies : @@and@@. @@not membre@@ vaut True car membre est False.` }
  ],
  "py-05": [
    { type: "sortie", code: R`total = 0
for i in range(1, 5):
    total += i
print(total)
for i in range(6, 0, -2):
    print(i, end=" ")`, reponse: "10\n6 4 2",
      explain: R`@@range(1, 5)@@ donne 1, 2, 3, 4 (5 exclu) : somme 10. @@range(6, 0, -2)@@ descend de 2 en 2 et s'arrête avant 0.` },
    { type: "trous", code: R`for i in ⟦range⟧(3):
    print("ligne", i ⟦+⟧ 1)`, attendu: "ligne 1\nligne 2\nligne 3",
      explain: R`@@range(3)@@ produit 0, 1, 2 ; on ajoute 1 pour numéroter à partir de 1.` }
  ],
  "py-06": [
    { type: "sortie", code: R`n = 20
etapes = 0
while n > 1:
    n = n // 2
    etapes += 1
print(etapes, n)`, reponse: "4 1",
      explain: "20 → 10 → 5 → 2 → 1 : quatre divisions, puis la condition n > 1 devient fausse." },
    { type: "ordre", lignes: ["essais = 0", "while True:", "    essais += 1", "    if essais == 3:", "        break", "print(essais)"], attendu: "3",
      explain: R`Le compteur existe avant la boucle, avance à chaque tour, et @@break@@ sort dès qu'il atteint 3.` }
  ],
  "py-07": [
    { type: "sortie", code: R`l = [4, 1, 3]
l.append(2)
print(l[-1], len(l))
print(sorted(l))
print(l)`, reponse: "2 4\n[1, 2, 3, 4]\n[4, 1, 3, 2]",
      explain: R`@@sorted@@ renvoie une nouvelle liste triée sans modifier l'originale, qui garde son ordre d'insertion.` },
    { type: "trous", code: R`notes = [12, 8, 15]
notes.⟦append⟧(10)
print(⟦sum⟧(notes) / len(notes))`, attendu: "11.25",
      explain: R`@@append@@ ajoute à la fin ; la moyenne est @@sum(notes) / len(notes)@@ = 45 / 4.` }
  ],
  "py-08": [
    { type: "sortie", code: R`d = {"a": 1, "b": 2}
d["c"] = 3
d["a"] += 10
print(d["a"], d.get("z", 0), len(d))
print(sorted(d))`, reponse: "11 0 3\n['a', 'b', 'c']",
      explain: R`@@get@@ renvoie la valeur par défaut pour une clé absente au lieu de lever @@KeyError@@. @@sorted(d)@@ trie les clés.` },
    { type: "trous", code: R`mots = ["chat", "chien", "chat"]
compte = {}
for m in mots:
    compte[m] = compte.⟦get⟧(m, 0) + 1
for cle, n in compte.⟦items⟧():
    print(cle, n)`, attendu: "chat 2\nchien 1",
      explain: R`@@get(m, 0)@@ part de 0 la première fois ; @@items()@@ parcourt les paires clé, valeur.` }
  ],
  "py-09": [
    { type: "sortie", code: R`def f(x, y=2):
    return x * y

def g(x):
    print(x)

print(f(3), f(3, y=5))
print(g(4))`, reponse: "6 15\n4\nNone",
      explain: R`@@y@@ vaut 2 par défaut. @@g@@ affiche 4 mais ne renvoie rien : son résultat est @@None@@, que le second print affiche.` },
    { type: "ordre", lignes: ["def carre(n):", "    return n * n", "resultat = carre(7)", "print(resultat)"], attendu: "49",
      explain: "Une fonction doit être définie avant d'être appelée ; son corps est indenté sous la ligne def." }
  ],
  "py-10": [
    { type: "sortie", code: R`n = [1, 2, 3, 4, 5]
print([x * x for x in n if x % 2 == 0])
print({x: x * 10 for x in n[:2]})`, reponse: "[4, 16]\n{1: 10, 2: 20}",
      explain: R`Le filtre @@if x % 2 == 0@@ garde 2 et 4 avant de les élever au carré. @@n[:2]@@ prend les deux premiers.` },
    { type: "trous", code: R`prix = [12.5, 3.0, 8.75]
ttc = [round(p * 1.2, 2) ⟦for⟧ p ⟦in⟧ prix]
print(ttc)`, attendu: "[15.0, 3.6, 10.5]",
      explain: R`Une compréhension s'écrit @@[expression for élément in séquence]@@.` }
  ],
  "py-11": [
    { type: "sortie", code: R`for s in ["4", "x", "0"]:
    try:
        print(12 // int(s))
    except ValueError:
        print("pas un nombre")
    except ZeroDivisionError:
        print("division par zéro")`, reponse: "3\npas un nombre\ndivision par zéro",
      explain: R`@@int("x")@@ lève @@ValueError@@ ; @@12 // 0@@ lève @@ZeroDivisionError@@. Chaque erreur est attrapée par son propre except.` },
    { type: "trous", code: R`stock = {"vis": 40}
try:
    print(stock["clous"])
⟦except⟧ ⟦KeyError⟧:
    print("article inconnu")`, attendu: "article inconnu",
      explain: R`Lire une clé absente lève @@KeyError@@ : on rattrape cette exception précise.` }
  ],
  "py-12": [
    { type: "sortie", code: R`class Compteur:
    def __init__(self, depart=0):
        self.valeur = depart

    def ajouter(self, n=1):
        self.valeur += n
        return self.valeur

a = Compteur()
b = Compteur(10)
a.ajouter()
print(a.ajouter(5), b.ajouter())
print(a.valeur, b.valeur)`, reponse: "6 11\n6 11",
      explain: "Chaque objet a ses propres attributs : a part de 0 (+1 puis +5), b part de 10 (+1)." },
    { type: "trous", code: R`class Lampe:
    def __init__(⟦self⟧):
        self.allumee = False

    def basculer(self):
        ⟦self⟧.allumee = not self.allumee

l = Lampe()
l.basculer()
print(l.allumee)`, attendu: "True",
      explain: R`Chaque méthode reçoit l'objet en premier paramètre, appelé @@self@@ ; c'est par lui qu'on lit et modifie ses attributs.` }
  ],
  "py-13": [
    { type: "sortie", code: R`liste = [3, 7, 9, 14, 20, 31, 40]
g, d = 0, len(liste) - 1
cible = 31
while g <= d:
    m = (g + d) // 2
    print(m, end=" ")
    if liste[m] == cible:
        break
    if liste[m] < cible:
        g = m + 1
    else:
        d = m - 1`, reponse: "3 5",
      explain: "Milieu de 0..6 : 3 (14 < 31), on garde 4..6 ; milieu 5 : 31, trouvé en deux comparaisons." },
    { type: "trous", code: R`def chercher(l, x):
    g, d = 0, len(l) - 1
    while g ⟦<=⟧ d:
        m = (g + d) // 2
        if l[m] == x:
            return m
        if l[m] < x:
            g = m ⟦+⟧ 1
        else:
            d = m ⟦-⟧ 1
    return -1

print(chercher([1, 4, 6, 9], 9), chercher([1, 4, 6, 9], 5))`, attendu: "3 -1",
      explain: R`On continue tant que l'intervalle n'est pas vide (@@g <= d@@) et on exclut le milieu déjà testé avec @@m + 1@@ ou @@m - 1@@.` }
  ]
};
