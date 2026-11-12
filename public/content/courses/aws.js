/* Cours « AWS » (étape 5, US-5b #55). Exercices dans le terminal Linux simulé avec la CLI aws et un
   compte AWS simulé (lib/aws/) ; chaque leçon propose le même travail sur un vrai compte. */
import fondations, { SNIP } from "./aws/fondations.js";
import reseau from "./aws/reseau.js";
import donnees from "./aws/donnees.js";
import exploitation from "./aws/exploitation.js";

export default {
  id: "aws", route: "aws", badge: "AWS", name: "AWS", tag: "Cloud", lang: "sh",
  blurb: "Les services AWS qu'on attend d'un profil DevOps ou cloud : IAM et moindre privilège, VPC et security groups, EC2, conteneurs et Lambda, S3, RDS et DynamoDB, CloudWatch, résilience et coûts.",
  note: "Le terminal a la CLI aws v2 branchée sur un compte simulé (123456789012, région ca-central-1) : sorties JSON d'AWS, --query, profils, refus d'accès évalués par IAM, et une vraie joignabilité réseau (routes, passerelles, security groups) que curl met à l'épreuve. Chaque leçon propose aussi le même travail sur un vrai compte, dans les limites du plan gratuit.",
  snippetSetup: SNIP,
  lessons: [...fondations, ...reseau, ...donnees, ...exploitation]
};
