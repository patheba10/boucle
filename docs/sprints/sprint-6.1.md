# Sprint 6.1

**Objectif** : un cours SQL exécuté pour de vrai dans le navigateur (étape 5 bis).

| Story | Points | Statut |
|-------|--------|--------|
| #67 US-6a Cours SQL | 8 | En cours |

**Capacité** : 8 points (la story #68, API et pytest, suit au sprint 6.2).

## Conception

- Moteur : pas de nouveau moteur WebAssembly. `sqlite3` fait partie de la distribution Pyodide 0.29.5 ; `lib/sql.js` génère un programme Python qui crée la base, découpe les instructions (`sqlite3.complete_statement`), affiche les résultats en tableau et lève une erreur lisible. Même programme en CPython pour `npm run validate`, donc les solutions sont vérifiées en CI avant d'arriver chez l'élève.
- Défis : comparaison du dernier résultat de l'élève à celui de la solution, sur deux bases neuves. Ordre exigé si la solution trie ; noms de colonnes exigés si l'énoncé les impose ; requête de contrôle pour les exercices qui écrivent (INSERT, CREATE TABLE, CREATE INDEX).
- Contenu : une base « boutique » (clients, produits, commandes, lignes, employés) partagée par les 16 leçons, avec des pièges réalistes (prix payé différent du prix actuel, clients sans courriel ni commande, produits en rupture, hiérarchie d'employés).

## Journal

- 12 nov. : branche `us-6.1/sql`. Moteur (`lib/sql.js`), coloration, branchement dans l'éditeur, les extraits et `npm run validate`, 4 tests unitaires. Cours en 4 chapitres (16 leçons) : 845 vérifications. Une première validation a montré que le code de départ de sql-03 passait déjà (les trois produits les plus chers étaient tous en stock) : la chaise est maintenant en rupture. La copie locale de Pyodide n'a pas `sqlite3`, donc le passage réel dans le navigateur se vérifie en CI (test de parité et `test_sql_reel`).
