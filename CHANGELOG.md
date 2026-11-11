# Changelog

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Versions [SemVer](https://semver.org/lang/fr/).

## [Non publié]

### Ajouté
- Chapitre **SciPy** (4 leçons) : lois de probabilité, tests d'hypothèse (Welch, intervalles de confiance, comparaisons multiples), corrélation et paradoxe de Simpson sur les manchots, optimisation et ajustement de courbe (#5).

## [0.4.0] — 2026-11-11

### Ajouté
- Chapitre **pandas** (8 leçons) : Series et DataFrame, lecture et exploration de CSV, sélection et filtres, nettoyage, groupby, jointures, dates et séries temporelles, maximum par groupe (#3).
- Jeux de données réels : manchots de Palmer (CC0), météo de Seattle 2012-2015 (NOAA, domaine public), plus deux tables fictives clients et commandes (#3).
- Chapitre **Visualisation** (5 leçons) : figure et axes, choisir le bon graphique, sous-graphiques, pandas.plot et seaborn, graphique honnête. Les défis vérifient les propriétés des figures, pas l'image (#4).
- seaborn 0.13.2 installé à la demande dans le navigateur avec micropip (absent de Pyodide) (#4).
- Backlog de l'étape 3, dont un cours complet CI/CD (#10, #11, #12).

## [0.3.0] — 2026-11-11

### Ajouté
- Processus agile : backlog GitHub Issues, Definition of Ready / Done, modèles de PR et d'issue.
- Jeux de données lisibles via `data/<fichier>` dans le navigateur et en CI (#1).
- Chapitres dans les cours, panneau « Sur ta machine », page Installer (Python, venv, VS Code, Jupyter, Git, WSL) (#1).
- Préchargement de Python à l'ouverture d'une leçon (#1).
- Tests e2e Playwright en CI ; la publication attend la validation et les tests (#1).
- `requirements.txt` aligné sur les versions de Pyodide 0.29.5 (#1).

- Cours **Python data**, module NumPy : 8 leçons (ndarray, vectorisation, indexation et vues, broadcasting, axes, algèbre linéaire et régression par équations normales, aléatoire reproductible, moyenne mobile en O(n)) (#2).
- Test e2e de parité : chaque solution doit aussi passer dans le navigateur (Pyodide 32 bits, JSCPP) (#2).

### Modifié
- Les cours déclarent leur route et leur badge : le routeur n'a plus de cours codé en dur (#1).

## [0.2.0] — 2026-11-11

### Ajouté
- Site modulaire : un fichier de contenu par cours.
- Python réel dans le navigateur (Pyodide 0.29.5) dans un Web Worker : paquets à la demande, figures Matplotlib, arrêt des boucles infinies.
- Validation automatique de tout le contenu (CPython, g++, interpréteur du navigateur) et CI GitHub Actions.
- Publication sur GitHub Pages et Vercel.
- Documentation : README, ARCHITECTURE, AUDIT, PLAN.

## [0.1.0] — 2026-11-11

### Ajouté
- Prototype : 13 leçons Python, 11 leçons C++, roadmaps DevOps, Cloud et ML.
