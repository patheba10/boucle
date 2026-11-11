/* Cours Git — chapitre « Collaborer sur GitHub » (US-3b, #11).
   Les mises en situation s'appuient sur le dépôt de Boucle lui-même : ses issues, ses PR, sa CI. */
const R = String.raw;
const ORIGIN = "https://github.com/eleve/projet.git";
const BOUCLE = "https://github.com/patheba10/boucle";

export default [
  {
    id: "git-10", section: "Collaborer sur GitHub", title: "Pull requests et GitHub Flow", xp: 70,
    theory: R`<p>Sur GitHub, on ne pousse presque jamais directement sur @@main@@. On travaille sur une branche, on la pousse, puis on ouvre une <strong>pull request</strong> (PR) : une demande de fusion que l'équipe relit et que la CI vérifie avant d'accepter. C'est le <strong>GitHub Flow</strong> :</p>
<ol><li>mettre @@main@@ à jour et créer une branche courte, nommée d'après la tâche ;</li><li>committer par petites étapes, avec des messages clairs ;</li><li>pousser la branche et ouvrir la PR, en brouillon (<em>draft</em>) si le travail n'est pas fini ;</li><li>revue de code et CI au vert ;</li><li>fusion dans @@main@@, suppression de la branche, déploiement.</li></ol>
~~~git
git init
echo "app" > app.py
git add . && git commit -m "init"
git remote add origin https://github.com/eleve/projet.git
git push -u origin main
git switch -c fix/titre-page
echo "app v2" > app.py
git commit -am "fix: corriger le titre de la page"
git push -u origin fix/titre-page
git branch -vv
~~~
<p>Après le push, GitHub affiche un bouton « Compare &amp; pull request ». Une bonne PR tient en quelques centaines de lignes au plus, et sa description répond à trois questions : <strong>pourquoi</strong>, <strong>quoi</strong>, <strong>comment c'est vérifié</strong>. Écrire @@Closes #10@@ dans la description ferme l'issue 10 automatiquement à la fusion.</p>
<p><strong>Dans Boucle.</strong> Chaque story a sa branche (@@us-3a/git-cli@@ pour l'issue #10) et sa PR. Le modèle @@.github/pull_request_template.md@@ pré-remplit la description : story liée, changements, cases à cocher pour les tests. La PR #20 a ainsi livré les chapitres « Branches » et « Réparer et collaborer », avec @@Closes #10@@.</p>`,
    setup: R`<p><strong>Ta première vraie PR</strong>, sur un dépôt d'entraînement (il ne coûte rien et tu peux le supprimer après).</p>
<ol><li>Sur GitHub : <em>New repository</em>, nom @@entrainement-pr@@, coche « Add a README file ».</li><li>Clone-le, crée une branche, modifie le README, pousse :</li></ol>
~~~bash
git clone https://github.com/<ton-compte>/entrainement-pr.git
cd entrainement-pr
git switch -c docs/presentation
echo "Je m'entraîne aux pull requests." >> README.md
git commit -am "docs: présenter le dépôt"
git push -u origin docs/presentation
~~~
<ol start="3"><li>Sur la page du dépôt, clique sur « Compare &amp; pull request ». Écris le pourquoi et le quoi, puis crée la PR.</li><li>Onglet <em>Files changed</em> : laisse-toi un commentaire sur une ligne, puis fusionne avec « Squash and merge » et supprime la branche.</li><li>En local : @@git switch main@@, @@git pull@@, @@git branch -d docs/presentation@@.</li></ol>`,
    quiz: [
      { q: "Pourquoi éviter de pousser directement sur main dans une équipe ?", options: ["Git l'interdit", "Personne ne relit le code et la CI ne le vérifie qu'après coup, quand main est peut-être déjà cassé", "C'est plus lent", "Les PR sont obligatoires pour créer un commit"], answer: 1, explain: "La PR est le point de contrôle : relecture humaine et CI passent avant que le code n'atteigne main." },
      { q: R`Que fait @@Closes #10@@ dans la description d'une PR ?`, options: ["Ferme la PR 10", "Ferme l'issue 10 quand la PR est fusionnée dans la branche par défaut", "Assigne l'issue 10 à l'auteur", "Rien, c'est un commentaire"], answer: 1, explain: "Les mots-clés Closes, Fixes ou Resolves suivis d'un numéro lient la PR à l'issue et la ferment à la fusion." }
    ],
    challenge: {
      prompt: R`<p>Un collègue vient de fusionner une PR dans @@main@@ sur @@origin@@. Prépare ta PR pour la fonctionnalité « favoris » :</p><ol><li>mets ton @@main@@ local à jour ;</li><li>crée la branche @@feat/favoris@@ <strong>à partir de ce main à jour</strong> ;</li><li>ajoute @@favoris.py@@ (contenu : @@def ajouter(): pass@@) avec le message @@feat: ajouter les favoris@@ ;</li><li>pousse la branche et relie-la à @@origin@@ pour pouvoir ouvrir la PR.</li></ol>`,
      setup: ["git init", 'echo "app" > app.py', "git add .", 'git commit -m "init"', "git remote add origin " + ORIGIN, "git push -u origin main", '@origin echo "docs" > CONTRIBUTING.md', "@origin git add .", '@origin git commit -m "docs: guide de contribution"'],
      checks: { branch: "feat/favoris", hasMessages: ["docs: guide de contribution", "feat: ajouter les favoris"], branchAt: { main: "docs: guide de contribution", "feat/favoris": "feat: ajouter les favoris" }, files: { "favoris.py": "def ajouter(): pass" }, pushed: "feat/favoris", upstream: { "feat/favoris": "origin/feat/favoris" }, clean: true },
      solution: ["git pull", "git switch -c feat/favoris", 'echo "def ajouter(): pass" > favoris.py', "git add favoris.py", 'git commit -m "feat: ajouter les favoris"', "git push -u origin feat/favoris"],
      hint: "Commence par git pull sur main. Ensuite git switch -c feat/favoris, le commit, puis git push -u origin feat/favoris : le -u relie ta branche à sa copie sur origin."
    }
  },
  {
    id: "git-11", section: "Collaborer sur GitHub", title: "Revue de code", xp: 75,
    theory: R`<p>La revue de code sert à trouver des bugs, mais surtout à <strong>partager la connaissance</strong> : après une revue, deux personnes comprennent le changement au lieu d'une. Sur GitHub, l'onglet <em>Files changed</em> permet :</p>
<ul><li>un <strong>commentaire</strong> sur une ligne ou une plage de lignes ;</li><li>une <strong>suggestion</strong> (bloc @@suggestion@@) que l'auteur applique en un clic ;</li><li>une conclusion : <em>Comment</em>, <em>Approve</em> ou <em>Request changes</em>.</li></ul>
<p><strong>Relire.</strong> Commence par la description et les tests, puis le code. Distingue le bloquant du détail : préfixe par exemple « question : », « suggestion : », « bloquant : ». Critique le code, jamais la personne, et explique le pourquoi.</p>
<p><strong>Être relu.</strong> Réponds à chaque commentaire, corrige avec de nouveaux commits (le relecteur voit ce qui a changé depuis sa revue), puis redemande une revue. Si @@main@@ a avancé entre-temps, mets ta branche à jour :</p>
~~~git
git init
echo "v1" > app.py
git add . && git commit -m "init"
git switch -c feat/export
echo "csv" > export.py
git add . && git commit -m "feat: export"
git switch main
echo "v2" > app.py
git commit -am "fix: correctif"
git switch feat/export
git rebase main
git log --oneline --all
~~~
<p>Après un rebase, la branche a été réécrite : le push normal est refusé. On utilise @@git push --force-with-lease@@, qui refuse d'écraser le distant si quelqu'un d'autre y a poussé entre-temps (contrairement à @@--force@@). C'est acceptable sur <strong>ta</strong> branche de PR, jamais sur @@main@@.</p>`,
    quiz: [
      { q: "Un relecteur te laisse « bloquant : cette requête SQL concatène l'entrée utilisateur ». Que fais-tu ?", options: ["Tu fusionnes, ce n'est qu'un avis", "Tu corriges (requête paramétrée), tu réponds au commentaire et tu redemandes une revue", "Tu fermes la PR", "Tu supprimes le commentaire"], answer: 1, explain: "Un point bloquant se règle avant la fusion. Répondre au commentaire garde la trace de la décision." },
      { q: "Pourquoi préférer --force-with-lease à --force ?", options: ["Il est plus rapide", "Il refuse d'écraser la branche distante si elle a reçu des commits que tu n'as pas vus", "Il crée une sauvegarde automatique", "Il fonctionne aussi sur main protégée"], answer: 1, explain: "--force écrase sans regarder. --force-with-lease vérifie que le distant est toujours là où tu l'as vu au dernier fetch." }
    ],
    challenge: {
      prompt: R`<p>Ta PR @@feat/recherche@@ a reçu une revue : « renomme @@cherche@@ en @@rechercher@@ ». Entre-temps, @@main@@ a avancé sur @@origin@@ (« ci: ajouter les tests »).</p><ol><li>corrige @@recherche.py@@ pour qu'il contienne @@def rechercher(): pass@@ et committe ;</li><li>remets ta branche à jour par-dessus le @@main@@ distant, <strong>sans commit de fusion</strong> ;</li><li>pousse ta branche de façon sûre.</li></ol>`,
      setup: ["git init", 'echo "app" > app.py', "git add .", 'git commit -m "init"', "git remote add origin " + ORIGIN, "git push -u origin main", "git switch -c feat/recherche", 'echo "def cherche(): pass" > recherche.py', "git add .", 'git commit -m "feat: recherche"', "git push -u origin feat/recherche", '@origin echo "pytest" > ci.txt', "@origin git add .", '@origin git commit -m "ci: ajouter les tests"'],
      checks: { branch: "feat/recherche", hasMessages: ["ci: ajouter les tests", "feat: recherche"], linear: true, committed: { "recherche.py": "def rechercher(): pass" }, pushed: "feat/recherche", clean: true },
      solution: ['echo "def rechercher(): pass" > recherche.py', 'git commit -am "refactor: renommer cherche en rechercher"', "git fetch", "git rebase origin/main", "git push --force-with-lease"],
      hint: "Après ton commit : git fetch récupère le main distant, git rebase origin/main rejoue tes commits par-dessus, et git push --force-with-lease publie la branche réécrite."
    }
  },
  {
    id: "git-12", section: "Collaborer sur GitHub", title: "Issues, milestones et modèles", xp: 40, theoryOnly: true,
    theory: R`<p>Une <strong>issue</strong> décrit un travail à faire : bug, fonctionnalité, question. Elle a un titre, une description, des <strong>labels</strong> (bug, enabler, etape-3…), une personne assignée et éventuellement une <strong>milestone</strong> qui regroupe les issues d'une livraison. Les <em>Projects</em> affichent ensuite ces issues en tableau ou en kanban.</p>
<p>Un bon ticket se suffit à lui-même : le contexte, le résultat attendu, et des <strong>critères d'acceptation</strong> vérifiables. Pour un bug : les étapes pour reproduire, ce qui était attendu, ce qui s'est passé, l'environnement.</p>
<p><strong>Modèles.</strong> Le dossier @@.github/@@ standardise la collaboration :</p>
<ul><li>@@ISSUE_TEMPLATE/*.md@@ ou @@*.yml@@ : formulaires d'issue (bug, user story) ;</li><li>@@pull_request_template.md@@ : description pré-remplie des PR ;</li><li>@@CODEOWNERS@@ : qui doit relire quoi. Exemple : @@/infra/ @equipe-plateforme@@ demande automatiquement la revue de l'équipe plateforme pour toute PR qui touche @@infra/@@ ;</li><li>@@CONTRIBUTING.md@@ : comment contribuer (branches, commits, tests).</li></ul>
<p><strong>Dans Boucle.</strong> Chaque story est une issue au format « En tant qu'élève, je veux…, afin de… » avec ses critères d'acceptation et une estimation en points. Les issues de l'étape 3 (#10, #11, #12, #18, #22) partagent la milestone « Étape 3 — Git, GitHub et CI/CD ». Les modèles sont dans @@.github/ISSUE_TEMPLATE/@@ : @@user-story.md@@ et @@bug.md@@.</p>`,
    practice: { title: "Pratique sur GitHub", body: R`<p>Dans ton dépôt d'entraînement :</p><ol><li>Onglet <em>Issues</em> : crée l'issue « Ajouter une section Installation au README », avec deux critères d'acceptation en cases à cocher (@@- [ ]@@).</li><li>Crée un label @@documentation@@ et une milestone « v0.1 », puis rattache l'issue aux deux.</li><li>Ouvre une PR qui écrit cette section, avec @@Closes #1@@ dans la description, et fusionne-la : l'issue se ferme toute seule.</li><li>Bonus : ajoute @@.github/pull_request_template.md@@ avec trois rubriques (Pourquoi, Quoi, Tests) et ouvre une nouvelle PR pour voir le modèle se remplir.</li></ol><p>Pour t'inspirer : <a href="${BOUCLE}/issues?q=is%3Aissue" target="_blank" rel="noopener">les issues de Boucle</a>.</p>` },
    quiz: [
      { q: "Quel ticket est le plus exploitable ?", options: ["« Le site bug »", "« La page Data est lente, à corriger vite »", "« Sur Chrome 131, la leçon np-03 affiche une page blanche après Vérifier ; attendu : le verdict. Étapes : … »", "« Refaire l'interface »"], answer: 2, explain: "Il donne l'environnement, les étapes, l'attendu et l'observé : n'importe qui peut reproduire le problème." },
      { q: R`Le fichier @@CODEOWNERS@@ contient @@*.tf @equipe-cloud@@. Que se passe-t-il ?`, options: ["Seule l'équipe cloud peut lire les fichiers .tf", "Toute PR qui modifie un fichier .tf demande automatiquement la revue de l'équipe cloud", "Les fichiers .tf sont ignorés par Git", "L'équipe cloud reçoit un e-mail à chaque commit"], answer: 1, explain: "CODEOWNERS désigne des relecteurs automatiques. Combiné à une règle de protection, leur approbation devient obligatoire." },
      { q: "À quoi sert une milestone ?", options: ["À marquer un commit", "À regrouper les issues et PR d'une même livraison et suivre leur avancement", "À protéger une branche", "À déclencher un déploiement"], answer: 1, explain: "Elle montre combien d'issues sont fermées sur le total d'une livraison, comme « Étape 3 » dans Boucle." }
    ]
  },
  {
    id: "git-13", section: "Collaborer sur GitHub", title: "Protéger main et choisir un flux", xp: 45, theoryOnly: true,
    theory: R`<p><strong>Protéger @@main@@.</strong> Dans <em>Settings → Rules → Rulesets</em> (ou les anciennes <em>Branch protection rules</em>), on impose par exemple :</p>
<ul><li>passer par une PR, avec au moins une approbation (et celle des CODEOWNERS) ;</li><li>des <strong>status checks</strong> obligatoires : la PR ne peut pas fusionner tant que la CI n'est pas verte ;</li><li>une branche à jour avec @@main@@ avant la fusion ;</li><li>interdiction des force push et de la suppression de la branche ;</li><li>un historique linéaire, des commits signés.</li></ul>
<p><strong>Trois façons de fusionner une PR :</strong> <em>merge commit</em> (garde tous les commits et ajoute un commit de fusion), <em>squash and merge</em> (un seul commit propre par PR) et <em>rebase and merge</em> (rejoue les commits, sans commit de fusion).</p>
<p><strong>Trois flux de travail :</strong></p>
<ul><li><strong>GitHub Flow</strong> : @@main@@ toujours déployable, une branche courte par tâche, PR, fusion, déploiement. Simple, adapté au web et au déploiement continu.</li><li><strong>Git Flow</strong> : branches @@develop@@, @@release/*@@, @@hotfix/*@@ en plus de @@main@@. Lourd, mais utile pour des versions maintenues en parallèle (logiciel installé, firmware).</li><li><strong>Trunk-based</strong> : tout le monde intègre dans @@main@@ au moins une fois par jour, avec des branches de quelques heures et des <em>feature flags</em> pour cacher le travail inachevé. C'est le flux que les études DORA associent aux équipes les plus performantes.</li></ul>
<p><strong>Dans Boucle.</strong> GitHub Flow : une branche par story, une PR, une CI verte (validation du contenu, tests unitaires et e2e) avant toute fusion, et la publication sur GitHub Pages seulement si tout est vert. Au sprint 3.1, le job e2e est tombé en panne pour une raison extérieure : la PR #19 a attendu la correction avant d'être fusionnée. Ici, c'est une règle du processus (@@docs/PROCESS.md@@) ; dans une équipe, un status check obligatoire l'impose automatiquement, sans compter sur la discipline de chacun.</p>`,
    practice: { title: "Pratique sur GitHub", body: R`<p>Dans ton dépôt d'entraînement, <em>Settings → Rules → Rulesets → New branch ruleset</em> :</p><ol><li>cible : la branche par défaut ;</li><li>active « Restrict deletions », « Block force pushes » et « Require a pull request before merging » ;</li><li>enregistre, puis essaie @@git push@@ directement sur main : le push est refusé.</li></ol><p>Sur un dépôt personnel gratuit, les rulesets marchent pour les dépôts publics. Pour un dépôt privé, il faut un plan payant.</p>` },
    quiz: [
      { q: "Ton équipe veut que main ne reçoive jamais de code dont les tests échouent. Quelle règle ?", options: ["Interdire les force push", "Exiger une PR avec le job de tests en status check obligatoire", "Activer squash and merge", "Créer une branche develop"], answer: 1, explain: "Le status check obligatoire bloque le bouton de fusion tant que la CI n'est pas verte." },
      { q: "Une appli web déployée plusieurs fois par jour, une seule version en production. Quel flux ?", options: ["Git Flow", "GitHub Flow ou trunk-based", "Une branche par développeur, fusionnée une fois par mois", "Pas de branches du tout, push direct sur main sans CI"], answer: 1, explain: "Avec une seule version en production, les branches longues de Git Flow n'apportent que des conflits." },
      { q: "Quelle stratégie donne un commit par PR sur main ?", options: ["Merge commit", "Squash and merge", "Rebase and merge", "Cherry-pick"], answer: 1, explain: "Squash regroupe tous les commits de la PR en un seul. L'historique de main reste lisible, mais le détail des étapes disparaît." }
    ]
  },
  {
    id: "git-14", section: "Collaborer sur GitHub", title: "Releases, SemVer et sécurité du compte", xp: 45, theoryOnly: true,
    theory: R`<p><strong>Releases.</strong> Une release GitHub s'attache à un tag (@@v1.4.0@@) et contient des notes de version, plus éventuellement des fichiers binaires. Les notes se rédigent à partir d'un @@CHANGELOG.md@@ (format <em>Keep a Changelog</em> : Ajouté, Modifié, Corrigé, Supprimé) ou se génèrent à partir des PR fusionnées.</p>
<p><strong>SemVer</strong> : @@MAJEUR.MINEUR.CORRECTIF@@. On incrémente MAJEUR quand on casse la compatibilité, MINEUR pour une fonctionnalité compatible, CORRECTIF pour une correction. Avant @@1.0.0@@, tout peut encore changer. Les messages de commit conventionnels (@@feat:@@, @@fix:@@, @@feat!:@@) permettent d'automatiser ce choix.</p>
<p><strong>Sécurité du compte</strong>, ce que tout recruteur DevOps attend :</p>
<ul><li>authentification à deux facteurs (2FA), idéalement avec une clé de sécurité ou une passkey ;</li><li>clé SSH @@ed25519@@ protégée par une phrase de passe pour Git ;</li><li>pour les scripts : un <em>fine-grained personal access token</em>, limité à un dépôt, aux seules permissions utiles et avec une date d'expiration. Jamais de jeton « classic » avec tous les droits ;</li><li>aucun secret dans le code : @@.env@@ dans @@.gitignore@@, secrets dans les <em>Secrets</em> du dépôt. La <em>push protection</em> de GitHub bloque un push qui contient une clé connue. Un secret poussé par erreur est compromis : on le <strong>révoque</strong>, réécrire l'historique ne suffit pas.</li></ul>
<p><strong>Dans Boucle.</strong> Le @@CHANGELOG.md@@ suit Keep a Changelog et SemVer. La version 0.6.0 clôt le sprint 3.1 : c'est un MINEUR, car le cours Git ajoute des fonctionnalités sans rien casser. Les auteurs des commits utilisent l'adresse @@…@users.noreply.github.com@@ pour ne pas exposer leur e-mail dans un dépôt public.</p>`,
    practice: { title: "Pratique sur ta machine et sur GitHub", body: R`<p><strong>Clé SSH</strong> :</p>
~~~bash
ssh-keygen -t ed25519 -C "ton-compte@users.noreply.github.com"
cat ~/.ssh/id_ed25519.pub     # à coller dans Settings → SSH and GPG keys
ssh -T git@github.com         # « Hi ton-compte! You've successfully authenticated »
~~~
<p><strong>Release</strong> : dans ton dépôt d'entraînement, <em>Releases → Draft a new release</em>, tag @@v0.1.0@@, titre « v0.1.0 », clique sur « Generate release notes », puis publie. Fais pareil pour Boucle avec la section 0.6.0 du CHANGELOG.</p>
<p><strong>Vérifie ton compte</strong> : <em>Settings → Password and authentication</em> (2FA active), puis <em>Settings → Developer settings</em> (supprime les jetons inutiles).</p>` },
    quiz: [
      { q: "Ta bibliothèque passe de 2.3.4 à … après le renommage d'une fonction publique (les anciens appels ne marchent plus) :", options: ["2.3.5", "2.4.0", "3.0.0", "2.3.4-1"], answer: 2, explain: "Casser la compatibilité impose une version MAJEURE." },
      { q: "Tu as poussé une clé AWS dans un dépôt public. Première action ?", options: ["Supprimer le fichier dans un nouveau commit", "Réécrire l'historique avec git filter-repo", "Révoquer la clé dans AWS immédiatement, puis nettoyer", "Rendre le dépôt privé"], answer: 2, explain: "Des robots scannent GitHub en continu : la clé est compromise en quelques minutes. Seule la révocation la neutralise." },
      { q: "Un script de CI doit lire un seul dépôt privé. Quel jeton ?", options: ["Ton mot de passe GitHub", "Un jeton classic avec le scope repo", "Un fine-grained token limité à ce dépôt, en lecture seule, avec expiration", "Ta clé SSH privée"], answer: 2, explain: "Le principe du moindre privilège : en cas de fuite, les dégâts restent limités à un dépôt, en lecture, pour une durée bornée." }
    ]
  }
];
