/* Cours « System design » (étape 8, US-9c #96) : la méthode d'entretien et les briques d'une architecture distribuée,
   chacune modélisée en Python pur et testée. */
import fondations from "./sysdesign/fondations.js";

export default {
  id: "sysdesign", route: "system-design", badge: "SD", name: "System design", tag: "Architecture · entretien", lang: "py",
  blurb: "Concevoir un service à grande échelle comme en entretien : exigences et estimations, répartiteurs de charge, caches, réplication et hachage cohérent, files de messages et idempotence, limitation de débit, disponibilité, et l'étude d'un raccourcisseur d'URL.",
  note: "Chaque brique est codée en Python et testée (cache LRU, anneau de hachage cohérent, seau à jetons…) : comprendre son fonctionnement interne permet de défendre ses choix au tableau. Le cours AWS montre les mêmes briques en service managé.",
  lessons: [...fondations]
};
