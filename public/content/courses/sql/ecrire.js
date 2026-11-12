/* Cours SQL — chapitre 4 : écrire et transactions, schéma et contraintes, index, entretien. */

const LAB = `<p><strong>Sur ta machine</strong> : installe PostgreSQL (paquet @@postgresql@@, ou @@docker run -e POSTGRES_PASSWORD=secret -p 5432:5432 postgres:17@@) et refais ces exercices avec @@psql@@. Les différences avec SQLite sont instructives : types stricts, @@SERIAL@@ ou @@GENERATED AS IDENTITY@@, clés étrangères toujours vérifiées, @@EXPLAIN ANALYZE@@ avec les temps réels.</p>`;

const CHECK_COMMANDE = "SELECT co.id, co.client_id, co.date, co.statut, l.produit_id, l.quantite, l.prix_unitaire, p.stock\nFROM commandes AS co\nJOIN lignes AS l ON l.commande_id = co.id\nJOIN produits AS p ON p.id = l.produit_id\nWHERE co.id = 16";
const CHECK_AVIS = "SELECT 'colonne' AS element, name AS nom, UPPER(type) AS type, \"notnull\" AS obligatoire, pk AS cle FROM pragma_table_info('avis')\nUNION ALL SELECT 'clé étrangère', \"from\", \"table\", \"to\", NULL FROM pragma_foreign_key_list('avis')\nUNION ALL SELECT 'contrainte CHECK', instr(UPPER(sql), 'CHECK') > 0, NULL, NULL, NULL FROM sqlite_master WHERE name = 'avis'";
const CHECK_INDEX = "SELECT COUNT(*) > 0 AS index_sur_client_id\nFROM pragma_index_list('commandes') AS il, pragma_index_info(il.name) AS ii\nWHERE ii.name = 'client_id' AND ii.seqno = 0";

export default [
  {
    id: "sql-13", section: "Écrire et concevoir", title: "INSERT, UPDATE, DELETE et transactions", xp: 110,
    theory: `<p>Trois instructions modifient les données :</p>
~~~sql
INSERT INTO clients (id, nom, ville, courriel, inscrit_le) VALUES (11, 'Inès Barry', 'Gatineau', NULL, '2026-11-12');
UPDATE produits SET prix = 34.90 WHERE id = 2;
DELETE FROM lignes WHERE commande_id = 4;
SELECT COUNT(*) AS clients FROM clients;
~~~
<p>Un @@UPDATE@@ ou un @@DELETE@@ sans @@WHERE@@ touche <strong>toutes</strong> les lignes. Le réflexe : écrire d'abord le @@SELECT@@ avec le même @@WHERE@@, vérifier les lignes visées, puis le transformer.</p>
<p>Une <strong>transaction</strong> regroupe plusieurs instructions en un tout : soit tout est appliqué (@@COMMIT@@), soit rien (@@ROLLBACK@@). C'est ce qui garantit qu'une commande n'existe jamais sans ses lignes, ou qu'un stock n'est pas décrémenté sans vente. Les propriétés <strong>ACID</strong> : atomicité, cohérence (contraintes respectées), isolation (les transactions concurrentes ne se voient pas à moitié), durabilité (ce qui est validé survit à une panne).</p>
~~~sql
BEGIN;
UPDATE produits SET stock = stock - 1 WHERE id = 3;
DELETE FROM lignes;
ROLLBACK;
SELECT COUNT(*) AS lignes_toujours_la FROM lignes;
SELECT stock FROM produits WHERE id = 3;
~~~
<p>Le @@ROLLBACK@@ a tout annulé : les lignes sont revenues et le stock n'a pas bougé. La base peut aussi refuser une instruction : ici les clés étrangères sont actives (@@PRAGMA foreign_keys = ON@@, désactivé par défaut dans SQLite), donc supprimer un client qui a des commandes échoue :</p>
~~~sql erreur
DELETE FROM clients WHERE id = 1;
~~~`,
    setup: LAB,
    quiz: [
      { q: "Que fait UPDATE produits SET stock = 0 sans WHERE ?", options: ["Une erreur", "Il met le stock de tous les produits à 0", "Il ne fait rien", "Il modifie le premier produit"], answer: 1, explain: "D'où le réflexe : SELECT avec le même WHERE avant, et une transaction pour pouvoir annuler." },
      { q: "Pourquoi créer une commande et ses lignes dans une même transaction ?", options: ["Pour aller plus vite uniquement", "Pour qu'une panne ou une erreur au milieu ne laisse pas une commande sans ses lignes (atomicité)", "C'est obligatoire en SQL", "Pour verrouiller toute la base"], answer: 1, explain: "Soit tout est validé, soit rien : la base reste cohérente." }
    ],
    challenge: {
      prompt: `<p>Marc Gagnon (client @@4@@) commande aujourd'hui, le @@2026-11-12@@, <strong>une lampe de bureau</strong> (produit @@10@@). Dans une transaction :</p><ol><li>crée la commande @@16@@ au statut @@payée@@ ;</li><li>ajoute sa ligne, au prix actuel du produit ;</li><li>retire la lampe du stock.</li></ol><p>La vérification relit la commande 16, sa ligne et le stock de la lampe.</p>`,
      starter: "BEGIN;\n-- 1. la commande\n-- 2. la ligne\n-- 3. le stock\nCOMMIT;\n",
      solution: "BEGIN;\nINSERT INTO commandes (id, client_id, date, statut) VALUES (16, 4, '2026-11-12', 'payée');\nINSERT INTO lignes (commande_id, produit_id, quantite, prix_unitaire)\n  VALUES (16, 10, 1, (SELECT prix FROM produits WHERE id = 10));\nUPDATE produits SET stock = stock - 1 WHERE id = 10;\nCOMMIT;\n",
      check: CHECK_COMMANDE,
      hint: "INSERT INTO commandes (id, client_id, date, statut) VALUES (16, 4, '2026-11-12', 'payée'); puis INSERT INTO lignes avec le prix lu par une sous-requête (SELECT prix FROM produits WHERE id = 10), et UPDATE produits SET stock = stock - 1 WHERE id = 10. La commande doit exister avant sa ligne (clé étrangère)."
    }
  },
  {
    id: "sql-14", section: "Écrire et concevoir", title: "Créer des tables : types, clés et contraintes", xp: 110,
    theory: `<p>@@CREATE TABLE@@ décrit les colonnes, leurs types et leurs <strong>contraintes</strong>, que la base fait respecter quelle que soit l'application qui écrit :</p>
<ul><li>@@PRIMARY KEY@@ : identifiant unique de la ligne ;</li><li>@@NOT NULL@@ : valeur obligatoire ; @@DEFAULT@@ : valeur par défaut ;</li><li>@@UNIQUE@@ : pas de doublon (un courriel par client) ;</li><li>@@CHECK (condition)@@ : règle métier (@@prix > 0@@) ;</li><li>@@REFERENCES table(colonne)@@ : clé étrangère, avec éventuellement @@ON DELETE CASCADE@@.</li></ul>
~~~sql
CREATE TABLE codes_promo (
  code     TEXT PRIMARY KEY,
  remise   INTEGER NOT NULL CHECK (remise BETWEEN 5 AND 50),
  actif    INTEGER NOT NULL DEFAULT 1
);
INSERT INTO codes_promo (code, remise) VALUES ('BIENVENUE', 10);
SELECT * FROM codes_promo;
~~~
~~~sql erreur
INSERT INTO codes_promo (code, remise) VALUES ('FOLIE', 90);
~~~
<p>Le second extrait échoue, ce qui est voulu : la base refuse une remise de 90 %. Concevoir un schéma, c'est surtout <strong>normaliser</strong> : chaque fait est stocké à un seul endroit. Le nom du client n'est pas recopié dans chaque commande, il est dans @@clients@@ et la commande pointe vers lui. Une relation plusieurs-à-plusieurs (commandes et produits) passe par une table de liaison (@@lignes@@). On dénormalise parfois volontairement, pour la performance ou pour l'historique : @@prix_unitaire@@ fige le prix payé.</p>`,
    setup: LAB,
    quiz: [
      { q: "Où mettre la règle « une note va de 1 à 5 » ?", options: ["Seulement dans l'application", "Dans la base, avec CHECK (note BETWEEN 1 AND 5), pour qu'aucune écriture ne puisse la contourner", "Dans un index", "Dans un commentaire"], answer: 1, explain: "Plusieurs applications, scripts ou humains écrivent dans une base ; la contrainte les protège tous." },
      { q: "Comment modéliser « une commande contient plusieurs produits, un produit est dans plusieurs commandes » ?", options: ["Une colonne produits avec une liste d'identifiants", "Une table de liaison (commande_id, produit_id) avec deux clés étrangères", "Dupliquer la commande par produit", "Une colonne JSON"], answer: 1, explain: "C'est le rôle de la table lignes, qui porte aussi la quantité et le prix payé." }
    ],
    challenge: {
      prompt: `<p>La boutique ouvre les avis clients. Crée la table @@avis@@ avec :</p><ul><li>@@id@@ : entier, clé primaire ;</li><li>@@produit_id@@ : entier obligatoire, clé étrangère vers @@produits(id)@@ ;</li><li>@@client_id@@ : entier obligatoire, clé étrangère vers @@clients(id)@@ ;</li><li>@@note@@ : entier obligatoire, entre 1 et 5 (contrainte @@CHECK@@) ;</li><li>@@commentaire@@ : texte, facultatif.</li></ul><p>Utilise les types @@INTEGER@@ et @@TEXT@@.</p>`,
      starter: "CREATE TABLE avis (\n  id INTEGER PRIMARY KEY,\n  produit_id INTEGER,\n  client_id INTEGER,\n  note INTEGER,\n  commentaire TEXT\n);\n",
      solution: "CREATE TABLE avis (\n  id          INTEGER PRIMARY KEY,\n  produit_id  INTEGER NOT NULL REFERENCES produits(id),\n  client_id   INTEGER NOT NULL REFERENCES clients(id),\n  note        INTEGER NOT NULL CHECK (note BETWEEN 1 AND 5),\n  commentaire TEXT\n);\n",
      check: CHECK_AVIS,
      hint: "Ajoute NOT NULL et REFERENCES produits(id) / REFERENCES clients(id) aux deux clés étrangères, et NOT NULL CHECK (note BETWEEN 1 AND 5) à note."
    }
  },
  {
    id: "sql-15", section: "Écrire et concevoir", title: "Index et plan d'exécution", xp: 110,
    theory: `<p>Sans index, chercher les commandes d'un client oblige à <strong>lire toute la table</strong> (un « scan »). Un <strong>index</strong> est une structure triée (un arbre B) qui mène directement aux lignes voulues, comme l'index d'un livre. @@EXPLAIN QUERY PLAN@@ montre ce que fait le moteur :</p>
~~~sql
EXPLAIN QUERY PLAN SELECT * FROM commandes WHERE client_id = 2;
CREATE INDEX idx_commandes_client ON commandes (client_id);
EXPLAIN QUERY PLAN SELECT * FROM commandes WHERE client_id = 2;
~~~
<p>Avant : @@SCAN commandes@@. Après : @@SEARCH commandes USING INDEX idx_commandes_client (client_id=?)@@. Sur 15 lignes la différence est nulle ; sur 50 millions, c'est la différence entre 2 ms et 40 secondes.</p>
<p>Les règles pratiques :</p>
<ul><li>indexer les colonnes des jointures (clés étrangères) et des filtres fréquents ; les clés primaires et colonnes @@UNIQUE@@ le sont déjà ;</li><li>un index sur plusieurs colonnes @@(client_id, date)@@ sert aux filtres sur @@client_id@@ seul, ou sur les deux, pas sur @@date@@ seul (l'ordre compte) ;</li><li>une fonction sur la colonne (@@WHERE UPPER(nom) = …@@) ou un @@LIKE '%mot'@@ empêche l'usage d'un index ordinaire ;</li><li>chaque index ralentit les écritures et prend de la place : on n'indexe pas tout.</li></ul>
<p>Dans PostgreSQL, @@EXPLAIN ANALYZE@@ exécute la requête et donne les temps réels : c'est le premier outil face à une requête lente.</p>`,
    setup: LAB,
    quiz: [
      { q: "Un index existe sur (client_id, date). Quelle requête ne peut pas l'utiliser pour filtrer ?", options: ["WHERE client_id = 2", "WHERE client_id = 2 AND date > '2026-06-01'", "WHERE date > '2026-06-01'", "WHERE client_id IN (1, 2)"], answer: 2, explain: "Un index composite sert d'abord sur sa première colonne, comme un annuaire trié par nom puis prénom." },
      { q: "Pourquoi ne pas indexer toutes les colonnes ?", options: ["SQLite le refuse", "Chaque index doit être mis à jour à chaque écriture et occupe de la place ; on indexe selon les requêtes réelles", "Les index ralentissent les lectures", "Un seul index par table est permis"], answer: 1, explain: "On part des requêtes lentes et de leur plan, pas d'une règle générale." }
    ],
    challenge: {
      prompt: `<p>La page « Mes commandes » lance sans arrêt @@SELECT * FROM commandes WHERE client_id = ?@@, et la table va grossir. Crée l'index qui permet de chercher directement par @@client_id@@, puis affiche le plan de la requête pour vérifier qu'il l'utilise.</p>`,
      starter: "EXPLAIN QUERY PLAN SELECT * FROM commandes WHERE client_id = 2;\n",
      solution: "CREATE INDEX idx_commandes_client ON commandes (client_id);\nEXPLAIN QUERY PLAN SELECT * FROM commandes WHERE client_id = 2;\n",
      check: CHECK_INDEX,
      hint: "CREATE INDEX idx_commandes_client ON commandes (client_id); puis relance EXPLAIN QUERY PLAN : on doit voir SEARCH … USING INDEX."
    }
  },
  {
    id: "sql-16", section: "Entretien", title: "Questions d'entretien SQL", xp: 60, theoryOnly: true,
    theory: `<p>SQL revient dans presque tous les entretiens : backend, données, DevOps (requêtes de diagnostic) et ML (préparer les données). On demande souvent d'écrire une requête au tableau : parle à voix haute, commence par le @@FROM@@ et les jointures, vérifie les cas limites (NULL, ex æquo, lignes sans correspondance).</p>
<div class="qa">
<details><summary>Quelle différence entre WHERE et HAVING ?</summary><p>WHERE filtre les lignes avant le regroupement ; HAVING filtre les groupes après, et peut utiliser les agrégats. Filtrer au plus tôt (WHERE) réduit aussi le travail.</p></details>
<details><summary>INNER JOIN, LEFT JOIN : quand utiliser lequel ?</summary><p>INNER JOIN garde les lignes qui ont une correspondance des deux côtés ; LEFT JOIN garde toutes celles de gauche, avec des NULL à droite si rien ne correspond. LEFT JOIN plus « IS NULL » trouve ce qui n'a pas de correspondance.</p></details>
<details><summary>Comment trouver le deuxième salaire le plus élevé ?</summary><p>SELECT MAX(salaire) FROM employes WHERE salaire < (SELECT MAX(salaire) FROM employes), ou DENSE_RANK() OVER (ORDER BY salaire DESC) dans une CTE et WHERE rang = 2, qui gère les ex æquo et se généralise au N-ième.</p></details>
<details><summary>Comment trouver les doublons d'une colonne ?</summary><p>SELECT courriel, COUNT(*) FROM clients GROUP BY courriel HAVING COUNT(*) > 1. Pour les supprimer en gardant une ligne : ROW_NUMBER() OVER (PARTITION BY courriel ORDER BY id) et supprimer les lignes de rang supérieur à 1.</p></details>
<details><summary>Qu'est-ce qu'une fonction fenêtre, et quel problème résout-elle ?</summary><p>Un calcul sur un ensemble de lignes liées à la ligne courante, sans les fusionner : rangs, cumuls, moyennes mobiles, comparaison à la ligne précédente (LAG). Classique : le top 3 des produits par catégorie.</p></details>
<details><summary>Qu'est-ce qu'un index, et quand peut-il nuire ?</summary><p>Une structure triée (arbre B) qui évite de lire toute la table. Il ralentit les écritures et occupe de l'espace ; il est ignoré si la requête applique une fonction à la colonne ou si le filtre ne porte pas sur la première colonne d'un index composite. On le vérifie avec EXPLAIN.</p></details>
<details><summary>Que signifie ACID ?</summary><p>Atomicité (tout ou rien), cohérence (les contraintes restent vraies), isolation (les transactions concurrentes ne voient pas d'état intermédiaire, selon le niveau d'isolation), durabilité (ce qui est validé survit à une panne, grâce au journal).</p></details>
<details><summary>Qu'est-ce que la normalisation ? Quand dénormaliser ?</summary><p>Ranger chaque fait à un seul endroit, pour éviter les incohérences (formes normales). On dénormalise volontairement pour la lecture (entrepôts de données, tables de rapports) ou pour figer l'historique (le prix payé dans la ligne de commande).</p></details>
<details><summary>Qu'est-ce qu'une injection SQL et comment l'éviter ?</summary><p>Du texte saisi par l'utilisateur, concaténé dans une requête, qui en change le sens (' OR 1=1 --). On l'évite avec des requêtes paramétrées (le pilote envoie la valeur à part), jamais par concaténation, et avec un compte de base aux droits minimaux.</p></details>
<details><summary>Une requête est lente en production. Comment procèdes-tu ?</summary><p>Mesurer (journal des requêtes lentes, pg_stat_statements), lire le plan (EXPLAIN ANALYZE), chercher les scans complets, les mauvaises estimations et les tris coûteux, puis ajouter un index adapté, réécrire la requête, ou paginer. Vérifier ensuite l'effet, sans oublier le coût sur les écritures.</p></details>
</div>`,
    practice: { title: "S'entraîner", body: `<p>Choisis trois questions et réponds à voix haute. Puis, sur ta machine avec PostgreSQL : charge la base de la boutique, écris une requête par question du cours sans regarder les solutions, et compare les plans d'exécution avec et sans index après avoir inséré un million de commandes avec @@generate_series@@. LeetCode (section Database) et StrataScratch proposent des exercices d'entretien SQL corrigés.</p>` },
    quiz: [
      { q: "Quelle requête trouve les clients qui ont au moins une commande, sans doublon ?", options: ["SELECT nom FROM clients JOIN commandes ON …", "SELECT nom FROM clients WHERE EXISTS (SELECT 1 FROM commandes WHERE commandes.client_id = clients.id)", "SELECT nom FROM clients LEFT JOIN commandes ON …", "SELECT DISTINCT client_id FROM clients"], answer: 1, explain: "EXISTS s'arrête à la première commande trouvée et ne multiplie pas les lignes, contrairement à une jointure." },
      { q: "Comment éviter les injections SQL dans une application Python ?", options: ["Échapper les apostrophes à la main", "Utiliser des requêtes paramétrées : cur.execute(\"… WHERE id = ?\", (valeur,))", "Mettre la requête en majuscules", "Utiliser une CTE"], answer: 1, explain: "La valeur n'est jamais interprétée comme du SQL." }
    ]
  }
];
