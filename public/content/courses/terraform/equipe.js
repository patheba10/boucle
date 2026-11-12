/* Cours Terraform — chapitre 3 : état distant, import et dérive, Terraform en équipe ; entretien. */
import { R } from "../linux/tag.js";
import { D, PROV, tfSetup } from "./bases.js";

const RES = PROV + `
resource "aws_vpc" "principal" {
  cidr_block = "10.0.0.0/16"
  tags       = { Name = "boutique" }
}
`;
const BACKEND = `terraform {
  backend "s3" {
    bucket         = "boutique-tfstate"
    key            = "reseau/terraform.tfstate"
    region         = "ca-central-1"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}
`;
const IMPORT = PROV + `
resource "aws_s3_bucket" "logs" {
  bucket = "boutique-logs-2026"
}
`;
const SALE = PROV.replace('  region = "ca-central-1"', 'region="ca-central-1"') + `
resource "aws_s3_bucket" "images" {
    bucket="boutique-images-2026"
  force_destory = true
}
`;

export default [
  {
    id: "tf-08", section: "En équipe", title: "L'état distant et le verrou", xp: 110,
    theory: R`<p>Un @@terraform.tfstate@@ sur un portable ne marche pas en équipe : chacun aurait sa version, et deux @@apply@@ simultanés corrompraient l'infrastructure. On place l'état dans un <strong>backend distant</strong> :</p>
~~~text
terraform {
  backend "s3" {
    bucket         = "boutique-tfstate"            # bucket versionné et chiffré
    key            = "reseau/terraform.tfstate"    # un état par composant
    region         = "ca-central-1"
    dynamodb_table = "terraform-locks"             # verrou
    encrypt        = true
  }
}
~~~
<ul><li>le <strong>verrou</strong> empêche deux opérations en même temps : si un collègue applique, ton @@plan@@ attend ou échoue avec « Error acquiring the state lock », en nommant qui le tient. @@terraform force-unlock ID@@ ne sert que si le verrou est orphelin (un apply interrompu), jamais pendant que l'autre travaille ;</li><li>l'état contient des secrets en clair : bucket privé, chiffré, versionné (pour revenir en arrière), accès restreint par IAM ;</li><li>changer de backend demande @@terraform init -migrate-state@@, qui copie l'état existant.</li></ul>
<p>Depuis Terraform 1.10, S3 sait verrouiller seul (@@use_lockfile = true@@) ; la table DynamoDB reste très répandue dans les projets existants.</p>`,
    quiz: [
      { q: "Pendant ton terraform plan : « Error acquiring the state lock … Who: louis@portable ». Que fais-tu ?", options: ["terraform force-unlock tout de suite", "J'attends ou je préviens Louis : il est en train d'appliquer. force-unlock seulement si son opération est morte", "Je supprime la table DynamoDB", "Je travaille avec -lock=false"], answer: 1, explain: "Forcer pendant un apply en cours, c'est risquer un état corrompu." },
      { q: "Pourquoi le bucket de l'état doit-il être versionné ?", options: ["Pour la vitesse", "Pour pouvoir récupérer une version précédente de l'état en cas d'erreur ou de corruption", "Parce que S3 l'impose", "Pour partager les modules"], answer: 1, explain: "L'état est la mémoire de Terraform : on le protège comme une base de données." }
    ],
    challenge: {
      prompt: R`<p>Le réseau de la boutique a été créé depuis ton poste : l'état est local (@@~/infra/terraform.tfstate@@). Passe-le dans S3 :</p><ol><li>crée @@backend.tf@@ avec un backend @@s3@@ : bucket @@boutique-tfstate@@, clé @@reseau/terraform.tfstate@@, région @@ca-central-1@@, table de verrou @@terraform-locks@@, chiffrement activé ;</li><li>migre l'état existant ;</li><li>vérifie avec @@terraform plan@@ que rien ne change.</li></ol>`,
      setup: tfSetup({ files: { "main.tf": RES }, commands: ["terraform init", "terraform apply -auto-approve"], aws: { s3: { "boutique-tfstate": {} } } }),
      checks: { tf: { remote: true, noChanges: true, state: ["aws_vpc.principal"] }, files: { [D + "/backend.tf"]: { contains: ['backend "s3"', "boutique-tfstate", "terraform-locks"] } } },
      solution: ["cat terraform.tfstate | head -5", "printf 'terraform {\\n  backend \"s3\" {\\n    bucket         = \"boutique-tfstate\"\\n    key            = \"reseau/terraform.tfstate\"\\n    region         = \"ca-central-1\"\\n    dynamodb_table = \"terraform-locks\"\\n    encrypt        = true\\n  }\\n}\\n' > backend.tf", "terraform plan", "terraform init -migrate-state", "terraform plan"],
      allowFail: ["terraform plan"],
      hint: "Écris backend.tf (un bloc terraform { backend \"s3\" { … } }), puis terraform init : il demande -migrate-state pour copier l'état local dans S3. Un terraform plan final doit afficher « No changes »."
    }
  },
  {
    id: "tf-09", section: "En équipe", title: "Import et dérive", xp: 100,
    theory: R`<p>Deux situations courantes en entreprise :</p>
<ul><li><strong>Reprendre de l'existant</strong> : des ressources créées à la main dans la console. On écrit leur bloc @@resource@@, puis @@terraform import adresse identifiant@@ (ou un bloc @@import { to = …, id = … }@@ depuis Terraform 1.5). Ensuite, @@plan@@ montre les écarts entre le code et la réalité, qu'on corrige jusqu'à un plan vide ;</li><li>la <strong>dérive</strong> (drift) : quelqu'un a modifié une ressource gérée, hors de Terraform. Au rafraîchissement, Terraform le signale (« Objects have changed outside of Terraform ») et le plan propose de revenir à ce que dit le code. Soit on applique (le code a raison), soit on reporte le changement dans le code (la modification était voulue).</li></ul>
<p>Pour limiter la dérive : droits de la console en lecture seule en production, tout changement par pull request, et un @@terraform plan@@ planifié qui alerte dès qu'il n'est plus vide.</p>`,
    quiz: [
      { q: "Un bucket créé à la main doit passer sous Terraform. Dans quel ordre ?", options: ["terraform import, puis écrire le code", "Écrire le bloc resource, puis terraform import ADRESSE ID, puis plan jusqu'à ce qu'il soit vide", "Le supprimer et le recréer avec Terraform", "Modifier terraform.tfstate à la main"], answer: 1, explain: "Import rattache l'objet existant à une adresse déclarée dans le code." },
      { q: "Le plan signale une étiquette ajoutée à la main sur une ressource. La modification était voulue. Que faire ?", options: ["terraform apply", "Reporter l'étiquette dans le code, pour que le plan redevienne vide", "Supprimer la ressource", "Ignorer"], answer: 1, explain: "Sinon, le prochain apply retirera l'étiquette." }
    ],
    challenge: {
      prompt: R`<p>Le bucket @@boutique-logs-2026@@ a été créé à la main dans la console. @@~/infra/main.tf@@ contient déjà son bloc @@aws_s3_bucket.logs@@, mais @@terraform apply@@ échoue. Fais passer ce bucket sous la gestion de Terraform, sans le recréer, jusqu'à un @@terraform plan@@ vide.</p>`,
      setup: tfSetup({ files: { "main.tf": IMPORT }, aws: { s3: { "boutique-logs-2026": { "2026/11/11/acces.log": "GET /\n" } } } }),
      checks: { tf: { state: ["aws_s3_bucket.logs"], noChanges: true }, aws: { aws_s3_bucket: { match: { bucket: "boutique-logs-2026" } } } },
      solution: ["terraform init", "terraform apply -auto-approve", "terraform import aws_s3_bucket.logs boutique-logs-2026", "terraform plan"],
      allowFail: ["terraform apply -auto-approve"],
      hint: "L'apply échoue avec BucketAlreadyOwnedByYou : le bucket existe déjà. terraform import aws_s3_bucket.logs boutique-logs-2026 le rattache à l'adresse du code."
    }
  },
  {
    id: "tf-10", section: "En équipe", title: "Terraform en équipe et en CI", xp: 100,
    theory: R`<p>En équipe, Terraform passe par le même circuit que le code :</p>
<ol><li>une branche, une pull request ;</li><li>la CI lance @@terraform fmt -check@@ (format), @@terraform validate@@ (syntaxe et références), des analyses de sécurité (tfsec ou Trivy, Checkov : bucket public, port 22 ouvert au monde, chiffrement absent), puis @@terraform plan@@ et publie le plan en commentaire de la PR ;</li><li>après revue et fusion, la CI lance @@terraform apply@@ sur le plan approuvé.</li></ol>
<p>Pour s'authentifier à AWS sans clé stockée, la CI utilise <strong>OIDC</strong> : GitHub Actions obtient un jeton temporaire et endosse un rôle IAM (@@aws-actions/configure-aws-credentials@@ avec @@role-to-assume@@).</p>
<p>Organisation : un dossier (et un état) par environnement et par composant (@@envs/prod/reseau@@), des modules partagés, de petites PR. Les <em>workspaces</em> de Terraform conviennent à des copies identiques, moins à des environnements qui divergent.</p>`,
    quiz: [
      { q: "Que vérifie terraform validate, que terraform fmt ne vérifie pas ?", options: ["L'indentation", "La validité de la configuration : arguments connus, types, références déclarées", "Les droits AWS", "Le coût"], answer: 1, explain: "fmt ne fait que la mise en forme ; validate ne contacte pas AWS, mais attrape la plupart des erreurs de code." },
      { q: "Comment GitHub Actions doit-il s'authentifier sur AWS pour Terraform ?", options: ["Avec les clés d'un utilisateur IAM stockées en secret", "Par OIDC : un jeton temporaire qui endosse un rôle IAM limité, sans clé permanente", "Avec le compte root", "Sans authentification"], answer: 1, explain: "Plus de clé à faire tourner ni à faire fuiter." }
    ],
    challenge: {
      prompt: R`<p>La CI refuse la pull request d'un collègue : @@terraform fmt -check@@ et @@terraform validate@@ échouent sur @@~/infra/main.tf@@. Corrige le fichier pour que les deux passent (l'intention : un bucket @@boutique-images-2026@@ qu'on peut supprimer même s'il contient des objets).</p>`,
      setup: tfSetup({ files: { "main.tf": SALE }, commands: ["terraform init"] }),
      checks: { tf: { fmt: true, valid: true }, files: { [D + "/main.tf"]: { contains: ["force_destroy"] } } },
      solution: ["terraform fmt -check", "terraform validate", "sed -i 's/force_destory/force_destroy/' main.tf", "terraform fmt", "terraform fmt -check", "terraform validate"],
      allowFail: ["terraform fmt -check", "terraform validate"],
      hint: "terraform validate signale un argument inconnu et propose le bon nom (« Did you mean … »). Corrige-le avec sed, puis terraform fmt réécrit la mise en forme."
    }
  },
  {
    id: "tf-11", section: "Entretien", title: "Questions d'entretien Terraform", xp: 60, theoryOnly: true,
    theory: R`<p>Terraform figure dans presque toutes les offres DevOps et cloud, et a sa certification (HashiCorp Terraform Associate). Réponds à voix haute avant d'ouvrir chaque réponse.</p>
<div class="qa">
<details><summary>Qu'est-ce que l'état de Terraform, et pourquoi le stocker à distance ?</summary><p>La correspondance entre les adresses du code et les objets réels (identifiants, attributs), qui permet de calculer les plans. À distance (S3 versionné et chiffré, Terraform Cloud) pour le partager en équipe, le verrouiller pendant les opérations et le protéger : il contient des secrets.</p></details>
<details><summary>Que se passe-t-il pendant terraform plan ?</summary><p>Terraform lit la configuration, rafraîchit l'état en interrogeant les API, construit le graphe de dépendances et compare : création, modification sur place, remplacement (argument qui ne peut pas changer) ou suppression. Les valeurs calculées par le fournisseur sont « known after apply ».</p></details>
<details><summary>count ou for_each ?</summary><p>count pour N copies identiques ; for_each (map ou ensemble) dès que les objets ont une identité, car les instances sont repérées par clé : en retirer une ne décale pas les autres.</p></details>
<details><summary>Comment gères-tu plusieurs environnements ?</summary><p>Des dossiers par environnement et par composant, chacun avec son état et ses tfvars, appelant des modules communs versionnés. Les workspaces conviennent à des copies identiques. Les différences voulues passent par des variables, pas par des copies divergentes.</p></details>
<details><summary>Qu'est-ce que la dérive, et comment la détectes-tu ?</summary><p>Un écart entre la réalité et le code, dû à une modification manuelle. terraform plan la signale ; un plan planifié en CI (ou l'option de détection de Terraform Cloud) alerte. On corrige en appliquant le code, ou en y reportant le changement voulu.</p></details>
<details><summary>Comment éviter de détruire une base de données par erreur ?</summary><p>Relire le plan (chercher « must be replaced » et « forces replacement »), lifecycle { prevent_destroy = true }, protection contre la suppression côté AWS (deletion_protection), sauvegardes automatiques, et revue obligatoire des plans en production.</p></details>
<details><summary>Terraform, Ansible, CloudFormation : quelles différences ?</summary><p>Terraform : déclaratif, multi-fournisseurs, avec un état. CloudFormation : déclaratif, AWS seulement, état géré par AWS. Ansible : configure des machines, sans état, idempotent par module. On combine souvent Terraform (infrastructure) et Ansible ou des images (configuration).</p></details>
<details><summary>Comment sécuriser Terraform en CI ?</summary><p>Authentification par OIDC vers un rôle IAM au moindre privilège (plan en lecture seule, apply avec plus de droits, seulement sur la branche principale), état chiffré à l'accès restreint, analyses de sécurité du code, plan relu en PR, versions des providers et modules fixées.</p></details>
<details><summary>Que fait terraform import, et quelle est sa limite ?</summary><p>Il rattache un objet existant à une adresse déclarée dans le code, en l'ajoutant à l'état. Il n'écrit pas le code à ta place (depuis 1.5, terraform plan -generate-config-out propose un brouillon) : il faut ensuite ajuster la configuration jusqu'à un plan vide.</p></details>
<details><summary>À quoi sert le fichier .terraform.lock.hcl ?</summary><p>Il fige les versions exactes (et les empreintes) des providers choisis à l'init, pour que toute l'équipe et la CI utilisent les mêmes. On le versionne ; terraform init -upgrade le met à jour volontairement.</p></details>
</div>`,
    practice: { title: "S'entraîner", body: R`<p>Choisis trois questions et réponds en deux minutes chacune. Puis, sur un vrai compte AWS (niveau gratuit) : un dépôt avec un module réseau, un état dans S3, et un workflow GitHub Actions qui lance fmt, validate et plan sur chaque PR, et apply après fusion, authentifié par OIDC. Détruis tout à la fin. C'est le projet le plus parlant pour un poste DevOps cloud.</p>` },
    quiz: [
      { q: "Le plan affiche « 3 to add, 0 to change, 3 to destroy » alors que tu n'as changé qu'un nom de ressource dans le code. Pourquoi ?", options: ["AWS est en panne", "Renommer l'adresse fait croire à Terraform qu'il faut détruire l'ancien objet et en créer un nouveau ; un bloc moved { from = …, to = … } (ou terraform state mv) évite cela", "Les providers ont changé", "C'est normal à chaque plan"], answer: 1, explain: "L'adresse est l'identité dans l'état : on la déplace, on ne la renomme pas." },
      { q: "Où le mot de passe d'une base RDS créée par Terraform se retrouve-t-il ?", options: ["Nulle part", "Dans l'état, en clair : d'où un état chiffré et restreint, ou un mot de passe géré par AWS (manage_master_user_password)", "Seulement dans AWS", "Dans le fichier lock"], answer: 1, explain: "sensitive masque l'affichage, pas le stockage." }
    ]
  }
];
