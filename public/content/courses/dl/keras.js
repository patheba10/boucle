/* Cours Deep learning — chapitre 3 : Keras. Dans le navigateur, « keras » est minikeras (même API, en NumPy) ;
   la CI vérifie aussi chaque solution avec le vrai TensorFlow (scripts/verifier_tf.mjs). */
const PY = String.raw;

const LAB = `<p><strong>Sur ta machine</strong> : @@pip install tensorflow@@ (ou, sans rien installer, Google Colab : colle le code dans une cellule, et choisis un GPU dans « Exécution, Modifier le type d'exécution » pour les modèles plus gros). Le code de cette leçon est du vrai Keras 3 : dans le navigateur, Boucle l'exécute avec une version de Keras écrite en NumPy, et la CI vérifie chaque solution avec le vrai TensorFlow.</p>`;

const LUNES = PY`import numpy as np
import keras
from keras import layers
from sklearn.datasets import make_moons

keras.utils.set_random_seed(0)
X, y = make_moons(n_samples=600, noise=0.2, random_state=0)
X_train, y_train, X_test, y_test = X[:500], y[:500], X[500:], y[500:]
`;

const CHIFFRES = PY`import numpy as np
import keras
from keras import layers
from sklearn.datasets import load_digits

keras.utils.set_random_seed(0)
X, y = load_digits(return_X_y=True)
X = X / 16.0
melange = np.random.default_rng(42).permutation(len(X))
X, y = X[melange], y[melange]
X_train, y_train, X_test, y_test = X[:1500], y[:1500], X[1500:], y[1500:]
`;

export default [
  {
    id: "dl-10", section: "Keras", title: "Un premier modèle avec Keras", xp: 110,
    theory: `<p><strong>Keras</strong> est l'interface haut niveau de TensorFlow (Keras 3 fonctionne aussi au-dessus de JAX et PyTorch). Tout ce qu'on a écrit à la main tient en quelques lignes : on <strong>déclare</strong> les couches, on <strong>compile</strong> (optimiseur, perte, métriques), on <strong>entraîne</strong> avec @@fit@@, on <strong>évalue</strong> avec @@evaluate@@ et on prédit avec @@predict@@.</p>
~~~py
import numpy as np
import keras
from keras import layers

keras.utils.set_random_seed(0)
X = np.random.default_rng(0).uniform(-1, 1, (400, 2))
y = (X[:, 0] * X[:, 1] > 0).astype(int)          # un « XOR » continu

model = keras.Sequential([
    keras.Input(shape=(2,)),
    layers.Dense(16, activation="relu"),
    layers.Dense(1, activation="sigmoid"),
])
model.compile(optimizer=keras.optimizers.Adam(learning_rate=0.02), loss="binary_crossentropy", metrics=["accuracy"])
model.summary()
historique = model.fit(X, y, epochs=40, batch_size=32, verbose=0)
print("exactitude finale :", round(historique.history["accuracy"][-1], 2))
print(model.predict(np.array([[0.5, 0.5], [0.5, -0.5]]), verbose=0).round(2))
~~~
<p>@@summary()@@ affiche chaque couche, sa forme de sortie (@@None@@ désigne la taille du lot, libre) et son nombre de paramètres : @@2 × 16 + 16 = 48@@ pour la première couche dense, @@16 × 1 + 1 = 17@@ pour la sortie. Savoir recalculer ces nombres est une question d'entretien classique.</p>
<p>Les choix à faire à chaque modèle : l'activation de sortie et la perte vont ensemble (@@sigmoid@@ et @@binary_crossentropy@@ pour oui/non, @@softmax@@ et @@sparse_categorical_crossentropy@@ pour plusieurs classes, rien et @@mse@@ pour une régression) ; Adam avec un taux d'apprentissage entre @@1e-3@@ et @@1e-2@@ est un bon départ.</p>`,
    setup: LAB,
    quiz: [
      { q: "Combien de paramètres a une couche Dense(16) qui reçoit 2 entrées ?", options: ["32", "48 : 2 × 16 poids plus 16 biais", "18", "16"], answer: 1, explain: "Poids : entrées × neurones ; plus un biais par neurone." },
      { q: "Quelle paire pour classer des e-mails en spam ou non ?", options: ["softmax et mse", "Une sortie Dense(1, activation=\"sigmoid\") et la perte binary_crossentropy", "relu et categorical_crossentropy", "Pas d'activation et mse"], answer: 1, explain: "Une probabilité entre 0 et 1, et la perte adaptée aux probabilités binaires." }
    ],
    challenge: {
      prompt: `<p>Les données « lunes » de scikit-learn forment deux croissants imbriqués : aucune droite ne les sépare. Écris @@construire()@@ qui renvoie un modèle <strong>compilé</strong> :</p><ul><li>entrée de 2 valeurs, deux couches cachées @@Dense(16, relu)@@, une sortie @@Dense(1, sigmoid)@@ ;</li><li>optimiseur Adam avec un taux d'apprentissage de @@0.01@@, perte @@binary_crossentropy@@, métrique @@accuracy@@.</li></ul><p>Le test l'entraîne 100 époques et attend plus de 95 % d'exactitude sur les 100 points de test.</p>`,
      starter: LUNES + PY`

def construire():
    model = keras.Sequential([
        keras.Input(shape=(2,)),
        layers.Dense(1, activation="sigmoid"),
    ])
    model.compile(optimizer="sgd", loss="binary_crossentropy", metrics=["accuracy"])
    return model
`,
      solution: LUNES + PY`

def construire():
    model = keras.Sequential([
        keras.Input(shape=(2,)),
        layers.Dense(16, activation="relu"),
        layers.Dense(16, activation="relu"),
        layers.Dense(1, activation="sigmoid"),
    ])
    model.compile(optimizer=keras.optimizers.Adam(learning_rate=0.01), loss="binary_crossentropy", metrics=["accuracy"])
    return model
`,
      tests: PY`model = construire()
print("paramètres :", model.count_params())
model.fit(X_train, y_train, epochs=100, batch_size=32, verbose=0)
perte, exactitude = model.evaluate(X_test, y_test, verbose=0)
print("test > 95 % :", exactitude > 0.95)
print("sortie :", model.predict(X_test[:4], verbose=0).shape)
`,
      expected: "paramètres : 337\ntest > 95 % : True\nsortie : (4, 1)\n",
      hint: "Ajoute layers.Dense(16, activation=\"relu\") deux fois avant la sortie, et compile avec optimizer=keras.optimizers.Adam(learning_rate=0.01). Paramètres : (2×16+16) + (16×16+16) + (16+1) = 337."
    }
  },
  {
    id: "dl-11", section: "Keras", title: "Classer des chiffres avec Keras", xp: 110,
    theory: `<p>Reprenons les chiffres manuscrits, cette fois avec Keras. Avec des étiquettes entières (0 à 9), la perte @@sparse_categorical_crossentropy@@ évite de passer en one-hot. @@validation_split=0.2@@ garde les 20 derniers pourcents des données d'entraînement pour la validation, et l'historique renvoyé par @@fit@@ contient les courbes :</p>
~~~py
import keras
from keras import layers
from sklearn.datasets import load_digits

keras.utils.set_random_seed(1)
X, y = load_digits(return_X_y=True)
X = X / 16.0
model = keras.Sequential([
    keras.Input(shape=(64,)),
    layers.Dense(64, activation="relu"),
    layers.Dense(10, activation="softmax"),
])
model.compile(optimizer=keras.optimizers.Adam(0.01), loss="sparse_categorical_crossentropy", metrics=["accuracy"])
h = model.fit(X[:1500], y[:1500], epochs=5, batch_size=32, validation_split=0.2, verbose=1)
print(sorted(h.history))
probas = model.predict(X[1500:1503], verbose=0)
print(probas.round(2))
print("classes prédites :", probas.argmax(axis=1), " réelles :", y[1500:1503])
~~~
<p>La sortie softmax donne une probabilité par classe ; @@argmax@@ choisit la plus probable. Sur de vraies images (28 × 28 pour MNIST, 224 × 224 en couleur pour ImageNet), le principe est identique, avec plus de données et un GPU.</p>`,
    setup: LAB,
    quiz: [
      { q: "Les étiquettes sont des entiers 0 à 9. Quelle perte utiliser sans les convertir ?", options: ["categorical_crossentropy", "sparse_categorical_crossentropy", "binary_crossentropy", "mse"], answer: 1, explain: "categorical_crossentropy attend du one-hot." },
      { q: "Que contient h.history après fit(..., validation_split=0.2) avec metrics=[\"accuracy\"] ?", options: ["Les poids", "Les listes loss, accuracy, val_loss, val_accuracy (une valeur par époque)", "Les prédictions", "Le temps d'entraînement"], answer: 1, explain: "C'est ce qu'on trace pour diagnostiquer l'entraînement." }
    ],
    challenge: {
      prompt: `<p>Écris @@construire()@@ : un modèle compilé pour les chiffres (64 entrées), avec une couche cachée @@Dense(64, relu)@@, une couche @@Dropout(0.2)@@ et une sortie à 10 classes en softmax ; Adam (taux @@0.005@@), perte adaptée aux étiquettes entières, métrique @@accuracy@@.</p><p>Puis @@predire_classes(model, X)@@ qui renvoie les classes prédites (un entier par ligne). Le test entraîne 30 époques et attend plus de 95 % sur 297 images de test.</p>`,
      starter: CHIFFRES + PY`

def construire():
    model = keras.Sequential([
        keras.Input(shape=(64,)),
        layers.Dense(10, activation="relu"),
    ])
    model.compile(optimizer="adam", loss="mse", metrics=["accuracy"])
    return model


def predire_classes(model, X):
    return model.predict(X, verbose=0)
`,
      solution: CHIFFRES + PY`

def construire():
    model = keras.Sequential([
        keras.Input(shape=(64,)),
        layers.Dense(64, activation="relu"),
        layers.Dropout(0.2),
        layers.Dense(10, activation="softmax"),
    ])
    model.compile(optimizer=keras.optimizers.Adam(learning_rate=0.005), loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    return model


def predire_classes(model, X):
    return model.predict(X, verbose=0).argmax(axis=1)
`,
      tests: PY`model = construire()
print("paramètres :", model.count_params(), [type(l).__name__ for l in model.layers])
model.fit(X_train, y_train, epochs=30, batch_size=32, verbose=0)
classes = predire_classes(model, X_test)
print("forme :", classes.shape, " test > 95 % :", float(np.mean(classes == y_test)) > 0.95)
`,
      expected: "paramètres : 4810 ['Dense', 'Dropout', 'Dense']\nforme : (297,)  test > 95 % : True\n",
      hint: "Sortie layers.Dense(10, activation=\"softmax\"), perte \"sparse_categorical_crossentropy\". predire_classes : model.predict(X, verbose=0).argmax(axis=1)."
    }
  },
  {
    id: "dl-12", section: "Keras", title: "Suivre l'entraînement : callbacks et courbes", xp: 110,
    theory: `<p>Un <strong>callback</strong> est un objet que Keras appelle à certains moments de l'entraînement (fin d'époque, fin de lot). Les plus utiles :</p>
<ul><li>@@EarlyStopping(monitor="val_loss", patience=5, restore_best_weights=True)@@ : l'arrêt précoce de la leçon précédente, en une ligne ;</li><li>@@ModelCheckpoint("meilleur.keras", save_best_only=True)@@ : enregistre le meilleur modèle au fil de l'eau ;</li><li>@@ReduceLROnPlateau@@ : divise le taux d'apprentissage quand la validation stagne ;</li><li>@@TensorBoard(log_dir="logs")@@ : des courbes interactives dans le navigateur.</li></ul>
~~~py
import matplotlib.pyplot as plt
import keras
from keras import layers
from sklearn.datasets import load_digits

keras.utils.set_random_seed(0)
X, y = load_digits(return_X_y=True)
X = X / 16.0
model = keras.Sequential([keras.Input(shape=(64,)), layers.Dense(128, activation="relu"), layers.Dense(10, activation="softmax")])
model.compile(optimizer=keras.optimizers.Adam(0.01), loss="sparse_categorical_crossentropy", metrics=["accuracy"])
arret = keras.callbacks.EarlyStopping(monitor="val_loss", patience=4, restore_best_weights=True)
h = model.fit(X[:1200], y[:1200], validation_data=(X[1200:], y[1200:]), epochs=60, verbose=0, callbacks=[arret])
print("époques effectuées :", len(h.history["loss"]))
plt.plot(h.history["loss"], label="entraînement")
plt.plot(h.history["val_loss"], label="validation")
plt.xlabel("époque"); plt.ylabel("perte"); plt.legend(); plt.show()
~~~
<p>Lire ces courbes est un réflexe : deux pertes qui baissent ensemble, l'entraînement continue ; la validation qui remonte, surapprentissage ; les deux qui stagnent haut, sous-apprentissage (modèle trop petit, taux d'apprentissage mal réglé). En production, on suit les mêmes courbes avec MLflow, Weights & Biases ou TensorBoard.</p>`,
    setup: LAB,
    quiz: [
      { q: "À quoi sert restore_best_weights=True dans EarlyStopping ?", options: ["À accélérer l'entraînement", "À remettre, à l'arrêt, les poids de la meilleure époque plutôt que ceux de la dernière", "À sauvegarder sur disque", "À réduire le taux d'apprentissage"], answer: 1, explain: "Sans lui, on garde les poids des « patience » époques de trop." },
      { q: "Les pertes d'entraînement et de validation stagnent toutes deux à un niveau élevé. Diagnostic ?", options: ["Surapprentissage", "Sous-apprentissage : modèle trop simple ou optimisation mal réglée", "Tout va bien", "Fuite de données"], answer: 1, explain: "On agrandit le modèle, on entraîne plus, ou on revoit le taux d'apprentissage." }
    ],
    challenge: {
      prompt: `<p>Écris @@entrainer(model)@@ qui entraîne le modèle fourni sur @@X_train, y_train@@ pendant <strong>au plus 200 époques</strong>, avec @@X_test, y_test@@ en validation, et un arrêt précoce sur @@val_loss@@ (patience 5, restauration des meilleurs poids). Elle renvoie l'historique de @@fit@@ et le callback d'arrêt.</p>`,
      starter: CHIFFRES + PY`

def modele():
    m = keras.Sequential([keras.Input(shape=(64,)), layers.Dense(64, activation="relu"), layers.Dense(10, activation="softmax")])
    m.compile(optimizer=keras.optimizers.Adam(0.01), loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    return m


def entrainer(model):
    arret = None
    h = model.fit(X_train, y_train, epochs=200, verbose=0)
    return h, arret
`,
      solution: CHIFFRES + PY`

def modele():
    m = keras.Sequential([keras.Input(shape=(64,)), layers.Dense(64, activation="relu"), layers.Dense(10, activation="softmax")])
    m.compile(optimizer=keras.optimizers.Adam(0.01), loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    return m


def entrainer(model):
    arret = keras.callbacks.EarlyStopping(monitor="val_loss", patience=5, restore_best_weights=True)
    h = model.fit(X_train, y_train, validation_data=(X_test, y_test), epochs=200, verbose=0, callbacks=[arret])
    return h, arret
`,
      tests: PY`model = modele()
h, arret = entrainer(model)
n = len(h.history["loss"])
print("arrêté avant 200 époques :", n < 200)
print("courbes :", sorted(h.history))
meilleure = min(h.history["val_loss"])
print("meilleurs poids restaurés :", abs(model.evaluate(X_test, y_test, verbose=0)[0] - meilleure) < 1e-3)
`,
      expected: "arrêté avant 200 époques : True\ncourbes : ['accuracy', 'loss', 'val_accuracy', 'val_loss']\nmeilleurs poids restaurés : True\n",
      hint: "arret = keras.callbacks.EarlyStopping(monitor=\"val_loss\", patience=5, restore_best_weights=True), puis model.fit(X_train, y_train, validation_data=(X_test, y_test), epochs=200, verbose=0, callbacks=[arret])."
    }
  },
  {
    id: "dl-13", section: "Keras", title: "Réseaux convolutifs (CNN)", xp: 130,
    theory: `<p>Une couche dense relie chaque pixel à chaque neurone : elle ignore que deux pixels voisins sont liés, et son nombre de poids explose avec la taille de l'image. Une couche <strong>convolutive</strong> fait glisser de petits <strong>filtres</strong> (3 × 3 par exemple) sur toute l'image ; chaque filtre détecte un motif (un bord, un coin, puis des formes plus complexes dans les couches suivantes), où qu'il se trouve. Les mêmes 9 poids servent à toutes les positions.</p>
~~~py
import numpy as np
import keras
from keras import layers

keras.utils.set_random_seed(0)
model = keras.Sequential([
    keras.Input(shape=(8, 8, 1)),                     # hauteur, largeur, canaux (1 : niveaux de gris)
    layers.Conv2D(16, 3, activation="relu"),          # 16 filtres 3 × 3 → (6, 6, 16)
    layers.MaxPooling2D(2),                           # garde le maximum de chaque carré 2 × 2 → (3, 3, 16)
    layers.Flatten(),                                 # → 144 valeurs
    layers.Dense(10, activation="softmax"),
])
model.summary()
~~~
<p>Les paramètres d'une convolution : @@(3 × 3 × canaux d'entrée + 1) × filtres@@, soit @@(9 + 1) × 16 = 160@@ ici, quelle que soit la taille de l'image. Le <strong>pooling</strong> réduit la taille et rend le réseau tolérant aux petits décalages. Les architectures classiques (LeNet, VGG, ResNet, EfficientNet) empilent ces blocs en augmentant le nombre de filtres à mesure que l'image rétrécit. Les données d'image ont quatre dimensions : @@(lot, hauteur, largeur, canaux)@@.</p>`,
    setup: LAB,
    quiz: [
      { q: "Combien de paramètres pour Conv2D(32, 3) sur une image en couleur (3 canaux) ?", options: ["96", "896 : (3 × 3 × 3 + 1) × 32", "288", "Cela dépend de la taille de l'image"], answer: 1, explain: "Les filtres sont partagés sur toute l'image : la taille de l'image n'entre pas dans le calcul." },
      { q: "À quoi sert MaxPooling2D(2) ?", options: ["À ajouter des filtres", "À diviser hauteur et largeur par 2 en gardant le maximum de chaque bloc, ce qui réduit le calcul et tolère de petits décalages", "À normaliser l'image", "À éviter le surapprentissage seulement"], answer: 1, explain: "Il n'a aucun paramètre à apprendre." }
    ],
    challenge: {
      prompt: `<p>Les images de chiffres font 8 × 8 pixels. Écris @@construire()@@ : un CNN compilé avec, dans l'ordre :</p><ul><li>une entrée @@(8, 8, 1)@@ ;</li><li>@@Conv2D(16, 3, relu)@@ puis @@MaxPooling2D(2)@@ ;</li><li>@@Flatten@@, @@Dense(32, relu)@@ et une sortie softmax à 10 classes ;</li><li>Adam (taux @@0.005@@), @@sparse_categorical_crossentropy@@, @@accuracy@@.</li></ul><p>Le test remet les images en forme @@(n, 8, 8, 1)@@, entraîne 20 époques et attend plus de 93 % sur les images de test.</p>`,
      starter: CHIFFRES + PY`

def construire():
    model = keras.Sequential([
        keras.Input(shape=(8, 8, 1)),
        layers.Flatten(),
        layers.Dense(10, activation="softmax"),
    ])
    model.compile(optimizer=keras.optimizers.Adam(0.005), loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    return model
`,
      solution: CHIFFRES + PY`

def construire():
    model = keras.Sequential([
        keras.Input(shape=(8, 8, 1)),
        layers.Conv2D(16, 3, activation="relu"),
        layers.MaxPooling2D(2),
        layers.Flatten(),
        layers.Dense(32, activation="relu"),
        layers.Dense(10, activation="softmax"),
    ])
    model.compile(optimizer=keras.optimizers.Adam(0.005), loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    return model
`,
      tests: PY`model = construire()
print([(type(l).__name__, l.count_params()) for l in model.layers])
Xi_train, Xi_test = X_train.reshape(-1, 8, 8, 1), X_test.reshape(-1, 8, 8, 1)
model.fit(Xi_train, y_train, epochs=20, batch_size=32, verbose=0)
print("test > 93 % :", model.evaluate(Xi_test, y_test, verbose=0)[1] > 0.93)
`,
      expected: "[('Conv2D', 160), ('MaxPooling2D', 0), ('Flatten', 0), ('Dense', 4640), ('Dense', 330)]\ntest > 93 % : True\n",
      hint: "Après l'entrée : layers.Conv2D(16, 3, activation=\"relu\"), layers.MaxPooling2D(2), layers.Flatten(), layers.Dense(32, activation=\"relu\"), puis la sortie. La convolution donne 6 × 6 × 16, le pooling 3 × 3 × 16 = 144 valeurs."
    }
  },
  {
    id: "dl-14", section: "Keras", title: "Transfert d'apprentissage", xp: 70, theoryOnly: true,
    theory: `<p>Entraîner un réseau de vision depuis zéro demande des millions d'images et des jours de GPU. Le <strong>transfert d'apprentissage</strong> réutilise un modèle déjà entraîné sur ImageNet (1,2 million d'images, 1 000 classes) : ses premières couches savent déjà reconnaître bords, textures et formes. On garde cette base, on la <strong>gèle</strong>, et on n'entraîne qu'une petite tête de classification pour ses propres classes, avec quelques centaines d'images.</p>
~~~py norun
import keras
from keras import layers

base = keras.applications.MobileNetV3Small(input_shape=(224, 224, 3), include_top=False, weights="imagenet")
base.trainable = False                              # 1. on gèle la base

entrees = keras.Input(shape=(224, 224, 3))
x = keras.applications.mobilenet_v3.preprocess_input(entrees)
x = base(x, training=False)
x = layers.GlobalAveragePooling2D()(x)
x = layers.Dropout(0.2)(x)
sorties = layers.Dense(3, activation="softmax")(x)   # 3 classes : par exemple des pièces défectueuses ou non
model = keras.Model(entrees, sorties)
model.compile(optimizer=keras.optimizers.Adam(1e-3), loss="sparse_categorical_crossentropy", metrics=["accuracy"])
model.fit(images_train, etiquettes_train, validation_data=(images_val, etiquettes_val), epochs=10)

base.trainable = True                               # 2. réglage fin (fine-tuning), facultatif
model.compile(optimizer=keras.optimizers.Adam(1e-5), loss="sparse_categorical_crossentropy", metrics=["accuracy"])
model.fit(images_train, etiquettes_train, validation_data=(images_val, etiquettes_val), epochs=5)
~~~
<p>Les points qui reviennent en entretien :</p>
<ul><li>utiliser le <strong>prétraitement</strong> du modèle d'origine (sa normalisation des pixels), sinon les résultats s'effondrent ;</li><li>entraîner d'abord la tête seule, puis éventuellement dégeler la base avec un taux d'apprentissage <strong>très petit</strong>, pour ne pas détruire ce qu'elle sait ;</li><li>l'<strong>augmentation de données</strong> (@@layers.RandomFlip@@, @@RandomRotation@@, @@RandomZoom@@) compense le petit nombre d'images ;</li><li>choisir la base selon la cible : MobileNet ou EfficientNet-Lite pour un téléphone ou une carte embarquée, plus gros sur serveur.</li></ul>
<p>Le même principe vaut pour le texte : on part d'un modèle de langage préentraîné (BERT, ou un petit modèle de la bibliothèque Hugging Face) et on l'ajuste à sa tâche.</p>`,
    setup: `<p><strong>Sur ta machine</strong> (ou dans Google Colab, avec un GPU) : télécharge le jeu de données « tf_flowers » avec @@keras.utils.image_dataset_from_directory@@ ou @@tensorflow_datasets@@, et entraîne la tête d'un MobileNetV3Small gelé pendant 5 époques. Compare avec le même réseau entraîné depuis zéro (@@weights=None@@) : l'écart d'exactitude montre tout l'intérêt du transfert.</p>`,
    quiz: [
      { q: "Pourquoi geler la base pré-entraînée au début ?", options: ["Pour gagner de la mémoire seulement", "Pour que les gros gradients de la tête, initialisée au hasard, ne détruisent pas ce que la base a appris", "Parce que Keras l'exige", "Pour éviter l'augmentation de données"], answer: 1, explain: "On ne dégèle qu'ensuite, avec un taux d'apprentissage très faible." },
      { q: "Tu as 300 images de pièces industrielles. Quelle approche ?", options: ["Entraîner un ResNet depuis zéro", "Transfert d'apprentissage depuis un modèle ImageNet, avec augmentation de données", "Un perceptron", "Attendre d'avoir un million d'images"], answer: 1, explain: "Peu de données : on emprunte la connaissance d'un modèle déjà entraîné." }
    ]
  },
  {
    id: "dl-15", section: "Keras", title: "Sauvegarder et servir un modèle", xp: 70, theoryOnly: true,
    theory: `<p>Un modèle entraîné n'a de valeur qu'une fois utilisé. On l'enregistre au format @@.keras@@ (architecture, poids et état de l'optimiseur dans un seul fichier), puis on le recharge ailleurs :</p>
~~~py norun
model.save("chiffres.keras")
modele = keras.models.load_model("chiffres.keras")
~~~
<p>Pour le servir, la combinaison la plus simple réunit ce que tu as appris : une API FastAPI qui charge le modèle <strong>une seule fois</strong> au démarrage, valide les entrées avec Pydantic et renvoie la prédiction avec la version du modèle.</p>
~~~py norun
import numpy as np
import keras
from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI()
modele = keras.models.load_model("chiffres.keras")
VERSION = "chiffres-2026-11-12"

class Image(BaseModel):
    pixels: list[float] = Field(min_length=64, max_length=64)

@app.post("/predictions")
def predire(image: Image):
    probas = modele.predict(np.array([image.pixels]) / 16.0, verbose=0)[0]
    return {"chiffre": int(probas.argmax()), "confiance": round(float(probas.max()), 3), "version": VERSION}
~~~
<p>Au-delà de ce prototype, le service en production soulève les questions du <strong>MLOps</strong> :</p>
<ul><li><strong>TensorFlow Serving</strong> ou <strong>Triton</strong> servent un modèle exporté (@@model.export("dossier")@@, format SavedModel) avec regroupement des requêtes et GPU ;</li><li>un conteneur Docker, déployé sur Kubernetes (cours précédents), avec plusieurs répliques et un autoscaling ;</li><li>la surveillance : latence, erreurs, mais aussi <strong>dérive des données</strong> (les entrées de production ne ressemblent plus à celles de l'entraînement) et qualité des prédictions dans le temps ;</li><li>le versionnement des modèles et des données (MLflow, DVC), pour savoir quel modèle a produit quelle prédiction et pouvoir revenir en arrière.</li></ul>
<p>Pour un téléphone, un navigateur ou une carte embarquée, on convertit le modèle en <strong>TensorFlow Lite</strong> : c'est le chapitre suivant.</p>`,
    setup: `<p><strong>Sur ta machine</strong> : entraîne le modèle de chiffres de la leçon 11, enregistre-le en @@chiffres.keras@@, écris l'API ci-dessus dans @@main.py@@, lance @@fastapi dev main.py@@ et envoie une image de test depuis @@/docs@@. Mets ensuite le tout dans une image Docker.</p>`,
    quiz: [
      { q: "Pourquoi charger le modèle au démarrage de l'API plutôt qu'à chaque requête ?", options: ["Par habitude", "Charger un modèle prend du temps et de la mémoire : le faire à chaque requête rendrait chaque prédiction très lente", "Pour la sécurité", "FastAPI l'impose"], answer: 1, explain: "On le charge une fois, et toutes les requêtes le partagent." },
      { q: "Qu'est-ce que la dérive des données (data drift) ?", options: ["Une panne de disque", "Les données reçues en production s'éloignent de celles de l'entraînement, et la qualité des prédictions baisse sans aucune erreur visible", "Un bogue de Keras", "La perte qui augmente pendant l'entraînement"], answer: 1, explain: "On la détecte en surveillant la distribution des entrées et des prédictions." }
    ]
  }
];
