/* Défis gradués du cours SQL : une requête d'entretien par leçon, sur la même base (format : README, « defis »).
   Le résultat de l'élève est comparé à celui de la solution, dans l'ordre si la solution trie. */
const R = String.raw;

export default {
  "sql-05": [{
    niveau: "entretien",
    prompt: R`<p>Pour chaque ligne des commandes <em>livrées</em>, renvoie le numéro de commande, le nom du client, le nom du produit et la quantité. Trie par numéro de commande, puis par nom de produit. Trois tables à joindre.</p>`,
    starter: "SELECT co.id, co.client_id, l.produit_id, l.quantite\nFROM commandes AS co\nJOIN lignes AS l ON l.commande_id = co.id\nWHERE co.statut = 'livrée'\nORDER BY co.id, l.produit_id;\n",
    solution: R`SELECT co.id, c.nom AS client, p.nom AS produit, l.quantite
FROM commandes AS co
JOIN clients AS c ON c.id = co.client_id
JOIN lignes AS l ON l.commande_id = co.id
JOIN produits AS p ON p.id = l.produit_id
WHERE co.statut = 'livrée'
ORDER BY co.id, p.nom;
`,
    hints: ["Chaque JOIN ajoute une table : commandes → clients par client_id, commandes → lignes par commande_id, lignes → produits par produit_id.", "Le tri se fait sur p.nom, pas sur produit_id."]
  }],
  "sql-06": [{
    niveau: "entretien",
    prompt: R`<p>Renvoie le nom des clients qui n'ont <em>aucune commande livrée</em> (ceux qui n'ont rien commandé du tout comptent aussi), triés par nom. Piège classique : où placer la condition sur le statut ?</p>`,
    starter: "SELECT c.nom\nFROM clients AS c\nLEFT JOIN commandes AS co ON co.client_id = c.id\nWHERE co.statut = 'livrée' AND co.id IS NULL\nORDER BY c.nom;\n",
    solution: R`SELECT c.nom
FROM clients AS c
LEFT JOIN commandes AS co
  ON co.client_id = c.id AND co.statut = 'livrée'
WHERE co.id IS NULL
ORDER BY c.nom;
`,
    hints: ["Une condition sur la table de droite dans le WHERE élimine les lignes où elle vaut NULL : le LEFT JOIN redevient un JOIN.", "Mets co.statut = 'livrée' dans le ON : on ne joint que les commandes livrées, puis WHERE co.id IS NULL garde les clients sans correspondance."]
  }],
  "sql-07": [{
    niveau: "entretien",
    prompt: R`<p>Chiffre d'affaires par catégorie de produit, sur les commandes non annulées : la catégorie et le total (quantité × prix unitaire de la ligne), arrondi à 2 décimales et nommé @@ca@@. Trie du plus grand au plus petit.</p>`,
    starter: "SELECT p.categorie, ROUND(SUM(p.prix), 2) AS ca\nFROM produits AS p\nGROUP BY p.categorie\nORDER BY ca DESC;\n",
    solution: R`SELECT p.categorie, ROUND(SUM(l.quantite * l.prix_unitaire), 2) AS ca
FROM lignes AS l
JOIN produits AS p ON p.id = l.produit_id
JOIN commandes AS co ON co.id = l.commande_id
WHERE co.statut <> 'annulée'
GROUP BY p.categorie
ORDER BY ca DESC;
`,
    hints: ["Le montant vient des lignes (prix payé), pas du prix catalogue : partir de lignes.", "Joins produits pour la catégorie et commandes pour le statut, filtre avant de grouper, puis SUM(l.quantite * l.prix_unitaire)."]
  }],
  "sql-08": [{
    niveau: "entretien",
    prompt: R`<p>Les clients fidèles : le nom des clients qui ont au moins deux commandes livrées, avec ce nombre (colonne @@livrees@@). Trie par nombre décroissant, puis par nom.</p>`,
    starter: "SELECT c.nom, COUNT(*) AS livrees\nFROM clients AS c\nJOIN commandes AS co ON co.client_id = c.id\nGROUP BY c.id\nORDER BY livrees DESC, c.nom;\n",
    solution: R`SELECT c.nom, COUNT(*) AS livrees
FROM clients AS c
JOIN commandes AS co ON co.client_id = c.id
WHERE co.statut = 'livrée'
GROUP BY c.id, c.nom
HAVING COUNT(*) >= 2
ORDER BY livrees DESC, c.nom;
`,
    hints: ["WHERE filtre les lignes avant le regroupement (seulement les commandes livrées).", "HAVING filtre les groupes après : HAVING COUNT(*) >= 2."]
  }],
  "sql-09": [{
    niveau: "entretien",
    prompt: R`<p>Les grosses commandes : parmi les commandes non annulées, renvoie le numéro et le montant (arrondi à 2 décimales, colonne @@montant@@) de celles dont le montant dépasse la moyenne des montants de ces commandes. Trie par montant décroissant. Utilise une CTE.</p>`,
    starter: "SELECT l.commande_id AS id, ROUND(SUM(l.quantite * l.prix_unitaire), 2) AS montant\nFROM lignes AS l\nGROUP BY l.commande_id\nORDER BY montant DESC;\n",
    solution: R`WITH montants AS (
  SELECT co.id, SUM(l.quantite * l.prix_unitaire) AS montant
  FROM commandes AS co
  JOIN lignes AS l ON l.commande_id = co.id
  WHERE co.statut <> 'annulée'
  GROUP BY co.id
)
SELECT id, ROUND(montant, 2) AS montant
FROM montants
WHERE montant > (SELECT AVG(montant) FROM montants)
ORDER BY montant DESC;
`,
    hints: ["Une CTE calcule d'abord le montant de chaque commande non annulée.", "La requête principale compare chaque montant à (SELECT AVG(montant) FROM montants) : une moyenne de commandes, pas de lignes."]
  }],
  "sql-10": [{
    niveau: "entretien",
    prompt: R`<p>Pour chaque service, le salarié le mieux payé : le service, le nom et le salaire. En cas d'égalité, tous les ex æquo apparaissent. Trie par service. Utilise une fonction fenêtre.</p>`,
    starter: "SELECT service, nom, MAX(salaire) AS salaire\nFROM employes\nORDER BY service;\n",
    solution: R`SELECT service, nom, salaire
FROM (
  SELECT service, nom, salaire,
         RANK() OVER (PARTITION BY service ORDER BY salaire DESC) AS rang
  FROM employes
)
WHERE rang = 1
ORDER BY service;
`,
    hints: ["RANK() OVER (PARTITION BY service ORDER BY salaire DESC) numérote dans chaque service ; les ex æquo partagent le rang 1.", "Une fonction fenêtre ne peut pas aller dans le WHERE de la même requête : calcule-la dans une sous-requête, filtre rang = 1 dehors."]
  }],
  "sql-11": [{
    niveau: "entretien",
    prompt: R`<p>Tableau de bord mensuel : pour chaque mois de 2026 ayant des commandes, le mois au format @@AAAA-MM@@ (colonne @@mois@@), le nombre de commandes (@@total@@) et le nombre de commandes annulées (@@annulees@@). Trie par mois.</p>`,
    starter: "SELECT date AS mois, COUNT(*) AS total, 0 AS annulees\nFROM commandes\nGROUP BY date\nORDER BY mois;\n",
    solution: R`SELECT strftime('%Y-%m', date) AS mois,
       COUNT(*) AS total,
       SUM(CASE WHEN statut = 'annulée' THEN 1 ELSE 0 END) AS annulees
FROM commandes
WHERE date >= '2026-01-01' AND date < '2027-01-01'
GROUP BY mois
ORDER BY mois;
`,
    hints: ["strftime('%Y-%m', date) ramène chaque date à son mois : on groupe dessus.", "Compter sous condition : SUM(CASE WHEN statut = 'annulée' THEN 1 ELSE 0 END)."]
  }],
  "sql-12": [{
    niveau: "entretien",
    prompt: R`<p>Pour chaque manager : son nom, le nombre de ses subordonnés directs (@@equipe@@) et leur salaire moyen arrondi à l'entier (@@moyenne@@). Trie par équipe décroissante, puis par nom.</p>`,
    starter: "SELECT e.nom, COUNT(*) AS equipe, ROUND(AVG(e.salaire)) AS moyenne\nFROM employes AS e\nGROUP BY e.nom\nORDER BY equipe DESC, e.nom;\n",
    solution: R`SELECT m.nom, COUNT(*) AS equipe, ROUND(AVG(e.salaire)) AS moyenne
FROM employes AS e
JOIN employes AS m ON m.id = e.manager_id
GROUP BY m.id, m.nom
ORDER BY equipe DESC, m.nom;
`,
    hints: ["Joins la table employes à elle-même : e pour le subordonné, m pour son manager (m.id = e.manager_id).", "Groupe par manager ; COUNT(*) et AVG(e.salaire) portent sur ses subordonnés."]
  }]
};
