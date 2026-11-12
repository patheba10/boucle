/* Cours CI/CD — chapitres 7 (construire et publier), 8 (déployer) et 9 (Terraform dans le pipeline). */
import { Y } from "./tag.js";

export default [
  {
    id: "ci-13", section: "Construire et publier", title: "Images Docker et registres", xp: 85,
    theory: Y`<p>Une image Docker emballe l'application et tout ce qu'il lui faut pour tourner : le même artefact part en test, en préproduction et en production. Le pipeline la construit à partir d'un @@Dockerfile@@ :</p>
~~~docker
FROM python:3.13-slim AS base
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
USER 1000
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
~~~
<p>Puis il la pousse dans un <strong>registre</strong> : GitHub Container Registry (@@ghcr.io@@), Amazon ECR, Docker Hub, Azure Container Registry… Les actions officielles de Docker font le travail :</p>
<ul><li>@@docker/setup-buildx-action@@ : le moteur de build (cache, multi-architecture) ;</li><li>@@docker/login-action@@ : connexion au registre. Pour @@ghcr.io@@, le @@GITHUB_TOKEN@@ suffit, avec @@packages: write@@ ;</li><li>@@docker/metadata-action@@ : calcule les tags (@@sha-a1b2c3d@@, @@1.4.2@@, @@main@@) à partir de l'événement ;</li><li>@@docker/build-push-action@@ : construit et, si @@push: true@@, publie.</li></ul>
<p><strong>Quels tags ?</strong> Un tag immuable par version (@@1.4.2@@) ou par commit (@@sha-…@@) pour savoir exactement ce qui tourne et revenir en arrière. @@latest@@ est pratique mais ambigu : on ne déploie jamais @@latest@@ en production.</p>
<p><strong>Sur une PR</strong>, on construit pour vérifier que le Dockerfile marche, sans publier : les PR venant d'un fork n'ont d'ailleurs pas le droit d'écrire dans le registre.</p>`,
    quiz: [
      { q: "Pourquoi ne pas déployer l'image taguée latest en production ?", options: ["latest est plus lent", "latest change à chaque build : on ne sait plus quelle version tourne, et on ne peut pas revenir précisément en arrière", "Les registres refusent latest", "latest est réservé aux tests"], answer: 1, explain: "Un tag immuable (version ou SHA) rend chaque déploiement traçable et réversible." },
      { q: "Quelle permission faut-il pour pousser une image sur ghcr.io avec le GITHUB_TOKEN ?", options: ["contents: write", "packages: write", "id-token: write", "actions: write"], answer: 1, explain: "Les images de ghcr.io sont des « packages » GitHub." }
    ],
    challenge: {
      prompt: Y`<p>Écris le job @@image@@ :</p><ol><li>il tourne sur les PR vers @@main@@, les pushes sur @@main@@ et les tags @@v*@@ ;</li><li>étapes : checkout, @@docker/setup-buildx-action@v4@@, @@docker/login-action@v4@@ vers @@ghcr.io@@ (utilisateur @@\${{ github.actor }}@@, mot de passe @@\${{ secrets.GITHUB_TOKEN }}@@), @@docker/metadata-action@v6@@ (id @@meta@@, image @@ghcr.io/\${{ github.repository }}@@), puis @@docker/build-push-action@v7@@ avec les tags de @@meta@@ ;</li><li>sur une PR, la connexion au registre est sautée et l'image n'est pas poussée (@@push: \${{ github.event_name != 'pull_request' }}@@) ;</li><li>permissions : @@contents: read@@ et @@packages: write@@, rien d'autre.</li></ol>`,
      starter: Y`name: Image
on:
  pull_request:
    branches: [main]
jobs:
  image:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: docker build -t app .
`,
      solution: Y`name: Image
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
    tags: ["v*"]
permissions:
  contents: read
  packages: write
jobs:
  image:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: docker/setup-buildx-action@v4
      - name: Connexion à ghcr.io
        if: github.event_name != 'pull_request'
        uses: docker/login-action@v4
        with:
          registry: ghcr.io
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}
      - id: meta
        uses: docker/metadata-action@v6
        with:
          images: ghcr.io/\${{ github.repository }}
      - uses: docker/build-push-action@v7
        with:
          push: \${{ github.event_name != 'pull_request' }}
          tags: \${{ steps.meta.outputs.tags }}
          labels: \${{ steps.meta.outputs.labels }}
`,
      checks: {
        triggers: ["pull_request", "push"], maxPermissions: { contents: "read", packages: "write" },
        uses: { image: ["docker/setup-buildx-action", "docker/login-action", "docker/metadata-action", "docker/build-push-action"] },
        with: { image: { "docker/login-action": { registry: "ghcr.io" }, "docker/build-push-action": { push: "${{ github.event_name != 'pull_request' }}", tags: "${{ steps.meta.outputs.tags }}" } } },
        order: { image: ["actions/checkout", "docker/setup-buildx-action", "docker/metadata-action", "docker/build-push-action"] },
        scenarios: [
          { event: { name: "pull_request", head: "feature/api", base: "main" }, run: ["image"], stepsSkipped: { image: ["docker/login-action"] } },
          { event: { name: "push", branch: "main" }, run: ["image"], stepsRun: { image: ["docker/login-action"] } },
          { event: { name: "push", tag: "v1.4.2" }, run: ["image"] },
          { event: { name: "push", branch: "feature/api" }, triggered: false }
        ]
      },
      hint: "Ajoute push (branches et tags) dans on, le bloc permissions, et les actions Docker dans l'ordre. L'étape de connexion porte « if: github.event_name != 'pull_request' ». Si tu lui donnes un name, garde « docker/login-action » dans uses."
    }
  },
  {
    id: "ci-14", section: "Construire et publier", title: "Versions et releases automatiques", xp: 80,
    theory: Y`<p>Une <strong>release</strong> fige une version : un tag Git, des notes de version et des fichiers (paquet, binaire, archive). L'automatiser évite les oublis et garantit que les fichiers publiés sortent du pipeline, pas d'un poste de travail.</p>
<p><strong>Le schéma le plus simple</strong> : on pousse un tag @@v1.4.2@@, un workflow déclenché par @@on: push: tags: ["v*"]@@ construit le paquet et crée la release avec la CLI @@gh@@, déjà installée sur les runners :</p>
~~~yaml
name: Release
on:
  push:
    tags: ["v*.*.*"]
jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v7
      - run: python -m build
      - run: gh release create "$GITHUB_REF_NAME" dist/* --generate-notes
        env:
          GH_TOKEN: \${{ github.token }}
~~~
<p><strong>Aller plus loin.</strong> Avec des messages de commit conventionnels (@@feat:@@, @@fix:@@, @@feat!:@@), des outils comme <em>release-please</em> ou <em>semantic-release</em> calculent la prochaine version SemVer, tiennent le CHANGELOG à jour et ouvrent une PR de release. Fusionner cette PR crée le tag et la release.</p>
<p><strong>Dans Boucle.</strong> Les versions suivent SemVer et le CHANGELOG suit Keep a Changelog ; chaque fin de sprint passe par une PR @@chore(release)@@. Les releases sont encore créées à la main : c'est exactement ce qu'un workflow comme celui-ci automatiserait.</p>`,
    quiz: [
      { q: "Le workflow de release doit-il tourner à chaque push sur main ?", options: ["Oui, pour publier le plus souvent possible", "Non : il tourne quand on pousse un tag de version, ce qui rend chaque release volontaire et traçable", "Seulement le vendredi", "Seulement sur les PR"], answer: 1, explain: "Le tag est la décision de publier ; main peut avancer sans créer une release à chaque commit." },
      { q: "Quelle permission pour créer une release avec le GITHUB_TOKEN ?", options: ["packages: write", "contents: write", "pull-requests: write", "releases: write"], answer: 1, explain: "Les releases et les tags font partie du « contents » du dépôt. Il n'existe pas de scope releases." }
    ],
    challenge: {
      prompt: Y`<p>Ce workflow crée une release à chaque push sur @@main@@, avec tous les droits. Corrige-le :</p><ol><li>il ne doit se déclencher que sur un push de tag @@v*@@ ;</li><li>seul le job @@release@@ a le droit d'écrire : @@contents: write@@ ; le workflow garde @@contents: read@@ ;</li><li>@@release@@ attend que @@tests@@ réussisse.</li></ol>`,
      starter: Y`name: Release
on:
  push:
    branches: [main]
permissions: write-all
jobs:
  tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: pytest -q
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: python -m build
      - run: gh release create "$GITHUB_REF_NAME" dist/* --generate-notes
        env:
          GH_TOKEN: \${{ github.token }}
`,
      solution: Y`name: Release
on:
  push:
    tags: ["v*"]
permissions:
  contents: read
jobs:
  tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: pytest -q
  release:
    needs: tests
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v7
      - run: python -m build
      - run: gh release create "$GITHUB_REF_NAME" dist/* --generate-notes
        env:
          GH_TOKEN: \${{ github.token }}
`,
      checks: {
        onlyTriggers: ["push"], needs: { release: ["tests"] }, permissions: { workflow: { contents: "read" }, release: { contents: "write" } }, lacks: ["write-all"],
        run: { release: ["gh release create"] },
        scenarios: [
          { event: { name: "push", tag: "v1.4.2" }, run: ["tests", "release"] },
          { event: { name: "push", branch: "main" }, triggered: false },
          { event: { name: "push", tag: "v1.4.2" }, fail: ["tests"], skip: ["release"] }
        ]
      },
      hint: "Remplace branches par « tags: [\"v*\"] ». permissions: contents: read au premier niveau, et dans release : needs: tests et permissions: contents: write."
    }
  },
  {
    id: "ci-15", section: "Déployer", title: "Environnements et approbations", xp: 85,
    theory: Y`<p>Un <strong>environnement</strong> GitHub (<em>Settings → Environments</em>) représente une cible : @@staging@@, @@production@@. Un job s'y rattache avec @@environment:@@, et l'environnement apporte :</p>
<ul><li>ses propres <strong>secrets et variables</strong> (l'URL de la base de production n'est visible que des jobs de production) ;</li><li>des <strong>règles de protection</strong> : une ou plusieurs personnes doivent approuver avant que le job démarre, un délai d'attente, ou seulement certaines branches autorisées ;</li><li>un <strong>historique des déploiements</strong>, avec l'URL affichée sur la PR et dans l'onglet <em>Deployments</em>.</li></ul>
~~~yaml
name: Livraison
on:
  push:
    branches: [main]
jobs:
  staging:
    runs-on: ubuntu-latest
    environment:
      name: staging
      url: https://staging.exemple.ca
    steps:
      - run: ./deploy.sh staging
  production:
    needs: staging
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://exemple.ca
    concurrency:
      group: production
      cancel-in-progress: false
    steps:
      - run: ./deploy.sh production
~~~
<p>C'est la <strong>livraison continue</strong> : chaque fusion part automatiquement en préproduction, et la production attend un clic d'approbation (réglé dans l'environnement, pas dans le YAML). Pour du déploiement continu, on retire l'approbation. Avec OIDC, la politique de confiance du rôle cloud peut exiger l'environnement @@production@@ : un job qui ne s'y rattache pas ne peut pas toucher la production.</p>
<p><strong>Où déployer ?</strong> GitHub Pages pour un site statique (comme Boucle), Vercel ou Netlify pour un frontend, AWS (S3 et CloudFront, ECS, Lambda), Azure ou Google Cloud pour le reste. Le YAML change peu : une étape d'authentification, puis une commande de déploiement.</p>`,
    quiz: [
      { q: "Où règle-t-on « deux personnes doivent approuver avant la production » ?", options: ["Dans le YAML, avec une clé approve:", "Dans les règles de protection de l'environnement production, sur GitHub", "Dans CODEOWNERS", "Dans le Dockerfile"], answer: 1, explain: "Le YAML rattache le job à l'environnement ; les règles (approbateurs, délai, branches) sont dans les réglages de l'environnement." },
      { q: "Pourquoi mettre les secrets de production dans l'environnement production plutôt que dans le dépôt ?", options: ["C'est plus rapide", "Seuls les jobs rattachés à cet environnement (et approuvés) peuvent les lire", "Les secrets du dépôt expirent", "C'est obligatoire pour AWS"], answer: 1, explain: "Un job de tests compromis sur une PR ne verra jamais les secrets de production." }
    ],
    challenge: {
      prompt: Y`<p>Tout part directement en production, même depuis une PR. Organise la livraison :</p><ol><li>@@tests@@ tourne sur chaque push et PR ;</li><li>@@deploy-staging@@ (environnement @@staging@@) attend @@tests@@ et ne tourne que pour un push sur @@main@@ ;</li><li>@@deploy-production@@ (environnement @@production@@) attend @@deploy-staging@@ ;</li><li>deux déploiements en production ne doivent jamais tourner en même temps, et un déploiement en cours n'est jamais annulé.</li></ol>`,
      starter: Y`name: Livraison
on: [push, pull_request]
jobs:
  tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: pytest -q
  deploy:
    runs-on: ubuntu-latest
    steps:
      - run: ./deploy.sh production
`,
      solution: Y`name: Livraison
on: [push, pull_request]
jobs:
  tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: pytest -q
  deploy-staging:
    needs: tests
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - run: ./deploy.sh staging
  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production
    concurrency:
      group: production
      cancel-in-progress: false
    steps:
      - run: ./deploy.sh production
`,
      checks: {
        needs: { "deploy-staging": ["tests"], "deploy-production": ["deploy-staging"] }, environment: { "deploy-staging": "staging", "deploy-production": "production" },
        jobConcurrency: { "deploy-production": { cancel: false } },
        scenarios: [
          { event: { name: "pull_request", head: "feature/x", base: "main" }, run: ["tests"], skip: ["deploy-staging", "deploy-production"] },
          { event: { name: "push", branch: "feature/x" }, run: ["tests"], skip: ["deploy-staging", "deploy-production"] },
          { event: { name: "push", branch: "main" }, run: ["tests", "deploy-staging", "deploy-production"] },
          { event: { name: "push", branch: "main" }, fail: ["deploy-staging"], skip: ["deploy-production"] }
        ]
      },
      hint: "Renomme deploy en deploy-production et ajoute deploy-staging. Le if (push sur main) suffit sur staging : production attend staging, donc elle est sautée avec lui. Ajoute environment et, sur production, un bloc concurrency avec cancel-in-progress: false."
    }
  },
  {
    id: "ci-16", section: "Déployer", title: "Stratégies de déploiement et rollback", xp: 80,
    theory: Y`<p>Déployer, c'est remplacer une version qui marche par une autre, sans couper le service. Les stratégies classiques :</p>
<ul><li><strong>Recreate</strong> : on arrête tout, on redémarre en nouvelle version. Simple, mais avec une coupure ;</li><li><strong>Rolling</strong> : on remplace les instances une par une (le défaut de Kubernetes). Pas de coupure, mais deux versions cohabitent un moment ;</li><li><strong>Blue/green</strong> : la nouvelle version (verte) tourne à côté de l'ancienne (bleue), on la teste, puis on bascule le trafic d'un coup. Le retour arrière est une simple rebascule, mais l'infrastructure est doublée pendant la bascule ;</li><li><strong>Canary</strong> : 5 % du trafic va d'abord sur la nouvelle version ; on surveille les erreurs et la latence, puis on monte à 25 %, 50 %, 100 %. Un problème ne touche qu'une petite partie des utilisateurs ;</li><li><strong>Feature flags</strong> : le code est déployé mais la fonctionnalité reste éteinte, et on l'active sans redéployer (pour une équipe, un pays, un pourcentage).</li></ul>
<p><strong>Revenir en arrière.</strong> Un <em>rollback</em> redéploie la version précédente, d'où l'intérêt des images taguées par version. L'alternative est le <em>roll forward</em> : corriger vite et redéployer. Le piège classique est la base de données : une migration qui supprime une colonne empêche l'ancienne version de redémarrer. On procède en deux temps (<em>expand / contract</em>) : ajouter d'abord, supprimer seulement quand plus aucune version ne s'en sert.</p>
<p>Un workflow de rollback se lance à la main, avec des paramètres :</p>
~~~yaml
name: Rollback
on:
  workflow_dispatch:
    inputs:
      version:
        description: "Version à redéployer (ex. v1.4.1)"
        required: true
        type: string
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - run: ./deploy.sh "\${{ inputs.version }}"
~~~`,
    quiz: [
      { q: "Tu veux exposer une nouvelle version à 5 % des utilisateurs, surveiller, puis élargir. Quelle stratégie ?", options: ["Recreate", "Canary", "Blue/green", "Rolling"], answer: 1, explain: "Le canary limite l'exposition à une fraction du trafic avant la généralisation." },
      { q: "Après un déploiement, la nouvelle version casse. L'ancienne ne redémarre pas : la migration a supprimé une colonne. Quelle pratique l'aurait évité ?", options: ["Déployer le vendredi soir", "Les migrations en deux temps (expand / contract) : on ne supprime une colonne qu'une fois qu'aucune version ne s'en sert", "Désactiver les tests", "Utiliser latest"], answer: 1, explain: "Le code et le schéma doivent rester compatibles une version en arrière pour qu'un rollback soit possible." },
      { q: "Blue/green : quel est le coût principal ?", options: ["Une coupure de service", "Deux environnements complets en même temps pendant la bascule", "Impossible de revenir en arrière", "Il faut Kubernetes"], answer: 1, explain: "On paie la double infrastructure ; en échange, la bascule et le retour arrière sont instantanés." }
    ],
    challenge: {
      prompt: Y`<p>Écris un workflow de rollback lancé à la main :</p><ol><li>il ne se déclenche que manuellement, avec deux paramètres : @@version@@ (obligatoire, texte) et @@environnement@@ (choix entre @@staging@@ et @@production@@, @@staging@@ par défaut) ;</li><li>le job @@deploy@@ se rattache à l'environnement choisi (@@\${{ inputs.environnement }}@@) et lance @@./deploy.sh@@ avec la version choisie ;</li><li>une étape « Vérifier la santé » (@@./healthcheck.sh@@) ne tourne <strong>que pour la production</strong>.</li></ol>`,
      starter: Y`name: Rollback
on: push
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - run: ./deploy.sh latest
`,
      solution: Y`name: Rollback
on:
  workflow_dispatch:
    inputs:
      version:
        description: "Version à redéployer (ex. v1.4.1)"
        required: true
        type: string
      environnement:
        description: Cible
        type: choice
        options: [staging, production]
        default: staging
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: \${{ inputs.environnement }}
    steps:
      - run: ./deploy.sh "\${{ inputs.version }}"
      - name: Vérifier la santé
        if: inputs.environnement == 'production'
        run: ./healthcheck.sh
`,
      checks: {
        onlyTriggers: ["workflow_dispatch"], dispatchInputs: ["version", "environnement"], environment: { deploy: "${{ inputs.environnement }}" },
        run: { deploy: ["./deploy.sh", "inputs.version"] }, lacks: ["deploy.sh latest"],
        scenarios: [
          { event: { name: "workflow_dispatch", inputs: { version: "v1.4.1", environnement: "production" } }, run: ["deploy"], stepsRun: { deploy: ["Vérifier la santé"] } },
          { event: { name: "workflow_dispatch", inputs: { version: "v1.4.1" } }, run: ["deploy"], stepsSkipped: { deploy: ["Vérifier la santé"] } },
          { event: { name: "push", branch: "main" }, triggered: false }
        ]
      },
      hint: "Sous on: workflow_dispatch: inputs:, décris version (required, type: string) et environnement (type: choice, options, default: staging). L'étape de santé porte « if: inputs.environnement == 'production' »."
    }
  },
  {
    id: "ci-17", section: "Infrastructure dans le pipeline", title: "Terraform : plan sur la PR, apply après fusion", xp: 90,
    theory: Y`<p>Avec Terraform, l'infrastructure est décrite dans des fichiers @@.tf@@ versionnés. Le pipeline applique la même discipline que pour le code :</p>
<ol><li><strong>sur la PR</strong> : @@terraform fmt -check@@, @@validate@@, puis @@plan@@, qui affiche ce qui va être créé, modifié ou <strong>détruit</strong>. Le plan est publié en commentaire de la PR : les relecteurs valident le changement d'infrastructure, pas seulement le code ;</li><li><strong>après la fusion sur main</strong> : @@terraform apply@@, dans l'environnement @@production@@ protégé.</li></ol>
~~~hcl
terraform {
  backend "s3" {
    bucket       = "boucle-tfstate"
    key          = "site/terraform.tfstate"
    region       = "ca-central-1"
    use_lockfile = true
  }
}

resource "aws_s3_bucket" "site" {
  bucket = "boucle-site"
}
~~~
<p>Le <strong>state</strong> (ce que Terraform sait de l'infrastructure réelle) vit dans un stockage partagé, ici S3 avec un verrou : deux pipelines ne peuvent pas l'écrire en même temps. Le pipeline s'authentifie par OIDC (chapitre 6) : un rôle en lecture pour le plan des PR, un rôle en écriture réservé à l'environnement de production pour l'apply.</p>
<p>Un @@plan@@ planifié chaque nuit détecte aussi la <strong>dérive</strong> : quelqu'un a modifié une ressource à la main dans la console. Le chapitre Terraform du parcours Cloud détaillera le langage lui-même.</p>`,
    quiz: [
      { q: "Pourquoi lancer terraform plan sur chaque PR ?", options: ["Pour gagner du temps à l'apply", "Pour que les relecteurs voient exactement ce qui sera créé, modifié ou détruit avant d'accepter le changement", "Parce qu'apply ne marche pas sans plan sur PR", "Pour mettre à jour le state"], answer: 1, explain: "Une ligne de .tf peut détruire une base de données : le plan rend l'impact visible en revue." },
      { q: "Deux pipelines lancent terraform apply en même temps sur le même state. Quel mécanisme évite la casse ?", options: ["Le cache GitHub", "Le verrou du backend de state (use_lockfile sur S3, ou DynamoDB autrefois)", "fail-fast", "Les artefacts"], answer: 1, explain: "Le second apply attend ou échoue au lieu d'écrire un state concurrent." }
    ],
    challenge: {
      prompt: Y`<p>Ce workflow applique l'infrastructure sur chaque PR, avant toute revue. Corrige-le :</p><ol><li>il se déclenche sur les PR vers @@main@@ et les pushes sur @@main@@ ;</li><li>toujours : @@terraform init@@, @@terraform fmt -check@@, @@terraform validate@@ et @@terraform plan@@ ;</li><li>@@terraform apply@@ seulement pour un <strong>push sur main</strong> ;</li><li>authentification par OIDC : permissions @@id-token: write@@, @@contents: read@@ et @@pull-requests: write@@ (pour commenter le plan).</li></ol>`,
      starter: Y`name: Infra
on: pull_request
jobs:
  terraform:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: infra
    steps:
      - uses: actions/checkout@v7
      - uses: hashicorp/setup-terraform@v4
      - run: terraform init
      - run: terraform apply -auto-approve
`,
      solution: Y`name: Infra
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
permissions:
  id-token: write
  contents: read
  pull-requests: write
jobs:
  terraform:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: infra
    steps:
      - uses: actions/checkout@v7
      - uses: aws-actions/configure-aws-credentials@v6
        with:
          role-to-assume: arn:aws:iam::123456789012:role/terraform
          aws-region: ca-central-1
      - uses: hashicorp/setup-terraform@v4
      - run: terraform init
      - run: terraform fmt -check
      - run: terraform validate
      - run: terraform plan -out=tfplan
      - name: terraform apply
        if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        run: terraform apply -auto-approve tfplan
`,
      checks: {
        triggers: ["pull_request", "push"], branches: { pull_request: ["main"], push: ["main"] },
        permissions: { workflow: { "id-token": "write", contents: "read", "pull-requests": "write" } },
        order: { terraform: ["terraform init", "terraform fmt -check", "terraform validate", "terraform plan", "terraform apply"] },
        scenarios: [
          { event: { name: "pull_request", head: "infra/bucket", base: "main" }, run: ["terraform"], stepsRun: { terraform: ["terraform plan"] }, stepsSkipped: { terraform: ["terraform apply"] } },
          { event: { name: "push", branch: "main" }, run: ["terraform"], stepsRun: { terraform: ["terraform plan", "terraform apply"] } }
        ]
      },
      hint: "Ajoute fmt -check, validate et plan avant l'apply, puis mets sur l'étape apply « if: github.event_name == 'push' && github.ref == 'refs/heads/main' ». Pour OIDC : le bloc permissions et l'action aws-actions/configure-aws-credentials@v6."
    }
  }
];
