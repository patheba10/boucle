/* Cours « Électronique » (étape 7, US-8a #82) : du courant au transistor. Python pur dans le navigateur. */
import bases from "./elec/bases.js";
import composants from "./elec/composants.js";

export default {
  id: "elec", route: "electronique", badge: "EL", name: "Électronique", tag: "Circuits · composants", lang: "py",
  blurb: "Les bases du hardware pour l'embarqué : loi d'Ohm, puissance, Kirchhoff, diviseurs et ADC, condensateurs, LED, transistors et MOSFET, ampli-op, alimentations et autonomie sur batterie. Chaque défi dimensionne un vrai circuit.",
  note: "Les défis calculent en Python des circuits réels, avec les valeurs normalisées du commerce. Pour voir les courants circuler, refais chaque montage dans le simulateur gratuit Falstad, puis sur une plaque d'essai.",
  lessons: [...bases, ...composants]
};
