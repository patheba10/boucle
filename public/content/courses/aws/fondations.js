/* Cours AWS — chapitre 1 : régions et responsabilité partagée, CLI, IAM, diagnostic d'un AccessDenied. */
import { R } from "../linux/tag.js";

export const H = "/home/eleve";
export const ADMIN = "arn:aws:iam::aws:policy/AdministratorAccess";
/** Mise en place : compte AWS simulé (profils, ressources, buckets), fichiers dans ~, commandes préalables. */
export const awsSetup = (aws = {}, { files = {}, commands = [] } = {}) => ({ aws, files: { [H + "/.bashrc"]: "", ...Object.fromEntries(Object.entries(files).map(([k, v]) => [H + "/" + k, v])) }, commands, cwd: H });

/** Politique de lecture seule sur le bucket des factures (réutilisée par plusieurs leçons). */
export const LIRE_FACTURES = { Version: "2012-10-17", Statement: [{ Sid: "LireFactures", Effect: "Allow", Action: ["s3:GetObject", "s3:ListBucket"], Resource: ["arn:aws:s3:::factures-2026", "arn:aws:s3:::factures-2026/*"] }] };
/** Compte des extraits de théorie : deux buckets, un profil compta en lecture seule, une instance web. */
export const SNIP = {
  cwd: H,
  aws: {
    s3: { "factures-2026": { "2026/janvier.pdf": "%PDF-1.7 janvier", "2026/fevrier.pdf": "%PDF-1.7 fevrier", "lisezmoi.txt": "Factures de la boutique\n" }, "rh-salaires": { "paie-2026-10.csv": "nom,montant\n" } },
    profiles: { default: { user: "eleve", policies: [ADMIN] }, compta: { user: "compta", policies: [LIRE_FACTURES] } },
    resources: [{ type: "aws_instance", args: { ami: "ami-0c9b7f4e5d3a21f80", instance_type: "t3.micro", user_data: "#!/bin/bash\napt-get install -y nginx\n", tags: { Name: "web", Env: "prod" } } }]
  }
};
const TRUST_EC2 = '{\n  "Version": "2012-10-17",\n  "Statement": [\n    {\n      "Effect": "Allow",\n      "Principal": { "Service": "ec2.amazonaws.com" },\n      "Action": "sts:AssumeRole"\n    }\n  ]\n}\n';
const POLICY_OK = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ListerLeBucket",
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::factures-2026"
    },
    {
      "Sid": "LireLesFactures",
      "Effect": "Allow",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::factures-2026/*"
    }
  ]
}
`;
const POLICY_TROP_LARGE = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "s3:*",
      "Resource": "*"
    }
  ]
}
`;
const PUBLIER_CASSEE = JSON.stringify({ Version: "2012-10-17", Statement: [{ Sid: "PublierLeSite", Effect: "Allow", Action: "s3:PutObject", Resource: "arn:aws:s3:::site-boutique" }] });

export default [
  {
    id: "aws-01", section: "Les fondations", title: "Le cloud AWS : régions, comptes, responsabilité partagée", xp: 70,
    theory: R`<p>AWS loue de l'infrastructure à la demande : des machines, du stockage, des bases, du réseau, facturés à l'usage et pilotés par API. Trois notions d'organisation reviennent partout :</p>
<ul><li>une <strong>région</strong> (@@ca-central-1@@ à Montréal, @@eu-west-3@@ à Paris) est un ensemble indépendant de centres de données. Les ressources vivent dans une région, et les données n'en sortent pas sans qu'on le décide ;</li><li>une <strong>zone de disponibilité</strong> (AZ, @@ca-central-1a@@) est un ou plusieurs centres de données isolés des autres zones de la région. Répartir une application sur deux ou trois zones protège d'une panne d'un bâtiment ;</li><li>un <strong>compte</strong> (12 chiffres) est la frontière de facturation et de sécurité. Les entreprises séparent dev, prod et sécurité dans des comptes différents, regroupés dans AWS Organizations.</li></ul>
<p>Le <strong>modèle de responsabilité partagée</strong> dit qui protège quoi. AWS est responsable <em>du</em> cloud : bâtiments, matériel, hyperviseur, réseau mondial. Toi, tu es responsable de ce que tu mets <em>dans</em> le cloud : identités et droits, ouverture du réseau, chiffrement, données, et le système d'une instance EC2 (ses mises à jour, son pare-feu). La limite bouge avec le service : sur RDS, AWS applique les correctifs de la base ; sur Lambda, il gère tout jusqu'au runtime. Mais un bucket rendu public par erreur est toujours ta responsabilité.</p>
<p>On pilote AWS par la console web, par la <strong>CLI</strong>, par les SDK, ou par du code d'infrastructure (Terraform). La CLI lit ses identifiants dans @@~/.aws/credentials@@ et sa configuration dans @@~/.aws/config@@, par <strong>profil</strong> (@@--profile prod@@ ou la variable @@AWS_PROFILE@@). La première commande à taper sur un compte inconnu :</p>
~~~sh
aws sts get-caller-identity
aws configure get region
aws sts get-caller-identity --query Arn --output text
aws s3 ls
~~~
<p>Les réponses sont en JSON. @@--query@@ en extrait une partie (syntaxe JMESPath, vue en détail plus loin) et @@--output text@@ retire les guillemets, pratique dans un script.</p>`,
    setup: R`<p><strong>Sur ta machine</strong> : crée un compte AWS (depuis juillet 2025, le plan gratuit des nouveaux comptes donne jusqu'à 200 $ de crédits, pendant six mois au plus). Active tout de suite la MFA sur l'utilisateur racine, puis ne t'en sers plus. Crée un utilisateur pour toi dans IAM Identity Center, installe la CLI v2 et lance @@aws configure sso@@, puis @@aws sts get-caller-identity@@. Crée enfin un budget à 5 $ avec une alerte par courriel (Billing, Budgets) : c'est la meilleure protection contre une facture surprise.</p>`,
    quiz: [
      { q: "Une instance EC2 a une faille connue dans OpenSSH. Qui doit appliquer le correctif ?", options: ["AWS, c'est son matériel", "Toi : le système d'exploitation d'une instance EC2 est de ton côté du modèle de responsabilité partagée", "Personne, AWS isole les instances", "Le support AWS, sur demande"], answer: 1, explain: "Sur EC2, tout ce qui est au-dessus de l'hyperviseur est à toi. Sur RDS ou Lambda, AWS prend plus de choses en charge." },
      { q: "Pourquoi répartir une application sur plusieurs zones de disponibilité ?", options: ["Pour payer moins", "Pour qu'une panne d'un centre de données ne coupe pas le service", "Parce que c'est obligatoire", "Pour se rapprocher des clients"], answer: 1, explain: "Les zones d'une région sont isolées (alimentation, réseau) mais proches : on y réplique sans latence notable." },
      { q: "Quelle commande dit avec quel compte et quelle identité la CLI travaille ?", options: ["aws whoami", "aws sts get-caller-identity", "aws iam get-user", "aws configure list-accounts"], answer: 1, explain: "Elle ne demande aucun droit particulier : c'est le premier réflexe avant d'agir sur un compte." }
    ],
    challenge: {
      prompt: R`<p>Deux profils sont configurés : @@default@@ et @@prod@@. Avant de toucher à quoi que ce soit, on vérifie où l'on est :</p><ol><li>écris dans @@~/compte.txt@@ l'identifiant du compte (les 12 chiffres seuls) ;</li><li>écris dans @@~/qui.txt@@ l'ARN de l'identité qu'utilise le profil @@prod@@.</li></ol><p>Chaque fichier ne contient que la valeur, suivie d'un retour à la ligne.</p>`,
      setup: awsSetup({ profiles: { default: { user: "eleve", policies: [ADMIN] }, prod: { user: "deploiement", policies: ["arn:aws:iam::aws:policy/ReadOnlyAccess"] } } }),
      checks: { files: { [H + "/compte.txt"]: "123456789012\n", [H + "/qui.txt"]: "arn:aws:iam::123456789012:user/deploiement\n" } },
      solution: ["aws sts get-caller-identity", "aws sts get-caller-identity --query Account --output text > compte.txt", "aws sts get-caller-identity --profile prod --query Arn --output text > qui.txt"],
      hint: "aws sts get-caller-identity --query Account --output text > compte.txt, puis la même commande avec --profile prod et --query Arn."
    }
  },
  {
    id: "aws-02", section: "Les fondations", title: "IAM : identités, rôles et politiques", xp: 110,
    theory: R`<p>IAM décide qui peut faire quoi sur quelles ressources. Les identités :</p>
<ul><li>l'<strong>utilisateur racine</strong> du compte a tous les droits ; on le protège par MFA et on ne s'en sert pas ;</li><li>un <strong>utilisateur IAM</strong> a des identifiants permanents (mot de passe, clés d'accès). Les clés qui traînent sont la première cause de fuite : on préfère IAM Identity Center pour les humains ;</li><li>un <strong>rôle</strong> n'a pas d'identifiants permanents : on l'<em>endosse</em> (@@sts:AssumeRole@@) et on reçoit des identifiants temporaires. C'est la bonne façon de donner des droits à une instance EC2, une fonction Lambda, une tâche ECS ou un pipeline CI (par OIDC). Sa <strong>politique de confiance</strong> dit qui peut l'endosser.</li></ul>
<p>Une <strong>politique</strong> est un document JSON. Chaque déclaration a un effet, des actions et des ressources (ARN), et éventuellement des conditions :</p>
~~~json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject"],
      "Resource": "arn:aws:s3:::factures-2026/*",
      "Condition": { "Bool": { "aws:SecureTransport": "true" } }
    }
  ]
}
~~~
<p>L'évaluation suit toujours le même ordre : un <strong>Deny explicite</strong> l'emporte sur tout ; sinon un <strong>Allow</strong> suffit ; sinon c'est un <strong>refus implicite</strong>. Tout est donc interdit par défaut, et on ajoute le strict nécessaire : c'est le <strong>moindre privilège</strong>.</p>
<p>Le piège classique de S3 : le bucket et ses objets sont deux ressources. @@s3:ListBucket@@ porte sur @@arn:aws:s3:::factures-2026@@, @@s3:GetObject@@ sur @@arn:aws:s3:::factures-2026/*@@. Une politique d'identité s'attache à un utilisateur, un groupe ou un rôle ; une politique de ressource (politique de bucket) s'attache au bucket et nomme un @@Principal@@.</p>
~~~sh
aws iam list-roles --query 'Roles[].RoleName'
aws iam simulate-principal-policy --policy-source-arn arn:aws:iam::123456789012:user/compta --action-names s3:GetObject s3:DeleteObject --resource-arns arn:aws:s3:::factures-2026/lisezmoi.txt --query 'EvaluationResults[].[EvalActionName, EvalDecision]' --output text
~~~`,
    setup: R`<p><strong>Sur ta machine</strong> : dans IAM, crée un rôle pour EC2 avec la politique gérée @@AmazonS3ReadOnlyAccess@@, puis ouvre l'onglet « Trust relationships » pour lire sa politique de confiance. Dans le simulateur de politiques IAM (policysim.aws.amazon.com), teste @@s3:GetObject@@ et @@s3:PutObject@@ pour ce rôle. Les rôles et les politiques ne coûtent rien.</p>`,
    quiz: [
      { q: "Une politique autorise s3:* sur tout, une autre refuse s3:DeleteObject. L'utilisateur peut-il supprimer un objet ?", options: ["Oui, Allow l'emporte", "Non : un Deny explicite l'emporte toujours", "Ça dépend de l'ordre des politiques", "Seulement avec la MFA"], answer: 1, explain: "Deny explicite, puis Allow, puis refus implicite : l'ordre ne dépend jamais de l'ordre d'écriture." },
      { q: "Comment donner à une application sur EC2 l'accès à un bucket ?", options: ["Copier des clés d'accès dans l'instance", "Un rôle IAM attaché à l'instance (profil d'instance), qui fournit des identifiants temporaires", "Rendre le bucket public", "Utiliser le compte racine"], answer: 1, explain: "Les identifiants temporaires du rôle tournent seuls ; rien à cacher ni à faire tourner à la main." },
      { q: "Avec GetObject sur arn:aws:s3:::factures-2026, « aws s3 cp s3://factures-2026/a.pdf . » échoue. Pourquoi ?", options: ["Le bucket est privé", "GetObject porte sur les objets : il faut la ressource arn:aws:s3:::factures-2026/*", "Il manque s3:Download", "La région est fausse"], answer: 1, explain: "Le bucket et ses objets sont deux ARN différents ; c'est l'erreur IAM la plus fréquente." }
    ],
    challenge: {
      kind: "script", file: H + "/lecture-factures.json", editorLang: "json",
      run: ["aws iam create-policy --policy-name lecture-factures --policy-document file://lecture-factures.json --query Policy.Arn --output text", "aws iam create-role --role-name app-factures --assume-role-policy-document file://confiance.json --query Role.Arn --output text", "aws iam attach-role-policy --role-name app-factures --policy-arn arn:aws:iam::123456789012:policy/lecture-factures"],
      checkLabel: "Créer la politique et le rôle", checkNote: "create-policy, create-role, attach-role-policy", okMsg: "Bravo : un rôle qui lit les factures, et rien d'autre.",
      prompt: R`<p>L'application de facturation tournera sur EC2 avec le rôle @@app-factures@@ (sa politique de confiance est déjà dans @@~/confiance.json@@). Écris la politique @@lecture-factures.json@@ selon le moindre privilège :</p><ul><li>lister le bucket @@factures-2026@@ ;</li><li>lire ses objets ;</li><li>rien d'autre : pas d'écriture, pas de suppression, aucun autre bucket (surtout pas @@rh-salaires@@).</li></ul><p>Le test crée la politique, le rôle, attache l'une à l'autre, puis vérifie les décisions IAM. La politique de départ, trop large, ne passe pas.</p>`,
      starter: POLICY_TROP_LARGE,
      solution: POLICY_OK,
      setup: awsSetup({ s3: { "factures-2026": { "2026/janvier.pdf": "%PDF" }, "rh-salaires": { "paie.csv": "nom,montant\n" } } }, { files: { "confiance.json": TRUST_EC2 } }),
      tests: [{ label: "Le rôle lit les factures, sans pouvoir écrire, supprimer, ni lire ailleurs", outHas: "arn:aws:iam::123456789012:policy/lecture-factures", checks: { iam: { role: "app-factures", allow: [["s3:ListBucket", "arn:aws:s3:::factures-2026"], ["s3:GetObject", "arn:aws:s3:::factures-2026/2026/janvier.pdf"]], deny: [["s3:PutObject", "arn:aws:s3:::factures-2026/2026/mars.pdf"], ["s3:DeleteObject", "arn:aws:s3:::factures-2026/2026/janvier.pdf"], ["s3:GetObject", "arn:aws:s3:::rh-salaires/paie.csv"], ["s3:DeleteBucket", "arn:aws:s3:::factures-2026"]] } } }],
      hint: "Deux déclarations : s3:ListBucket sur arn:aws:s3:::factures-2026 (le bucket), s3:GetObject sur arn:aws:s3:::factures-2026/* (ses objets). Version 2012-10-17, Effect Allow."
    }
  },
  {
    id: "aws-03", section: "Les fondations", title: "Diagnostiquer un AccessDenied", xp: 110,
    theory: R`<p>Un refus d'accès AWS dit presque tout, à condition de le lire en entier :</p>
~~~text
upload failed: index.html to s3://site-boutique/index.html An error occurred (AccessDenied)
when calling the PutObject operation: User: arn:aws:sts::123456789012:assumed-role/ci-site/gh-actions
is not authorized to perform: s3:PutObject on resource: "arn:aws:s3:::site-boutique/index.html"
because no identity-based policy allows the s3:PutObject action
~~~
<ul><li><strong>qui</strong> : l'ARN de l'identité (ici un rôle endossé par la CI). Vérifie que c'est bien celle que tu crois : mauvais profil, mauvais compte ?</li><li><strong>quoi</strong> : l'action exacte (@@s3:PutObject@@) et la ressource exacte, l'objet et non le bucket ;</li><li><strong>pourquoi</strong> : « no identity-based policy allows » veut dire qu'aucune politique ne l'autorise (refus implicite) ; « with an explicit deny in… » désigne un Deny, dans une politique d'identité, de ressource (bucket) ou d'organisation (SCP).</li></ul>
<p>Les causes fréquentes : l'ARN du bucket à la place de celui des objets, @@s3:ListBucket@@ oublié (nécessaire pour @@aws s3 ls@@ et @@aws s3 sync@@), une condition non remplie (IP, MFA, chiffrement), un Deny dans la politique du bucket. Les outils : @@aws iam simulate-principal-policy@@ pour tester une décision, CloudTrail pour voir l'appel refusé, IAM Access Analyzer pour générer une politique à partir de l'activité réelle.</p>
<p>Corriger une politique gérée par le client se fait en créant une nouvelle <strong>version</strong> (cinq au plus, une seule par défaut) : tous les rôles qui l'utilisent en profitent, et on peut revenir en arrière.</p>
~~~sh
! aws s3 rm s3://factures-2026/lisezmoi.txt --profile compta
aws s3 cp s3://factures-2026/lisezmoi.txt - --profile compta
~~~`,
    setup: R`<p><strong>Sur ta machine</strong> : avec un utilisateur qui n'a que @@AmazonS3ReadOnlyAccess@@, tente de créer un bucket et lis le message. Ouvre ensuite CloudTrail, « Event history », et retrouve l'appel @@CreateBucket@@ refusé avec son @@errorCode@@. CloudTrail garde 90 jours d'historique de gestion sans frais.</p>`,
    quiz: [
      { q: "Le message dit « with an explicit deny in a resource-based policy ». Où chercher ?", options: ["Dans les politiques de l'utilisateur", "Dans la politique attachée à la ressource, par exemple la politique du bucket", "Dans les quotas du compte", "Dans la table de routage"], answer: 1, explain: "Ajouter un Allow côté identité ne servirait à rien : le Deny l'emporte." },
      { q: "aws s3 cp fonctionne mais aws s3 ls s3://site-boutique est refusé. Quelle permission manque ?", options: ["s3:GetObject", "s3:ListBucket sur l'ARN du bucket", "s3:ListAllMyBuckets", "s3:HeadBucket"], answer: 1, explain: "Lister le contenu d'un bucket, c'est ListBucket sur le bucket lui-même (sans /*)." }
    ],
    challenge: {
      prompt: R`<p>Depuis ce matin, le déploiement du site échoue avec l'erreur ci-dessus. La CI utilise le rôle @@ci-site@@, qui a la politique gérée @@publier-site@@ (ARN : @@arn:aws:iam::123456789012:policy/publier-site@@).</p><ol><li>affiche la politique (sa version @@v1@@) et trouve l'erreur ;</li><li>publie une version corrigée de la même politique, et fais-en la version par défaut ;</li><li>ne donne pas plus de droits que nécessaire : la CI doit pouvoir déposer des objets dans @@site-boutique@@, et c'est tout.</li></ol>`,
      setup: awsSetup({
        s3: { "site-boutique": { "index.html": "<h1>Boutique</h1>\n" }, "factures-2026": {} },
        resources: [
          { type: "aws_iam_policy", as: "pol", args: { name: "publier-site", policy: PUBLIER_CASSEE, tags: {} } },
          { type: "aws_iam_role", args: { name: "ci-site", assume_role_policy: JSON.stringify({ Version: "2012-10-17", Statement: [{ Effect: "Allow", Principal: { Federated: "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com" }, Action: "sts:AssumeRoleWithWebIdentity" }] }), tags: {} } },
          { type: "aws_iam_role_policy_attachment", args: { role: "ci-site", policy_arn: "@pol.arn" } }
        ]
      }),
      checks: { iam: { role: "ci-site", allow: [["s3:PutObject", "arn:aws:s3:::site-boutique/index.html"], ["s3:PutObject", "arn:aws:s3:::site-boutique/assets/app.js"]], deny: [["s3:PutObject", "arn:aws:s3:::factures-2026/a.pdf"], ["s3:DeleteBucket", "arn:aws:s3:::site-boutique"], ["s3:DeleteObject", "arn:aws:s3:::site-boutique/index.html"]] } },
      solution: [
        "aws iam get-policy-version --policy-arn arn:aws:iam::123456789012:policy/publier-site --version-id v1 --query PolicyVersion.Document > publier.json",
        "sed -i 's#arn:aws:s3:::site-boutique\"#arn:aws:s3:::site-boutique/*\"#' publier.json",
        "aws iam create-policy-version --policy-arn arn:aws:iam::123456789012:policy/publier-site --policy-document file://publier.json --set-as-default",
        "aws iam simulate-principal-policy --policy-source-arn arn:aws:iam::123456789012:role/ci-site --action-names s3:PutObject --resource-arns arn:aws:s3:::site-boutique/index.html"
      ],
      hint: "aws iam get-policy-version --policy-arn … --version-id v1 --query PolicyVersion.Document > publier.json : la ressource est le bucket, pas ses objets. Corrige avec sed (ajoute /*), puis aws iam create-policy-version --policy-arn … --policy-document file://publier.json --set-as-default."
    }
  }
];
