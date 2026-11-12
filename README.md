# Boucle

Plateforme d'apprentissage façon Coddy : théorie, quiz et défis corrigés automatiquement, avec du code qui s'exécute directement dans le navigateur. Cours Python, data, Git et GitHub, CI/CD avec GitHub Actions et C++, roadmaps DevOps, Cloud et ML. Le plan complet est dans [PLAN.md](PLAN.md), l'architecture dans [ARCHITECTURE.md](ARCHITECTURE.md) et l'auto-évaluation dans [AUDIT.md](AUDIT.md).

## Lancer en local

```bash
npm install
npm run dev        # http://localhost:5173
```

Le site est statique : `public/` est servi tel quel, sans étape de build.

## Tests

```bash
npm run validate            # contenu : tout
npm run validate -- py-04   # une seule leçon
pip install -r requirements.txt -r requirements-dev.txt
python -m playwright install chromium
npm run test:e2e            # parcours élève dans un vrai navigateur
npm run test:unit           # simulateurs Git et Linux, moteur des workflows
```

## Valider le contenu

```bash
npm run validate           # tout
npm run validate -- py-04  # une seule leçon
```

Pour chaque leçon, le script vérifie que les extraits de théorie s'exécutent, que la solution du défi passe les tests et que le code de départ échoue. Python tourne avec CPython et le même harnais que le navigateur. Le C++ est vérifié avec g++ et avec l'interpréteur du navigateur. La CI GitHub Actions lance ce script à chaque push.

Prérequis : Node 20+, Python 3.13, g++.

## Organisation

```
public/
  index.html
  assets/css/style.css
  assets/js/main.js            routeur et pages
  assets/js/lib/               état, éditeur, coloration, moteurs, vérification
  assets/js/workers/           Web Worker Python (Pyodide)
  assets/py/harness.py         exécution du code élève (navigateur et CI)
  content/index.js             liste des cours et roadmaps
  content/courses/*.js         un fichier par cours
  content/roadmaps.js
scripts/validate.mjs           validation du contenu
```

## Ajouter une leçon

Une leçon est un objet dans `public/content/courses/<cours>.js` :

- `id`, `title`, `xp`
- `theory` : HTML. `@@code@@` donne du code en ligne. Un bloc `~~~py` ... `~~~` est exécutable. Options du bloc : `norun`, ou `stdin:…` pour fournir une entrée.
- `section` (facultatif) : nom du chapitre affiché sur la page du cours
- `setup` (facultatif) : panneau « Sur ta machine », même syntaxe que `theory`. Blocs `~~~ps` (PowerShell) et `~~~bash` affichés sans exécution
- `quiz` : liste de `{ q, options, answer, explain }`
- `challenge` : `{ prompt, starter, solution, hint, ... }`
  - Python : `expected` (sortie exacte), plus `tests` optionnel, du code ajouté après celui de l'élève.
  - C++ : `tests`, une liste de `{ input, expected }`.
  - Git (cours dont `lang` vaut `"git"`) : `setup` (commandes de mise en place, silencieuses), `checks` (état attendu, critères listés dans `evaluate` de `lib/gitsim.js`), `solution` (une suite de commandes possible).
  - Workflow GitHub Actions (`lang` vaut `"yaml"`) : `starter` et `solution` (fichiers YAML), `checks` (critères listés dans `evaluate` de `lib/workflow.js`, dont `scenarios` : un événement simulé et les jobs qui doivent tourner ou être sautés), `events` facultatif (onglets de simulation ; par défaut, ceux des scénarios), `file` facultatif (nom affiché).
- `lang` (facultatif) sur une leçon : remplace le langage du cours pour cette leçon.
- `practice` (facultatif, leçons sans défi) : `{ title, body }`, panneau de pratique à droite.
- Blocs `~~~git` : exécutés dans un dépôt simulé neuf ; une ligne préfixée par `!` doit échouer.
  - Linux (`lang` vaut `"sh"`) : terminal avec `setup` (`{ files, services, procs, commands, cwd }` ; une commande préfixée par `#` tourne en root), `checks` (critères listés dans `evaluate` de `lib/shell/shell.js`) et `solution` (liste de commandes) ; ou script avec `kind: "script"`, `file`, `starter`, `solution` et `tests` (`{ args, stdin, out, outHas, code, checks }`).
- Blocs `~~~sh` : exécutés dans un terminal Linux neuf ; une commande préfixée par `!` doit échouer. Dans les fichiers du cours Linux, le gabarit `R` permet d'écrire `\${…}`.
- Blocs `~~~yaml` : bouton « Analyser » (problèmes et simulation). Ils doivent passer le lint, sauf avec l'option `erreurs` (extrait volontairement faux). Dans les fichiers du cours CI/CD, le gabarit `Y` permet d'écrire `\${{ … }}`.

Pour lire un jeu de données dans un exercice, place le fichier dans `public/datasets/` (et complète son README), puis lis-le via `"data/<fichier>"`.

Lance ensuite `npm run validate`.

Un nouveau cours se déclare avec `route` (son adresse, ex. `data`) et `badge` (2 ou 3 caractères), puis s'importe dans `public/content/index.js`.

## Moteurs d'exécution

- Python : [Pyodide](https://pyodide.org) 0.29.5, chargé depuis jsDelivr. Les paquets (numpy, pandas, scikit-learn, matplotlib…) se chargent à la demande selon les `import`.
- C++ : [JSCPP](https://github.com/felixhao28/JSCPP) 2.0.6, un interpréteur pédagogique (iostream, types de base, fonctions, tableaux, pointeurs).
- Git : simulateur maison (`lib/gitsim.js`).
- GitHub Actions : moteur maison (`lib/workflow.js`) qui lit le YAML avec [js-yaml](https://github.com/nodeca/js-yaml) 4.1.0 (copié dans `assets/js/vendor/`, licence MIT), signale les erreurs et simule les événements.

## Déploiement

- **Vercel** : chaque push sur `main` redéploie automatiquement.
- **GitHub Pages** : après la validation, la CI publie `public/` sur https://patheba10.github.io/boucle/ (Settings → Pages → Source : GitHub Actions).

Les chemins du site sont relatifs pour fonctionner aussi sous `https://patheba10.github.io/boucle/`.
