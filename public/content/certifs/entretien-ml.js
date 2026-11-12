/* Entretien blanc ML et MLOps : questions originales dans le style des entretiens techniques. */
const Q = (id, d, q, options, answer, explain) => ({ id, d, q, options, answer, explain });

const bases = [
  Q("b01", "bases", "Un modèle atteint 99 % d'exactitude pour détecter une fraude qui touche 1 % des transactions. Qu'en penses-tu ?", ["Rien de rassurant : prédire « pas de fraude » partout donne aussi 99 % ; il faut regarder précision, rappel et la courbe PR", "Le modèle est excellent", "Il faut plus d'époques", "L'exactitude est la seule métrique utile"], 0, "Sur des classes déséquilibrées, l'exactitude trompe ; le rappel sur la classe rare compte souvent le plus."),
  Q("b02", "bases", "Erreur d'entraînement faible, erreur de validation élevée. Diagnostic et remèdes ?", ["Surapprentissage : plus de données, régularisation, modèle plus simple, arrêt précoce", "Sous-apprentissage : modèle plus gros", "Fuite de données", "Mauvais taux d'apprentissage seulement"], 0, "Le sous-apprentissage montre au contraire deux erreurs élevées."),
  Q("b03", "bases", "Qu'est-ce qu'une fuite de données (data leakage) ?", ["Une information indisponible au moment de la prédiction réelle se retrouve dans les données d'entraînement, ce qui gonfle les scores", "Une base de données piratée", "Des valeurs manquantes", "Un modèle trop lent"], 0, "Exemples : normaliser avant de séparer train et test, une colonne calculée après l'événement à prédire."),
  Q("b04", "bases", "Pourquoi utiliser la validation croisée ?", ["Pour estimer la performance de façon plus fiable en évaluant sur plusieurs découpages des données", "Pour entraîner plus vite", "Pour augmenter les données", "Pour remplacer le jeu de test final"], 0, "Le jeu de test reste mis de côté pour une évaluation unique à la fin."),
  Q("b05", "bases", "Quand préférer un modèle à base d'arbres (gradient boosting) à un réseau de neurones ?", ["Sur des données tabulaires de taille modeste : souvent plus précis, plus rapide et plus simple à régler", "Jamais", "Pour les images", "Pour le texte libre"], 0, "Les réseaux de neurones dominent sur les images, le son et le texte ; sur les tableaux, le boosting reste une référence.")
];

const deep = [
  Q("d01", "deep", "Pourquoi faut-il une activation non linéaire entre les couches ?", ["Sans elle, l'empilement de couches linéaires reste une seule transformation linéaire", "Pour accélérer le calcul", "Pour normaliser les entrées", "Pour éviter le surapprentissage"], 0, "La non-linéarité donne au réseau sa capacité à représenter des frontières complexes."),
  Q("d02", "deep", "La perte devient NaN après quelques itérations. Causes probables ?", ["Taux d'apprentissage trop élevé, explosion du gradient ou division par zéro et log de zéro dans la perte", "Trop de données", "Un jeu de validation trop petit", "Une graine aléatoire fixée"], 0, "Remèdes : baisser le taux, écrêter le gradient, une perte numériquement stable (softmax et entropie croisée combinées)."),
  Q("d03", "deep", "À quoi sert l'apprentissage par transfert ?", ["Réutiliser un modèle pré-entraîné sur de grandes données et l'adapter à une petite tâche, avec moins de données et de calcul", "Transférer un modèle d'un serveur à un autre", "Convertir un modèle en LiteRT", "Changer de framework"], 0, "On gèle souvent les premières couches et on réentraîne la tête, puis on affine éventuellement le reste."),
  Q("d04", "deep", "Que fait le dropout pendant l'entraînement et pendant l'inférence ?", ["Il éteint aléatoirement des neurones à l'entraînement ; à l'inférence, tout est actif", "Il supprime des données", "Il éteint des neurones aussi à l'inférence", "Il réduit le taux d'apprentissage"], 0, "C'est une régularisation : le réseau ne peut pas s'appuyer sur quelques neurones."),
  Q("d05", "deep", "Pourquoi quantifier un modèle en int8 pour un téléphone ?", ["Il devient environ 4 fois plus petit et plus rapide, au prix d'une légère perte de précision qu'on mesure", "Pour le rendre plus précis", "Pour l'entraîner sur l'appareil", "Pour le chiffrer"], 0, "On vérifie toujours la perte d'exactitude sur le jeu de test après conversion.")
];

const mlops = [
  Q("m01", "mlops", "Un modèle performant en test se dégrade en production au fil des mois. Pourquoi, et que mettre en place ?", ["La distribution des données change (dérive) : surveiller les entrées et les prédictions, et réentraîner périodiquement", "Le serveur vieillit", "Les poids se corrompent", "Rien à faire"], 0, "On compare les distributions de production à celles d'entraînement, et on mesure la performance dès que les vraies étiquettes arrivent."),
  Q("m02", "mlops", "Que doit-on versionner pour pouvoir reproduire un modèle ?", ["Le code, les données (ou leur empreinte), les hyperparamètres, l'environnement et le modèle produit", "Seulement le code", "Seulement le modèle", "Seulement les données"], 0, "Des outils comme MLflow et DVC suivent ces éléments ensemble."),
  Q("m03", "mlops", "Comment servir un modèle en API avec une latence faible ?", ["Charger le modèle une fois au démarrage, pas à chaque requête ; regrouper les requêtes si possible ; conteneuriser et monter en charge horizontalement", "Recharger le modèle à chaque requête", "Entraîner à chaque requête", "Servir depuis un notebook"], 0, "Le chargement d'un modèle coûte souvent des centaines de millisecondes."),
  Q("m04", "mlops", "Qu'est-ce qu'un déploiement en mode ombre (shadow) d'un nouveau modèle ?", ["Le nouveau modèle reçoit le trafic réel en parallèle, mais ses prédictions ne sont pas utilisées : on compare sans risque", "Un déploiement de nuit", "Un modèle sans journalisation", "Un test A/B sur 50 % des utilisateurs"], 0, "Ensuite vient souvent un canary, puis un test A/B qui mesure l'impact métier."),
  Q("m05", "mlops", "Pourquoi le prétraitement doit-il être identique à l'entraînement et en production ?", ["Sinon le modèle reçoit en production des entrées différentes de celles qu'il a apprises (training-serving skew)", "Pour aller plus vite", "Ce n'est pas nécessaire", "Pour réduire la taille du modèle"], 0, "On empaquette le prétraitement avec le modèle (pipeline scikit-learn, couches Keras de prétraitement).")
];

const data = [
  Q("s01", "data", "Une colonne a 40 % de valeurs manquantes. Que faire ?", ["Comprendre pourquoi elles manquent, puis imputer, ajouter un indicateur de manque ou abandonner la colonne selon le cas", "Supprimer toutes les lignes incomplètes", "Remplacer par 0 sans réfléchir", "Ignorer, le modèle s'adaptera"], 0, "Le fait même qu'une valeur manque peut être une information utile."),
  Q("s02", "data", "Pourquoi normaliser les variables pour une régression logistique ou un réseau de neurones ?", ["Des échelles très différentes ralentissent ou déstabilisent l'optimisation par gradient", "Pour réduire le nombre de lignes", "Pour éviter les doublons", "Les arbres de décision l'exigent"], 0, "Les arbres, eux, sont insensibles à l'échelle des variables."),
  Q("s03", "data", "Comment encoder une variable catégorielle à 50 000 valeurs (un identifiant de produit) ?", ["Pas en one-hot brut : regrouper les valeurs rares, encodage par fréquence ou par cible avec validation, ou un plongement (embedding)", "En one-hot, toujours", "En entier de 1 à 50 000", "La supprimer obligatoirement"], 0, "Un entier arbitraire inventerait un ordre qui n'existe pas."),
  Q("s04", "data", "Quelle requête SQL trouve les doublons d'e-mail dans une table clients ?", ["SELECT courriel, COUNT(*) FROM clients GROUP BY courriel HAVING COUNT(*) > 1", "SELECT DISTINCT courriel FROM clients", "SELECT * FROM clients WHERE courriel = courriel", "SELECT COUNT(courriel) FROM clients"], 0, "HAVING filtre après le regroupement ; WHERE, avant."),
  Q("s05", "data", "Un jeu de données de séries temporelles doit être séparé en entraînement et test. Comment ?", ["Selon le temps : entraînement sur le passé, test sur la période suivante, jamais un mélange aléatoire", "Mélange aléatoire classique", "Un jour sur deux", "Par ordre alphabétique"], 0, "Un mélange aléatoire laisse le modèle voir le futur : c'est une fuite.")
];

export default {
  id: "entretien-ml", kind: "entretien", code: "ENTRETIEN ML", name: "Entretien technique ML et MLOps",
  minutes: 25, count: 16, passing: 700,
  intro: "Métriques et validation, deep learning, mise en production et surveillance des modèles, données et SQL : les questions d'un entretien de data scientist ou d'ingénieur ML.",
  about: "20 questions originales dans le style des entretiens ML et MLOps. L'entretien blanc en tire 16 en 25 minutes. Pour chaque réponse, entraîne-toi aussi à donner un exemple tiré des cours Data, Deep learning ou SQL de Boucle.",
  domains: [
    { id: "bases", name: "Apprentissage automatique", weight: 25 },
    { id: "deep", name: "Deep learning", weight: 25 },
    { id: "mlops", name: "MLOps et production", weight: 25 },
    { id: "data", name: "Données et SQL", weight: 25 }
  ],
  tips: `<ul><li>Commence toujours par la métrique qui compte pour le métier, pas par l'algorithme.</li><li>Cite les pièges que tu sais éviter : fuite de données, classes déséquilibrées, dérive en production.</li><li>Un modèle simple bien évalué impressionne plus qu'un modèle complexe mal validé.</li></ul>`,
  bank: [...bases, ...deep, ...mlops, ...data]
};
