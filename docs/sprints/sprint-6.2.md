# Sprint 6.2

**Objectif** : API REST, FastAPI et pytest, exécutés dans le navigateur (fin de l'étape 5 bis).

| Story | Points | Statut |
|-------|--------|--------|
| #68 US-6b Cours API REST, FastAPI et pytest | 8 | En cours |

## Conception

- Essai d'abord (rétrospective 6.1) : FastAPI 0.116, Starlette 0.47, Pydantic 2.12 et pytest 8.3 sont dans Pyodide 0.29.5. Deux obstacles : FastAPI exécute les fonctions synchrones dans un pool de threads, et le `TestClient` de Starlette lance un thread ; Pyodide n'a pas de threads. Essai local réussi avec les threads interdits : exécuter ces fonctions directement, et un client de test synchrone qui pilote l'application ASGI avec `coro.send(None)`, sans boucle d'événements. Les versions CPython de `requirements.txt` sont alignées sur Pyodide.
- Harnais commun (navigateur et CI) : l'adaptation s'active quand le code mentionne FastAPI ou Starlette. Pour les défis de tests, la partie après `#@boucle` pilote pytest : le fichier de l'élève devient `test_eleve.py`, les modules testés sont écrits à côté, et le vrai pytest tourne sur le bon code puis sur chaque mutant.
- Pédagogie : un défi de tests est réussi quand les tests passent sur le bon code et détectent chaque erreur plausible (borne, arrondi, contrôle oublié, statut HTTP). C'est la mesure qui compte en entretien, plus que la couverture.

## Journal

- 12 nov. : essai local concluant, harnais étendu, cours en 11 leçons (6 FastAPI, 4 pytest, 1 entretien) ; 868 vérifications, 2 tests unitaires du harnais ; e2e local vert (FastAPI et pytest ne sont vérifiés dans Pyodide qu'en CI, où le CDN est joignable : test de parité et `test_api_et_pytest_reels`).
