/* Terraform simulé : HCL, validate, plan et apply, remplacement, dérive, état distant, modules, critères. */
import test from "node:test";
import assert from "node:assert/strict";
import { createShell, evaluate } from "../../public/assets/js/lib/shell/shell.js";
import { fmtHcl } from "../../public/assets/js/lib/terraform/terraform.js";

const D = "/home/eleve/infra";
const PROV = 'terraform {\n  required_providers {\n    aws = {\n      source  = "hashicorp/aws"\n      version = "~> 5.0"\n    }\n  }\n}\n\n';
const world = (files = {}, extra = {}) => createShell({ files: Object.fromEntries(Object.entries(files).map(([k, v]) => [D + "/" + k, v])), terraform: extra.terraform || {}, aws: extra.aws, cwd: D });
const run = (sh, c, stdin) => sh.run(c, stdin ? { stdin } : undefined);
const ok = (sh, checks) => assert.deepEqual(evaluate(sh, checks).filter((r) => !r.ok), []);

test("validate : erreurs au format de Terraform, avec suggestions", () => {
  const sh = world({ "main.tf": PROV + 'resource "aws_instanc" "web" {\n  ami = "x"\n}\n\nresource "aws_s3_bucket" "b" {\n  buckett = "x"\n}\n\noutput "o" {\n  value = var.envv\n}\n' });
  run(sh, "terraform init");
  const v = run(sh, "terraform validate");
  assert.equal(v.code, 1);
  assert.match(v.err, /│ Error: Invalid resource type\n│ \n│   on main.tf line 10, in resource "aws_instanc" "web":\n│  10: resource "aws_instanc" "web" \{\n│ \n│ The provider hashicorp\/aws does not support resource type "aws_instanc"\.\n│\n│ Did you mean "aws_instance"\?/);
  assert.match(v.err, /Error: Unsupported argument[\s\S]*An argument named "buckett" is not expected here\. Did you mean "bucket"\?/);
  assert.match(v.err, /Error: Reference to undeclared input variable[\s\S]*"envv" has not been declared/);
  const sh2 = world({ "main.tf": 'resource "aws_vpc" "v" {\n  cidr_block = "10.0.0.0/16"\n' });
  assert.match(run(sh2, "terraform init").err, /Error: Unclosed configuration block[\s\S]*on main.tf line 1/);
});

test("plan et apply : graphe, count, outputs, idempotence, destroy dans l'ordre", () => {
  const sh = world({ "main.tf": PROV + 'resource "aws_vpc" "v" {\n  cidr_block = "10.0.0.0/16"\n  tags = { Name = "boutique" }\n}\n\nresource "aws_subnet" "s" {\n  count      = 2\n  vpc_id     = aws_vpc.v.id\n  cidr_block = cidrsubnet(aws_vpc.v.cidr_block, 8, count.index)\n}\n\noutput "vpc_id" {\n  value = aws_vpc.v.id\n}\n' });
  assert.match(run(sh, "terraform plan").err, /Inconsistent dependency lock file[\s\S]*terraform init/);
  assert.match(run(sh, "terraform init").out, /Installed hashicorp\/aws v5\.76\.0 \(signed by HashiCorp\)/);
  const p = run(sh, "terraform plan");
  assert.match(p.out, /# aws_subnet\.s\[1\] will be created\n  \+ resource "aws_subnet" "s" \{/);
  assert.match(p.out, /\+ vpc_id\s+= \(known after apply\)/);
  assert.match(p.out, /Plan: 3 to add, 0 to change, 0 to destroy\./);
  // Sans -auto-approve ni « yes », rien n'est appliqué.
  assert.match(run(sh, "terraform apply").out, /Apply cancelled\./);
  const a = run(sh, "terraform apply", "yes\n");
  assert.equal(a.code, 0, a.err);
  assert.match(a.out, /aws_vpc\.v: Creation complete after 2s \[id=vpc-0[0-9a-f]{16}\]\n[\s\S]*Apply complete! Resources: 3 added, 0 changed, 0 destroyed\.\n\nOutputs:\n\nvpc_id = "vpc-0[0-9a-f]{16}"/);
  assert.match(run(sh, "terraform plan").out, /No changes\. Your infrastructure matches the configuration\./);
  assert.match(run(sh, "cat terraform.tfstate").out, /"type": "aws_subnet"/);
  assert.match(run(sh, "terraform output -raw vpc_id").out, /^vpc-0[0-9a-f]{16}$/);
  ok(sh, { tf: { state: ["aws_vpc.v", "aws_subnet.s[0]", "aws_subnet.s[1]"], noChanges: true, outputs: { vpc_id: true } }, aws: { aws_subnet: { match: { cidr_block: "10.0.1.0/24" } } } });
  const d = run(sh, "terraform destroy -auto-approve");
  assert.ok(d.out.indexOf("aws_subnet.s[0]: Destruction complete") < d.out.indexOf("aws_vpc.v: Destroying"));
  assert.match(d.out, /Destroy complete! Resources: 3 destroyed\./);
  ok(sh, { aws: { aws_vpc: { match: { cidr_block: "10.0.0.0/16" }, count: 0 } } });
});

test("modification sur place, remplacement forcé, erreurs d'API", () => {
  const sh = world({ "main.tf": PROV + 'resource "aws_instance" "web" {\n  ami           = "ami-0c9b7f4e5d3a21f80"\n  instance_type = "t3.micro"\n  tags = {\n    Name = "web"\n  }\n}\n' });
  run(sh, "terraform init"); run(sh, "terraform apply -auto-approve");
  run(sh, "sed -i 's/t3.micro/t3.small/' main.tf");
  const u = run(sh, "terraform plan");
  assert.match(u.out, /# aws_instance\.web will be updated in-place\n  ~ resource "aws_instance" "web" \{\n[\s\S]*~ instance_type\s+= "t3\.micro" -> "t3\.small"/);
  assert.match(u.out, /Plan: 0 to add, 1 to change, 0 to destroy\./);
  run(sh, "sed -i 's/ami-0c9b7f4e5d3a21f80/ami-0a2e7efb4257c0907/' main.tf");
  const r = run(sh, "terraform plan");
  assert.match(r.out, /# aws_instance\.web must be replaced\n-\/\+ resource "aws_instance" "web" \{/);
  assert.match(r.out, /~ ami\s+= "ami-0c9b7f4e5d3a21f80" -> "ami-0a2e7efb4257c0907" # forces replacement/);
  assert.match(r.out, /Plan: 1 to add, 0 to change, 1 to destroy\./);
  run(sh, "sed -i 's/t3.small/t3.mirco/' main.tf");
  const e = run(sh, "terraform apply -auto-approve");
  assert.equal(e.code, 1);
  assert.match(e.err, /Error: creating EC2 Instance: operation error EC2: RunInstances, https response error StatusCode: 400, RequestID: [\w-]+, api error InvalidParameterValue: Invalid value 't3\.mirco' for InstanceType\.\n│ \n│   with aws_instance\.web,\n│   on main\.tf line 10, in resource "aws_instance" "web":/);
});

test("variables, tfvars, validation, for_each, locals et modules", () => {
  const sh = world({
    "main.tf": PROV + 'variable "env" {\n  type = string\n  validation {\n    condition     = contains(["dev", "prod"], var.env)\n    error_message = "env doit valoir dev ou prod."\n  }\n}\n\nvariable "buckets" {\n  type    = set(string)\n  default = ["images", "factures"]\n}\n\nlocals {\n  prefixe = "boutique-${var.env}"\n}\n\nresource "aws_s3_bucket" "b" {\n  for_each = var.buckets\n  bucket   = "${local.prefixe}-${each.key}"\n}\n\nmodule "reseau" {\n  source = "./modules/reseau"\n  cidr   = "10.20.0.0/16"\n}\n\noutput "noms" {\n  value = [for b in aws_s3_bucket.b : b.bucket]\n}\n\noutput "vpc" {\n  value = module.reseau.vpc_id\n}\n',
    "modules/reseau/main.tf": 'variable "cidr" {\n  type = string\n}\n\nresource "aws_vpc" "this" {\n  cidr_block = var.cidr\n}\n\noutput "vpc_id" {\n  value = aws_vpc.this.id\n}\n'
  });
  run(sh, "terraform init");
  assert.match(run(sh, "terraform plan").err, /No value for required variable[\s\S]*"env" is not set/);
  assert.match(run(sh, "terraform plan -var env=qa").err, /Invalid value for variable[\s\S]*env doit valoir dev ou prod\./);
  run(sh, "echo 'env = \"prod\"' > terraform.tfvars");
  const a = run(sh, "terraform apply -auto-approve");
  assert.equal(a.code, 0, a.err);
  assert.match(a.out, /aws_s3_bucket\.b\["factures"\]: Creation complete after 2s \[id=boutique-prod-factures\]/);
  assert.match(a.out, /module\.reseau\.aws_vpc\.this: Creation complete/);
  ok(sh, { tf: { state: ['aws_s3_bucket.b["images"]', "module.reseau.aws_vpc.this"], noChanges: true, outputs: { noms: ["boutique-prod-factures", "boutique-prod-images"] } } });
});

test("dérive, import, état distant S3 avec verrou, fmt", () => {
  const sh = world({ "main.tf": PROV + 'resource "aws_s3_bucket" "logs" {\n  bucket = "boutique-logs-2026"\n}\n' }, { aws: { s3: { "boutique-logs-2026": {}, "boutique-tfstate": {} } } });
  run(sh, "terraform init");
  // Le bucket existe déjà (créé à la main) : la création échoue, il faut l'importer.
  assert.match(run(sh, "terraform apply -auto-approve").err, /creating S3 Bucket: operation error S3: CreateBucket, https response error StatusCode: 409[\s\S]*api error BucketAlreadyOwnedByYou/);
  const sh2 = world({ "main.tf": PROV + 'resource "aws_s3_bucket" "logs" {\n  bucket = "boutique-logs-2026"\n}\n' }, { aws: { s3: { "boutique-logs-2026": {} } } });
  run(sh2, "terraform init");
  const imp = run(sh2, "terraform import aws_s3_bucket.logs boutique-logs-2026");
  assert.match(imp.out, /Import successful!/);
  assert.match(run(sh2, "terraform plan").out, /No changes\./);
  // Dérive : une étiquette ajoutée à la main dans la console.
  sh2.aws.get("aws_s3_bucket", "boutique-logs-2026").attrs.tags = { Owner: "console" };
  const dr = run(sh2, "terraform plan");
  assert.match(dr.out, /Note: Objects have changed outside of Terraform[\s\S]*# aws_s3_bucket\.logs has changed/);
  assert.match(dr.out, /Plan: 0 to add, 1 to change, 0 to destroy\./);
  // Backend S3 : migration de l'état local, puis verrou tenu par un collègue.
  const sh3 = world({ "main.tf": PROV + 'resource "aws_vpc" "v" {\n  cidr_block = "10.1.0.0/16"\n}\n' }, { aws: { s3: { "boutique-tfstate": {} } } });
  run(sh3, "terraform init"); run(sh3, "terraform apply -auto-approve");
  run(sh3, "sed -i 's/^terraform {/terraform {\\n  backend \"s3\" {\\n    bucket         = \"boutique-tfstate\"\\n    key            = \"reseau\\/terraform.tfstate\"\\n    region         = \"ca-central-1\"\\n    dynamodb_table = \"terraform-locks\"\\n  }/' main.tf");
  assert.match(run(sh3, "terraform plan").err, /Backend initialization required, please run "terraform init"/);
  assert.match(run(sh3, "terraform init").err, /Migration of existing state required/);
  assert.match(run(sh3, "terraform init -migrate-state").out, /Successfully configured the backend "s3"!/);
  assert.match(run(sh3, "terraform plan").out, /Acquiring state lock[\s\S]*No changes\./);
  sh3.tfLock = { id: "6d1c9a8e-2f4b-4c3a-9e7d-1b2a3c4d5e6f", who: "louis@portable" };
  assert.match(run(sh3, "terraform plan").err, /Error acquiring the state lock[\s\S]*Who:       louis@portable/);
  assert.match(run(sh3, "terraform force-unlock -force 6d1c9a8e-2f4b-4c3a-9e7d-1b2a3c4d5e6f").out, /successfully unlocked/);
  // fmt
  assert.equal(fmtHcl('resource "aws_vpc" "v" {\ncidr_block="10.0.0.0/16"\n    enable_dns_hostnames = true\n}\n'), 'resource "aws_vpc" "v" {\n  cidr_block           = "10.0.0.0/16"\n  enable_dns_hostnames = true\n}\n');
  run(sh3, "printf 'resource \"aws_vpc\" \"w\" {\\ncidr_block=\"10.9.0.0/16\"\\n}\\n' > autre.tf");
  const f = run(sh3, "terraform fmt -check");
  assert.equal(f.code, 3); assert.equal(f.out, "autre.tf\n");
});
