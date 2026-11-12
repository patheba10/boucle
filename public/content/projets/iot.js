/* Projets capstone de la roadmap Embarqué et IoT (US-10c #108). */
export default [
  {
    id: "pj-capteur-iot", roadmap: "iot", titre: "Station de mesure connectée sur batterie", niveau: "Intermédiaire", duree: "4 à 6 semaines",
    resume: "Un capteur environnemental autonome : firmware en C sans bibliothèque lourde, veille profonde, publication MQTT, autonomie calculée puis mesurée.",
    technos: ["ESP32 ou Raspberry Pi Pico W", "C (ESP-IDF ou SDK Pico)", "I2C", "BME280", "MQTT", "Wokwi", "KiCad"],
    contexte: `<p>Une serre veut suivre température, humidité et pression à plusieurs endroits, sans câbles ni changement de pile pendant au moins six mois. Le projet couvre toute la roadmap : dimensionnement électrique, C de bas niveau, bus I2C, gestion de l'énergie, communication et un vrai budget d'autonomie, vérifié par la mesure.</p>`,
    exigences: [
      "Le firmware en C : lecture du BME280 en I2C (pilote écrit à partir de la datasheet), mesure de la tension de batterie par l'ADC à travers un diviseur.",
      "Un cycle « réveil, mesure, envoi, veille profonde » piloté par une machine à états, sans delay() bloquant hors de la veille.",
      "La publication des mesures en MQTT (JSON avec horodatage), reconnexion automatique et mise en tampon des mesures si le réseau est absent.",
      "Un chien de garde actif et une remontée des erreurs (capteur absent, réseau indisponible) dans les messages.",
      "Un budget d'énergie écrit : courants actif et veille, durée de chaque phase, autonomie calculée ; puis la consommation réelle mesurée au multimètre.",
      "Une simulation Wokwi du montage dans le dépôt, et le schéma électrique dans KiCad (alimentation, découplage, diviseur, connecteur de programmation)."
    ],
    architecture: `pile Li-ion ──▶ LDO faible repos ──▶ microcontrôleur ──I2C──▶ BME280
         │                                   │
         └── diviseur ──▶ ADC                ├── Wi-Fi ──▶ broker MQTT ──▶ tableau de bord
                                             └── veille profonde ⟲ réveil par timer toutes les 10 min
   firmware : machine à états  RÉVEIL → MESURE → ENVOI → VEILLE  (+ chien de garde)`,
    jalons: [
      { id: "pilote", titre: "Pilote du capteur", livrables: ["Lecture des registres et compensation selon la datasheet", "Mesures validées contre une référence"] },
      { id: "energie", titre: "Cycle et énergie", livrables: ["Machine à états et veille profonde", "Budget d'énergie calculé, consommation mesurée en veille et en activité"] },
      { id: "reseau", titre: "Communication", livrables: ["Publication MQTT, reconnexion, tampon hors ligne", "Tableau de bord des mesures (Grafana, Node-RED ou équivalent)"] },
      { id: "materiel", titre: "Matériel", livrables: ["Simulation Wokwi et schéma KiCad avec ERC sans erreur", "Photos du montage réel et mesures à l'oscilloscope du bus I2C"] }
    ],
    criteres: [
      "L'autonomie calculée dépasse six mois, et l'écart avec la mesure est expliqué.",
      "Le courant en veille mesuré est inférieur à 100 µA (ou justifié par la carte utilisée).",
      "Une coupure réseau d'une heure ne fait perdre aucune mesure.",
      "Le capteur débranché produit un message d'erreur, pas un blocage : le chien de garde n'a jamais à intervenir en fonctionnement normal."
    ],
    extensions: ["Mise à jour du firmware à distance (OTA) signée.", "Passage à LoRaWAN pour la longue portée.", "Carte imprimée fabriquée et soudée."],
    lecons: ["el-05", "el-11", "em-09", "em-11", "em-12", "em-14"],
    liens: [["ESP-IDF", "https://docs.espressif.com/projects/esp-idf/"], ["MQTT", "https://mqtt.org/"]]
  },
  {
    id: "pj-tinyml-gestes", roadmap: "iot", titre: "Reconnaissance de gestes TinyML", niveau: "Avancé", duree: "4 à 5 semaines",
    resume: "Un accéléromètre, un petit réseau de neurones entraîné en Keras, quantifié en int8 et exécuté sur un microcontrôleur avec LiteRT for Microcontrollers.",
    technos: ["Keras", "LiteRT for Microcontrollers", "quantification int8", "C++", "accéléromètre", "ESP32-S3 ou Arduino Nano 33 BLE Sense"],
    contexte: `<p>Une télécommande sans boutons : trois gestes de la main (cercle, secousse, balayage) reconnus par la carte elle-même, sans connexion. Le projet est le pont exact entre le cours de deep learning et le cours de C embarqué : collecte de données, entraînement, quantification, et intégration dans un firmware à mémoire fixe.</p>`,
    exigences: [
      "Un firmware de collecte qui enregistre des fenêtres de 1 à 2 s de l'accéléromètre à fréquence fixe, envoyées sur la liaison série.",
      "Un jeu de données d'au moins 50 exemples par geste, plus une classe « rien », séparé en entraînement, validation et test par personne ou par séance.",
      "Un petit modèle Keras (moins de 20 000 paramètres) et un modèle de référence simple (seuils ou arbre de décision sur des caractéristiques calculées).",
      "La conversion en int8 complet avec un jeu représentatif, puis le tableau : exactitude, taille, temps d'inférence pour float32 et int8.",
      "L'intégration avec LiteRT for Microcontrollers : modèle en tableau d'octets, arène de mémoire fixe dimensionnée au plus juste.",
      "Une boucle temps réel : acquisition par interruption de timer dans un tampon circulaire, inférence glissante, LED ou message pour chaque geste reconnu."
    ],
    architecture: `accéléromètre ──I2C/SPI──▶ ISR timer (100 Hz) ──▶ tampon circulaire ──▶ fenêtre de 1,5 s
                                                                       │
                                     quantification des entrées (échelle, zéro) ──▶ MicroInterpreter (arène fixe)
                                                                       │
                                                         geste + confiance ──▶ LED, liaison série
   sur PC : collecte ──▶ Keras ──▶ LiteRT int8 ──▶ xxd -i ──▶ modele.cc`,
    jalons: [
      { id: "collecte", titre: "Collecte", livrables: ["Firmware de collecte, script de réception sur PC", "Jeu de données annoté et séparé"] },
      { id: "modele", titre: "Modèle", livrables: ["Référence simple et modèle Keras, matrice de confusion", "Conversion int8 et tableau comparatif"] },
      { id: "integration", titre: "Intégration", livrables: ["Modèle dans le firmware, arène dimensionnée", "Inférence mesurée sur la carte"] },
      { id: "temps-reel", titre: "Temps réel", livrables: ["Acquisition par interruption et tampon circulaire", "Démonstration filmée des trois gestes"] }
    ],
    criteres: [
      "Exactitude d'au moins 90 % sur le jeu de test, faite par une personne absente de l'entraînement si possible.",
      "Le modèle int8 tient dans moins de 50 Ko de flash et l'arène dans moins de 20 Ko de RAM.",
      "Une inférence prend moins de 50 ms sur la carte ; aucun échantillon perdu pendant l'inférence.",
      "Le modèle bat la référence simple, ou le README explique pourquoi elle suffit."
    ],
    extensions: ["Comparer avec CMSIS-NN activé.", "Envoyer les gestes reconnus en Bluetooth Low Energy."],
    lecons: ["dl-17", "dl-18", "dl-20", "em-10", "em-17"],
    liens: [["LiteRT (Google AI Edge)", "https://ai.google.dev/edge/litert"], ["Wokwi", "https://wokwi.com/"]]
  }
];
