/* Cours Électronique — chapitre 2 : condensateurs et RC, diodes et LED, transistors en commutation, MOSFET,
   ampli-op, alimentations ; entretien. */
import { LAB, E12 } from "./bases.js";
const PY = String.raw;

export default [
  {
    id: "el-06", section: "Composants", title: "Condensateurs et circuits RC", xp: 100,
    theory: `<p>Un <strong>condensateur</strong> stocke des charges : @@Q = C × U@@, avec @@C@@ en farads (en pratique pF, nF, µF). La tension à ses bornes ne peut pas sauter d'un coup : il lisse, il retarde, il filtre. Associé à une résistance, il forme un <strong>circuit RC</strong>, de constante de temps @@τ = R × C@@.</p>
~~~text
charge sous V à travers R :   v(t) = V × (1 − e^(−t/τ))
temps pour atteindre Vs :      t = −τ × ln(1 − Vs / V)
fréquence de coupure :         fc = 1 / (2π × R × C)
~~~
~~~py
import math

r, c = 10e3, 100e-9                 # 10 kΩ et 100 nF
tau = r * c
for k in (1, 2, 3, 5):
    print(f"à {k}τ : {100 * (1 - math.exp(-k)):.1f} %")
print("fc =", round(1 / (2 * math.pi * r * c), 1), "Hz")
~~~
<p>À 1τ le condensateur est chargé à 63 %, à 5τ à plus de 99 % : on le considère plein. Usages courants dans l'embarqué :</p>
<ul><li><strong>découplage</strong> : un 100 nF au plus près de chaque broche d'alimentation d'une puce absorbe les pics de courant ;</li><li><strong>anti-rebond</strong> d'un bouton : un RC lisse les rebonds mécaniques, qui durent quelques millisecondes ;</li><li><strong>filtre passe-bas</strong> avant un ADC, ou pour transformer une PWM en tension continue ;</li><li><strong>retard</strong> au démarrage (broche de reset).</li></ul>`,
    setup: LAB,
    quiz: [
      { q: "R = 1 kΩ et C = 10 µF. Combien de temps pour charger presque entièrement le condensateur ?", options: ["1 ms", "10 ms", "50 ms", "1 s"], answer: 2, explain: "τ = 10 ms ; à 5τ, soit 50 ms, il est chargé à plus de 99 %." },
      { q: "À quoi sert le condensateur de 100 nF à côté de chaque puce ?", options: ["À filtrer l'audio", "Au découplage : fournir localement les pics de courant et absorber le bruit de l'alimentation", "À retarder le démarrage", "À stocker l'énergie en cas de coupure"], answer: 1, explain: "Sans lui, les appels de courant rapides font chuter la tension et provoquent des resets aléatoires." }
    ],
    challenge: {
      prompt: `<p>Écris @@tension_charge(v, r, c, t)@@ (tension aux bornes du condensateur après @@t@@ secondes de charge sous @@v@@), @@temps_seuil(v, r, c, vs)@@ (temps pour atteindre @@vs@@ ; @@None@@ si @@vs >= v@@, jamais atteint) et @@frequence_coupure(r, c)@@.</p><p>Cas pratique du test : un bouton anti-rebond de 10 kΩ et 100 nF sur une entrée 3,3 V lue à l'état haut au-delà de 0,7 × 3,3 V.</p>`,
      starter: PY`import math


def tension_charge(v, r, c, t):
    return v * math.exp(-t / (r * c))


def temps_seuil(v, r, c, vs):
    return r * c


def frequence_coupure(r, c):
    return 1 / (r * c)
`,
      solution: PY`import math


def tension_charge(v, r, c, t):
    return v * (1 - math.exp(-t / (r * c)))


def temps_seuil(v, r, c, vs):
    if vs >= v:
        return None
    return -r * c * math.log(1 - vs / v)


def frequence_coupure(r, c):
    return 1 / (2 * math.pi * r * c)
`,
      tests: PY`print(round(tension_charge(3.3, 10e3, 100e-9, 1e-3), 3), round(tension_charge(5, 1e3, 10e-6, 0.05), 3))
print(round(temps_seuil(3.3, 10e3, 100e-9, 0.7 * 3.3) * 1000, 3), "ms", temps_seuil(3.3, 10e3, 100e-9, 3.3))
print(round(frequence_coupure(10e3, 100e-9), 1), "Hz", round(frequence_coupure(1e3, 1e-6), 1), "Hz")
`,
      expected: "2.086 4.966\n1.204 ms None\n159.2 Hz 159.2 Hz\n",
      hint: "v × (1 − e^(−t/RC)) ; t = −RC × ln(1 − vs/v) ; fc = 1 / (2πRC)."
    }
  },
  {
    id: "el-07", section: "Composants", title: "Diodes et LED", xp: 100,
    theory: `<p>Une <strong>diode</strong> laisse passer le courant dans un seul sens (de l'anode vers la cathode, marquée d'un trait), avec une chute de tension presque fixe quand elle conduit : environ 0,7 V pour une diode au silicium (1N4148, 1N4007), 0,3 V pour une Schottky. Usages : protection contre l'inversion de polarité, redressement, diode de roue libre aux bornes d'une bobine.</p>
<p>Une <strong>LED</strong> est une diode qui éclaire, avec une tension directe @@Vf@@ qui dépend de la couleur : environ 2 V pour le rouge, 2,1 V pour le jaune, 3 V pour le bleu, le vert pur et le blanc. Elle ne limite pas son courant elle-même : sans <strong>résistance série</strong>, elle tire tout ce que la source peut fournir et grille, elle ou la broche qui la commande.</p>
~~~text
R = (Vcc − Vf) / I          puis valeur normalisée immédiatement au-dessus (courant un peu plus faible = sûr)
~~~
~~~py
vcc, vf, i = 5.0, 2.0, 0.020       # LED rouge, 20 mA
r = (vcc - vf) / i
print("résistance calculée :", round(r, 1), "Ω")
print("puissance dans la résistance :", round((vcc - vf) * i * 1000), "mW")
~~~
<p>Une LED moderne éclaire déjà bien à 2 à 5 mA ; viser 20 mA n'est utile que pour un voyant en plein soleil. Sur une broche de microcontrôleur, rester sous 8 à 10 mA par broche et respecter le maximum total du composant (lire la datasheet).</p>`,
    setup: LAB,
    quiz: [
      { q: "Pourquoi une LED a-t-elle besoin d'une résistance série ?", options: ["Pour changer sa couleur", "Parce qu'au-delà de Vf son courant grimpe très vite : la résistance fixe le courant", "Pour la protéger de l'électricité statique", "Elle n'en a pas besoin sous 3,3 V"], answer: 1, explain: "La caractéristique d'une diode est exponentielle : sans limitation, le courant s'emballe." },
      { q: "À quoi sert une diode montée en inverse aux bornes d'un relais ?", options: ["À allumer un voyant", "À absorber la surtension produite par la bobine à la coupure (diode de roue libre)", "À doubler la tension", "À rien"], answer: 1, explain: "Sans elle, la pointe de tension peut détruire le transistor qui commande le relais." }
    ],
    challenge: {
      prompt: `<p>Écris @@resistance_led(vcc, vf, i)@@ qui renvoie un tuple @@(r, i_reel_ma, p_mw)@@ : la valeur E12 immédiatement au-dessus de @@(vcc − vf) / i@@ (fonction @@e12_au_dessus@@ fournie), le courant obtenu avec cette résistance en mA (arrondi à 2 décimales) et la puissance dissipée dans la résistance en mW (arrondie à 1 décimale). Si @@vcc <= vf@@, la LED ne peut pas s'allumer : lève @@ValueError@@.</p>`,
      starter: E12 + PY`

def resistance_led(vcc, vf, i):
    r = vcc / i
    return r, i * 1000, vcc * i * 1000
`,
      solution: E12 + PY`

def resistance_led(vcc, vf, i):
    if vcc <= vf:
        raise ValueError("tension d'alimentation insuffisante pour cette LED")
    r = e12_au_dessus((vcc - vf) / i)
    i_reel = (vcc - vf) / r
    return r, round(i_reel * 1000, 2), round((vcc - vf) * i_reel * 1000, 1)
`,
      tests: PY`print(resistance_led(5, 2.0, 0.020))
print(resistance_led(3.3, 3.0, 0.010))
print(resistance_led(3.3, 2.0, 0.005))
print(resistance_led(12, 2.1, 0.015))
try:
    resistance_led(3.3, 3.3, 0.01)
except ValueError:
    print("ValueError")
`,
      expected: "(150.0, 20.0, 60.0)\n(33.0, 9.09, 2.7)\n(270.0, 4.81, 6.3)\n(680.0, 14.56, 144.1)\nValueError\n",
      hint: "r = e12_au_dessus((vcc − vf) / i), puis i_reel = (vcc − vf) / r et p = (vcc − vf) × i_reel."
    }
  },
  {
    id: "el-08", section: "Composants", title: "Le transistor bipolaire en commutation", xp: 110,
    theory: `<p>Une broche de microcontrôleur fournit quelques milliampères sous 3,3 V : pas assez pour un relais, un moteur ou un ruban de LED. Un <strong>transistor</strong> sert d'interrupteur commandé : un petit courant commande un grand.</p>
<p>Le <strong>transistor bipolaire NPN</strong> (2N2222, BC547) a trois broches : base, collecteur, émetteur. Un courant de base @@Ib@@ autorise un courant de collecteur jusqu'à @@β × Ib@@ (β, le gain, vaut de 100 à 300 et varie beaucoup d'un exemplaire à l'autre). En commutation, on veut le transistor <strong>saturé</strong> (interrupteur bien fermé, environ 0,2 V entre collecteur et émetteur) : on injecte un courant de base plusieurs fois supérieur au strict nécessaire, avec un facteur de saturation de 3 à 10.</p>
~~~text
Ib = Ic / β × facteur
Rb = (Vgpio − Vbe) / Ib          avec Vbe ≈ 0,7 V, puis valeur normalisée immédiatement en dessous
~~~
~~~py
v_gpio, i_charge, beta, facteur = 3.3, 0.070, 100, 5   # relais de 70 mA
ib = i_charge / beta * facteur
rb = (v_gpio - 0.7) / ib
print("Ib =", round(ib * 1000, 2), "mA,  Rb max =", round(rb, 1), "Ω")
~~~
<p>On prend la valeur normalisée <em>en dessous</em> : un peu plus de courant de base garantit la saturation. On vérifie ensuite que ce courant reste acceptable pour la broche (moins de 8 à 10 mA). La charge se place côté collecteur (montage « low side »), l'émetteur à la masse ; pour une bobine, on ajoute la diode de roue libre.</p>`,
    setup: LAB,
    quiz: [
      { q: "Pourquoi injecter plus de courant de base que Ic / β ?", options: ["Pour consommer plus", "Parce que β varie d'un exemplaire à l'autre et avec la température : la marge garantit la saturation", "Pour amplifier le signal", "Par erreur de calcul"], answer: 1, explain: "Un transistor mal saturé dissipe beaucoup plus et chauffe." },
      { q: "Où brancher la charge avec un NPN commandé par un microcontrôleur ?", options: ["Entre l'émetteur et la masse", "Entre l'alimentation et le collecteur, émetteur à la masse", "Sur la base", "En parallèle sur la broche"], answer: 1, explain: "Montage « low side » : l'émetteur reste à 0 V et Vbe est bien défini." }
    ],
    challenge: {
      prompt: `<p>Écris @@rb_saturation(v_gpio, i_charge, beta, facteur=5)@@ qui renvoie @@(rb, ib_ma)@@ : la valeur E12 immédiatement en dessous de la résistance de base maximale (fonction @@e12_en_dessous@@ fournie, @@Vbe = 0.7@@), et le courant de base réel obtenu avec elle, en mA arrondi à 2 décimales. Si ce courant dépasse @@I_GPIO_MAX = 0.010@@ A, lève @@ValueError@@ : il faudra un MOSFET ou un montage Darlington.</p>`,
      starter: E12 + PY`
I_GPIO_MAX = 0.010


def rb_saturation(v_gpio, i_charge, beta, facteur=5):
    rb = v_gpio / (i_charge / beta)
    return rb, round(v_gpio / rb * 1000, 2)
`,
      solution: E12 + PY`
I_GPIO_MAX = 0.010
VBE = 0.7


def rb_saturation(v_gpio, i_charge, beta, facteur=5):
    ib = i_charge / beta * facteur
    rb = e12_en_dessous((v_gpio - VBE) / ib)
    ib_reel = (v_gpio - VBE) / rb
    if ib_reel > I_GPIO_MAX:
        raise ValueError("courant de base trop fort pour une broche")
    return rb, round(ib_reel * 1000, 2)
`,
      tests: PY`print(rb_saturation(3.3, 0.070, 100))
print(rb_saturation(5, 0.200, 150, facteur=4))
print(rb_saturation(3.3, 0.020, 200, facteur=10))
try:
    rb_saturation(3.3, 0.5, 100)
except ValueError:
    print("ValueError")
`,
      expected: "(680.0, 3.82)\n(680.0, 6.32)\n(2200.0, 1.18)\nValueError\n",
      hint: "ib = i_charge / beta × facteur ; rb = e12_en_dessous((v_gpio − 0.7) / ib) ; recalcule ib avec la résistance choisie, et compare à I_GPIO_MAX."
    }
  },
  {
    id: "el-09", section: "Composants", title: "Le MOSFET : commuter de fortes charges", xp: 110,
    theory: `<p>Le <strong>MOSFET à canal N</strong> se commande en <em>tension</em> : sa grille est isolée et ne consomme presque rien en régime établi. Au-delà d'une tension grille-source suffisante, il se comporte comme une petite résistance @@Rds(on)@@ (quelques milliohms à quelques ohms). Il dissipe alors @@P = I² × Rds(on)@@ : avec 20 mΩ et 5 A, seulement 0,5 W.</p>
<p>Le piège classique est la tension de seuil. @@Vgs(th)@@, souvent 1 à 2 V, est la tension où le MOSFET <em>commence</em> à conduire, pas celle où il est pleinement passant. La valeur qui compte est la tension à laquelle la datasheet garantit @@Rds(on)@@ : beaucoup de MOSFET de puissance (IRF540N) ne sont spécifiés qu'à 10 V et conduisent mal sous les 3,3 V d'un ESP32. Il faut un modèle « logic level », spécifié à 4,5 V, 2,5 V voire 1,8 V.</p>
<ul><li>une résistance de 100 Ω environ en série sur la grille limite le pic de courant à la commutation ;</li><li>une résistance de 10 à 100 kΩ entre grille et source garde le MOSFET bloqué pendant le démarrage du microcontrôleur, quand la broche flotte ;</li><li>pour une bobine (moteur, relais, électrovanne), la diode de roue libre reste obligatoire.</li></ul>
~~~py
i, rds = 3.0, 0.026                     # 3 A dans un MOSFET de 26 mΩ
print("dissipation :", round(i ** 2 * rds, 3), "W")
~~~`,
    setup: LAB,
    quiz: [
      { q: "Un MOSFET a Vgs(th) = 2 V et Rds(on) spécifié à Vgs = 10 V. Le commander avec 3,3 V ?", options: ["Oui, 3,3 V dépasse le seuil", "Risqué : au seuil il commence à peine à conduire ; il faut un modèle spécifié à une tension ≤ 3,3 V", "Oui, s'il chauffe peu", "Non, un MOSFET se commande en courant"], answer: 1, explain: "Mal ouvert, il présente une résistance élevée et chauffe fortement." },
      { q: "Pourquoi une résistance entre grille et source ?", options: ["Pour limiter le courant de drain", "Pour garder le MOSFET bloqué quand la broche de commande flotte (démarrage, reset)", "Pour augmenter le gain", "Pour la protection thermique"], answer: 1, explain: "Une grille en l'air peut se charger et allumer la charge au hasard." }
    ],
    challenge: {
      prompt: `<p>On te donne des fiches simplifiées : @@{"nom", "vgs_spec", "rds_on", "id_max"}@@, où @@rds_on@@ (en ohms) est garanti à la tension @@vgs_spec@@. Écris @@choisir_mosfet(fiches, i, v_gpio)@@ qui garde les MOSFET spécifiés à une tension inférieure ou égale à @@v_gpio@@ et dont @@id_max@@ vaut au moins le double de @@i@@, puis renvoie @@(nom, p_mw)@@ de celui qui dissipe le moins (@@p_mw@@ arrondi à 1 décimale). @@None@@ si aucun ne convient.</p>`,
      starter: PY`FICHES = [
    {"nom": "IRF540N", "vgs_spec": 10.0, "rds_on": 0.044, "id_max": 33},
    {"nom": "IRLZ44N", "vgs_spec": 5.0, "rds_on": 0.025, "id_max": 47},
    {"nom": "AO3400", "vgs_spec": 2.5, "rds_on": 0.032, "id_max": 5.7},
    {"nom": "IRLML6344", "vgs_spec": 2.5, "rds_on": 0.037, "id_max": 5.0},
    {"nom": "2N7000", "vgs_spec": 4.5, "rds_on": 5.3, "id_max": 0.2},
]


def choisir_mosfet(fiches, i, v_gpio):
    m = min(fiches, key=lambda f: f["rds_on"])
    return m["nom"], round(i ** 2 * m["rds_on"] * 1000, 1)
`,
      solution: PY`FICHES = [
    {"nom": "IRF540N", "vgs_spec": 10.0, "rds_on": 0.044, "id_max": 33},
    {"nom": "IRLZ44N", "vgs_spec": 5.0, "rds_on": 0.025, "id_max": 47},
    {"nom": "AO3400", "vgs_spec": 2.5, "rds_on": 0.032, "id_max": 5.7},
    {"nom": "IRLML6344", "vgs_spec": 2.5, "rds_on": 0.037, "id_max": 5.0},
    {"nom": "2N7000", "vgs_spec": 4.5, "rds_on": 5.3, "id_max": 0.2},
]


def choisir_mosfet(fiches, i, v_gpio):
    ok = [f for f in fiches if f["vgs_spec"] <= v_gpio and f["id_max"] >= 2 * i]
    if not ok:
        return None
    m = min(ok, key=lambda f: f["rds_on"])
    return m["nom"], round(i ** 2 * m["rds_on"] * 1000, 1)
`,
      tests: PY`print(choisir_mosfet(FICHES, 2.0, 3.3))
print(choisir_mosfet(FICHES, 2.0, 5.0))
print(choisir_mosfet(FICHES, 0.05, 5.0))
print(choisir_mosfet(FICHES, 4.0, 3.3), choisir_mosfet(FICHES, 30, 12))
`,
      expected: "('AO3400', 128.0)\n('IRLZ44N', 100.0)\n('IRLZ44N', 0.1)\nNone None\n",
      hint: "Filtre avec f[\"vgs_spec\"] <= v_gpio and f[\"id_max\"] >= 2 * i, puis min(..., key=lambda f: f[\"rds_on\"]) ; P = i² × rds_on."
    }
  },
  {
    id: "el-10", section: "Composants", title: "L'amplificateur opérationnel", xp: 100,
    theory: `<p>L'<strong>amplificateur opérationnel</strong> (ampli-op) amplifie la différence entre ses deux entrées avec un gain énorme. Seul, il sert de <strong>comparateur</strong> : sa sortie part en butée haute ou basse selon l'entrée la plus grande. Avec une <strong>contre-réaction</strong> (une résistance de la sortie vers l'entrée −), il devient un amplificateur précis dont le gain ne dépend que des résistances :</p>
~~~text
non inverseur :  Vout = Vin × (1 + Rf / Rg)
inverseur     :  Vout = −Vin × Rf / Rg
suiveur       :  Vout = Vin   (Rf = 0 : gain 1, mais l'entrée ne consomme rien)
~~~
<p>La sortie ne peut pas dépasser ses tensions d'alimentation : au-delà, elle <strong>sature</strong> (le signal est écrêté). Les modèles « rail-to-rail » approchent les rails à quelques dizaines de millivolts ; les anciens (LM358, µA741) restent à 1,5 V ou plus en dessous.</p>
~~~py
vin, rf, rg = 0.2, 9e3, 1e3
print("gain :", 1 + rf / rg, " sortie :", vin * (1 + rf / rg), "V")
~~~
<p>Usages en embarqué : amplifier le petit signal d'un capteur (thermocouple, microphone, jauge de contrainte) avant l'ADC, faire un suiveur pour ne pas charger un diviseur de tension, un comparateur avec hystérésis pour un seuil propre.</p>`,
    setup: LAB,
    quiz: [
      { q: "Montage non inverseur avec Rf = 47 kΩ et Rg = 4,7 kΩ : quel gain ?", options: ["10", "11", "−10", "47"], answer: 1, explain: "1 + 47 / 4,7 = 11." },
      { q: "Pourquoi placer un suiveur derrière un diviseur de tension ?", options: ["Pour amplifier", "L'entrée de l'ampli-op ne consomme presque rien : le diviseur n'est plus chargé, et la sortie peut fournir du courant", "Pour inverser le signal", "Pour filtrer le bruit"], answer: 1, explain: "Il sépare la source de la charge (adaptation d'impédance)." }
    ],
    challenge: {
      prompt: `<p>Écris @@sortie_ampli(vin, montage, rf, rg, v_alim)@@ pour un ampli-op idéal rail-to-rail alimenté en @@±v_alim@@ : @@montage@@ vaut @@"non_inverseur"@@ ou @@"inverseur"@@ (sinon @@ValueError@@), et la sortie est écrêtée à @@[−v_alim, +v_alim]@@. Arrondis le résultat à 3 décimales.</p>`,
      starter: PY`def sortie_ampli(vin, montage, rf, rg, v_alim):
    return vin * rf / rg
`,
      solution: PY`def sortie_ampli(vin, montage, rf, rg, v_alim):
    if montage == "non_inverseur":
        v = vin * (1 + rf / rg)
    elif montage == "inverseur":
        v = -vin * rf / rg
    else:
        raise ValueError("montage inconnu : " + str(montage))
    return round(max(-v_alim, min(v_alim, v)), 3)
`,
      tests: PY`print(sortie_ampli(0.2, "non_inverseur", 9e3, 1e3, 12), sortie_ampli(1.5, "non_inverseur", 9e3, 1e3, 12))
print(sortie_ampli(0.5, "inverseur", 10e3, 1e3, 12), sortie_ampli(-2, "inverseur", 10e3, 1e3, 12))
print(sortie_ampli(0.033, "non_inverseur", 47e3, 4.7e3, 5))
try:
    sortie_ampli(1, "differentiel", 1, 1, 5)
except ValueError:
    print("ValueError")
`,
      expected: "2.0 12\n-5.0 12\n0.363\nValueError\n",
      hint: "Calcule la sortie selon le montage, puis écrête avec max(−v_alim, min(v_alim, v))."
    }
  },
  {
    id: "el-11", section: "Composants", title: "Alimentations, régulateurs et autonomie", xp: 110,
    theory: `<p>Un montage reçoit rarement directement la tension dont il a besoin : il faut la <strong>réguler</strong>.</p>
<ul><li><strong>régulateur linéaire</strong> (7805, AMS1117, LDO) : simple et silencieux, mais il brûle la différence de tension. Il dissipe @@(Vin − Vout) × I@@ et son rendement vaut au mieux @@Vout / Vin@@ : de 12 V vers 5 V, plus de la moitié de l'énergie part en chaleur. Un <em>LDO</em> (low dropout) fonctionne avec une faible marge entre Vin et Vout ;</li><li><strong>convertisseur à découpage</strong> : abaisseur (<em>buck</em>), élévateur (<em>boost</em>) ou les deux, avec un rendement de 85 à 95 %, au prix d'un peu de bruit et de composants (bobine, condensateurs).</li></ul>
~~~py
vin, vout, i = 12.0, 5.0, 0.5
print("linéaire : perte", (vin - vout) * i, "W, rendement", round(100 * vout / vin, 1), "%")
print("buck à 90 % : perte", round(vout * i / 0.9 - vout * i, 3), "W")
~~~
<p>Sur batterie, l'<strong>autonomie</strong> dépend du courant <em>moyen</em>. Un capteur connecté passe l'essentiel de son temps en veille profonde (quelques µA sur un ESP32) et se réveille quelques secondes pour mesurer et transmettre à 80 mA ou plus. Courant moyen sur une période :</p>
~~~text
I_moy = (I_actif × t_actif + I_veille × (T − t_actif)) / T
autonomie (h) = capacité utile (mAh) / I_moy (mA)        capacité utile ≈ 80 % de la nominale
~~~
<p>Le régulateur compte aussi : son courant de repos (quiescent current) s'ajoute en permanence. Un AMS1117 consomme environ 5 mA à vide, de quoi vider une batterie en quelques semaines même quand tout dort ; pour un projet sur batterie, on choisit un LDO à quelques µA de repos.</p>`,
    setup: LAB,
    quiz: [
      { q: "Un régulateur linéaire abaisse 9 V à 3,3 V pour 200 mA. Dissipation ?", options: ["0,66 W", "1,14 W", "1,8 W", "0,2 W"], answer: 1, explain: "(9 − 3,3) × 0,2 = 1,14 W : il faut un dissipateur, ou un convertisseur buck." },
      { q: "Un capteur dort à 10 µA et se réveille 1 s à 100 mA toutes les 100 s. Courant moyen ?", options: ["100 mA", "1,01 mA environ", "10 µA", "50 mA"], answer: 1, explain: "(100 × 1 + 0,01 × 99) / 100 ≈ 1,01 mA : c'est le temps actif qui domine." }
    ],
    challenge: {
      prompt: `<p>Écris @@regulateur_lineaire(vin, vout, i)@@ qui renvoie @@(p_dissipee_w, rendement_pct)@@, arrondis à 3 et 1 décimales (@@ValueError@@ si @@vin <= vout@@), et @@autonomie_heures(capacite_mah, i_actif_ma, t_actif_s, i_veille_ua, periode_s)@@ avec 80 % de capacité utile, arrondie à l'heure (@@round(…)@@). Attention aux unités : le courant de veille est en µA.</p>`,
      starter: PY`def regulateur_lineaire(vin, vout, i):
    return vin * i, 100.0


def autonomie_heures(capacite_mah, i_actif_ma, t_actif_s, i_veille_ua, periode_s):
    return round(capacite_mah / i_actif_ma)
`,
      solution: PY`def regulateur_lineaire(vin, vout, i):
    if vin <= vout:
        raise ValueError("un régulateur linéaire ne peut pas élever la tension")
    return round((vin - vout) * i, 3), round(100 * vout / vin, 1)


def autonomie_heures(capacite_mah, i_actif_ma, t_actif_s, i_veille_ua, periode_s):
    i_veille_ma = i_veille_ua / 1000
    i_moy = (i_actif_ma * t_actif_s + i_veille_ma * (periode_s - t_actif_s)) / periode_s
    return round(0.8 * capacite_mah / i_moy)
`,
      tests: PY`print(regulateur_lineaire(12, 5, 0.5), regulateur_lineaire(5, 3.3, 0.25))
h = autonomie_heures(2000, 80, 2, 10, 600)
print(h, "h, soit", round(h / 24), "jours")
print(autonomie_heures(2000, 80, 2, 5000, 600), "h avec 5 mA de repos")
print(autonomie_heures(1000, 50, 1, 0, 1))
try:
    regulateur_lineaire(3.3, 5, 0.1)
except ValueError:
    print("ValueError")
`,
      expected: "(3.5, 41.7) (0.425, 66.0)\n5784 h, soit 241 jours\n305 h avec 5 mA de repos\n16\nValueError\n",
      hint: "Convertis d'abord i_veille_ua en mA (÷ 1000), calcule le courant moyen pondéré par les durées, puis 0.8 × capacité / I_moy."
    }
  },
  {
    id: "el-12", section: "Entretien", title: "Questions d'entretien : électronique pour l'embarqué", xp: 60, theoryOnly: true,
    theory: `<p>En entretien embarqué ou IoT, on vérifie surtout que tu sais raisonner sur un schéma simple et éviter les erreurs qui détruisent du matériel. Réponds avec tes mots, puis chiffre un exemple.</p>
<div class="qa">
<details><summary>Comment calcules-tu la résistance d'une LED sur une broche 3,3 V ?</summary><p>R = (Vcc − Vf) / I. Pour une LED rouge (Vf ≈ 2 V) à 5 mA : 1,3 / 0,005 = 260 Ω, donc 270 Ω en E12. Je vérifie que le courant reste dans la limite de la broche.</p></details>
<details><summary>Pourquoi un condensateur de 100 nF près de chaque circuit intégré ?</summary><p>Découplage : il fournit localement les appels de courant rapides que les pistes, trop inductives, ne peuvent pas apporter assez vite, et filtre le bruit de l'alimentation. Sans lui : resets et comportements aléatoires.</p></details>
<details><summary>Transistor bipolaire ou MOSFET pour commander un moteur de 2 A depuis un ESP32 ?</summary><p>Un MOSFET canal N « logic level » spécifié à 2,5 V ou moins : commande en tension, pertes I² × Rds(on) faibles. Avec une résistance de grille, une résistance de tirage grille-source et une diode de roue libre sur le moteur.</p></details>
<details><summary>Qu'est-ce qu'une résistance de tirage (pull-up) et pourquoi en mettre une ?</summary><p>Une résistance qui ramène une entrée à un état connu (Vcc) quand rien ne la pilote. Une entrée en l'air capte le bruit et lit n'importe quoi. Les bus I2C en ont besoin car leurs sorties sont à drain ouvert.</p></details>
<details><summary>Régulateur linéaire ou à découpage ?</summary><p>Linéaire pour une faible différence de tension, peu de courant, ou un signal sensible au bruit (analogique, radio). Découpage dès que la différence ou le courant fait chauffer le linéaire : P = (Vin − Vout) × I.</p></details>
<details><summary>Comment estimes-tu l'autonomie d'un capteur sur batterie ?</summary><p>Par le courant moyen : temps actif × courant actif plus temps de veille × courant de veille, sur la période. Sans oublier le courant de repos du régulateur et des capteurs, souvent dominant en veille, et une marge de 20 % sur la capacité.</p></details>
<details><summary>Comment ramener un signal 5 V vers une entrée 3,3 V ?</summary><p>Un diviseur de tension (par exemple 1 kΩ et 2 kΩ) pour un signal lent ; un convertisseur de niveau dédié pour un bus rapide ou bidirectionnel (I2C). Jamais en direct sur une broche non tolérante au 5 V.</p></details>
</div>`,
    practice: { title: "S'entraîner", body: `<p>Dans le simulateur Falstad, construis une LED commandée par un NPN avec les valeurs de la leçon 8, puis remplace le NPN par un MOSFET et compare la chute de tension sur l'interrupteur. Ensuite, dessine de mémoire le schéma d'un capteur sur batterie (batterie, LDO, diviseur de mesure, microcontrôleur, découplage) et explique chaque composant à voix haute.</p>` },
    quiz: [
      { q: "Une entrée de microcontrôleur non connectée lit 0 et 1 au hasard. Cause et remède ?", options: ["Un bogue du compilateur", "L'entrée flotte : ajouter une résistance de tirage (ou activer le pull-up interne)", "La broche est grillée", "Il manque un condensateur de 1 F"], answer: 1, explain: "Une entrée CMOS a une impédance énorme : sans référence, elle capte tout." },
      { q: "Un régulateur 7805 chauffe beaucoup en abaissant 24 V à 5 V sous 300 mA. Pourquoi ?", options: ["Il est défectueux", "Il dissipe (24 − 5) × 0,3 = 5,7 W : il faut un convertisseur à découpage", "Le courant est trop faible", "Il manque une LED"], answer: 1, explain: "Un linéaire transforme toute la différence de tension en chaleur." }
    ]
  }
];
