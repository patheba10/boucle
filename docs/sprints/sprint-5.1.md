# Sprint 5.1

**Objectif** : Terraform dans le terminal, sur un compte AWS simulé, puis le cours Terraform.

| Story | Points | Statut |
|-------|--------|--------|
| #52 US-5.0 Terraform et compte AWS simulés (enabler) | 8 | Terminé |
| #53 US-5a Cours Terraform | 8 | Terminé |

**Capacité** : 16 points. Le sprint court sur plusieurs sessions : le journal ci-dessous dit où reprendre.

## Conception

- `lib/aws/account.js` : un compte AWS simulé (id `123456789012`, région `ca-central-1`), un magasin de ressources par type (VPC, sous-réseaux, security groups, instances EC2, buckets S3, rôles et politiques IAM, tables DynamoDB, bases RDS) avec identifiants (`vpc-0a1b…`), ARN et attributs calculés. Il sera partagé avec la CLI `aws` au sprint 5.2.
- `lib/terraform/hcl.js` : analyseur HCL (blocs, attributs, listes, objets, chaînes avec interpolation `${…}` et heredoc, références `var.`, `local.`, `resource.nom.attr`, `module.`, `data.`, `count.index`, `each.key`), fonctions courantes (`length`, `join`, `format`, `lookup`, `merge`, `cidrsubnet`, `tolist`, `toset`, `upper`, `lower`).
- `lib/terraform/terraform.js` : `init` (providers, backend), `fmt` (`-check`), `validate`, `plan` (graphe de dépendances, `+`, `~`, `-/+`, `-`, valeurs « known after apply »), `apply`, `destroy`, `output`, `state list|show|rm`, `import`, `-var`, `-var-file`, `terraform.tfvars`, `count` et `for_each`, modules locaux, backend `s3` avec verrou DynamoDB. Schémas des ressources aws : arguments requis et inconnus, types, attributs calculés, arguments qui forcent le remplacement. Sorties au format de Terraform 1.9 (sans couleurs).
- Critères : ressources présentes dans le compte et dans l'état, plan vide après apply (pas de dérive), outputs.

## Journal

- 12 nov. : milestone « Étape 5 — Cloud » (#52 à #56) et branche `us-5.0/terraform` créées, conception ci-dessus. Prochaine étape : `lib/terraform/hcl.js` et ses tests.
- 12 nov. : `lib/terraform/hcl.js` écrit et essayé (blocs, expressions, interpolation, for, fonctions, erreurs au format Terraform). Prochaine étape : `lib/aws/account.js` et `lib/terraform/terraform.js`.
- 12 nov. : `lib/aws/account.js` écrit (compte simulé, schémas des ressources Terraform, vérifications d'API). Prochaine étape : `lib/terraform/terraform.js` (init, validate, plan, apply, destroy, output, state, fmt).
- 12 nov. : `lib/terraform/terraform.js` écrit et branché (init, validate, fmt, plan, apply, destroy, output, state, import, force-unlock, backend s3 avec verrou, dérive). Premier scénario OK : VPC + sous-réseaux avec count, apply, plan vide, destroy dans l'ordre. Prochaine étape : tests unitaires `tests/unit/terraform.test.mjs`, puis PR #52.
- 12 nov. : 5 tests unitaires Terraform verts (73 en tout), documentation. PR #52 ensuite, puis le cours Terraform (#53).
- 12 nov. : PR #57 (Terraform simulé) fusionnée. Branche `us-5a/cours-terraform` pour le cours (#53). Critères `tf` : remote, fmt, valid ajoutés.
- 12 nov. : chapitres 1 et 2 du cours Terraform validés (tf-01 à tf-07). Reste : tf-08 état distant, tf-09 import et dérive, tf-10 équipe et CI, tf-11 entretien ; puis e2e, docs, PR, release 0.14.0.
- 12 nov. : cours complet (tf-01 à tf-11) validé (738 vérifications), tests unitaires et e2e verts. PR du cours puis release 0.14.0. Sprint suivant : 5.2, CLI aws, IAM et réseau (#54), puis le cours AWS (#55).

## Livré

- Terraform et compte AWS simulés (PR #57) : HCL, cycle complet init, plan, apply, destroy, état local et distant, import, dérive. 5 tests unitaires.
- Cours Terraform (PR #58) : 11 leçons, 10 défis (7 fichiers `.tf` écrits dans l'éditeur, 3 situations au terminal : modifier sans remplacer, migrer l'état, importer, réparer une PR), 22 questions de quiz.
- Version 0.14.0.

## Rétrospective

**Ce qui a marché**
- Le compte AWS simulé comme socle commun : Terraform y crée de vrais objets avec des identifiants, et les vérifications de l'API (CIDR qui se chevauchent, bucket déjà pris, type d'instance inconnu) produisent les erreurs qu'on rencontre en vrai. Il servira tel quel à la CLI `aws`.
- Le critère « un second plan est vide » : il vérifie d'un coup que la configuration est complète et idempotente, comme on le fait en revue.
- Les transcriptions ont encore montré des défauts invisibles aux tests : identifiants en double (fonction de hachage qui ne lisait que le début de la chaîne), security group par défaut absent (une instance du VPC par défaut ne pouvait pas changer de type), commandes de mise en place lancées hors du dossier du projet.

**Ce qui a coincé**
- Le format exact des plans (indentation des maps, ordre alphabétique des outputs et de `state list`, ordre lexical des clés de `for_each`) demande plusieurs passes de comparaison avec la vraie sortie.

**On change**
- Garder une transcription de référence d'un vrai Terraform pour chaque forme de plan, et la comparer automatiquement.
