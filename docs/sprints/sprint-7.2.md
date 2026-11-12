# Sprint 7.2

**Objectif** : TensorFlow et Keras, alors que TensorFlow ne tourne pas dans le navigateur.

| Story | Points | Statut |
|-------|--------|--------|
| #74 US-7b TensorFlow et Keras | 8 | Terminé |

## Conception

- Essai d'abord : pas de TensorFlow dans Pyodide 0.29.5 ni de paquet Keras ; recherche web sans solution sérieuse (les moteurs navigateur récents, comme LiteRT.js, font de l'inférence, pas de l'entraînement en Python). Trois options pesées : exécution seulement en CI et Colab (l'élève ne lance rien), TensorFlow.js (autre langage, autre API), ou un Keras en NumPy. Choix : **minikeras**, la partie de Keras 3 dont le cours a besoin, écrite en NumPy, installée sous les noms `keras` et `tensorflow` par le harnais.
- Garde-fou : un job CI installe le vrai TensorFlow (2.21, CPU) et relance tout le code Keras du site (`scripts/verifier_tf.mjs`). Les tests des défis portent sur des grandeurs qui ne dépendent pas de l'implémentation : nombres de paramètres, formes, seuils d'exactitude, présence des courbes, restauration des meilleurs poids.
- Mesures avant d'écrire le cours : sur le même code, minikeras et TensorFlow donnent les mêmes noms de couches et nombres de paramètres, et des exactitudes proches (chiffres 91,6 % contre 90,2 % ; CNN 86,5 % contre 86,2 %).

## Journal

- 12 nov. : minikeras (couches denses et convolutives, optimiseurs, pertes, EarlyStopping, L2), gradients vérifiés par différences finies ; chapitre Keras en 6 leçons ; `verifier_tf.mjs` et le job CI. Un défi a été recalibré : à 60 époques, les « lunes » plafonnaient à 94 % avec minikeras contre 98 % avec TensorFlow ; à 100 époques, 97 % des deux côtés. 905 vérifications, 94 tests unitaires, 8 vérifications avec TensorFlow.
- 12 nov. : un commit fait par erreur sur `main` en local (branche oubliée) ; le push a été refusé, le commit déplacé sur `us-7.2/keras`. PR #78 : les trois jobs verts, dont 20 tests de bout en bout (Keras exécuté par minikeras dans Pyodide) et 8 vérifications avec TensorFlow 2.21. Fusionnée.

## Revue de sprint

| Story | Points | Livré |
|-------|--------|-------|
| #74 TensorFlow et Keras | 8 | Oui (PR #78) |

Vélocité : 8 points sur 8. Version 0.20.0.

## Rétrospective

**Ce qui a marché.** Mesurer minikeras contre TensorFlow sur le même code avant d'écrire le cours ; écrire des tests sur des grandeurs indépendantes de l'implémentation ; le job TensorFlow qui garde les deux en accord.

**Ce qui a coincé.** Un oubli de branche après une version. Le refus du push sur `main` a joué son rôle de filet.

**À essayer.** Créer la branche du sprint dans la même commande que la fusion de la version précédente. Pour TensorFlow Lite (#75) : vérifier d'abord l'état de l'outillage (TensorFlow Lite devenu LiteRT) et ce qui peut tourner dans le navigateur (LiteRT.js fait de l'inférence).
