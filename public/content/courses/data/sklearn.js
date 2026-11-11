/* Cours Data — chapitre scikit-learn.
   Règle : graines fixées (random_state) et seuils de score plutôt que valeurs exactes,
   car le navigateur (Pyodide, 32 bits) et la CI (64 bits) peuvent différer à la dernière décimale. */
const R = String.raw;

const SETUP_SKLEARN = R`<p>Sur ta machine :</p>
~~~ps
pip install scikit-learn
~~~
<p>Le paquet s'appelle @@scikit-learn@@, mais il s'importe sous le nom @@sklearn@@. Les jeux de données d'exemple (@@load_iris@@, @@load_breast_cancer@@…) sont inclus dans le paquet : aucun téléchargement n'est nécessaire.</p>`;

export default [
  {
    id: "sk-01", section: "scikit-learn", title: "Premier modèle : fit, predict, évaluer", xp: 50, setup: SETUP_SKLEARN,
    theory: R`<p>Tous les modèles scikit-learn partagent la même interface : on crée l'objet, on l'entraîne avec @@fit(X, y)@@ et on prédit avec @@predict(X)@@. @@X@@ est une matrice (une ligne par exemple, une colonne par variable), @@y@@ la cible.</p><p>Règle d'or : on évalue un modèle sur des données qu'il <strong>n'a pas vues</strong> pendant l'entraînement. Sinon, on mesure sa mémoire, pas sa capacité à généraliser.</p>
~~~py
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error

df = pd.read_csv("data/penguins.csv").dropna(subset=["flipper_length_mm", "body_mass_g"])
X = df[["flipper_length_mm"]]          # doubles crochets : X doit être en 2D
y = df["body_mass_g"]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=42)
modele = LinearRegression().fit(X_train, y_train)
print(round(modele.coef_[0], 1), round(modele.intercept_, 1))
print("MAE :", round(mean_absolute_error(y_test, modele.predict(X_test))), "g")
~~~
<p>La <strong>MAE</strong> (erreur absolue moyenne) se lit dans l'unité de la cible : « le modèle se trompe en moyenne de 280 g ». C'est plus parlant pour un client que la MSE ou le R².</p>`,
    quiz: [
      { q: R`Pourquoi @@X = df[["flipper_length_mm"]]@@ avec des doubles crochets ?`, options: ["C'est plus rapide", "scikit-learn attend un X en 2D (lignes × variables), même avec une seule variable", "Pour copier les données", "Les simples crochets sont interdits"], answer: 1, explain: "df[\"col\"] est une Series (1D) ; df[[\"col\"]] est un DataFrame (2D). fit refuse un X en 1D." },
      { q: "Pourquoi fixer random_state dans train_test_split ?", options: ["Pour améliorer le score", "Pour que la séparation soit identique à chaque exécution, donc les résultats reproductibles", "C'est obligatoire", "Pour équilibrer les classes"], answer: 1, explain: "Sans graine, chaque exécution donne un autre découpage et un autre score : impossible de comparer deux modèles honnêtement." }
    ],
    challenge: {
      prompt: R`<p>Écris @@entrainer(df)@@ qui prédit @@body_mass_g@@ à partir de @@flipper_length_mm@@ :</p><ol><li>supprime les lignes où l'une des deux colonnes manque ;</li><li>sépare 25 % des données pour le test, avec @@random_state=42@@ ;</li><li>entraîne une @@LinearRegression@@ ;</li><li>renvoie un dictionnaire : @@"modele"@@, @@"n_train"@@, @@"n_test"@@ et @@"mae"@@ (erreur absolue moyenne <strong>sur le test</strong>).</li></ol>`,
      starter: "import pandas as pd\nfrom sklearn.linear_model import LinearRegression\nfrom sklearn.metrics import mean_absolute_error\n\ndef entrainer(df):\n    d = df.dropna(subset=[\"flipper_length_mm\", \"body_mass_g\"])\n    X, y = d[[\"flipper_length_mm\"]], d[\"body_mass_g\"]\n    modele = LinearRegression().fit(X, y)\n    mae = mean_absolute_error(y, modele.predict(X))\n    return {\"modele\": modele, \"n_train\": len(X), \"n_test\": 0, \"mae\": mae}\n",
      solution: R`import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error

def entrainer(df):
    d = df.dropna(subset=["flipper_length_mm", "body_mass_g"])
    X, y = d[["flipper_length_mm"]], d["body_mass_g"]
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=42)
    modele = LinearRegression().fit(X_train, y_train)
    mae = mean_absolute_error(y_test, modele.predict(X_test))
    return {"modele": modele, "n_train": len(X_train), "n_test": len(X_test), "mae": float(mae)}`,
      tests: R`r = entrainer(pd.read_csv("data/penguins.csv"))
print(type(r["modele"]).__name__, r["n_train"], r["n_test"])
print(250 < r["mae"] < 320)`,
      expected: "LinearRegression 256 86\nTrue",
      hint: "train_test_split(X, y, test_size=0.25, random_state=42) renvoie X_train, X_test, y_train, y_test. Entraîne sur train, mesure sur test."
    }
  },
  {
    id: "sk-02", section: "scikit-learn", title: "Classification", xp: 50,
    theory: R`<p>En classification, la cible est une catégorie. Les fleurs <strong>iris</strong> (3 espèces, 4 mesures) sont le « hello world » du domaine. Les k plus proches voisins (<strong>KNN</strong>) prédisent la classe majoritaire parmi les k exemples d'entraînement les plus proches.</p>
~~~py
from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from sklearn.neighbors import KNeighborsClassifier
from sklearn.metrics import accuracy_score, confusion_matrix

X, y = load_iris(return_X_y=True)
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.3, random_state=0, stratify=y)   # stratify : mêmes proportions de classes
knn = KNeighborsClassifier(n_neighbors=5).fit(X_train, y_train)
pred = knn.predict(X_test)
print(accuracy_score(y_test, pred))
print(confusion_matrix(y_test, pred))   # lignes = vraie classe, colonnes = prédite
print(knn.predict_proba(X_test[:2]))    # probabilité de chaque classe
~~~
<p>La <strong>matrice de confusion</strong> montre quelles classes le modèle confond entre elles. C'est souvent plus utile qu'un score unique.</p>`,
    quiz: [
      { q: R`À quoi sert @@stratify=y@@ dans @@train_test_split@@ ?`, options: ["À trier les données", "À garder les mêmes proportions de chaque classe dans train et test", "À supprimer les doublons", "À normaliser X"], answer: 1, explain: "Sans stratification, une classe rare peut être absente du test par malchance." }
    ],
    challenge: {
      prompt: R`<p>Écris @@classifier_iris()@@ qui charge les iris, sépare 30 % pour le test (@@random_state=0@@, stratifié), entraîne un KNN à 5 voisins et renvoie le tuple @@(exactitude, matrice_de_confusion)@@ sur le test.</p>`,
      starter: "from sklearn.datasets import load_iris\nfrom sklearn.neighbors import KNeighborsClassifier\n\ndef classifier_iris():\n    X, y = load_iris(return_X_y=True)\n    knn = KNeighborsClassifier(n_neighbors=5).fit(X, y)\n    return knn.score(X, y), None\n",
      solution: R`from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from sklearn.neighbors import KNeighborsClassifier
from sklearn.metrics import accuracy_score, confusion_matrix

def classifier_iris():
    X, y = load_iris(return_X_y=True)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=0, stratify=y)
    knn = KNeighborsClassifier(n_neighbors=5).fit(X_train, y_train)
    pred = knn.predict(X_test)
    return accuracy_score(y_test, pred), confusion_matrix(y_test, pred)`,
      tests: R`import numpy as np
acc, cm = classifier_iris()
cm = np.asarray(cm)
print(acc >= 0.9, cm.shape, int(cm.sum()), cm.sum(axis=1).tolist())`,
      expected: "True (3, 3) 45 [15, 15, 15]",
      hint: "train_test_split(..., test_size=0.3, random_state=0, stratify=y), puis accuracy_score et confusion_matrix sur le test uniquement."
    }
  },
  {
    id: "sk-03", section: "scikit-learn", title: "Précision, rappel et F1", xp: 60,
    theory: R`<p>Sur des classes déséquilibrées, l'exactitude trompe. Si 1 % des transactions sont frauduleuses, un modèle qui répond toujours « pas de fraude » a 99 % d'exactitude et ne sert à rien. On regarde alors :</p><ul><li><strong>précision</strong> = VP / (VP + FP) : parmi les alertes, combien sont justes ?</li><li><strong>rappel</strong> = VP / (VP + FN) : parmi les vrais cas, combien sont détectés ?</li><li><strong>F1</strong> = 2 · précision · rappel / (précision + rappel) : la moyenne harmonique des deux.</li></ul>
~~~py
from sklearn.metrics import precision_score, recall_score, f1_score, classification_report

reel   = [1, 0, 1, 1, 0, 1, 0, 0, 1, 1]
predit = [1, 0, 0, 1, 0, 1, 1, 0, 1, 0]
print(precision_score(reel, predit), recall_score(reel, predit), round(f1_score(reel, predit), 3))
print(classification_report(reel, predit))
~~~
<p>Le compromis dépend du métier. Pour un dépistage médical, on privilégie le rappel : ne rater aucun malade. Pour un filtre anti-spam, on privilégie la précision : ne jamais jeter un vrai courriel. Pour un modèle qui renvoie des probabilités, l'<strong>AUC ROC</strong> (@@roc_auc_score@@) mesure la qualité du classement, tous seuils confondus.</p>`,
    quiz: [
      { q: "Un détecteur de fraude a une précision de 0,95 et un rappel de 0,20. Que comprendre ?", options: ["Il détecte presque toutes les fraudes", "Ses alertes sont fiables, mais il rate 80 % des fraudes", "Il déclenche beaucoup de fausses alertes", "Il est parfait"], answer: 1, explain: "Précision élevée : peu de fausses alertes. Rappel faible : la majorité des fraudes passent." }
    ],
    challenge: {
      prompt: R`<p><strong>Classique d'entretien.</strong> Écris @@metriques(reel, predit)@@ <strong>sans utiliser @@sklearn.metrics@@</strong> : compte toi-même VP, FP et FN (classe positive = 1) et renvoie un dictionnaire @@precision@@, @@rappel@@, @@f1@@, chacun arrondi à 3 décimales. Quand un dénominateur vaut 0, la métrique vaut 0.0.</p>`,
      starter: "def metriques(reel, predit):\n    justes = sum(1 for r, p in zip(reel, predit) if r == p)\n    exactitude = round(justes / len(reel), 3)\n    return {\"precision\": exactitude, \"rappel\": exactitude, \"f1\": exactitude}\n",
      solution: R`def metriques(reel, predit):
    vp = sum(1 for r, p in zip(reel, predit) if r == 1 and p == 1)
    fp = sum(1 for r, p in zip(reel, predit) if r == 0 and p == 1)
    fn = sum(1 for r, p in zip(reel, predit) if r == 1 and p == 0)
    precision = vp / (vp + fp) if vp + fp else 0.0
    rappel = vp / (vp + fn) if vp + fn else 0.0
    f1 = 2 * precision * rappel / (precision + rappel) if precision + rappel else 0.0
    return {"precision": round(precision, 3), "rappel": round(rappel, 3), "f1": round(f1, 3)}`,
      tests: R`print(metriques([1, 0, 1, 1, 0, 1, 0, 0, 1, 1], [1, 0, 0, 1, 0, 1, 1, 0, 1, 0]))
print(metriques([1, 1, 1, 0], [1, 0, 0, 0]))
print(metriques([1, 1, 0], [0, 0, 0]))`,
      expected: "{'precision': 0.8, 'rappel': 0.667, 'f1': 0.727}\n{'precision': 1.0, 'rappel': 0.333, 'f1': 0.5}\n{'precision': 0.0, 'rappel': 0.0, 'f1': 0.0}",
      hint: "Compte VP (réel 1, prédit 1), FP (réel 0, prédit 1) et FN (réel 1, prédit 0). Protège chaque division : x / y if y else 0.0."
    }
  },
  {
    id: "sk-04", section: "scikit-learn", title: "Prétraitement et Pipeline", xp: 60,
    theory: R`<p>Les vraies données mélangent des nombres (à remettre à l'échelle), des catégories (à encoder) et des valeurs manquantes (à imputer). Un <strong>Pipeline</strong> enchaîne ces étapes et le modèle dans un seul objet, qui s'entraîne et prédit d'un bloc. C'est ce qu'on met en production.</p>
~~~py
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline, make_pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score

df = pd.read_csv("data/penguins.csv")
numeriques = ["bill_length_mm", "bill_depth_mm", "flipper_length_mm", "body_mass_g"]
categories = ["island", "sex"]
X, y = df[numeriques + categories], df["species"]

preparation = ColumnTransformer([
    ("num", make_pipeline(SimpleImputer(strategy="median"), StandardScaler()), numeriques),
    ("cat", make_pipeline(SimpleImputer(strategy="most_frequent"), OneHotEncoder(handle_unknown="ignore")), categories),
])
pipeline = Pipeline([("prep", preparation), ("modele", LogisticRegression(max_iter=1000))])
print(cross_val_score(pipeline, X, y, cv=5).mean().round(3))
~~~
<ul><li>@@StandardScaler@@ centre et réduit chaque variable : indispensable pour les modèles sensibles aux échelles (régression logistique, KNN, SVM, réseaux de neurones).</li><li>@@OneHotEncoder@@ transforme une catégorie en colonnes 0/1. @@handle_unknown="ignore"@@ évite une erreur si une catégorie inconnue apparaît en production.</li></ul>`,
    quiz: [
      { q: "Pourquoi ne pas encoder les îles Biscoe, Dream, Torgersen en 0, 1, 2 ?", options: ["C'est trop lent", "Le modèle croirait à un ordre et à des distances (Torgersen = 2 × Dream), ce qui n'a pas de sens", "scikit-learn refuse les entiers", "On perdrait des lignes"], answer: 1, explain: "Pour des catégories sans ordre, le one-hot évite d'inventer une relation numérique." }
    ],
    challenge: {
      prompt: R`<p>Écris @@construire_pipeline()@@ qui renvoie un <strong>Pipeline</strong> non entraîné capable de prédire @@species@@ à partir des colonnes @@bill_length_mm@@, @@bill_depth_mm@@, @@flipper_length_mm@@, @@body_mass_g@@, @@island@@ et @@sex@@ <strong>brutes</strong> (avec leurs valeurs manquantes et leurs textes). Vise une exactitude en validation croisée d'au moins 0,97.</p>`,
      starter: "from sklearn.pipeline import Pipeline\nfrom sklearn.linear_model import LogisticRegression\n\ndef construire_pipeline():\n    return Pipeline([(\"modele\", LogisticRegression(max_iter=1000))])\n",
      solution: R`from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline, make_pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.linear_model import LogisticRegression

def construire_pipeline():
    numeriques = ["bill_length_mm", "bill_depth_mm", "flipper_length_mm", "body_mass_g"]
    categories = ["island", "sex"]
    preparation = ColumnTransformer([
        ("num", make_pipeline(SimpleImputer(strategy="median"), StandardScaler()), numeriques),
        ("cat", make_pipeline(SimpleImputer(strategy="most_frequent"), OneHotEncoder(handle_unknown="ignore")), categories),
    ])
    return Pipeline([("prep", preparation), ("modele", LogisticRegression(max_iter=1000))])`,
      tests: R`import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.model_selection import cross_val_score
df = pd.read_csv("data/penguins.csv")
X = df[["bill_length_mm", "bill_depth_mm", "flipper_length_mm", "body_mass_g", "island", "sex"]]
pipe = construire_pipeline()
try:
    score = cross_val_score(pipe, X, df["species"], cv=5).mean()
    print(isinstance(pipe, Pipeline), score >= 0.97)
except Exception as e:
    print("Le pipeline plante sur les données brutes :", type(e).__name__)`,
      expected: "True True",
      hint: "Un ColumnTransformer avec deux branches : numériques (SimpleImputer médiane + StandardScaler) et catégories (SimpleImputer most_frequent + OneHotEncoder), puis le modèle."
    }
  },
  {
    id: "sk-05", section: "scikit-learn", title: "Validation croisée et surapprentissage", xp: 60,
    theory: R`<p>Un modèle trop complexe apprend le bruit des données d'entraînement : c'est le <strong>surapprentissage</strong> (overfitting). On le repère quand le score d'entraînement est très bon et le score sur données nouvelles nettement moins bon.</p>
~~~py
from sklearn.datasets import load_breast_cancer
from sklearn.tree import DecisionTreeClassifier
from sklearn.model_selection import cross_val_score

X, y = load_breast_cancer(return_X_y=True)
for profondeur in [1, 2, 3, 5, None]:
    arbre = DecisionTreeClassifier(max_depth=profondeur, random_state=0)
    entrainement = arbre.fit(X, y).score(X, y)
    validation = cross_val_score(arbre, X, y, cv=5).mean()
    print(profondeur, round(entrainement, 3), round(validation, 3))
~~~
<p>Sans limite de profondeur, l'arbre atteint 100 % sur l'entraînement mais pas en validation. La <strong>validation croisée</strong> à 5 plis découpe les données en 5, entraîne 5 fois sur 4/5 et teste sur le 1/5 restant. Le score obtenu est plus fiable qu'un seul découpage train/test.</p>`,
    quiz: [
      { q: "Score d'entraînement 1,00, validation croisée 0,82. Diagnostic ?", options: ["Sous-apprentissage", "Surapprentissage : le modèle est trop complexe ou les données insuffisantes", "Fuite de données", "Le modèle est parfait"], answer: 1, explain: "Un grand écart entre entraînement et validation est la signature du surapprentissage. Remèdes : simplifier le modèle, régulariser, ajouter des données." }
    ],
    challenge: {
      prompt: R`<p>Écris @@meilleure_profondeur(X, y, profondeurs)@@ qui évalue un @@DecisionTreeClassifier(random_state=0)@@ pour chaque profondeur de la liste, par validation croisée à 5 plis, et renvoie le tuple @@(meilleure_profondeur, meilleur_score)@@.</p>`,
      starter: "from sklearn.tree import DecisionTreeClassifier\n\ndef meilleure_profondeur(X, y, profondeurs):\n    meilleur = None\n    for p in profondeurs:\n        score = DecisionTreeClassifier(max_depth=p, random_state=0).fit(X, y).score(X, y)\n        if meilleur is None or score > meilleur[1]:\n            meilleur = (p, score)\n    return meilleur\n",
      solution: R`from sklearn.tree import DecisionTreeClassifier
from sklearn.model_selection import cross_val_score

def meilleure_profondeur(X, y, profondeurs):
    meilleur = None
    for p in profondeurs:
        score = cross_val_score(DecisionTreeClassifier(max_depth=p, random_state=0), X, y, cv=5).mean()
        if meilleur is None or score > meilleur[1]:
            meilleur = (p, float(score))
    return meilleur`,
      tests: R`from sklearn.datasets import load_breast_cancer
X, y = load_breast_cancer(return_X_y=True)
p, s = meilleure_profondeur(X, y, [1, 2, 3, 5, None])
print(p in (2, 3), 0.9 < s < 0.96)`,
      expected: "True True",
      hint: "Remplace le score d'entraînement par cross_val_score(modele, X, y, cv=5).mean() : c'est lui qu'on compare."
    }
  },
  {
    id: "sk-06", section: "scikit-learn", title: "Forêts aléatoires et recherche d'hyperparamètres", xp: 60,
    theory: R`<p>Une <strong>forêt aléatoire</strong> moyenne les votes de nombreux arbres, chacun entraîné sur un échantillon différent : beaucoup moins de surapprentissage qu'un arbre seul. Le <strong>gradient boosting</strong> (@@HistGradientBoostingClassifier@@, XGBoost, LightGBM) enchaîne des arbres qui corrigent les erreurs des précédents. C'est souvent le meilleur choix sur des données tabulaires.</p>
~~~py
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import GridSearchCV

df = pd.read_csv("data/penguins.csv").dropna()
variables = ["bill_length_mm", "bill_depth_mm", "flipper_length_mm", "body_mass_g"]
foret = RandomForestClassifier(n_estimators=100, random_state=0).fit(df[variables], df["species"])
for nom, importance in sorted(zip(variables, foret.feature_importances_), key=lambda v: -v[1]):
    print(f"{nom:20} {importance:.2f}")

grille = GridSearchCV(RandomForestClassifier(random_state=0),
                      {"n_estimators": [20, 50], "max_depth": [2, None]}, cv=5)
grille.fit(df[variables], df["species"])
print(grille.best_params_, round(grille.best_score_, 3))
~~~
<p>@@GridSearchCV@@ essaie toutes les combinaisons d'hyperparamètres en validation croisée, puis réentraîne la meilleure sur toutes les données. Avec beaucoup de combinaisons, @@RandomizedSearchCV@@ en tire un échantillon au hasard, ce qui va beaucoup plus vite.</p>`,
    quiz: [
      { q: "Quelle est la différence entre un paramètre et un hyperparamètre ?", options: ["Aucune", "Le modèle apprend les paramètres (poids, seuils) ; on choisit les hyperparamètres (profondeur, nombre d'arbres) avant l'entraînement", "Les hyperparamètres sont plus importants", "Les paramètres sont fixés par l'utilisateur"], answer: 1, explain: "C'est pour régler les hyperparamètres qu'on utilise la validation croisée, jamais le jeu de test final." }
    ],
    challenge: {
      prompt: R`<p>Écris @@recherche(X, y)@@ qui lance un @@GridSearchCV@@ (5 plis) sur un @@RandomForestClassifier(random_state=0)@@ avec @@n_estimators@@ ∈ {20, 50} et @@max_depth@@ ∈ {2, None}, et renvoie l'objet @@GridSearchCV@@ entraîné.</p>`,
      starter: "from sklearn.ensemble import RandomForestClassifier\n\ndef recherche(X, y):\n    return RandomForestClassifier(random_state=0).fit(X, y)\n",
      solution: R`from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import GridSearchCV

def recherche(X, y):
    grille = {"n_estimators": [20, 50], "max_depth": [2, None]}
    return GridSearchCV(RandomForestClassifier(random_state=0), grille, cv=5).fit(X, y)`,
      tests: R`from sklearn.datasets import load_iris
X, y = load_iris(return_X_y=True)
g = recherche(X, y)
print(type(g).__name__, sorted(g.best_params_), len(g.cv_results_["params"]))
print(g.best_score_ > 0.93, len(g.predict(X[:3])))`,
      expected: "GridSearchCV ['max_depth', 'n_estimators'] 4\nTrue 3",
      hint: "GridSearchCV(estimateur, grille, cv=5).fit(X, y) : la grille est un dictionnaire {nom: [valeurs]}."
    }
  },
  {
    id: "sk-07", section: "scikit-learn", title: "Défi entretien : la fuite de données", xp: 70,
    theory: R`<p>Une <strong>fuite de données</strong> (data leakage) se produit quand une information du jeu de test influence l'entraînement. Le score paraît excellent, puis s'effondre en production. C'est une question d'entretien ML très fréquente.</p><p>Erreur classique : normaliser (ou imputer, ou sélectionner des variables) sur <strong>toutes</strong> les données avant la validation croisée. La moyenne et l'écart-type utilisés contiennent alors de l'information sur les plis de test.</p>
~~~py
from sklearn.datasets import load_breast_cancer
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score
from sklearn.pipeline import make_pipeline

X, y = load_breast_cancer(return_X_y=True)

# Fuite : le scaler voit tout X, y compris les futurs plis de test
X_fuite = StandardScaler().fit_transform(X)
print(cross_val_score(LogisticRegression(max_iter=1000), X_fuite, y, cv=5).mean().round(3))

# Correct : le scaler est réentraîné dans chaque pli, sur l'entraînement seulement
propre = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000))
print(cross_val_score(propre, X, y, cv=5).mean().round(3))
~~~
<p>Ici l'écart est faible, mais avec une sélection de variables ou une imputation sur peu de données, la fuite peut faire gagner artificiellement 10 à 20 points. Autres fuites classiques : une variable qui n'existe qu'après l'événement prédit (le « motif de résiliation » pour prédire une résiliation), et un découpage aléatoire sur des séries temporelles (le futur prédit le passé : utilise @@TimeSeriesSplit@@).</p>`,
    quiz: [
      { q: "Pour prédire si un client va résilier, quelle variable est une fuite ?", options: ["Son ancienneté", "Le nombre d'appels au service client le mois dernier", "La date de résiliation", "Son forfait"], answer: 2, explain: "La date de résiliation n'existe que si l'événement a déjà eu lieu : le modèle « triche » et sera inutilisable en production." }
    ],
    challenge: {
      prompt: R`<p>Écris @@evaluation_sans_fuite(X, y)@@ qui évalue une régression logistique (@@max_iter=1000@@) avec normalisation, <strong>sans fuite</strong>, en validation croisée à 5 plis. Renvoie le tuple @@(pipeline, scores)@@ : le pipeline utilisé (un @@StandardScaler@@ suivi du modèle) et le tableau des 5 scores.</p>`,
      starter: "from sklearn.preprocessing import StandardScaler\nfrom sklearn.linear_model import LogisticRegression\nfrom sklearn.model_selection import cross_val_score\n\ndef evaluation_sans_fuite(X, y):\n    X_norm = StandardScaler().fit_transform(X)\n    modele = LogisticRegression(max_iter=1000)\n    return modele, cross_val_score(modele, X_norm, y, cv=5)\n",
      solution: R`from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score
from sklearn.pipeline import Pipeline

def evaluation_sans_fuite(X, y):
    pipeline = Pipeline([("scaler", StandardScaler()), ("modele", LogisticRegression(max_iter=1000))])
    return pipeline, cross_val_score(pipeline, X, y, cv=5)`,
      tests: R`from sklearn.datasets import load_breast_cancer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
X, y = load_breast_cancer(return_X_y=True)
pipe, scores = evaluation_sans_fuite(X, y)
print(isinstance(pipe, Pipeline), isinstance(pipe.steps[0][1], StandardScaler), len(scores), scores.mean() > 0.95)`,
      expected: "True True 5 True",
      hint: "Mets le StandardScaler dans un Pipeline avec le modèle, et passe le pipeline (pas des données déjà normalisées) à cross_val_score."
    }
  }
];
