# Architecture de Boucle

Boucle est un **site statique** : pas de serveur applicatif ni de base de données. Tout le code de l'élève s'exécute **dans son navigateur**. Ce choix garde l'hébergement gratuit (GitHub Pages, Vercel), supprime toute surface d'attaque côté serveur et fonctionne même sur un réseau filtré.

## Vue d'ensemble

```
Navigateur de l'élève
├── Interface        public/assets/js/main.js       routeur (#route) et pages
├── Contenu          public/content/                 cours, leçons, roadmaps (données pures)
├── Progression      localStorage                    XP, série, code en cours
├── Worker Python    assets/js/workers/python-worker.js + assets/py/harness.py
│                    Pyodide (CPython 3.13 en WebAssembly), paquets à la demande
└── Interpréteur C++ JSCPP, exécuté pas à pas sur le fil principal

CDN jsDelivr         Pyodide, ses paquets (numpy, pandas…), JSCPP

GitHub (dépôt boucle)
├── main             code + contenu
├── CI Actions       npm run validate → 87+ vérifications (CPython, g++, JSCPP)
└── Publication      GitHub Pages (patheba10.github.io/boucle) et Vercel
```

## Les couches

### 1. Contenu (`public/content/`)

Des modules JavaScript qui n'exportent que des **données** : aucune logique. Un fichier par cours, plus `roadmaps.js`, et `index.js` qui assemble le tout.

Schéma d'une leçon :

| Champ | Rôle |
|-------|------|
| `id`, `title`, `xp` | Identité et récompense |
| `theory` | HTML. `@@code@@` pour le code en ligne ; blocs `~~~py` / `~~~cpp` exécutables (options : `norun`, `stdin:…`) |
| `quiz` | `[{ q, options, answer, explain }]` |
| `challenge` | `{ prompt, starter, solution, hint, expected, tests }` |
| `theoryOnly` | Leçon sans défi exécutable |

La séparation contenu / moteur permet d'ajouter un cours sans toucher au code de l'application.

### 2. Application (`public/assets/js/`)

ES modules natifs, sans framework ni étape de build.

| Module | Responsabilité |
|--------|----------------|
| `main.js` | Routeur par hash (`#py-04`, `#devops`…), rendu des pages, liaison des événements |
| `lib/state.js` | Progression : XP, niveaux, série de jours, code sauvegardé (localStorage) |
| `lib/editor.js` | Éditeur : `<textarea>` transparente sur un `<pre>` coloré, indentation auto |
| `lib/highlight.js` | Coloration syntaxique Python et C++ |
| `lib/engines.js` | Façade unique `run(lang, code, stdin)` vers les moteurs |
| `lib/checker.js` | Vérification des défis, messages d'erreur pédagogiques, rendu console et figures |

### 3. Moteurs d'exécution

**Python.** Un Web Worker charge Pyodide et exécute le code de l'élève hors du fil principal : l'interface ne gèle jamais. `harness.py` capture la sortie, traduit les erreurs (type, ligne) et renvoie les figures Matplotlib en PNG. Les paquets importés sont chargés automatiquement. Une boucle infinie est coupée après 10 s : le worker est détruit puis recréé.

**C++.** JSCPP interprète un sous-ensemble du C++ (iostream, types de base, fonctions, tableaux, pointeurs). Il s'exécute par tranches de 2 500 pas, ce qui permet de l'arrêter au bout de 6 s.

**Même code en CI et dans le navigateur.** `scripts/run_py.py` utilise le même `harness.py` que le worker : un exercice validé en CI se comporte de la même façon pour l'élève.

### 4. Vérification d'un défi

1. **Python.** Le code de l'élève est exécuté, suivi d'un marqueur puis du code de test caché. Seule la sortie produite après le marqueur est comparée à `expected`, après normalisation des espaces. On teste donc le comportement d'une fonction, et pas seulement ce qui est affiché.
2. **C++.** Le programme est exécuté une fois par test, chaque test ayant sa propre entrée standard. Une sortie codée en dur ne passe donc pas.

### 5. Qualité et déploiement

`npm run validate` vérifie, pour chaque leçon :

- la structure : ids uniques, quiz cohérents, liens internes des roadmaps ;
- que chaque extrait de théorie s'exécute ;
- que la solution passe, avec g++ **et** l'interpréteur du navigateur pour le C++ ;
- que le code de départ échoue.

La CI GitHub Actions lance cette validation à chaque push, puis publie `public/` sur GitHub Pages. Vercel publie le même dossier en parallèle.

## Décisions et compromis

| Décision | Pourquoi | Coût accepté |
|----------|----------|--------------|
| Site statique, pas de backend | Gratuit, sûr, rapide, déployable partout | Progression locale au navigateur (export/import prévu) |
| Pyodide plutôt que Skulpt | Vrai CPython, vraies bibliothèques data | Premier chargement d'environ 10 Mo |
| Pas de framework (React…) | Zéro build, code lisible pour apprendre | Plus de code manuel pour le rendu |
| JSCPP pour le C++ | Tourne sans serveur | Sous-ensemble du langage ; à remplacer (voir AUDIT #15) |
| Hash routing | Fonctionne sur tout hébergeur statique | URLs moins jolies |

## Évolutions prévues pour l'étape 2

- **Jeux de données** : fichiers CSV dans `public/datasets/`. Le worker les copie dans le système de fichiers de Pyodide avant l'exécution, pour que `pd.read_csv("data/…")` fonctionne comme sur une vraie machine. La CI lit les mêmes fichiers.
- **Versions alignées** : la CI installe les mêmes versions de numpy, pandas, scikit-learn et matplotlib que Pyodide 0.29.5 (`requirements.txt`).
- **Sections** : un cours peut regrouper ses leçons en chapitres (NumPy, pandas…).
- **Guides d'installation** : champ `setup` par leçon (panneau « Sur ta machine ») et page `#installer` (Python, venv, VS Code, Jupyter, Git, WSL) pour travailler hors du site.
