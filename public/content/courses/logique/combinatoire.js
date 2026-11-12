/* Cours Logique numérique — chapitre 1 : bits et portes, algèbre de Boole, formes canoniques, additionneurs,
   multiplexeurs et encodeurs. Les circuits sont simulés porte par porte en Python pur. */
const PY = String.raw;

export const LAB = `<p><strong>Sur ta machine</strong> : <em>Logisim-evolution</em> (gratuit) ou le simulateur en ligne <em>CircuitVerse</em> permettent de câbler chaque circuit de ce cours à la souris et de le voir fonctionner. Le cours gratuit <em>Nand to Tetris</em> (nand2tetris.org) va jusqu'au bout de l'idée : construire un ordinateur complet à partir de la seule porte NAND.</p>`;

export default [
  {
    id: "ln-01", section: "Logique combinatoire", title: "Bits, bases et portes logiques", xp: 80,
    theory: `<p>Un circuit numérique ne connaît que deux niveaux : 0 (tension basse, proche de la masse) et 1 (tension haute, proche de 3,3 V ou 5 V). Un <strong>bit</strong> porte l'un ou l'autre ; huit bits forment un octet, qu'on écrit souvent en <strong>hexadécimal</strong> (un chiffre de 0 à F pour 4 bits) : @@0b1010_0101@@ = @@0xA5@@ = 165.</p>
~~~py
n = 165
print(bin(n), hex(n), format(n, "08b"), int("1010", 2), int("FF", 16))
~~~
<p>Les <strong>portes logiques</strong> combinent des bits. Leur comportement se résume dans une <strong>table de vérité</strong> :</p>
~~~text
 a b │ ET  OU  OU-X  NON-ET  NON-OU         NON a
 0 0 │ 0   0    0      1       1            a=0 → 1
 0 1 │ 0   1    1      1       0            a=1 → 0
 1 0 │ 0   1    1      1       0
 1 1 │ 1   1    0      0       0
~~~
<p>En Python, sur des bits 0 et 1, les opérateurs bit à bit font la même chose : @@a & b@@ (ET), @@a | b@@ (OU), @@a ^ b@@ (OU exclusif), @@1 - a@@ ou @@a ^ 1@@ (NON). Ce sont exactement les opérateurs qu'on utilisera en C pour manipuler les registres d'un microcontrôleur.</p>
<p>Un circuit <strong>combinatoire</strong> n'a pas de mémoire : sa sortie ne dépend que de ses entrées du moment. Une table de vérité à @@n@@ entrées a @@2ⁿ@@ lignes, qu'on écrit dans l'ordre du comptage binaire.</p>`,
    setup: LAB,
    quiz: [
      { q: "Que vaut 0x3C en binaire ?", options: ["0011 1100", "0011 0011", "1100 0011", "0000 0110"], answer: 0, explain: "3 = 0011, C = 1100." },
      { q: "Une porte OU exclusif à deux entrées sort 1 quand :", options: ["Les deux entrées valent 1", "Les entrées sont différentes", "Au moins une entrée vaut 1", "Les deux valent 0"], answer: 1, explain: "C'est le « l'un ou l'autre, mais pas les deux »." }
    ],
    challenge: {
      prompt: `<p>Écris les portes @@et(a, b)@@, @@ou(a, b)@@, @@non(a)@@, @@nand(a, b)@@, @@nor(a, b)@@ et @@xor(a, b)@@ sur des bits 0 et 1 (elles renvoient 0 ou 1). Puis @@table_verite(f, n)@@ qui renvoie la liste des lignes @@(e1, …, en, f(e1, …, en))@@ dans l'ordre du comptage binaire, la première entrée étant le bit de poids fort.</p>`,
      starter: PY`def et(a, b):
    return a or b


def ou(a, b):
    return a and b


def non(a):
    return a


def nand(a, b):
    return 1


def nor(a, b):
    return 0


def xor(a, b):
    return a


def table_verite(f, n):
    return []
`,
      solution: PY`from itertools import product


def et(a, b):
    return a & b


def ou(a, b):
    return a | b


def non(a):
    return 1 - a


def nand(a, b):
    return non(et(a, b))


def nor(a, b):
    return non(ou(a, b))


def xor(a, b):
    return a ^ b


def table_verite(f, n):
    return [(*e, f(*e)) for e in product([0, 1], repeat=n)]
`,
      tests: PY`for nom, porte in [("et", et), ("ou", ou), ("nand", nand), ("nor", nor), ("xor", xor)]:
    print(nom, [l[-1] for l in table_verite(porte, 2)])
print("non", non(0), non(1))
majorite = lambda a, b, c: ou(ou(et(a, b), et(a, c)), et(b, c))
for ligne in table_verite(majorite, 3):
    print(ligne)
`,
      expected: "et [0, 0, 0, 1]\nou [0, 1, 1, 1]\nnand [1, 1, 1, 0]\nnor [1, 0, 0, 0]\nxor [0, 1, 1, 0]\nnon 1 0\n(0, 0, 0, 0)\n(0, 0, 1, 0)\n(0, 1, 0, 0)\n(0, 1, 1, 1)\n(1, 0, 0, 0)\n(1, 0, 1, 1)\n(1, 1, 0, 1)\n(1, 1, 1, 1)\n",
      hint: "Sur des bits : a & b, a | b, a ^ b, 1 − a. Pour la table : itertools.product([0, 1], repeat=n) donne les entrées dans l'ordre du comptage, et (*e, f(*e)) construit la ligne."
    }
  },
  {
    id: "ln-02", section: "Logique combinatoire", title: "Algèbre de Boole et universalité de NAND", xp: 90,
    theory: `<p>L'<strong>algèbre de Boole</strong> calcule sur des bits avec des règles proches de l'algèbre ordinaire. On note souvent le ET comme un produit (@@a·b@@), le OU comme une somme (@@a + b@@) et le NON par une barre ou une apostrophe (@@a'@@). Les règles les plus utiles :</p>
~~~text
a + 0 = a      a · 1 = a      a + 1 = 1      a · 0 = 0
a + a' = 1     a · a' = 0     a + a = a      (a')' = a
a · (b + c) = a·b + a·c                     a + a·b = a       (absorption)
De Morgan :   (a · b)' = a' + b'             (a + b)' = a' · b'
~~~
<p>Les lois de <strong>De Morgan</strong> permettent de passer des ET aux OU en inversant tout. Conséquence remarquable : la porte <strong>NAND</strong> est <em>universelle</em>. Avec des NAND seules, on reconstruit toutes les autres portes :</p>
~~~text
NON a    = NAND(a, a)
a ET b   = NON(NAND(a, b))                       2 NAND
a OU b   = NAND(NON a, NON b)                    3 NAND   (De Morgan)
a OU-X b = avec m = NAND(a, b) : NAND(NAND(a, m), NAND(b, m))     4 NAND
~~~
<p>C'est pour cela que les puces de logique et les mémoires flash « NAND » reposent sur cette porte : une seule cellule de base, bien optimisée, répétée des milliards de fois.</p>`,
    setup: LAB,
    quiz: [
      { q: "D'après De Morgan, NON(a OU b) vaut :", options: ["NON a OU NON b", "NON a ET NON b", "a ET b", "a OU-X b"], answer: 1, explain: "(a + b)' = a'·b' : on inverse les termes et on échange ET et OU." },
      { q: "Que vaut a + a·b ?", options: ["a·b", "a", "b", "1"], answer: 1, explain: "Absorption : si a vaut 1, tout vaut 1 ; si a vaut 0, a·b vaut 0." }
    ],
    challenge: {
      prompt: `<p>Avec <strong>uniquement</strong> la fonction @@nand(a, b)@@ fournie (et sans opérateur logique de Python), écris @@non(a)@@, @@et(a, b)@@, @@ou(a, b)@@ et @@oux(a, b)@@.</p><p>Le test compte les appels à @@nand@@ : il faut 1, 2, 3 et 4 portes respectivement, comme un vrai circuit optimisé.</p>`,
      starter: PY`def nand(a, b):
    return 1 - (a & b)


def non(a):
    return 1 - a


def et(a, b):
    return a & b


def ou(a, b):
    return a | b


def oux(a, b):
    return a ^ b
`,
      solution: PY`def nand(a, b):
    return 1 - (a & b)


def non(a):
    return nand(a, a)


def et(a, b):
    return non(nand(a, b))


def ou(a, b):
    return nand(non(a), non(b))


def oux(a, b):
    m = nand(a, b)
    return nand(nand(a, m), nand(b, m))
`,
      tests: PY`_porte = nand
appels = 0


def nand(a, b):
    global appels
    appels += 1
    return _porte(a, b)


for nom, f, attendu in [("et", et, [0, 0, 0, 1]), ("ou", ou, [0, 1, 1, 1]), ("oux", oux, [0, 1, 1, 0])]:
    appels = 0
    sorties = [f(a, b) for a in (0, 1) for b in (0, 1)]
    print(nom, sorties == attendu, "portes :", appels // 4)
appels = 0
print("non", [non(0), non(1)], "portes :", appels // 2)
`,
      expected: "et True portes : 2\nou True portes : 3\noux True portes : 4\nnon [1, 0] portes : 1\n",
      hint: "non(a) = nand(a, a) ; et = non(nand(a, b)) ; ou = nand(non(a), non(b)) ; pour oux, calcule m = nand(a, b) une seule fois et réutilise-le."
    }
  },
  {
    id: "ln-03", section: "Logique combinatoire", title: "De la table de vérité à l'équation : Karnaugh", xp: 90,
    theory: `<p>Toute table de vérité s'écrit comme une <strong>somme de produits</strong> : un terme pour chaque ligne où la sortie vaut 1 (un <em>minterme</em>), où chaque variable apparaît telle quelle si elle vaut 1 et complémentée si elle vaut 0. Pour la fonction majorité de trois entrées :</p>
~~~text
 a b c │ s         lignes à 1 : 011, 101, 110, 111
 0 1 1 │ 1   →     s = a'bc + ab'c + abc' + abc
 1 0 1 │ 1
 1 1 0 │ 1         simplifiée : s = ab + ac + bc
 1 1 1 │ 1
~~~
<p>Cette forme est toujours juste mais rarement minimale. La <strong>table de Karnaugh</strong> range les lignes de façon que deux cases voisines ne diffèrent que d'un bit (code de Gray : 00, 01, 11, 10) ; on regroupe alors les 1 voisins par paquets de 2, 4 ou 8, et chaque paquet devient un produit plus court.</p>
~~~text
            bc
         00  01  11  10
 a = 0 │  0   0   1   0        paquet vertical (colonne 11)  → bc
 a = 1 │  0   1   1   1        paquet (a=1, bc=01 et 11)    → ac
                               paquet (a=1, bc=11 et 10)    → ab
~~~
<p>Moins de termes, c'est moins de portes, moins de surface et de consommation. Les outils de synthèse des FPGA font ce travail automatiquement, mais savoir lire et simplifier une équation reste une question classique d'entretien en électronique numérique.</p>`,
    setup: LAB,
    quiz: [
      { q: "Pourquoi l'ordre 00, 01, 11, 10 dans une table de Karnaugh ?", options: ["C'est l'ordre alphabétique", "Deux cases voisines ne diffèrent que d'un bit (code de Gray), ce qui rend les regroupements visibles", "Pour gagner de la place", "C'est l'ordre binaire"], answer: 1, explain: "Deux mintermes voisins se simplifient : x·y + x·y' = x." },
      { q: "Un paquet de 4 cases dans une Karnaugh à 3 variables donne un terme de :", options: ["3 variables", "2 variables", "1 variable", "4 variables"], answer: 2, explain: "Chaque doublement du paquet élimine une variable." }
    ],
    challenge: {
      prompt: `<p>Écris @@minterms(f, n)@@ qui renvoie la liste des numéros de lignes (entrées lues en binaire, première entrée en poids fort) où @@f@@ vaut 1, et @@somme_de_produits(f, noms)@@ qui écrit la forme canonique : pour chaque minterme, les noms collés, suivis de @@'@@ pour une variable à 0, les termes séparés par @@" + "@@. Si @@f@@ ne vaut jamais 1, renvoie @@"0"@@.</p>`,
      starter: PY`def minterms(f, n):
    return []


def somme_de_produits(f, noms):
    return "0"
`,
      solution: PY`from itertools import product


def minterms(f, n):
    return [i for i, e in enumerate(product([0, 1], repeat=n)) if f(*e)]


def somme_de_produits(f, noms):
    termes = []
    for e in product([0, 1], repeat=len(noms)):
        if f(*e):
            termes.append("".join(nom if bit else nom + "'" for nom, bit in zip(noms, e)))
    return " + ".join(termes) if termes else "0"
`,
      tests: PY`majorite = lambda a, b, c: (a & b) | (a & c) | (b & c)
print(minterms(majorite, 3))
print(somme_de_produits(majorite, ["a", "b", "c"]))
print(somme_de_produits(lambda x, y: x ^ y, ["x", "y"]))
print(somme_de_produits(lambda a, b: 0, ["a", "b"]), minterms(lambda a, b, c, d: a & (1 - b), 4))
`,
      expected: "[3, 5, 6, 7]\na'bc + ab'c + abc' + abc\nx'y + xy'\n0 [8, 9, 10, 11]\n",
      hint: "enumerate(itertools.product([0, 1], repeat=n)) donne le numéro de ligne et les entrées ; pour chaque bit, écris nom si 1, nom + \"'\" si 0."
    }
  },
  {
    id: "ln-04", section: "Logique combinatoire", title: "Additionneurs et complément à deux", xp: 110,
    theory: `<p>Un processeur additionne avec des portes. Le <strong>demi-additionneur</strong> additionne deux bits : somme @@s = a ⊕ b@@, retenue @@r = a·b@@. L'<strong>additionneur complet</strong> ajoute une retenue entrante :</p>
~~~text
s    = a ⊕ b ⊕ rₑ
rₛ   = a·b + rₑ·(a ⊕ b)
~~~
<p>En chaînant @@n@@ additionneurs complets, la retenue de chaque étage entrant dans le suivant, on obtient un <strong>additionneur à propagation de retenue</strong> sur @@n@@ bits. Simple mais lent : la retenue doit traverser tous les étages, ce qui limite la fréquence d'horloge (les processeurs utilisent des additionneurs à anticipation de retenue).</p>
<p>Les entiers négatifs s'écrivent en <strong>complément à deux</strong> : sur @@n@@ bits, @@−x@@ se code @@2ⁿ − x@@, c'est-à-dire « inverser tous les bits et ajouter 1 ». Sur 8 bits, −1 vaut @@0xFF@@ et −128 vaut @@0x80@@ ; le bit de poids fort indique le signe. Le grand avantage : le même additionneur sert pour les nombres signés et non signés.</p>
~~~py
n = 8
for x in (5, -1, -128, 127):
    print(x, format(x & (2**n - 1), "08b"))
print("dépassement : 127 + 1 =", (127 + 1) & 0xFF, "→ lu en signé :", ((127 + 1) & 0xFF) - 256)
~~~
<p>Ce dernier cas, le <strong>dépassement signé</strong> (overflow), arrive quand deux nombres de même signe donnent un résultat de signe opposé. En C, il produit les bogues les plus discrets de l'embarqué.</p>`,
    setup: LAB,
    quiz: [
      { q: "Comment s'écrit −3 sur 8 bits en complément à deux ?", options: ["1000 0011", "1111 1101", "1111 1100", "0000 0011"], answer: 1, explain: "3 = 0000 0011, inversé 1111 1100, plus 1 : 1111 1101 (0xFD)." },
      { q: "Pourquoi l'additionneur à propagation de retenue est-il lent ?", options: ["Il utilise trop de portes NAND", "Chaque étage attend la retenue du précédent : le délai croît avec le nombre de bits", "Il ne gère pas les négatifs", "Il fonctionne en série"], answer: 1, explain: "Le chemin critique traverse les n étages." }
    ],
    challenge: {
      prompt: `<p>Les nombres sont des listes de bits, <strong>poids faible en premier</strong> (@@en_bits@@ et @@depuis_bits@@ sont fournies). Écris @@demi_additionneur(a, b)@@ et @@additionneur_complet(a, b, r)@@ qui renvoient @@(somme, retenue)@@ avec des opérateurs bit à bit, puis @@additionneur(a_bits, b_bits)@@ qui chaîne les additionneurs complets et renvoie @@(bits, retenue_finale)@@.</p>`,
      starter: PY`def en_bits(x, largeur):
    """Entier (négatif accepté, complément à deux) → liste de bits, poids faible en premier."""
    return [(x >> i) & 1 for i in range(largeur)]


def depuis_bits(bits, signe=False):
    v = sum(b << i for i, b in enumerate(bits))
    if signe and bits[-1]:
        v -= 1 << len(bits)
    return v


def demi_additionneur(a, b):
    return a | b, 0


def additionneur_complet(a, b, r):
    return a | b | r, 0


def additionneur(a_bits, b_bits):
    return [a | b for a, b in zip(a_bits, b_bits)], 0
`,
      solution: PY`def en_bits(x, largeur):
    """Entier (négatif accepté, complément à deux) → liste de bits, poids faible en premier."""
    return [(x >> i) & 1 for i in range(largeur)]


def depuis_bits(bits, signe=False):
    v = sum(b << i for i, b in enumerate(bits))
    if signe and bits[-1]:
        v -= 1 << len(bits)
    return v


def demi_additionneur(a, b):
    return a ^ b, a & b


def additionneur_complet(a, b, r):
    s1, r1 = demi_additionneur(a, b)
    s, r2 = demi_additionneur(s1, r)
    return s, r1 | r2


def additionneur(a_bits, b_bits):
    r, sortie = 0, []
    for a, b in zip(a_bits, b_bits):
        s, r = additionneur_complet(a, b, r)
        sortie.append(s)
    return sortie, r
`,
      tests: PY`print([additionneur_complet(a, b, r) for a in (0, 1) for b in (0, 1) for r in (0, 1)])
s, r = additionneur(en_bits(11, 4), en_bits(6, 4))
print(s, r, depuis_bits(s))
s, r = additionneur(en_bits(100, 8), en_bits(-37, 8))
print(depuis_bits(s, signe=True), r)
s, r = additionneur(en_bits(127, 8), en_bits(1, 8))
print(depuis_bits(s), depuis_bits(s, signe=True), r)
`,
      expected: "[(0, 0), (1, 0), (1, 0), (0, 1), (1, 0), (0, 1), (0, 1), (1, 1)]\n[1, 0, 0, 0] 1 1\n63 1\n128 -128 0\n",
      hint: "Demi-additionneur : (a ^ b, a & b). Complet : deux demi-additionneurs, et la retenue est le OU des deux retenues. Puis une boucle sur zip(a_bits, b_bits) qui fait circuler r."
    }
  },
  {
    id: "ln-05", section: "Logique combinatoire", title: "Multiplexeurs, décodeurs et encodeurs de priorité", xp: 90,
    theory: `<p>Quelques blocs combinatoires reviennent partout :</p>
<ul><li>le <strong>multiplexeur</strong> (mux) choisit une entrée parmi @@2ⁿ@@ grâce à @@n@@ bits de sélection : c'est un aiguillage, au cœur des bus et des broches multifonctions d'un microcontrôleur (une broche peut être GPIO, UART ou PWM selon la configuration) ;</li><li>le <strong>décodeur</strong> transforme @@n@@ bits en une seule sortie active parmi @@2ⁿ@@ (code « one-hot ») : il sélectionne une puce mémoire selon l'adresse, ou une ligne d'un afficheur ;</li><li>l'<strong>encodeur de priorité</strong> fait l'inverse : il donne le numéro de l'entrée active la plus prioritaire. C'est le principe du contrôleur d'interruptions, qui choisit laquelle servir quand plusieurs arrivent en même temps.</li></ul>
<p>Un cas concret : l'<strong>afficheur 7 segments</strong>. Un décodeur transforme un chiffre de 4 bits en sept sorties a à g :</p>
~~~text
  aaa       chiffre  a b c d e f g
 f   b        0      1 1 1 1 1 1 0
 f   b        1      0 1 1 0 0 0 0
  ggg         2      1 1 0 1 1 0 1
 e   c        7      1 1 1 0 0 0 0
 e   c        8      1 1 1 1 1 1 1
  ddd
~~~
~~~py
sel = [1, 0]                              # bits de sélection, poids faible en premier : 1
entrees = ["capteur A", "capteur B", "capteur C", "capteur D"]
print(entrees[sum(b << i for i, b in enumerate(sel))])
~~~`,
    setup: LAB,
    quiz: [
      { q: "Combien de bits de sélection pour un multiplexeur à 16 entrées ?", options: ["16", "8", "4", "2"], answer: 2, explain: "2⁴ = 16." },
      { q: "Trois interruptions arrivent en même temps. Quel bloc choisit laquelle servir ?", options: ["Un multiplexeur", "Un décodeur", "Un encodeur de priorité", "Un additionneur"], answer: 2, explain: "Il sort le numéro de la demande active la plus prioritaire." }
    ],
    challenge: {
      prompt: `<p>Les bits de sélection sont donnés poids faible en premier. Écris @@mux(entrees, sel)@@ (l'entrée choisie), @@decodeur(sel)@@ (liste de @@2ⁿ@@ bits avec un seul 1) et @@encodeur_priorite(demandes)@@ qui renvoie l'indice du 1 <strong>le plus élevé</strong> de la liste (la priorité la plus haute), ou @@None@@ s'il n'y en a aucun.</p>`,
      starter: PY`def mux(entrees, sel):
    return entrees[0]


def decodeur(sel):
    return [0] * (2 ** len(sel))


def encodeur_priorite(demandes):
    return demandes.index(1)
`,
      solution: PY`def valeur(sel):
    return sum(b << i for i, b in enumerate(sel))


def mux(entrees, sel):
    return entrees[valeur(sel)]


def decodeur(sel):
    sortie = [0] * (2 ** len(sel))
    sortie[valeur(sel)] = 1
    return sortie


def encodeur_priorite(demandes):
    for i in range(len(demandes) - 1, -1, -1):
        if demandes[i]:
            return i
    return None
`,
      tests: PY`print(mux(["A", "B", "C", "D"], [1, 0]), mux(["A", "B", "C", "D"], [1, 1]), mux(list("abcdefgh"), [0, 1, 1]))
print(decodeur([0, 0]), decodeur([1, 0, 1]))
print(encodeur_priorite([1, 0, 1, 1, 0]), encodeur_priorite([1, 0, 0]), encodeur_priorite([0, 0, 0]))
`,
      expected: "B D g\n[1, 0, 0, 0] [0, 0, 0, 0, 0, 1, 0, 0]\n3 0 None\n",
      hint: "La valeur de la sélection vaut sum(b << i for i, b in enumerate(sel)). Pour la priorité, parcours la liste à l'envers."
    }
  }
];
