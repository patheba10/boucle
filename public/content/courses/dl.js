/* Cours « Deep learning » (étape 6). Chapitres 1 et 2 (US-7a #73) : les réseaux de neurones écrits à la main avec
   NumPy ; chapitre 3 (US-7b #74) : Keras, exécuté par minikeras dans le navigateur et vérifié avec le vrai TensorFlow en CI ; chapitre 4 (US-7c #75) : TensorFlow Lite (LiteRT), la quantification et l'embarqué. */
import neurones from "./dl/neurones.js";
import reseaux from "./dl/reseaux.js";
import keras from "./dl/keras.js";
import litert from "./dl/litert.js";

export default {
  id: "dl", route: "dl", badge: "DL", name: "Deep learning", tag: "NumPy · TensorFlow", lang: "py",
  blurb: "Comprendre les réseaux de neurones de l'intérieur : neurone, activations, pertes, descente de gradient et rétropropagation codées avec NumPy, jusqu'à un réseau qui lit des chiffres manuscrits. Puis TensorFlow, Keras et TensorFlow Lite.",
  note: "Les deux premiers chapitres n'utilisent que NumPy, dans ton navigateur : tu écris toi-même ce que TensorFlow fera ensuite à ta place. Les résultats sont reproductibles (graines fixées).",
  // L'entretien (dl-09) reste en fin de cours, après Keras et LiteRT.
  lessons: [...neurones, ...reseaux.filter((l) => l.id !== "dl-09"), ...keras, ...litert, ...reseaux.filter((l) => l.id === "dl-09")]
};
