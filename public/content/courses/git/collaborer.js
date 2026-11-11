/* Cours Git — chapitre « Réparer et collaborer ». */
const R = String.raw;
const ORIGIN = "https://github.com/eleve/projet.git";

export default [
  {
    id: "git-07", section: "Réparer et collaborer", title: "Annuler sans tout casser", xp: 65,
    theory: R`<p>Git offre plusieurs façons de revenir en arrière. Le bon choix dépend d'une question : <strong>le commit a-t-il déjà été partagé ?</strong></p>
<ul><li>@@git commit --amend@@ : corriger le dernier commit (message, fichier oublié). Local uniquement.</li><li>@@git reset --soft HEAD~1@@ : défaire le dernier commit en gardant ses changements dans l'index.</li><li>@@git reset HEAD~1@@ (mixed) : pareil, mais les changements reviennent non indexés.</li><li>@@git reset --hard HEAD~1@@ : tout jeter, définitivement. À manier avec précaution.</li><li>@@git revert <commit>@@ : crée un <strong>nouveau</strong> commit qui annule l'ancien. L'historique est préservé : c'est <strong>la</strong> méthode pour un commit déjà poussé.</li><li>@@git stash@@ / @@git stash pop@@ : mettre de côté du travail en cours, puis le reprendre.</li></ul>
~~~git
git init
echo "v1" > app.py
git add . && git commit -m "v1"
echo "v2 cassée" > app.py
git commit -am "v2"
git revert HEAD
cat app.py
git log --oneline
echo "brouillon" >> app.py
git stash
git status
git stash pop
~~~`,
    quiz: [
      { q: "Un commit bogué a été poussé sur main il y a une heure, et tes collègues ont déjà tiré. Que faire ?", options: ["git reset --hard HEAD~1 puis git push --force", "git revert <commit> puis git push", "Supprimer le dépôt", "git commit --amend"], answer: 1, explain: "revert ajoute un commit d'annulation sans réécrire l'historique partagé. reset suivi d'un push --force casserait les copies de tes collègues." },
      { q: "Différence entre git reset --soft HEAD~1 et git reset --hard HEAD~1 ?", options: ["Aucune", "--soft garde les changements (indexés), --hard les supprime de la copie de travail", "--hard garde les changements", "--soft supprime aussi les fichiers non suivis"], answer: 1, explain: "--hard est la seule variante destructrice : les modifications non commitées sont perdues." }
    ],
    challenge: {
      prompt: R`<p>Le commit @@feat: bouton rouge@@ a été <strong>poussé</strong> sur @@origin@@ et casse le site. Tu étais en train de modifier @@app.py@@ (travail non commité, à garder !).</p><ol><li>mets ton travail en cours de côté ;</li><li>annule @@feat: bouton rouge@@ <strong>sans réécrire l'historique</strong> ;</li><li>pousse l'annulation ;</li><li>récupère ton travail en cours.</li></ol>`,
      setup: ["git init", 'echo "v1" > app.py', "git add .", 'git commit -m "init"', "git remote add origin " + ORIGIN, "git push -u origin main", 'echo "def exporter(): pass" > export.py', "git add .", 'git commit -m "feat: export CSV"', 'echo "color: red" > bouton.css', "git add .", 'git commit -m "feat: bouton rouge"', "git push", 'echo "v1 + travail en cours" > app.py'],
      checks: { hasMessages: ["feat: bouton rouge", 'Revert "feat: bouton rouge"'], committed: { "bouton.css": null, "export.py": "def exporter(): pass" }, pushed: "main", files: { "app.py": "v1 + travail en cours" }, stash: 0 },
      solution: ["git stash", "git revert HEAD", "git push", "git stash pop"],
      hint: "git stash met ton travail de côté. git revert HEAD annule le dernier commit en en créant un nouveau. Puis git push, et git stash pop pour reprendre ton travail."
    }
  },
  {
    id: "git-08", section: "Réparer et collaborer", title: "Travailler avec un dépôt distant", xp: 70,
    theory: R`<p>Un <strong>dépôt distant</strong> (sur GitHub, GitLab…) est une copie partagée du projet, appelée par convention @@origin@@. Ta copie locale garde des <em>références distantes</em> (@@origin/main@@) : la dernière position connue de chaque branche distante.</p>
~~~git
git init
echo "v1" > app.py
git add . && git commit -m "init"
git remote add origin https://github.com/eleve/projet.git
git push -u origin main
echo "v2" > app.py
git commit -am "feat: v2"
git status
git push
git log --oneline
~~~
<ul><li>@@git push -u origin main@@ : publie la branche et la relie à @@origin/main@@ (ensuite, @@git push@@ et @@git pull@@ suffisent) ;</li><li>@@git fetch@@ : télécharge les nouveautés sans toucher à tes fichiers ;</li><li>@@git pull@@ = @@fetch@@ + @@merge@@ de la branche distante.</li></ul><p>Si un collègue a poussé avant toi, ton push est <strong>rejeté</strong> : Git refuse d'écraser son travail. Il faut d'abord intégrer ses commits (@@git pull@@), puis repousser. Ne réponds jamais à un refus par @@git push --force@@ sur une branche partagée.</p>`,
    quiz: [
      { q: R`@@git status@@ affiche « Your branch is ahead of 'origin/main' by 2 commits ». Que faire pour publier ?`, options: ["git pull", "git push", "git fetch", "git merge origin/main"], answer: 1, explain: "Tu as 2 commits locaux que le distant n'a pas : git push les publie." },
      { q: "Quelle est la différence entre git fetch et git pull ?", options: ["Aucune", "fetch télécharge sans modifier ta branche ; pull télécharge puis fusionne", "pull ne télécharge que les tags", "fetch envoie tes commits"], answer: 1, explain: "fetch est sans risque : il met à jour origin/main. pull ajoute la fusion dans ta branche courante." }
    ],
    challenge: {
      prompt: R`<p>Tu as committé @@feat: recherche@@ en local. Pendant ce temps, une collègue a poussé @@docs: guide d'installation@@ sur @@origin@@. Publie ton commit : ton premier @@git push@@ sera refusé, à toi de régler la situation proprement (sans @@--force@@).</p>`,
      setup: ["git init", 'echo "app" > app.py', "git add .", 'git commit -m "init"', "git remote add origin " + ORIGIN, "git push -u origin main", '@origin echo "pip install -r requirements.txt" > INSTALL.md', "@origin git add .", "@origin git commit -m \"docs: guide d'installation\"", 'echo "def chercher(): pass" > recherche.py', "git add .", 'git commit -m "feat: recherche"'],
      checks: { branch: "main", hasMessages: ["feat: recherche", "docs: guide d'installation"], files: { "INSTALL.md": "pip install -r requirements.txt", "recherche.py": "def chercher(): pass" }, pushed: "main", clean: true },
      solution: ["git push", "git pull", "git push"],
      hint: "Lis le message d'erreur du push : il propose git pull. Une fois les commits de ta collègue intégrés (fusion automatique, pas de conflit), git push passe."
    }
  },
  {
    id: "git-09", section: "Réparer et collaborer", title: "Défi : hotfix en production", xp: 90,
    theory: R`<p>Scénario classique en entreprise, et question d'entretien. La version @@v1.0.0@@ est en production, depuis @@main@@. Sur @@develop@@, l'équipe a mélangé de nouvelles fonctionnalités pas finies et un correctif urgent. Il faut livrer <strong>seulement le correctif</strong>.</p><p>@@git cherry-pick <commit>@@ copie un commit précis sur la branche courante. Les <strong>tags</strong> marquent les versions livrées, selon le versionnement sémantique (SemVer) : @@MAJEUR.MINEUR.CORRECTIF@@. Un correctif fait passer @@1.0.0@@ à @@1.0.1@@.</p>
~~~git
git init
echo "taux=0.15" > tva.py
git add . && git commit -m "release"
git tag v1.0.0
git switch -c develop
echo "wip" > tableau.py
git add . && git commit -m "feat: tableau"
echo "taux=0.14975" > tva.py
git commit -am "fix: taux de TVA"
git switch main
git cherry-pick develop
git tag v1.0.1
git log --oneline --all
~~~
<p>On désigne un commit par son identifiant (lu dans @@git log --oneline@@), ou relativement à une branche : @@develop~1@@ est le commit juste avant le sommet de @@develop@@.</p>`,
    quiz: [
      { q: "Un correctif de bug sans changement d'API fait passer la version 2.3.4 à :", options: ["3.0.0", "2.4.0", "2.3.5", "2.3.4-fix"], answer: 2, explain: "SemVer : MAJEUR pour une rupture de compatibilité, MINEUR pour une fonctionnalité compatible, CORRECTIF pour une correction." }
    ],
    challenge: {
      prompt: R`<p>Sur @@develop@@, trois commits attendent : deux fonctionnalités pas prêtes et @@fix: corriger le calcul de la TVA@@. Livre <strong>uniquement le correctif</strong> en production :</p><ol><li>applique ce seul commit sur @@main@@ ;</li><li>marque la version @@v1.0.1@@ ;</li><li>pousse @@main@@ <strong>et</strong> le tag sur @@origin@@.</li></ol><p>Commence par @@git log --oneline develop@@ pour repérer le bon commit.</p>`,
      setup: ["git init", 'echo "taux = 0.15" > tva.py', 'echo "accueil" > index.html', "git add .", 'git commit -m "release 1.0"', "git tag v1.0.0", "git remote add origin " + ORIGIN, "git push -u origin main", "git push --tags", "git switch -c develop", 'echo "graphiques" > dashboard.py', "git add .", 'git commit -m "feat: nouveau tableau de bord"', 'echo "taux = 0.14975" > tva.py', 'git commit -am "fix: corriger le calcul de la TVA"', 'echo "mode sombre" > theme.css', "git add .", 'git commit -m "feat: thème sombre"'],
      checks: { branch: "main", headMessage: "fix: corriger le calcul de la TVA", lacksMessages: ["feat: nouveau tableau de bord", "feat: thème sombre"], committed: { "tva.py": "taux = 0.14975" }, tags: { "v1.0.0": "release 1.0", "v1.0.1": "fix: corriger le calcul de la TVA" }, pushed: "main", remoteTags: ["v1.0.1"] },
      solution: ["git log --oneline develop", "git switch main", "git cherry-pick develop~1", "git tag v1.0.1", "git push", "git push --tags"],
      hint: "Sur main : git cherry-pick avec l'identifiant du commit de correctif (ou develop~1). Puis git tag v1.0.1, git push, et git push --tags pour publier le tag."
    }
  }
];
