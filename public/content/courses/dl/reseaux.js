/* Cours Deep learning — chapitre 2 : un réseau complet à la main (XOR), classer des chiffres par mini-lots,
   surapprentissage et régularisation ; entretien. */
const PY = String.raw;

const LAB = `<p><strong>Sur ta machine</strong> : refais l'exercice dans un notebook et trace la perte d'entraînement et de validation à chaque époque avec matplotlib. Fais varier le taux d'apprentissage (0,01 ; 0,1 ; 1), la taille de la couche cachée et la taille des mini-lots, et note l'effet sur la vitesse et la qualité : c'est exactement le travail de réglage qu'on fera ensuite avec Keras.</p>`;

const RESEAU_BASE = PY`import numpy as np


def sigmoide(z):
    return 1 / (1 + np.exp(-z))


def initialiser(n_entree, n_cache, n_sortie, graine=0):
    rng = np.random.default_rng(graine)
    return {
        "W1": rng.normal(0, 1, (n_entree, n_cache)), "b1": np.zeros(n_cache),
        "W2": rng.normal(0, 1, (n_cache, n_sortie)), "b2": np.zeros(n_sortie),
    }
`;

export default [
  {
    id: "dl-06", section: "Réseaux", title: "Un réseau qui apprend XOR", xp: 130,
    theory: `<p>Un <strong>perceptron multicouche</strong> empile des couches denses : l'entrée, une ou plusieurs <strong>couches cachées</strong>, la sortie. La couche cachée transforme l'espace des données pour rendre le problème séparable : avec deux neurones cachés, XOR devient possible.</p>
<p>Une itération d'entraînement compte toujours quatre temps :</p>
<ol><li><strong>propagation avant</strong> : calculer les activations couche par couche jusqu'à la prédiction ;</li><li><strong>perte</strong> : comparer la prédiction à la réponse ;</li><li><strong>rétropropagation</strong> : calculer le gradient de chaque poids ;</li><li><strong>mise à jour</strong> : un pas de descente de gradient.</li></ol>
~~~py
import numpy as np

# propagation avant d'un réseau 2 → 3 → 1 sur les quatre cas de XOR, poids au hasard
rng = np.random.default_rng(1)
X = np.array([[0, 0], [0, 1], [1, 0], [1, 1]])
W1, b1 = rng.normal(size=(2, 3)), np.zeros(3)
W2, b2 = rng.normal(size=(3, 1)), np.zeros(1)
A1 = np.tanh(X @ W1 + b1)
P = 1 / (1 + np.exp(-(A1 @ W2 + b2)))
print(P.ravel().round(3))     # avant entraînement : des réponses au hasard
~~~
<p>L'<strong>initialisation</strong> compte : des poids tous nuls donnent des neurones identiques qui apprennent la même chose (symétrie) ; des poids trop grands saturent les activations. On tire donc les poids au hasard, avec une échelle adaptée au nombre d'entrées (initialisations de Glorot ou de He). Fixer la <strong>graine</strong> du générateur rend l'expérience reproductible. Et le hasard compte : avec la graine 0, ce même réseau reste bloqué dans un minimum local et se trompe sur deux cas sur quatre, alors que la graine 1 converge. C'est pour cela qu'on relance un entraînement avec plusieurs graines avant de conclure qu'une architecture ne marche pas.</p>`,
    setup: LAB,
    quiz: [
      { q: "Pourquoi ne pas initialiser tous les poids à zéro ?", options: ["Le calcul serait plus lent", "Tous les neurones d'une couche recevraient le même gradient et resteraient identiques : la couche ne vaudrait qu'un seul neurone", "Les biais seraient faux", "La perte serait infinie"], answer: 1, explain: "L'aléatoire brise la symétrie." },
      { q: "Quel est l'ordre d'une itération d'entraînement ?", options: ["Mise à jour, perte, propagation", "Propagation avant, perte, rétropropagation, mise à jour", "Rétropropagation puis propagation", "Perte puis initialisation"], answer: 1, explain: "C'est la boucle que Keras exécute dans fit()." }
    ],
    challenge: {
      prompt: `<p>Les fonctions @@sigmoide@@ et @@initialiser@@ sont fournies. Complète @@entrainer_xor(lr, epoques)@@ : un réseau 2 → 4 → 1, activation @@tanh@@ en couche cachée, sigmoïde en sortie, entropie croisée binaire, descente de gradient sur les quatre exemples à chaque époque. Elle renvoie les paramètres et l'historique des pertes.</p><p>Rappels : en sortie @@dZ2 = (P − Y) / m@@ ; la dérivée de @@tanh@@ en @@Z1@@ vaut @@1 − A1²@@.</p>`,
      starter: RESEAU_BASE + PY`

X = np.array([[0, 0], [0, 1], [1, 0], [1, 1]], dtype=float)
Y = np.array([[0], [1], [1], [0]], dtype=float)


def entrainer_xor(lr=1.0, epoques=2000):
    p = initialiser(2, 4, 1, graine=1)
    pertes = []
    m = X.shape[0]
    for _ in range(epoques):
        A1 = np.tanh(X @ p["W1"] + p["b1"])
        P = sigmoide(A1 @ p["W2"] + p["b2"])
        pertes.append(float(-np.mean(Y * np.log(P) + (1 - Y) * np.log(1 - P))))
        dZ2 = (P - Y) / m
        p["W2"] -= lr * (A1.T @ dZ2)
        p["b2"] -= lr * dZ2.sum(axis=0)
        # TODO : rétropropager jusqu'à la couche cachée et mettre W1, b1 à jour
    return p, pertes


def predire(p, X):
    return (sigmoide(np.tanh(X @ p["W1"] + p["b1"]) @ p["W2"] + p["b2"]) > 0.5).astype(int)
`,
      solution: RESEAU_BASE + PY`

X = np.array([[0, 0], [0, 1], [1, 0], [1, 1]], dtype=float)
Y = np.array([[0], [1], [1], [0]], dtype=float)


def entrainer_xor(lr=1.0, epoques=2000):
    p = initialiser(2, 4, 1, graine=1)
    pertes = []
    m = X.shape[0]
    for _ in range(epoques):
        A1 = np.tanh(X @ p["W1"] + p["b1"])
        P = sigmoide(A1 @ p["W2"] + p["b2"])
        pertes.append(float(-np.mean(Y * np.log(P) + (1 - Y) * np.log(1 - P))))
        dZ2 = (P - Y) / m
        dA1 = dZ2 @ p["W2"].T
        dZ1 = dA1 * (1 - A1 ** 2)
        p["W2"] -= lr * (A1.T @ dZ2)
        p["b2"] -= lr * dZ2.sum(axis=0)
        p["W1"] -= lr * (X.T @ dZ1)
        p["b1"] -= lr * dZ1.sum(axis=0)
    return p, pertes


def predire(p, X):
    return (sigmoide(np.tanh(X @ p["W1"] + p["b1"]) @ p["W2"] + p["b2"]) > 0.5).astype(int)
`,
      tests: PY`p, pertes = entrainer_xor()
print(predire(p, X).ravel().tolist())
print("perte divisée par plus de 10 :", pertes[-1] < pertes[0] / 10)
print("W1 a appris :", not np.allclose(p["W1"], initialiser(2, 4, 1, graine=1)["W1"]))
`,
      expected: "[0, 1, 1, 0]\nperte divisée par plus de 10 : True\nW1 a appris : True\n",
      hint: "Calcule dA1 = dZ2 @ p[\"W2\"].T avant de modifier W2, puis dZ1 = dA1 * (1 - A1 ** 2), et mets à jour W1 avec X.T @ dZ1 et b1 avec dZ1.sum(axis=0)."
    }
  },
  {
    id: "dl-07", section: "Réseaux", title: "Classer des chiffres : mini-lots et softmax", xp: 130,
    theory: `<p>Passons à un vrai jeu de données : 1 797 images de chiffres manuscrits en 8 × 8 pixels (@@sklearn.datasets.load_digits@@), soit 64 entrées et 10 classes. Les étapes sont celles de tout projet :</p>
<ol><li><strong>normaliser</strong> les entrées (ici, diviser les pixels par 16) : des entrées à la même échelle accélèrent et stabilisent l'apprentissage ;</li><li>encoder les étiquettes en <strong>one-hot</strong> ;</li><li>séparer <strong>entraînement</strong> et <strong>validation</strong> : on mesure toujours sur des données que le réseau n'a pas vues ;</li><li>entraîner par <strong>mini-lots</strong> mélangés à chaque époque, avec softmax et l'entropie croisée en sortie.</li></ol>
~~~py
import numpy as np
from sklearn.datasets import load_digits

X, y = load_digits(return_X_y=True)
print(X.shape, y[:10])
Y = np.eye(10)[y]                 # one-hot : la ligne y de la matrice identité
print(Y[0])
rng = np.random.default_rng(0)
ordre = rng.permutation(len(X))
for debut in range(0, 96, 32):    # les trois premiers mini-lots de 32
    lot = ordre[debut:debut + 32]
    print(debut, X[lot].shape)
~~~
<p>L'<strong>exactitude</strong> se calcule en comparant la classe la plus probable (@@argmax@@) à la bonne. Un modèle à 97 % sur la validation mais 100 % sur l'entraînement commence à apprendre par cœur : c'est l'objet de la leçon suivante.</p>`,
    setup: LAB,
    quiz: [
      { q: "Pourquoi mélanger les données à chaque époque ?", options: ["Pour l'esthétique", "Pour que les mini-lots changent et ne suivent pas un ordre (par exemple tous les 0 puis tous les 1) qui biaiserait les pas de gradient", "Pour la validation", "C'est inutile"], answer: 1, explain: "Des lots représentatifs donnent des gradients moins biaisés." },
      { q: "Pourquoi mesurer l'exactitude sur un jeu de validation séparé ?", options: ["Pour aller plus vite", "Parce qu'un réseau peut mémoriser l'entraînement : seule la performance sur des données jamais vues dit s'il généralise", "Pour économiser la mémoire", "Parce que c'est plus facile"], answer: 1, explain: "Le jeu de test final, lui, n'est utilisé qu'une fois, à la toute fin." }
    ],
    challenge: {
      prompt: `<p>Écris @@entrainer(X, Y, cache=32, lr=0.5, epoques=30, lot=32, graine=0)@@ : un réseau 64 → @@cache@@ (ReLU) → 10 (softmax), entraîné par mini-lots mélangés à chaque époque (utilise @@rng.permutation@@ avec un @@rng = np.random.default_rng(graine)@@), avec l'entropie croisée. Les poids sont initialisés selon He : @@rng.normal(0, np.sqrt(2 / n_entrees), forme)@@. Puis @@exactitude(p, X, y)@@.</p><p>Le test charge les chiffres, garde 1 500 images pour l'entraînement et 297 pour la validation, et attend plus de 95 % d'exactitude en validation.</p>`,
      starter: PY`import numpy as np
from sklearn.datasets import load_digits


def softmax(Z):
    E = np.exp(Z - Z.max(axis=1, keepdims=True))
    return E / E.sum(axis=1, keepdims=True)


def entrainer(X, Y, cache=32, lr=0.5, epoques=30, lot=32, graine=0):
    rng = np.random.default_rng(graine)
    p = {"W1": np.zeros((64, cache)), "b1": np.zeros(cache), "W2": np.zeros((cache, 10)), "b2": np.zeros(10)}
    return p


def exactitude(p, X, y):
    A1 = np.maximum(0, X @ p["W1"] + p["b1"])
    return float(np.mean(np.argmax(A1 @ p["W2"] + p["b2"], axis=1) == y))
`,
      solution: PY`import numpy as np
from sklearn.datasets import load_digits


def softmax(Z):
    E = np.exp(Z - Z.max(axis=1, keepdims=True))
    return E / E.sum(axis=1, keepdims=True)


def entrainer(X, Y, cache=32, lr=0.5, epoques=30, lot=32, graine=0):
    rng = np.random.default_rng(graine)
    p = {
        "W1": rng.normal(0, np.sqrt(2 / 64), (64, cache)), "b1": np.zeros(cache),
        "W2": rng.normal(0, np.sqrt(2 / cache), (cache, 10)), "b2": np.zeros(10),
    }
    for _ in range(epoques):
        ordre = rng.permutation(len(X))
        for debut in range(0, len(X), lot):
            i = ordre[debut:debut + lot]
            Xb, Yb, m = X[i], Y[i], len(i)
            Z1 = Xb @ p["W1"] + p["b1"]
            A1 = np.maximum(0, Z1)
            P = softmax(A1 @ p["W2"] + p["b2"])
            dZ2 = (P - Yb) / m
            dZ1 = (dZ2 @ p["W2"].T) * (Z1 > 0)
            p["W2"] -= lr * A1.T @ dZ2
            p["b2"] -= lr * dZ2.sum(axis=0)
            p["W1"] -= lr * Xb.T @ dZ1
            p["b1"] -= lr * dZ1.sum(axis=0)
    return p


def exactitude(p, X, y):
    A1 = np.maximum(0, X @ p["W1"] + p["b1"])
    return float(np.mean(np.argmax(A1 @ p["W2"] + p["b2"], axis=1) == y))
`,
      tests: PY`X, y = load_digits(return_X_y=True)
X = X / 16.0
melange = np.random.default_rng(42).permutation(len(X))
X, y = X[melange], y[melange]
Y = np.eye(10)[y]
p = entrainer(X[:1500], Y[:1500])
print("formes :", p["W1"].shape, p["W2"].shape)
print("validation > 95 % :", exactitude(p, X[1500:], y[1500:]) > 0.95)
print("entraînement > 97 % :", exactitude(p, X[:1500], y[:1500]) > 0.97)
`,
      expected: "formes : (64, 32) (32, 10)\nvalidation > 95 % : True\nentraînement > 97 % : True\n",
      hint: "Initialise W1 et W2 avec rng.normal(0, np.sqrt(2 / n_entrees), forme). Puis, pour chaque époque, ordre = rng.permutation(len(X)) et une boucle sur les lots ordre[debut:debut + lot] : propagation avant, dZ2 = (P - Yb) / m, dZ1 = (dZ2 @ W2.T) * (Z1 > 0), mises à jour."
    }
  },
  {
    id: "dl-08", section: "Réseaux", title: "Surapprentissage et régularisation", xp: 110,
    theory: `<p>Un réseau a souvent assez de paramètres pour <strong>apprendre par cœur</strong> ses données d'entraînement, bruit compris : la perte d'entraînement continue de baisser, mais celle de validation remonte. C'est le <strong>surapprentissage</strong> (overfitting). L'inverse, un modèle trop simple qui échoue partout, est le <strong>sous-apprentissage</strong>.</p>
~~~py
import numpy as np
import matplotlib.pyplot as plt

epoques = np.arange(1, 41)
entrainement = 1.2 * np.exp(-epoques / 8) + 0.02
validation = 1.2 * np.exp(-epoques / 8) + 0.0006 * (epoques - 12) ** 2 * (epoques > 12) + 0.1
plt.plot(epoques, entrainement, label="entraînement")
plt.plot(epoques, validation, label="validation")
plt.axvline(int(np.argmin(validation)) + 1, ls="--", c="gray")
plt.xlabel("époque"); plt.ylabel("perte"); plt.legend(); plt.show()
print("meilleure époque :", int(np.argmin(validation)) + 1)
~~~
<p>Les remèdes :</p>
<ul><li><strong>plus de données</strong>, ou de l'<strong>augmentation</strong> (images retournées, décalées, recadrées) ;</li><li><strong>régularisation L2</strong> (weight decay) : ajouter @@λ·Σw²@@ à la perte pousse les poids vers de petites valeurs ;</li><li><strong>dropout</strong> : éteindre au hasard une partie des neurones à chaque pas d'entraînement, pour qu'aucun ne devienne indispensable ;</li><li><strong>arrêt précoce</strong> (early stopping) : surveiller la perte de validation et arrêter quand elle ne s'améliore plus depuis quelques époques (la <em>patience</em>), en gardant les poids de la meilleure époque ;</li><li>un modèle plus petit.</li></ul>
<p>Le compromis biais-variance résume tout cela : un modèle trop simple a un biais élevé, un modèle trop souple une variance élevée ; la validation sert à trouver le juste milieu.</p>`,
    setup: LAB,
    quiz: [
      { q: "La perte d'entraînement baisse toujours, celle de validation remonte depuis 10 époques. Diagnostic ?", options: ["Sous-apprentissage", "Surapprentissage : le modèle mémorise l'entraînement au lieu de généraliser", "Taux d'apprentissage trop faible", "Données mal normalisées"], answer: 1, explain: "L'arrêt précoce aurait gardé les poids d'il y a 10 époques." },
      { q: "Que fait le dropout pendant l'inférence (la prédiction) ?", options: ["Il éteint toujours des neurones", "Rien : il n'agit qu'à l'entraînement ; à l'inférence tous les neurones sont actifs (avec la mise à l'échelle prévue)", "Il double les poids", "Il ajoute du bruit aux entrées"], answer: 1, explain: "Keras le gère seul selon le mode entraînement ou inférence." }
    ],
    challenge: {
      prompt: `<p>Écris @@arret_precoce(pertes_validation, patience)@@ : elle parcourt les pertes de validation époque par époque (la première époque est la 1) et renvoie @@(meilleure_epoque, epoque_d_arret)@@. On s'arrête dès que la perte n'a pas battu le meilleur score depuis @@patience@@ époques ; si cela n'arrive jamais, l'époque d'arrêt est la dernière. Une égalité ne compte pas comme une amélioration.</p><p>Puis @@perte_l2(perte, poids, lam)@@ qui renvoie @@perte + lam × Σ w²@@ sur toutes les matrices de la liste @@poids@@.</p>`,
      starter: PY`import numpy as np


def arret_precoce(pertes_validation, patience):
    meilleure = int(np.argmin(pertes_validation)) + 1
    return meilleure, len(pertes_validation)


def perte_l2(perte, poids, lam):
    return perte
`,
      solution: PY`import numpy as np


def arret_precoce(pertes_validation, patience):
    meilleur, meilleure_epoque, attente = float("inf"), 0, 0
    for epoque, perte in enumerate(pertes_validation, start=1):
        if perte < meilleur:
            meilleur, meilleure_epoque, attente = perte, epoque, 0
        else:
            attente += 1
            if attente >= patience:
                return meilleure_epoque, epoque
    return meilleure_epoque, len(pertes_validation)


def perte_l2(perte, poids, lam):
    return perte + lam * sum(float(np.sum(W ** 2)) for W in poids)
`,
      tests: PY`print(arret_precoce([0.9, 0.7, 0.6, 0.61, 0.62, 0.55, 0.58, 0.59, 0.6], 2))
print(arret_precoce([0.9, 0.7, 0.6, 0.61, 0.62, 0.55, 0.58, 0.59, 0.6], 3))
print(arret_precoce([0.5, 0.4, 0.3], 2))
print(arret_precoce([0.5, 0.5, 0.5, 0.5], 3))
print(round(perte_l2(0.3, [np.ones((2, 2)), np.array([[3.0]])], 0.01), 4))
`,
      expected: "(3, 5)\n(6, 9)\n(3, 3)\n(1, 4)\n0.43\n",
      hint: "Garde le meilleur score, son époque et un compteur d'époques sans amélioration ; remets le compteur à 0 quand la perte est strictement meilleure, et arrête quand il atteint la patience. Pour L2 : perte + lam * somme des np.sum(W ** 2)."
    }
  },
  {
    id: "dl-09", section: "Entretien", title: "Questions d'entretien : les bases du deep learning", xp: 60, theoryOnly: true,
    theory: `<p>En entretien ML ou MLOps, on vérifie qu'on comprend ce qui se passe sous le capot, pas seulement l'appel à @@model.fit()@@. Explique avec tes mots, puis donne un exemple.</p>
<div class="qa">
<details><summary>Pourquoi un réseau a-t-il besoin de fonctions d'activation non linéaires ?</summary><p>Sans elles, une suite de couches linéaires se réduit à une seule transformation linéaire : le réseau ne pourrait représenter que des frontières droites, quelle que soit sa profondeur.</p></details>
<details><summary>Explique la descente de gradient et le rôle du taux d'apprentissage.</summary><p>On calcule la dérivée de la perte par rapport à chaque poids et on fait un petit pas dans le sens opposé. Le taux d'apprentissage fixe la taille du pas : trop grand, ça diverge ; trop petit, c'est interminable. Adam l'adapte par paramètre.</p></details>
<details><summary>Qu'est-ce que la rétropropagation ?</summary><p>L'application de la règle de dérivation en chaîne, de la sortie vers l'entrée, pour obtenir le gradient de la perte par rapport à tous les poids en une seule passe arrière, en réutilisant les calculs de la passe avant.</p></details>
<details><summary>Batch, mini-batch, SGD : quelle différence ?</summary><p>Le gradient sur toutes les données (lent, précis), sur un exemple (rapide, bruité), ou sur un mini-lot de 32 à 256 exemples : le compromis utilisé en pratique, qui exploite bien le GPU.</p></details>
<details><summary>Qu'est-ce que l'évanouissement ou l'explosion du gradient ?</summary><p>En multipliant de nombreuses dérivées pendant la rétropropagation, le gradient devient minuscule (les premières couches n'apprennent plus) ou énorme (instabilité). Remèdes : ReLU, initialisation de He ou Glorot, normalisation par lots, connexions résiduelles, écrêtage du gradient.</p></details>
<details><summary>Comment détecter et combattre le surapprentissage ?</summary><p>Courbes d'entraînement et de validation qui divergent. Plus de données ou d'augmentation, régularisation L2, dropout, arrêt précoce, modèle plus petit.</p></details>
<details><summary>Entropie croisée ou MSE ?</summary><p>Entropie croisée pour la classification (avec sigmoïde ou softmax : gradient simple P − Y, forte pénalité des erreurs sûres d'elles) ; MSE ou MAE pour la régression.</p></details>
<details><summary>À quoi servent les jeux d'entraînement, de validation et de test ?</summary><p>Entraînement : ajuster les poids. Validation : choisir les hyperparamètres et l'époque d'arrêt. Test : une mesure finale, utilisée une seule fois, sur des données jamais vues.</p></details>
<details><summary>Pourquoi normaliser les entrées ?</summary><p>Des entrées d'échelles très différentes allongent la surface de perte : la descente zigzague et il faut un petit taux d'apprentissage. Centrer et réduire rend l'optimisation plus rapide et plus stable.</p></details>
</div>`,
    practice: { title: "S'entraîner", body: `<p>Explique à voix haute, sans notes, la boucle d'entraînement complète d'un réseau à une couche cachée, puis réécris-la de mémoire dans un notebook et fais-la tourner sur les chiffres. Ajoute l'arrêt précoce et une régularisation L2, et compare les courbes. C'est la meilleure préparation avant de passer à Keras, qui fera tout cela en quelques lignes.</p>` },
    quiz: [
      { q: "Un collègue initialise tous les poids d'une couche à 0,5. Que se passe-t-il ?", options: ["Rien de grave", "Tous les neurones de la couche calculent la même chose et reçoivent le même gradient : la couche ne vaut qu'un neurone", "L'apprentissage est plus rapide", "La perte devient nan"], answer: 1, explain: "Il faut briser la symétrie avec une initialisation aléatoire." },
      { q: "La perte de validation est meilleure que celle d'entraînement, avec du dropout. Est-ce un bogue ?", options: ["Oui, toujours", "Pas forcément : le dropout et la régularisation ne s'appliquent qu'à l'entraînement, ce qui peut gonfler sa perte", "Oui, il faut retirer la validation", "Cela prouve un surapprentissage"], answer: 1, explain: "À vérifier quand même : une fuite de données entre les jeux donne le même symptôme." }
    ]
  }
];
