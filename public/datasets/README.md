# Jeux de données

Fichiers lisibles dans les exercices via `"data/<fichier>"`, par exemple `pd.read_csv("data/exemple-notes.csv")`. Le navigateur les copie dans le système de fichiers de Pyodide, la CI les expose au même chemin.

Règles : fichiers petits (moins de 1 Mo), licence libre, source citée ci-dessous.

| Fichier | Contenu | Source et licence |
|---------|---------|-------------------|
| `exemple-notes.csv` | 6 notes fictives (élève, matière, note) | Créé pour Boucle, domaine public |
| `penguins.csv` | 344 manchots de l'archipel Palmer (Antarctique) : espèce, île, mesures du bec et des nageoires, masse, sexe, année. Contient des valeurs manquantes | Gorman, Williams et Fraser (2014), Palmer Station LTER, via le paquet `palmerpenguins` ; licence CC0 |
| `meteo-seattle.csv` | Météo quotidienne de Seattle, 2012 à 2015 : précipitations (mm), températures max et min (°C), vent (m/s), type de temps | NOAA (domaine public), via le paquet `vega_datasets` |
| `clients.csv` | 7 clients fictifs | Créé pour Boucle, domaine public |
| `commandes.csv` | 15 commandes fictives, dont une d'un client inconnu (`C99`) pour illustrer les jointures | Créé pour Boucle, domaine public |
