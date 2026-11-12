/* Cours Terraform — chapitre 2 : dépendances, répétition, modules. */
import { R } from "../linux/tag.js";
import { D, PROV, tfSetup } from "./bases.js";

const RESEAU = PROV + `
resource "aws_vpc" "principal" {
  cidr_block = "10.0.0.0/16"
  tags       = { Name = "boutique" }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.principal.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "ca-central-1a"
  map_public_ip_on_launch = true
  tags                    = { Name = "boutique-public" }
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.principal.id
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.principal.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}
`;
const REPET = PROV + `
variable "zones" {
  type    = list(string)
  default = ["ca-central-1a", "ca-central-1b", "ca-central-1d"]
}

variable "buckets" {
  type    = set(string)
  default = ["images", "factures", "exports"]
}

resource "aws_vpc" "principal" {
  cidr_block = "10.0.0.0/16"
}

resource "aws_subnet" "prive" {
  count             = length(var.zones)
  vpc_id            = aws_vpc.principal.id
  availability_zone = var.zones[count.index]
  cidr_block        = cidrsubnet(aws_vpc.principal.cidr_block, 8, count.index + 10)
  tags              = { Name = "prive-\${count.index}" }
}

resource "aws_s3_bucket" "donnees" {
  for_each = var.buckets
  bucket   = "boutique-\${each.key}-2026"
}

output "sous_reseaux" {
  value = aws_subnet.prive[*].cidr_block
}
`;
const MODULE = `variable "nom" {
  type = string
}

variable "versionnement" {
  type    = bool
  default = false
}

resource "aws_s3_bucket" "this" {
  bucket = var.nom
}

resource "aws_s3_bucket_versioning" "this" {
  bucket = aws_s3_bucket.this.id

  versioning_configuration {
    status = var.versionnement ? "Enabled" : "Suspended"
  }
}

resource "aws_s3_bucket_public_access_block" "this" {
  bucket                  = aws_s3_bucket.this.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

output "arn" {
  value = aws_s3_bucket.this.arn
}
`;
const APPEL = PROV + `
module "factures" {
  source        = "./modules/bucket-prive"
  nom           = "boutique-factures-2026"
  versionnement = true
}

module "exports" {
  source = "./modules/bucket-prive"
  nom    = "boutique-exports-2026"
}

output "arn_factures" {
  value = module.factures.arn
}
`;

export default [
  {
    id: "tf-05", section: "Structurer", title: "Références et dépendances : un réseau", xp: 110,
    theory: R`<p>Une ressource en référence une autre par @@type.nom.attribut@@ : @@aws_vpc.principal.id@@. Ces références forment un <strong>graphe de dépendances</strong> : Terraform crée le VPC avant le sous-réseau, et détruit dans l'ordre inverse. Il parallélise tout ce qui ne dépend pas l'un de l'autre. @@depends_on@@ ne sert que pour une dépendance invisible dans les arguments.</p>
<p>Le réseau minimal d'une application sur AWS :</p>
<ul><li>un <strong>VPC</strong>, le réseau privé (@@10.0.0.0/16@@) ;</li><li>des <strong>sous-réseaux</strong>, chacun dans une zone de disponibilité ; « public » quand il route vers Internet ;</li><li>une <strong>passerelle Internet</strong> attachée au VPC ;</li><li>une <strong>table de routage</strong> dont la route par défaut (@@0.0.0.0/0@@) mène à la passerelle, <strong>associée</strong> au sous-réseau public.</li></ul>
<p>Sans l'association, le sous-réseau utilise la table principale du VPC, qui ne sort pas sur Internet : un classique de « mon instance publique est injoignable ».</p>`,
    quiz: [
      { q: "Comment Terraform sait-il qu'il doit créer le VPC avant le sous-réseau ?", options: ["Par l'ordre dans le fichier", "Parce que le sous-réseau référence aws_vpc.principal.id : c'est une dépendance dans le graphe", "Grâce à depends_on obligatoire", "Il crée tout en même temps et réessaie"], answer: 1, explain: "L'ordre des blocs dans les fichiers n'a aucune importance." },
      { q: "Qu'est-ce qui rend un sous-réseau « public » ?", options: ["Son nom", "Une table de routage associée qui envoie 0.0.0.0/0 vers une passerelle Internet", "map_public_ip_on_launch seul", "Une IP en 10.0.x.x"], answer: 1, explain: "map_public_ip_on_launch donne une IP publique, mais sans route vers la passerelle, le trafic ne sort pas." }
    ],
    challenge: {
      kind: "script", file: D + "/reseau.tf", editorLang: "text", run: ["terraform init", "terraform apply -auto-approve", "terraform plan"],
      checkLabel: "init, apply, plan", checkNote: "terraform init, apply -auto-approve, puis un second plan", okMsg: "Bravo : un réseau public complet, créé dans le bon ordre.",
      prompt: R`<p>Écris @@reseau.tf@@ (le provider est déjà dans le fichier de départ) :</p><ul><li>un VPC @@principal@@ en @@10.0.0.0/16@@ ;</li><li>un sous-réseau @@public@@ en @@10.0.1.0/24@@ dans @@ca-central-1a@@, qui donne une IP publique aux instances ;</li><li>une passerelle Internet @@igw@@ ;</li><li>une table de routage @@public@@ avec une route @@0.0.0.0/0@@ vers la passerelle, associée au sous-réseau (ressource @@aws_route_table_association@@ nommée @@public@@).</li></ul>`,
      starter: PROV + "\n",
      solution: RESEAU,
      setup: tfSetup(),
      tests: [{ label: "Cinq ressources, dans l'ordre, et un plan vide ensuite", outHas: ["Apply complete! Resources: 5 added", "No changes."], checks: { tf: { state: ["aws_vpc.principal", "aws_subnet.public", "aws_internet_gateway.igw", "aws_route_table.public", "aws_route_table_association.public"], noChanges: true }, aws: { aws_subnet: { match: { cidr_block: "10.0.1.0/24", map_public_ip_on_launch: true, availability_zone: "ca-central-1a" } } } } }],
      hint: "Chaque ressource référence le VPC par aws_vpc.principal.id. Dans la table de routage, un bloc route { cidr_block = \"0.0.0.0/0\", gateway_id = aws_internet_gateway.igw.id }. L'association prend subnet_id et route_table_id."
    }
  },
  {
    id: "tf-06", section: "Structurer", title: "Répéter : count et for_each", xp: 110,
    theory: R`<p>Pour créer plusieurs objets semblables :</p>
<ul><li>@@count = 3@@ crée @@ressource[0]@@, @@[1]@@, @@[2]@@ ; @@count.index@@ donne le numéro. Pratique pour « N copies identiques ». Piège : retirer un élément au milieu d'une liste décale les indices, et Terraform détruit puis recrée les objets suivants ;</li><li>@@for_each@@ prend une map ou un ensemble de chaînes ; chaque instance est repérée par sa <strong>clé</strong> (@@ressource["images"]@@), et @@each.key@@ / @@each.value@@ donnent l'élément. Retirer une clé ne touche qu'elle : c'est le bon choix dès que les objets ont une identité.</li></ul>
~~~text
resource "aws_subnet" "prive" {
  count      = length(var.zones)
  cidr_block = cidrsubnet("10.0.0.0/16", 8, count.index + 10)   # 10.0.10.0/24, 10.0.11.0/24…
}

output "sous_reseaux" {
  value = aws_subnet.prive[*].cidr_block    # [*] : l'attribut de chaque instance
}
~~~
<p>@@cidrsubnet(préfixe, bits, numéro)@@ découpe un bloc : ajouter 8 bits à un /16 donne des /24, numérotés.</p>`,
    quiz: [
      { q: "Tu as 3 buckets créés avec count sur une liste [a, b, c]. Tu retires b. Que fait Terraform ?", options: ["Il supprime b", "Il détruit et recrée c (qui passe de l'index 2 à l'index 1) et supprime l'ancien index 2 : d'où for_each pour les objets qui ont une identité", "Rien", "Il renomme b"], answer: 1, explain: "Avec for_each, les instances sont repérées par leur clé : retirer b ne touche que b." },
      { q: "Que vaut cidrsubnet(\"10.0.0.0/16\", 8, 3) ?", options: ["10.0.0.3/16", "10.0.3.0/24", "10.3.0.0/24", "10.0.0.0/24"], answer: 1, explain: "16 + 8 = 24 bits de préfixe, et le numéro 3 donne le quatrième /24." }
    ],
    challenge: {
      kind: "script", file: D + "/main.tf", editorLang: "text", run: ["terraform init", "terraform apply -auto-approve", "terraform state list"],
      checkLabel: "init, apply", checkNote: "terraform init, apply -auto-approve, puis state list", okMsg: "Bravo : trois sous-réseaux numérotés et trois buckets repérés par leur nom.",
      prompt: R`<p>Le fichier de départ déclare un VPC et deux variables. Ajoute :</p><ul><li>avec @@count@@, un sous-réseau @@prive@@ par zone de @@var.zones@@, dans cette zone, en @@10.0.10.0/24@@, @@10.0.11.0/24@@, @@10.0.12.0/24@@ (utilise @@cidrsubnet@@), étiqueté @@Name = "prive-<index>"@@ ;</li><li>avec @@for_each@@, un bucket @@donnees@@ par élément de @@var.buckets@@, nommé @@boutique-<élément>-2026@@ ;</li><li>un output @@sous_reseaux@@ : la liste des blocs CIDR des sous-réseaux.</li></ul>`,
      starter: REPET.slice(0, REPET.indexOf('resource "aws_subnet"')),
      solution: REPET,
      setup: tfSetup(),
      tests: [{ label: "3 sous-réseaux (count) et 3 buckets (for_each)", outHas: ['aws_s3_bucket.donnees["images"]', "aws_subnet.prive[2]"], checks: { tf: { state: ["aws_subnet.prive[0]", "aws_subnet.prive[2]", 'aws_s3_bucket.donnees["exports"]'], noChanges: true, outputs: { sous_reseaux: ["10.0.10.0/24", "10.0.11.0/24", "10.0.12.0/24"] } }, aws: { aws_subnet: [{ match: { cidr_block: "10.0.11.0/24", availability_zone: "ca-central-1b" } }], aws_s3_bucket: [{ match: { bucket: "boutique-factures-2026" } }] } } }],
      hint: "count = length(var.zones), availability_zone = var.zones[count.index], cidr_block = cidrsubnet(aws_vpc.principal.cidr_block, 8, count.index + 10). Pour les buckets : for_each = var.buckets et bucket = \"boutique-${each.key}-2026\". L'output : aws_subnet.prive[*].cidr_block."
    }
  },
  {
    id: "tf-07", section: "Structurer", title: "Modules", xp: 110,
    theory: R`<p>Un <strong>module</strong> est un dossier de fichiers @@.tf@@ réutilisable, avec ses variables (entrées) et ses outputs (sorties). Tout dossier est un module ; celui où l'on lance Terraform est le module racine.</p>
~~~text
module "factures" {
  source        = "./modules/bucket-prive"   # dossier local, registre, ou dépôt Git
  nom           = "boutique-factures-2026"
  versionnement = true
}

output "arn_factures" {
  value = module.factures.arn
}
~~~
<ul><li>un module encapsule une bonne pratique (un bucket toujours privé et chiffré, un réseau à trois niveaux) : les équipes l'appellent au lieu de recopier ;</li><li>dans l'état, ses ressources s'appellent @@module.factures.aws_s3_bucket.this@@ ;</li><li>le registre public propose des modules éprouvés (@@terraform-aws-modules/vpc/aws@@) ; on fixe toujours leur version (@@version = "5.16.0"@@) ;</li><li>après avoir ajouté un module, il faut relancer @@terraform init@@.</li></ul>`,
    quiz: [
      { q: "Comment lire une valeur produite par un module ?", options: ["var.module.x", "module.NOM.OUTPUT, si le module déclare cet output", "data.module.x", "Impossible"], answer: 1, explain: "Un module n'expose que ce qu'il déclare en output : c'est son interface." },
      { q: "Pourquoi fixer la version d'un module du registre ?", options: ["Ce n'est pas utile", "Pour qu'une nouvelle version publiée ne change pas l'infrastructure à ton insu", "Pour la vitesse", "Parce que source l'exige"], answer: 1, explain: "Comme pour les providers et les images Docker : on met à jour volontairement." }
    ],
    challenge: {
      kind: "script", file: D + "/main.tf", editorLang: "text", run: ["terraform init", "terraform apply -auto-approve", "terraform output arn_factures"],
      checkLabel: "init, apply", checkNote: "terraform init, apply -auto-approve, puis l'output", okMsg: "Bravo : un module, deux appels, zéro copier-coller.",
      prompt: R`<p>Le module @@./modules/bucket-prive@@ existe (entrées @@nom@@ et @@versionnement@@, sortie @@arn@@) : il crée un bucket privé. Dans @@main.tf@@, appelle-le deux fois :</p><ul><li>@@factures@@ : bucket @@boutique-factures-2026@@, avec versionnement ;</li><li>@@exports@@ : bucket @@boutique-exports-2026@@, sans (valeur par défaut) ;</li></ul><p>et ajoute un output @@arn_factures@@ avec l'ARN du premier.</p>`,
      starter: PROV + "\n",
      solution: APPEL,
      setup: tfSetup({ files: { "modules/bucket-prive/main.tf": MODULE } }),
      tests: [{ label: "Deux appels du module et l'output", outHas: '"arn:aws:s3:::boutique-factures-2026"', checks: { tf: { state: ["module.factures.aws_s3_bucket.this", "module.exports.aws_s3_bucket_public_access_block.this"], noChanges: true, outputs: { arn_factures: "arn:aws:s3:::boutique-factures-2026" } }, aws: { aws_s3_bucket_versioning: [{ match: { bucket: "boutique-factures-2026", versioning_configuration: [{ status: "Enabled" }] } }, { match: { bucket: "boutique-exports-2026", versioning_configuration: [{ status: "Suspended" }] } }] } } }],
      hint: "module \"factures\" { source = \"./modules/bucket-prive\", nom = …, versionnement = true } ; module \"exports\" { source = …, nom = … }. L'output : value = module.factures.arn."
    }
  }
];
