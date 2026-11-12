# Sprint 6.2

**Objectif** : API REST, FastAPI et pytest, exécutés dans le navigateur (fin de l'étape 5 bis).

| Story | Points | Statut |
|-------|--------|--------|
| #68 US-6b Cours API REST, FastAPI et pytest | 8 | Terminé |

## Conception

- Essai d'abord (rétrospective 6.1) : FastAPI 0.116, Starlette 0.47, Pydantic 2.12 et pytest 8.3 sont dans Pyodide 0.29.5. Deux obstacles : FastAPI exécute les fonctions synchrones dans un pool de threads, et le `TestClient` de Starlette lance un thread ; Pyodide n'a pas de threads. Essai local réussi avec les threads interdits : exécuter ces fonctions directement, et un client de test synchrone qui pilote l'application ASGI avec `coro.send(None)`, sans boucle d'événements. Les versions CPython de `requirements.txt` sont alignées sur Pyodide.
- Harnais commun (navigateur et CI) : l'adaptation s'active quand le code mentionne FastAPI ou Starlette. Pour les défis de tests, la partie après `#@boucle` pilote pytest : le fichier de l'élève devient `test_eleve.py`, les modules testés sont écrits à côté, et le vrai pytest tourne sur le bon code puis sur chaque mutant.
- Pédagogie : un défi de tests est réussi quand les tests passent sur le bon code et détectent chaque erreur plausible (borne, arrondi, contrôle oublié, statut HTTP). C'est la mesure qui compte en entretien, plus que la couverture.

## Journal

- 12 nov. : essai local concluant, harnais étendu, cours en 11 leçons (6 FastAPI, 4 pytest, 1 entretien) ; 868 vérifications, 2 tests unitaires du harnais ; e2e local vert (FastAPI et pytest ne sont vérifiés dans Pyodide qu'en CI, où le CDN est joignable : test de parité et `test_api_et_pytest_reels`).
- 12 nov. : première CI rouge, mais pas là où on l'attendait : le passage dans Pyodide était vert, et ce sont les tests unitaires du harnais qui échouaient, lancés avant l'installation des bibliothèques Python. Étape déplacée ; CI verte, 19 tests de bout en bout sans exception. PR #71 fusionnée.

## Revue de sprint

| Story | Points | Livré |
|-------|--------|-------|
| #68 Cours API et tests | 8 | Oui (PR #71) |

Vélocité : 8 points sur 8. Version 0.18.0. Le milestone « Étape 5 bis » est terminé.

## Rétrospective

**Ce qui a marché.** L'essai en premier, local, avec les threads interdits pour imiter Pyodide : il a confirmé l'approche avant d'écrire le cours, et la CI l'a validée du premier coup. Le test par mutation donne aux défis pytest une vraie exigence, vérifiable automatiquement.

**Ce qui a coincé.** L'ordre des étapes de la CI, écrit quand les tests unitaires n'avaient besoin que de Node.

**À essayer.** Garder ce schéma pour les prochains contenus dépendant de paquets Pyodide (TensorFlow à l'étape suivante, qui n'est pas dans Pyodide : prévoir un essai sur la faisabilité avant tout).
