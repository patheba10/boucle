/* Cours « Deep learning » (étape 6). Chapitres 1 et 2 (US-7a #73) : les réseaux de neurones écrits à la main avec
   NumPy, dans le navigateur ; TensorFlow et Keras (#74) puis TensorFlow Lite (#75) suivront. */
import neurones from "./dl/neurones.js";
import reseaux from "./dl/reseaux.js";

export default {
  id: "dl", route: "dl", badge: "DL", name: "Deep learning", tag: "NumPy · TensorFlow", lang: "py",
  blurb: "Comprendre les réseaux de neurones de l'intérieur : neurone, activations, pertes, descente de gradient et rétropropagation codées avec NumPy, jusqu'à un réseau qui lit des chiffres manuscrits. Puis TensorFlow, Keras et TensorFlow Lite.",
  note: "Les deux premiers chapitres n'utilisent que NumPy, dans ton navigateur : tu écris toi-même ce que TensorFlow fera ensuite à ta place. Les résultats sont reproductibles (graines fixées).",
  lessons: [...neurones, ...reseaux]
};
