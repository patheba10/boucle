/* Cours « Python data » : NumPy, puis pandas, visualisation, SciPy, scikit-learn (étape 2). */
const R = String.raw;

const SETUP_NUMPY = R`<p>Dans le navigateur, NumPy se charge tout seul. Sur ta machine, dans un environnement virtuel (voir la page <a href="#installer">Installer</a>) :</p>
~~~ps
pip install numpy
python -c "import numpy as np; print(np.__version__)"
~~~
<p>Convention universelle : @@import numpy as np@@. Tu la retrouveras dans tout le code data que tu liras.</p>`;

export default {
  id: "data", route: "data", badge: "np", name: "Python data", tag: "import numpy as np", lang: "py",
  blurb: "NumPy, pandas, Matplotlib, SciPy et scikit-learn : les outils de la data science et du ML, avec les vraies bibliothèques dans ton navigateur.",
  note: "Ce cours suppose les bases du cours Python (fonctions, listes, dictionnaires). Le premier lancement charge NumPy (quelques Mo) : compte quelques secondes.",
  lessons: [
  {
    id: "np-01", section: "NumPy", title: "Le tableau ndarray", xp: 40, setup: SETUP_NUMPY,
    theory: R`<p>Le cœur de NumPy est le <strong>ndarray</strong> : un tableau de taille fixe dont tous les éléments ont le même type, rangés côte à côte en mémoire. C'est ce qui le rend 10 à 100 fois plus rapide qu'une liste Python pour le calcul.</p>
~~~py
import numpy as np

a = np.array([3, 1, 4, 1, 5])
m = np.array([[1.0, 2.0, 3.0],
              [4.0, 5.0, 6.0]])
print(a.shape, m.shape)        # (5,) (2, 3)
print(m.ndim, m.size, m.dtype) # 2 6 float64

print(np.zeros((2, 3)))
print(np.arange(0, 10, 2))     # comme range, mais en tableau
print(np.linspace(0, 1, 5))    # 5 points régulièrement espacés
print(np.arange(6).reshape(2, 3))
~~~
<ul><li>@@shape@@ donne la taille de chaque dimension : @@(lignes, colonnes)@@ pour une matrice.</li><li>@@reshape@@ réorganise les mêmes données sous une autre forme, sans les copier. Le nombre total d'éléments doit rester identique.</li><li>Le @@dtype@@ des entiers par défaut dépend de la machine : @@int64@@ sur ton PC, @@int32@@ dans ce navigateur (Pyodide est en 32 bits). Ne suppose jamais un @@dtype@@ d'entier : précise-le (@@dtype=np.int64@@) quand il compte.</li></ul>`,
    quiz: [
      { q: R`Que vaut @@np.zeros((2, 3)).shape@@ ?`, options: ["(3, 2)", "(2, 3)", "6", "(2, 3, 0)"], answer: 1, explain: "Le tuple passé à zeros est directement la forme : 2 lignes, 3 colonnes." },
      { q: R`Pourquoi @@np.arange(7).reshape(2, 3)@@ échoue-t-il ?`, options: ["reshape n'accepte que des carrés", "7 éléments ne remplissent pas 2 × 3 = 6 cases", "arange renvoie une liste", "Il faut écrire reshape((3, 2))"], answer: 1, explain: "reshape conserve le nombre d'éléments : 7 ≠ 6, NumPy lève une ValueError." }
    ],
    challenge: {
      prompt: R`<p>Écris @@grille(n)@@ qui renvoie un tableau @@n × n@@ contenant les entiers de 0 à n² − 1, ligne par ligne :</p><pre class="out">grille(3)
[[0 1 2]
 [3 4 5]
 [6 7 8]]</pre>`,
      starter: "import numpy as np\n\ndef grille(n):\n    return np.zeros(n)\n",
      solution: R`import numpy as np

def grille(n):
    return np.arange(n * n).reshape(n, n)`,
      tests: R`g = grille(3)
print(type(g).__name__, g.shape, g.tolist())
print(grille(1).tolist(), grille(4)[3].tolist())`,
      expected: "ndarray (3, 3) [[0, 1, 2], [3, 4, 5], [6, 7, 8]]\n[[0]] [12, 13, 14, 15]",
      hint: "np.arange(n * n) donne les valeurs, .reshape(n, n) leur donne la forme carrée."
    }
  },
  {
    id: "np-02", section: "NumPy", title: "Vectorisation", xp: 40,
    theory: R`<p>Avec NumPy, on n'écrit (presque) plus de boucles : une opération sur un tableau s'applique à <strong>chaque élément</strong>, en C, d'un seul coup. C'est la <strong>vectorisation</strong>.</p>
~~~py
import numpy as np

prix = np.array([10.0, 25.0, 40.0])
print(prix * 1.15)             # TPS+TVQ arrondie, sur chaque prix
print(prix + np.array([1, 2, 3]))
print(np.sqrt(prix).round(2))  # fonctions « universelles » (ufuncs)
print(prix > 20)               # comparaison élément par élément

# Le même calcul avec une boucle Python, à éviter :
total = []
for p in prix:
    total.append(p * 1.15)
print(total)
~~~
<p>Sur un million d'éléments, la version vectorisée est environ 50 fois plus rapide. C'est aussi plus court et plus lisible. En entretien data, une boucle @@for@@ sur un tableau NumPy est un signal d'alerte.</p>`,
    quiz: [
      { q: R`Que donne @@np.array([1, 2, 3]) * np.array([4, 5, 6])@@ ?`, options: ["32 (produit scalaire)", "[4, 10, 18]", "Une erreur", "[[4, 5, 6], [8, 10, 12], [12, 15, 18]]"], answer: 1, explain: "* multiplie élément par élément. Le produit scalaire s'écrit a @ b ou np.dot(a, b)." }
    ],
    challenge: {
      prompt: R`<p>Écris @@normaliser(x)@@ qui ramène les valeurs d'un tableau entre 0 et 1 (normalisation <em>min-max</em>, une étape classique avant d'entraîner un modèle), <strong>sans boucle</strong> :</p><pre class="out">(x − min) / (max − min)
normaliser(np.array([10, 20, 30, 50]))  →  [0.   0.25 0.5  1.  ]</pre>`,
      starter: "import numpy as np\n\ndef normaliser(x):\n    resultat = []\n    for v in x:\n        resultat.append(v)\n    return resultat\n",
      solution: R`import numpy as np

def normaliser(x):
    return (x - x.min()) / (x.max() - x.min())`,
      tests: R`r = normaliser(np.array([10, 20, 30, 50]))
print(type(r).__name__, r.round(3).tolist())
print(normaliser(np.array([[2.0, 4.0], [6.0, 10.0]])).round(3).tolist())`,
      expected: "ndarray [0.0, 0.25, 0.5, 1.0]\n[[0.0, 0.25], [0.5, 1.0]]",
      hint: "x.min() et x.max() donnent des scalaires ; (x - x.min()) s'applique alors à tout le tableau, même en 2D."
    }
  },
  {
    id: "np-03", section: "NumPy", title: "Indexation et masques", xp: 45,
    theory: R`<p>On sélectionne des éléments par position, par tranche ou par <strong>masque booléen</strong>.</p>
~~~py
import numpy as np

m = np.array([[1, 2, 3],
              [4, 5, 6],
              [7, 8, 9]])
print(m[0, 2])        # ligne 0, colonne 2
print(m[:, 1])        # toute la colonne 1
print(m[1:, :2])      # sous-matrice

t = np.array([-2.0, 15.5, -0.5, 21.0])
print(t[t > 0])                 # masque booléen : seulement les positifs
print(np.where(t > 0, t, 0.0))  # remplace les négatifs par 0
print(t[[0, 3]])                # indexation par liste d'indices
~~~
<p><strong>Piège des vues.</strong> Une tranche (@@a[1:3]@@) est une <em>vue</em> sur les mêmes données : la modifier modifie le tableau d'origine. Un masque ou une liste d'indices renvoient une <em>copie</em>. En cas de doute, @@a.copy()@@.</p>
~~~py
import numpy as np
a = np.arange(5)
vue = a[1:3]
vue[:] = 99
print(a)   # [ 0 99 99  3  4] : l'original a changé
~~~`,
    quiz: [
      { q: R`Pour @@m = np.arange(12).reshape(3, 4)@@, que donne @@m[:, -1]@@ ?`, options: ["La dernière ligne", "La dernière colonne : [3, 7, 11]", "Le dernier élément : 11", "Une erreur"], answer: 1, explain: "« : » prend toutes les lignes, -1 la dernière colonne." },
      { q: R`@@b = a[a > 0]; b[0] = 100@@. Le tableau @@a@@ est-il modifié ?`, options: ["Oui, b est une vue", "Non, un masque booléen renvoie une copie", "Seulement si a est en 2D", "Erreur : on ne peut pas modifier b"], answer: 1, explain: "L'indexation booléenne copie toujours. Seules les tranches renvoient des vues." }
    ],
    challenge: {
      prompt: R`<p>Un capteur renvoie parfois des mesures négatives impossibles. Écris @@nettoyer(mesures)@@ qui renvoie un tuple :</p><ul><li>un <strong>nouveau</strong> tableau où les valeurs négatives sont remplacées par 0 ;</li><li>le nombre de valeurs corrigées.</li></ul><p>Le tableau d'origine ne doit <strong>pas</strong> être modifié.</p>`,
      starter: "import numpy as np\n\ndef nettoyer(mesures):\n    mesures[mesures < 0] = 0\n    return mesures, 0\n",
      solution: R`import numpy as np

def nettoyer(mesures):
    negatifs = mesures < 0
    propre = np.where(negatifs, 0.0, mesures)
    return propre, int(negatifs.sum())`,
      tests: R`m = np.array([3.5, -1.0, 2.0, -0.5])
propre, n = nettoyer(m)
print(propre.tolist(), n)
print(m.tolist())
print(nettoyer(np.array([1.0, 2.0]))[1])`,
      expected: "[3.5, 0.0, 2.0, 0.0] 2\n[3.5, -1.0, 2.0, -0.5]\n0",
      hint: "Le masque mesures < 0 sert deux fois : avec np.where pour construire la copie, et avec .sum() pour compter (True vaut 1)."
    }
  },
  {
    id: "np-04", section: "NumPy", title: "Broadcasting", xp: 45,
    theory: R`<p>Le <strong>broadcasting</strong> permet de combiner des tableaux de formes différentes : NumPy « étire » virtuellement le plus petit, sans le copier.</p>
~~~py
import numpy as np

notes = np.array([[12.0, 15.0, 9.0],
                  [14.0, 11.0, 16.0]])   # 2 élèves × 3 examens
bonus = np.array([1.0, 0.0, 2.0])        # un bonus par examen
print(notes + bonus)    # (2, 3) + (3,) → le bonus s'applique à chaque ligne

moyennes = notes.mean(axis=1, keepdims=True)  # (2, 1) : une moyenne par élève
print(notes - moyennes) # chaque élève centré sur sa propre moyenne
~~~
<p><strong>La règle</strong> : on compare les formes en partant de la droite. Deux dimensions sont compatibles si elles sont égales ou si l'une vaut 1. @@(2, 3)@@ et @@(3,)@@ : OK. @@(2, 3)@@ et @@(2,)@@ : erreur, il faut @@(2, 1)@@.</p>`,
    quiz: [
      { q: R`Quelles formes sont compatibles pour un broadcasting ?`, options: ["(4, 3) et (4,)", "(4, 3) et (3,)", "(4, 3) et (2, 3)", "(4, 3) et (3, 4)"], answer: 1, explain: "De droite à gauche : 3 = 3, puis la dimension manquante est étirée. (4,) contre 3 échoue." }
    ],
    challenge: {
      prompt: R`<p>Avant d'entraîner un modèle, on <strong>centre</strong> souvent chaque colonne (variable) : on lui soustrait sa moyenne. Écris @@centrer_colonnes(X)@@ <strong>sans boucle</strong>, en t'appuyant sur le broadcasting.</p>`,
      starter: "import numpy as np\n\ndef centrer_colonnes(X):\n    return X - X.mean()\n",
      solution: R`import numpy as np

def centrer_colonnes(X):
    return X - X.mean(axis=0)`,
      tests: R`X = np.array([[1.0, 2.0], [3.0, 6.0], [5.0, 10.0]])
C = centrer_colonnes(X)
print(C.tolist())
print(bool(np.allclose(C.mean(axis=0), 0)), C.shape)`,
      expected: "[[-2.0, -4.0], [0.0, 0.0], [2.0, 4.0]]\nTrue (3, 2)",
      hint: "X.mean() fait la moyenne de tout le tableau. Il faut une moyenne par colonne : axis=0, de forme (2,), qui se diffuse sur chaque ligne."
    }
  },
  {
    id: "np-05", section: "NumPy", title: "Agrégations et axes", xp: 45,
    theory: R`<p>Les agrégations (@@sum@@, @@mean@@, @@max@@, @@std@@, @@argmax@@…) réduisent un tableau. Le paramètre @@axis@@ dit <strong>quelle dimension disparaît</strong>.</p>
~~~py
import numpy as np

# ventes[magasin, mois]
ventes = np.array([[120, 90, 150],
                   [ 80, 60, 110]])
print(ventes.sum())          # tout : 610
print(ventes.sum(axis=0))    # on écrase les magasins → total par mois
print(ventes.sum(axis=1))    # on écrase les mois → total par magasin
print(ventes.argmax(axis=1)) # indice du meilleur mois de chaque magasin
print(np.cumsum([1, 2, 3, 4]))
~~~
<p>Moyen mnémotechnique : @@axis=0@@ agit « vers le bas », le long des lignes, et donne un résultat par colonne. @@axis=1@@ agit « vers la droite » et donne un résultat par ligne.</p>`,
    quiz: [
      { q: R`Pour un tableau de forme @@(100, 5)@@, quelle est la forme de @@x.mean(axis=0)@@ ?`, options: ["(100,)", "(5,)", "(100, 5)", "()"], answer: 1, explain: "axis=0 disparaît : il reste une moyenne par colonne, donc 5 valeurs." }
    ],
    challenge: {
      prompt: R`<p>@@ventes[magasin, mois]@@ contient les ventes de chaque magasin. Écris @@resume(ventes)@@ qui renvoie un tuple :</p><ul><li>la liste des totaux par magasin (@@list@@ d'entiers) ;</li><li>l'indice (@@int@@) du mois où le total, tous magasins confondus, est le plus élevé.</li></ul>`,
      starter: "import numpy as np\n\ndef resume(ventes):\n    return [], 0\n",
      solution: R`import numpy as np

def resume(ventes):
    totaux = ventes.sum(axis=1).tolist()
    meilleur = int(ventes.sum(axis=0).argmax())
    return totaux, meilleur`,
      tests: R`v = np.array([[120, 90, 150, 40], [80, 60, 110, 200], [10, 20, 30, 5]])
t, m = resume(v)
print(t, m, type(m).__name__)
print(resume(np.array([[5, 1], [4, 9]])))`,
      expected: "[400, 450, 65] 2 int\n([6, 13], 1)",
      hint: "Totaux par magasin : on écrase les mois (axis=1). Meilleur mois : on écrase les magasins (axis=0), puis argmax. int() convertit le scalaire NumPy."
    }
  },
  {
    id: "np-06", section: "NumPy", title: "Algèbre linéaire", xp: 55,
    theory: R`<p>Le machine learning repose sur l'algèbre linéaire : un jeu de données est une matrice @@X@@ (une ligne par exemple, une colonne par variable), et un modèle linéaire est un produit @@X @ w@@.</p>
~~~py
import numpy as np

A = np.array([[2.0, 1.0],
              [1.0, -1.0]])
v = np.array([1.0, 3.0])
print(A @ v)                  # produit matrice × vecteur
print(A.T)                    # transposée
print(np.linalg.inv(A) @ A)   # identité (aux arrondis près)
print(np.linalg.norm(v))      # longueur du vecteur

# Résoudre le système 2x + y = 5 et x − y = 1
print(np.linalg.solve(A, np.array([5.0, 1.0])))   # [2. 1.]
~~~
<p>Pour résoudre @@A x = b@@, préfère @@np.linalg.solve@@ à @@inv(A) @ b@@ : c'est plus rapide et numériquement plus stable.</p>`,
    quiz: [
      { q: R`@@X@@ est de forme @@(50, 3)@@ et @@w@@ de forme @@(3,)@@. Quelle est la forme de @@X @ w@@ ?`, options: ["(3,)", "(50,)", "(50, 3)", "Erreur de dimensions"], answer: 1, explain: "(50, 3) @ (3,) : les 3 se « consomment », il reste une prédiction par ligne, soit 50 valeurs." }
    ],
    challenge: {
      prompt: R`<p><strong>Niveau entretien ML.</strong> Implémente la régression linéaire par les <em>équations normales</em> : avec @@X@@ augmentée d'une colonne de 1 (pour l'ordonnée à l'origine), les coefficients valent la solution de @@(XᵀX) w = Xᵀy@@.</p><p>Écris @@regression(x, y)@@ qui renvoie @@[b, a]@@ pour le modèle @@y ≈ a·x + b@@, sous forme de tableau NumPy.</p>`,
      starter: "import numpy as np\n\ndef regression(x, y):\n    a = (y[-1] - y[0]) / (x[-1] - x[0])\n    return np.array([y[0], a])\n",
      solution: R`import numpy as np

def regression(x, y):
    X = np.column_stack([np.ones(len(x)), x])
    return np.linalg.solve(X.T @ X, X.T @ y)`,
      tests: R`x = np.array([0.0, 1.0, 2.0, 3.0])
print(regression(x, 1 + 2 * x).round(6).tolist())
x2 = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
y2 = np.array([2.1, 3.9, 6.2, 7.8, 10.1])
print(regression(x2, y2).round(3).tolist())`,
      expected: "[1.0, 2.0]\n[0.05, 1.99]",
      hint: "np.column_stack([np.ones(len(x)), x]) construit la matrice augmentée. Ensuite np.linalg.solve(X.T @ X, X.T @ y)."
    }
  },
  {
    id: "np-07", section: "NumPy", title: "Aléatoire reproductible", xp: 45,
    theory: R`<p>Simulations, échantillonnage, initialisation des poids d'un réseau de neurones : tout part du hasard. Pour que tes résultats soient <strong>reproductibles</strong> (indispensable pour déboguer et pour la science), on fixe une <strong>graine</strong>.</p>
~~~py
import numpy as np

rng = np.random.default_rng(seed=42)  # générateur moderne : la bonne pratique
print(rng.integers(1, 7, size=5))     # 5 lancers de dé (7 exclu)
print(rng.normal(loc=0, scale=1, size=3).round(3))
print(rng.choice(["pile", "face"], size=4))

# Même graine → mêmes tirages
a = np.random.default_rng(7).random(3)
b = np.random.default_rng(7).random(3)
print(np.array_equal(a, b))
~~~
<p>Évite l'ancienne API globale @@np.random.seed(…)@@ : un générateur @@rng@@ passé en paramètre rend le code testable et sans effet de bord.</p>`,
    quiz: [
      { q: R`Quelles valeurs peut produire @@rng.integers(1, 7)@@ ?`, options: ["1 à 7", "1 à 6", "0 à 6", "0 à 7"], answer: 1, explain: "La borne haute est exclue, comme dans range : 1, 2, 3, 4, 5 ou 6." }
    ],
    challenge: {
      prompt: R`<p>Écris @@lancers(n, seed)@@ qui simule @@n@@ lancers d'un dé à 6 faces avec un générateur initialisé par @@seed@@, et renvoie un tableau de 6 entiers : le nombre de 1, de 2, …, de 6. Même graine, même résultat.</p>`,
      starter: "import numpy as np\n\ndef lancers(n, seed):\n    rng = np.random.default_rng(seed)\n    return rng.integers(1, 7, size=n)\n",
      solution: R`import numpy as np

def lancers(n, seed):
    rng = np.random.default_rng(seed)
    faces = rng.integers(1, 7, size=n)
    return np.bincount(faces, minlength=7)[1:]`,
      tests: R`c = lancers(6000, 42)
print(c.shape, int(c.sum()), bool(((c > 850) & (c < 1150)).all()))
print(np.array_equal(lancers(100, 7), lancers(100, 7)), np.array_equal(lancers(1000, 1), lancers(1000, 2)))`,
      expected: "(6,) 6000 True\nTrue False",
      hint: "np.bincount compte les occurrences de 0, 1, 2… ; avec minlength=7 puis [1:], tu gardes les faces 1 à 6."
    }
  },
  {
    id: "np-08", section: "NumPy", title: "Défi entretien : moyenne mobile", xp: 70,
    theory: R`<p>La <strong>moyenne mobile</strong> lisse une série (cours de bourse, capteur, trafic web). Version naïve : pour chaque position, on fait la moyenne des @@k@@ valeurs suivantes, soit O(n·k). Version attendue en entretien : O(n) grâce à la <strong>somme cumulée</strong>.</p>
~~~py
import numpy as np

x = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
c = np.cumsum(x)                 # [ 1.  3.  6. 10. 15.]
# somme de x[i:i+k] = c[i+k-1] - c[i-1]
c = np.concatenate([[0.0], c])   # on ajoute un 0 devant pour gérer i = 0
k = 2
print((c[k:] - c[:-k]) / k)
~~~
<p>L'astuce des sommes préfixes (prefix sums) revient dans de nombreux problèmes LeetCode : somme d'un sous-tableau, nombre de sous-tableaux de somme k, etc.</p>`,
    quiz: [
      { q: "Pour une série de longueur n et une fenêtre k, combien de valeurs contient la moyenne mobile « valide » (sans bords) ?", options: ["n", "n − k", "n − k + 1", "k"], answer: 2, explain: "Les fenêtres commencent aux positions 0 à n − k, soit n − k + 1 fenêtres." }
    ],
    challenge: {
      prompt: R`<p>Écris @@moyenne_mobile(x, k)@@ en <strong>O(n)</strong> (pas de boucle sur les fenêtres) qui renvoie le tableau des moyennes de chaque fenêtre de @@k@@ valeurs consécutives.</p><pre class="out">moyenne_mobile(np.array([1, 2, 3, 4, 5]), 3)  →  [2. 3. 4.]</pre>`,
      starter: "import numpy as np\n\ndef moyenne_mobile(x, k):\n    return x / k\n",
      solution: R`import numpy as np

def moyenne_mobile(x, k):
    c = np.concatenate([[0.0], np.cumsum(x, dtype=float)])
    return (c[k:] - c[:-k]) / k`,
      tests: R`print(moyenne_mobile(np.array([1, 2, 3, 4, 5]), 3).tolist())
print(moyenne_mobile(np.array([1, 2, 3, 4, 5]), 2).tolist())
print(moyenne_mobile(np.array([4.0, 8.0]), 2).tolist(), len(moyenne_mobile(np.arange(100), 10)))`,
      expected: "[2.0, 3.0, 4.0]\n[1.5, 2.5, 3.5, 4.5]\n[6.0] 91",
      hint: "Ajoute un 0 devant la somme cumulée, puis (c[k:] - c[:-k]) / k donne toutes les fenêtres d'un coup."
    }
  }
  ]
};
