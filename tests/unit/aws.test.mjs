/* CLI aws simulée : identité, S3, IAM (évaluation des politiques), EC2 et joignabilité réseau, --query, critères. */
import test from "node:test";
import assert from "node:assert/strict";
import { createShell, evaluate } from "../../public/assets/js/lib/shell/shell.js";
import { evaluate as iamEval, lintPolicy } from "../../public/assets/js/lib/aws/iam.js";
import { jmes } from "../../public/assets/js/lib/aws/cli.js";

const world = (aws = {}, files = {}) => createShell({ files, aws, cwd: "/home/eleve" });
const run = (sh, c) => sh.run(c);
const ok = (sh, checks) => assert.deepEqual(evaluate(sh, checks).filter((r) => !r.ok), []);
const LIRE = { Version: "2012-10-17", Statement: [{ Sid: "Lire", Effect: "Allow", Action: ["s3:GetObject", "s3:ListBucket"], Resource: ["arn:aws:s3:::factures-2026", "arn:aws:s3:::factures-2026/*"] }] };

test("évaluation IAM : refus explicite > autorisation > refus implicite, conditions", () => {
  const pols = [{ name: "lecture", doc: { Version: "2012-10-17", Statement: [...LIRE.Statement, { Effect: "Deny", Action: "s3:DeleteObject", Resource: "*" }] } }];
  assert.equal(iamEval(pols, "s3:GetObject", "arn:aws:s3:::factures-2026/a.pdf").decision, "allowed");
  assert.equal(iamEval(pols, "s3:PutObject", "arn:aws:s3:::factures-2026/a.pdf").decision, "implicitDeny");
  assert.equal(iamEval(pols, "s3:DeleteObject", "arn:aws:s3:::factures-2026/a.pdf").decision, "explicitDeny");
  const tls = { Version: "2012-10-17", Statement: [{ Effect: "Deny", Principal: "*", Action: "s3:*", Resource: "arn:aws:s3:::b/*", Condition: { Bool: { "aws:SecureTransport": "false" } } }] };
  assert.equal(iamEval(pols, "s3:GetObject", "arn:aws:s3:::b/x", { "aws:SecureTransport": "false" }, tls, "arn:aws:iam::123456789012:user/eleve").decision, "explicitDeny");
  assert.deepEqual(lintPolicy("{"), ["This policy contains invalid Json"]);
  assert.match(lintPolicy({ Version: "2012-10-17", Statement: [{ Effect: "allow", Action: "s3:GetObject", Resource: "*" }] })[0], /Effect/);
});

test("JMESPath : projections, aplatissement, filtres, multisélection, fonctions", () => {
  const d = { Reservations: [{ Instances: [{ InstanceId: "i-1", State: { Name: "running" }, Tags: [{ Key: "Name", Value: "web" }] }, { InstanceId: "i-2", State: { Name: "stopped" } }] }, { Instances: [{ InstanceId: "i-3", State: { Name: "running" } }] }] };
  assert.deepEqual(jmes("Reservations[].Instances[].InstanceId", d), ["i-1", "i-2", "i-3"]);
  assert.deepEqual(jmes("Reservations[*].Instances[*].InstanceId", d), [["i-1", "i-2"], ["i-3"]]);
  // comme le vrai JMESPath : un filtre dans une projection garde un niveau de liste par réservation
  assert.deepEqual(jmes("Reservations[].Instances[?State.Name=='running'].InstanceId", d), [["i-1"], ["i-3"]]);
  assert.deepEqual(jmes("Reservations[].Instances[] | [?State.Name=='running'].InstanceId", d), ["i-1", "i-3"]);
  assert.deepEqual(jmes("Reservations[].Instances[?State.Name=='running'][].InstanceId", d), ["i-1", "i-3"]);
  assert.deepEqual(jmes("Reservations[].Instances[].[InstanceId, State.Name]", d)[1], ["i-2", "stopped"]);
  assert.deepEqual(jmes("Reservations[0].Instances[0].{Id: InstanceId, Nom: Tags[?Key=='Name'] | [0].Value}", d), { Id: "i-1", Nom: "web" });
  assert.equal(jmes("length(Reservations[].Instances[])", d), 3);
  assert.equal(jmes("Reservations[].Instances[] | length(@)", d), 3);
  assert.equal(jmes("Inexistant.Champ", d), null);
});

test("identité et S3 : buckets, objets, erreurs de l'API", () => {
  const sh = world({ s3: { "factures-2026": { "2026/janvier.pdf": "PDF", "lisezmoi.txt": "bonjour" } } }, { "/home/eleve/rapport.txt": "rapport\n" });
  const id = JSON.parse(run(sh, "aws sts get-caller-identity").out);
  assert.equal(id.Arn, "arn:aws:iam::123456789012:user/eleve");
  assert.equal(run(sh, "aws sts get-caller-identity --query Account --output text").out, "123456789012\n");
  assert.equal(run(sh, "aws s3 ls").out, "2026-11-12 09:30:00 factures-2026\n");
  assert.match(run(sh, "aws s3 ls s3://factures-2026").out, /^ +PRE 2026\/\n2026-11-11 22:14:03 +7 lisezmoi\.txt\n$/);
  assert.equal(run(sh, "aws s3 cp rapport.txt s3://factures-2026/rapports/").out, "upload: rapport.txt to s3://factures-2026/rapports/rapport.txt\n");
  assert.equal(run(sh, "aws s3 cp s3://factures-2026/lisezmoi.txt -").out, "bonjour");
  const mb = run(sh, "aws s3 mb s3://logs");
  assert.equal(mb.code, 1); assert.match(mb.err, /BucketAlreadyExists/);
  assert.match(run(sh, "aws s3 rb s3://factures-2026").err, /BucketNotEmpty/);
  assert.equal(run(sh, "aws s3 mb s3://boucle-demba-sauvegardes").code, 0);
  run(sh, "aws s3api put-bucket-versioning --bucket boucle-demba-sauvegardes --versioning-configuration Status=Enabled");
  run(sh, "aws s3api put-public-access-block --bucket boucle-demba-sauvegardes --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true");
  ok(sh, { s3: { "boucle-demba-sauvegardes": { versioning: "Enabled", blockPublic: true }, "factures-2026": { objects: ["rapports/rapport.txt"] } } });
  const bad = run(sh, "aws s3 lss");
  assert.equal(bad.code, 252); assert.match(bad.err, /Found invalid choice 'lss'/);
});

test("IAM : un profil restreint reçoit AccessDenied au format AWS", () => {
  const sh = world({ s3: { "factures-2026": { "a.pdf": "x" } }, profiles: { default: { user: "eleve", policies: ["arn:aws:iam::aws:policy/AdministratorAccess"] }, compta: { user: "compta", policies: [LIRE] } } });
  assert.equal(run(sh, "aws s3 cp s3://factures-2026/a.pdf - --profile compta").out, "x");
  const put = run(sh, "aws s3 rm s3://factures-2026/a.pdf --profile compta");
  assert.equal(put.code, 1);
  assert.match(put.err, /delete failed: s3:\/\/factures-2026\/a\.pdf An error occurred \(AccessDenied\) when calling the DeleteObject operation: User: arn:aws:iam::123456789012:user\/compta is not authorized to perform: s3:DeleteObject on resource: "arn:aws:s3:::factures-2026\/a\.pdf" because no identity-based policy allows the s3:DeleteObject action/);
  const ec2 = run(sh, "AWS_PROFILE=compta aws ec2 describe-instances");
  assert.equal(ec2.code, 254); assert.match(ec2.err, /UnauthorizedOperation[\s\S]*ec2:DescribeInstances/);
  const sim = JSON.parse(run(sh, "aws iam simulate-principal-policy --policy-source-arn arn:aws:iam::123456789012:user/compta --action-names s3:GetObject s3:PutObject --resource-arns arn:aws:s3:::factures-2026/a.pdf").out);
  assert.deepEqual(sim.EvaluationResults.map((r) => r.EvalDecision), ["allowed", "implicitDeny"]);
  ok(sh, { iam: { profile: "compta", allow: [["s3:GetObject", "arn:aws:s3:::factures-2026/a.pdf"]], deny: [["s3:PutObject", "arn:aws:s3:::factures-2026/a.pdf"]] } });
});

test("IAM : créer un rôle de service et lui attacher une politique", () => {
  const trust = '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}';
  const sh = world({}, { "/home/eleve/confiance.json": trust, "/home/eleve/casse.json": '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"sts:AssumeRole"}]}' });
  assert.match(run(sh, "aws iam create-role --role-name lecteur --assume-role-policy-document file://casse.json").err, /MalformedPolicyDocument[\s\S]*Principal/);
  assert.match(run(sh, "aws iam create-role --role-name lecteur --assume-role-policy-document file://absent.json").err, /Unable to load paramfile file:\/\/absent\.json/);
  const r = JSON.parse(run(sh, "aws iam create-role --role-name app-web --assume-role-policy-document file://confiance.json").out);
  assert.equal(r.Role.Arn, "arn:aws:iam::123456789012:role/app-web");
  assert.match(run(sh, "aws iam create-role --role-name app-web --assume-role-policy-document file://confiance.json").err, /EntityAlreadyExists/);
  assert.equal(run(sh, "aws iam attach-role-policy --role-name app-web --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess").code, 0);
  assert.equal(run(sh, "aws iam list-attached-role-policies --role-name app-web --query 'AttachedPolicies[].PolicyName' --output text").out, "AmazonS3ReadOnlyAccess\n");
  ok(sh, { iam: { role: "app-web", allow: [["s3:GetObject", "arn:aws:s3:::x/y"]], deny: [["s3:PutObject", "arn:aws:s3:::x/y"]] } });
});

test("EC2 : lancer une instance, security group, joignabilité diagnostiquée", () => {
  const sh = world();
  const ud = "#!/bin/bash\napt-get install -y nginx\n";
  sh.fs.write("/home/eleve/init.sh", ud, "eleve");
  const sg = JSON.parse(run(sh, "aws ec2 create-security-group --group-name web --description 'Site public'").out).GroupId;
  const res = JSON.parse(run(sh, "aws ec2 run-instances --image-id ami-0c9b7f4e5d3a21f80 --instance-type t3.micro --security-group-ids " + sg + " --user-data file://init.sh --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=web}]'").out);
  assert.equal(res.Instances[0].State.Name, "pending");
  const ip = run(sh, "aws ec2 describe-instances --filters Name=tag:Name,Values=web --query 'Reservations[].Instances[].PublicIpAddress' --output text").out.trim();
  assert.match(ip, /^15\.222\.\d+\.\d+$/);
  assert.match(run(sh, "curl -sS http://" + ip).err, /Timeout was reached/);
  ok(sh, { reach: { web: { 80: false } } });
  assert.match(evaluate(sh, { reach: { web: { 80: true } } })[0].label, /aucune règle d'entrée de sg-0[0-9a-f]+ n'autorise tcp\/80/);
  run(sh, "aws ec2 authorize-security-group-ingress --group-id " + sg + " --protocol tcp --port 80 --cidr 0.0.0.0/0");
  assert.match(run(sh, "aws ec2 authorize-security-group-ingress --group-id " + sg + " --protocol tcp --port 80 --cidr 0.0.0.0/0").err, /InvalidPermission\.Duplicate/);
  assert.match(run(sh, "curl -s http://" + ip).out, /<h1>Welcome to nginx!<\/h1>/);
  ok(sh, { reach: { web: { 80: true, 22: false } } });
  assert.match(run(sh, "aws ec2 run-instances --image-id ami-123 --instance-type t3.micro").err, /InvalidAMIID\.Malformed/);
  const id = res.Instances[0].InstanceId;
  run(sh, "aws ec2 stop-instances --instance-ids " + id);
  assert.match(evaluate(sh, { reach: { web: { 80: true } } })[0].label, /n'est pas démarrée|pas d'adresse IP publique/);
});

test("réseau : sous-réseau privé et table de routage expliqués", () => {
  const sh = world({ resources: [
    { type: "aws_vpc", args: { cidr_block: "10.0.0.0/16", tags: { Name: "boutique" } }, as: "vpc" }
  ] });
  const vpc = sh.aws.list("aws_vpc").find((v) => !v.meta.isDefault);
  const sub = sh.aws.put("aws_subnet", { vpc_id: vpc.id, cidr_block: "10.0.1.0/24", map_public_ip_on_launch: true, tags: { Name: "public-a" } });
  const sg = sh.aws.put("aws_security_group", { name: "web", vpc_id: vpc.id, ingress: [{ from_port: 80, to_port: 80, protocol: "tcp", cidr_blocks: ["0.0.0.0/0"] }], tags: {} });
  sh.aws.put("aws_instance", { ami: "ami-0c9b7f4e5d3a21f80", instance_type: "t3.micro", subnet_id: sub.id, vpc_security_group_ids: [sg.id], user_data: "nginx", tags: { Name: "web" } });
  assert.match(evaluate(sh, { reach: { web: { 80: true } } })[0].label, /table principale rtb-0[0-9a-f]+ du VPC du sous-réseau subnet-0[0-9a-f]+ n'a pas de route 0\.0\.0\.0\/0/);
  const igw = sh.aws.put("aws_internet_gateway", { vpc_id: vpc.id, tags: {} });
  const rt = sh.aws.put("aws_route_table", { vpc_id: vpc.id, route: [{ cidr_block: "0.0.0.0/0", gateway_id: igw.id }], tags: {} });
  sh.aws.put("aws_route_table_association", { subnet_id: sub.id, route_table_id: rt.id });
  ok(sh, { reach: { web: { 80: true } } });
  const routes = JSON.parse(run(sh, "aws ec2 describe-route-tables --filters Name=association.subnet-id,Values=" + sub.id + " --query 'RouteTables[0].Routes'").out);
  assert.deepEqual(routes.map((r) => r.GatewayId), ["local", igw.id]);
});

test("réseau à la CLI : passerelle, table de routage, association, et sortie en tableau", () => {
  const sh = world({ resources: [
    { type: "aws_vpc", as: "vpc", args: { cidr_block: "10.0.0.0/16", tags: { Name: "boutique" } } },
    { type: "aws_subnet", as: "pub", args: { vpc_id: "@vpc", cidr_block: "10.0.1.0/24", map_public_ip_on_launch: true, tags: { Name: "public-a" } } },
    { type: "aws_security_group", as: "web", args: { name: "web", vpc_id: "@vpc", ingress: [{ from_port: 80, to_port: 80, protocol: "tcp", cidr_blocks: ["0.0.0.0/0"] }, { from_port: 22, to_port: 22, protocol: "tcp", cidr_blocks: ["198.51.100.23/32"] }], tags: {} } },
    { type: "aws_instance", args: { ami: "ami-0c9b7f4e5d3a21f80", instance_type: "t3.micro", subnet_id: "@pub", vpc_security_group_ids: ["@web"], user_data: "nginx", tags: { Name: "vitrine" } } }
  ] });
  const vpc = run(sh, "aws ec2 describe-vpcs --filters Name=tag:Name,Values=boutique --query 'Vpcs[0].VpcId' --output text").out.trim();
  const sub = run(sh, "aws ec2 describe-subnets --filters Name=tag:Name,Values=public-a --query 'Subnets[0].SubnetId' --output text").out.trim();
  const igw = run(sh, "aws ec2 create-internet-gateway --query InternetGateway.InternetGatewayId --output text").out.trim();
  const rtb = run(sh, "aws ec2 create-route-table --vpc-id " + vpc + " --query RouteTable.RouteTableId --output text").out.trim();
  assert.match(run(sh, "aws ec2 create-route --route-table-id " + rtb + " --destination-cidr-block 0.0.0.0/0 --gateway-id " + igw).err, /belong to different networks/);
  assert.equal(run(sh, "aws ec2 attach-internet-gateway --internet-gateway-id " + igw + " --vpc-id " + vpc).code, 0);
  run(sh, "aws ec2 create-route --route-table-id " + rtb + " --destination-cidr-block 0.0.0.0/0 --gateway-id " + igw);
  assert.match(run(sh, "aws ec2 create-route --route-table-id " + rtb + " --destination-cidr-block 0.0.0.0/0 --gateway-id " + igw).err, /RouteAlreadyExists/);
  run(sh, "aws ec2 associate-route-table --route-table-id " + rtb + " --subnet-id " + sub);
  ok(sh, { reach: { vitrine: { 80: true, 22: [true, { open: false, from: "203.0.113.9" }] } } });
  const t = run(sh, "aws ec2 describe-instances --query 'Reservations[].Instances[].{Nom: Tags[?Key==`Name`] | [0].Value, Type: InstanceType}' --output table").out;
  assert.match(t, /^-+\n\|\s+DescribeInstances\s+\|\n\+-+\+-+\+\n\|\s+Nom\s+\|\s+Type\s+\|\n\+-+\+-+\+\n\|  vitrine\s+\|  t3\.micro\s+\|\n/);
});

test("IAM : versions d'une politique gérée par le client", () => {
  const sh = world({ resources: [
    { type: "aws_iam_policy", as: "p", args: { name: "publier", policy: '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"s3:PutObject","Resource":"arn:aws:s3:::site"}]}', tags: {} } },
    { type: "aws_iam_role", args: { name: "ci", assume_role_policy: '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}', tags: {} } },
    { type: "aws_iam_role_policy_attachment", args: { role: "ci", policy_arn: "@p.arn" } }
  ] });
  const arn = "arn:aws:iam::123456789012:policy/publier";
  ok(sh, { iam: { role: "ci", deny: [["s3:PutObject", "arn:aws:s3:::site/index.html"]] } });
  run(sh, "aws iam get-policy-version --policy-arn " + arn + " --version-id v1 --query PolicyVersion.Document > p.json");
  run(sh, "sed -i 's#arn:aws:s3:::site\"#arn:aws:s3:::site/*\"#' p.json");
  assert.equal(JSON.parse(run(sh, "aws iam create-policy-version --policy-arn " + arn + " --policy-document file://p.json --set-as-default").out).PolicyVersion.VersionId, "v2");
  assert.equal(run(sh, "aws iam get-policy --policy-arn " + arn + " --query Policy.DefaultVersionId --output text").out, "v2\n");
  ok(sh, { iam: { role: "ci", allow: [["s3:PutObject", "arn:aws:s3:::site/index.html"]] } });
  assert.match(run(sh, "aws iam create-policy-version --policy-arn arn:aws:iam::aws:policy/ReadOnlyAccess --policy-document file://p.json").err, /Cannot modify an AWS managed policy/);
  run(sh, "aws iam detach-role-policy --role-name ci --policy-arn " + arn);
  assert.equal(run(sh, "aws iam list-attached-role-policies --role-name ci --query 'length(AttachedPolicies)'").out, "0\n");
});
