/* Cours Git — chapitre « Branches ». */
const R = String.raw;

export default [
  {
    id: "git-04", section: "Branches", title: "Les branches", xp: 55,
    theory: R`<p>Une <strong>branche</strong> n'est qu'une étiquette mobile qui pointe sur un commit. Créer une branche est instantané : Git ne copie aucun fichier. @@HEAD@@ indique la branche sur laquelle tu travailles, et le prochain commit fera avancer cette branche-là.</p>
~~~git
git init
echo "accueil" > index.html
git add . && git commit -m "feat: page d'accueil"
git switch -c feature/contact
echo "formulaire" > contact.html
git add . && git commit -m "feat: page de contact"
git log --oneline --all
git switch main
ls
git branch
~~~
<p>De retour sur @@main@@, @@contact.html@@ a disparu de la copie de travail : il n'existe que sur @@feature/contact@@. En entreprise, chaque fonctionnalité ou correction se développe sur sa propre branche (@@feature/…@@, @@fix/…@@), puis passe par une pull request avant d'être fusionnée dans @@main@@.</p><p>@@git switch@@ (Git 2.23 et plus) remplace l'ancien @@git checkout <branche>@@, que tu verras encore souvent : @@git checkout -b x@@ équivaut à @@git switch -c x@@.</p>`,
    quiz: [
      { q: "Que se passe-t-il quand tu crées une branche avec git switch -c ?", options: ["Git copie tous les fichiers dans un nouveau dossier", "Git crée une étiquette qui pointe sur le commit courant et y déplace HEAD", "Git crée un nouveau dépôt", "Git envoie la branche sur GitHub"], answer: 1, explain: "Une branche est un simple pointeur de 41 octets : c'est pour ça qu'on peut en créer autant qu'on veut." }
    ],
    challenge: {
      prompt: R`<p>Développe la fonctionnalité de connexion sur une branche dédiée :</p><ol><li>crée la branche @@feature/connexion@@ ;</li><li>ajoute un fichier @@login.py@@ contenant @@def connecter(): pass@@ et committe-le avec le message @@feat: page de connexion@@ ;</li><li>reviens sur @@main@@, qui ne doit pas contenir ce commit.</li></ol>`,
      setup: ["git init", 'echo "print(\'app\')" > app.py', "git add .", 'git commit -m "init"'],
      checks: { branch: "main", branches: ["feature/connexion", "main"], branchAt: { "feature/connexion": "feat: page de connexion", main: "init" }, files: { "login.py": null }, clean: true },
      solution: ["git switch -c feature/connexion", 'echo "def connecter(): pass" > login.py', "git add login.py", 'git commit -m "feat: page de connexion"', "git switch main"],
      hint: "git switch -c feature/connexion, puis echo, git add et git commit comme d'habitude, et enfin git switch main. git log --oneline --all montre les deux branches."
    }
  },
  {
    id: "git-05", section: "Branches", title: "Fusionner et résoudre un conflit", xp: 65,
    theory: R`<p>@@git merge <branche>@@ intègre le travail d'une branche dans la branche courante. Deux cas :</p><ul><li><strong>fast-forward</strong> : la branche courante n'a pas bougé depuis la création de l'autre. Git avance simplement l'étiquette, sans nouveau commit ;</li><li><strong>fusion à trois voies</strong> : les deux branches ont avancé. Git combine les changements depuis leur ancêtre commun et crée un <em>commit de fusion</em> à deux parents.</li></ul>
<p>Quand les deux branches ont modifié <strong>la même partie du même fichier</strong>, Git ne peut pas choisir : c'est un <strong>conflit</strong>. Il écrit les deux versions dans le fichier, entre des marqueurs.</p>
~~~git
git init
echo "couleur=bleu" > theme.txt
git add . && git commit -m "init"
git switch -c design
echo "couleur=vert" > theme.txt
git commit -am "design: vert"
git switch main
echo "couleur=rouge" > theme.txt
git commit -am "main: rouge"
!git merge design
cat theme.txt
git status
echo "couleur=vert" > theme.txt
git add theme.txt
git commit
git log --oneline
~~~
<p>La recette d'une résolution : <strong>1.</strong> ouvrir chaque fichier en conflit (@@git status@@ les liste), <strong>2.</strong> garder la bonne version et supprimer les marqueurs @@<<<<<<<@@, @@=======@@, @@>>>>>>>@@, <strong>3.</strong> @@git add@@ le fichier, <strong>4.</strong> @@git commit@@. En cas de doute, @@git merge --abort@@ remet tout comme avant la fusion.</p>`,
    quiz: [
      { q: "Dans quel cas Git fait-il une fusion fast-forward ?", options: ["Quand il n'y a pas de conflit", "Quand la branche courante est un ancêtre de la branche fusionnée : il suffit d'avancer l'étiquette", "Toujours, sauf avec --no-ff", "Quand les branches ont le même nombre de commits"], answer: 1, explain: "Si main n'a pas bougé, ses commits sont tous dans la branche fusionnée : Git déplace simplement main, sans commit de fusion." },
      { q: R`Que signifie la section entre @@=======@@ et @@>>>>>>> design@@ ?`, options: ["La version de la branche courante", "La version venant de la branche design", "L'ancêtre commun", "Le résultat proposé par Git"], answer: 1, explain: "Au-dessus de ======= : ta version (HEAD). En dessous : la version de la branche que tu fusionnes." }
    ],
    challenge: {
      prompt: R`<p>Deux branches ont modifié le port du serveur dans @@config.txt@@. Fusionne @@feature@@ dans @@main@@, résous le conflit en gardant @@port=8080@@ (la valeur de @@feature@@), puis termine la fusion.</p>`,
      setup: ["git init", 'echo "port=8000" > config.txt', "git add .", 'git commit -m "init"', "git switch -c feature", 'echo "port=8080" > config.txt', 'git commit -am "config: port 8080"', "git switch main", 'echo "port=9000" > config.txt', 'git commit -am "config: port 9000"'],
      checks: { branch: "main", mergeCommit: true, noConflict: true, committed: { "config.txt": "port=8080" }, clean: true },
      solution: ["git merge feature", "cat config.txt", 'echo "port=8080" > config.txt', "git add config.txt", "git commit"],
      hint: "git merge feature va s'arrêter sur un conflit. Réécris config.txt avec echo \"port=8080\" > config.txt (ça supprime les marqueurs), puis git add config.txt et git commit."
    }
  },
  {
    id: "git-06", section: "Branches", title: "Rebase et historique linéaire", xp: 65,
    theory: R`<p>@@git rebase main@@ <strong>rejoue</strong> les commits de ta branche par-dessus le dernier commit de @@main@@, comme si tu avais commencé ton travail à partir de la version la plus récente. Résultat : un historique linéaire, sans commit de fusion.</p>
~~~git
git init
echo "base" > a.txt
git add . && git commit -m "init"
git switch -c feature
echo "f" > f.txt
git add . && git commit -m "feat: f"
git switch main
echo "m" > m.txt
git add . && git commit -m "fix: m"
git switch feature
git rebase main
git log --oneline --all
~~~
<p>Les commits rejoués ont de <strong>nouveaux identifiants</strong> : ce sont de nouveaux commits. D'où la règle d'or : <strong>ne jamais rebaser une branche déjà partagée</strong> (poussée et utilisée par d'autres), sous peine de diverger de leurs copies. On rebase sa branche locale avant d'ouvrir une pull request ; on fusionne les branches communes.</p><p>Sur ta machine, @@git rebase -i@@ (interactif) permet aussi de réordonner, renommer ou fusionner (« squash ») des commits avant de les partager. Ce terminal simulé ne le gère pas.</p>`,
    quiz: [
      { q: "Pourquoi ne faut-il pas rebaser une branche que tes collègues ont déjà récupérée ?", options: ["Le rebase supprime des fichiers", "Le rebase crée de nouveaux commits : leur historique et le tien divergent, ce qui provoque doublons et conflits", "Git l'interdit", "Ça rend les commits plus lents"], answer: 1, explain: "Rebaser réécrit l'historique. C'est sans risque en local, problématique sur une branche partagée." }
    ],
    challenge: {
      prompt: R`<p>Ta branche @@feature@@ a été créée avant un correctif arrivé sur @@main@@. Mets-la à jour avec un <strong>rebase</strong> (pas de commit de fusion), puis intègre-la dans @@main@@ en avance rapide. L'historique de @@main@@ doit être linéaire.</p>`,
      setup: ["git init", 'echo "v1" > app.py', "git add .", 'git commit -m "init"', "git switch -c feature", 'echo "def exporter(): pass" > export.py', "git add .", 'git commit -m "feat: export"', 'echo "def importer(): pass" > import.py', "git add .", 'git commit -m "feat: import"', "git switch main", 'echo "v1 corrigé" > app.py', 'git commit -am "fix: correctif urgent"', "git switch feature"],
      checks: { branch: "main", linear: true, messages: ["feat: import", "feat: export", "fix: correctif urgent", "init"], branchAt: { feature: "feat: import" }, clean: true },
      solution: ["git rebase main", "git log --oneline --all", "git switch main", "git merge feature"],
      hint: "Depuis feature : git rebase main. Ensuite git switch main puis git merge feature : comme feature contient déjà main, ce sera un fast-forward."
    }
  }
];
