/* Entretien blanc embarqué et firmware : questions originales dans le style des entretiens techniques. */
const Q = (id, d, q, options, answer, explain) => ({ id, d, q, options, answer, explain });

const langage = [
  Q("c01", "langage", "Que garantit le mot-clé volatile ?", ["Chaque accès lit ou écrit réellement la mémoire, sans optimisation du compilateur ; il ne rend pas l'accès atomique", "L'accès est atomique", "La variable est en mémoire flash", "La variable est protégée contre les interruptions"], 0, "Indispensable pour les registres et les variables partagées avec une ISR."),
  Q("c02", "langage", "Que vaut l'expression (uint8_t)(200 + 100) ?", ["44", "300", "255", "Un comportement indéfini"], 0, "La conversion en non signé de 8 bits se fait modulo 256 : 300 − 256 = 44."),
  Q("c03", "langage", "Pourquoi écrire 1u << 31 plutôt que 1 << 31 ?", ["1 est un int signé : le décaler dans le bit de signe est un comportement indéfini", "C'est plus rapide", "1u est plus court", "Aucune différence"], 0, "Avec un non signé, le résultat 0x80000000 est bien défini."),
  Q("c04", "langage", "Une variable locale static dans une fonction :", ["Garde sa valeur entre les appels et vit en zone statique, pas sur la pile", "Est recréée à chaque appel", "Est visible dans tous les fichiers", "Est placée dans un registre"], 0, "static sur une globale ou une fonction limite en plus sa visibilité au fichier."),
  Q("c05", "langage", "Comment savoir si une machine est petit-boutiste (little-endian) en C ?", ["uint32_t x = 1 ; puis lire le premier octet avec *(uint8_t *)&x : il vaut 1 en petit-boutiste", "sizeof(int) == 4", "Avec printf(\"%p\")", "Impossible en C"], 0, "ARM et x86 sont petit-boutistes ; les protocoles réseau envoient le poids fort en premier.")
];

const peripheriques = [
  Q("p01", "peripheriques", "Une ISR de timer incrémente un compteur. Quelles règles respecter ?", ["Rester courte, acquitter le drapeau d'interruption, déclarer le compteur volatile, ne pas appeler printf ni attendre", "Faire tout le traitement dans l'ISR", "Utiliser malloc pour stocker les mesures", "Désactiver le timer à chaque fois"], 0, "Le traitement lourd se fait dans la boucle principale ou une tâche."),
  Q("p02", "peripheriques", "À 16 MHz, un timer avec PSC = 15 999 et ARR = 999 déborde :", ["Une fois par seconde", "Mille fois par seconde", "Seize fois par seconde", "Toutes les 16 secondes"], 0, "16 000 000 / (16 000 × 1 000) = 1 Hz."),
  Q("p03", "peripheriques", "Un bouton compte parfois deux appuis pour un seul. Cause et remède ?", ["Les rebonds mécaniques : valider le changement après plusieurs lectures stables, ou un filtre RC", "Le pull-up est trop fort", "Le processeur est trop lent", "Un bogue du compilateur"], 0, "L'anti-rebond logiciel ne bloque pas le programme s'il est écrit en machine à états."),
  Q("p04", "peripheriques", "Pourquoi un tampon circulaire entre l'ISR de réception UART et le programme principal ?", ["L'ISR range l'octet immédiatement ; le programme le traite plus tard, sans allocation ni perte tant que le tampon n'est pas plein", "Pour chiffrer les données", "Pour aller plus vite que le débit UART", "Parce que l'UART l'exige"], 0, "Avec un seul producteur et un seul consommateur, il fonctionne sans verrou."),
  Q("p05", "peripheriques", "Polling, interruption ou DMA pour lire un ADC à 100 000 échantillons par seconde ?", ["Le DMA : il copie les échantillons en mémoire sans occuper le processeur", "Le polling", "Une interruption par échantillon", "Un printf par échantillon"], 0, "100 000 interruptions par seconde saturent un petit processeur.")
];

const bus = [
  Q("b01", "bus", "Un capteur I2C ne répond pas (NACK sur son adresse). Que vérifier ?", ["L'alimentation, les résistances de tirage, l'adresse 7 bits (et son décalage), le câblage SDA/SCL", "Le mode SPI", "La fréquence du processeur seulement", "Le débit UART"], 0, "L'analyseur logique montre l'octet d'adresse envoyé et l'absence d'ACK."),
  Q("b02", "bus", "Quelle différence entre SPI et I2C ?", ["SPI : plus rapide, une ligne CS par puce, full-duplex ; I2C : deux fils partagés, adressage, plus lent", "I2C est plus rapide", "SPI utilise des adresses", "Aucune"], 0, "Le choix dépend du débit, du nombre de puces et du nombre de broches disponibles."),
  Q("b03", "bus", "Une liaison UART affiche des caractères incohérents. Cause la plus probable ?", ["Un débit différent entre émetteur et récepteur (ou un niveau de tension incompatible)", "Un câble trop court", "Un pull-up manquant sur TX", "Un processeur trop rapide"], 0, "Vérifier le débit, le format (8N1) et les niveaux (3,3 V, 5 V ou RS-232)."),
  Q("b04", "bus", "Combien d'octets par seconde au maximum à 115 200 bauds en 8N1 ?", ["11 520", "115 200", "14 400", "1 152"], 0, "10 bits par octet : start, 8 bits de données, stop."),
  Q("b05", "bus", "Que lit-on en premier dans une datasheet pour intégrer un nouveau capteur ?", ["Les valeurs maximales absolues, les caractéristiques électriques, le brochage, la carte des registres et les chronogrammes du bus", "Le prix", "La couleur du boîtier", "La date de publication"], 0, "Les valeurs maximales évitent de détruire la pièce ; les registres disent comment la configurer.")
];

const systeme = [
  Q("s01", "systeme", "Qu'est-ce que l'inversion de priorité sous un RTOS ?", ["Une tâche haute priorité attend un mutex tenu par une tâche basse, elle-même empêchée de tourner par une tâche moyenne", "Inverser deux priorités par erreur", "Une interruption désactivée", "Un débordement de pile"], 0, "L'héritage de priorité des mutex de FreeRTOS la résout."),
  Q("s02", "systeme", "Pourquoi éviter malloc dans un firmware qui doit tourner des années ?", ["Fragmentation du tas et durée non bornée : un jour, plus de bloc libre assez grand", "malloc n'existe pas en C embarqué", "Il est trop lent à compiler", "Il consomme du flash"], 0, "On préfère l'allocation statique ou des pools de blocs de taille fixe."),
  Q("s03", "systeme", "À quoi sert un chien de garde (watchdog) ?", ["Redémarrer la puce si le programme cesse de le nourrir régulièrement, par exemple bloqué dans une boucle", "Surveiller la température", "Chiffrer le firmware", "Mesurer la consommation"], 0, "On le nourrit seulement quand toutes les tâches ont montré qu'elles avancent."),
  Q("s04", "systeme", "Un capteur sur pile doit durer deux ans. Leviers principaux ?", ["Dormir le plus possible (veille profonde), se réveiller par interruption, couper les périphériques et choisir un régulateur à faible courant de repos", "Un processeur plus rapide", "Plus de printf", "Un watchdog plus court"], 0, "L'autonomie dépend du courant moyen, souvent dominé par la veille."),
  Q("s05", "systeme", "Comment partager une variable de 64 bits entre une ISR et le programme principal sur un processeur 32 bits ?", ["Lire et écrire dans une section critique (interruptions masquées brièvement), ou relire jusqu'à obtenir deux fois la même valeur", "La déclarer volatile suffit", "La déclarer const", "Aucune précaution"], 0, "volatile n'empêche pas une lecture coupée en deux par l'interruption.")
];

export default {
  id: "entretien-embarque", kind: "entretien", code: "ENTRETIEN EMBARQUÉ", name: "Entretien technique embarqué et firmware",
  minutes: 25, count: 16, passing: 700,
  intro: "C bas niveau, périphériques et interruptions, bus et capteurs, RTOS et énergie : les questions d'un entretien d'ingénieur firmware ou IoT.",
  about: "20 questions originales dans le style des entretiens embarqués. L'entretien blanc en tire 16 en 25 minutes. Chaque thème est travaillé dans les cours Électronique, Logique numérique et C embarqué de Boucle.",
  domains: [
    { id: "langage", name: "C bas niveau", weight: 25 },
    { id: "peripheriques", name: "Périphériques et interruptions", weight: 25 },
    { id: "bus", name: "Bus et capteurs", weight: 25 },
    { id: "systeme", name: "RTOS, mémoire et énergie", weight: 25 }
  ],
  tips: `<ul><li>Un recruteur embarqué aime les réponses qui citent une mesure : oscilloscope, analyseur logique, multimètre.</li><li>Montre que tu penses aux pires cas : rebonds, débordements, interruptions au mauvais moment.</li><li>Prépare une histoire de débogage matériel, du symptôme à la cause.</li></ul>`,
  bank: [...langage, ...peripheriques, ...bus, ...systeme]
};
