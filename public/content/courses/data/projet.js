/* Cours Data — projet guidé de bout en bout : prédire le sexe d'un manchot.
   Chaque étape est vérifiée automatiquement ; le panneau « Sur ta machine » guide la version portfolio. */
const R = String.raw;
const SECTION = "Projet : prédire le sexe d'un manchot";
const COLONNES = R`["bill_length_mm", "bill_depth_mm", "flipper_length_mm", "body_mass_g", "species", "island"]`;

const SETUP_PROJET = R`<p>Ce projet est fait pour ton portfolio. Refais-le sur ta machine, dans un dépôt GitHub à toi :</p>
~~~ps
mkdir manchots-sexe; cd manchots-sexe
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install pandas scikit-learn matplotlib seaborn jupyterlab
pip freeze > requirements.txt
mkdir data, notebooks
git init
~~~
<p>Copie @@penguins.csv@@ (dossier @@public/datasets/@@ du dépôt Boucle) dans @@data/@@, puis travaille dans @@notebooks/analyse.ipynb@@ (@@jupyter lab@@). Ajoute un @@.gitignore@@ contenant @@.venv/@@ et @@.ipynb_checkpoints/@@.</p>`;

const SETUP_PUBLIER = R`<p>Pour qu'un recruteur comprenne ton projet en deux minutes, le README compte autant que le code :</p>
~~~text
# Prédire le sexe d'un manchot à partir de ses mesures

**Question** : peut-on déterminer le sexe d'un manchot sans manipulation, à partir de 4 mesures ?
**Données** : 344 manchots de l'archipel Palmer (CC0), 333 avec le sexe connu.
**Résultat** : 92 % d'exactitude en validation croisée, contre 50 % pour la baseline.

## Démarche
1. Nettoyage : 11 manchots sans étiquette mis de côté (puis prédits).
2. Exploration : l'écart de masse mâle/femelle varie selon l'espèce, d'où l'espèce en entrée du modèle.
3. Validation : StratifiedKFold mélangé (les données sont triées par espèce).
4. Modèle : Pipeline (imputation, normalisation, one-hot) et régression logistique.

## Reproduire
pip install -r requirements.txt
jupyter lab notebooks/analyse.ipynb
~~~
~~~ps
git add .
git commit -m "feat: modèle de prédiction du sexe des manchots"
git branch -M main
git remote add origin https://github.com/<ton-compte>/manchots-sexe.git
git push -u origin main
~~~
<p>Épingle ensuite le dépôt sur ton profil GitHub (« Customize your pins »).</p>`;

export default [
  {
    id: "prj-01", section: SECTION, title: "1. Cadrer et préparer", xp: 60, setup: SETUP_PROJET,
    theory: R`<p>Sur le terrain, les biologistes mesurent facilement le bec, les nageoires et la masse d'un manchot. Déterminer son sexe est plus difficile : prise de sang ou observation du comportement. <strong>Question</strong> : un modèle peut-il deviner le sexe à partir des mesures ?</p><p>Avant de coder, on cadre le projet :</p><ul><li><strong>Cible</strong> : @@sex@@, binaire. On code mâle = 1, femelle = 0.</li><li><strong>Métrique</strong> : les classes sont équilibrées (environ 50/50), l'exactitude est donc parlante.</li><li><strong>Données</strong> : 11 manchots n'ont pas de sexe connu. Ils ne servent pas à l'entraînement, mais on prédira leur sexe à la fin.</li></ul>
~~~py
import pandas as pd
df = pd.read_csv("data/penguins.csv")
print(df["sex"].value_counts(dropna=False))
print(df.isna().sum())
~~~`,
    quiz: [
      { q: "Pourquoi ne pas remplir les 11 sexes manquants avec « male » (la classe majoritaire) avant d'entraîner ?", options: ["C'est trop lent", "On inventerait des étiquettes : le modèle apprendrait des erreurs, et l'évaluation serait faussée", "scikit-learn l'interdit", "Ça ne change rien"], answer: 1, explain: "On n'impute jamais la cible. Les lignes sans étiquette sortent de l'entraînement ; on peut les prédire ensuite." }
    ],
    challenge: {
      prompt: R`<p>Écris @@preparer(df)@@ qui renvoie le tuple @@(X, y)@@ :</p><ul><li>garde seulement les manchots dont le sexe est connu ;</li><li>@@X@@ : les colonnes @@${COLONNES}@@ (garde leurs valeurs manquantes, le pipeline s'en chargera) ;</li><li>@@y@@ : 1 pour @@"male"@@, 0 pour @@"female"@@, en entiers.</li></ul>`,
      starter: "import pandas as pd\n\ndef preparer(df):\n    X = df.drop(columns=[\"sex\"])\n    y = df[\"sex\"]\n    return X, y\n",
      solution: R`import pandas as pd

COLONNES = ["bill_length_mm", "bill_depth_mm", "flipper_length_mm", "body_mass_g", "species", "island"]

def preparer(df):
    connus = df.dropna(subset=["sex"])
    X = connus[COLONNES]
    y = (connus["sex"] == "male").astype(int)
    return X, y`,
      tests: R`X, y = preparer(pd.read_csv("data/penguins.csv"))
print(len(X), len(y), list(X.columns))
print(round(float(y.mean()), 3), sorted(set(y.tolist())), y.dtype.kind)`,
      expected: "333 333 ['bill_length_mm', 'bill_depth_mm', 'flipper_length_mm', 'body_mass_g', 'species', 'island']\n0.505 [0, 1] i",
      hint: R`df.dropna(subset=["sex"]) ; y = (connus["sex"] == "male").astype(int).`
    }
  },
  {
    id: "prj-02", section: SECTION, title: "2. Explorer : un dimorphisme qui dépend de l'espèce", xp: 60,
    theory: R`<p>Avant de modéliser, on regarde. Les mâles sont-ils plus lourds dans toutes les espèces, et dans la même mesure ?</p>
~~~py
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

df = pd.read_csv("data/penguins.csv").dropna(subset=["sex"])
fig, ax = plt.subplots(figsize=(7, 3.8))
sns.boxplot(data=df, x="species", y="body_mass_g", hue="sex", ax=ax)
ax.set_ylabel("masse (g)")
ax.set_title("Masse par espèce et par sexe")
~~~
<p>Deux constats décisifs pour la suite. Les mâles sont plus lourds dans chaque espèce, mais l'écart varie. Et surtout, une femelle Gentoo pèse plus qu'un mâle Adélie. La masse seule ne suffit donc pas : il faut la lire <strong>relativement à l'espèce</strong>. L'espèce doit être une variable d'entrée du modèle.</p>`,
    quiz: [
      { q: "Pourquoi l'espèce doit-elle être une entrée du modèle, alors qu'elle ne détermine pas le sexe ?", options: ["Elle n'est pas nécessaire", "Parce que la signification d'une mesure (lourd ou léger) dépend de l'espèce", "Pour avoir plus de colonnes", "Parce qu'elle est corrélée au sexe"], answer: 1, explain: "C'est une variable de contexte : 4 500 g est lourd pour une Adélie et léger pour une Gentoo." }
    ],
    challenge: {
      prompt: R`<p>Écris @@dimorphisme(df)@@ qui renvoie un dictionnaire @@{espèce: écart}@@, où l'écart est la masse moyenne des mâles moins celle des femelles de l'espèce, arrondie à 1 décimale (en @@float@@ Python).</p>`,
      starter: "import pandas as pd\n\ndef dimorphisme(df):\n    return df.groupby(\"species\")[\"body_mass_g\"].mean().round(1).to_dict()\n",
      solution: R`import pandas as pd

def dimorphisme(df):
    moyennes = df.groupby(["species", "sex"])["body_mass_g"].mean().unstack()
    ecarts = moyennes["male"] - moyennes["female"]
    return {espece: round(float(v), 1) for espece, v in ecarts.items()}`,
      tests: R`print(dimorphisme(pd.read_csv("data/penguins.csv")))`,
      expected: "{'Adelie': 674.7, 'Chinstrap': 411.8, 'Gentoo': 805.1}",
      hint: R`groupby(["species", "sex"])["body_mass_g"].mean().unstack() donne un tableau espèce × sexe ; soustrais la colonne "female" de la colonne "male".`
    }
  },
  {
    id: "prj-03", section: SECTION, title: "3. Baseline et validation honnête", xp: 70,
    theory: R`<p>Un score n'a de sens que comparé à une <strong>baseline</strong>, un modèle idiot. @@DummyClassifier@@ prédit toujours la classe majoritaire : ici environ 50 %. Tout modèle doit faire nettement mieux.</p><p>Et attention au <strong>découpage</strong>. Le fichier est trié par espèce (toutes les Adélie, puis les Gentoo, puis les Chinstrap). Sans mélange, la validation croisée forme des plis composés d'une seule espèce :</p>
~~~py
import pandas as pd
from sklearn.model_selection import StratifiedKFold

df = pd.read_csv("data/penguins.csv").dropna(subset=["sex"])
y = (df["sex"] == "male").astype(int)
for nom, cv in [("sans mélange", StratifiedKFold(5)), ("mélangé", StratifiedKFold(5, shuffle=True, random_state=0))]:
    _, test = list(cv.split(df, y))[-1]
    print(nom, df.iloc[test]["species"].value_counts().to_dict())
~~~
<p>Sans mélange, le dernier pli ne contient que des Chinstrap, que le modèle n'a jamais vus pendant l'entraînement : son score s'effondre (0,77 au lieu de 0,92). Mélanger, avec une graine pour la reproductibilité, est le bon réflexe dès que l'ordre des lignes porte une information.</p>`,
    quiz: [
      { q: "Ton modèle obtient 0,52 d'exactitude sur ce problème. Qu'en conclure ?", options: ["Il est correct", "Il ne fait pas mieux que la baseline (≈ 0,50) : il n'a rien appris d'utile", "Il faut plus de données", "C'est un bon début"], answer: 1, explain: "Sans baseline, 0,52 pourrait sembler acceptable. Comparé à 0,50, c'est un modèle inutile." }
    ],
    challenge: {
      prompt: R`<p>Écris @@evaluer_baseline(X, y)@@ qui crée un découpage @@StratifiedKFold@@ à 5 plis <strong>mélangés</strong> (@@random_state=0@@), évalue un @@DummyClassifier(strategy="most_frequent")@@ en validation croisée, et renvoie le tuple @@(cv, score_moyen)@@.</p>`,
      starter: "from sklearn.dummy import DummyClassifier\nfrom sklearn.model_selection import StratifiedKFold, cross_val_score\n\ndef evaluer_baseline(X, y):\n    cv = StratifiedKFold(5)\n    return cv, 0.0\n",
      solution: R`from sklearn.dummy import DummyClassifier
from sklearn.model_selection import StratifiedKFold, cross_val_score

def evaluer_baseline(X, y):
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=0)
    score = cross_val_score(DummyClassifier(strategy="most_frequent"), X, y, cv=cv).mean()
    return cv, float(score)`,
      tests: R`import pandas as pd
df = pd.read_csv("data/penguins.csv").dropna(subset=["sex"])
X, y = df[["bill_length_mm", "species"]], (df["sex"] == "male").astype(int)
cv, score = evaluer_baseline(X, y)
print(type(cv).__name__, cv.n_splits, cv.shuffle, cv.random_state, round(score, 2))`,
      expected: "StratifiedKFold 5 True 0 0.5",
      hint: "StratifiedKFold(n_splits=5, shuffle=True, random_state=0), puis cross_val_score(DummyClassifier(strategy=\"most_frequent\"), X, y, cv=cv).mean()."
    }
  },
  {
    id: "prj-04", section: SECTION, title: "4. Le modèle", xp: 70,
    theory: R`<p>On assemble un pipeline : imputation et normalisation des mesures, one-hot de l'espèce et de l'île, puis une régression logistique. Comparons avec et sans l'espèce pour vérifier l'intuition de l'étape 2 :</p>
~~~py
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline, make_pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_val_score

df = pd.read_csv("data/penguins.csv").dropna(subset=["sex"])
y = (df["sex"] == "male").astype(int)
mesures = ["bill_length_mm", "bill_depth_mm", "flipper_length_mm", "body_mass_g"]
cv = StratifiedKFold(5, shuffle=True, random_state=0)

def pipeline(categories):
    branches = [("num", make_pipeline(SimpleImputer(strategy="median"), StandardScaler()), mesures)]
    if categories:
        branches.append(("cat", OneHotEncoder(handle_unknown="ignore"), categories))
    return Pipeline([("prep", ColumnTransformer(branches)), ("modele", LogisticRegression(max_iter=1000))])

print("mesures seules :", cross_val_score(pipeline([]), df, y, cv=cv).mean().round(3))
print("avec l'espèce  :", cross_val_score(pipeline(["species", "island"]), df, y, cv=cv).mean().round(3))
~~~
<p>L'espèce fait gagner plusieurs points, comme l'exploration le laissait prévoir. Une forêt aléatoire fait à peu près jeu égal : à performance égale, on garde le modèle le plus simple et le plus explicable.</p>`,
    quiz: [
      { q: "Deux modèles ont 0,919 et 0,907 en validation croisée. Lequel choisir ?", options: ["Toujours le meilleur score", "S'ils sont dans la marge de variation entre plis, le plus simple et explicable", "Le plus récent", "La forêt, car elle est plus complexe"], answer: 1, explain: "Un écart d'un point est souvent du bruit (regarde l'écart-type des plis). La simplicité aide à expliquer, déboguer et maintenir." }
    ],
    challenge: {
      prompt: R`<p>Écris @@construire_modele()@@ qui renvoie un @@Pipeline@@ non entraîné prenant en entrée les colonnes @@${COLONNES}@@ (avec leurs valeurs manquantes) et prédisant le sexe. Il doit dépasser <strong>0,88</strong> en validation croisée mélangée, soit bien plus que la baseline.</p>`,
      starter: "from sklearn.pipeline import Pipeline\nfrom sklearn.linear_model import LogisticRegression\n\ndef construire_modele():\n    return Pipeline([(\"modele\", LogisticRegression(max_iter=1000))])\n",
      solution: R`from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline, make_pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.linear_model import LogisticRegression

def construire_modele():
    mesures = ["bill_length_mm", "bill_depth_mm", "flipper_length_mm", "body_mass_g"]
    preparation = ColumnTransformer([
        ("num", make_pipeline(SimpleImputer(strategy="median"), StandardScaler()), mesures),
        ("cat", OneHotEncoder(handle_unknown="ignore"), ["species", "island"]),
    ])
    return Pipeline([("prep", preparation), ("modele", LogisticRegression(max_iter=1000))])`,
      tests: R`import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.model_selection import StratifiedKFold, cross_val_score
df = pd.read_csv("data/penguins.csv").dropna(subset=["sex"])
X = df[["bill_length_mm", "bill_depth_mm", "flipper_length_mm", "body_mass_g", "species", "island"]]
y = (df["sex"] == "male").astype(int)
modele = construire_modele()
try:
    score = cross_val_score(modele, X, y, cv=StratifiedKFold(5, shuffle=True, random_state=0)).mean()
    print(isinstance(modele, Pipeline), score > 0.88)
except Exception as e:
    print("Le pipeline plante sur les données brutes :", type(e).__name__)`,
      expected: "True True",
      hint: "Reprends le pipeline de la leçon « Prétraitement et Pipeline », avec species et island comme catégories."
    }
  },
  {
    id: "prj-05", section: SECTION, title: "5. Évaluer, prédire et conclure", xp: 80, setup: SETUP_PUBLIER,
    theory: R`<p>Dernière étape : une évaluation finale sur un jeu de test mis de côté <strong>une seule fois</strong>, avec des métriques par classe, puis la prédiction des 11 manchots sans étiquette.</p>
~~~py
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline, make_pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.linear_model import LogisticRegression

df = pd.read_csv("data/penguins.csv")
colonnes = ["bill_length_mm", "bill_depth_mm", "flipper_length_mm", "body_mass_g", "species", "island"]
connus, inconnus = df[df["sex"].notna()], df[df["sex"].isna()]
X, y = connus[colonnes], (connus["sex"] == "male").astype(int)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=0, stratify=y)

modele = Pipeline([
    ("prep", ColumnTransformer([
        ("num", make_pipeline(SimpleImputer(strategy="median"), StandardScaler()), colonnes[:4]),
        ("cat", OneHotEncoder(handle_unknown="ignore"), colonnes[4:]),
    ])),
    ("modele", LogisticRegression(max_iter=1000)),
]).fit(X_train, y_train)
print(classification_report(y_test, modele.predict(X_test), target_names=["femelle", "mâle"]))
print(modele.predict(inconnus[colonnes]))
~~~
<p><strong>Conclure</strong>, c'est dire ce que le résultat permet de faire et ce qu'il ne permet pas. Environ 9 manchots sur 10 sont bien classés. C'est utile pour pré-trier sur le terrain, mais insuffisant pour remplacer une analyse génétique quand l'erreur coûte cher. Le modèle n'a vu que trois espèces de trois îles : il ne généralise pas au-delà.</p>`,
    quiz: [
      { q: "Pourquoi n'utiliser le jeu de test qu'une seule fois, à la fin ?", options: ["Pour gagner du temps", "Si on ajuste le modèle en regardant le test, le score final devient optimiste : le test a « fuité » dans les choix", "Parce que les données de test s'abîment", "C'est une convention sans importance"], answer: 1, explain: "Les choix (variables, hyperparamètres) se font en validation croisée sur l'entraînement. Le test donne l'estimation finale, non biaisée." }
    ],
    challenge: {
      prompt: R`<p>Écris @@evaluation_finale(df)@@ qui :</p><ol><li>sépare les manchots au sexe connu (cible : mâle = 1) de ceux au sexe inconnu ;</li><li>fait un découpage train/test (25 %, @@random_state=0@@, stratifié) ;</li><li>entraîne le modèle de l'étape 4 sur le train ;</li><li>renvoie un dictionnaire : @@"exactitude"@@ (sur le test), @@"rappels"@@ (liste @@[rappel femelles, rappel mâles]@@) et @@"inconnus"@@ (liste des prédictions 0/1 pour les manchots sans sexe connu).</li></ol>`,
      starter: "import pandas as pd\n\ndef evaluation_finale(df):\n    return {\"exactitude\": 0.0, \"rappels\": [0.0, 0.0], \"inconnus\": []}\n",
      solution: R`import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, recall_score
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline, make_pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.linear_model import LogisticRegression

COLONNES = ["bill_length_mm", "bill_depth_mm", "flipper_length_mm", "body_mass_g", "species", "island"]

def construire_modele():
    preparation = ColumnTransformer([
        ("num", make_pipeline(SimpleImputer(strategy="median"), StandardScaler()), COLONNES[:4]),
        ("cat", OneHotEncoder(handle_unknown="ignore"), COLONNES[4:]),
    ])
    return Pipeline([("prep", preparation), ("modele", LogisticRegression(max_iter=1000))])

def evaluation_finale(df):
    connus, inconnus = df[df["sex"].notna()], df[df["sex"].isna()]
    X, y = connus[COLONNES], (connus["sex"] == "male").astype(int)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=0, stratify=y)
    modele = construire_modele().fit(X_train, y_train)
    pred = modele.predict(X_test)
    return {
        "exactitude": float(accuracy_score(y_test, pred)),
        "rappels": [float(r) for r in recall_score(y_test, pred, average=None)],
        "inconnus": [int(p) for p in modele.predict(inconnus[COLONNES])],
    }`,
      tests: R`r = evaluation_finale(pd.read_csv("data/penguins.csv"))
print(r["exactitude"] >= 0.85, len(r["rappels"]), all(v >= 0.85 for v in r["rappels"]))
print(len(r["inconnus"]), set(r["inconnus"]) <= {0, 1})`,
      expected: "True 2 True\n11 True",
      hint: R`recall_score(y_test, pred, average=None) renvoie un rappel par classe, dans l'ordre 0 puis 1. Les inconnus : df[df["sex"].isna()].`
    }
  }
];
