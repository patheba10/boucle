/* Cours SQL — chapitre 2 : jointures, agrégats, HAVING, sous-requêtes et CTE. */

const LAB = `<p><strong>Sur ta machine</strong> : dans @@sqlite3@@, @@.mode box@@ puis @@.headers on@@ rendent les résultats lisibles. Refais chaque requête, puis modifie-la (une autre ville, un autre statut) et prédis le résultat avant de l'exécuter : c'est l'exercice qui fait vraiment progresser.</p>`;

export default [
  {
    id: "sql-05", section: "Combiner et résumer", title: "Jointures : INNER JOIN", xp: 90,
    theory: `<p>Les données d'une commande sont réparties dans plusieurs tables : la commande connaît @@client_id@@, pas le nom du client. Une <strong>jointure</strong> recolle les lignes qui se correspondent :</p>
~~~sql
SELECT co.id, co.date, c.nom
FROM commandes AS co
JOIN clients AS c ON c.id = co.client_id
ORDER BY co.date
LIMIT 5;
~~~
<p>@@JOIN@@ (ou @@INNER JOIN@@) ne garde que les lignes qui ont une correspondance des deux côtés. Les alias (@@co@@, @@c@@) raccourcissent l'écriture et lèvent l'ambiguïté quand deux tables ont une colonne du même nom (@@id@@). On enchaîne les jointures pour traverser plusieurs tables :</p>
~~~sql
SELECT co.id AS commande, p.nom AS produit, l.quantite, l.prix_unitaire
FROM lignes AS l
JOIN commandes AS co ON co.id = l.commande_id
JOIN produits AS p ON p.id = l.produit_id
WHERE co.id = 10;
~~~
<p>Remarque @@prix_unitaire@@ : la ligne de commande garde le prix payé, qui peut différer du prix actuel du produit. Une jointure sans condition (ou avec une mauvaise condition) produit le <strong>produit cartésien</strong> : chaque ligne avec chaque ligne. Si le nombre de lignes explose, c'est la première chose à vérifier.</p>`,
    setup: LAB,
    quiz: [
      { q: "Une jointure entre clients (10 lignes) et commandes (15 lignes) renvoie 150 lignes. Que s'est-il probablement passé ?", options: ["Tout va bien", "La condition ON manque ou est fausse : c'est un produit cartésien", "Il manque un ORDER BY", "Il y a des NULL"], answer: 1, explain: "10 × 15 = 150 : chaque client a été associé à chaque commande." },
      { q: "Pourquoi écrire c.id plutôt que id dans une jointure entre clients et commandes ?", options: ["Par style", "Parce que les deux tables ont une colonne id : sans préfixe, la colonne est ambiguë", "Pour aller plus vite", "C'est obligatoire dans SQLite"], answer: 1, explain: "SQLite répond « ambiguous column name: id »." }
    ],
    challenge: {
      prompt: `<p>Pour le suivi des livraisons, renvoie chaque commande au statut @@livrée@@ avec trois colonnes : le numéro de commande, sa date et le nom du client. Trie par date.</p>`,
      starter: "SELECT co.id, co.date, co.client_id\nFROM commandes AS co\nWHERE co.statut = 'livrée'\nORDER BY co.date;\n",
      solution: "SELECT co.id, co.date, c.nom\nFROM commandes AS co\nJOIN clients AS c ON c.id = co.client_id\nWHERE co.statut = 'livrée'\nORDER BY co.date;\n",
      hint: "JOIN clients AS c ON c.id = co.client_id, puis c.nom à la place de co.client_id."
    }
  },
  {
    id: "sql-06", section: "Combiner et résumer", title: "LEFT JOIN et lignes sans correspondance", xp: 90,
    theory: `<p>@@LEFT JOIN@@ garde <strong>toutes</strong> les lignes de la table de gauche ; quand il n'y a pas de correspondance à droite, les colonnes de droite valent @@NULL@@ :</p>
~~~sql
SELECT c.nom, co.id AS commande
FROM clients AS c
LEFT JOIN commandes AS co ON co.client_id = c.id
ORDER BY c.nom;
~~~
<p>C'est l'outil des questions « qui n'a jamais… » : on garde les lignes de gauche dont la partie droite est @@NULL@@ (une <em>anti-jointure</em>). @@NOT EXISTS@@ écrit la même idée autrement :</p>
~~~sql
SELECT p.nom
FROM produits AS p
WHERE NOT EXISTS (SELECT 1 FROM lignes AS l WHERE l.produit_id = p.id);
~~~
<p>Un piège fréquent : filtrer la table de droite dans @@WHERE@@ (@@WHERE co.statut = 'livrée'@@) supprime les lignes où elle vaut @@NULL@@, et transforme le @@LEFT JOIN@@ en @@INNER JOIN@@. Pour garder tout le monde, mets ce filtre dans la condition @@ON@@.</p>`,
    setup: LAB,
    quiz: [
      { q: "Pourquoi WHERE co.statut = 'livrée' annule-t-il l'effet d'un LEFT JOIN ?", options: ["Ce n'est pas le cas", "Les clients sans commande ont co.statut à NULL, et la condition les élimine", "WHERE est interdit avec LEFT JOIN", "Il faut un GROUP BY"], answer: 1, explain: "Le filtre sur la table de droite se met dans ON si l'on veut garder les lignes sans correspondance." },
      { q: "Quelle requête trouve les produits jamais commandés ?", options: ["Un INNER JOIN avec lignes", "Un LEFT JOIN vers lignes en gardant les lignes où l.produit_id IS NULL (ou NOT EXISTS)", "Un SELECT DISTINCT", "Un ORDER BY stock"], answer: 1, explain: "L'anti-jointure garde ce qui n'a pas de correspondance." }
    ],
    challenge: {
      prompt: `<p>L'équipe marketing veut relancer les clients inscrits qui n'ont <strong>jamais passé de commande</strong>. Renvoie leur @@nom@@ et leur @@ville@@.</p>`,
      starter: "SELECT c.nom, c.ville\nFROM clients AS c\nJOIN commandes AS co ON co.client_id = c.id;\n",
      solution: "SELECT c.nom, c.ville\nFROM clients AS c\nLEFT JOIN commandes AS co ON co.client_id = c.id\nWHERE co.id IS NULL;\n",
      hint: "LEFT JOIN commandes, puis WHERE co.id IS NULL pour ne garder que les clients sans correspondance."
    }
  },
  {
    id: "sql-07", section: "Combiner et résumer", title: "Agréger avec GROUP BY", xp: 90,
    theory: `<p>Les <strong>fonctions d'agrégation</strong> résument plusieurs lignes en une valeur : @@COUNT@@, @@SUM@@, @@AVG@@, @@MIN@@, @@MAX@@. Sans @@GROUP BY@@, elles résument toute la table :</p>
~~~sql
SELECT COUNT(*) AS nb, ROUND(AVG(prix), 2) AS prix_moyen, MAX(prix) AS plus_cher FROM produits;
~~~
<p>@@GROUP BY@@ forme un groupe par valeur distincte et calcule l'agrégat dans chaque groupe :</p>
~~~sql
SELECT statut, COUNT(*) AS nb FROM commandes GROUP BY statut ORDER BY nb DESC;
SELECT ville, COUNT(*) AS clients FROM clients GROUP BY ville ORDER BY clients DESC, ville;
~~~
<p>La règle : chaque colonne du @@SELECT@@ est soit dans le @@GROUP BY@@, soit dans un agrégat. PostgreSQL refuse le reste ; SQLite l'accepte et prend une valeur au hasard du groupe, ce qui donne des résultats faux sans aucune erreur. Le montant d'une ligne de commande se calcule avec @@quantite * prix_unitaire@@, et @@SUM@@ en fait des totaux.</p>`,
    setup: LAB,
    quiz: [
      { q: "SELECT categorie, nom, COUNT(*) FROM produits GROUP BY categorie : quel est le problème ?", options: ["Aucun", "nom n'est ni groupé ni agrégé : la valeur affichée est arbitraire (et PostgreSQL refuse la requête)", "COUNT(*) est interdit", "Il manque ORDER BY"], answer: 1, explain: "Chaque colonne affichée doit être dans GROUP BY ou dans une fonction d'agrégation." },
      { q: "Comment compter les clients distincts qui ont commandé ?", options: ["COUNT(client_id)", "COUNT(DISTINCT client_id)", "SUM(client_id)", "MAX(client_id)"], answer: 1, explain: "COUNT(client_id) compterait une fois par commande." }
    ],
    challenge: {
      prompt: `<p>Résume le catalogue par catégorie, avec trois colonnes nommées @@categorie@@, @@nb_produits@@ et @@prix_moyen@@ (arrondi à 2 décimales), triées par catégorie.</p>`,
      starter: "SELECT categorie, COUNT(*) AS nb_produits\nFROM produits\nORDER BY categorie;\n",
      solution: "SELECT categorie, COUNT(*) AS nb_produits, ROUND(AVG(prix), 2) AS prix_moyen\nFROM produits\nGROUP BY categorie\nORDER BY categorie;\n",
      columns: true,
      hint: "Il manque GROUP BY categorie (entre FROM et ORDER BY) et la colonne ROUND(AVG(prix), 2) AS prix_moyen."
    }
  },
  {
    id: "sql-08", section: "Combiner et résumer", title: "Filtrer les groupes avec HAVING", xp: 100,
    theory: `<p>@@WHERE@@ filtre les <strong>lignes</strong> avant le regroupement ; @@HAVING@@ filtre les <strong>groupes</strong> après, et peut donc utiliser les agrégats :</p>
~~~sql
SELECT client_id, COUNT(*) AS nb
FROM commandes
WHERE statut <> 'annulée'
GROUP BY client_id
HAVING COUNT(*) >= 2
ORDER BY nb DESC, client_id;
~~~
<p>Le chiffre d'affaires d'un client demande trois tables : ses commandes, leurs lignes, et la somme des montants :</p>
~~~sql
SELECT c.nom, ROUND(SUM(l.quantite * l.prix_unitaire), 2) AS total
FROM clients AS c
JOIN commandes AS co ON co.client_id = c.id
JOIN lignes AS l ON l.commande_id = co.id
GROUP BY c.id, c.nom
ORDER BY total DESC
LIMIT 3;
~~~
<p>Écrire un agrégat dans @@WHERE@@ (@@WHERE SUM(…) > 300@@) donne l'erreur « misuse of aggregate » : c'est le signe qu'il faut @@HAVING@@. On groupe par @@c.id@@ plutôt que par le nom seul : deux clients peuvent porter le même nom.</p>`,
    setup: LAB,
    quiz: [
      { q: "WHERE ou HAVING pour « les clients qui ont dépensé plus de 300 $ » ?", options: ["WHERE", "HAVING, car la condition porte sur une somme calculée par groupe", "Les deux sont interchangeables", "ORDER BY"], answer: 1, explain: "WHERE agit avant le calcul des groupes ; il ne connaît pas encore SUM." },
      { q: "Pourquoi exclure les commandes annulées dans WHERE plutôt que dans HAVING ?", options: ["C'est impossible dans HAVING", "On veut retirer ces lignes avant de les additionner : c'est un filtre de lignes", "Pour l'ordre du résultat", "Pour éviter les NULL"], answer: 1, explain: "Filtrer tôt est aussi plus efficace : moins de lignes à regrouper." }
    ],
    challenge: {
      prompt: `<p>Les meilleurs clients recevront un bon d'achat. Renvoie le @@nom@@ et le @@total@@ dépensé (somme des @@quantite × prix_unitaire@@, arrondie à 2 décimales) des clients dont le total dépasse <strong>300 $</strong>, sans compter les commandes <strong>annulées</strong>. Trie du plus gros total au plus petit.</p>`,
      starter: "SELECT c.nom, ROUND(SUM(l.quantite * l.prix_unitaire), 2) AS total\nFROM clients AS c\nJOIN commandes AS co ON co.client_id = c.id\nJOIN lignes AS l ON l.commande_id = co.id\nGROUP BY c.id, c.nom\nORDER BY total DESC;\n",
      solution: "SELECT c.nom, ROUND(SUM(l.quantite * l.prix_unitaire), 2) AS total\nFROM clients AS c\nJOIN commandes AS co ON co.client_id = c.id\nJOIN lignes AS l ON l.commande_id = co.id\nWHERE co.statut <> 'annulée'\nGROUP BY c.id, c.nom\nHAVING SUM(l.quantite * l.prix_unitaire) > 300\nORDER BY total DESC;\n",
      hint: "Deux ajouts : WHERE co.statut <> 'annulée' avant GROUP BY, et HAVING SUM(l.quantite * l.prix_unitaire) > 300 après."
    }
  },
  {
    id: "sql-09", section: "Combiner et résumer", title: "Sous-requêtes et CTE", xp: 100,
    theory: `<p>Une <strong>sous-requête</strong> est une requête dans une requête. Elle peut renvoyer une valeur (comparée avec @@=@@, @@>@@), une liste (avec @@IN@@), ou servir de table dans @@FROM@@ :</p>
~~~sql
SELECT nom, prix FROM produits WHERE prix > (SELECT AVG(prix) FROM produits);
SELECT nom FROM clients WHERE id IN (SELECT client_id FROM commandes WHERE statut = 'payée');
~~~
<p>Une sous-requête <strong>corrélée</strong> fait référence à la ligne en cours de la requête extérieure ; elle est réévaluée pour chaque ligne :</p>
~~~sql
SELECT p.nom, p.stock
FROM produits AS p
WHERE p.stock = (SELECT MAX(p2.stock) FROM produits AS p2 WHERE p2.categorie = p.categorie);
~~~
<p>Une <strong>CTE</strong> (@@WITH@@) nomme une étape intermédiaire : la requête se lit de haut en bas, comme un petit programme. C'est souvent plus lisible qu'une sous-requête imbriquée :</p>
~~~sql
WITH totaux AS (
  SELECT commande_id, SUM(quantite * prix_unitaire) AS montant
  FROM lignes
  GROUP BY commande_id
)
SELECT ROUND(AVG(montant), 2) AS panier_moyen, ROUND(MAX(montant), 2) AS plus_gros FROM totaux;
~~~`,
    setup: LAB,
    quiz: [
      { q: "Qu'est-ce qu'une sous-requête corrélée ?", options: ["Une sous-requête dans FROM", "Une sous-requête qui utilise une colonne de la requête extérieure, réévaluée pour chaque ligne", "Une jointure", "Une CTE"], answer: 1, explain: "Pratique, mais potentiellement coûteuse sur de grosses tables : une jointure sur un agrégat peut être plus rapide." },
      { q: "Quel avantage principal d'une CTE (WITH) ?", options: ["Elle est toujours plus rapide", "Elle découpe une requête complexe en étapes nommées, plus lisibles et réutilisables dans la requête", "Elle crée une table permanente", "Elle remplace les index"], answer: 1, explain: "La CTE n'existe que le temps de la requête." }
    ],
    challenge: {
      prompt: `<p>Pour repérer le haut de gamme, renvoie le @@nom@@, la @@categorie@@ et le @@prix@@ des produits plus chers que le <strong>prix moyen de leur propre catégorie</strong>.</p>`,
      starter: "SELECT nom, categorie, prix\nFROM produits\nWHERE prix > (SELECT AVG(prix) FROM produits);\n",
      solution: "SELECT p.nom, p.categorie, p.prix\nFROM produits AS p\nWHERE p.prix > (\n  SELECT AVG(p2.prix) FROM produits AS p2 WHERE p2.categorie = p.categorie\n);\n",
      hint: "Rends la sous-requête corrélée : donne un alias à chaque produits (p et p2) et ajoute WHERE p2.categorie = p.categorie dans la sous-requête."
    }
  }
];
