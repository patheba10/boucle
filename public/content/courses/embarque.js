/* Cours « C embarqué » (étape 7, US-8c #84) : le C des microcontrôleurs. Les programmes tournent dans le navigateur
   avec minic (assets/py/minic.py) sur un microcontrôleur simulé (assets/py/mcu.h), et sont compilés par gcc en CI. */
import langage from "./embarque/langage.js";
import peripheriques from "./embarque/peripheriques.js";

export default {
  id: "embarque", route: "embarque", badge: "C", name: "C embarqué", tag: "Registres · interruptions · bus", lang: "c",
  blurb: "Programmer un microcontrôleur en C : types à largeur fixe, masques de bits, pointeurs, registres mappés en mémoire et volatile, GPIO et anti-rebond, timers et interruptions, PWM, ADC, UART et tampon circulaire, I2C et SPI, ordonnancement et FreeRTOS.",
  note: "Le code tourne dans ton navigateur sur un microcontrôleur simulé, inspiré des STM32 (mcu.h). Chaque exemple et chaque solution est aussi compilé par gcc pour garantir que c'est du vrai C.",
  lessons: [...langage, ...peripheriques]
};
