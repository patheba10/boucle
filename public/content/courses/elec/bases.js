/* Cours Électronique — chapitre 1 : tension, courant, résistance, puissance, lois de Kirchhoff, diviseurs et convertisseur
   analogique-numérique. Les défis calculent des circuits réels en Python pur (aucun paquet : tout tourne hors ligne). */
const PY = String.raw;

export const LAB = `<p><strong>Sur ta machine</strong> : le simulateur de circuits gratuit <em>Falstad</em> (falstad.com/circuit) tourne dans le navigateur ; refais chaque circuit de la leçon et compare ses mesures à tes calculs. Pour le réel, un kit de démarrage (plaque d'essai, résistances, LED, quelques transistors) et un multimètre à 20 € suffisent pour tout ce chapitre.</p>`;

export const E12 = PY`import math

E12 = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2]


def valeurs_e12(mini=1.0, maxi=10e6):
    """Toutes les valeurs normalisées E12 entre mini et maxi (ohms)."""
    vals = []
    for d in range(0, 8):
        for m in E12:
            v = round(m * 10 ** d, 6)
            if mini <= v <= maxi:
                vals.append(v)
    return vals


def e12_au_dessus(r):
    """La plus petite valeur E12 supérieure ou égale à r."""
    return min(v for v in valeurs_e12() if v >= r * (1 - 1e-9))


def e12_en_dessous(r):
    """La plus grande valeur E12 inférieure ou égale à r."""
    return max(v for v in valeurs_e12() if v <= r * (1 + 1e-9))
`;

export default [
  {
    id: "el-01", section: "Les bases", title: "Tension, courant, résistance : la loi d'Ohm", xp: 80,
    theory: `<p>Trois grandeurs décrivent un circuit :</p>
<ul><li>la <strong>tension</strong> @@U@@, en volts (V) : la « pression » électrique entre deux points, toujours mesurée <em>entre</em> deux points (souvent par rapport à la masse, 0 V) ;</li><li>le <strong>courant</strong> @@I@@, en ampères (A) : le débit de charges qui traverse un fil ; dans l'embarqué on parle surtout en milliampères (mA) et microampères (µA) ;</li><li>la <strong>résistance</strong> @@R@@, en ohms (Ω) : l'opposition au passage du courant.</li></ul>
<p>La <strong>loi d'Ohm</strong> les relie : @@U = R × I@@, donc @@I = U / R@@ et @@R = U / I@@. Une résistance de 1 kΩ sous 5 V laisse passer 5 mA. Une broche de microcontrôleur fournit typiquement 10 à 20 mA au maximum : la loi d'Ohm dit tout de suite si un montage la détruira.</p>
~~~py
u, r = 5.0, 1000.0          # 5 V aux bornes d'une résistance de 1 kΩ
i = u / r
print(i, "A, soit", i * 1000, "mA")
print("court-circuit sur 0,1 Ω :", 5.0 / 0.1, "A")
~~~
<p>Les préfixes du système international évitent les zéros : p (10⁻¹²), n (10⁻⁹), µ (10⁻⁶), m (10⁻³), k (10³), M (10⁶). 0,0042 A s'écrit 4,2 mA ; 4 700 Ω s'écrit 4,7 kΩ (et souvent « 4k7 » sur un schéma).</p>
<p>Image utile : la tension est la différence de hauteur d'eau, le courant le débit, la résistance l'étroitesse du tuyau. Elle a ses limites, mais elle suffit pour raisonner sur la plupart des circuits du cours.</p>`,
    setup: LAB,
    quiz: [
      { q: "Une résistance de 220 Ω est alimentée sous 3,3 V. Quel courant ?", options: ["15 mA", "1,5 mA", "150 mA", "0,73 A"], answer: 0, explain: "3,3 / 220 = 0,015 A, soit 15 mA." },
      { q: "Pourquoi dit-on qu'une tension se mesure toujours entre deux points ?", options: ["C'est une convention de notation", "Parce que c'est une différence de potentiel : « 5 V » sous-entend « par rapport à la masse »", "Parce que le voltmètre a deux fils", "Ce n'est vrai qu'en alternatif"], answer: 1, explain: "On choisit un point de référence, la masse, à 0 V." }
    ],
    challenge: {
      prompt: `<p>Écris @@courant(u, r)@@ et @@resistance(u, i)@@ (loi d'Ohm), puis @@format_si(valeur, unite)@@ qui écrit une grandeur avec le bon préfixe : la mantisse est entre 1 et 1000, avec au plus 3 chiffres significatifs (@@f"{m:.3g}"@@), un espace, puis le préfixe collé à l'unité. Préfixes de p à M ; 0 s'écrit @@"0 A"@@.</p>`,
      starter: PY`def courant(u, r):
    return r / u


def resistance(u, i):
    return u * i


def format_si(valeur, unite):
    return str(valeur) + " " + unite
`,
      solution: PY`PREFIXES = [(1e6, "M"), (1e3, "k"), (1.0, ""), (1e-3, "m"), (1e-6, "µ"), (1e-9, "n"), (1e-12, "p")]


def courant(u, r):
    return u / r


def resistance(u, i):
    return u / i


def format_si(valeur, unite):
    if valeur == 0:
        return "0 " + unite
    for facteur, prefixe in PREFIXES:
        if abs(valeur) >= facteur * (1 - 1e-12):
            break
    m = float(f"{valeur / facteur:.3g}")
    return f"{m:g} {prefixe}{unite}"
`,
      tests: PY`print(format_si(courant(3.3, 220), "A"))
print(format_si(courant(5, 4700), "A"))
print(format_si(resistance(12, 0.0025), "Ω"))
print(format_si(4700, "Ω"), "|", format_si(2.2e6, "Ω"), "|", format_si(1e-7, "F"), "|", format_si(0, "A"))
print(format_si(-0.25, "A"), "|", format_si(0.5, "V"), "|", format_si(47e-12, "F"))
`,
      expected: "15 mA\n1.06 mA\n4.8 kΩ\n4.7 kΩ | 2.2 MΩ | 100 nF | 0 A\n-250 mA | 500 mV | 47 pF\n",
      hint: "Parcours les préfixes du plus grand au plus petit et prends le premier facteur tel que |valeur| ≥ facteur ; la mantisse est valeur / facteur, arrondie avec f\"{m:.3g}\"."
    }
  },
  {
    id: "el-02", section: "Les bases", title: "Puissance et énergie", xp: 80,
    theory: `<p>La <strong>puissance</strong> (en watts) est l'énergie consommée chaque seconde : @@P = U × I@@. Avec la loi d'Ohm, pour une résistance : @@P = R × I² = U² / R@@. Cette puissance part en chaleur : une résistance trop petite pour sa puissance chauffe, change de valeur, puis brûle.</p>
~~~py
u, r = 12.0, 100.0
i = u / r
print("courant :", i, "A")
print("puissance :", u * i, "W =", r * i ** 2, "W =", u ** 2 / r, "W")
~~~
<p>Les résistances traversantes courantes sont prévues pour 1/4 W ; il existe des modèles 1/2 W, 1 W, 2 W, 5 W. Règle de conception : choisir une puissance <strong>nominale au moins double</strong> de la puissance dissipée, pour garder une marge thermique. Les résistances CMS 0603 tiennent seulement 0,1 W.</p>
<p>L'<strong>énergie</strong> est la puissance dans le temps : @@E = P × t@@, en joules (W·s) ou en wattheures. Les batteries s'expriment en milliampères-heures (mAh) : 2 000 mAh fournissent 2 000 mA pendant une heure, ou 20 mA pendant 100 heures, à leur tension nominale (3,7 V pour un élément lithium-ion, soit 7,4 Wh).</p>`,
    setup: LAB,
    quiz: [
      { q: "Une résistance de 47 Ω sous 5 V dissipe environ :", options: ["0,1 W", "0,53 W : une 1/4 W va brûler", "2,35 W", "0,02 W"], answer: 1, explain: "U²/R = 25/47 ≈ 0,53 W : il faut une 1 W, ou mieux 2 W avec la marge." },
      { q: "Une batterie de 1 000 mAh alimente un montage de 50 mA. Autonomie théorique ?", options: ["50 h", "20 h", "5 h", "2 h"], answer: 1, explain: "1 000 / 50 = 20 h, en pratique un peu moins." }
    ],
    challenge: {
      prompt: `<p>Écris @@puissance(u, r)@@ (watts dissipés par une résistance @@r@@ sous la tension @@u@@) et @@puissance_nominale(u, r)@@ qui choisit, dans @@NOMINALES = [0.125, 0.25, 0.5, 1, 2, 5]@@, la plus petite puissance au moins <strong>double</strong> de la puissance dissipée ; @@None@@ si aucune ne convient.</p>`,
      starter: PY`NOMINALES = [0.125, 0.25, 0.5, 1, 2, 5]


def puissance(u, r):
    return u * r


def puissance_nominale(u, r):
    return 0.25
`,
      solution: PY`NOMINALES = [0.125, 0.25, 0.5, 1, 2, 5]


def puissance(u, r):
    return u ** 2 / r


def puissance_nominale(u, r):
    besoin = 2 * puissance(u, r)
    for p in NOMINALES:
        if p >= besoin:
            return p
    return None
`,
      tests: PY`print(round(puissance(5, 47), 3), puissance_nominale(5, 47))
print(round(puissance(3.3, 1000), 4), puissance_nominale(3.3, 1000))
print(round(puissance(12, 100), 2), puissance_nominale(12, 100))
print(puissance_nominale(5, 100), puissance_nominale(24, 10))
`,
      expected: "0.532 2\n0.0109 0.125\n1.44 5\n0.5 None\n",
      hint: "P = U² / R ; parcours NOMINALES dans l'ordre et renvoie la première valeur ≥ 2 × P."
    }
  },
  {
    id: "el-03", section: "Les bases", title: "Résistances en série, en parallèle, valeurs normalisées", xp: 90,
    theory: `<p>En <strong>série</strong>, le même courant traverse toutes les résistances : elles s'additionnent, @@R = R₁ + R₂ + …@@. En <strong>parallèle</strong>, elles partagent la même tension : ce sont les inverses qui s'additionnent, @@1/R = 1/R₁ + 1/R₂ + …@@ ; le résultat est toujours plus petit que la plus petite. Deux résistances égales en parallèle valent la moitié de l'une.</p>
~~~py
r1, r2 = 1000, 2200
print("série :", r1 + r2)
print("parallèle :", round(1 / (1 / r1 + 1 / r2), 1))
print("formule à deux :", round(r1 * r2 / (r1 + r2), 1))
~~~
<p>On ne trouve pas n'importe quelle valeur dans le commerce : les résistances suivent des <strong>séries normalisées</strong>. La série <strong>E12</strong> (tolérance 10 %, souvent 5 %) compte 12 valeurs par décade, réparties de façon géométrique :</p>
~~~text
1,0  1,2  1,5  1,8  2,2  2,7  3,3  3,9  4,7  5,6  6,8  8,2   (× 1, 10, 100, 1 k, 10 k, 100 k, 1 M)
~~~
<p>Comme l'écart est proportionnel, la valeur « la plus proche » se juge en <strong>rapport</strong> (sur une échelle logarithmique), pas en différence : entre 10 Ω et 12 Ω, 10,9 Ω est plus proche de 10 (×1,09) que de 12 (×1,10). Les séries E24, E48 et E96 (1 %) sont plus fines.</p>`,
    setup: LAB,
    quiz: [
      { q: "Trois résistances de 3,3 kΩ en parallèle valent :", options: ["9,9 kΩ", "1,1 kΩ", "3,3 kΩ", "0,33 kΩ"], answer: 1, explain: "n résistances égales en parallèle : R / n." },
      { q: "Pourquoi les valeurs E12 sont-elles réparties de façon géométrique ?", options: ["Par tradition", "Pour que l'écart relatif entre deux valeurs voisines soit constant (environ 20 %), cohérent avec la tolérance", "Pour faciliter les calculs de tête", "Parce que les grandes valeurs sont plus rares"], answer: 1, explain: "Chaque valeur vaut environ 1,21 fois la précédente : la racine douzième de 10." }
    ],
    challenge: {
      prompt: `<p>Écris @@serie(*r)@@, @@parallele(*r)@@ et @@e12_proche(r)@@ qui renvoie la valeur de @@valeurs_e12()@@ (fournie) la plus proche de @@r@@ <strong>en rapport</strong> : celle qui minimise @@abs(math.log(v / r))@@.</p>`,
      starter: E12 + PY`

def serie(*r):
    return max(r)


def parallele(*r):
    return sum(r) / len(r)


def e12_proche(r):
    return min(valeurs_e12(), key=lambda v: abs(v - r))
`,
      solution: E12 + PY`

def serie(*r):
    return sum(r)


def parallele(*r):
    return 1 / sum(1 / x for x in r)


def e12_proche(r):
    return min(valeurs_e12(), key=lambda v: abs(math.log(v / r)))
`,
      tests: PY`print(serie(1000, 2200, 470), round(parallele(1000, 2200), 1), round(parallele(3300, 3300, 3300), 1))
print(e12_proche(10.9), e12_proche(742.9), e12_proche(5000), e12_proche(150))
print(e12_proche(serie(4700, 4700)), e12_proche(parallele(10000, 4700)))
`,
      expected: "3670 687.5 1100.0\n10.0 680.0 4700.0 150.0\n10000.0 3300.0\n",
      hint: "parallele : 1 / sum(1 / x for x in r). e12_proche : min(valeurs_e12(), key=lambda v: abs(math.log(v / r)))."
    }
  },
  {
    id: "el-04", section: "Les bases", title: "Les lois de Kirchhoff", xp: 100,
    theory: `<p>Deux lois suffisent à analyser n'importe quel circuit :</p>
<ul><li><strong>loi des nœuds</strong> : la somme des courants qui entrent dans un nœud est égale à la somme de ceux qui en sortent (rien ne s'accumule dans un fil) ;</li><li><strong>loi des mailles</strong> : le long d'une boucle fermée, la somme des tensions est nulle (en revenant au point de départ, on retrouve le même potentiel).</li></ul>
<p>Un cas fréquent : plusieurs branches, chacune une source @@Eₖ@@ en série avec une résistance @@Rₖ@@, reliées à un même nœud. En écrivant la loi des nœuds avec @@Iₖ = (Eₖ − V) / Rₖ@@, on obtient le <strong>théorème de Millman</strong> :</p>
~~~text
        E₁/R₁ + E₂/R₂ + … + Eₙ/Rₙ
  V  =  ─────────────────────────        (une branche reliée à la masse a E = 0)
         1/R₁ + 1/R₂ + … + 1/Rₙ
~~~
~~~py
branches = [(5.0, 1000.0), (0.0, 1000.0)]   # 5 V par 1 kΩ, et 1 kΩ vers la masse
v = sum(e / r for e, r in branches) / sum(1 / r for e, r in branches)
print("tension du nœud :", v)
print("courants entrants :", [round((e - v) / r * 1000, 3) for e, r in branches], "mA")
~~~
<p>La somme des courants entrants est nulle, comme l'impose la loi des nœuds : c'est la vérification à faire à chaque calcul. Cas pratique : deux alimentations reliées par des résistances, ou un capteur dont la sortie charge un autre circuit.</p>`,
    setup: LAB,
    quiz: [
      { q: "Dans un nœud, 30 mA entrent par une branche et 12 mA sortent par une autre. Une troisième branche :", options: ["Fait entrer 18 mA", "Fait sortir 18 mA", "Ne porte aucun courant", "Fait sortir 42 mA"], answer: 1, explain: "Ce qui entre (30) égale ce qui sort (12 + 18)." },
      { q: "Que dit la loi des mailles ?", options: ["Le courant est le même partout", "La somme des tensions le long d'une boucle fermée est nulle", "La puissance se conserve", "Les résistances s'additionnent"], answer: 1, explain: "On revient au même potentiel en faisant le tour." }
    ],
    challenge: {
      prompt: `<p>Écris @@millman(branches)@@ qui reçoit une liste de couples @@(E, R)@@ et renvoie la tension du nœud commun, puis @@courants(branches)@@ qui renvoie la liste des courants <strong>entrant</strong> dans le nœud par chaque branche, en ampères.</p><p>Le test vérifie aussi la loi des nœuds : la somme de ces courants doit être nulle.</p>`,
      starter: PY`def millman(branches):
    return sum(e for e, r in branches) / len(branches)


def courants(branches):
    return [e / r for e, r in branches]
`,
      solution: PY`def millman(branches):
    return sum(e / r for e, r in branches) / sum(1 / r for e, r in branches)


def courants(branches):
    v = millman(branches)
    return [(e - v) / r for e, r in branches]
`,
      tests: PY`print(millman([(5, 1000), (0, 1000)]))
b = [(12, 100), (9, 50), (0, 1000)]
print(round(millman(b), 3), [round(i * 1000, 2) for i in courants(b)])
print("loi des nœuds :", abs(sum(courants(b))) < 1e-12)
print(round(millman([(3.3, 10000), (0, 10000), (5, 10000)]), 3))
`,
      expected: "2.5\n9.677 [23.23, -13.55, -9.68]\nloi des nœuds : True\n2.767\n",
      hint: "V = Σ(E/R) / Σ(1/R), puis chaque courant entrant vaut (E − V) / R."
    }
  },
  {
    id: "el-05", section: "Les bases", title: "Diviseur de tension et convertisseur analogique-numérique", xp: 100,
    theory: `<p>Deux résistances en série entre @@Vin@@ et la masse forment un <strong>diviseur de tension</strong> : au point milieu, @@Vout = Vin × R2 / (R1 + R2)@@. C'est le montage le plus courant de l'électronique : lire un potentiomètre, une thermistance ou une photorésistance, ramener 5 V à 3,3 V, mesurer la tension d'une batterie.</p>
~~~py
vin, r1, r2 = 4.2, 100e3, 100e3   # batterie Li-ion pleine, pont de deux 100 kΩ
vout = vin * r2 / (r1 + r2)
print("tension lue :", vout, "V")
print("courant permanent :", round(vin / (r1 + r2) * 1e6, 1), "µA")
~~~
<p>Attention à la <strong>charge</strong> : si ce qu'on branche au point milieu tire du courant, la tension baisse (la charge se met en parallèle sur R2). Règle : l'impédance de charge doit être au moins dix fois plus grande que R2. De grandes résistances consomment peu (utile sur batterie) mais rendent le point milieu sensible au bruit et aux entrées des convertisseurs.</p>
<p>Un microcontrôleur lit une tension avec son <strong>convertisseur analogique-numérique</strong> (ADC) : sur @@n@@ bits, il découpe @@[0, Vref]@@ en @@2ⁿ@@ marches. Le code lu vaut environ @@V / Vref × 2ⁿ@@, borné à @@2ⁿ − 1@@ ; inversement @@V ≈ code × Vref / 2ⁿ@@. Un ADC 12 bits sous 3,3 V a une résolution de 3,3 / 4096 ≈ 0,8 mV par pas.</p>`,
    setup: LAB,
    quiz: [
      { q: "Pour lire une batterie de 0 à 8,4 V avec un ADC limité à 3,3 V, quel diviseur ?", options: ["R1 = R2", "R2 / (R1 + R2) ≤ 3,3 / 8,4, par exemple R1 = 22 kΩ et R2 = 12 kΩ", "Une seule résistance de 10 kΩ", "Aucun : l'ADC supporte 8,4 V"], answer: 1, explain: "8,4 × 12 / 34 ≈ 2,96 V : sous les 3,3 V, avec une marge." },
      { q: "Combien de pas compte un ADC 10 bits ?", options: ["10", "100", "1 024", "4 096"], answer: 2, explain: "2¹⁰ = 1 024 (Arduino Uno) ; 12 bits donnent 4 096 (ESP32, STM32)." }
    ],
    challenge: {
      prompt: `<p>Écris @@diviseur(vin, r1, r2, charge=None)@@ : la tension du point milieu, où @@charge@@ (en ohms) est une résistance branchée en parallèle sur @@r2@@ quand elle est donnée. Puis @@code_adc(v, vref, bits)@@ : @@int(v / vref * 2**bits)@@ borné entre 0 et @@2**bits − 1@@, et @@tension_adc(code, vref, bits)@@ : @@code * vref / 2**bits@@.</p>`,
      starter: PY`def diviseur(vin, r1, r2, charge=None):
    return vin * r1 / (r1 + r2)


def code_adc(v, vref, bits):
    return int(v / vref * bits)


def tension_adc(code, vref, bits):
    return code / vref
`,
      solution: PY`def diviseur(vin, r1, r2, charge=None):
    if charge is not None:
        r2 = r2 * charge / (r2 + charge)
    return vin * r2 / (r1 + r2)


def code_adc(v, vref, bits):
    return max(0, min(int(v / vref * 2 ** bits), 2 ** bits - 1))


def tension_adc(code, vref, bits):
    return code * vref / 2 ** bits
`,
      tests: PY`print(diviseur(4.2, 100e3, 100e3), round(diviseur(5, 10e3, 20e3), 3), round(diviseur(5, 10e3, 20e3, charge=20e3), 3))
c = code_adc(diviseur(4.2, 100e3, 100e3), 3.3, 12)
print(c, round(tension_adc(c, 3.3, 12) * 2, 3))
print(code_adc(3.5, 3.3, 12), code_adc(-0.2, 3.3, 12), code_adc(2.5, 5.0, 10))
`,
      expected: "2.1 3.333 2.5\n2606 4.199\n4095 0 512\n",
      hint: "Avec une charge, remplace r2 par r2 ∥ charge = r2 × charge / (r2 + charge). Pour l'ADC, borne avec max(0, min(code, 2**bits − 1))."
    }
  }
];
