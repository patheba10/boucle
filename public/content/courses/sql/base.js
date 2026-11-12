/* Base « boutique » partagée par le cours SQL : une petite boutique en ligne de Gatineau. */

export const BOUTIQUE = `
PRAGMA foreign_keys = ON;

CREATE TABLE clients (
  id         INTEGER PRIMARY KEY,
  nom        TEXT NOT NULL,
  ville      TEXT NOT NULL,
  courriel   TEXT UNIQUE,
  inscrit_le TEXT NOT NULL
);

CREATE TABLE produits (
  id        INTEGER PRIMARY KEY,
  nom       TEXT NOT NULL,
  categorie TEXT NOT NULL,
  prix      REAL NOT NULL CHECK (prix > 0),
  stock     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE commandes (
  id        INTEGER PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  date      TEXT NOT NULL,
  statut    TEXT NOT NULL CHECK (statut IN ('payée', 'expédiée', 'livrée', 'annulée'))
);

CREATE TABLE lignes (
  commande_id   INTEGER NOT NULL REFERENCES commandes(id),
  produit_id    INTEGER NOT NULL REFERENCES produits(id),
  quantite      INTEGER NOT NULL CHECK (quantite > 0),
  prix_unitaire REAL NOT NULL,
  PRIMARY KEY (commande_id, produit_id)
);

CREATE TABLE employes (
  id         INTEGER PRIMARY KEY,
  nom        TEXT NOT NULL,
  service    TEXT NOT NULL,
  salaire    INTEGER NOT NULL,
  manager_id INTEGER REFERENCES employes(id)
);

INSERT INTO clients VALUES
  (1, 'Awa Diop',          'Gatineau',  'awa.diop@exemple.ca',      '2025-01-14'),
  (2, 'Louis Tremblay',    'Montréal',  'louis.t@exemple.ca',       '2025-02-03'),
  (3, 'Fatou Ndiaye',      'Gatineau',  'fatou.n@exemple.ca',       '2025-03-22'),
  (4, 'Marc Gagnon',       'Ottawa',    NULL,                       '2025-04-09'),
  (5, 'Chloé Roy',         'Montréal',  'chloe.roy@exemple.ca',     '2025-06-30'),
  (6, 'Ibrahima Sow',      'Québec',    'ibrahima.sow@exemple.ca',  '2025-08-17'),
  (7, 'Julie Bouchard',    'Gatineau',  'julie.b@exemple.ca',       '2025-10-05'),
  (8, 'Samuel Côté',       'Sherbrooke', NULL,                      '2026-01-11'),
  (9, 'Mariama Ba',        'Montréal',  'mariama.ba@exemple.ca',    '2026-03-02'),
  (10, 'Olivier Lavoie',   'Ottawa',    'olivier.l@exemple.ca',     '2026-05-20');

INSERT INTO produits VALUES
  (1,  'Clavier mécanique',    'Informatique', 129.99, 14),
  (2,  'Souris sans fil',      'Informatique',  39.50, 52),
  (3,  'Écran 27 pouces',      'Informatique', 329.00,  6),
  (4,  'Casque audio',         'Audio',        149.00, 21),
  (5,  'Enceinte Bluetooth',   'Audio',         89.90,  0),
  (6,  'Câble USB-C',          'Accessoires',   14.99, 120),
  (7,  'Support portable',     'Accessoires',   45.00, 18),
  (8,  'Webcam HD',            'Informatique',  79.00,  9),
  (9,  'Micro de bureau',      'Audio',        119.00,  4),
  (10, 'Lampe de bureau',      'Maison',        59.90, 33),
  (11, 'Chaise ergonomique',   'Maison',       389.00,  0),
  (12, 'Tapis de souris XL',   'Accessoires',   24.90, 0);

INSERT INTO commandes VALUES
  (1,  1, '2026-01-08', 'livrée'),
  (2,  2, '2026-01-19', 'livrée'),
  (3,  1, '2026-02-02', 'livrée'),
  (4,  3, '2026-02-14', 'annulée'),
  (5,  5, '2026-03-01', 'livrée'),
  (6,  2, '2026-03-15', 'livrée'),
  (7,  6, '2026-04-04', 'livrée'),
  (8,  7, '2026-05-21', 'expédiée'),
  (9,  1, '2026-06-10', 'livrée'),
  (10, 9, '2026-07-07', 'livrée'),
  (11, 5, '2026-08-19', 'expédiée'),
  (12, 3, '2026-09-25', 'payée'),
  (13, 2, '2026-10-30', 'payée'),
  (14, 10, '2026-11-03', 'payée'),
  (15, 6, '2026-11-09', 'payée');

INSERT INTO lignes VALUES
  (1, 1, 1, 129.99), (1, 2, 1, 39.50),
  (2, 3, 2, 319.00),
  (3, 6, 3, 14.99),  (3, 7, 1, 45.00),
  (4, 4, 1, 149.00),
  (5, 4, 1, 149.00), (5, 6, 2, 14.99),
  (6, 8, 1, 79.00),  (6, 10, 2, 59.90),
  (7, 11, 1, 389.00),
  (8, 2, 2, 39.50),  (8, 12, 1, 24.90),
  (9, 9, 1, 119.00),
  (10, 1, 1, 129.99), (10, 3, 1, 329.00), (10, 6, 1, 14.99),
  (11, 5, 1, 89.90),
  (12, 7, 2, 45.00),
  (13, 4, 2, 149.00), (13, 9, 1, 119.00),
  (14, 10, 1, 59.90),
  (15, 2, 1, 39.50),  (15, 6, 4, 14.99);

INSERT INTO employes VALUES
  (1, 'Nadia Benali',    'Direction',   128000, NULL),
  (2, 'Thomas Girard',   'Technique',    98000, 1),
  (3, 'Aminata Sarr',    'Technique',    86000, 2),
  (4, 'Kevin Morin',     'Technique',    74000, 2),
  (5, 'Léa Fortin',      'Ventes',       72000, 1),
  (6, 'Moussa Diallo',   'Ventes',       58000, 5),
  (7, 'Sophie Pelletier','Ventes',       61000, 5),
  (8, 'Hugo Martel',     'Logistique',   64000, 1),
  (9, 'Ndeye Fall',      'Logistique',   52000, 8);
`;

/** Schéma affiché dans la théorie (sans les données). */
export const SCHEMA = `clients   (id, nom, ville, courriel, inscrit_le)
produits  (id, nom, categorie, prix, stock)
commandes (id, client_id → clients.id, date, statut)
lignes    (commande_id → commandes.id, produit_id → produits.id, quantite, prix_unitaire)
employes  (id, nom, service, salaire, manager_id → employes.id)`;
