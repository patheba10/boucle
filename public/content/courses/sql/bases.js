/* Cours SQL — chapitre 1 : tables et SELECT, filtres, tri et limites, NULL. */
import { SCHEMA } from "./base.js";

const LAB = `<p><strong>Sur ta machine</strong> : installe SQLite (@@sudo apt install sqlite3@@, @@brew install sqlite@@, ou le binaire de sqlite.org sous Windows), puis @@sqlite3 boutique.db@@. Les commandes @@.tables@@, @@.schema clients@@ et @@.mode box@@ aident à explorer. DB Browser for SQLite offre une interface graphique. Tout ce cours fonctionne aussi dans PostgreSQL, à quelques fonctions près (dates surtout).</p>`;

export default [
  {
    id: "sql-01", section: "Les bases", title: "Tables, lignes et SELECT", xp: 70,
    theory: `<p>Une base relationnelle range les données dans des <strong>tables</strong>. Chaque table a des <strong>colonnes</strong> typées et des <strong>lignes</strong>. Une <strong>clé primaire</strong> identifie chaque ligne, et une <strong>clé étrangère</strong> pointe vers la ligne d'une autre table. Tout le cours utilise la base d'une petite boutique en ligne de Gatineau :</p>
~~~text
${SCHEMA}
~~~
<p><strong>SQL</strong> décrit le résultat voulu, pas la façon de l'obtenir : le moteur choisit lui-même comment lire les tables. @@SELECT@@ liste les colonnes, @@FROM@@ la table. On peut calculer une colonne et la renommer avec @@AS@@ :</p>
~~~sql
SELECT nom, ville FROM clients;
SELECT nom, prix, prix * 2 AS prix_double FROM produits;
~~~
<p>@@SELECT *@@ ramène toutes les colonnes : pratique pour explorer, à éviter dans une application (la requête casse ou ralentit quand la table change). Les mots-clés s'écrivent souvent en majuscules par convention ; SQL ne distingue pas la casse des mots-clés. Une instruction se termine par @@;@@ et les commentaires commencent par @@--@@.</p>
<p>@@ROUND(x, 2)@@ arrondit, @@UPPER@@ et @@LOWER@@ changent la casse, @@||@@ concatène du texte :</p>
~~~sql
SELECT UPPER(nom) || ' (' || ville || ')' AS etiquette FROM clients LIMIT 3;
~~~
<p>Clique sur « Exécuter » : chaque extrait tourne dans un vrai SQLite, sur une base neuve.</p>`,
    setup: LAB,
    quiz: [
      { q: "À quoi sert une clé étrangère ?", options: ["À chiffrer une colonne", "À relier une ligne à une ligne d'une autre table (par exemple commandes.client_id vers clients.id)", "À trier la table", "À accélérer les requêtes"], answer: 1, explain: "Elle exprime une relation, et la base peut refuser une valeur qui ne correspond à aucune ligne." },
      { q: "Pourquoi éviter SELECT * dans le code d'une application ?", options: ["C'est une erreur de syntaxe", "Il ramène des colonnes inutiles et dépend de la structure de la table, qui peut changer", "Il ne marche pas dans SQLite", "Il ne ramène que la première ligne"], answer: 1, explain: "Nommer les colonnes rend la requête explicite, plus rapide et stable." }
    ],
    challenge: {
      prompt: `<p>La boutique affiche ses prix taxes comprises (TPS et TVQ : 14,975 %). Écris une requête qui renvoie, pour chaque produit, trois colonnes nommées exactement :</p><ul><li>@@nom@@ ;</li><li>@@prix@@ ;</li><li>@@prix_ttc@@, le prix multiplié par 1,14975 et arrondi à 2 décimales.</li></ul>`,
      starter: "SELECT nom\nFROM produits;\n",
      solution: "SELECT nom, prix, ROUND(prix * 1.14975, 2) AS prix_ttc\nFROM produits;\n",
      columns: true,
      hint: "ROUND(prix * 1.14975, 2) AS prix_ttc, à la suite de nom et prix, séparés par des virgules."
    }
  },
  {
    id: "sql-02", section: "Les bases", title: "Filtrer avec WHERE", xp: 80,
    theory: `<p>@@WHERE@@ garde les lignes pour lesquelles la condition est vraie. Les comparaisons : @@=@@, @@<>@@ (différent), @@<@@, @@<=@@, @@>@@, @@>=@@. Le texte s'écrit entre apostrophes : @@'Gatineau'@@.</p>
~~~sql
SELECT nom, prix FROM produits WHERE prix < 50;
SELECT nom FROM clients WHERE ville = 'Gatineau' AND inscrit_le >= '2025-06-01';
~~~
<p>Les raccourcis :</p>
<ul><li>@@IN ('Audio', 'Maison')@@ : une valeur parmi une liste ;</li><li>@@BETWEEN 50 AND 200@@ : bornes comprises ;</li><li>@@LIKE 'C%'@@ : motif, @@%@@ pour n'importe quelle suite de caractères, @@_@@ pour un seul ;</li><li>@@NOT@@ inverse une condition.</li></ul>
~~~sql
SELECT nom, categorie FROM produits WHERE categorie IN ('Audio', 'Maison');
SELECT nom FROM produits WHERE nom LIKE 'C%';
~~~
<p>Attention aux priorités : @@AND@@ passe avant @@OR@@. Mets des parenthèses dès que tu mélanges les deux : @@WHERE (a OR b) AND c@@. Les dates sont ici du texte au format ISO (@@2026-03-01@@), qui se compare et se trie correctement.</p>`,
    setup: LAB,
    quiz: [
      { q: "Que renvoie WHERE categorie = 'Audio' OR categorie = 'Maison' AND prix > 100 ?", options: ["Les produits Audio ou Maison à plus de 100", "Tous les produits Audio, plus les produits Maison à plus de 100, car AND passe avant OR", "Rien", "Une erreur"], answer: 1, explain: "Avec des parenthèses, (categorie = 'Audio' OR categorie = 'Maison') AND prix > 100, on obtient la première lecture." },
      { q: "BETWEEN 50 AND 200 inclut-il 50 et 200 ?", options: ["Non", "Oui, les deux bornes sont comprises", "Seulement 50", "Seulement 200"], answer: 1, explain: "C'est l'équivalent de prix >= 50 AND prix <= 200." }
    ],
    challenge: {
      prompt: `<p>Un client cherche du matériel <strong>Informatique</strong> ou <strong>Audio</strong> dont le prix est compris entre 50 et 200 $ (bornes comprises). Renvoie le @@nom@@ et le @@prix@@ de ces produits.</p>`,
      starter: "SELECT nom, prix\nFROM produits\nWHERE categorie = 'Informatique' OR categorie = 'Audio' AND prix BETWEEN 50 AND 200;\n",
      solution: "SELECT nom, prix\nFROM produits\nWHERE categorie IN ('Informatique', 'Audio')\n  AND prix BETWEEN 50 AND 200;\n",
      hint: "Le code de départ a un piège de priorité : AND passe avant OR. Mets le OR entre parenthèses, ou utilise categorie IN ('Informatique', 'Audio')."
    }
  },
  {
    id: "sql-03", section: "Les bases", title: "Trier, limiter, dédoublonner", xp: 80,
    theory: `<p>Sans @@ORDER BY@@, l'ordre des lignes n'est <strong>pas garanti</strong> : il peut changer d'une exécution ou d'une version à l'autre. On trie sur une ou plusieurs colonnes, @@ASC@@ (par défaut) ou @@DESC@@ :</p>
~~~sql
SELECT nom, categorie, prix FROM produits ORDER BY categorie, prix DESC;
~~~
<p>@@LIMIT n@@ garde les n premières lignes (après le tri) ; @@OFFSET k@@ en saute k, ce qui sert à paginer. @@DISTINCT@@ retire les doublons du résultat :</p>
~~~sql
SELECT DISTINCT ville FROM clients ORDER BY ville;
SELECT nom, prix FROM produits ORDER BY prix DESC LIMIT 3;
~~~
<p>L'ordre d'écriture d'une requête est fixe : @@SELECT … FROM … WHERE … GROUP BY … HAVING … ORDER BY … LIMIT@@. L'ordre d'évaluation est différent : @@FROM@@, @@WHERE@@, @@GROUP BY@@, @@HAVING@@, @@SELECT@@, @@ORDER BY@@, @@LIMIT@@. C'est pourquoi un alias défini dans @@SELECT@@ est utilisable dans @@ORDER BY@@ mais pas dans @@WHERE@@.</p>`,
    setup: LAB,
    quiz: [
      { q: "Une page affiche 10 produits par page. Quelle clause donne la page 3 ?", options: ["LIMIT 3", "LIMIT 10 OFFSET 20", "LIMIT 30", "OFFSET 3"], answer: 1, explain: "On saute les 20 premiers (pages 1 et 2) et on en garde 10, avec un ORDER BY stable." },
      { q: "Pourquoi ajouter ORDER BY même si le résultat « sort déjà dans l'ordre » ?", options: ["Pour aller plus vite", "Parce que sans ORDER BY l'ordre n'est pas garanti et peut changer", "C'est obligatoire avec LIMIT", "Pour éviter les doublons"], answer: 1, explain: "Un index ajouté ou une mise à jour du moteur peut changer l'ordre « naturel »." }
    ],
    challenge: {
      prompt: `<p>Pour la vitrine, renvoie le @@nom@@ et le @@prix@@ des <strong>trois produits les plus chers parmi ceux en stock</strong> (stock supérieur à 0), du plus cher au moins cher.</p>`,
      starter: "SELECT nom, prix\nFROM produits\nORDER BY prix DESC\nLIMIT 3;\n",
      solution: "SELECT nom, prix\nFROM produits\nWHERE stock > 0\nORDER BY prix DESC\nLIMIT 3;\n",
      hint: "Filtre d'abord avec WHERE stock > 0 : LIMIT s'applique après le filtre et le tri."
    }
  },
  {
    id: "sql-04", section: "Les bases", title: "NULL, la valeur absente", xp: 80,
    theory: `<p>@@NULL@@ veut dire « inconnu » ou « absent », pas zéro ni chaîne vide. Toute comparaison avec @@NULL@@ donne @@NULL@@, ni vrai ni faux : @@courriel = NULL@@ ne renvoie jamais rien. On teste avec @@IS NULL@@ et @@IS NOT NULL@@ :</p>
~~~sql
SELECT nom, courriel FROM clients WHERE courriel IS NULL;
SELECT COUNT(*) AS clients, COUNT(courriel) AS avec_courriel FROM clients;
~~~
<p>@@COUNT(*)@@ compte les lignes, @@COUNT(colonne)@@ les valeurs non nulles. Les autres agrégats (@@SUM@@, @@AVG@@) ignorent aussi les @@NULL@@. @@COALESCE(a, b, …)@@ renvoie la première valeur non nulle, pour afficher une valeur de remplacement :</p>
~~~sql
SELECT nom, COALESCE(courriel, '(aucun)') AS courriel FROM clients;
~~~
<p>Un piège classique : @@WHERE ville <> 'Gatineau'@@ n'inclut pas les lignes où la ville est @@NULL@@. C'est la logique à trois valeurs (vrai, faux, inconnu) de SQL.</p>`,
    setup: LAB,
    quiz: [
      { q: "Que renvoie SELECT * FROM clients WHERE courriel = NULL ?", options: ["Les clients sans courriel", "Aucune ligne : la comparaison avec NULL n'est jamais vraie", "Une erreur", "Tous les clients"], answer: 1, explain: "Il faut écrire courriel IS NULL." },
      { q: "Une table a 10 lignes dont 2 avec courriel NULL. Que donne COUNT(courriel) ?", options: ["10", "8", "2", "NULL"], answer: 1, explain: "COUNT(colonne) ne compte que les valeurs non nulles." }
    ],
    challenge: {
      prompt: `<p>Le service client veut compléter sa liste de contacts. Renvoie, pour <strong>tous</strong> les clients, deux colonnes :</p><ul><li>@@nom@@ ;</li><li>@@contact@@ : le courriel, ou le texte @@à compléter@@ s'il n'y en a pas.</li></ul><p>Trie par nom.</p>`,
      starter: "SELECT nom, courriel AS contact\nFROM clients\nWHERE courriel IS NOT NULL\nORDER BY nom;\n",
      solution: "SELECT nom, COALESCE(courriel, 'à compléter') AS contact\nFROM clients\nORDER BY nom;\n",
      columns: true,
      hint: "Pas de WHERE : on veut tous les clients. COALESCE(courriel, 'à compléter') AS contact remplace les NULL."
    }
  }
];
