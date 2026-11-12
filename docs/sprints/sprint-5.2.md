# Sprint 5.2

**Objectif** : la CLI `aws`, IAM et le réseau sur le compte simulé, puis le cours AWS.

| Story | Points | Statut |
|-------|--------|--------|
| #54 US-5.1 CLI aws, IAM et réseau simulés (enabler) | 8 | En cours |
| #55 US-5b Cours AWS | 8 | À faire |

**Capacité** : 16 points. Le sprint court sur plusieurs sessions : le journal ci-dessous dit où reprendre.

## Conception

- `lib/aws/iam.js` : évaluateur de politiques IAM comme AWS (Deny explicite > Allow > refus implicite), actions avec jokers (`s3:Get*`), ressources et ARN avec jokers, conditions courantes (`StringEquals`, `StringLike`, `IpAddress`, `Bool` sur `aws:SecureTransport`, `aws:MultiFactorAuthPresent`), politiques d'identité et politiques de bucket, limites des permissions ignorées au départ. Explication de la décision (quelle déclaration a joué).
- Joignabilité (finalement dans `lib/aws/cli.js`, fonction `reach`, pour éviter un module de trente lignes) : accessibilité d'une instance depuis Internet ou depuis une autre instance : sous-réseau public (route `0.0.0.0/0` vers une passerelle Internet), IP publique, security groups (entrée, port, source CIDR ou groupe), NACL ignorées au départ. Diagnostic lisible de la première règle qui bloque.
- `lib/aws/cli.js` : `aws sts get-caller-identity`, `aws s3 ls|mb|cp|rm|rb`, `aws s3api`, `aws ec2 describe-instances|describe-vpcs|describe-subnets|describe-security-groups|authorize-security-group-ingress|run-instances|terminate-instances`, `aws iam create-role|attach-role-policy|list-roles|simulate-principal-policy`, `aws rds describe-db-instances`, `aws cloudwatch` minimal ; sorties JSON du vrai AWS (`--output table|text`, `--query` JMESPath simple). Profils et identité courante (`AWS_PROFILE`), erreurs `AccessDenied` évaluées par IAM.
- Critères : décision IAM attendue, accessibilité réseau, ressources du compte.

## Journal

- 12 nov. : branche `us-5.1/aws-cli` créée, conception ci-dessus. Prochaine étape : `lib/aws/iam.js` et ses tests.
- 12 nov. : `iam.js` (évaluation des politiques, conditions, politiques gérées) puis `cli.js` : `aws` sur le compte partagé avec Terraform, `--query` réécrit en vrai petit analyseur JMESPath (un premier jet à base d'expressions régulières ne savait pas distinguer `[]` de `[*]`), joignabilité d'une instance branchée sur `curl` via deux registres ajoutés au terminal (`DNS_HOOKS`, et les IP littérales qui ne répondent plus 200 par défaut). 7 tests unitaires, 738 vérifications de contenu toujours vertes. Point appris en écrivant les tests : `Reservations[].Instances[?…].InstanceId` renvoie bien une liste de listes, comme le vrai JMESPath ; le cours devra le montrer. Prochaine étape : PR de #54, puis le cours AWS (#55).
