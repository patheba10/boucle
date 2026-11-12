/* Projets capstone de la roadmap ML (US-10b #107). */
export default [
  {
    id: "pj-ml-api", roadmap: "ml", titre: "Du jeu de données à l'API de prédiction surveillée", niveau: "Intermédiaire", duree: "4 à 5 semaines",
    resume: "Un modèle évalué honnêtement, servi par une API conteneurisée, suivi dans MLflow et surveillé en production contre la dérive des données.",
    technos: ["pandas", "scikit-learn", "MLflow", "FastAPI", "Docker", "GitHub Actions", "pytest"],
    contexte: `<p>Une banque en ligne veut prédire le risque de défaut d'un demandeur de crédit, à partir d'un jeu de données public. Le recruteur ne veut pas voir seulement un notebook : il veut un modèle comparé à une référence simple, une métrique justifiée, une API qui répond en quelques millisecondes et un suivi de la dérive. C'est le parcours complet d'un ingénieur ML.</p>`,
    exigences: [
      "Un jeu de données public (par exemple « German Credit » ou « Give Me Some Credit »), exploré dans un notebook propre : valeurs manquantes, déséquilibre, fuites possibles.",
      "Un modèle de référence (régression logistique) et au moins deux modèles plus riches, comparés par validation croisée sur une métrique justifiée (AUC, rappel de la classe défaut).",
      "Un pipeline scikit-learn unique (prétraitement et modèle) : aucune fuite, le même objet sert à l'entraînement et en production.",
      "Les expériences suivies dans MLflow (paramètres, métriques, modèle) ; le modèle retenu versionné.",
      "Une API FastAPI @@POST /predire@@ validée par Pydantic, conteneurisée, avec tests pytest et CI.",
      "Un rapport de dérive comparant les données reçues par l'API aux données d'entraînement (par variable), avec un seuil d'alerte.",
      "Une fiche du modèle (model card) : données, métrique, limites, biais vérifiés entre groupes."
    ],
    architecture: `données brutes ──▶ notebook d'exploration ──▶ script d'entraînement (pipeline scikit-learn)
                                                         │ paramètres, métriques, modèle
                                                         ▼
                                                      MLflow
                                                         │ modèle retenu
                                                         ▼
   client ──▶ API FastAPI (Docker) ──▶ prédiction ──▶ journal des entrées ──▶ rapport de dérive hebdomadaire`,
    jalons: [
      { id: "exploration", titre: "Exploration", livrables: ["Notebook propre, conclusions écrites", "Choix de la métrique justifié par le coût des erreurs"] },
      { id: "modeles", titre: "Modèles", livrables: ["Référence et deux modèles comparés en validation croisée", "Suivi MLflow, modèle versionné"] },
      { id: "api", titre: "API", livrables: ["FastAPI, Pydantic, tests pytest, image Docker", "CI qui entraîne sur un échantillon et teste l'API"] },
      { id: "surveillance", titre: "Surveillance", livrables: ["Journal des entrées, rapport de dérive avec seuil", "Fiche du modèle publiée"] }
    ],
    criteres: [
      "Le meilleur modèle bat la référence sur la métrique choisie, avec un intervalle de validation croisée affiché.",
      "Le jeu de test n'est utilisé qu'une fois, à la fin, et son score est dans le README.",
      "L'API répond en moins de 50 ms au 95e centile sur une machine ordinaire.",
      "Une dérive simulée (une variable décalée) est détectée par le rapport."
    ],
    extensions: ["Réentraînement automatique déclenché par la dérive.", "Explicabilité des prédictions (valeurs SHAP).", "Déploiement sur un service managé."],
    lecons: ["sql-10", "api-04", "dl-15"],
    liens: [["MLflow", "https://mlflow.org/docs/latest/index.html"], ["Guide scikit-learn", "https://scikit-learn.org/stable/user_guide.html"]]
  },
  {
    id: "pj-vision-mobile", roadmap: "ml", titre: "Classifieur d'images pour mobile, de Keras à LiteRT", niveau: "Avancé", duree: "3 à 4 semaines",
    resume: "Un réseau convolutif entraîné par transfert, quantifié en int8 et exécuté sur téléphone ou Raspberry Pi, avec la perte de précision et la latence mesurées.",
    technos: ["TensorFlow", "Keras", "MobileNet", "LiteRT", "quantification int8", "Raspberry Pi ou Android"],
    contexte: `<p>Une coopérative agricole veut reconnaître trois maladies des feuilles directement sur un téléphone, sans connexion dans les champs. Le projet relie le deep learning et l'embarqué : transfert d'apprentissage, conversion, quantification, et mesure honnête de ce qu'on perd en précision contre ce qu'on gagne en taille et en vitesse.</p>`,
    exigences: [
      "Un jeu d'images public (par exemple PlantVillage) réduit à 3 ou 4 classes, séparé en entraînement, validation et test.",
      "Un modèle par transfert d'apprentissage depuis MobileNet, avec augmentation de données et arrêt précoce.",
      "La conversion en .tflite en float32, puis en int8 complet avec un jeu représentatif.",
      "Un tableau comparatif : exactitude, taille du fichier, latence d'inférence pour Keras, float32 et int8.",
      "Une démonstration sur un vrai appareil (Raspberry Pi avec ai-edge-litert, ou application Android) avec la latence mesurée sur l'appareil.",
      "Un notebook reproductible (Colab accepté) et un README avec les résultats."
    ],
    architecture: `images ──▶ augmentation ──▶ MobileNet gelé + tête entraînée ──▶ affinage
                                                        │
                                   TFLiteConverter (float32, puis int8 + jeu représentatif)
                                                        │
                                  modele_int8.tflite ──▶ appareil : interpréteur LiteRT ──▶ classe + latence`,
    jalons: [
      { id: "donnees", titre: "Données", livrables: ["Jeu réduit et séparé, classes équilibrées ou pondérées", "Augmentation de données visualisée"] },
      { id: "modele", titre: "Modèle", livrables: ["Transfert puis affinage, courbes d'entraînement", "Exactitude de test et matrice de confusion"] },
      { id: "conversion", titre: "Conversion et quantification", livrables: ["Fichiers float32 et int8", "Tableau exactitude, taille, latence"] },
      { id: "appareil", titre: "Sur l'appareil", livrables: ["Démonstration filmée ou captures", "Latence mesurée sur l'appareil, au 95e centile"] }
    ],
    criteres: [
      "Le modèle int8 perd moins de 2 points d'exactitude par rapport à Keras.",
      "Le modèle int8 est au moins 3 fois plus petit que le float32.",
      "L'inférence sur l'appareil prend moins de 100 ms par image.",
      "Tout se reproduit depuis le notebook et le README."
    ],
    extensions: ["Entraînement conscient de la quantification si la perte dépasse 2 points.", "Délégué GPU ou NPU sur Android et comparaison."],
    lecons: ["dl-14", "dl-17", "dl-18", "dl-19"],
    liens: [["LiteRT (Google AI Edge)", "https://ai.google.dev/edge/litert"], ["Keras : transfert d'apprentissage", "https://keras.io/guides/transfer_learning/"]]
  }
];
