# Sprint 7.3

**Objectif** : TensorFlow Lite, de la conversion à l'embarqué, et clore l'étape 6.

| Story | Points | Statut |
|-------|--------|--------|
| #75 US-7c TensorFlow Lite et l'IA embarquée | 5 | Terminé |

## Conception

- État de l'outillage vérifié d'abord, comme prévu à la rétrospective précédente : TensorFlow Lite s'appelle désormais LiteRT. Le format `.tflite` et l'API de l'interpréteur ne changent pas, mais `tf.lite.Interpreter` est déprécié au profit du paquet `ai-edge-litert`, et Keras 3 exporte directement avec `model.export(…, format="litert")`. Essai avec TensorFlow 2.21 : conversion, quantification dynamique (8 976 octets contre environ 4 fois plus en float32) et inférence avec `ai_edge_litert` fonctionnent.
- Ce qui ne peut pas tourner dans le navigateur (le convertisseur, l'interpréteur) devient des extraits `~~~py tf` : affichés sans bouton Exécuter, avec la mention « sur ta machine ou dans Colab », ignorés par `npm run validate` et exécutés par le job CI TensorFlow. `ai-edge-litert==2.3.0` rejoint `requirements-tf.txt`.
- Ce qui peut tourner dans le navigateur devient des défis : la quantification affine int8 se code en NumPy (échelle, zéro, erreur bornée par une demi-échelle), puis s'applique aux poids d'un modèle Keras entraîné pour mesurer la perte d'exactitude et le gain de taille. Les deux défis passent avec minikeras et avec TensorFlow.

## Journal

- 12 nov. : chapitre « TensorFlow Lite », 5 leçons (conversion, quantification, quantifier un modèle et mesurer, interpréteur LiteRT, téléphone, Raspberry Pi et microcontrôleur) ; deux questions d'entretien sur le déploiement et la quantification. Les sorties attendues ont été calculées par script, pas à la main : un arrondi float32 donnait -1 là où le calcul exact donnait 0. 911 vérifications, 94 tests unitaires, 11 vérifications avec TensorFlow, 15 tests de bout en bout hors ligne.

## Revue de sprint

| Story | Points | Livré |
|-------|--------|-------|
| #75 TensorFlow Lite et l'IA embarquée | 5 | Oui |

Vélocité : 5 points sur 5. Version 0.21.0. L'étape 6 (deep learning) est terminée : 20 leçons, de NumPy à LiteRT.

## Rétrospective

**Ce qui a marché.** Sonder l'outillage avant d'écrire : le renommage en LiteRT et la dépréciation de `tf.lite.Interpreter` auraient rendu le cours faux dès sa sortie. Séparer ce qui se calcule (la quantification, en défi) de ce qui demande l'outil (la conversion, en extrait vérifié en CI).

**Ce qui a coincé.** Rien de bloquant. Les extraits `tf` ne sont vérifiés qu'en CI : en local, il faut l'environnement TensorFlow pour les relancer.

**À essayer.** Pour l'étape 7 (hardware et embarqué) : trouver ce qui peut se simuler dans le navigateur (registres, GPIO, protocoles série) et garder le matériel réel pour la pratique « sur ta machine ».
