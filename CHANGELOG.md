# Changelog

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Versions [SemVer](https://semver.org/lang/fr/).

## [Non publié]

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
