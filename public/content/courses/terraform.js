/* Cours « Terraform » (étape 5, US-5a #53). Exercices dans le terminal Linux simulé avec Terraform
   et un compte AWS simulé (lib/terraform/, lib/aws/) ; chaque chapitre se refait sur un vrai compte. */
import bases from "./terraform/bases.js";

export default {
  id: "terraform", route: "terraform", badge: "TF", name: "Terraform", tag: "HCL", lang: "sh",
  blurb: "Décrire l'infrastructure dans du code versionné : providers et ressources AWS, plan et apply, variables et modules, état distant, import et Terraform en équipe.",
  note: "Le terminal a Terraform 1.9 et un compte AWS simulé (région ca-central-1) : plan, apply et destroy agissent sur ce compte, avec les vrais messages d'erreur d'AWS et de Terraform. Chaque défi vérifie l'état de Terraform et les ressources du compte.",
  lessons: [...bases]
};
