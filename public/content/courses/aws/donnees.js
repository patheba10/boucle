/* Cours AWS — chapitre 3 : S3 et sa protection, bases de données et disques. */
import { R } from "../linux/tag.js";
import { H, awsSetup } from "./fondations.js";

const POLITIQUE_TLS = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "RefuserSansTLS",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::boucle-sauvegardes",
        "arn:aws:s3:::boucle-sauvegardes/*"
      ],
      "Condition": {
        "Bool": { "aws:SecureTransport": "false" }
      }
    }
  ]
}
`;
const BT = "`"; // accent grave dans un gabarit
const BASE = (id, extra) => ({ type: "aws_db_instance", args: { identifier: id, engine: "postgres", instance_class: "db.t4g.micro", allocated_storage: 20, username: "boutique", skip_final_snapshot: true, tags: {}, ...extra } });

export default [
  {
    id: "aws-08", section: "Données", title: "S3 : stocker et protéger des objets", xp: 120,
    theory: R`<p><strong>S3</strong> stocke des <em>objets</em> (un fichier et ses métadonnées) sous une <em>clé</em> (@@2026/janvier.pdf@@), dans un <em>bucket</em> dont le nom est unique au monde. Les « dossiers » ne sont que des préfixes de clé. Durabilité annoncée : onze 9 (99,999999999 %), les données étant copiées dans au moins trois zones.</p>
<p>Les <strong>classes de stockage</strong> échangent prix du stockage contre prix et délai de lecture : Standard, Standard-IA (accès rare), Intelligent-Tiering (déplace seul), Glacier Instant Retrieval, Flexible Retrieval et Deep Archive (heures de délai, quelques euros par To et par mois). Une <strong>règle de cycle de vie</strong> déplace ou supprime les objets selon leur âge.</p>
<p>Protéger un bucket, c'est quatre réflexes :</p>
<ol><li><strong>Block Public Access</strong> activé (c'est le cas par défaut depuis 2023) : il empêche toute ACL ou politique publique, même par erreur ;</li><li><strong>chiffrement</strong> au repos : SSE-S3 par défaut, SSE-KMS pour contrôler la clé et tracer son usage ;</li><li><strong>versionnement</strong> : une suppression ou un écrasement garde l'ancienne version, contre les erreurs et les rançongiciels ;</li><li>une <strong>politique de bucket</strong> pour ce qu'IAM seul ne dit pas, par exemple refuser toute requête qui n'est pas en HTTPS (condition @@aws:SecureTransport@@).</li></ol>
~~~sh
aws s3 ls s3://factures-2026 --recursive
aws s3 cp s3://factures-2026/lisezmoi.txt -
aws s3api get-bucket-versioning --bucket factures-2026
! aws s3api get-bucket-policy --bucket factures-2026
~~~
<p>Pour partager un objet sans rendre le bucket public, on génère une <strong>URL pré-signée</strong> (@@aws s3 presign@@), valable quelques minutes. Pour un site statique, on met CloudFront devant le bucket, qui reste privé.</p>`,
    setup: R`<p><strong>Sur ta machine</strong> : crée un bucket (nom unique, par exemple avec ton prénom et la date), active le versionnement, dépose un fichier, dépose-le à nouveau modifié, puis supprime-le : avec « Show versions », les anciennes versions sont toujours là. Ajoute la politique de cet exercice et essaie @@curl http://<bucket>.s3.amazonaws.com/<clé>@@. Vide puis supprime le bucket à la fin.</p>`,
    quiz: [
      { q: "Un collègue supprime par erreur tout le préfixe 2026/ d'un bucket versionné. Que reste-t-il ?", options: ["Rien", "Les versions précédentes : la suppression a seulement posé des marqueurs de suppression, qu'on peut retirer", "Seulement le dernier objet", "Une copie dans Glacier"], answer: 1, explain: "Le versionnement est la protection la plus simple contre l'erreur humaine ; on y ajoute MFA Delete ou Object Lock pour les sauvegardes." },
      { q: "À quoi sert Block Public Access si le bucket n'a pas de politique publique ?", options: ["À rien", "À empêcher qu'une politique ou une ACL publique soit ajoutée plus tard, par erreur", "À chiffrer les objets", "À accélérer les lectures"], answer: 1, explain: "C'est un garde-fou au niveau du compte ou du bucket, au-dessus des politiques." },
      { q: "Pourquoi « Principal »: \"*\" ne rend-il pas le bucket public dans la politique de cet exercice ?", options: ["Parce qu'il est ignoré", "Parce que l'effet est Deny : la déclaration retire des droits à tout le monde, elle n'en donne pas", "Parce que Block Public Access le bloque", "Parce que la condition est fausse"], answer: 1, explain: "Seul un Allow à un principal anonyme rend public. Un Deny universel avec condition est une pratique recommandée." }
    ],
    challenge: {
      kind: "script", file: H + "/politique.json", editorLang: "json",
      run: [
        "aws s3api put-public-access-block --bucket boucle-sauvegardes --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true",
        "aws s3api put-bucket-versioning --bucket boucle-sauvegardes --versioning-configuration Status=Enabled",
        "aws s3api put-bucket-policy --bucket boucle-sauvegardes --policy file://politique.json",
        "aws s3api get-bucket-policy --bucket boucle-sauvegardes --query Policy --output text"
      ],
      checkLabel: "Sécuriser le bucket", checkNote: "Block Public Access, versionnement, puis ta politique", okMsg: "Bravo : sauvegardes privées, versionnées, et inaccessibles hors HTTPS.",
      prompt: R`<p>Le bucket @@boucle-sauvegardes@@ reçoit les sauvegardes de la base. Le test active Block Public Access et le versionnement, puis applique ta politique de bucket @@politique.json@@. Elle doit :</p><ul><li>refuser toute action S3, à tout le monde, quand la requête n'utilise pas TLS (@@aws:SecureTransport@@ vaut @@false@@) ;</li><li>sur le bucket et sur tous ses objets ;</li><li>sans rien empêcher d'autre : en HTTPS, l'administrateur doit toujours pouvoir lire et écrire.</li></ul>`,
      starter: '{\n  "Version": "2012-10-17",\n  "Statement": []\n}\n',
      solution: POLITIQUE_TLS,
      setup: awsSetup({ s3: { "boucle-sauvegardes": { "pg/2026-11-11.dump": "PGDMP" } } }),
      tests: [{ label: "Requêtes HTTP refusées, HTTPS permis, bucket privé et versionné", outHas: "RefuserSansTLS", checks: {
        s3: { "boucle-sauvegardes": { versioning: "Enabled", blockPublic: true } },
        iam: { profile: "default", allow: [["s3:GetObject", "arn:aws:s3:::boucle-sauvegardes/pg/2026-11-11.dump"], ["s3:PutObject", "arn:aws:s3:::boucle-sauvegardes/pg/2026-11-12.dump"]] }
      } }, { label: "Sans TLS, lecture, écriture et listage sont refusés", checks: {
        iam: { profile: "default", context: { "aws:SecureTransport": "false" }, deny: [["s3:GetObject", "arn:aws:s3:::boucle-sauvegardes/pg/2026-11-11.dump"], ["s3:PutObject", "arn:aws:s3:::boucle-sauvegardes/x"], ["s3:ListBucket", "arn:aws:s3:::boucle-sauvegardes"]] }
      } }],
      hint: "Une déclaration Effect Deny, Principal \"*\", Action \"s3:*\", Resource avec les deux ARN (le bucket, et le bucket suivi de /*), et Condition { \"Bool\": { \"aws:SecureTransport\": \"false\" } }."
    }
  },
  {
    id: "aws-09", section: "Données", title: "Bases de données et disques", xp: 100,
    theory: R`<p><strong>RDS</strong> gère PostgreSQL, MySQL, MariaDB, SQL Server ou Oracle : installation, correctifs, sauvegardes automatiques avec restauration à la seconde près (jusqu'à 35 jours), supervision. Deux mécanismes à ne pas confondre :</p>
<ul><li><strong>Multi-AZ</strong> : une copie synchrone dans une autre zone, invisible, qui prend le relais en une à deux minutes en cas de panne. C'est de la <em>disponibilité</em> ;</li><li><strong>réplica en lecture</strong> : une copie asynchrone qu'on interroge pour décharger la base principale. C'est de la <em>performance</em> (et un peu de reprise après sinistre, dans une autre région).</li></ul>
<p><strong>Aurora</strong> est la version d'AWS, compatible PostgreSQL et MySQL, avec un stockage réparti sur trois zones. Une base de production se place en sous-réseau privé (@@PubliclyAccessible@@ à @@false@@), chiffrée (le chiffrement se choisit à la création), avec un security group qui n'accepte que l'application.</p>
<p><strong>DynamoDB</strong> est une base clé-valeur sans serveur : une clé de partition (et une clé de tri), des lectures en quelques millisecondes à n'importe quelle échelle, facturée à la requête ou en capacité réservée. On conçoit la table à partir des requêtes qu'on fera, pas l'inverse.</p>
<p>Côté disques : <strong>EBS</strong> (un disque réseau pour une instance, dans une zone, sauvegardé par instantanés ; @@gp3@@ par défaut), <strong>EFS</strong> (un système de fichiers NFS partagé entre instances et zones), et <strong>S3</strong> pour tout ce qui est fichier à lire et écrire en entier.</p>
~~~sh
aws rds describe-db-instances --query 'DBInstances[].[DBInstanceIdentifier, Engine, MultiAZ]' --output table
~~~
<p>Les filtres JMESPath comparent à un littéral entre accents graves : @@DBInstances[?MultiAZ==${BT}false${BT}]@@. Plusieurs conditions se combinent avec @@&&@@ et @@||@@.</p>`,
    setup: R`<p><strong>Sur ta machine</strong> : crée une base RDS PostgreSQL avec le modèle « Free tier » (@@db.t4g.micro@@, 20 Go), non publique, puis connecte-toi depuis une instance EC2 du même VPC avec @@psql@@. Supprime-la en refusant l'instantané final : une base oubliée coûte vite plus que tout le reste du compte.</p>`,
    quiz: [
      { q: "La base principale tombe. Qu'est-ce qui prend le relais automatiquement ?", options: ["Le réplica en lecture", "La copie Multi-AZ, synchrone, avec bascule automatique du nom DNS", "Le dernier instantané", "Rien"], answer: 1, explain: "Un réplica en lecture peut être promu, mais à la main (ou par ton automatisation), et il peut avoir du retard." },
      { q: "Peut-on chiffrer une base RDS existante non chiffrée ?", options: ["Oui, d'un clic", "Pas directement : on chiffre une copie d'instantané, puis on restaure une nouvelle base à partir d'elle", "Non, jamais", "Oui, en redémarrant"], answer: 1, explain: "D'où l'intérêt de chiffrer dès la création, et d'un contrôle automatique (AWS Config) qui le vérifie." }
    ],
    challenge: {
      prompt: R`<p>Le compte a trois bases PostgreSQL. La sécurité demande la liste de celles à corriger : une base est à corriger si elle est <strong>accessible publiquement</strong> ou <strong>non chiffrée</strong>.</p><p>Écris leurs identifiants dans @@~/a-corriger.txt@@, un par ligne, triés par ordre alphabétique. Utilise @@--query@@ plutôt que de recopier à la main : demain, il y en aura quarante.</p>`,
      setup: awsSetup({ resources: [
        BASE("boutique-prod", { multi_az: true, storage_encrypted: true, publicly_accessible: false }),
        BASE("rapports", { storage_encrypted: false, publicly_accessible: false }),
        BASE("boutique-dev", { storage_encrypted: true, publicly_accessible: true })
      ] }),
      checks: { files: { [H + "/a-corriger.txt"]: "boutique-dev\nrapports\n" } },
      solution: ["aws rds describe-db-instances --query 'DBInstances[].[DBInstanceIdentifier, PubliclyAccessible, StorageEncrypted]' --output table", "aws rds describe-db-instances --query 'DBInstances[?PubliclyAccessible==`true` || StorageEncrypted==`false`].DBInstanceIdentifier' --output text | tr '\\t' '\\n' | sort > a-corriger.txt"],
      hint: "aws rds describe-db-instances --query 'DBInstances[?PubliclyAccessible==`true` || StorageEncrypted==`false`].DBInstanceIdentifier' --output text affiche les identifiants sur une ligne, séparés par des tabulations : tr '\\t' '\\n' | sort > a-corriger.txt."
    }
  }
];
