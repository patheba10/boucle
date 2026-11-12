/* Cours Deep learning — chapitre 1 : le neurone, les activations, la perte, la descente de gradient, la rétropropagation.
   Tout est écrit avec NumPy, qui tourne dans le navigateur : on comprend ce que TensorFlow fera ensuite à notre place. */
const PY = String.raw;

const LAB = `<p><strong>Sur ta machine</strong> : @@pip install numpy matplotlib@@, puis refais chaque exercice dans un notebook Jupyter en traçant les courbes (perte au fil des époques, frontière de décision). Le livre gratuit <em>Neural Networks and Deep Learning</em> de Michael Nielsen et la série vidéo de 3Blue1Brown sur les réseaux de neurones accompagnent bien ce chapitre.</p>`;

export default [
  {
    id: "dl-01", section: "Le neurone", title: "Un neurone : somme pondérée et activation", xp: 80,
    theory: `<p>Un <strong>neurone artificiel</strong> reçoit des entrées @@x₁ … xₙ@@, les multiplie par des <strong>poids</strong> @@w₁ … wₙ@@, ajoute un <strong>biais</strong> @@b@@, puis passe le résultat dans une <strong>fonction d'activation</strong> :</p>
~~~text
z = w₁·x₁ + w₂·x₂ + … + wₙ·xₙ + b        (produit scalaire w·x, plus b)
a = activation(z)
~~~
<p>Les poids disent l'importance de chaque entrée, le biais déplace le seuil. Avec NumPy, @@np.dot(w, x)@@ (ou @@w @ x@@) calcule la somme pondérée d'un coup, et sur une matrice @@X@@ de plusieurs exemples, @@X @ w + b@@ donne tous les @@z@@ en une seule opération : c'est ce calcul vectorisé que les GPU accélèrent.</p>
~~~py
import numpy as np

w = np.array([0.8, -0.5])     # poids : surface, distance au centre
b = -0.1
X = np.array([[1.2, 0.5],     # trois logements (valeurs normalisées)
              [0.3, 1.8],
              [0.9, 0.9]])
z = X @ w + b
print(z.round(3))
print((z > 0).astype(int))    # un perceptron : 1 si z > 0, sinon 0
~~~
<p>Le <strong>perceptron</strong> (Rosenblatt, 1958) utilise une marche : 0 ou 1. Il sépare l'espace par une droite (un hyperplan), donc il ne résout que les problèmes <em>linéairement séparables</em> : il apprend ET et OU, pas OU exclusif (XOR). Il faudra des couches cachées et des activations dérivables pour aller plus loin, et c'est le sujet de ce chapitre.</p>`,
    setup: LAB,
    quiz: [
      { q: "À quoi sert le biais b ?", options: ["À accélérer le calcul", "À déplacer le seuil de décision : sans lui, la frontière passe forcément par l'origine", "À normaliser les entrées", "À éviter le surapprentissage"], answer: 1, explain: "Un neurone sans biais ne peut pas répondre 1 quand toutes les entrées valent 0." },
      { q: "Pourquoi un perceptron seul ne peut-il pas apprendre XOR ?", options: ["Il manque de données", "XOR n'est pas linéairement séparable : aucune droite ne sépare ses deux classes", "Le taux d'apprentissage est trop petit", "Il faudrait plus d'époques"], answer: 1, explain: "Il faut au moins une couche cachée, ce qu'on fera plus loin." }
    ],
    challenge: {
      prompt: `<p>Écris @@perceptron(X, w, b)@@ qui renvoie, pour chaque ligne de @@X@@, @@1@@ si @@w·x + b > 0@@ et @@0@@ sinon, sous forme de tableau NumPy d'entiers. Sans boucle : un seul calcul matriciel.</p><p>Puis trouve des poids et un biais (@@W_ET@@, @@B_ET@@) pour lesquels le perceptron calcule le ET logique de deux entrées 0 ou 1.</p>`,
      starter: PY`import numpy as np


def perceptron(X, w, b):
    sorties = []
    for x in X:
        sorties.append(1 if x[0] * w[0] > 0 else 0)
    return sorties


W_ET = np.array([1.0, 1.0])
B_ET = 0.0
`,
      solution: PY`import numpy as np


def perceptron(X, w, b):
    return (X @ w + b > 0).astype(int)


W_ET = np.array([1.0, 1.0])
B_ET = -1.5
`,
      tests: PY`X = np.array([[0, 0], [0, 1], [1, 0], [1, 1]])
r = perceptron(X, W_ET, B_ET)
print(type(r).__name__, r.dtype.kind, r.tolist())
print(perceptron(np.array([[2.0, -1.0, 0.5], [0.1, 0.1, 0.1]]), np.array([1.0, 2.0, -2.0]), 0.2).tolist())
`,
      expected: "ndarray i [0, 0, 0, 1]\n[0, 1]\n",
      hint: "(X @ w + b > 0) donne un tableau de booléens ; .astype(int) le convertit en 0 et 1. Pour ET : poids 1 et 1, et un biais entre -2 et -1, par exemple -1.5."
    }
  },
  {
    id: "dl-02", section: "Le neurone", title: "Fonctions d'activation", xp: 90,
    theory: `<p>L'activation introduit la <strong>non-linéarité</strong> : sans elle, empiler des couches revient à une seule multiplication matricielle, et le réseau reste linéaire. Les plus utilisées :</p>
~~~py
import numpy as np

z = np.array([-3.0, -1.0, 0.0, 1.0, 3.0])
sigmoide = 1 / (1 + np.exp(-z))          # entre 0 et 1 : une probabilité
tanh = np.tanh(z)                         # entre -1 et 1, centrée
relu = np.maximum(0, z)                   # 0 pour z négatif, z sinon
print(sigmoide.round(3))
print(tanh.round(3))
print(relu)
~~~
<ul><li>@@sigmoïde@@ : sortie d'un classifieur binaire ; mais sa dérivée tend vers 0 pour les grands @@|z|@@ (le gradient « s'évanouit »), ce qui freine l'apprentissage des réseaux profonds ;</li><li>@@ReLU@@ : le choix par défaut des couches cachées ; simple, rapide, gradient 1 pour @@z > 0@@ ; ses neurones peuvent « mourir » (toujours 0), d'où des variantes comme Leaky ReLU ;</li><li>@@softmax@@ : transforme un vecteur de scores en probabilités qui somment à 1, pour la sortie d'un classifieur à plusieurs classes.</li></ul>
<p>Le piège de softmax : @@np.exp(1000)@@ dépasse la capacité d'un nombre flottant (@@inf@@). Comme softmax ne change pas si l'on retire la même constante à tous les scores, on retire le maximum avant l'exponentielle : c'est la version <strong>numériquement stable</strong> qu'utilisent toutes les bibliothèques.</p>
~~~py
import numpy as np

scores = np.array([2.0, 1.0, 0.1])
e = np.exp(scores - scores.max())
p = e / e.sum()
print(p.round(3), p.sum().round(6))
~~~`,
    setup: LAB,
    quiz: [
      { q: "Pourquoi ReLU est-elle préférée à la sigmoïde dans les couches cachées ?", options: ["Elle donne des probabilités", "Son gradient ne s'évanouit pas pour z > 0 et elle est très rapide à calculer", "Elle est bornée entre 0 et 1", "Elle est dérivable partout"], answer: 1, explain: "La sigmoïde sature : pour |z| grand, sa dérivée est presque nulle et l'apprentissage stagne." },
      { q: "Pourquoi retirer le maximum des scores avant softmax ?", options: ["Pour changer le résultat", "Pour éviter le dépassement de exp() sur de grands scores ; le résultat est mathématiquement identique", "Pour normaliser les poids", "Pour accélérer le calcul"], answer: 1, explain: "exp(a - m) / Σ exp(b - m) = exp(a) / Σ exp(b)." }
    ],
    challenge: {
      prompt: `<p>Écris trois fonctions vectorisées (elles reçoivent et renvoient des tableaux NumPy) :</p><ul><li>@@relu(z)@@ ;</li><li>@@sigmoide(z)@@ ;</li><li>@@softmax(z)@@ pour une matrice dont <strong>chaque ligne</strong> est un vecteur de scores : chaque ligne du résultat somme à 1. Elle doit rester juste pour des scores très grands (1000 et plus).</li></ul>`,
      starter: PY`import numpy as np


def relu(z):
    return z


def sigmoide(z):
    return 1 / (1 + np.exp(-z))


def softmax(z):
    e = np.exp(z)
    return e / e.sum()
`,
      solution: PY`import numpy as np


def relu(z):
    return np.maximum(0, z)


def sigmoide(z):
    return 1 / (1 + np.exp(-z))


def softmax(z):
    e = np.exp(z - z.max(axis=1, keepdims=True))
    return e / e.sum(axis=1, keepdims=True)
`,
      tests: PY`z = np.array([-2.0, 0.0, 3.5])
print(relu(z).tolist(), sigmoide(z).round(4).tolist())
S = np.array([[1.0, 2.0, 3.0], [1000.0, 1000.0, 1001.0], [0.0, 0.0, 0.0]])
p = softmax(S)
print(p.round(4).tolist())
print(p.sum(axis=1).round(6).tolist(), bool(np.isfinite(p).all()))
`,
      expected: "[0.0, 0.0, 3.5] [0.1192, 0.5, 0.9707]\n[[0.09, 0.2447, 0.6652], [0.2119, 0.2119, 0.5761], [0.3333, 0.3333, 0.3333]]\n[1.0, 1.0, 1.0] True\n",
      hint: "relu : np.maximum(0, z). softmax ligne par ligne : z.max(axis=1, keepdims=True) et e.sum(axis=1, keepdims=True) ; keepdims garde une colonne pour que la soustraction et la division se fassent ligne par ligne."
    }
  },
  {
    id: "dl-03", section: "Le neurone", title: "Mesurer l'erreur : fonctions de perte", xp: 90,
    theory: `<p>Pour apprendre, le réseau a besoin d'un chiffre qui dit à quel point il se trompe : la <strong>perte</strong> (loss). L'entraînement consiste à la faire baisser.</p>
<ul><li><strong>Erreur quadratique moyenne</strong> (MSE), pour la régression : la moyenne des carrés des écarts. Elle punit fortement les grosses erreurs ;</li><li><strong>entropie croisée binaire</strong>, pour une classification oui/non avec une sortie sigmoïde @@p@@ : @@-[y·log(p) + (1-y)·log(1-p)]@@ ;</li><li><strong>entropie croisée catégorielle</strong>, pour plusieurs classes avec une sortie softmax : @@-log@@ de la probabilité donnée à la bonne classe.</li></ul>
~~~py
import numpy as np

y = np.array([1, 0, 1, 1])
p = np.array([0.9, 0.2, 0.6, 0.99])
bce = -np.mean(y * np.log(p) + (1 - y) * np.log(1 - p))
print(round(bce, 4))

prix_reels = np.array([310_000, 455_000, 280_000])
prix_predits = np.array([300_000, 470_000, 300_000])
print(np.mean((prix_reels - prix_predits) ** 2) ** 0.5)   # RMSE, dans l'unité de la cible
~~~
<p>L'entropie croisée punit très fort une erreur <em>sûre d'elle</em> : prédire 0,01 quand la réponse est 1 coûte @@-log(0,01) ≈ 4,6@@, alors que prédire 0,4 coûte 0,9. Et @@log(0)@@ vaut @@-inf@@ : on borne donc les probabilités dans @@[ε, 1-ε]@@ avec @@np.clip@@ avant le logarithme, exactement comme le fait Keras.</p>`,
    setup: LAB,
    quiz: [
      { q: "Quelle perte pour prédire le prix d'un logement ?", options: ["Entropie croisée binaire", "Une perte de régression comme la MSE (ou MAE si l'on veut moins punir les valeurs extrêmes)", "Softmax", "Exactitude"], answer: 1, explain: "L'entropie croisée sert aux probabilités de classes." },
      { q: "Pourquoi l'exactitude (accuracy) n'est-elle pas utilisée comme perte ?", options: ["Elle est trop lente", "Elle ne varie pas de façon continue : une petite modification des poids ne la change souvent pas, donc pas de gradient utile", "Elle est toujours de 100 %", "Elle n'existe pas dans Keras"], answer: 1, explain: "On optimise une perte dérivable et on surveille l'exactitude à côté." }
    ],
    challenge: {
      prompt: `<p>Écris @@entropie_croisee(Y, P, eps=1e-7)@@ pour une classification à plusieurs classes :</p><ul><li>@@Y@@ : matrice des bonnes réponses en <em>one-hot</em> (un 1 par ligne, à la bonne classe) ;</li><li>@@P@@ : probabilités prédites (sorties softmax), même forme ;</li><li>renvoie la <strong>moyenne sur les exemples</strong> de @@-Σ y·log(p)@@, en bornant @@P@@ dans @@[eps, 1-eps]@@ pour éviter @@log(0)@@.</li></ul>`,
      starter: PY`import numpy as np


def entropie_croisee(Y, P, eps=1e-7):
    return -np.sum(Y * np.log(P))
`,
      solution: PY`import numpy as np


def entropie_croisee(Y, P, eps=1e-7):
    P = np.clip(P, eps, 1 - eps)
    return float(-np.mean(np.sum(Y * np.log(P), axis=1)))
`,
      tests: PY`Y = np.array([[0, 1, 0], [1, 0, 0]])
print(round(entropie_croisee(Y, np.array([[0.1, 0.8, 0.1], [0.7, 0.2, 0.1]])), 4))
print(round(entropie_croisee(Y, np.array([[0.0, 1.0, 0.0], [1.0, 0.0, 0.0]])), 4))
print(round(entropie_croisee(Y, np.array([[1.0, 0.0, 0.0], [0.0, 1.0, 0.0]])), 4))
`,
      expected: "0.2899\n0.0\n16.1181\n",
      hint: "P = np.clip(P, eps, 1 - eps), puis -np.mean(np.sum(Y * np.log(P), axis=1)) : la somme sur les classes (axis=1), puis la moyenne sur les exemples."
    }
  },
  {
    id: "dl-04", section: "Apprendre", title: "La descente de gradient", xp: 110,
    theory: `<p>Le <strong>gradient</strong> de la perte indique, pour chaque poids, dans quelle direction la perte augmente. La <strong>descente de gradient</strong> fait un petit pas dans la direction opposée, encore et encore :</p>
~~~text
w ← w − η · ∂perte/∂w          η : le taux d'apprentissage (learning rate)
~~~
<p>Sur une régression linéaire @@ŷ = w·x + b@@ avec la MSE, les dérivées se calculent à la main : @@∂L/∂w = 2·moyenne((ŷ − y)·x)@@ et @@∂L/∂b = 2·moyenne(ŷ − y)@@. Une passe sur toutes les données s'appelle une <strong>époque</strong>.</p>
~~~py
import numpy as np

x = np.array([1.0, 2.0, 3.0, 4.0])
y = np.array([3.1, 4.9, 7.2, 8.8])        # environ 2x + 1
w, b, lr = 0.0, 0.0, 0.05
for epoque in range(300):
    erreur = (w * x + b) - y
    w -= lr * 2 * np.mean(erreur * x)
    b -= lr * 2 * np.mean(erreur)
    if epoque % 100 == 0:
        print(epoque, round(np.mean(erreur ** 2), 4))
print("w =", round(w, 3), " b =", round(b, 3))
~~~
<p>Le <strong>taux d'apprentissage</strong> est le réglage le plus important : trop petit, l'apprentissage est interminable ; trop grand, la perte oscille ou explose. En pratique, on ne calcule pas le gradient sur toutes les données à chaque pas mais sur un <strong>mini-lot</strong> (32 à 256 exemples) : c'est la descente de gradient <strong>stochastique</strong> (SGD), plus rapide et qui aide à sortir des mauvais minimums. Les optimiseurs modernes (Momentum, RMSprop, <strong>Adam</strong>) adaptent le pas automatiquement.</p>`,
    setup: LAB,
    quiz: [
      { q: "La perte augmente et devient nan après quelques époques. Que faire en premier ?", options: ["Augmenter le taux d'apprentissage", "Diminuer le taux d'apprentissage (et vérifier la normalisation des entrées)", "Ajouter des couches", "Entraîner plus longtemps"], answer: 1, explain: "Des pas trop grands sautent par-dessus le minimum et divergent." },
      { q: "Qu'est-ce qu'une époque ?", options: ["Un pas de gradient", "Un passage complet sur l'ensemble d'entraînement", "Une couche", "Un mini-lot"], answer: 1, explain: "Avec 1 000 exemples et des mini-lots de 100, une époque compte 10 pas." }
    ],
    challenge: {
      prompt: `<p>Écris @@entrainer(x, y, lr, epoques)@@ qui ajuste @@ŷ = w·x + b@@ par descente de gradient sur la MSE (en partant de @@w = 0@@ et @@b = 0@@, une mise à jour par époque sur toutes les données) et renvoie @@(w, b, historique)@@, où @@historique@@ est la liste des pertes MSE calculées <strong>avant</strong> chaque mise à jour.</p>`,
      starter: PY`import numpy as np


def entrainer(x, y, lr, epoques):
    w, b = 0.0, 0.0
    historique = []
    for _ in range(epoques):
        erreur = (w * x + b) - y
        historique.append(float(np.mean(erreur ** 2)))
        w += lr * np.mean(erreur * x)
    return w, b, historique
`,
      solution: PY`import numpy as np


def entrainer(x, y, lr, epoques):
    w, b = 0.0, 0.0
    historique = []
    for _ in range(epoques):
        erreur = (w * x + b) - y
        historique.append(float(np.mean(erreur ** 2)))
        w -= lr * 2 * np.mean(erreur * x)
        b -= lr * 2 * np.mean(erreur)
    return w, b, historique
`,
      tests: PY`x = np.linspace(0, 1, 20)
y = 3 * x - 0.5
w, b, h = entrainer(x, y, 0.5, 400)
print(round(w, 3), round(b, 3), len(h))
print(round(h[0], 4), round(h[1], 4), h[-1] < 1e-6)
w, b, h = entrainer(x, y, 3.0, 30)
print("diverge :", h[-1] > h[0])
`,
      expected: "3.0 -0.5 400\n1.8289 0.6061 True\ndiverge : True\n",
      hint: "Deux corrections : on soustrait le gradient (w -= …) et le gradient de la MSE vaut 2·moyenne(erreur·x) pour w et 2·moyenne(erreur) pour b ; il faut aussi mettre b à jour."
    }
  },
  {
    id: "dl-05", section: "Apprendre", title: "La rétropropagation", xp: 120,
    theory: `<p>Dans un réseau à plusieurs couches, chaque poids influence la perte à travers toutes les couches suivantes. La <strong>rétropropagation</strong> applique la règle de dérivation en chaîne de la sortie vers l'entrée : on calcule l'erreur de la dernière couche, puis on la « renvoie » couche par couche en la multipliant par les poids et par la dérivée des activations.</p>
<p>Pour une couche dense @@Z = X·W + b@@ suivie d'une activation @@A = f(Z)@@, si l'on connaît @@dA = ∂L/∂A@@ :</p>
~~~text
dZ = dA ⊙ f'(Z)               ⊙ : produit élément par élément
dW = Xᵀ · dZ / m              m : nombre d'exemples du lot
db = moyenne de dZ sur les exemples
dX = dZ · Wᵀ                  l'erreur transmise à la couche précédente
~~~
<p>Bonne nouvelle : avec une sortie sigmoïde et l'entropie croisée binaire (ou softmax et l'entropie croisée catégorielle), la dérivée de la perte par rapport à @@Z@@ de la sortie se simplifie en @@P − Y@@.</p>
<p>Pour vérifier un gradient écrit à la main, on le compare à une <strong>dérivée numérique</strong> : @@(L(w + h) − L(w − h)) / 2h@@ avec @@h@@ très petit. Si les deux diffèrent, le calcul analytique est faux. Les frameworks (TensorFlow, PyTorch) font cette dérivation automatiquement (<em>autodiff</em>) ; l'écrire une fois à la main est ce qui permet de comprendre l'évanouissement du gradient, l'initialisation des poids ou la normalisation par lots.</p>
~~~py
import numpy as np

def perte(w):
    return (np.tanh(2 * w) - 0.5) ** 2

w, h = 0.3, 1e-5
analytique = 2 * (np.tanh(2 * w) - 0.5) * (1 - np.tanh(2 * w) ** 2) * 2
numerique = (perte(w + h) - perte(w - h)) / (2 * h)
print(round(analytique, 6), round(numerique, 6))
~~~`,
    setup: LAB,
    quiz: [
      { q: "Pourquoi le gradient peut-il « s'évanouir » dans un réseau profond à activations sigmoïdes ?", options: ["À cause des biais", "La rétropropagation multiplie de nombreuses dérivées inférieures à 0,25 : le produit devient minuscule dans les premières couches", "Parce que la perte est trop grande", "À cause du taux d'apprentissage"], answer: 1, explain: "ReLU, une bonne initialisation (He, Glorot), la normalisation et les connexions résiduelles corrigent ce problème." },
      { q: "À quoi sert la vérification numérique du gradient ?", options: ["À entraîner plus vite", "À détecter une erreur dans un gradient calculé à la main, en le comparant à une différence finie", "À remplacer la rétropropagation", "À régler le taux d'apprentissage"], answer: 1, explain: "Trop lente pour entraîner, parfaite pour déboguer." }
    ],
    challenge: {
      prompt: `<p>Écris @@retropropager(X, W, b, dA)@@ pour une couche dense à activation ReLU (@@Z = X @ W + b@@, @@A = relu(Z)@@). Elle reçoit @@dA@@ et renvoie @@(dW, db, dX)@@ selon les formules de la théorie (la dérivée de ReLU vaut 1 si @@Z > 0@@, 0 sinon ; @@m@@ est le nombre de lignes de @@X@@).</p><p>Le test compare ton @@dW@@ à une dérivée numérique.</p>`,
      starter: PY`import numpy as np


def retropropager(X, W, b, dA):
    Z = X @ W + b
    dZ = dA
    dW = X.T @ dZ
    db = dZ.sum(axis=0)
    dX = dZ @ W
    return dW, db, dX
`,
      solution: PY`import numpy as np


def retropropager(X, W, b, dA):
    m = X.shape[0]
    Z = X @ W + b
    dZ = dA * (Z > 0)
    dW = X.T @ dZ / m
    db = dZ.mean(axis=0)
    dX = dZ @ W.T
    return dW, db, dX
`,
      tests: PY`rng = np.random.default_rng(0)
X = rng.normal(size=(5, 3)); W = rng.normal(size=(3, 2)); b = rng.normal(size=2); cible = rng.normal(size=(5, 2))
def perte(W):
    A = np.maximum(0, X @ W + b)
    return np.sum((A - cible) ** 2) / (2 * X.shape[0])
A = np.maximum(0, X @ W + b)
dW, db, dX = retropropager(X, W, b, A - cible)
num = np.zeros_like(W)
for i in range(3):
    for j in range(2):
        E = np.zeros_like(W); E[i, j] = 1e-6
        num[i, j] = (perte(W + E) - perte(W - E)) / 2e-6 * X.shape[0]
print(dW.shape, db.shape, dX.shape)
print("dW correct :", bool(np.allclose(dW * X.shape[0], num, atol=1e-4)))
print(np.round(db, 4).tolist())
`,
      expected: "(3, 2) (2,) (5, 3)\ndW correct : True\n[1.5472, 0.1659]\n",
      hint: "Trois oublis : dZ = dA * (Z > 0) (dérivée de ReLU), la division par m pour dW et db (db = dZ.mean(axis=0)), et dX = dZ @ W.T (W transposée)."
    }
  }
];
