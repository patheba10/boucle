/* Cours Data — chapitre visualisation (Matplotlib, seaborn).
   Les défis vérifient les propriétés des figures (axes, titres, données tracées), jamais l'image elle-même. */
const R = String.raw;

const SETUP_VIZ = R`<p>Sur ta machine :</p>
~~~ps
pip install matplotlib seaborn
~~~
<p>Dans un script, @@plt.show()@@ ouvre une fenêtre ; dans Jupyter, la figure s'affiche sous la cellule. Pour un rapport, enregistre-la :</p>
~~~py norun
fig.savefig("figure.png", dpi=150, bbox_inches="tight")
~~~
<p>Dans Boucle, les figures s'affichent automatiquement dans la console, sans @@plt.show()@@.</p>`;

export default [
  {
    id: "viz-01", section: "Visualisation", title: "Figure et axes", xp: 45, setup: SETUP_VIZ,
    theory: R`<p>Matplotlib distingue la <strong>figure</strong> (la toile) et les <strong>axes</strong> (un graphique avec ses deux axes, son titre, sa légende). Une figure peut contenir plusieurs axes. Prends l'habitude de l'interface objet : on crée @@fig, ax@@, puis on appelle les méthodes de @@ax@@.</p>
~~~py
import matplotlib.pyplot as plt
import numpy as np

x = np.linspace(0, 10, 100)
fig, ax = plt.subplots(figsize=(7, 3.5))
ax.plot(x, np.sin(x), label="sin(x)")
ax.plot(x, np.cos(x), label="cos(x)", linestyle="--")
ax.set_title("Deux signaux")
ax.set_xlabel("temps (s)")
ax.set_ylabel("amplitude")
ax.legend()
ax.grid(alpha=0.3)
~~~
<p>Un graphique lisible a toujours un titre, des axes nommés avec leurs unités et une légende dès qu'il y a plusieurs séries.</p>`,
    quiz: [
      { q: R`Dans @@fig, ax = plt.subplots()@@, que représente @@ax@@ ?`, options: ["La fenêtre entière", "Un graphique (zone de tracé avec ses axes)", "L'axe des x seulement", "Une liste de figures"], answer: 1, explain: "ax est un objet Axes : la zone où l'on trace, avec titre, étiquettes et légende. fig est le conteneur." }
    ],
    challenge: {
      prompt: R`<p>Écris @@courbe_temperatures(meteo)@@ qui renvoie une <strong>figure</strong> montrant les moyennes <strong>mensuelles</strong> de @@temp_max@@ et @@temp_min@@ à Seattle :</p><ul><li>un seul axe, deux courbes nommées @@"max"@@ et @@"min"@@ (dans cet ordre), avec légende ;</li><li>titre @@"Températures à Seattle"@@, axe y nommé @@"°C"@@.</li></ul><p>@@meteo@@ est lu avec @@parse_dates=["date"]@@. Indice : @@resample("ME").mean()@@.</p>`,
      starter: "import pandas as pd\nimport matplotlib.pyplot as plt\n\ndef courbe_temperatures(meteo):\n    fig, ax = plt.subplots()\n    ax.plot(meteo[\"date\"], meteo[\"temp_max\"])\n    return fig\n",
      solution: R`import pandas as pd
import matplotlib.pyplot as plt

def courbe_temperatures(meteo):
    mensuel = meteo.set_index("date")[["temp_max", "temp_min"]].resample("ME").mean()
    fig, ax = plt.subplots(figsize=(8, 3.5))
    ax.plot(mensuel.index, mensuel["temp_max"], label="max")
    ax.plot(mensuel.index, mensuel["temp_min"], label="min")
    ax.set_title("Températures à Seattle")
    ax.set_ylabel("°C")
    ax.legend()
    return fig`,
      tests: R`fig = courbe_temperatures(pd.read_csv("data/meteo-seattle.csv", parse_dates=["date"]))
ax = fig.axes[0]
print(len(fig.axes), ax.get_title(), ax.get_ylabel(), ax.get_legend() is not None)
print([ligne.get_label() for ligne in ax.lines], len(ax.lines[0].get_ydata()))
print(round(float(max(ax.lines[0].get_ydata())), 1))`,
      expected: "1 Températures à Seattle °C True\n['max', 'min'] 48\n28.1",
      hint: R`Passe la date en index (set_index("date")), rééchantillonne par mois avec resample("ME").mean(), puis trace deux fois ax.plot(..., label=...).`
    }
  },
  {
    id: "viz-02", section: "Visualisation", title: "Choisir le bon graphique", xp: 45,
    theory: R`<p>Le type de graphique dépend de la <strong>question posée</strong> :</p><ul><li><strong>barres</strong> : comparer des catégories ;</li><li><strong>histogramme</strong> : voir la distribution d'une variable ;</li><li><strong>nuage de points</strong> : relation entre deux variables ;</li><li><strong>courbe</strong> : évolution dans le temps.</li></ul>
~~~py
import pandas as pd
import matplotlib.pyplot as plt

df = pd.read_csv("data/penguins.csv")
fig, axes = plt.subplots(1, 3, figsize=(11, 3))

effectifs = df["species"].value_counts()
axes[0].bar(effectifs.index, effectifs.values)
axes[0].set_title("Effectif par espèce")

axes[1].hist(df["body_mass_g"].dropna(), bins=25)
axes[1].set_title("Distribution des masses (g)")

axes[2].scatter(df["flipper_length_mm"], df["body_mass_g"], s=8)
axes[2].set_title("Nageoire (mm) vs masse (g)")
fig.tight_layout()
~~~
<p>Le camembert est rarement le bon choix : l'œil compare mal les angles. Des barres triées sont plus lisibles.</p>`,
    quiz: [
      { q: "Tu veux montrer si la longueur des nageoires augmente avec la masse. Quel graphique ?", options: ["Un camembert", "Un histogramme", "Un nuage de points", "Des barres empilées"], answer: 2, explain: "Deux variables quantitatives, une relation à montrer : nuage de points (scatter)." },
      { q: "Pour voir si les salaires d'une entreprise sont symétriques ou concentrés vers le bas ?", options: ["Courbe", "Histogramme", "Barres par employé", "Camembert"], answer: 1, explain: "La forme d'une distribution se lit sur un histogramme (ou une boîte à moustaches)." }
    ],
    challenge: {
      prompt: R`<p>Écris @@barres_especes(df)@@ qui renvoie une figure avec un diagramme en <strong>barres</strong> du nombre de manchots par espèce, <strong>trié du plus grand au plus petit</strong>, avec un titre et l'axe y nommé @@"effectif"@@.</p>`,
      starter: "import pandas as pd\nimport matplotlib.pyplot as plt\n\ndef barres_especes(df):\n    fig, ax = plt.subplots()\n    ax.hist(df[\"body_mass_g\"].dropna())\n    return fig\n",
      solution: R`import pandas as pd
import matplotlib.pyplot as plt

def barres_especes(df):
    effectifs = df["species"].value_counts().sort_values(ascending=False)
    fig, ax = plt.subplots()
    ax.bar(effectifs.index, effectifs.values)
    ax.set_title("Manchots par espèce")
    ax.set_ylabel("effectif")
    return fig`,
      tests: R`fig = barres_especes(pd.read_csv("data/penguins.csv"))
fig.canvas.draw()
ax = fig.axes[0]
print([int(barre.get_height()) for barre in ax.patches])
print([t.get_text() for t in ax.get_xticklabels()], ax.get_ylabel(), ax.get_title() != "")`,
      expected: "[152, 124, 68]\n['Adelie', 'Gentoo', 'Chinstrap'] effectif True",
      hint: "value_counts() trie déjà par ordre décroissant ; ax.bar(effectifs.index, effectifs.values), puis titre et ylabel."
    }
  },
  {
    id: "viz-03", section: "Visualisation", title: "Sous-graphiques et tableau de bord", xp: 55,
    theory: R`<p>Pour comparer plusieurs vues d'un même jeu de données, on place plusieurs axes dans une figure. Une couleur par groupe se fait en traçant chaque groupe séparément, avec un @@label@@.</p>
~~~py
import pandas as pd
import matplotlib.pyplot as plt

df = pd.read_csv("data/penguins.csv")
fig, (gauche, droite) = plt.subplots(1, 2, figsize=(10, 3.8))

for espece, groupe in df.groupby("species"):
    gauche.scatter(groupe["bill_length_mm"], groupe["bill_depth_mm"], label=espece, s=10)
gauche.set_xlabel("longueur du bec (mm)")
gauche.set_ylabel("profondeur du bec (mm)")
gauche.legend(title="espèce")

moyennes = df.groupby("island")["body_mass_g"].mean().sort_values()
droite.barh(moyennes.index, moyennes.values)
droite.set_xlabel("masse moyenne (g)")
droite.annotate("le plus lourd", xy=(moyennes.max(), 2), xytext=(3000, 1.4),
                arrowprops={"arrowstyle": "->"})
fig.suptitle("Manchots de Palmer")
fig.tight_layout()
~~~`,
    quiz: [
      { q: R`Que renvoie @@plt.subplots(2, 3)@@ comme deuxième valeur ?`, options: ["Un seul Axes", "Un tableau 2 × 3 d'Axes", "Une liste de 6 figures", "Le nombre d'axes"], answer: 1, explain: "Un tableau NumPy d'Axes : axes[0, 1] est la 1re ligne, 2e colonne." }
    ],
    challenge: {
      prompt: R`<p>Écris @@tableau_de_bord(df)@@ qui renvoie une figure à <strong>deux</strong> axes côte à côte :</p><ul><li>à gauche, un nuage de points @@flipper_length_mm@@ (x) contre @@body_mass_g@@ (y), avec <strong>un nuage par espèce</strong> (label = nom de l'espèce) et une légende ;</li><li>à droite, un histogramme de @@bill_length_mm@@ en 20 classes (valeurs manquantes retirées).</li></ul>`,
      starter: "import pandas as pd\nimport matplotlib.pyplot as plt\n\ndef tableau_de_bord(df):\n    fig, ax = plt.subplots()\n    ax.scatter(df[\"flipper_length_mm\"], df[\"body_mass_g\"])\n    return fig\n",
      solution: R`import pandas as pd
import matplotlib.pyplot as plt

def tableau_de_bord(df):
    fig, (gauche, droite) = plt.subplots(1, 2, figsize=(10, 4))
    for espece, groupe in df.groupby("species"):
        gauche.scatter(groupe["flipper_length_mm"], groupe["body_mass_g"], label=espece, s=10)
    gauche.set_xlabel("nageoire (mm)")
    gauche.set_ylabel("masse (g)")
    gauche.legend()
    droite.hist(df["bill_length_mm"].dropna(), bins=20)
    droite.set_xlabel("longueur du bec (mm)")
    return fig`,
      tests: R`fig = tableau_de_bord(pd.read_csv("data/penguins.csv"))
g, d = fig.axes
print(len(fig.axes), len(g.collections), sorted(c.get_label() for c in g.collections), g.get_legend() is not None)
print(len(d.patches))`,
      expected: "2 3 ['Adelie', 'Chinstrap', 'Gentoo'] True\n20",
      hint: "plt.subplots(1, 2) ; une boucle for espece, groupe in df.groupby(\"species\") avec scatter(..., label=espece) ; hist(..., bins=20) sur l'axe de droite."
    }
  },
  {
    id: "viz-04", section: "Visualisation", title: "pandas.plot et seaborn", xp: 50,
    theory: R`<p>Deux raccourcis au-dessus de Matplotlib :</p><ul><li>@@df.plot(...)@@ : un graphique rapide directement depuis un DataFrame ;</li><li><strong>seaborn</strong> : des graphiques statistiques en une ligne, qui comprennent les DataFrames (@@hue@@ colore par catégorie). Il est installé à la demande la première fois (quelques secondes).</li></ul>
~~~py
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

df = pd.read_csv("data/penguins.csv")
fig, axes = plt.subplots(1, 2, figsize=(10, 3.8))
sns.boxplot(data=df, x="species", y="body_mass_g", ax=axes[0])
sns.scatterplot(data=df, x="flipper_length_mm", y="body_mass_g", hue="species", ax=axes[1], s=14)
fig.tight_layout()

meteo = pd.read_csv("data/meteo-seattle.csv", parse_dates=["date"])
ax = meteo.set_index("date")["temp_max"].resample("ME").mean().plot(title="temp_max mensuelle")
~~~
<p>La boîte à moustaches résume une distribution : médiane, quartiles et valeurs extrêmes. C'est un classique pour comparer des groupes.</p>`,
    quiz: [
      { q: R`Dans @@sns.scatterplot(data=df, x="a", y="b", hue="c")@@, à quoi sert @@hue@@ ?`, options: ["À changer la taille des points", "À colorer les points selon la colonne c", "À trier les données", "À filtrer les valeurs manquantes"], answer: 1, explain: "hue attribue une couleur par valeur de la colonne c et ajoute la légende automatiquement." },
      { q: "Que représente le trait central d'une boîte à moustaches ?", options: ["La moyenne", "La médiane", "Le maximum", "L'écart-type"], answer: 1, explain: "La boîte va du 1er au 3e quartile, le trait central est la médiane." }
    ],
    challenge: {
      prompt: R`<p>Avec <strong>seaborn</strong>, écris @@boite_masses(df)@@ qui trace une boîte à moustaches de @@body_mass_g@@ par espèce et renvoie l'<strong>Axes</strong> obtenu, avec le titre @@"Masse par espèce"@@ et l'axe y nommé @@"masse (g)"@@.</p>`,
      starter: "import pandas as pd\nimport seaborn as sns\n\ndef boite_masses(df):\n    return sns.histplot(data=df, x=\"body_mass_g\")\n",
      solution: R`import pandas as pd
import seaborn as sns

def boite_masses(df):
    ax = sns.boxplot(data=df, x="species", y="body_mass_g")
    ax.set_title("Masse par espèce")
    ax.set_ylabel("masse (g)")
    return ax`,
      tests: R`ax = boite_masses(pd.read_csv("data/penguins.csv"))
ax.figure.canvas.draw()
print(type(ax).__name__, ax.get_title(), ax.get_ylabel(), ax.get_xlabel())
print([t.get_text() for t in ax.get_xticklabels()])`,
      expected: "Axes Masse par espèce masse (g) species\n['Adelie', 'Gentoo', 'Chinstrap']",
      hint: R`sns.boxplot(data=df, x="species", y="body_mass_g") renvoie l'Axes ; complète-le avec set_title et set_ylabel.`
    }
  },
  {
    id: "viz-05", section: "Visualisation", title: "Défi : un graphique honnête", xp: 60,
    theory: R`<p>Un graphique peut mentir sans contenir une seule donnée fausse. Les pièges classiques, à repérer dans un rapport comme en entretien :</p><ul><li><strong>axe tronqué</strong> sur des barres : une différence de 1 % paraît énorme. La longueur d'une barre doit partir de 0 ;</li><li><strong>pas d'unités</strong> : « 5 000 », mais 5 000 quoi ?</li><li><strong>double axe y</strong> : on peut fabriquer n'importe quelle corrélation visuelle ;</li><li><strong>couleurs</strong> : une palette arc-en-ciel est illisible pour 8 % des hommes daltoniens. Préfère des palettes adaptées (@@tab10@@, @@colorblind@@ dans seaborn).</li></ul>
~~~py
import pandas as pd
import matplotlib.pyplot as plt

df = pd.read_csv("data/penguins.csv")
moyennes = df.groupby("species")["body_mass_g"].mean()
fig, (trompeur, honnete) = plt.subplots(1, 2, figsize=(10, 3.5))
trompeur.bar(moyennes.index, moyennes.values)
trompeur.set_ylim(3600, 5200)
trompeur.set_title("Trompeur : axe tronqué")
honnete.bar(moyennes.index, moyennes.values)
honnete.set_ylim(bottom=0)
honnete.set_ylabel("masse moyenne (g)")
honnete.set_title("Honnête : barres depuis 0")
fig.tight_layout()
~~~`,
    quiz: [
      { q: "Pourquoi un diagramme en barres doit-il partir de 0, alors qu'une courbe peut avoir un axe qui n'y part pas ?", options: ["C'est une convention sans raison", "On lit la valeur d'une barre à sa longueur ; on lit une courbe à ses variations", "Les courbes ne peuvent pas descendre à 0", "Matplotlib l'impose"], answer: 1, explain: "Tronquer une barre fausse le rapport des longueurs. Une courbe sert à voir des variations : zoomer sur l'intervalle utile est légitime." }
    ],
    challenge: {
      prompt: R`<p>La fonction @@graphique_trompeur(df)@@ (fournie) produit un diagramme trompeur. Écris @@corriger(fig)@@ qui <strong>modifie</strong> la figure reçue et la renvoie :</p><ul><li>l'axe y part de 0 ;</li><li>l'axe y est nommé avec son unité : @@"masse moyenne (g)"@@ ;</li><li>le titre devient @@"Masse moyenne par espèce"@@.</li></ul>`,
      starter: "import pandas as pd\nimport matplotlib.pyplot as plt\n\ndef graphique_trompeur(df):\n    m = df.groupby(\"species\")[\"body_mass_g\"].mean()\n    fig, ax = plt.subplots()\n    ax.bar(m.index, m.values)\n    ax.set_ylim(3600, 5200)\n    ax.set_title(\"Les Gentoo écrasent tout !\")\n    return fig\n\ndef corriger(fig):\n    return fig\n",
      solution: R`import pandas as pd
import matplotlib.pyplot as plt

def graphique_trompeur(df):
    m = df.groupby("species")["body_mass_g"].mean()
    fig, ax = plt.subplots()
    ax.bar(m.index, m.values)
    ax.set_ylim(3600, 5200)
    ax.set_title("Les Gentoo écrasent tout !")
    return fig

def corriger(fig):
    ax = fig.axes[0]
    ax.set_ylim(bottom=0)
    ax.set_ylabel("masse moyenne (g)")
    ax.set_title("Masse moyenne par espèce")
    return fig`,
      tests: R`fig = corriger(graphique_trompeur(pd.read_csv("data/penguins.csv")))
ax = fig.axes[0]
print(float(ax.get_ylim()[0]), float(ax.get_ylim()[1]) >= 5076, ax.get_ylabel(), ax.get_title())`,
      expected: "0.0 True masse moyenne (g) Masse moyenne par espèce",
      hint: R`fig.axes[0] donne l'Axes ; set_ylim(bottom=0) garde le haut de l'axe et ne change que le bas.`
    }
  }
];
