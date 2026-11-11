/* Cours Data — chapitre SciPy (statistiques et optimisation) */
const R = String.raw;

const SETUP_SCIPY = R`<p>Sur ta machine :</p>
~~~ps
pip install scipy
~~~
<p>SciPy est organisé en sous-modules qu'on importe séparément : @@from scipy import stats, optimize@@.</p>`;

export default [
  {
    id: "sp-01", section: "SciPy", title: "Lois de probabilité", xp: 45, setup: SETUP_SCIPY,
    theory: R`<p>@@scipy.stats@@ fournit les lois de probabilité usuelles avec la même interface : @@pdf@@ ou @@pmf@@ (densité ou probabilité d'une valeur), @@cdf@@ (probabilité d'être inférieur ou égal), @@ppf@@ (l'inverse : le quantile) et @@rvs@@ (tirages aléatoires).</p>
~~~py
from scipy import stats

# Durée de livraison ~ loi normale de moyenne 30 min, écart-type 8 min
livraison = stats.norm(loc=30, scale=8)
print(round(livraison.cdf(40), 4))       # P(durée ≤ 40)
print(round(1 - livraison.cdf(45), 4))   # P(durée > 45) : le risque de retard
print(round(livraison.ppf(0.95), 1))     # 95 % des livraisons durent moins que…

# 10 clients, chacun a 20 % de chances d'acheter : loi binomiale
achats = stats.binom(n=10, p=0.2)
print(round(achats.pmf(3), 4))           # P(exactement 3 achats)
print(round(1 - achats.cdf(2), 4))       # P(au moins 3 achats)
~~~
<p>@@ppf@@ sert à fixer un seuil (le SLA à 95 % d'un service, la réserve de stock), @@cdf@@ à mesurer un risque.</p>`,
    quiz: [
      { q: R`Pour une variable X, que calcule @@1 - loi.cdf(x)@@ ?`, options: ["P(X ≤ x)", "P(X > x)", "La densité en x", "Le quantile de x"], answer: 1, explain: "cdf(x) = P(X ≤ x), donc son complément est P(X > x). On peut aussi écrire loi.sf(x) (survival function)." }
    ],
    challenge: {
      prompt: R`<p>Écris @@risque_livraison(moyenne, ecart, seuil)@@ pour des durées qui suivent une loi normale. Elle renvoie un dictionnaire :</p><ul><li>@@"p_retard"@@ : la probabilité de dépasser @@seuil@@, arrondie à 4 décimales ;</li><li>@@"seuil_95"@@ : la durée sous laquelle se trouvent 95 % des livraisons, arrondie à 2 décimales.</li></ul>`,
      starter: "from scipy import stats\n\ndef risque_livraison(moyenne, ecart, seuil):\n    loi = stats.norm(loc=moyenne, scale=ecart)\n    return {\"p_retard\": round(loi.cdf(seuil), 4), \"seuil_95\": 0}\n",
      solution: R`from scipy import stats

def risque_livraison(moyenne, ecart, seuil):
    loi = stats.norm(loc=moyenne, scale=ecart)
    return {
        "p_retard": round(float(1 - loi.cdf(seuil)), 4),
        "seuil_95": round(float(loi.ppf(0.95)), 2),
    }`,
      tests: R`r = risque_livraison(30, 8, 45)
print(r["p_retard"], r["seuil_95"])
r = risque_livraison(50, 10, 60)
print(r["p_retard"], r["seuil_95"])`,
      expected: "0.0304 43.16\n0.1587 66.45",
      hint: "P(X > seuil) = 1 - loi.cdf(seuil). Le seuil à 95 % est loi.ppf(0.95)."
    }
  },
  {
    id: "sp-02", section: "SciPy", title: "Tests d'hypothèse", xp: 55,
    theory: R`<p>Les mâles Adélie sont-ils vraiment plus lourds que les femelles, ou est-ce le hasard de l'échantillon ? Un <strong>test d'hypothèse</strong> répond à cette question.</p><ul><li><strong>H0</strong> (hypothèse nulle) : pas de différence entre les groupes.</li><li>La <strong>p-valeur</strong> est la probabilité d'observer une différence au moins aussi grande <em>si H0 était vraie</em>. En dessous de 0,05 (le seuil habituel), on rejette H0.</li></ul>
~~~py
import pandas as pd
from scipy import stats

df = pd.read_csv("data/penguins.csv")
adelie = df[df["species"] == "Adelie"]
males = adelie.loc[adelie["sex"] == "male", "body_mass_g"].dropna()
femelles = adelie.loc[adelie["sex"] == "female", "body_mass_g"].dropna()

print(round(males.mean()), round(femelles.mean()))
test = stats.ttest_ind(males, femelles, equal_var=False)   # test t de Welch
print(round(test.statistic, 2), test.pvalue)

# Intervalle de confiance à 95 % de la masse moyenne des mâles
ic = stats.t.interval(0.95, df=len(males) - 1, loc=males.mean(), scale=stats.sem(males))
print([round(float(b), 1) for b in ic])
~~~
<p>Utilise le test de <strong>Welch</strong> (@@equal_var=False@@) par défaut : il ne suppose pas que les deux groupes ont la même variance. Et une p-valeur ne mesure pas l'<em>importance</em> d'un effet : avec assez de données, une différence minuscule devient « significative ». Donne toujours aussi la taille de l'écart.</p>`,
    quiz: [
      { q: "Un test donne p = 0,30. Que conclure ?", options: ["H0 est vraie : il n'y a aucune différence", "Les données ne permettent pas de rejeter H0", "Il y a 30 % de chances que H0 soit vraie", "La différence est de 30 %"], answer: 1, explain: "Ne pas rejeter H0 ne prouve pas qu'elle est vraie, juste que les données sont compatibles avec elle. Et la p-valeur n'est pas la probabilité que H0 soit vraie." },
      { q: "Tu fais 20 tests au seuil de 5 % sur des données sans aucun effet réel. Combien de « découvertes » attendre en moyenne ?", options: ["0", "1", "5", "20"], answer: 1, explain: "5 % de 20 = 1 faux positif attendu. C'est le problème des comparaisons multiples (corrections de Bonferroni, Holm…), un classique des tests A/B." }
    ],
    challenge: {
      prompt: R`<p>Écris @@comparer_sexes(df, espece)@@ qui compare la masse des mâles et des femelles d'une espèce avec un test t de <strong>Welch</strong>, et renvoie un tuple :</p><ul><li>la statistique t (mâles en premier), arrondie à 2 décimales ;</li><li>@@True@@ si la différence est significative au seuil de 5 %, sinon @@False@@.</li></ul><p>Ignore les masses manquantes.</p>`,
      starter: "import pandas as pd\nfrom scipy import stats\n\ndef comparer_sexes(df, espece):\n    return 0.0, False\n",
      solution: R`import pandas as pd
from scipy import stats

def comparer_sexes(df, espece):
    groupe = df[df["species"] == espece]
    males = groupe.loc[groupe["sex"] == "male", "body_mass_g"].dropna()
    femelles = groupe.loc[groupe["sex"] == "female", "body_mass_g"].dropna()
    test = stats.ttest_ind(males, femelles, equal_var=False)
    return round(float(test.statistic), 2), bool(test.pvalue < 0.05)`,
      tests: R`print(comparer_sexes(pd.read_csv("data/penguins.csv"), "Adelie"))
petit = pd.DataFrame({"species": ["X"] * 8, "sex": ["male"] * 4 + ["female"] * 4,
                      "body_mass_g": [10, 11, 12, 10.5, 10.5, 11.5, 11, 10.8]})
print(comparer_sexes(petit, "X"))`,
      expected: "(13.13, True)\n(-0.16, False)",
      hint: R`stats.ttest_ind(males, femelles, equal_var=False) ; test.statistic et test.pvalue. Convertis avec float() et bool().`
    }
  },
  {
    id: "sp-03", section: "SciPy", title: "Corrélation et paradoxe de Simpson", xp: 55,
    theory: R`<p>La corrélation de <strong>Pearson</strong> mesure une relation linéaire (de −1 à 1), celle de <strong>Spearman</strong> une relation monotone (basée sur les rangs, robuste aux valeurs extrêmes). @@linregress@@ ajuste une droite.</p>
~~~py
import pandas as pd
from scipy import stats

df = pd.read_csv("data/penguins.csv").dropna(subset=["bill_length_mm", "bill_depth_mm"])

r, p = stats.pearsonr(df["bill_length_mm"], df["bill_depth_mm"])
print("tous les manchots :", round(r, 3))       # négatif !
for espece, g in df.groupby("species"):
    r, _ = stats.pearsonr(g["bill_length_mm"], g["bill_depth_mm"])
    print(espece, round(r, 3))                  # positif dans chaque espèce
~~~
<p>Ce retournement est le <strong>paradoxe de Simpson</strong>. Les Gentoo ont des becs longs mais peu profonds, les Adélie l'inverse. Mélanger les espèces crée une tendance globale opposée à celle de chaque groupe. La leçon : une variable cachée (ici l'espèce) peut inverser une conclusion. Corrélation n'est pas causalité, et un agrégat peut mentir.</p>`,
    quiz: [
      { q: "Pearson donne r = 0,05 entre deux variables. Peut-on conclure qu'elles sont indépendantes ?", options: ["Oui", "Non : r mesure une relation linéaire ; une relation en U peut donner r ≈ 0", "Oui si la p-valeur est grande", "Non, il faut r = 0 exactement"], answer: 1, explain: "y = x² sur [−1, 1] a un r proche de 0 et pourtant une dépendance parfaite. Trace toujours le nuage de points." }
    ],
    challenge: {
      prompt: R`<p>Écris @@relation(df, x, y)@@ qui ajuste une droite @@y = pente·x + ordonnee@@ avec @@stats.linregress@@ (en ignorant les lignes où x ou y manque) et renvoie un dictionnaire :</p><ul><li>@@"pente"@@ (2 décimales), @@"ordonnee"@@ (1 décimale) ;</li><li>@@"r2"@@ : le coefficient de détermination R² (3 décimales).</li></ul>`,
      starter: "import pandas as pd\nfrom scipy import stats\n\ndef relation(df, x, y):\n    r = stats.linregress(df[x], df[y])\n    return {\"pente\": r.slope, \"ordonnee\": r.intercept, \"r2\": r.rvalue}\n",
      solution: R`import pandas as pd
from scipy import stats

def relation(df, x, y):
    d = df.dropna(subset=[x, y])
    r = stats.linregress(d[x], d[y])
    return {
        "pente": round(float(r.slope), 2),
        "ordonnee": round(float(r.intercept), 1),
        "r2": round(float(r.rvalue) ** 2, 3),
    }`,
      tests: R`r = relation(pd.read_csv("data/penguins.csv"), "flipper_length_mm", "body_mass_g")
print(r["pente"], r["ordonnee"], r["r2"])
d = pd.DataFrame({"a": [0, 1, 2, None, 4], "b": [1, 3, 5, 7, 9]})
print(relation(d, "a", "b"))`,
      expected: "49.69 -5780.8 0.759\n{'pente': 2.0, 'ordonnee': 1.0, 'r2': 1.0}",
      hint: "Supprime d'abord les lignes incomplètes avec dropna(subset=[x, y]). R² = rvalue ** 2. Convertis avec float() avant d'arrondir."
    }
  },
  {
    id: "sp-04", section: "SciPy", title: "Optimisation et ajustement de courbe", xp: 55,
    theory: R`<p>@@scipy.optimize@@ trouve le minimum d'une fonction : c'est le cœur de l'entraînement des modèles de ML, qui minimisent une erreur. Pour maximiser, on minimise l'opposé.</p>
~~~py
import numpy as np
from scipy import optimize

# Au prix p, un café vend q = 1200 - 25p tasses par jour ; chaque tasse coûte 0,80 $ à produire.
def profit(p):
    q = 1200 - 25 * p
    return (p - 0.8) * q

res = optimize.minimize_scalar(lambda p: -profit(p), bounds=(0, 48), method="bounded")
print(round(res.x, 2), round(profit(res.x), 1))   # prix optimal et profit

# Ajuster un modèle non linéaire à des mesures : décroissance exponentielle
t = np.array([0, 1, 2, 3, 4, 5.0])
mesures = np.array([49.1, 34.0, 22.0, 15.1, 10.4, 6.6])
modele = lambda t, a, b: a * np.exp(b * t)
(a, b), _ = optimize.curve_fit(modele, t, mesures, p0=(50, -0.1))
print(round(a, 2), round(b, 3))
~~~
<p>@@curve_fit@@ a besoin d'un point de départ @@p0@@ raisonnable : un mauvais départ peut faire diverger l'optimisation. Une bonne habitude : partir de la première mesure pour l'amplitude.</p>`,
    quiz: [
      { q: R`Comment maximiser une fonction f avec @@optimize.minimize@@ ?`, options: ["Ce n'est pas possible", "En minimisant -f", "En minimisant 1/f", "Avec l'option maximize=True"], answer: 1, explain: "max f = −min(−f). 1/f change le problème dès que f devient négative ou nulle." }
    ],
    challenge: {
      prompt: R`<p>Écris @@ajuster_decroissance(t, y)@@ qui ajuste le modèle @@y = a·exp(b·t)@@ aux mesures avec @@curve_fit@@ et renvoie le tuple @@(a, b)@@ arrondi à 3 décimales. Choisis un point de départ robuste.</p>`,
      starter: "import numpy as np\nfrom scipy import optimize\n\ndef ajuster_decroissance(t, y):\n    return float(y[0]), 0.0\n",
      solution: R`import numpy as np
from scipy import optimize

def ajuster_decroissance(t, y):
    modele = lambda t, a, b: a * np.exp(b * t)
    (a, b), _ = optimize.curve_fit(modele, t, y, p0=(y[0], -0.1))
    return round(float(a), 3), round(float(b), 3)`,
      tests: R`t = np.array([0, 1, 2, 3, 4, 5.0])
print(ajuster_decroissance(t, 50 * np.exp(-0.4 * t)))
t2 = np.linspace(0, 4, 9)
print(ajuster_decroissance(t2, 120 * np.exp(-1.1 * t2)))`,
      expected: "(50.0, -0.4)\n(120.0, -1.1)",
      hint: "optimize.curve_fit(modele, t, y, p0=(y[0], -0.1)) renvoie (paramètres, covariance)."
    }
  }
];
