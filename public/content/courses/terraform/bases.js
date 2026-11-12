/* Cours Terraform — chapitre 1 : IaC, providers et ressources, plan et apply, variables et outputs. */
import { R } from "../linux/tag.js";

export const D = "/home/eleve/infra";
export const PROV = `terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "ca-central-1"
}
`;
/** Mise en place : Terraform installé, compte AWS simulé, fichiers dans ~/infra, commandes préalables. */
export const tfSetup = ({ files = {}, commands = [], aws } = {}) => ({ files: { [D + "/.gitkeep"]: "", ...Object.fromEntries(Object.entries(files).map(([k, v]) => [D + "/" + k, v])) }, terraform: {}, aws, commands: commands.length ? ["cd " + D, ...commands] : [], cwd: D });
const APPLY = ["terraform init", "terraform apply -auto-approve"];

const VPC = PROV + `
resource "aws_vpc" "principal" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true

  tags = {
    Name   = "boutique"
    Projet = "boutique"
  }
}
`;
const WEB = PROV + `
resource "aws_instance" "web" {
  ami           = "ami-0c9b7f4e5d3a21f80"
  instance_type = "t3.micro"

  tags = {
    Name = "web"
  }
}
`;
const VARS = PROV + `
variable "env" {
  type        = string
  description = "Environnement : dev ou prod"

  validation {
    condition     = contains(["dev", "prod"], var.env)
    error_message = "env doit valoir dev ou prod."
  }
}

locals {
  nom = "boutique-\${var.env}"
  tags = {
    Projet = "boutique"
    Env    = var.env
  }
}

resource "aws_s3_bucket" "factures" {
  bucket = "\${local.nom}-factures"
  tags   = local.tags
}

output "bucket" {
  value = aws_s3_bucket.factures.bucket
}

output "arn" {
  value = aws_s3_bucket.factures.arn
}
`;

export default [
  {
    id: "tf-01", section: "Les bases", title: "L'infrastructure as code", xp: 70,
    theory: R`<p>Créer un serveur en cliquant dans la console AWS ne se relit pas, ne se reproduit pas et ne se révise pas en pull request. L'<strong>infrastructure as code</strong> décrit l'infrastructure dans des fichiers versionnés ; un outil la crée et la tient à jour. <strong>Terraform</strong> est le plus répandu : il gère AWS, Azure, Google Cloud, Kubernetes, GitHub… grâce à des <strong>providers</strong>.</p>
<p>Terraform est <strong>déclaratif</strong>, comme Kubernetes : on décrit ce qu'on veut, il calcule ce qu'il faut faire.</p>
~~~text
resource "local_file" "bonjour" {       # type de ressource, puis nom local
  filename = "\${path.module}/bonjour.txt"
  content  = "Bonjour Terraform\n"
}
~~~
<p>Le cycle de travail :</p>
<ol><li>@@terraform init@@ télécharge les providers (et prépare le stockage de l'état) ;</li><li>@@terraform plan@@ compare la configuration à l'existant et affiche ce qui va changer : @@+@@ créer, @@~@@ modifier, @@-@@ supprimer, @@-/+@@ remplacer ;</li><li>@@terraform apply@@ montre le plan, demande « yes », puis agit ;</li><li>@@terraform destroy@@ supprime tout ce que la configuration gère.</li></ol>
<p>Terraform garde la trace de ce qu'il a créé dans un fichier d'<strong>état</strong>, @@terraform.tfstate@@ : c'est ainsi qu'il sait, au prochain @@plan@@, ce qui existe déjà.</p>`,
    setup: R`<p><strong>Sur ta machine</strong> : installe Terraform (paquet de HashiCorp, ou @@brew install terraform@@), puis @@terraform version@@. Les leçons suivantes utilisent AWS : crée un compte, un utilisateur IAM sans droits d'administrateur racine, et configure @@aws configure@@. Le niveau gratuit suffit, mais pense à @@terraform destroy@@ après chaque exercice.</p>`,
    quiz: [
      { q: "Que fait terraform plan ?", options: ["Il crée l'infrastructure", "Il compare la configuration à l'existant et montre ce qui changerait, sans rien modifier", "Il télécharge les providers", "Il supprime l'état"], answer: 1, explain: "C'est l'étape qu'on relit (et qu'on fait relire) avant chaque apply." },
      { q: "À quoi sert le fichier terraform.tfstate ?", options: ["Il contient le code source", "Il mémorise les objets créés et leurs identifiants, pour savoir au prochain plan ce qui existe déjà", "Il liste les providers", "Il configure AWS"], answer: 1, explain: "Sans état, Terraform recréerait tout à chaque fois." }
    ],
    challenge: {
      kind: "script", file: D + "/main.tf", editorLang: "text", run: [...APPLY, "cat bonjour.txt", "terraform plan"],
      checkLabel: "init, apply, plan", checkNote: "terraform init, apply -auto-approve, puis un second plan", okMsg: "Bravo : ton premier objet géré par Terraform, et un plan vide au second passage.",
      prompt: R`<p>Écris @@main.tf@@ avec une ressource @@local_file@@ nommée @@bonjour@@, qui crée le fichier @@bonjour.txt@@ dans le dossier du module, avec le contenu @@Bonjour Terraform@@ suivi d'un retour à la ligne. Le test lance @@init@@, @@apply@@, affiche le fichier, puis refait un @@plan@@, qui ne doit plus rien changer.</p>`,
      starter: "# Ta première ressource Terraform\n",
      solution: 'resource "local_file" "bonjour" {\n  filename = "${path.module}/bonjour.txt"\n  content  = "Bonjour Terraform\\n"\n}\n',
      setup: tfSetup(),
      tests: [{ label: "Le fichier existe et le second plan est vide", outHas: ["Bonjour Terraform", "No changes."], checks: { tf: { state: ["local_file.bonjour"], noChanges: true }, files: { [D + "/bonjour.txt"]: "Bonjour Terraform\n" } } }],
      hint: "resource \"local_file\" \"bonjour\" { … } avec deux arguments : filename = \"${path.module}/bonjour.txt\" et content = \"Bonjour Terraform\\n\"."
    }
  },
  {
    id: "tf-02", section: "Les bases", title: "Providers et ressources AWS", xp: 90,
    theory: R`<p>Un <strong>provider</strong> traduit les ressources en appels d'API. On déclare la version attendue (pour que tout le monde utilise la même), puis on le configure :</p>
~~~text
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"      # 5.x, jamais 6.0 sans le décider
    }
  }
}

provider "aws" {
  region = "ca-central-1"     # Montréal
}
~~~
<p>Les identifiants AWS ne s'écrivent <strong>jamais</strong> dans le code : le provider les lit dans l'environnement (@@aws configure@@, variables @@AWS_PROFILE@@, rôle IAM en CI).</p>
<p>Chaque ressource a des <strong>arguments</strong> (ce que tu fixes : @@cidr_block@@) et des <strong>attributs</strong> calculés par AWS (@@id@@, @@arn@@), inconnus avant la création : le plan les affiche « (known after apply) ». La documentation de chaque ressource (registry.terraform.io) liste arguments obligatoires, facultatifs, et ceux qui forcent le remplacement.</p>
<p>@@terraform init@@ crée aussi @@.terraform.lock.hcl@@, qui fige la version exacte du provider : on le versionne.</p>`,
    quiz: [
      { q: "Où mettre les clés d'accès AWS pour Terraform ?", options: ["Dans le bloc provider", "Hors du code : profil aws configure, variables d'environnement, ou rôle IAM en CI", "Dans terraform.tfvars versionné", "Dans un output"], answer: 1, explain: "Un secret dans Git finit toujours par fuiter." },
      { q: "Pourquoi « version = \"~> 5.0\" » ?", options: ["Pour toujours avoir la dernière version", "Pour accepter les 5.x mais refuser une version majeure 6 qui pourrait casser la configuration", "C'est obligatoire", "Pour Terraform 5"], answer: 1, explain: "Le fichier de verrouillage fige ensuite la version exacte." }
    ],
    challenge: {
      kind: "script", file: D + "/main.tf", editorLang: "text", run: [...APPLY, "terraform plan"],
      checkLabel: "init, apply, plan", checkNote: "terraform init, apply -auto-approve, puis un second plan", okMsg: "Bravo, le VPC existe dans le compte AWS et Terraform le gère.",
      prompt: R`<p>Complète @@main.tf@@ : le provider @@aws@@ (version @@~> 5.0@@, région @@ca-central-1@@) est déclaré. Ajoute un VPC @@principal@@ :</p><ul><li>bloc d'adresses @@10.0.0.0/16@@ ;</li><li>noms DNS des instances activés (@@enable_dns_hostnames@@) ;</li><li>étiquettes @@Name = "boutique"@@ et @@Projet = "boutique"@@.</li></ul>`,
      starter: PROV,
      solution: VPC,
      setup: tfSetup(),
      tests: [{ label: "Le VPC est créé avec ses étiquettes, et le plan suivant est vide", outHas: ["aws_vpc.principal: Creation complete", "No changes."], checks: { tf: { state: ["aws_vpc.principal"], noChanges: true }, aws: { aws_vpc: { match: { cidr_block: "10.0.0.0/16", enable_dns_hostnames: true, tags: { Name: "boutique", Projet: "boutique" } } } } } }],
      hint: "resource \"aws_vpc\" \"principal\" { cidr_block = …, enable_dns_hostnames = true, tags = { Name = \"boutique\", Projet = \"boutique\" } }. Les étiquettes sont une map : tags = { … }."
    }
  },
  {
    id: "tf-03", section: "Les bases", title: "Lire un plan : modifier ou remplacer", xp: 100,
    theory: R`<p>Le plan est le moment de vérité : on le lit <strong>en entier</strong> avant d'appliquer. Trois cas pour une ressource existante :</p>
<ul><li>@@~ update in-place@@ : AWS sait modifier l'objet (une étiquette, le type d'une instance arrêtée puis relancée) ;</li><li>@@-/+ must be replaced@@ : l'argument ne peut pas changer sur un objet existant (l'AMI d'une instance, le bloc CIDR d'un VPC). Terraform détruit puis recrée : nouvel identifiant, nouvelle IP, données locales perdues. La ligne concernée porte @@# forces replacement@@ ;</li><li>@@- destroy@@ : la ressource a disparu de la configuration.</li></ul>
<p>Un remplacement inattendu sur une base de données ou un disque est la cause classique d'incidents. Les protections : relire le plan, @@lifecycle { prevent_destroy = true }@@ sur les ressources précieuses, et des sauvegardes.</p>
~~~text
  # aws_instance.web must be replaced
-/+ resource "aws_instance" "web" {
      ~ ami           = "ami-0c9b7f4e5d3a21f80" -> "ami-0a2e7efb4257c0907" # forces replacement
      ~ id            = "i-0b1c…" -> (known after apply)
~~~`,
    quiz: [
      { q: "Le plan affiche « -/+ » sur ta base de données de production. Que fais-tu ?", options: ["J'applique", "Je n'applique pas : je cherche l'argument « forces replacement » et je trouve une autre façon de faire (ou je planifie une migration avec sauvegarde)", "Je supprime l'état", "Je relance plan jusqu'à ce que ça disparaisse"], answer: 1, explain: "Un remplacement détruit l'objet existant et ses données." },
      { q: "À quoi sert lifecycle { prevent_destroy = true } ?", options: ["À accélérer apply", "À faire échouer tout plan qui détruirait ou remplacerait la ressource", "À cacher la ressource du plan", "À la rendre immuable dans AWS"], answer: 1, explain: "Un garde-fou dans le code, en plus des sauvegardes." }
    ],
    challenge: {
      prompt: R`<p>L'instance @@web@@ (dans @@~/infra/main.tf@@) est déjà déployée. L'équipe demande :</p><ol><li>de passer à @@t3.small@@ ;</li><li>de renommer l'étiquette @@Name@@ en @@web-prod@@ ;</li><li>sans remplacer l'instance : vérifie le plan avant d'appliquer.</li></ol><p>Modifie le fichier (par exemple avec @@sed -i@@), regarde @@terraform plan@@, puis applique.</p>`,
      setup: tfSetup({ files: { "main.tf": WEB }, commands: APPLY }),
      checks: { tf: { state: ["aws_instance.web"], noChanges: true }, aws: { aws_instance: { match: { instance_type: "t3.small", ami: "ami-0c9b7f4e5d3a21f80", tags: { Name: "web-prod" } } } }, files: { [D + "/main.tf"]: { contains: ['instance_type = "t3.small"', 'Name = "web-prod"'] } } },
      solution: ["terraform plan", "sed -i 's/t3.micro/t3.small/; s/Name = \"web\"/Name = \"web-prod\"/' main.tf", "terraform plan", "terraform apply -auto-approve"],
      hint: "sed -i 's/t3.micro/t3.small/; s/Name = \"web\"/Name = \"web-prod\"/' main.tf, puis terraform plan : il doit annoncer « 1 to change », pas « 1 to destroy »."
    }
  },
  {
    id: "tf-04", section: "Les bases", title: "Variables, locals et outputs", xp: 100,
    theory: R`<p>Une configuration réutilisable ne code rien en dur :</p>
<ul><li>@@variable "env" { type = string }@@ déclare une entrée ; on la lit avec @@var.env@@. Valeurs par @@default@@, fichier @@terraform.tfvars@@ (chargé automatiquement), @@-var env=prod@@ ou @@-var-file=prod.tfvars@@. Un bloc @@validation@@ refuse les valeurs absurdes ;</li><li>@@locals { … }@@ calcule des valeurs intermédiaires (@@local.nom@@) : un préfixe, des étiquettes communes ;</li><li>@@output@@ expose des valeurs après @@apply@@ (un identifiant, une adresse) : @@terraform output@@, @@terraform output -raw nom@@ dans un script. @@sensitive = true@@ masque un secret à l'affichage (il reste en clair dans l'état : l'état est un secret).</li></ul>
~~~text
locals {
  nom  = "boutique-\${var.env}"     # interpolation dans une chaîne
  tags = { Projet = "boutique", Env = var.env }
}
~~~`,
    quiz: [
      { q: "Une variable n'a pas de valeur par défaut et n'est passée nulle part. Que fait terraform plan ?", options: ["Il prend une chaîne vide", "Il la demande (en interactif) ou échoue « No value for required variable »", "Il ignore la ressource", "Il prend la valeur de l'état"], answer: 1, explain: "En CI, on passe toujours les variables par fichier ou par -var." },
      { q: "Un output marqué sensitive = true est-il protégé dans l'état ?", options: ["Oui, chiffré", "Non : il est seulement masqué à l'affichage ; l'état contient la valeur en clair et doit lui-même être protégé", "Il n'est pas stocké", "Il est stocké dans AWS Secrets Manager"], answer: 1, explain: "D'où l'état distant chiffré, aux droits restreints." }
    ],
    challenge: {
      kind: "script", file: D + "/main.tf", editorLang: "text", run: ["terraform init", "terraform apply -auto-approve -var env=prod", "terraform output -raw bucket"],
      checkLabel: "Appliquer avec env=prod", checkNote: "terraform apply -var env=prod, puis terraform output", okMsg: "Bravo : une configuration paramétrée, validée et qui expose ses résultats.",
      prompt: R`<p>Complète @@main.tf@@ :</p><ul><li>une variable @@env@@ (chaîne) qui n'accepte que @@dev@@ ou @@prod@@ (message : @@env doit valoir dev ou prod.@@) ;</li><li>des locals : @@nom = "boutique-<env>"@@ et des étiquettes @@Projet = "boutique"@@, @@Env = <env>@@ ;</li><li>un bucket S3 @@factures@@ nommé @@<nom>-factures@@, avec ces étiquettes ;</li><li>deux outputs : @@bucket@@ (le nom) et @@arn@@.</li></ul><p>Le test applique avec @@-var env=prod@@.</p>`,
      starter: PROV + "\n# variable, locals, resource, outputs\n",
      solution: VARS,
      setup: tfSetup(),
      tests: [{ label: "Bucket boutique-prod-factures, outputs bucket et arn", outHas: "boutique-prod-factures", checks: { tf: { outputs: { bucket: "boutique-prod-factures", arn: "arn:aws:s3:::boutique-prod-factures" } }, aws: { aws_s3_bucket: { match: { bucket: "boutique-prod-factures", tags: { Projet: "boutique", Env: "prod" } } } } } }],
      hint: "variable \"env\" avec un bloc validation { condition = contains([\"dev\", \"prod\"], var.env), error_message = … } ; locals { nom = \"boutique-${var.env}\", tags = { … } } ; bucket = \"${local.nom}-factures\" ; output \"bucket\" { value = aws_s3_bucket.factures.bucket }."
    }
  }
];
