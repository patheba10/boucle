/* Cours Logique numérique — chapitre 2 : bascules, registres et compteurs, machines à états, unité arithmétique et
   logique ; entretien. */
import { LAB } from "./combinatoire.js";
const PY = String.raw;

export default [
  {
    id: "ln-06", section: "Logique séquentielle", title: "Verrous et bascules : la mémoire d'un bit", xp: 100,
    theory: `<p>Un circuit <strong>séquentiel</strong> a de la mémoire : sa sortie dépend aussi de son passé. La brique de base est le <strong>verrou SR</strong> (set-reset), deux portes NON-OU rebouclées l'une sur l'autre :</p>
~~~text
 S R │ Q suivant
 0 0 │ Q        (mémorise)
 1 0 │ 1        (mise à 1)
 0 1 │ 0        (mise à 0)
 1 1 │ interdit (les deux sorties à 0, état indéterminé au relâchement)
~~~
<p>La <strong>bascule D</strong> (D flip-flop) résout le problème et rythme tout le numérique : elle recopie son entrée @@D@@ sur sa sortie @@Q@@ <strong>uniquement au front montant de l'horloge</strong>, le passage de 0 à 1, et garde cette valeur le reste du temps. Toutes les bascules d'un circuit changent au même instant : c'est la logique <strong>synchrone</strong>, qui rend le comportement prévisible.</p>
~~~text
horloge  _|‾|_|‾|_|‾|_|‾|_
D        ‾‾‾‾‾|____|‾‾‾‾‾‾
Q        ‾‾‾‾‾‾‾|____|‾‾‾‾     Q ne change qu'aux fronts montants
~~~
<p>Contrainte physique : @@D@@ doit être stable un peu avant le front (temps de <em>setup</em>) et un peu après (temps de <em>hold</em>). Un signal extérieur asynchrone, comme un bouton, peut violer ces temps et rendre la bascule <strong>métastable</strong> ; on le synchronise en le faisant passer par deux bascules en série.</p>`,
    setup: LAB,
    quiz: [
      { q: "Quand une bascule D recopie-t-elle son entrée ?", options: ["En permanence", "Au front montant de l'horloge seulement", "Quand D vaut 1", "Quand l'horloge vaut 0"], answer: 1, explain: "Entre deux fronts, Q garde sa valeur quelles que soient les variations de D." },
      { q: "Pourquoi faire passer un bouton par deux bascules avant de l'utiliser ?", options: ["Pour l'anti-rebond", "Pour le synchroniser avec l'horloge et laisser se résoudre une éventuelle métastabilité", "Pour doubler sa fréquence", "Pour l'inverser"], answer: 1, explain: "C'est le synchroniseur à deux étages, standard pour tout signal asynchrone." }
    ],
    challenge: {
      prompt: `<p>Écris @@verrou_sr(s, r, q)@@ qui renvoie l'état suivant d'un verrou SR (lève @@ValueError@@ pour l'état interdit), puis une classe @@BasculeD@@ : @@q@@ vaut 0 au départ, et la méthode @@horloge(clk, d)@@ reçoit le niveau de l'horloge et l'entrée, met @@q@@ à jour <strong>seulement sur un front montant</strong> (horloge précédente 0, actuelle 1) et renvoie @@q@@.</p>`,
      starter: PY`def verrou_sr(s, r, q):
    return s


class BasculeD:
    def __init__(self):
        self.q = 0

    def horloge(self, clk, d):
        self.q = d
        return self.q
`,
      solution: PY`def verrou_sr(s, r, q):
    if s and r:
        raise ValueError("état interdit : S et R à 1")
    if s:
        return 1
    if r:
        return 0
    return q


class BasculeD:
    def __init__(self):
        self.q = 0
        self._clk = 0

    def horloge(self, clk, d):
        if self._clk == 0 and clk == 1:
            self.q = d
        self._clk = clk
        return self.q
`,
      tests: PY`q = 0
for s, r in [(1, 0), (0, 0), (0, 1), (0, 0)]:
    q = verrou_sr(s, r, q)
    print(q, end=" ")
try:
    verrou_sr(1, 1, 0)
except ValueError:
    print("| ValueError")
b = BasculeD()
clk = [0, 1, 1, 0, 1, 0, 0, 1, 1, 0]
d = [1, 1, 0, 0, 0, 1, 1, 1, 0, 0]
print([b.horloge(c, x) for c, x in zip(clk, d)])
`,
      expected: "1 1 0 0 | ValueError\n[0, 1, 1, 1, 0, 0, 0, 1, 1, 1]\n",
      hint: "Mémorise le niveau précédent de l'horloge dans l'objet (self._clk) ; il y a front montant quand il valait 0 et que clk vaut 1."
    }
  },
  {
    id: "ln-07", section: "Logique séquentielle", title: "Registres à décalage et compteurs", xp: 100,
    theory: `<p>En alignant des bascules D sur la même horloge, on obtient un <strong>registre</strong> qui mémorise un mot de @@n@@ bits. Deux montages sont partout dans l'embarqué :</p>
<ul><li>le <strong>registre à décalage</strong> : à chaque front, chaque bascule prend la valeur de sa voisine. Un bit entre en série, le mot sort en parallèle. Le 74HC595 transforme ainsi 3 broches d'un microcontrôleur en 8 sorties, et le bit qui « déborde » ressort par une broche série vers le registre suivant : on en chaîne autant qu'on veut. C'est aussi le principe des liaisons série (SPI, UART) ;</li><li>le <strong>compteur</strong> : un registre qui s'incrémente à chaque front. Un compteur modulo @@N@@ revient à 0 après @@N − 1@@ et produit une <strong>retenue</strong> à ce moment. Les <em>timers</em> d'un microcontrôleur sont des compteurs : 16 bits à 1 MHz débordent toutes les 65,536 ms, et ce débordement déclenche une interruption.</li></ul>
~~~py
f_horloge, prescaler, bits = 16_000_000, 64, 16      # Arduino Uno, timer 1
f_compteur = f_horloge / prescaler
print("pas :", 1e6 / f_compteur, "µs ; débordement toutes les", 2**bits / f_compteur * 1000, "ms")
~~~
<p>Le diviseur d'entrée (<em>prescaler</em>) ralentit l'horloge du compteur ; avec une valeur de comparaison, le timer produit une interruption périodique ou un signal PWM, comme on le verra dans le cours d'embarqué.</p>`,
    setup: LAB,
    quiz: [
      { q: "Combien de broches faut-il pour piloter 32 LED avec quatre 74HC595 chaînés ?", options: ["32", "8", "3 (données, horloge, verrou)", "4"], answer: 2, explain: "Les registres se chaînent par leur sortie série : 32 bits entrent par la même ligne de données." },
      { q: "Un timer 8 bits compte à 250 kHz. Toutes les combien déborde-t-il ?", options: ["1,024 ms", "4 µs", "250 ms", "8 ms"], answer: 0, explain: "256 pas de 4 µs : 1,024 ms." }
    ],
    challenge: {
      prompt: `<p>Écris une classe @@RegistreDecalage(n)@@ (valeur 0 au départ) avec @@decaler(bit)@@, qui fait entrer @@bit@@ par le poids faible, décale vers le poids fort et renvoie le bit qui sort (l'ancien bit de poids fort), et @@valeur()@@. Puis une classe @@Compteur(modulo)@@ avec @@valeur@@ (0 au départ) et @@tic()@@ qui incrémente, revient à 0 après @@modulo − 1@@ et renvoie la retenue (1 au retour à 0, sinon 0).</p><p>Le test chaîne deux registres de 8 bits comme deux 74HC595.</p>`,
      starter: PY`class RegistreDecalage:
    def __init__(self, n):
        self.n = n
        self.v = 0

    def decaler(self, bit):
        self.v = bit
        return 0

    def valeur(self):
        return self.v


class Compteur:
    def __init__(self, modulo):
        self.modulo = modulo
        self.valeur = 0

    def tic(self):
        self.valeur += 1
        return 0
`,
      solution: PY`class RegistreDecalage:
    def __init__(self, n):
        self.n = n
        self.v = 0

    def decaler(self, bit):
        sortant = (self.v >> (self.n - 1)) & 1
        self.v = ((self.v << 1) | bit) & ((1 << self.n) - 1)
        return sortant

    def valeur(self):
        return self.v


class Compteur:
    def __init__(self, modulo):
        self.modulo = modulo
        self.valeur = 0

    def tic(self):
        self.valeur = (self.valeur + 1) % self.modulo
        return 1 if self.valeur == 0 else 0
`,
      tests: PY`premier, second = RegistreDecalage(8), RegistreDecalage(8)
mot = 0xA5C3
for i in range(15, -1, -1):              # poids fort en premier, comme shiftOut(MSBFIRST)
    second.decaler(premier.decaler((mot >> i) & 1))
print(hex(second.valeur()), hex(premier.valeur()))
c = Compteur(10)
retenues = [c.tic() for _ in range(25)]
print(c.valeur, sum(retenues), retenues[:10])
`,
      expected: "0xa5 0xc3\n5 2 [0, 0, 0, 0, 0, 0, 0, 0, 0, 1]\n",
      hint: "Le bit sortant vaut (v >> (n − 1)) & 1 ; le nouveau mot vaut ((v << 1) | bit) masqué sur n bits. Pour le compteur, (valeur + 1) % modulo."
    }
  },
  {
    id: "ln-08", section: "Logique séquentielle", title: "Machines à états finis", xp: 120,
    theory: `<p>Une <strong>machine à états finis</strong> décrit un système qui passe d'un état à l'autre selon ses entrées : un feu tricolore, un distributeur, un protocole de communication, l'interface d'un appareil à boutons. On la dessine avant de la coder :</p>
~~~text
            5 s                 2 s                 4 s
   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
──▶│     VERT     │───▶│    ORANGE    │───▶│    ROUGE     │──┐
   └──────────────┘    └──────────────┘    └──────────────┘  │
          ▲   bouton piéton : passe à l'orange plus tôt        │
          └────────────────────────────────────────────────────┘
~~~
<p>En matériel, l'état est rangé dans un registre et une logique combinatoire calcule l'état suivant à chaque front d'horloge. En logiciel embarqué, c'est le motif le plus utile qui soit : une variable @@etat@@, un @@switch@@ (ou un dictionnaire), et une fonction appelée périodiquement, sans jamais bloquer avec des @@delay()@@. Deux familles :</p>
<ul><li><strong>Moore</strong> : les sorties ne dépendent que de l'état (la couleur du feu) ;</li><li><strong>Mealy</strong> : elles dépendent de l'état et de l'entrée (un détecteur de séquence qui sort 1 au moment où le dernier bit arrive).</li></ul>
~~~py
SUIVANT = {"verrouille": {"piece": "deverrouille", "pousse": "verrouille"},
           "deverrouille": {"piece": "deverrouille", "pousse": "verrouille"}}
etat = "verrouille"
for evenement in ["pousse", "piece", "pousse", "pousse"]:
    etat = SUIVANT[etat][evenement]
    print(evenement, "→", etat)
~~~`,
    setup: LAB,
    quiz: [
      { q: "Dans une machine de Moore, les sorties dépendent :", options: ["De l'entrée seulement", "De l'état seulement", "De l'état et de l'entrée", "De l'horloge"], answer: 1, explain: "Mealy fait dépendre les sorties de l'état et de l'entrée." },
      { q: "Pourquoi éviter delay() dans une machine à états embarquée ?", options: ["Il consomme trop de mémoire", "Il bloque le programme : plus rien d'autre (boutons, communication) n'est traité pendant l'attente", "Il est imprécis", "Il n'existe pas en C"], answer: 1, explain: "On compte plutôt le temps passé dans l'état à chaque appel." }
    ],
    challenge: {
      prompt: `<p>Écris une classe @@Feu@@ : état initial @@"vert"@@ avec @@DUREES = {"vert": 5, "orange": 2, "rouge": 4}@@ (en secondes). La méthode @@tic(bouton=False)@@ fait avancer d'une seconde et renvoie l'état après ce tic : on compte le temps passé dans l'état, et quand il atteint la durée de l'état, on passe au suivant (vert → orange → rouge → vert) avec un compteur remis à 0.</p><p>Bouton piéton : si @@bouton@@ est vrai pendant le vert, le temps passé est porté à au moins @@DUREES["vert"] − 2@@ <em>avant</em> d'avancer, de sorte que le feu passe à l'orange au plus tard deux secondes après l'appui.</p>`,
      starter: PY`DUREES = {"vert": 5, "orange": 2, "rouge": 4}


class Feu:
    def __init__(self):
        self.etat = "vert"

    def tic(self, bouton=False):
        return self.etat
`,
      solution: PY`DUREES = {"vert": 5, "orange": 2, "rouge": 4}
SUIVANT = {"vert": "orange", "orange": "rouge", "rouge": "vert"}


class Feu:
    def __init__(self):
        self.etat = "vert"
        self.t = 0

    def tic(self, bouton=False):
        if bouton and self.etat == "vert":
            self.t = max(self.t, DUREES["vert"] - 2)
        self.t += 1
        if self.t >= DUREES[self.etat]:
            self.etat = SUIVANT[self.etat]
            self.t = 0
        return self.etat
`,
      tests: PY`f = Feu()
print("".join(f.tic()[0] for _ in range(13)))
f = Feu()
print("".join(f.tic(bouton=(i == 0))[0] for i in range(13)))
f = Feu()
print("".join(f.tic(bouton=(i == 11))[0] for i in range(16)))
f = Feu()
print("".join(f.tic(bouton=True)[0] for _ in range(10)))
`,
      expected: "vvvvoorrrrvvv\nvoorrrrvvvvvo\nvvvvoorrrrvvoorr\nvoorrrrvvo\n",
      hint: "Garde le temps passé dans l'état (self.t). Si bouton et vert : self.t = max(self.t, 3). Puis self.t += 1 ; si self.t >= DUREES[self.etat], passe à l'état suivant et remets self.t à 0."
    }
  },
  {
    id: "ln-09", section: "Logique séquentielle", title: "Du circuit au processeur : l'unité arithmétique et logique", xp: 120,
    theory: `<p>Un processeur assemble tout ce qui précède : des <strong>registres</strong> (bascules), une <strong>unité arithmétique et logique</strong> (ALU : additionneurs, portes, multiplexeur qui choisit l'opération), des bus et une machine à états qui enchaîne lecture de l'instruction, décodage, exécution. L'horloge cadence le tout ; sa fréquence maximale est limitée par le <strong>chemin critique</strong>, le trajet combinatoire le plus lent entre deux bascules : @@f_max = 1 / t_critique@@.</p>
<p>Après chaque opération, l'ALU positionne des <strong>drapeaux</strong> dans un registre d'état, que les instructions de saut conditionnel consultent :</p>
~~~text
Z (zero)      le résultat vaut 0
N (négatif)   le bit de poids fort du résultat vaut 1
C (carry)     retenue sortante de l'addition, ou emprunt de la soustraction (a < b en non signé)
V (overflow)  dépassement signé : ADD de deux nombres de même signe donnant le signe opposé ;
              SUB de deux nombres de signes différents dont le résultat n'a pas le signe de a
~~~
<p>Une comparaison @@if (a < b)@@ en C devient une soustraction dont on ne garde que les drapeaux : C pour une comparaison non signée, N et V pour une comparaison signée. Sur un FPGA, on décrit ce matériel dans un langage comme Verilog :</p>
~~~text
always @(posedge clk)            // à chaque front montant
  if (op == ADD) r <= a + b;     // le synthétiseur en fait des portes et des bascules
  else           r <= a - b;
~~~`,
    setup: LAB,
    quiz: [
      { q: "Le chemin critique d'un circuit dure 4 ns. Fréquence d'horloge maximale ?", options: ["4 MHz", "250 MHz", "4 GHz", "25 MHz"], answer: 1, explain: "1 / 4 ns = 250 MHz." },
      { q: "Sur 8 bits, 0x7F + 0x01 donne 0x80. Quels drapeaux ?", options: ["Z et C", "N et V", "C seulement", "Aucun"], answer: 1, explain: "Résultat négatif en signé (N) obtenu à partir de deux positifs : dépassement (V). Pas de retenue sortante." }
    ],
    challenge: {
      prompt: `<p>Écris @@alu(a, b, op, bits=8)@@ pour @@op@@ parmi @@"ADD"@@, @@"SUB"@@, @@"AND"@@, @@"OR"@@, @@"XOR"@@ (sinon @@ValueError@@). @@a@@ et @@b@@ sont des entiers non signés de @@bits@@ bits. Renvoie @@(resultat, drapeaux)@@ où le résultat est masqué sur @@bits@@ bits et @@drapeaux@@ est la chaîne des drapeaux levés parmi @@"ZNCV"@@, dans cet ordre (C et V restent à 0 pour les opérations logiques).</p>`,
      starter: PY`def alu(a, b, op, bits=8):
    return a + b, ""
`,
      solution: PY`def alu(a, b, op, bits=8):
    masque, signe = (1 << bits) - 1, 1 << (bits - 1)
    c = v = 0
    if op == "ADD":
        brut = a + b
        c = brut > masque
        r = brut & masque
        v = (a & signe) == (b & signe) and (r & signe) != (a & signe)
    elif op == "SUB":
        r = (a - b) & masque
        c = a < b
        v = (a & signe) != (b & signe) and (r & signe) != (a & signe)
    elif op == "AND":
        r = a & b
    elif op == "OR":
        r = a | b
    elif op == "XOR":
        r = a ^ b
    else:
        raise ValueError("opération inconnue : " + str(op))
    drapeaux = {"Z": r == 0, "N": bool(r & signe), "C": bool(c), "V": bool(v)}
    return r, "".join(k for k in "ZNCV" if drapeaux[k])
`,
      tests: PY`for a, b, op in [(0x7F, 0x01, "ADD"), (0xFF, 0x01, "ADD"), (0x05, 0x07, "SUB"), (0x80, 0x01, "SUB"),
                 (0x0F, 0xF0, "AND"), (0x0F, 0xF0, "XOR"), (100, 27, "ADD"), (0x2A, 0x2A, "SUB")]:
    r, d = alu(a, b, op)
    print(op, hex(a), hex(b), "→", hex(r), d or "-")
print(alu(0xFFFF, 1, "ADD", bits=16), alu(3, 5, "SUB", bits=4))
`,
      expected: "ADD 0x7f 0x1 → 0x80 NV\nADD 0xff 0x1 → 0x0 ZC\nSUB 0x5 0x7 → 0xfe NC\nSUB 0x80 0x1 → 0x7f V\nAND 0xf 0xf0 → 0x0 Z\nXOR 0xf 0xf0 → 0xff N\nADD 0x64 0x1b → 0x7f -\nSUB 0x2a 0x2a → 0x0 Z\n(0, 'ZC') (14, 'NC')\n",
      hint: "Masque = (1 << bits) − 1, bit de signe = 1 << (bits − 1). ADD : C si a + b > masque ; SUB : C si a < b. Pour V, compare les bits de signe de a, b et du résultat selon la théorie."
    }
  },
  {
    id: "ln-10", section: "Entretien", title: "Questions d'entretien : logique numérique", xp: 60, theoryOnly: true,
    theory: `<p>Ces questions tombent en entretien embarqué, FPGA ou bas niveau. Réponds en dessinant si tu peux.</p>
<div class="qa">
<details><summary>Différence entre logique combinatoire et séquentielle ?</summary><p>Combinatoire : la sortie ne dépend que des entrées actuelles (additionneur, multiplexeur). Séquentielle : elle dépend aussi de l'état mémorisé (bascules, registres, compteurs, machines à états), en général rythmé par une horloge.</p></details>
<details><summary>Qu'est-ce qu'un verrou (latch) par rapport à une bascule (flip-flop) ?</summary><p>Le verrou est transparent tant que son signal de validation est actif ; la bascule ne recopie qu'au front d'horloge. Les conceptions synchrones utilisent des bascules ; un verrou créé par erreur (un if sans else en Verilog) est un bogue classique.</p></details>
<details><summary>Qu'est-ce que la métastabilité et comment s'en protéger ?</summary><p>Quand l'entrée d'une bascule change pendant sa fenêtre setup/hold, la sortie peut rester un moment entre 0 et 1. On synchronise tout signal asynchrone avec deux bascules en série, et on traverse les domaines d'horloge avec des FIFO ou des protocoles de poignée de main.</p></details>
<details><summary>Comment représenter −5 sur 8 bits ? Comment détecter un dépassement ?</summary><p>Complément à deux : inverser 0000 0101 et ajouter 1, soit 1111 1011. Dépassement signé quand deux opérandes de même signe donnent un résultat de signe opposé (drapeau V) ; dépassement non signé par la retenue (drapeau C).</p></details>
<details><summary>Qu'est-ce qui limite la fréquence d'horloge d'un circuit ?</summary><p>Le chemin critique : le délai combinatoire le plus long entre deux bascules, plus les temps de setup et de propagation. On le raccourcit en découpant le calcul en étages séparés par des registres (pipeline).</p></details>
<details><summary>Moore ou Mealy ?</summary><p>Moore : sorties fonction de l'état seul, plus stables, un cycle de retard. Mealy : sorties fonction de l'état et des entrées, réaction plus rapide, mais les sorties peuvent suivre les parasites des entrées.</p></details>
<details><summary>Combien de NAND pour un OU exclusif ?</summary><p>Quatre : m = NAND(a, b), puis NAND(NAND(a, m), NAND(b, m)). NAND est universelle grâce aux lois de De Morgan.</p></details>
</div>`,
    practice: { title: "S'entraîner", body: `<p>Dans Logisim-evolution, câble un additionneur 4 bits à partir d'additionneurs complets, puis un compteur modulo 10 relié à un décodeur 7 segments. Ensuite, sans ordinateur, dessine la machine à états d'un digicode à 4 chiffres (avec retour à l'état initial en cas d'erreur) et code-la en Python avec un dictionnaire de transitions.</p>` },
    quiz: [
      { q: "Un if sans else dans un bloc combinatoire Verilog produit :", options: ["Une erreur de compilation", "Un verrou non voulu, qui mémorise la valeur précédente", "Une bascule D", "Rien de particulier"], answer: 1, explain: "Le synthétiseur doit mémoriser la sortie dans le cas non traité." },
      { q: "Comment passer un signal d'un domaine d'horloge à un autre en sécurité (un bit) ?", options: ["En direct", "Par un synchroniseur à deux bascules dans le domaine de destination", "Avec une porte ET", "En réduisant la fréquence"], answer: 1, explain: "Pour un mot entier, on utilise une FIFO asynchrone ou une poignée de main." }
    ]
  }
];
