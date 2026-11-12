/* Cours AWS — chapitre 2 : VPC et routage, security groups, EC2, calcul géré (ECS, EKS, Lambda). */
import { R } from "../linux/tag.js";
import { H, ADMIN, awsSetup } from "./fondations.js";

const AMI = "ami-0c9b7f4e5d3a21f80";
const NGINX = "#!/bin/bash\napt-get update\napt-get install -y nginx\nsystemctl enable --now nginx\n";
/** VPC « boutique » avec un sous-réseau qui attribue des IP publiques, mais sans passerelle ni route vers Internet. */
const VPC_SANS_SORTIE = [
  { type: "aws_vpc", as: "vpc", args: { cidr_block: "10.0.0.0/16", enable_dns_hostnames: true, tags: { Name: "boutique" } } },
  { type: "aws_subnet", as: "pub", args: { vpc_id: "@vpc", cidr_block: "10.0.1.0/24", availability_zone: "ca-central-1a", map_public_ip_on_launch: true, tags: { Name: "public-a" } } },
  { type: "aws_subnet", args: { vpc_id: "@vpc", cidr_block: "10.0.11.0/24", availability_zone: "ca-central-1a", tags: { Name: "prive-a" } } },
  { type: "aws_security_group", as: "web", args: { name: "web", description: "Site public", vpc_id: "@vpc", ingress: [{ from_port: 80, to_port: 80, protocol: "tcp", cidr_blocks: ["0.0.0.0/0"] }], egress: [{ from_port: 0, to_port: 0, protocol: "-1", cidr_blocks: ["0.0.0.0/0"] }], tags: {} } },
  { type: "aws_instance", args: { ami: AMI, instance_type: "t3.micro", subnet_id: "@pub", vpc_security_group_ids: ["@web"], user_data: NGINX, tags: { Name: "vitrine" } } }
];

export default [
  {
    id: "aws-04", section: "Réseau et calcul", title: "VPC : sous-réseaux, routes et passerelles", xp: 120,
    theory: R`<p>Un <strong>VPC</strong> est ton réseau privé dans une région, avec un bloc d'adresses (@@10.0.0.0/16@@, soit 65 536 adresses). On le découpe en <strong>sous-réseaux</strong>, chacun dans une seule zone de disponibilité (@@10.0.1.0/24@@ en @@ca-central-1a@@, @@10.0.2.0/24@@ en @@ca-central-1b@@). AWS réserve cinq adresses par sous-réseau.</p>
<p>Ce qui rend un sous-réseau <strong>public</strong>, ce n'est pas son nom : c'est sa <strong>table de routage</strong>. Pour qu'une instance soit joignable depuis Internet, il faut tout ce chemin :</p>
<ol><li>une <strong>passerelle Internet</strong> (IGW) attachée au VPC ;</li><li>dans la table de routage associée au sous-réseau, une route @@0.0.0.0/0@@ vers cette passerelle (un sous-réseau sans association utilise la table principale du VPC, qui n'a que la route @@local@@) ;</li><li>une adresse IP publique sur l'instance ;</li><li>un security group qui autorise le port, depuis l'adresse de l'appelant.</li></ol>
<p>Un sous-réseau <strong>privé</strong> n'a pas de route vers l'IGW. Ses instances (bases, serveurs internes) sortent vers Internet, pour leurs mises à jour, par une <strong>passerelle NAT</strong> placée dans un sous-réseau public : elles peuvent appeler, personne ne peut les appeler. Le VPC par défaut de chaque région a déjà tout cela, en public : pratique pour essayer, à éviter en production.</p>
~~~sh
aws ec2 describe-vpcs --query 'Vpcs[].[VpcId, CidrBlock, IsDefault]' --output table
aws ec2 describe-subnets --query 'Subnets[].{Id: SubnetId, Zone: AvailabilityZone, Bloc: CidrBlock, IpPublique: MapPublicIpOnLaunch}' --output table
aws ec2 describe-route-tables --query 'RouteTables[].Routes[].[DestinationCidrBlock, GatewayId]' --output text
~~~
<p>Construire le chemin à la CLI se fait dans cet ordre : @@create-internet-gateway@@, @@attach-internet-gateway@@, @@create-route-table@@, @@create-route@@ (destination @@0.0.0.0/0@@, cible @@igw-…@@), @@associate-route-table@@. En vrai, on l'écrit plutôt en Terraform, mais savoir le faire à la main aide à diagnostiquer.</p>`,
    setup: R`<p><strong>Sur ta machine</strong> : dans la console VPC, utilise « Create VPC », option « VPC and more », avec deux zones, deux sous-réseaux publics, deux privés et <em>aucune</em> passerelle NAT (elle coûte environ 0,045 $ de l'heure plus le trafic). Observe les tables de routage créées. Supprime le VPC ensuite : le VPC, les sous-réseaux, les tables et l'IGW sont gratuits, les adresses IPv4 publiques non (0,005 $ de l'heure chacune depuis février 2024).</p>`,
    quiz: [
      { q: "Qu'est-ce qui rend un sous-réseau public ?", options: ["Son nom", "Une route 0.0.0.0/0 vers une passerelle Internet dans la table de routage qui lui est associée", "L'option « public » du VPC", "Un security group ouvert"], answer: 1, explain: "Sans cette route, même une instance avec une IP publique reste injoignable." },
      { q: "Une base en sous-réseau privé doit télécharger ses mises à jour. Que lui faut-il ?", options: ["Une IP publique", "Une route 0.0.0.0/0 vers une passerelle NAT située dans un sous-réseau public", "Une route vers l'IGW", "Rien, c'est automatique"], answer: 1, explain: "La NAT permet les connexions sortantes seulement ; la base reste injoignable depuis Internet." },
      { q: "Un sous-réseau peut-il s'étendre sur deux zones de disponibilité ?", options: ["Oui", "Non : un sous-réseau est dans une seule zone ; pour la haute disponibilité on en crée un par zone", "Seulement dans le VPC par défaut", "Seulement s'il est privé"], answer: 1, explain: "D'où les paires public-a / public-b, prive-a / prive-b dans presque toutes les architectures." }
    ],
    challenge: {
      prompt: R`<p>L'équipe a créé le VPC @@boutique@@ (@@10.0.0.0/16@@), le sous-réseau @@public-a@@ et l'instance @@vitrine@@, qui fait tourner nginx. Son security group autorise déjà le port 80. Pourtant, @@curl@@ vers son IP publique tombe en délai d'attente.</p><p>Trouve ce qui manque et construis le chemin depuis Internet. Ne touche pas au sous-réseau @@prive-a@@ : il doit rester privé. Vérifie à la fin avec @@curl@@.</p>`,
      setup: awsSetup({ resources: VPC_SANS_SORTIE }),
      checks: { reach: { vitrine: { 80: true } }, aws: { aws_route_table_association: { count: 1 }, aws_internet_gateway: { count: 1 } } },
      solution: [
        "VPC=$(aws ec2 describe-vpcs --filters Name=tag:Name,Values=boutique --query 'Vpcs[0].VpcId' --output text)",
        "SUB=$(aws ec2 describe-subnets --filters Name=tag:Name,Values=public-a --query 'Subnets[0].SubnetId' --output text)",
        "aws ec2 describe-route-tables --filters Name=vpc-id,Values=$VPC",
        "IGW=$(aws ec2 create-internet-gateway --query InternetGateway.InternetGatewayId --output text)",
        "aws ec2 attach-internet-gateway --internet-gateway-id $IGW --vpc-id $VPC",
        "RTB=$(aws ec2 create-route-table --vpc-id $VPC --query RouteTable.RouteTableId --output text)",
        "aws ec2 create-route --route-table-id $RTB --destination-cidr-block 0.0.0.0/0 --gateway-id $IGW",
        "aws ec2 associate-route-table --route-table-id $RTB --subnet-id $SUB",
        "curl -s http://$(aws ec2 describe-instances --filters Name=tag:Name,Values=vitrine --query 'Reservations[].Instances[].PublicIpAddress' --output text)"
      ],
      hint: "La table principale du VPC n'a que la route local. Crée une IGW et attache-la au VPC, crée une table de routage avec la route 0.0.0.0/0 vers l'IGW, puis associe-la au sous-réseau public-a seulement. Garde les identifiants dans des variables : VPC=$(aws ec2 describe-vpcs … --output text)."
    }
  },
  {
    id: "aws-05", section: "Réseau et calcul", title: "Security groups : ouvrir juste ce qu'il faut", xp: 100,
    theory: R`<p>Un <strong>security group</strong> est un pare-feu attaché à une interface réseau (instance, base RDS, équilibreur). Ses règles d'entrée <em>autorisent</em> un protocole, des ports et une source ; tout le reste est refusé. Il est <strong>à état</strong> : la réponse à une connexion autorisée repasse toujours, pas besoin de règle de sortie pour elle.</p>
<p>La source d'une règle est un bloc CIDR (@@0.0.0.0/0@@ pour tout Internet, @@198.51.100.23/32@@ pour une seule adresse) ou un <strong>autre security group</strong>. C'est la bonne façon de relier les niveaux d'une application : le groupe de la base autorise le port 5432 depuis le groupe des serveurs d'application, quelles que soient leurs adresses.</p>
~~~text
web  : 80, 443 depuis 0.0.0.0/0          (le public)
app  : 8000 depuis le groupe web         (seulement l'équilibreur ou le proxy)
base : 5432 depuis le groupe app         (seulement l'application)
~~~
<p>Le port 22 ouvert au monde est la première chose qu'un audit signale : des robots essaient des mots de passe en permanence. Mieux : SSH seulement depuis l'adresse du bureau, ou pas de port 22 du tout et AWS Systems Manager Session Manager. Les <strong>NACL</strong>, elles, filtrent au niveau du sous-réseau, sans état, avec des règles numérotées qui peuvent refuser ; on les laisse en général ouvertes.</p>
~~~sh
aws ec2 describe-security-groups --query 'SecurityGroups[].{Nom: GroupName, Id: GroupId}' --output table
aws ec2 describe-security-groups --filters Name=group-name,Values=default --query 'SecurityGroups[0].IpPermissions'
~~~`,
    setup: R`<p><strong>Sur ta machine</strong> : lance une instance @@t3.micro@@ (ou @@t2.micro@@ selon ton plan) avec un security group qui n'ouvre que le port 22 depuis « My IP ». Connecte-toi, puis retire la règle : la session ouverte continue (état), une nouvelle connexion échoue. Termine l'instance ensuite.</p>`,
    quiz: [
      { q: "Faut-il une règle de sortie pour que la réponse à une requête HTTP entrante reparte ?", options: ["Oui, sur le port 80", "Non : un security group est à état, les réponses aux connexions autorisées passent", "Oui, sur les ports éphémères", "Seulement en IPv6"], answer: 1, explain: "C'est la différence avec les NACL, sans état, où il faut autoriser les ports éphémères au retour." },
      { q: "Comment n'autoriser la base qu'aux serveurs d'application, qui changent d'adresse avec l'autoscaling ?", options: ["Lister leurs IP", "Une règle dont la source est le security group des serveurs d'application", "Ouvrir au VPC entier", "Une NACL"], answer: 1, explain: "La règle suit les membres du groupe, sans maintenance." }
    ],
    challenge: {
      prompt: R`<p>L'audit de sécurité signale l'instance @@api@@ : son security group @@api@@ ouvre SSH (port 22) à tout Internet. Corrige-le :</p><ul><li>SSH seulement depuis l'adresse du bureau, @@198.51.100.23@@ ;</li><li>le port 80 reste ouvert à tous ;</li><li>ajoute le port 443 pour tous, l'API passe en HTTPS.</li></ul>`,
      setup: awsSetup({ resources: [
        { type: "aws_security_group", as: "sg", args: { name: "api", description: "API publique", ingress: [{ from_port: 22, to_port: 22, protocol: "tcp", cidr_blocks: ["0.0.0.0/0"] }, { from_port: 80, to_port: 80, protocol: "tcp", cidr_blocks: ["0.0.0.0/0"] }], egress: [{ from_port: 0, to_port: 0, protocol: "-1", cidr_blocks: ["0.0.0.0/0"] }], tags: {} } },
        { type: "aws_instance", args: { ami: AMI, instance_type: "t3.small", vpc_security_group_ids: ["@sg"], user_data: NGINX, tags: { Name: "api" } } }
      ] }),
      checks: { reach: { api: { 22: [true, { open: false, from: "203.0.113.77" }], 80: true, 443: true } } },
      solution: [
        "SG=$(aws ec2 describe-security-groups --filters Name=group-name,Values=api --query 'SecurityGroups[0].GroupId' --output text)",
        "aws ec2 revoke-security-group-ingress --group-id $SG --protocol tcp --port 22 --cidr 0.0.0.0/0",
        "aws ec2 authorize-security-group-ingress --group-id $SG --protocol tcp --port 22 --cidr 198.51.100.23/32",
        "aws ec2 authorize-security-group-ingress --group-id $SG --protocol tcp --port 443 --cidr 0.0.0.0/0"
      ],
      hint: "Une règle ne se modifie pas : on la retire (revoke-security-group-ingress avec exactement les mêmes protocole, port et CIDR) puis on en ajoute une autre. L'adresse seule s'écrit 198.51.100.23/32."
    }
  },
  {
    id: "aws-06", section: "Réseau et calcul", title: "EC2 : lancer une instance", xp: 110,
    theory: R`<p>Lancer une instance, c'est choisir :</p>
<ul><li>une <strong>AMI</strong>, l'image du disque de démarrage (Ubuntu 24.04, Amazon Linux 2023, ou ton image construite avec Packer). Son identifiant change d'une région à l'autre ;</li><li>un <strong>type</strong> : famille, génération, taille. @@t3.micro@@ (2 vCPU « burstables », 1 Go) pour les petits services, @@m@@ polyvalent, @@c@@ calcul, @@r@@ mémoire, @@g@@ GPU ; le suffixe @@g@@ (@@t4g@@) désigne les processeurs Graviton (ARM), moins chers ;</li><li>un sous-réseau et des security groups ;</li><li>un <strong>user data</strong> : un script exécuté au premier démarrage (installer nginx, récupérer la configuration) ;</li><li>un <strong>profil d'instance</strong> (le rôle IAM), et une paire de clés si tu veux SSH ;</li><li>des volumes <strong>EBS</strong> : des disques réseau, attachés à une zone, qui survivent à un arrêt.</li></ul>
<p>Le cycle de vie compte pour la facture : une instance <strong>arrêtée</strong> ne paie plus le calcul mais paie encore ses volumes ; son IP publique est perdue (une Elastic IP la garde, mais se paie). <strong>Terminer</strong> supprime l'instance et, par défaut, son volume racine. Les instances sont du bétail, pas des animaux de compagnie : on les recrée à partir d'une image et d'un script, on ne les répare pas à la main.</p>
~~~sh
aws ec2 describe-instances --query 'Reservations[].Instances[].{Id: InstanceId, Type: InstanceType, Etat: State.Name, IP: PublicIpAddress}' --output table
aws ec2 describe-instances --filters Name=tag:Name,Values=web --query 'Reservations[].Instances[].PublicDnsName' --output text
~~~
<p>Lancer à la CLI ressemble à ceci (les options longues se coupent avec @@\@@ en fin de ligne) :</p>
~~~text
aws ec2 run-instances --image-id ami-0c9b7f4e5d3a21f80 --instance-type t3.micro \
  --security-group-ids sg-0123… --user-data file://init.sh \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=vitrine}]'
~~~`,
    setup: R`<p><strong>Sur ta machine</strong> : lance une instance Ubuntu dans le VPC par défaut avec un user data qui installe nginx et un security group ouvrant le port 80. Ouvre son DNS public dans le navigateur. Arrête-la, relance-la : l'IP publique a changé. Termine-la enfin, et vérifie dans EC2, Volumes, qu'aucun disque ne reste.</p>`,
    quiz: [
      { q: "Tu arrêtes une instance pour la nuit. Que paies-tu encore ?", options: ["Rien", "Ses volumes EBS (et une Elastic IP si elle en a une)", "Le calcul, au tarif réduit", "Tout, comme si elle tournait"], answer: 1, explain: "Le calcul s'arrête, le stockage reste." },
      { q: "À quoi sert le user data ?", options: ["À stocker des données utilisateur", "À exécuter un script au premier démarrage, pour configurer l'instance sans intervention", "À choisir l'utilisateur SSH", "À chiffrer le disque"], answer: 1, explain: "Avec une image et un user data, une instance se recrée à l'identique : c'est ce qu'utilisent les groupes d'autoscaling." }
    ],
    challenge: {
      prompt: R`<p>Lance l'instance du site vitrine dans le VPC par défaut :</p><ul><li>AMI Ubuntu @@ami-0c9b7f4e5d3a21f80@@, type @@t3.micro@@ ;</li><li>le security group existant @@web@@ (il ouvre le port 80) ;</li><li>le script @@~/init.sh@@ comme user data, il installe nginx ;</li><li>l'étiquette @@Name@@ = @@vitrine@@.</li></ul><p>Vérifie avec @@curl@@ sur son IP publique.</p>`,
      setup: awsSetup({ resources: [{ type: "aws_security_group", args: { name: "web", description: "Site public", ingress: [{ from_port: 80, to_port: 80, protocol: "tcp", cidr_blocks: ["0.0.0.0/0"] }], egress: [{ from_port: 0, to_port: 0, protocol: "-1", cidr_blocks: ["0.0.0.0/0"] }], tags: {} } }] }, { files: { "init.sh": NGINX } }),
      checks: { reach: { vitrine: { 80: true } }, aws: { aws_instance: { match: { instance_type: "t3.micro", ami: AMI, tags: { Name: "vitrine" } } } } },
      solution: [
        "SG=$(aws ec2 describe-security-groups --filters Name=group-name,Values=web --query 'SecurityGroups[0].GroupId' --output text)",
        "aws ec2 run-instances --image-id ami-0c9b7f4e5d3a21f80 --instance-type t3.micro --security-group-ids $SG --user-data file://init.sh --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=vitrine}]'",
        "curl -s http://$(aws ec2 describe-instances --filters Name=tag:Name,Values=vitrine --query 'Reservations[].Instances[].PublicIpAddress' --output text)"
      ],
      hint: "Récupère l'identifiant du groupe : aws ec2 describe-security-groups --filters Name=group-name,Values=web --query 'SecurityGroups[0].GroupId' --output text. Puis aws ec2 run-instances --image-id … --instance-type t3.micro --security-group-ids … --user-data file://init.sh --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=vitrine}]'."
    }
  },
  {
    id: "aws-07", section: "Réseau et calcul", title: "ECS, EKS, Lambda : le calcul géré", xp: 60, theoryOnly: true,
    theory: R`<p>EC2 te laisse tout : système, mises à jour, mise à l'échelle. Plus on monte, moins on gère :</p>
<ul><li><strong>ECS</strong> fait tourner des conteneurs Docker (images dans <strong>ECR</strong>) à partir d'une <em>définition de tâche</em> : image, CPU, mémoire, variables, rôle IAM de la tâche. Un <em>service</em> garde N tâches en vie derrière un équilibreur. Avec <strong>Fargate</strong>, plus de machines du tout : on paie le CPU et la mémoire des tâches à la seconde ;</li><li><strong>EKS</strong> est un Kubernetes géré : AWS opère le plan de contrôle (environ 0,10 $ de l'heure par cluster), tu fournis les nœuds (EC2, groupes gérés, Karpenter) ou Fargate. Tout ce que tu as appris dans le cours Kubernetes s'applique, avec en plus l'intégration IAM (rôles pour les comptes de service) et l'AWS Load Balancer Controller pour les Ingress ;</li><li><strong>Lambda</strong> exécute une fonction en réponse à un événement (requête via API Gateway, objet déposé dans S3, message SQS, horaire EventBridge). Pas de serveur, facturation à la milliseconde, mise à l'échelle automatique. Limites : 15 minutes par exécution, 10 Go de mémoire, démarrage à froid de quelques centaines de millisecondes, concurrence limitée par compte.</li></ul>
~~~text
Besoin                                        Choix courant
Vieille application, accès au système          EC2 (+ groupe d'autoscaling)
Conteneurs, équipe sans Kubernetes             ECS sur Fargate
Plateforme Kubernetes, multi-cloud, outillage  EKS
Événements courts, trafic irrégulier           Lambda
~~~
<p>En entretien, la bonne réponse est rarement « le plus géré » ou « le plus puissant » : c'est celui qui colle à l'équipe (compétences, temps d'exploitation), au profil de charge et au coût. Une API à trafic constant élevé revient souvent moins cher sur ECS que sur Lambda ; une tâche nocturne de deux minutes, l'inverse.</p>`,
    setup: R`<p><strong>Sur ta machine</strong> : crée une fonction Lambda Python « Hello world » dans la console, teste-la, puis ajoute un déclencheur « Function URL » et appelle-la avec @@curl@@. Lis ses journaux dans CloudWatch Logs. Le niveau gratuit de Lambda (un million de requêtes par mois) est permanent.</p>`,
    quiz: [
      { q: "Une tâche de traitement d'images dure 40 minutes. Lambda convient-elle ?", options: ["Oui", "Non : une exécution Lambda est limitée à 15 minutes ; ECS sur Fargate ou AWS Batch conviennent mieux", "Oui, avec plus de mémoire", "Seulement en Python"], answer: 1, explain: "On peut aussi découper le travail en morceaux de moins de 15 minutes orchestrés par Step Functions." },
      { q: "Avec ECS sur Fargate, qui applique les correctifs au système des machines ?", options: ["Toi", "AWS : il n'y a pas de machine à gérer, seulement des tâches", "Docker", "Personne"], answer: 1, explain: "Tu restes responsable de ton image (ses paquets, ses failles) et des droits de la tâche." },
      { q: "Qu'est-ce qu'un démarrage à froid sur Lambda ?", options: ["Une panne de la région", "Le temps de préparer un nouvel environnement d'exécution quand aucun n'est disponible, qui retarde la première requête", "Un redémarrage planifié", "Le premier déploiement"], answer: 1, explain: "La concurrence provisionnée ou SnapStart le réduisent, contre un coût." }
    ]
  }
];
