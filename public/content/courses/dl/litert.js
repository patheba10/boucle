/* Cours Deep learning — chapitre 4 : TensorFlow Lite (LiteRT). La conversion et l'interpréteur demandent le vrai
   TensorFlow : ces extraits (~~~py tf) sont vérifiés en CI. La quantification, elle, se calcule en NumPy dans le navigateur. */
const PY = String.raw;

const LAB = `<p><strong>Sur ta machine</strong> (ou dans Google Colab) : @@pip install tensorflow ai-edge-litert@@. TensorFlow Lite s'appelle désormais <strong>LiteRT</strong> : le format @@.tflite@@ et l'API de l'interpréteur ne changent pas, mais le paquet Python est @@ai-edge-litert@@ et @@tf.lite.Interpreter@@ est déprécié au profit de @@ai_edge_litert.interpreter.Interpreter@@.</p>`;

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
model = keras.Sequential([keras.Input(shape=(64,)), layers.Dense(64, activation="relu"), layers.Dense(10, activation="softmax")])
model.compile(optimizer=keras.optimizers.Adam(0.005), loss="sparse_categorical_crossentropy", metrics=["accuracy"])
model.fit(X_train, y_train, epochs=25, verbose=0)
`;

const QUANT = PY`

def quantifier(w):
    """Quantification affine sur 8 bits (int8) : w ≈ (q - zero_point) * echelle."""
    mini, maxi = min(float(w.min()), 0.0), max(float(w.max()), 0.0)
    echelle = (maxi - mini) / 255 or 1.0
    zero_point = int(round(-128 - mini / echelle))
    q = np.clip(np.round(w / echelle) + zero_point, -128, 127).astype(np.int8)
    return q, echelle, zero_point


def dequantifier(q, echelle, zero_point):
    return (q.astype(np.float32) - zero_point) * echelle
`;

export default [
  {
    id: "dl-16", section: "TensorFlow Lite", title: "Du modèle Keras au fichier .tflite", xp: 80, theoryOnly: true,
    theory: `<p>Un téléphone, un Raspberry Pi ou un microcontrôleur n'exécutent pas TensorFlow : trop lourd. On <strong>convertit</strong> le modèle entraîné en un fichier @@.tflite@@ (format FlatBuffers), compact, que lit un petit moteur d'inférence : <strong>LiteRT</strong> (le nouveau nom de TensorFlow Lite). On n'entraîne pas sur l'appareil : on y fait seulement des prédictions.</p>
~~~py tf
import numpy as np
import keras
import tensorflow as tf

keras.utils.set_random_seed(0)
model = keras.Sequential([keras.Input(shape=(64,)), keras.layers.Dense(64, activation="relu"), keras.layers.Dense(10, activation="softmax")])
model.compile(optimizer="adam", loss="sparse_categorical_crossentropy")

# 1. Keras 3 exporte directement au format LiteRT
model.export("chiffres.tflite", format="litert")

# 2. ou le convertisseur, qui donne accès aux options (quantification…)
convertisseur = tf.lite.TFLiteConverter.from_keras_model(model)
octets = convertisseur.convert()
print("float32 :", len(octets), "octets pour", model.count_params(), "paramètres")
convertisseur.optimizations = [tf.lite.Optimize.DEFAULT]
octets_q = convertisseur.convert()
print("poids int8 :", len(octets_q), "octets, soit", round(len(octets) / len(octets_q), 1), "fois moins")
~~~
<p>Ce qui change pendant la conversion :</p>
<ul><li>le graphe est <strong>figé</strong> : plus d'entraînement, plus d'optimiseur, seulement les opérations d'inférence, fusionnées quand c'est possible (une couche dense et son activation deviennent une seule opération) ;</li><li>seules les opérations connues de LiteRT sont permises ; une couche exotique peut demander les opérations « flex » de TensorFlow, qui alourdissent le moteur ;</li><li>la taille du lot est fixée à 1 par défaut : on la redimensionne à l'exécution si besoin.</li></ul>
<p>La conversion est un moment à risque : on vérifie toujours que le modèle converti donne les mêmes prédictions que l'original sur un jeu de test, avant de le déployer.</p>`,
    setup: LAB,
    quiz: [
      { q: "Pourquoi convertir un modèle Keras en .tflite pour un téléphone ?", options: ["Pour l'entraîner plus vite", "Pour obtenir un fichier compact, au graphe figé, exécuté par un petit moteur d'inférence adapté aux appareils", "Parce que Keras ne sait pas prédire", "Pour le chiffrer"], answer: 1, explain: "TensorFlow complet est bien trop gros pour un téléphone, et inutile pour prédire." },
      { q: "Quelle vérification faire après chaque conversion ?", options: ["Aucune", "Comparer les prédictions du modèle converti à celles de l'original sur un jeu de test", "Relancer l'entraînement", "Regarder la taille seulement"], answer: 1, explain: "Une opération mal convertie ou une quantification trop agressive se voit ici." }
    ]
  },
  {
    id: "dl-17", section: "TensorFlow Lite", title: "La quantification", xp: 120,
    theory: `<p>Un poids en <strong>float32</strong> occupe 4 octets. La <strong>quantification</strong> le représente sur 8 bits (un entier de -128 à 127) : le modèle devient 4 fois plus petit, et les calculs en entiers sont bien plus rapides et économes sur les processeurs mobiles et les accélérateurs (NPU, Edge TPU), qui ne savent parfois faire que de l'int8.</p>
<p>La quantification <strong>affine</strong> associe un intervalle de réels @@[min, max]@@ aux 256 entiers, par une <strong>échelle</strong> et un <strong>zéro</strong> (zero point) :</p>
~~~text
échelle    = (max − min) / 255
zero_point = −128 − min / échelle          (arrondi : l'entier qui représente le réel 0)
q          = arrondi(w / échelle) + zero_point, borné à [−128, 127]
w ≈ (q − zero_point) × échelle             (déquantification)
~~~
~~~py
import numpy as np

w = np.array([-0.82, -0.1, 0.0, 0.33, 1.27], dtype=np.float32)
mini, maxi = min(w.min(), 0), max(w.max(), 0)
echelle = (maxi - mini) / 255
zero = int(round(-128 - mini / echelle))
q = np.clip(np.round(w / echelle) + zero, -128, 127).astype(np.int8)
print("échelle", round(float(echelle), 5), " zéro", zero)
print("int8 :", q, " retour :", ((q.astype(np.float32) - zero) * echelle).round(3))
~~~
<p>L'intervalle inclut toujours 0, pour que le réel 0 (un remplissage, une ReLU éteinte) soit représenté exactement. L'erreur d'arrondi ne dépasse pas une demi-échelle. Les variantes :</p>
<ul><li><strong>dynamique</strong> (@@Optimize.DEFAULT@@ seul) : poids en int8, activations en float ; rien à fournir ;</li><li><strong>entière complète</strong> : poids et activations en int8, il faut un <em>jeu représentatif</em> (une centaine d'exemples) pour mesurer l'intervalle des activations ; obligatoire pour les microcontrôleurs et la plupart des NPU ;</li><li><strong>float16</strong> : deux fois plus petit, presque sans perte, idéal pour les GPU mobiles.</li></ul>`,
    setup: LAB,
    quiz: [
      { q: "Un modèle float32 de 20 Mo est quantifié en int8. Quelle taille environ ?", options: ["20 Mo", "5 Mo", "10 Mo", "2,5 Mo"], answer: 1, explain: "1 octet au lieu de 4 par poids : environ 4 fois moins." },
      { q: "Pourquoi la quantification entière complète demande-t-elle un jeu représentatif ?", options: ["Pour réentraîner le modèle", "Pour mesurer l'intervalle réel des activations, qui dépend des données, et en déduire leurs échelles", "Pour tester la vitesse", "Pour la validation croisée"], answer: 1, explain: "Les poids sont connus d'avance ; les activations, non." }
    ],
    challenge: {
      prompt: `<p>Écris @@quantifier(w)@@ qui renvoie @@(q, echelle, zero_point)@@ selon les formules de la théorie (@@q@@ en @@np.int8@@, l'intervalle étendu pour contenir 0), et @@dequantifier(q, echelle, zero_point)@@ qui renvoie des float32.</p><p>Le test vérifie le type, que 0 est représenté exactement, et que l'erreur ne dépasse pas une demi-échelle.</p>`,
      starter: PY`import numpy as np


def quantifier(w):
    echelle = float(w.max()) / 127
    q = np.round(w / echelle)
    return q, echelle, 0


def dequantifier(q, echelle, zero_point):
    return q * echelle
`,
      solution: PY`import numpy as np
` + QUANT,
      tests: PY`w = np.random.default_rng(0).normal(0.2, 0.5, (64, 32)).astype(np.float32)
q, e, z = quantifier(w)
print(q.dtype, q.shape, int(q.min()) >= -128, int(q.max()) <= 127)
print("zéro exact :", float(dequantifier(np.array([z], dtype=np.int8), e, z)[0]) == 0.0)
erreur = float(np.abs(dequantifier(q, e, z) - w).max())
print("erreur ≤ échelle / 2 :", erreur <= e / 2 + 1e-7)
q2, e2, z2 = quantifier(np.array([0.5, 1.0, 2.0], dtype=np.float32))
print(z2, q2.tolist(), dequantifier(q2, e2, z2).dtype)
`,
      expected: "int8 (64, 32) True True\nzéro exact : True\nerreur ≤ échelle / 2 : True\n-128 [-64, -1, 127] float32\n",
      hint: "mini = min(w.min(), 0), maxi = max(w.max(), 0), echelle = (maxi - mini) / 255, zero_point = int(round(-128 - mini / echelle)), puis q = np.clip(np.round(w / echelle) + zero_point, -128, 127).astype(np.int8). Pour revenir : (q.astype(np.float32) - zero_point) * echelle."
    }
  },
  {
    id: "dl-18", section: "TensorFlow Lite", title: "Quantifier un modèle et mesurer la perte", xp: 120,
    theory: `<p>La quantification fait perdre un peu de précision : on la <strong>mesure</strong> toujours. On compare l'exactitude du modèle original et du modèle quantifié sur le même jeu de test, et on décide selon le budget de l'appareil : une perte de 0,5 point pour un modèle 4 fois plus petit et 3 fois plus rapide est souvent une excellente affaire.</p>
<p>On peut simuler la quantification des poids sans convertisseur : quantifier chaque matrice, la déquantifier, et remettre ces poids « arrondis » dans le modèle. C'est ce que fait LiteRT en quantification dynamique, à l'exécution près :</p>
~~~py
import numpy as np

poids = [np.array([[0.31, -1.2], [0.05, 0.77]]), np.array([0.1, -0.2])]
octets_float = sum(w.size * 4 for w in poids)
octets_int8 = sum(w.size * 1 for w in poids if w.ndim > 1) + sum(w.size * 4 for w in poids if w.ndim == 1)
print(octets_float, "octets en float32,", octets_int8, "en int8 (biais gardés en float)")
~~~
<p>Si la perte est trop forte, deux remèdes : la quantification <strong>par canal</strong> (une échelle par neurone de sortie plutôt qu'une pour toute la matrice, que LiteRT applique aux couches denses et convolutives), ou l'entraînement <strong>conscient de la quantification</strong> (QAT) : on simule l'arrondi pendant l'entraînement pour que le réseau apprenne à le supporter.</p>`,
    setup: LAB,
    quiz: [
      { q: "Pourquoi les biais restent-ils souvent en 32 bits ?", options: ["Par oubli", "Ils sont peu nombreux (un par neurone) et sensibles : les quantifier gagne très peu de place et coûte en précision", "LiteRT ne les accepte pas", "Ils valent toujours 0"], answer: 1, explain: "Dans la quantification entière, ils sont stockés en int32." },
      { q: "La quantification fait chuter l'exactitude de 8 points. Que tenter ?", options: ["Abandonner l'appareil", "La quantification par canal, ou l'entraînement conscient de la quantification (QAT)", "Plus d'époques sans rien changer", "Retirer la normalisation"], answer: 1, explain: "Une échelle par canal colle mieux aux poids ; QAT apprend à supporter l'arrondi." }
    ],
    challenge: {
      prompt: `<p>Un modèle de chiffres est déjà entraîné (code fourni), avec les fonctions @@quantifier@@ et @@dequantifier@@ de la leçon précédente. Écris @@quantifier_modele(model)@@ qui remplace chaque matrice de poids (tableau à 2 dimensions) par sa version quantifiée puis déquantifiée, laisse les biais intacts, et renvoie le nombre d'octets du modèle quantifié (1 octet par poids des matrices, 4 par biais).</p><p>Le test compare l'exactitude avant et après : la perte doit rester sous 2 points.</p>`,
      starter: CHIFFRES + QUANT + PY`

def quantifier_modele(model):
    return model.count_params() * 4
`,
      solution: CHIFFRES + QUANT + PY`

def quantifier_modele(model):
    nouveaux, octets = [], 0
    for w in model.get_weights():
        if w.ndim >= 2:
            nouveaux.append(dequantifier(*quantifier(w)))
            octets += w.size
        else:
            nouveaux.append(w)
            octets += w.size * 4
    model.set_weights(nouveaux)
    return octets
`,
      tests: PY`avant = model.evaluate(X_test, y_test, verbose=0)[1]
w_avant = model.get_weights()[0].copy()
octets = quantifier_modele(model)
apres = model.evaluate(X_test, y_test, verbose=0)[1]
print("octets :", octets, "contre", model.count_params() * 4, "en float32")
print("poids modifiés :", not np.array_equal(model.get_weights()[0], w_avant))
print("perte < 2 points :", avant - apres < 0.02)
`,
      expected: "octets : 5032 contre 19240 en float32\npoids modifiés : True\nperte < 2 points : True\n",
      hint: "Parcours model.get_weights() : si w.ndim >= 2, ajoute dequantifier(*quantifier(w)) et compte w.size octets ; sinon garde w et compte w.size * 4. Termine par model.set_weights(nouveaux)."
    }
  },
  {
    id: "dl-19", section: "TensorFlow Lite", title: "Inférence avec l'interpréteur LiteRT", xp: 80, theoryOnly: true,
    theory: `<p>Sur l'appareil, le fichier @@.tflite@@ est lu par l'<strong>interpréteur</strong>. Son API est la même en Python (Raspberry Pi, serveur), en Kotlin (Android) ou en C++ : on alloue les tenseurs, on écrit l'entrée, on lance @@invoke@@, on lit la sortie.</p>
~~~py tf
import numpy as np
import keras
from ai_edge_litert.interpreter import Interpreter

keras.utils.set_random_seed(0)
model = keras.Sequential([keras.Input(shape=(64,)), keras.layers.Dense(32, activation="relu"), keras.layers.Dense(10, activation="softmax")])
model.export("chiffres.tflite", format="litert")

interprete = Interpreter(model_path="chiffres.tflite")
interprete.allocate_tensors()
entree = interprete.get_input_details()[0]
sortie = interprete.get_output_details()[0]
print("entrée :", entree["shape"], entree["dtype"].__name__, " sortie :", sortie["shape"])

image = np.random.default_rng(1).random((1, 64), dtype=np.float32)
interprete.set_tensor(entree["index"], image)
interprete.invoke()
probas = interprete.get_tensor(sortie["index"])
print("chiffre prédit :", int(probas.argmax()))
print("identique à Keras :", np.allclose(probas, model.predict(image, verbose=0), atol=1e-5))
~~~
<p>Points pratiques :</p>
<ul><li>avec un modèle en quantification entière complète, l'entrée et la sortie sont souvent en int8 : on lit @@entree["quantization"]@@ (échelle, zéro) pour convertir ;</li><li>la taille du lot est fixe : @@resize_tensor_input@@ puis @@allocate_tensors@@ pour traiter plusieurs images ;</li><li>les <strong>délégués</strong> envoient le calcul vers le matériel : XNNPACK (processeur, par défaut), GPU, NPU ; la nouvelle API @@CompiledModel@@ de LiteRT les choisit automatiquement ;</li><li>on mesure la latence sur l'appareil réel avec l'outil @@benchmark_model@@, en conditions réelles (température, autres applications).</li></ul>`,
    setup: LAB,
    quiz: [
      { q: "Dans quel ordre utiliser l'interpréteur ?", options: ["invoke, set_tensor, allocate_tensors", "allocate_tensors, set_tensor (entrée), invoke, get_tensor (sortie)", "get_tensor puis invoke", "Il suffit d'appeler predict"], answer: 1, explain: "C'est le même enchaînement en Python, Kotlin et C++." },
      { q: "À quoi sert un délégué (delegate) ?", options: ["À convertir le modèle", "À exécuter tout ou partie du modèle sur un matériel spécialisé (GPU, NPU) au lieu du processeur", "À quantifier", "À entraîner sur l'appareil"], answer: 1, explain: "Les opérations non prises en charge retombent sur le processeur." }
    ]
  },
  {
    id: "dl-20", section: "TensorFlow Lite", title: "Téléphone, Raspberry Pi et microcontrôleur", xp: 70, theoryOnly: true,
    theory: `<p>Le même modèle peut finir sur trois familles d'appareils, aux contraintes très différentes :</p>
~~~text
                     mémoire        calcul                    moteur
Téléphone            Go             CPU, GPU, NPU             LiteRT (Kotlin, Swift), délégués GPU/NPU
Raspberry Pi 5       4 à 16 Go      CPU ARM 4 cœurs           ai-edge-litert en Python, XNNPACK
Microcontrôleur      256 Ko à 1 Mo  CPU sans OS, sans float   LiteRT for Microcontrollers (C++), int8 obligatoire
(ESP32-S3, Arduino Nano 33 BLE, STM32)
~~~
<p>Sur un <strong>microcontrôleur</strong>, il n'y a ni système de fichiers ni allocation dynamique : le modèle, quantifié en int8 et minuscule (quelques dizaines de Ko), est compilé dans le programme sous forme de tableau d'octets (@@xxd -i modele.tflite > modele.cc@@), et une zone mémoire fixe (l'<em>arena</em>) accueille les tenseurs. Les cas d'usage typiques : détection d'un mot-clé (« OK Google »), reconnaissance de gestes avec un accéléromètre, maintenance prédictive à partir des vibrations d'un moteur, détection de personnes avec une petite caméra.</p>
<p>Choisir la cible, c'est faire un budget : la taille du modèle doit tenir en mémoire, la latence doit respecter le besoin (30 images par seconde pour de la vidéo, quelques millisecondes pour un mot-clé), et la consommation compte sur batterie. On commence par une architecture conçue pour l'embarqué (MobileNet, EfficientNet-Lite), on quantifie, on mesure sur l'appareil, et on itère. L'étape suivante du parcours, le hardware et l'embarqué, reprendra ces cartes en pratique.</p>`,
    setup: `<p><strong>Sur ta machine</strong> : si tu as un Raspberry Pi, installe @@ai-edge-litert@@, copie le @@chiffres.tflite@@ de la leçon précédente et mesure le temps de 1 000 inférences avec @@time.perf_counter@@. Avec un ESP32-S3 ou un Arduino Nano 33 BLE Sense, l'exemple « hello_world » de LiteRT for Microcontrollers (une sinusoïde prédite par un minuscule réseau) est le meilleur point de départ.</p>`,
    quiz: [
      { q: "Pourquoi la quantification entière est-elle obligatoire sur la plupart des microcontrôleurs ?", options: ["Pour la sécurité", "Beaucoup n'ont pas d'unité de calcul flottant rapide et très peu de mémoire : l'int8 est 4 fois plus compact et rapide", "Parce que LiteRT l'impose partout", "Pour l'entraînement"], answer: 1, explain: "Et le modèle doit tenir dans quelques centaines de Ko avec le programme." },
      { q: "Comment le modèle arrive-t-il dans le programme d'un microcontrôleur sans système de fichiers ?", options: ["Par Wi-Fi à chaque démarrage", "Compilé dans le programme comme un tableau d'octets (xxd -i)", "Sur une carte SD obligatoire", "Il est réentraîné sur place"], answer: 1, explain: "Le fichier .tflite devient une constante C++ en mémoire flash." }
    ]
  }
];
