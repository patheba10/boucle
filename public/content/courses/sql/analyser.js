/* Cours SQL — chapitre 3 : fonctions fenêtres, CASE et dates, auto-jointures. */

const LAB = `<p><strong>Sur ta machine</strong> : les fonctions fenêtres existent dans SQLite (depuis 3.25), PostgreSQL, MySQL 8 et SQL Server. Vérifie ta version avec @@sqlite3 --version@@. Pour les dates, PostgreSQL utilise @@date_trunc('month', date)@@ et @@EXTRACT(YEAR FROM date)@@ là où SQLite utilise @@strftime@@.</p>`;

export default [
  {
    id: "sql-10", section: "Analyser", title: "Fonctions fenêtres", xp: 110,
    theory: `<p>Une <strong>fonction fenêtre</strong> calcule une valeur à partir d'un ensemble de lignes liées à la ligne courante, <em>sans</em> les fusionner comme @@GROUP BY@@ : chaque ligne reste dans le résultat. La clause @@OVER@@ définit la fenêtre : @@PARTITION BY@@ (les groupes) et @@ORDER BY@@ (l'ordre dans chaque groupe).</p>
~~~sql
SELECT nom, categorie, prix,
       ROW_NUMBER() OVER (PARTITION BY categorie ORDER BY prix DESC) AS n,
       ROUND(AVG(prix) OVER (PARTITION BY categorie), 2) AS moyenne_categorie
FROM produits
ORDER BY categorie, n;
~~~
<ul><li>@@ROW_NUMBER()@@ numérote 1, 2, 3… ; @@RANK()@@ donne le même rang aux ex æquo et saute les suivants (1, 1, 3) ; @@DENSE_RANK()@@ ne saute pas (1, 1, 2) ;</li><li>@@SUM(…) OVER (ORDER BY date)@@ fait un <strong>cumul</strong> ;</li><li>@@LAG(x)@@ et @@LEAD(x)@@ lisent la ligne précédente ou suivante, pour comparer à la période d'avant.</li></ul>
~~~sql
WITH ventes AS (
  SELECT co.date, SUM(l.quantite * l.prix_unitaire) AS montant
  FROM commandes AS co JOIN lignes AS l ON l.commande_id = co.id
  WHERE co.statut <> 'annulée'
  GROUP BY co.id, co.date
)
SELECT date, ROUND(montant, 2) AS montant,
       ROUND(SUM(montant) OVER (ORDER BY date), 2) AS cumul,
       ROUND(montant - LAG(montant) OVER (ORDER BY date), 2) AS ecart
FROM ventes
ORDER BY date;
~~~
<p>Le classique d'entretien « le top N par groupe » se résout avec @@ROW_NUMBER()@@ dans une CTE, puis @@WHERE n <= N@@ : on ne peut pas filtrer une fonction fenêtre directement dans @@WHERE@@.</p>`,
    setup: LAB,
    quiz: [
      { q: "Trois produits valent 100, 100 et 80. Quels rangs donne RANK() OVER (ORDER BY prix DESC) ?", options: ["1, 2, 3", "1, 1, 3", "1, 1, 2", "1, 2, 2"], answer: 1, explain: "RANK saute les rangs après les ex æquo ; DENSE_RANK donnerait 1, 1, 2." },
      { q: "Différence entre SUM(montant) avec GROUP BY et SUM(montant) OVER () ?", options: ["Aucune", "GROUP BY fusionne les lignes en une par groupe ; OVER garde chaque ligne et ajoute la somme à côté", "OVER est plus lent", "OVER ignore les NULL"], answer: 1, explain: "C'est ce qui permet de calculer une part du total ligne par ligne." }
    ],
    challenge: {
      prompt: `<p>Classe les produits par prix <strong>dans leur catégorie</strong> : renvoie @@categorie@@, @@nom@@, @@prix@@ et @@rang@@ (1 pour le plus cher de la catégorie ; deux prix égaux auraient le même rang). Trie par catégorie, puis par rang, puis par nom.</p>`,
      starter: "SELECT categorie, nom, prix,\n       ROW_NUMBER() OVER (ORDER BY prix DESC) AS rang\nFROM produits\nORDER BY categorie, rang, nom;\n",
      solution: "SELECT categorie, nom, prix,\n       RANK() OVER (PARTITION BY categorie ORDER BY prix DESC) AS rang\nFROM produits\nORDER BY categorie, rang, nom;\n",
      hint: "RANK() (même rang pour les ex æquo) OVER (PARTITION BY categorie ORDER BY prix DESC) : le classement recommence à 1 dans chaque catégorie."
    }
  },
  {
    id: "sql-11", section: "Analyser", title: "CASE et dates", xp: 100,
    theory: `<p>@@CASE@@ est le « si… alors… sinon » de SQL ; il produit une valeur, utilisable partout où une colonne l'est (@@SELECT@@, @@GROUP BY@@, @@ORDER BY@@) :</p>
~~~sql
SELECT nom, stock,
       CASE WHEN stock = 0 THEN 'rupture'
            WHEN stock < 10 THEN 'faible'
            ELSE 'ok' END AS etat
FROM produits
ORDER BY stock;
~~~
<p>Combiné à @@SUM@@, il compte selon une condition, en une seule passe (un « tableau croisé ») :</p>
~~~sql
SELECT ville,
       SUM(CASE WHEN inscrit_le < '2026-01-01' THEN 1 ELSE 0 END) AS avant_2026,
       SUM(CASE WHEN inscrit_le >= '2026-01-01' THEN 1 ELSE 0 END) AS en_2026
FROM clients
GROUP BY ville
ORDER BY ville;
~~~
<p>SQLite n'a pas de type date : on stocke du texte ISO (@@2026-03-01@@) et on le manipule avec @@date()@@, @@strftime()@@ et @@julianday()@@. Par exemple @@strftime('%Y-%m', date)@@ donne le mois, et @@julianday(b) - julianday(a)@@ un nombre de jours :</p>
~~~sql
SELECT strftime('%Y-%m', date) AS mois, COUNT(*) AS commandes
FROM commandes
GROUP BY mois
ORDER BY mois;
SELECT nom, CAST(julianday('2026-11-12') - julianday(inscrit_le) AS INTEGER) AS jours_client FROM clients ORDER BY jours_client DESC LIMIT 3;
~~~
<p>En vrai, @@date('now')@@ donne la date du jour ; on l'évite dans les exercices pour que les résultats ne changent pas d'un jour à l'autre.</p>`,
    setup: LAB,
    quiz: [
      { q: "Que renvoie un CASE sans ELSE quand aucune condition n'est vraie ?", options: ["0", "NULL", "Une erreur", "La première branche"], answer: 1, explain: "Ajoute un ELSE si une valeur par défaut est attendue." },
      { q: "Pourquoi stocker les dates au format AAAA-MM-JJ dans SQLite ?", options: ["C'est obligatoire", "Parce que l'ordre alphabétique de ce format est aussi l'ordre chronologique, et que les fonctions de date le comprennent", "Pour gagner de la place", "Pour l'afficher en français"], answer: 1, explain: "Avec JJ/MM/AAAA, le tri et les comparaisons seraient faux." }
    ],
    challenge: {
      prompt: `<p>Classe les produits en trois gammes selon leur prix : @@entrée@@ (moins de 50 $), @@milieu@@ (de 50 à 150 $ inclus) et @@haut@@ (plus de 150 $). Renvoie deux colonnes, @@gamme@@ et @@nb@@ (le nombre de produits de chaque gamme), de la gamme la plus fournie à la moins fournie.</p>`,
      starter: "SELECT CASE WHEN prix < 50 THEN 'entrée' ELSE 'haut' END AS gamme, COUNT(*) AS nb\nFROM produits\nGROUP BY gamme\nORDER BY nb DESC;\n",
      solution: "SELECT CASE WHEN prix < 50 THEN 'entrée'\n            WHEN prix <= 150 THEN 'milieu'\n            ELSE 'haut' END AS gamme,\n       COUNT(*) AS nb\nFROM produits\nGROUP BY gamme\nORDER BY nb DESC;\n",
      columns: true,
      hint: "Ajoute une branche WHEN prix <= 150 THEN 'milieu' entre les deux : les conditions sont testées dans l'ordre, la première vraie gagne."
    }
  },
  {
    id: "sql-12", section: "Analyser", title: "Auto-jointures et hiérarchies", xp: 100,
    theory: `<p>Une table peut se référencer elle-même : chaque employé a un @@manager_id@@ qui pointe vers un autre employé. Pour afficher le nom du manager, on joint la table <strong>à elle-même</strong>, avec deux alias :</p>
~~~sql
SELECT e.nom AS employe, m.nom AS manager
FROM employes AS e
JOIN employes AS m ON m.id = e.manager_id
ORDER BY manager, employe;
~~~
<p>Avec @@JOIN@@, la directrice (sans manager) disparaît ; @@LEFT JOIN@@ la garde avec un manager @@NULL@@. Une auto-jointure sert aussi à comparer deux lignes de la même table, par exemple les employés mieux payés que leur manager. Pour parcourir toute une hiérarchie, quel que soit le nombre de niveaux, on utilise une <strong>CTE récursive</strong> :</p>
~~~sql
WITH RECURSIVE chaine(id, nom, niveau) AS (
  SELECT id, nom, 0 FROM employes WHERE manager_id IS NULL
  UNION ALL
  SELECT e.id, e.nom, c.niveau + 1 FROM employes AS e JOIN chaine AS c ON e.manager_id = c.id
)
SELECT niveau, nom FROM chaine ORDER BY niveau, nom;
~~~
<p>@@UNION ALL@@ empile les résultats de deux requêtes qui ont les mêmes colonnes ; @@UNION@@ fait de même en retirant les doublons, ce qui coûte un tri.</p>`,
    setup: LAB,
    quiz: [
      { q: "Pourquoi deux alias (e et m) pour la même table ?", options: ["C'est une convention sans effet", "Parce que la table joue deux rôles dans la requête (l'employé et son manager) et qu'il faut distinguer leurs colonnes", "Pour aller plus vite", "SQLite l'exige pour toute jointure"], answer: 1, explain: "Sans alias, e.nom et m.nom seraient impossibles à distinguer." },
      { q: "UNION ou UNION ALL pour empiler deux listes sans doublon possible ?", options: ["UNION", "UNION ALL : plus rapide, car il ne cherche pas les doublons", "C'est identique", "Aucun des deux"], answer: 1, explain: "UNION trie ou hache le résultat pour éliminer les doublons ; inutile si l'on sait qu'il n'y en a pas." }
    ],
    challenge: {
      prompt: `<p>Pour l'organigramme, renvoie deux colonnes : @@employe@@ (le nom de chaque employé) et @@manager@@ (le nom de son manager). <strong>Tous</strong> les employés doivent apparaître, y compris la direction, dont le manager est @@NULL@@. Trie par nom d'employé.</p>`,
      starter: "SELECT e.nom AS employe, m.nom AS manager\nFROM employes AS e\nJOIN employes AS m ON m.id = e.manager_id\nORDER BY employe;\n",
      solution: "SELECT e.nom AS employe, m.nom AS manager\nFROM employes AS e\nLEFT JOIN employes AS m ON m.id = e.manager_id\nORDER BY employe;\n",
      columns: true,
      hint: "Avec JOIN, la directrice disparaît puisqu'elle n'a pas de manager : passe à LEFT JOIN."
    }
  }
];
