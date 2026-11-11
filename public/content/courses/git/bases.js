/* Cours Git — chapitre « Les bases ».
   Défis : setup = état de départ (commandes silencieuses), checks = état attendu, solution = un chemin possible.
   Extraits ~~~git : exécutés dans un dépôt simulé neuf ; une ligne préfixée par « ! » doit échouer. */
const R = String.raw;

const SETUP_GIT = R`<p>Installe Git (voir aussi la page <a href="#installer">Installer</a>) puis présente-toi à Git, une seule fois par machine :</p>
~~~ps
winget install --id Git.Git -e
git --version
git config --global user.name "Ton Nom"
git config --global user.email "ID+pseudo@users.noreply.github.com"
git config --global init.defaultBranch main
~~~
<p>Ensuite, refais l'exercice pour de vrai dans un dossier vide : @@mkdir essai-git; cd essai-git@@, puis les mêmes commandes. Sous PowerShell, @@echo "texte" > fichier@@ fonctionne aussi.</p>`;

export default [
  {
    id: "git-01", section: "Les bases", title: "Le modèle de Git et ton premier commit", xp: 50, setup: SETUP_GIT,
    theory: R`<p>Git est un <strong>gestionnaire de versions</strong> : il garde l'historique de ton projet sous forme de photos successives, les <strong>commits</strong>. Tout se joue entre trois zones :</p><ol><li>la <strong>copie de travail</strong> : tes fichiers, tels que tu les édites ;</li><li>l'<strong>index</strong> (staging area) : ce que tu prépares pour la prochaine photo ;</li><li>le <strong>dépôt</strong> (le dossier caché @@.git@@) : l'historique des commits.</li></ol><p>@@git add@@ fait passer un fichier de la copie de travail à l'index, @@git commit@@ fait passer l'index dans l'historique. Clique sur « Exécuter » : chaque commande s'exécute dans un dépôt simulé.</p>
~~~git
git init
echo "# Mon projet" > README.md
git status
git add README.md
git status
git commit -m "docs: ajouter le README"
git log --oneline
~~~
<p>Prends l'habitude de lancer @@git status@@ avant et après chaque commande : il dit toujours où tu en es et quoi faire ensuite. Le texte de Git est en anglais, sur ta machine comme ici.</p>`,
    quiz: [
      { q: R`Tu as modifié @@app.py@@ mais pas encore lancé @@git add@@. Que contiendra le prochain commit ?`, options: ["Ta modification", "L'ancienne version d'app.py : seul l'index est commité", "Rien, Git refuse de committer", "Les deux versions"], answer: 1, explain: "Le commit photographie l'index. Une modification non ajoutée reste dans la copie de travail." },
      { q: "Pourquoi l'index existe-t-il, au lieu de committer directement tous les fichiers modifiés ?", options: ["Pour ralentir le travail", "Pour choisir précisément ce qui entre dans chaque commit, et faire des commits cohérents", "Par compatibilité avec SVN", "Il ne sert à rien"], answer: 1, explain: "Tu peux avoir modifié trois fichiers pour deux raisons différentes : l'index te permet d'en faire deux commits distincts." }
    ],
    challenge: {
      prompt: R`<p>Le dossier contient déjà @@README.md@@ et @@app.py@@, mais ce n'est pas encore un dépôt Git. Transforme-le en dépôt et crée <strong>deux commits</strong> :</p><ol><li>@@docs: ajouter le README@@, avec seulement @@README.md@@ ;</li><li>@@feat: premier script@@, avec @@app.py@@.</li></ol><p>Commence par @@ls@@ et @@git status@@ pour observer.</p>`,
      setup: ['echo "# Calculatrice" > README.md', `echo "print('Bonjour')" > app.py`],
      checks: { initialized: true, messages: ["feat: premier script", "docs: ajouter le README"], clean: true, untracked: [], committed: { "README.md": "# Calculatrice", "app.py": "print('Bonjour')" } },
      solution: ["git init", "git add README.md", 'git commit -m "docs: ajouter le README"', "git add app.py", 'git commit -m "feat: premier script"'],
      hint: "git init d'abord. Puis, pour chaque commit : git add <le fichier>, puis git commit -m \"message\". Vérifie avec git log --oneline."
    }
  },
  {
    id: "git-02", section: "Les bases", title: "Lire l'historique et les différences", xp: 50,
    theory: R`<p>Avant de committer, on <strong>relit</strong> ce qu'on va enregistrer. Après, on retrouve l'historique.</p>
~~~git
git init
echo "def total(prix): return sum(prix)" > panier.py
git add . && git commit -m "feat: total du panier"
echo "def total(prix): return round(sum(prix), 2)" > panier.py
git diff
git add panier.py
git diff --staged
git commit -m "fix: arrondir le total"
git log --oneline
git show HEAD
~~~
<ul><li>@@git diff@@ : copie de travail par rapport à l'index (ce que tu n'as pas encore ajouté) ;</li><li>@@git diff --staged@@ : index par rapport au dernier commit (ce qui partira dans le commit) ;</li><li>@@git log --oneline@@, @@git show <commit>@@ : l'historique et le détail d'un commit.</li></ul><p><strong>Messages de commit</strong> : la convention <em>Conventional Commits</em> est très répandue en entreprise. @@feat:@@ nouvelle fonctionnalité, @@fix:@@ correction, @@docs:@@, @@refactor:@@, @@test:@@, @@chore:@@ (maintenance). Le message dit <em>pourquoi</em>, à l'impératif, en une ligne courte.</p>`,
    quiz: [
      { q: R`Après @@git add app.py@@, @@git diff@@ n'affiche plus rien. Pourquoi ?`, options: ["La modification est perdue", "git diff compare la copie de travail à l'index, qui sont maintenant identiques ; git diff --staged montre la modification", "Il faut d'abord committer", "git diff ne marche que sur les nouveaux fichiers"], answer: 1, explain: "La modification est dans l'index : elle apparaît avec git diff --staged." },
      { q: "Quel message de commit suit le mieux les bonnes pratiques ?", options: ["modifs", "fix: corriger le calcul de TVA quand le panier est vide", "J'ai changé plein de trucs dans plusieurs fichiers", "update app.py"], answer: 1, explain: "Type conventionnel, verbe à l'impératif, et le pourquoi en une ligne : on comprend le commit sans ouvrir le diff." }
    ],
    challenge: {
      prompt: R`<p>Tu as corrigé un bug dans @@app.py@@, et tu as aussi créé @@notes.txt@@ pour toi seul. Committe <strong>uniquement</strong> la correction, avec le message @@fix: éviter la division par zéro@@. @@notes.txt@@ doit rester non suivi.</p><p>Regarde d'abord la modification avec @@git diff@@.</p>`,
      setup: ["git init", 'echo "def div(a, b): return a / b" > app.py', "git add .", 'git commit -m "feat: division"', 'echo "def div(a, b): return a / b if b else None" > app.py', 'echo "idées en vrac" > notes.txt'],
      checks: { commits: 2, headMessage: "fix: éviter la division par zéro", committed: { "app.py": "def div(a, b): return a / b if b else None", "notes.txt": null }, staged: [], untracked: ["notes.txt"] },
      solution: ["git diff", "git add app.py", 'git commit -m "fix: éviter la division par zéro"'],
      hint: "N'utilise pas git add . : il ajouterait aussi notes.txt. Ajoute seulement app.py, puis committe."
    }
  },
  {
    id: "git-03", section: "Les bases", title: ".gitignore et annuler une modification locale", xp: 55,
    theory: R`<p>Certains fichiers ne doivent <strong>jamais</strong> entrer dans un dépôt : secrets (@@.env@@, clés), environnements virtuels (@@.venv/@@), fichiers générés (@@*.log@@, @@__pycache__/@@). On les liste dans @@.gitignore@@.</p>
~~~git
git init
echo "API_KEY=sk-123" > .env
echo "erreur" > debug.log
echo ".env" > .gitignore
echo "*.log" >> .gitignore
git status
!git add debug.log
~~~
<p>Pour revenir en arrière <em>avant</em> de committer :</p>
~~~git
git init
echo "v1" > app.py
git add . && git commit -m "v1"
echo "essai raté" > app.py
git restore app.py
cat app.py
echo "v2" > app.py
git add app.py
git restore --staged app.py
git status
~~~
<ul><li>@@git restore <fichier>@@ : jette les modifications de la copie de travail (définitif !) ;</li><li>@@git restore --staged <fichier>@@ : retire le fichier de l'index, sans toucher à son contenu.</li></ul><p><strong>Sécurité</strong> : un secret commité reste dans l'historique même après suppression du fichier. Sur un dépôt public, considère-le comme compromis et révoque la clé.</p>`,
    quiz: [
      { q: R`Tu as commité @@.env@@ par erreur il y a 3 commits, sur un dépôt déjà poussé sur GitHub. Que faire en premier ?`, options: ["Supprimer le fichier et committer", "Révoquer (changer) le secret immédiatement : il est déjà exposé", "Ajouter .env au .gitignore", "Rien, personne ne le verra"], answer: 1, explain: "L'historique et les copies déjà clonées gardent le secret. Il faut d'abord le révoquer, ensuite nettoyer le dépôt et ajouter .gitignore." }
    ],
    challenge: {
      prompt: R`<p>Le dossier contient un secret (@@.env@@), des logs et un environnement virtuel. Et tu as abîmé @@app.py@@ par erreur.</p><ol><li>Crée un @@.gitignore@@ qui ignore @@.env@@, tous les fichiers @@*.log@@ et le dossier @@.venv/@@ ;</li><li>committe-le avec le message @@chore: ignorer les fichiers locaux@@ ;</li><li>restaure @@app.py@@ dans son état du dernier commit.</li></ol>`,
      setup: ["git init", 'echo "print(42)" > app.py', "git add .", 'git commit -m "feat: réponse"', 'echo "SECRET=abc" > .env', 'echo "erreur" > debug.log', 'echo "trace" > serveur.log', 'echo "lib" > .venv/site.py', 'echo "oups" > app.py'],
      checks: { headMessage: "chore: ignorer les fichiers locaux", untracked: [], clean: true, files: { "app.py": "print(42)" }, committed: { ".env": null, "debug.log": null } },
      solution: ['echo ".env" > .gitignore', 'echo "*.log" >> .gitignore', 'echo ".venv/" >> .gitignore', "git add .gitignore", 'git commit -m "chore: ignorer les fichiers locaux"', "git restore app.py"],
      hint: "Crée .gitignore avec echo \"...\" > .gitignore, puis ajoute les autres motifs avec >> (ajout en fin de fichier). git status ne doit plus montrer que .gitignore et app.py."
    }
  }
];
