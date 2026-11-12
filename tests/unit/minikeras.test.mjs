/* minikeras : le Keras en NumPy du navigateur. Gradients vérifiés par différences finies, API et noms comme Keras 3. */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const RUNNER = fileURLToPath(new URL("../../scripts/run_py.py", import.meta.url));
const py = (code) => JSON.parse(spawnSync("python3", [RUNNER], { input: JSON.stringify({ code, stdin: "" }), encoding: "utf8" }).stdout);

test("gradients de Dense (softmax), Conv2D (same) et MaxPooling2D : rétropropagation = différences finies", () => {
  const r = py(`import numpy as np
import keras
from keras import layers
keras.utils.set_random_seed(3)
import minikeras as mk
def verifier(model, x, y, perte):
    model.compile(optimizer="sgd", loss=perte)
    p = model._avant(x); _, d = mk._perte(perte, y, p)
    grads = []
    for l in reversed(model.layers):
        d, g = l.backward(d); grads.append((l, g))
    pire = 0.0
    for l, g in grads:
        for nom, G in g.items():
            W = l.params[nom]; idx = tuple(np.unravel_index(np.argmax(np.abs(G)), W.shape))
            W[idx] += 1e-6; lp = mk._perte(perte, y, model._avant(x))[0] + sum(c.penalite() for c in model.layers)
            W[idx] -= 2e-6; lm = mk._perte(perte, y, model._avant(x))[0] + sum(c.penalite() for c in model.layers); W[idx] += 1e-6
            pire = max(pire, abs((lp - lm) / 2e-6 - G[idx]) / max(1e-8, abs(G[idx])))
    return pire < 1e-4
rng = np.random.default_rng(0)
m1 = keras.Sequential([keras.Input(shape=(5,)), layers.Dense(4, activation="tanh"), layers.Dense(3, activation="softmax")])
print(verifier(m1, rng.normal(size=(6, 5)), keras.utils.to_categorical([0, 1, 2, 1, 0, 2], 3), "categorical_crossentropy"))
m2 = keras.Sequential([keras.Input(shape=(6, 6, 2)), layers.Conv2D(3, 3, activation="relu", padding="same"), layers.MaxPooling2D(2), layers.Flatten(), layers.Dense(1, activation="sigmoid")])
print(verifier(m2, rng.normal(size=(4, 6, 6, 2)), np.array([0, 1, 1, 0]), "binary_crossentropy"))
m3 = keras.Sequential([keras.Input(shape=(3,)), layers.Dense(2, kernel_regularizer=keras.regularizers.l2(0.1)), layers.Dense(1)])
print(verifier(m3, rng.normal(size=(5, 3)), rng.normal(size=(5, 1)), "mse"))`);
  assert.equal(r.err, null);
  assert.equal(r.out, "True\nTrue\nTrue\n");
});

test("API de Keras 3 : noms des couches, paramètres, formes, historique, arrêt précoce, erreurs", () => {
  const r = py(`import numpy as np
import tensorflow as tf
from tensorflow import keras
from keras import layers
print(tf.__version__.endswith("NumPy)"))
keras.utils.set_random_seed(0)
m = keras.Sequential([keras.Input(shape=(8, 8, 1)), layers.Conv2D(4, 3, activation="relu"), layers.MaxPooling2D(2), layers.Flatten(), layers.Dense(3, activation="softmax")])
print([l.name for l in m.layers], [l.count_params() for l in m.layers], m.output_shape)
X = np.random.default_rng(0).normal(size=(60, 8, 8, 1)); y = np.arange(60) % 3
try:
    m.fit(X, y)
except RuntimeError as e:
    print(e)
m.compile(optimizer="adam", loss="sparse_categorical_crossentropy", metrics=["accuracy"])
arret = keras.callbacks.EarlyStopping(patience=1, restore_best_weights=True)
h = m.fit(X, y, epochs=50, validation_split=0.25, verbose=0, callbacks=[arret])
print(sorted(h.history), round(m.evaluate(X[45:], y[45:], verbose=0)[0], 6) == round(min(h.history["val_loss"]), 6))
h2 = m.fit(X, y, epochs=50, verbose=0, callbacks=[keras.callbacks.EarlyStopping(monitor="loss", min_delta=10, patience=1)])
print(len(h2.history["loss"]))
print(m.predict(X[:2], verbose=0).sum(axis=1).round(6).tolist())
m.fit(X[:3], y[:3], epochs=1, verbose=1)`);
  assert.equal(r.err, null);
  assert.match(r.out, /^True\n\['conv2d', 'max_pooling2d', 'flatten', 'dense'\] \[40, 0, 0, 111\] \(None, 3\)\nYou must call `compile\(\)` before using the model\.\n\['accuracy', 'loss', 'val_accuracy', 'val_loss'\] True\n2\n\[1\.0, 1\.0\]\nEpoch 1\/1\n1\/1 ━+ accuracy: [0-9.]+ - loss: [0-9.]+\n$/);
});
