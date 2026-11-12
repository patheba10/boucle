"""Un petit Keras écrit en NumPy, pour le navigateur (TensorFlow n'existe pas dans Pyodide).

Il reprend l'API de Keras 3 pour les usages du cours : Sequential, Input, Dense, Dropout, Flatten, Conv2D,
MaxPooling2D, compile, fit, evaluate, predict, summary, EarlyStopping, SGD, Adam, régularisation L2.
Le harnais l'installe sous les noms « keras » et « tensorflow » quand le vrai TensorFlow est absent ;
la CI vérifie aussi chaque solution avec le vrai TensorFlow, pour que le code appris soit du vrai Keras.
"""
import re
import sys
import types

import numpy as np

_rng = np.random.default_rng()


def set_random_seed(seed):
    global _rng
    _rng = np.random.default_rng(seed)
    np.random.seed(seed)


# ---------------------------------------------------------------- activations
def _act(name):
    if name is None or callable(name):
        return name or "linear"
    if name not in ("linear", "relu", "sigmoid", "softmax", "tanh"):
        raise ValueError(f"Could not interpret activation function identifier: {name}")
    return name


def _forward_act(name, z):
    if name == "relu":
        return np.maximum(0, z)
    if name == "sigmoid":
        return 1 / (1 + np.exp(-np.clip(z, -60, 60)))
    if name == "tanh":
        return np.tanh(z)
    if name == "softmax":
        e = np.exp(z - z.max(axis=-1, keepdims=True))
        return e / e.sum(axis=-1, keepdims=True)
    return z


def _backward_act(name, z, a, da):
    if name == "relu":
        return da * (z > 0)
    if name == "sigmoid":
        return da * a * (1 - a)
    if name == "tanh":
        return da * (1 - a ** 2)
    if name == "softmax":
        return a * (da - np.sum(da * a, axis=-1, keepdims=True))
    return da


# ---------------------------------------------------------------- régularisation
class _L2:
    def __init__(self, l2=0.01):
        self.l2 = l2

    def penalite(self, w):
        return self.l2 * float(np.sum(w ** 2))

    def gradient(self, w):
        return 2 * self.l2 * w


regularizers = types.SimpleNamespace(l2=lambda l2=0.01: _L2(l2), L2=lambda l2=0.01: _L2(l2))


# ---------------------------------------------------------------- couches
class Layer:
    _compteur = {}

    def __init__(self, name=None):
        base = re.sub(r"(?<!^)(?=[A-Z])", "_", type(self).__name__).lower().replace("2_d", "2d")
        n = Layer._compteur.get(base, 0)
        Layer._compteur[base] = n + 1
        self.name = name or (base if n == 0 else f"{base}_{n}")
        self.params = {}
        self.built = False
        self.output_shape = None

    def build(self, input_shape):
        self.built = True
        self.output_shape = self.compute_output_shape(input_shape)

    def compute_output_shape(self, input_shape):
        return input_shape

    def count_params(self):
        return int(sum(p.size for p in self.params.values()))

    def get_weights(self):
        return [p.copy() for p in self.params.values()]

    def set_weights(self, weights):
        for k, w in zip(self.params, weights):
            self.params[k] = np.array(w, dtype=float)

    def penalite(self):
        return 0.0


class InputLayer:
    def __init__(self, shape):
        self.shape = tuple(shape)


def Input(shape=None, **_):
    return InputLayer(shape)


class Dense(Layer):
    def __init__(self, units, activation=None, kernel_regularizer=None, name=None, input_shape=None, **_):
        super().__init__(name)
        self.units = int(units)
        self.activation = _act(activation)
        self.reg = kernel_regularizer
        self.input_shape = input_shape

    def build(self, input_shape):
        n_in = input_shape[-1]
        limite = np.sqrt(6 / (n_in + self.units))  # glorot_uniform, comme Keras
        self.params = {"kernel": _rng.uniform(-limite, limite, (n_in, self.units)), "bias": np.zeros(self.units)}
        super().build(input_shape)

    def compute_output_shape(self, input_shape):
        return tuple(input_shape[:-1]) + (self.units,)

    def forward(self, x, training=False):
        self.x = x
        self.z = x @ self.params["kernel"] + self.params["bias"]
        self.a = _forward_act(self.activation, self.z)
        return self.a

    def backward(self, da):
        dz = _backward_act(self.activation, self.z, self.a, da)
        x2 = self.x.reshape(-1, self.x.shape[-1])
        dz2 = dz.reshape(-1, dz.shape[-1])
        g = {"kernel": x2.T @ dz2, "bias": dz2.sum(axis=0)}
        if self.reg is not None:
            g["kernel"] = g["kernel"] + self.reg.gradient(self.params["kernel"])
        return dz @ self.params["kernel"].T, g

    def penalite(self):
        return self.reg.penalite(self.params["kernel"]) if self.reg is not None else 0.0


class Dropout(Layer):
    def __init__(self, rate, name=None, **_):
        super().__init__(name)
        self.rate = float(rate)

    def forward(self, x, training=False):
        if not training or self.rate == 0:
            self.masque = None
            return x
        self.masque = (_rng.random(x.shape) >= self.rate) / (1 - self.rate)
        return x * self.masque

    def backward(self, da):
        return (da if self.masque is None else da * self.masque), {}


class Flatten(Layer):
    def compute_output_shape(self, input_shape):
        return (input_shape[0], int(np.prod(input_shape[1:])))

    def forward(self, x, training=False):
        self.forme = x.shape
        return x.reshape(x.shape[0], -1)

    def backward(self, da):
        return da.reshape(self.forme), {}


class Conv2D(Layer):
    """Convolution 2D, données (lot, hauteur, largeur, canaux), pas de 1, remplissage « valid » ou « same »."""

    def __init__(self, filters, kernel_size, activation=None, padding="valid", name=None, input_shape=None, **_):
        super().__init__(name)
        self.filters = int(filters)
        self.k = (kernel_size, kernel_size) if isinstance(kernel_size, int) else tuple(kernel_size)
        self.activation = _act(activation)
        self.padding = padding
        self.input_shape = input_shape

    def build(self, input_shape):
        c = input_shape[-1]
        kh, kw = self.k
        fan_in, fan_out = kh * kw * c, kh * kw * self.filters
        limite = np.sqrt(6 / (fan_in + fan_out))
        self.params = {"kernel": _rng.uniform(-limite, limite, (kh, kw, c, self.filters)), "bias": np.zeros(self.filters)}
        super().build(input_shape)

    def compute_output_shape(self, input_shape):
        n, h, w, _ = input_shape
        if self.padding == "same":
            return (n, h, w, self.filters)
        return (n, h - self.k[0] + 1, w - self.k[1] + 1, self.filters)

    def _pad(self, x):
        if self.padding != "same":
            return x
        kh, kw = self.k
        return np.pad(x, ((0, 0), ((kh - 1) // 2, kh // 2), ((kw - 1) // 2, kw // 2), (0, 0)))

    def forward(self, x, training=False):
        kh, kw = self.k
        xp = self._pad(x)
        self.xp_shape = xp.shape
        n, h, w, c = xp.shape
        oh, ow = h - kh + 1, w - kw + 1
        # im2col : chaque fenêtre devient une ligne
        cols = np.lib.stride_tricks.sliding_window_view(xp, (kh, kw), axis=(1, 2))  # n, oh, ow, c, kh, kw
        self.cols = cols.transpose(0, 1, 2, 4, 5, 3).reshape(n * oh * ow, kh * kw * c)
        self.z = (self.cols @ self.params["kernel"].reshape(-1, self.filters) + self.params["bias"]).reshape(n, oh, ow, self.filters)
        self.a = _forward_act(self.activation, self.z)
        return self.a

    def backward(self, da):
        kh, kw = self.k
        n, h, w, c = self.xp_shape
        dz = _backward_act(self.activation, self.z, self.a, da)
        dz2 = dz.reshape(-1, self.filters)
        g = {"kernel": (self.cols.T @ dz2).reshape(self.params["kernel"].shape), "bias": dz2.sum(axis=0)}
        dcols = (dz2 @ self.params["kernel"].reshape(-1, self.filters).T).reshape(n, h - kh + 1, w - kw + 1, kh, kw, c)
        dxp = np.zeros(self.xp_shape)
        for i in range(kh):
            for j in range(kw):
                dxp[:, i:i + h - kh + 1, j:j + w - kw + 1, :] += dcols[:, :, :, i, j, :]
        if self.padding == "same":
            dxp = dxp[:, (kh - 1) // 2: h - kh // 2, (kw - 1) // 2: w - kw // 2, :]
        return dxp, g


class MaxPooling2D(Layer):
    def __init__(self, pool_size=(2, 2), name=None, **_):
        super().__init__(name)
        self.p = (pool_size, pool_size) if isinstance(pool_size, int) else tuple(pool_size)

    def compute_output_shape(self, input_shape):
        n, h, w, c = input_shape
        return (n, h // self.p[0], w // self.p[1], c)

    def forward(self, x, training=False):
        ph, pw = self.p
        n, h, w, c = x.shape
        oh, ow = h // ph, w // pw
        xr = x[:, :oh * ph, :ow * pw, :].reshape(n, oh, ph, ow, pw, c)
        out = xr.max(axis=(2, 4))
        self.masque = xr == out[:, :, None, :, None, :]
        self.forme = x.shape
        return out

    def backward(self, da):
        ph, pw = self.p
        n, h, w, c = self.forme
        oh, ow = h // ph, w // pw
        d = (self.masque * da[:, :, None, :, None, :]).reshape(n, oh * ph, ow * pw, c)
        dx = np.zeros(self.forme)
        dx[:, :oh * ph, :ow * pw, :] = d
        return dx, {}


# ---------------------------------------------------------------- optimiseurs
class SGD:
    def __init__(self, learning_rate=0.01, momentum=0.0, **_):
        self.learning_rate, self.momentum, self.v = learning_rate, momentum, {}

    def step(self, cle, p, g):
        v = self.momentum * self.v.get(cle, 0) - self.learning_rate * g
        self.v[cle] = v
        return p + v


class Adam:
    def __init__(self, learning_rate=0.001, beta_1=0.9, beta_2=0.999, epsilon=1e-7, **_):
        self.learning_rate, self.b1, self.b2, self.eps = learning_rate, beta_1, beta_2, epsilon
        self.m, self.v, self.t = {}, {}, {}

    def step(self, cle, p, g):
        t = self.t.get(cle, 0) + 1
        self.t[cle] = t
        m = self.b1 * self.m.get(cle, 0) + (1 - self.b1) * g
        v = self.b2 * self.v.get(cle, 0) + (1 - self.b2) * g ** 2
        self.m[cle], self.v[cle] = m, v
        lr = self.learning_rate * np.sqrt(1 - self.b2 ** t) / (1 - self.b1 ** t)
        return p - lr * m / (np.sqrt(v) + self.eps)


class RMSprop:
    def __init__(self, learning_rate=0.001, rho=0.9, epsilon=1e-7, **_):
        self.learning_rate, self.rho, self.eps, self.v = learning_rate, rho, epsilon, {}

    def step(self, cle, p, g):
        v = self.rho * self.v.get(cle, 0) + (1 - self.rho) * g ** 2
        self.v[cle] = v
        return p - self.learning_rate * g / (np.sqrt(v) + self.eps)


def _optimiseur(o):
    if isinstance(o, str):
        noms = {"sgd": SGD, "adam": Adam, "rmsprop": RMSprop}
        if o.lower() not in noms:
            raise ValueError(f"Could not interpret optimizer identifier: {o}")
        return noms[o.lower()]()
    return o


# ---------------------------------------------------------------- pertes et métriques
EPS = 1e-7


def _perte(nom, y, p):
    """Renvoie (valeur moyenne, gradient par rapport à p)."""
    n = p.shape[0]
    if nom in ("mse", "mean_squared_error"):
        y = y.reshape(p.shape)
        return float(np.mean((p - y) ** 2)), 2 * (p - y) / p.size
    if nom in ("mae", "mean_absolute_error"):
        y = y.reshape(p.shape)
        return float(np.mean(np.abs(p - y))), np.sign(p - y) / p.size
    pc = np.clip(p, EPS, 1 - EPS)
    if nom == "binary_crossentropy":
        y = y.reshape(p.shape)
        return float(np.mean(-(y * np.log(pc) + (1 - y) * np.log(1 - pc)))), (pc - y) / (pc * (1 - pc)) / p.size
    if nom == "categorical_crossentropy":
        return float(np.mean(-np.sum(y * np.log(pc), axis=1))), -y / pc / n
    if nom == "sparse_categorical_crossentropy":
        yi = y.astype(int).reshape(-1)
        Y = np.zeros_like(p)
        Y[np.arange(n), yi] = 1
        return float(np.mean(-np.log(pc[np.arange(n), yi]))), -Y / pc / n
    raise ValueError(f"Could not interpret loss identifier: {nom}")


def _metrique(nom, perte, y, p):
    if nom in ("accuracy", "acc"):
        if perte == "binary_crossentropy" or p.shape[-1] == 1:
            return float(np.mean((p.reshape(-1) > 0.5) == (y.reshape(-1) > 0.5)))
        if perte == "sparse_categorical_crossentropy":
            return float(np.mean(np.argmax(p, axis=1) == y.reshape(-1).astype(int)))
        return float(np.mean(np.argmax(p, axis=1) == np.argmax(y, axis=1)))
    if nom in ("mae", "mean_absolute_error"):
        return float(np.mean(np.abs(p - y.reshape(p.shape))))
    if nom in ("mse", "mean_squared_error"):
        return float(np.mean((p - y.reshape(p.shape)) ** 2))
    raise ValueError(f"Could not interpret metric identifier: {nom}")


# ---------------------------------------------------------------- rappels
class Callback:
    def set_model(self, model):
        self.model = model

    def on_train_begin(self, logs=None):
        pass

    def on_epoch_end(self, epoch, logs=None):
        pass

    def on_train_end(self, logs=None):
        pass


class EarlyStopping(Callback):
    def __init__(self, monitor="val_loss", patience=0, min_delta=0.0, restore_best_weights=False, mode="auto", verbose=0, **_):
        self.monitor, self.patience, self.min_delta = monitor, patience, abs(min_delta)
        self.restore = restore_best_weights
        self.plus_grand = mode == "max" or (mode == "auto" and "acc" in monitor)

    def on_train_begin(self, logs=None):
        self.meilleur, self.attente, self.poids, self.stopped_epoch, self.best_epoch = None, 0, None, 0, 0

    def on_epoch_end(self, epoch, logs=None):
        v = (logs or {}).get(self.monitor)
        if v is None:
            return
        mieux = self.meilleur is None or (v > self.meilleur + self.min_delta if self.plus_grand else v < self.meilleur - self.min_delta)
        if mieux:
            self.meilleur, self.attente, self.best_epoch = v, 0, epoch
            if self.restore:
                self.poids = self.model.get_weights()
        else:
            self.attente += 1
            if self.attente >= self.patience:
                self.stopped_epoch = epoch
                self.model.stop_training = True
                if self.restore and self.poids is not None:
                    self.model.set_weights(self.poids)


class History(Callback):
    def __init__(self):
        self.history, self.epoch = {}, []


# ---------------------------------------------------------------- modèle
class Sequential:
    def __init__(self, layers=None, name="sequential"):
        self.name = name
        self.layers, self.forme_entree, self.compile_ok, self.stop_training = [], None, False, False
        for l in layers or []:
            self.add(l)

    def add(self, layer):
        if isinstance(layer, InputLayer):
            self.forme_entree = (None,) + layer.shape
            return
        if not self.layers and getattr(layer, "input_shape", None) and self.forme_entree is None:
            self.forme_entree = (None,) + tuple(layer.input_shape)
        self.layers.append(layer)
        if self.forme_entree is not None:
            self._construire()

    def _construire(self):
        forme = self.forme_entree
        for l in self.layers:
            if not l.built:
                l.build(forme)
            forme = l.output_shape

    def build(self, input_shape=None):
        if input_shape is not None:
            self.forme_entree = (None,) + tuple(input_shape[1:])
        self._construire()

    @property
    def output_shape(self):
        return self.layers[-1].output_shape

    def compile(self, optimizer="rmsprop", loss=None, metrics=None, **_):
        self.optimizer = _optimiseur(optimizer)
        self.loss = loss
        self.metrics = list(metrics or [])
        self.compile_ok = True

    def _avant(self, x, training=False):
        for l in self.layers:
            x = l.forward(x, training)
        return x

    def __call__(self, x, training=False):
        return self._avant(np.asarray(x, dtype=float), training)

    def count_params(self):
        return int(sum(l.count_params() for l in self.layers))

    def get_weights(self):
        return [w for l in self.layers for w in l.get_weights()]

    def set_weights(self, poids):
        i = 0
        for l in self.layers:
            n = len(l.params)
            l.set_weights(poids[i:i + n])
            i += n

    def _verifier(self, x):
        if self.forme_entree is None:
            self.forme_entree = (None,) + tuple(x.shape[1:])
            self._construire()
        if not self.compile_ok:
            raise RuntimeError("You must call `compile()` before using the model.")

    def _mesures(self, x, y, batch_size=256):
        p = np.concatenate([self._avant(x[i:i + batch_size]) for i in range(0, len(x), batch_size)])
        res = {"loss": _perte(self.loss, y, p)[0] + sum(l.penalite() for l in self.layers)}
        for m in self.metrics:
            res[m if m != "acc" else "accuracy"] = _metrique(m, self.loss, y, p)
        return res

    def fit(self, x, y, batch_size=32, epochs=1, verbose="auto", callbacks=None, validation_split=0.0, validation_data=None, shuffle=True, **_):
        x, y = np.asarray(x, dtype=float), np.asarray(y, dtype=float)
        self._verifier(x)
        if validation_split and validation_data is None:
            coupe = int(len(x) * (1 - validation_split))
            x, y, validation_data = x[:coupe], y[:coupe], (x[coupe:], y[coupe:])
        hist = History()
        hist.set_model(self)
        cbs = list(callbacks or [])
        for cb in cbs:
            cb.set_model(self)
            cb.on_train_begin()
        self.stop_training = False
        etapes = int(np.ceil(len(x) / batch_size))
        for epoque in range(epochs):
            ordre = _rng.permutation(len(x)) if shuffle else np.arange(len(x))
            for debut in range(0, len(x), batch_size):
                i = ordre[debut:debut + batch_size]
                p = self._avant(x[i], training=True)
                _, d = _perte(self.loss, y[i], p)
                for k, l in reversed(list(enumerate(self.layers))):
                    d, grads = l.backward(d)
                    for nom, g in grads.items():
                        l.params[nom] = self.optimizer.step((k, nom), l.params[nom], g)
            logs = self._mesures(x, y)
            if validation_data is not None:
                vx, vy = np.asarray(validation_data[0], dtype=float), np.asarray(validation_data[1], dtype=float)
                logs.update({"val_" + k: v for k, v in self._mesures(vx, vy).items()})
            hist.epoch.append(epoque)
            for k, v in logs.items():
                hist.history.setdefault(k, []).append(v)
            if verbose not in (0, False):
                print(f"Epoch {epoque + 1}/{epochs}")
                print(f"{etapes}/{etapes} ━━━━━━━━━━━━━━━━━━━━ " + " - ".join(f"{k}: {v:.4f}" for k, v in sorted(logs.items(), key=lambda kv: (kv[0].startswith("val_"), kv[0]))))
            for cb in cbs:
                cb.on_epoch_end(epoque, logs)
            if self.stop_training:
                break
        for cb in cbs:
            cb.on_train_end()
        self.history = hist
        return hist

    def evaluate(self, x, y, batch_size=32, verbose="auto", return_dict=False, **_):
        x, y = np.asarray(x, dtype=float), np.asarray(y, dtype=float)
        self._verifier(x)
        res = self._mesures(x, y)
        if return_dict:
            return res
        return res["loss"] if len(res) == 1 else [res["loss"]] + [v for k, v in res.items() if k != "loss"]

    def predict(self, x, batch_size=32, verbose="auto", **_):
        x = np.asarray(x, dtype=float)
        if self.forme_entree is None:
            self.forme_entree = (None,) + tuple(x.shape[1:])
            self._construire()
        return np.concatenate([self._avant(x[i:i + batch_size]) for i in range(0, len(x), batch_size)])

    def summary(self):
        lignes = [(f"{l.name} ({type(l).__name__})", str(l.output_shape), str(l.count_params())) for l in self.layers]
        w = [max(len(a[i]) for a in lignes + [("Layer (type)", "Output Shape", "Param #")]) + 2 for i in range(3)]
        print(f'Model: "{self.name}"')
        print("┏" + "┳".join("━" * x for x in w) + "┓")
        print("┃" + "┃".join(f" {t:<{x - 1}}" for t, x in zip(("Layer (type)", "Output Shape", "Param #"), w)) + "┃")
        print("┡" + "╇".join("━" * x for x in w) + "┩")
        for a in lignes:
            print("│" + "│".join(f" {t:<{x - 1}}" for t, x in zip(a, w)) + "│")
        print("└" + "┴".join("─" * x for x in w) + "┘")
        print(f" Total params: {self.count_params()}")


def to_categorical(y, num_classes=None):
    y = np.asarray(y, dtype=int).reshape(-1)
    n = num_classes or int(y.max()) + 1
    return np.eye(n)[y]


# ---------------------------------------------------------------- installation sous les noms keras et tensorflow
def installer():
    keras = types.ModuleType("keras")
    keras.__version__ = "3 (Boucle, NumPy)"
    keras.Sequential, keras.Input, keras.regularizers = Sequential, Input, regularizers
    keras.layers = types.ModuleType("keras.layers")
    for c in (Dense, Dropout, Flatten, Conv2D, MaxPooling2D, InputLayer, Layer):
        setattr(keras.layers, c.__name__, c)
    keras.layers.Input = Input
    keras.optimizers = types.ModuleType("keras.optimizers")
    keras.optimizers.SGD, keras.optimizers.Adam, keras.optimizers.RMSprop = SGD, Adam, RMSprop
    keras.callbacks = types.ModuleType("keras.callbacks")
    keras.callbacks.EarlyStopping, keras.callbacks.Callback, keras.callbacks.History = EarlyStopping, Callback, History
    keras.models = types.ModuleType("keras.models")
    keras.models.Sequential = Sequential
    keras.utils = types.ModuleType("keras.utils")
    keras.utils.set_random_seed, keras.utils.to_categorical = set_random_seed, to_categorical
    tf = types.ModuleType("tensorflow")
    tf.__version__ = "2 (Boucle, NumPy)"
    tf.keras = keras
    tf.random = types.SimpleNamespace(set_seed=set_random_seed)
    mods = {"keras": keras, "tensorflow": tf, "tensorflow.keras": keras}
    for nom in ("layers", "optimizers", "callbacks", "models", "utils", "regularizers"):
        mods["keras." + nom] = getattr(keras, nom) if nom != "regularizers" else types.SimpleNamespace(**vars(regularizers))
        mods["tensorflow.keras." + nom] = mods["keras." + nom]
    keras.regularizers = mods["keras.regularizers"]
    sys.modules.update(mods)
