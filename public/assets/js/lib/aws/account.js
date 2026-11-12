/* Compte AWS simulé, partagé par Terraform et (plus tard) la CLI aws : ressources, identifiants, ARN,
   schémas des ressources Terraform (arguments, types, remplacement forcé, attributs calculés) et erreurs d'API. */

export const ACCOUNT_ID = "123456789012";
export const REGION = "ca-central-1";
export const AZS = ["ca-central-1a", "ca-central-1b", "ca-central-1d"];
export const AMIS = { "ami-0c9b7f4e5d3a21f80": "ubuntu/images/hvm-ssd-noble/ubuntu-noble-24.04-amd64-server-20241109", "ami-0a2e7efb4257c0907": "al2023-ami-2023.6.20241111.0-kernel-6.1-x86_64" };
export const INSTANCE_TYPES = ["t2.micro", "t3.nano", "t3.micro", "t3.small", "t3.medium", "t3.large", "t4g.micro", "t4g.small", "m5.large", "m5.xlarge", "c5.large", "r5.large"];
const TAKEN_BUCKETS = new Set(["boutique", "test", "backup", "terraform-state", "images", "logs"]);

export class AwsErr extends Error { constructor(op, code, msg, status = 400) { super(msg); this.op = op; this.code = code; this.status = status; } }

let SEQ = 0;
function hex(seed, n) { let h = 2166136261 ^ seed.length; let out = ""; for (let i = 0; out.length < n; i++) { h = Math.imul(h ^ seed.charCodeAt(i % seed.length) ^ i, 16777619) >>> 0; out += h.toString(16).padStart(8, "0"); } return out.slice(0, n); }
const ip2n = (ip) => ip.split(".").reduce((a, b) => a * 256 + +b, 0);
const cidrRange = (c) => { const [ip, l] = c.split("/"); const n = ip2n(ip); const size = 2 ** (32 - +l); const start = n - (n % size); return [start, start + size - 1]; };
const validCidr = (c) => /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/.test(String(c)) && String(c).split("/")[0].split(".").every((x) => +x < 256) && +String(c).split("/")[1] <= 32;

/* ===================== schémas ===================== */
// type : s (chaîne), n (nombre), b (booléen), l (liste de chaînes), m (map), j (document JSON), blk (bloc répétable)
const tags = { tags: { t: "m" }, tags_all: { t: "m", computed: true } };
export const SCHEMAS = {
  aws_vpc: { args: { cidr_block: { t: "s", req: true, fn: true }, enable_dns_hostnames: { t: "b", def: false }, enable_dns_support: { t: "b", def: true }, instance_tenancy: { t: "s", def: "default", fn: true }, ...tags }, computed: ["id", "arn", "default_security_group_id", "main_route_table_id", "owner_id"], prefix: "vpc" },
  aws_subnet: { args: { vpc_id: { t: "s", req: true, fn: true }, cidr_block: { t: "s", req: true, fn: true }, availability_zone: { t: "s", fn: true, computedIfUnset: true }, map_public_ip_on_launch: { t: "b", def: false }, ...tags }, computed: ["id", "arn", "owner_id"], prefix: "subnet" },
  aws_internet_gateway: { args: { vpc_id: { t: "s" }, ...tags }, computed: ["id", "arn", "owner_id"], prefix: "igw" },
  aws_nat_gateway: { args: { subnet_id: { t: "s", req: true, fn: true }, allocation_id: { t: "s", fn: true }, connectivity_type: { t: "s", def: "public", fn: true }, ...tags }, computed: ["id", "public_ip", "private_ip"], prefix: "nat" },
  aws_eip: { args: { domain: { t: "s", def: "vpc" }, instance: { t: "s" }, ...tags }, computed: ["id", "public_ip", "allocation_id"], prefix: "eipalloc" },
  aws_route_table: { args: { vpc_id: { t: "s", req: true, fn: true }, route: { t: "blk", fields: { cidr_block: "s", gateway_id: "s", nat_gateway_id: "s" } }, ...tags }, computed: ["id", "arn", "owner_id"], prefix: "rtb" },
  aws_route_table_association: { args: { subnet_id: { t: "s", fn: true }, route_table_id: { t: "s", req: true } }, computed: ["id"], prefix: "rtbassoc" },
  aws_security_group: { args: { name: { t: "s", fn: true, computedIfUnset: true }, description: { t: "s", def: "Managed by Terraform", fn: true }, vpc_id: { t: "s", fn: true, computedIfUnset: true }, ingress: { t: "blk", fields: { from_port: "n", to_port: "n", protocol: "s", cidr_blocks: "l", security_groups: "l", description: "s" } }, egress: { t: "blk", fields: { from_port: "n", to_port: "n", protocol: "s", cidr_blocks: "l", security_groups: "l", description: "s" } }, ...tags }, computed: ["id", "arn", "owner_id"], prefix: "sg" },
  aws_instance: { args: { ami: { t: "s", req: true, fn: true }, instance_type: { t: "s", req: true }, subnet_id: { t: "s", fn: true, computedIfUnset: true }, vpc_security_group_ids: { t: "l", computedIfUnset: true }, key_name: { t: "s", fn: true }, associate_public_ip_address: { t: "b", fn: true, computedIfUnset: true }, user_data: { t: "s", fn: true }, iam_instance_profile: { t: "s" }, monitoring: { t: "b" }, root_block_device: { t: "blk", fields: { volume_size: "n", volume_type: "s", encrypted: "b" } }, ...tags }, computed: ["id", "arn", "private_ip", "public_ip", "public_dns", "availability_zone", "instance_state"], prefix: "i" },
  aws_s3_bucket: { args: { bucket: { t: "s", fn: true, computedIfUnset: true }, bucket_prefix: { t: "s", fn: true }, force_destroy: { t: "b", def: false }, ...tags }, computed: ["id", "arn", "bucket_domain_name", "bucket_regional_domain_name", "region", "hosted_zone_id"] },
  aws_s3_bucket_versioning: { args: { bucket: { t: "s", req: true, fn: true }, versioning_configuration: { t: "blk", req: true, fields: { status: "s" }, max: 1 } }, computed: ["id"] },
  aws_s3_bucket_public_access_block: { args: { bucket: { t: "s", req: true, fn: true }, block_public_acls: { t: "b", def: false }, block_public_policy: { t: "b", def: false }, ignore_public_acls: { t: "b", def: false }, restrict_public_buckets: { t: "b", def: false } }, computed: ["id"] },
  aws_s3_bucket_server_side_encryption_configuration: { args: { bucket: { t: "s", req: true, fn: true }, rule: { t: "blk", req: true, fields: { apply_server_side_encryption_by_default: "o" } } }, computed: ["id"] },
  aws_s3_object: { args: { bucket: { t: "s", req: true, fn: true }, key: { t: "s", req: true, fn: true }, content: { t: "s" }, source: { t: "s" }, content_type: { t: "s", computedIfUnset: true } }, computed: ["id", "etag"] },
  aws_iam_role: { args: { name: { t: "s", fn: true, computedIfUnset: true }, assume_role_policy: { t: "j", req: true }, description: { t: "s" }, ...tags }, computed: ["id", "arn", "unique_id", "create_date"] },
  aws_iam_policy: { args: { name: { t: "s", fn: true, computedIfUnset: true }, description: { t: "s", fn: true }, policy: { t: "j", req: true }, ...tags }, computed: ["id", "arn", "policy_id"] },
  aws_iam_role_policy_attachment: { args: { role: { t: "s", req: true, fn: true }, policy_arn: { t: "s", req: true, fn: true } }, computed: ["id"] },
  aws_iam_user: { args: { name: { t: "s", req: true }, ...tags }, computed: ["id", "arn", "unique_id"] },
  aws_dynamodb_table: { args: { name: { t: "s", req: true, fn: true }, billing_mode: { t: "s", def: "PROVISIONED" }, hash_key: { t: "s", fn: true }, range_key: { t: "s", fn: true }, read_capacity: { t: "n" }, write_capacity: { t: "n" }, attribute: { t: "blk", fields: { name: "s", type: "s" } }, ...tags }, computed: ["id", "arn", "stream_arn"] },
  aws_db_subnet_group: { args: { name: { t: "s", fn: true }, subnet_ids: { t: "l", req: true }, ...tags }, computed: ["id", "arn"] },
  aws_db_instance: { args: { identifier: { t: "s", fn: true, computedIfUnset: true }, engine: { t: "s", fn: true }, engine_version: { t: "s", computedIfUnset: true }, instance_class: { t: "s", req: true }, allocated_storage: { t: "n" }, db_name: { t: "s", fn: true }, username: { t: "s", fn: true }, password: { t: "s", sensitive: true }, skip_final_snapshot: { t: "b", def: false }, publicly_accessible: { t: "b", def: false }, multi_az: { t: "b", def: false }, storage_encrypted: { t: "b", def: false, fn: true }, db_subnet_group_name: { t: "s", fn: true, computedIfUnset: true }, vpc_security_group_ids: { t: "l", computedIfUnset: true }, backup_retention_period: { t: "n", computedIfUnset: true }, ...tags }, computed: ["id", "arn", "endpoint", "address", "port", "status"] },
  aws_cloudwatch_log_group: { args: { name: { t: "s", fn: true }, retention_in_days: { t: "n", def: 0 }, ...tags }, computed: ["id", "arn"] },
  aws_lambda_function: { args: { function_name: { t: "s", req: true, fn: true }, role: { t: "s", req: true }, handler: { t: "s" }, runtime: { t: "s" }, filename: { t: "s" }, memory_size: { t: "n", def: 128 }, timeout: { t: "n", def: 3 }, environment: { t: "blk", fields: { variables: "m" }, max: 1 }, ...tags }, computed: ["id", "arn", "invoke_arn", "version"] },
  random_id: { args: { byte_length: { t: "n", req: true, fn: true }, prefix: { t: "s", fn: true }, keepers: { t: "m", fn: true } }, computed: ["id", "hex", "dec", "b64_url"], provider: "random" },
  random_pet: { args: { length: { t: "n", def: 2, fn: true }, separator: { t: "s", def: "-", fn: true }, prefix: { t: "s", fn: true }, keepers: { t: "m", fn: true } }, computed: ["id"], provider: "random" },
  random_password: { args: { length: { t: "n", req: true, fn: true }, special: { t: "b", def: true, fn: true } }, computed: ["id", "result"], provider: "random", sensitiveAttrs: ["result"] },
  local_file: { args: { filename: { t: "s", req: true, fn: true }, content: { t: "s", fn: true }, file_permission: { t: "s", def: "0777", fn: true } }, computed: ["id"], provider: "local" }
};
export const DATA_SOURCES = {
  aws_caller_identity: { args: {}, provider: "aws" },
  aws_region: { args: {}, provider: "aws" },
  aws_availability_zones: { args: { state: { t: "s" } }, provider: "aws" },
  aws_ami: { args: { most_recent: { t: "b" }, owners: { t: "l" }, filter: { t: "blk", fields: { name: "s", values: "l" } } }, provider: "aws" },
  aws_vpc: { args: { default: { t: "b" }, id: { t: "s" }, filter: { t: "blk", fields: { name: "s", values: "l" } }, tags: { t: "m" } }, provider: "aws" }
};
export const providerOf = (type) => (SCHEMAS[type] || DATA_SOURCES[type] || {}).provider || type.split("_")[0];

/* ===================== le compte ===================== */
export class Account {
  constructor(setup = {}) {
    this.res = {}; this.seq = 0; this.buckets = new Set(TAKEN_BUCKETS);
    this.s3 = {}; // contenu des buckets : { bucket: { key: texte } }
    // VPC par défaut de la région, comme dans un vrai compte.
    const dv = this.put("aws_vpc", { cidr_block: "172.31.0.0/16", enable_dns_hostnames: true, enable_dns_support: true, instance_tenancy: "default", tags: {} }, { isDefault: true });
    AZS.forEach((az, i) => this.put("aws_subnet", { vpc_id: dv.id, cidr_block: "172.31." + i * 16 + ".0/20", availability_zone: az, map_public_ip_on_launch: true, tags: {} }, { isDefault: true }));
    for (const r of setup.resources || []) { const o = this.put(r.type, r.args, { console: true }); if (r.as) o.alias = r.as; }
    for (const [b, objs] of Object.entries(setup.s3 || {})) { this.put("aws_s3_bucket", { bucket: b, force_destroy: false, tags: {} }, { console: true }); this.s3[b] = { ...objs }; }
  }
  id(type, seed) { const p = SCHEMAS[type] && SCHEMAS[type].prefix; return (p ? p + "-0" : "") + hex(type + seed + this.seq++, 16); }
  list(type) { return Object.values(this.res).filter((r) => r.type === type); }
  get(type, id) { const r = this.res[type + "/" + id]; return r ? r : null; }
  find(id) { return Object.values(this.res).find((r) => r.id === id || r.attrs.arn === id || r.attrs.name === id && r.type.startsWith("aws_iam")); }
  put(type, args, meta = {}) {
    const a = { ...args }; const sch = SCHEMAS[type];
    let id;
    switch (type) {
      case "aws_s3_bucket": id = a.bucket; break;
      case "aws_iam_role": case "aws_iam_policy": case "aws_iam_user": case "aws_dynamodb_table": case "aws_cloudwatch_log_group": case "aws_db_subnet_group": id = a.name; break;
      case "aws_db_instance": id = a.identifier; break;
      case "aws_lambda_function": id = a.function_name; break;
      case "aws_iam_role_policy_attachment": id = a.role + "-" + hex(a.policy_arn, 8) ; break;
      case "aws_s3_bucket_versioning": case "aws_s3_bucket_public_access_block": case "aws_s3_bucket_server_side_encryption_configuration": id = a.bucket; break;
      case "aws_s3_object": id = a.key; break;
      default: id = this.id(type, JSON.stringify(a));
    }
    const arnOf = { aws_vpc: "arn:aws:ec2:" + REGION + ":" + ACCOUNT_ID + ":vpc/" + id, aws_subnet: "arn:aws:ec2:" + REGION + ":" + ACCOUNT_ID + ":subnet/" + id, aws_security_group: "arn:aws:ec2:" + REGION + ":" + ACCOUNT_ID + ":security-group/" + id, aws_instance: "arn:aws:ec2:" + REGION + ":" + ACCOUNT_ID + ":instance/" + id, aws_s3_bucket: "arn:aws:s3:::" + id, aws_iam_role: "arn:aws:iam::" + ACCOUNT_ID + ":role/" + id, aws_iam_policy: "arn:aws:iam::" + ACCOUNT_ID + ":policy/" + id, aws_iam_user: "arn:aws:iam::" + ACCOUNT_ID + ":user/" + id, aws_dynamodb_table: "arn:aws:dynamodb:" + REGION + ":" + ACCOUNT_ID + ":table/" + id, aws_db_instance: "arn:aws:rds:" + REGION + ":" + ACCOUNT_ID + ":db:" + id, aws_cloudwatch_log_group: "arn:aws:logs:" + REGION + ":" + ACCOUNT_ID + ":log-group:" + id, aws_lambda_function: "arn:aws:lambda:" + REGION + ":" + ACCOUNT_ID + ":function:" + id, aws_internet_gateway: "arn:aws:ec2:" + REGION + ":" + ACCOUNT_ID + ":internet-gateway/" + id, aws_route_table: "arn:aws:ec2:" + REGION + ":" + ACCOUNT_ID + ":route-table/" + id, aws_db_subnet_group: "arn:aws:rds:" + REGION + ":" + ACCOUNT_ID + ":subgrp:" + id }[type];
    const c = { id };
    if (arnOf) c.arn = arnOf;
    if (["aws_vpc", "aws_subnet", "aws_security_group", "aws_internet_gateway", "aws_route_table"].includes(type)) c.owner_id = ACCOUNT_ID;
    if (type === "aws_vpc") { c.default_security_group_id = "sg-0" + hex("dsg" + id, 16); c.main_route_table_id = "rtb-0" + hex("mrt" + id, 16); }
    if (type === "aws_subnet" && !a.availability_zone) a.availability_zone = AZS[this.list("aws_subnet").filter((s) => s.attrs.vpc_id === a.vpc_id).length % AZS.length];
    if (type === "aws_security_group") { a.name = a.name || "terraform-" + hex(id, 26); a.vpc_id = a.vpc_id || this.defaultVpc().id; a.egress = a.egress || []; a.ingress = a.ingress || []; }
    if (type === "aws_instance") {
      const sub = a.subnet_id ? this.byId(a.subnet_id) : this.list("aws_subnet").find((s) => s.meta.isDefault);
      a.subnet_id = sub.id; const n = this.list("aws_instance").length + 10;
      c.private_ip = sub.attrs.cidr_block.split("/")[0].split(".").slice(0, 3).join(".") + "." + n;
      const pub = a.associate_public_ip_address ?? sub.attrs.map_public_ip_on_launch; a.associate_public_ip_address = !!pub;
      c.public_ip = pub ? "15.222." + (n % 250) + "." + (40 + n) : ""; c.public_dns = pub ? "ec2-15-222-" + (n % 250) + "-" + (40 + n) + ".ca-central-1.compute.amazonaws.com" : "";
      c.availability_zone = sub.attrs.availability_zone; c.instance_state = "running";
      a.vpc_security_group_ids = a.vpc_security_group_ids && a.vpc_security_group_ids.length ? a.vpc_security_group_ids : [this.byId(sub.attrs.vpc_id).attrs.default_security_group_id];
    }
    if (type === "aws_s3_bucket") { c.bucket_domain_name = id + ".s3.amazonaws.com"; c.bucket_regional_domain_name = id + ".s3." + REGION + ".amazonaws.com"; c.region = REGION; c.hosted_zone_id = "Z1QDHH18159H29"; this.buckets.add(id); this.s3[id] = this.s3[id] || {}; }
    if (type === "aws_iam_role") { c.unique_id = "AROA" + hex(id, 17).toUpperCase(); c.create_date = "2026-11-12T09:30:00Z"; }
    if (type === "aws_iam_policy") c.policy_id = "ANPA" + hex(id, 17).toUpperCase();
    if (type === "aws_db_instance") { c.address = id + ".c9akciq32.ca-central-1.rds.amazonaws.com"; c.port = a.engine === "mysql" ? 3306 : 5432; c.endpoint = c.address + ":" + c.port; c.status = "available"; a.engine_version = a.engine_version || (a.engine === "mysql" ? "8.0.39" : "16.4"); a.backup_retention_period = a.backup_retention_period ?? 7; a.db_subnet_group_name = a.db_subnet_group_name || "default"; a.vpc_security_group_ids = a.vpc_security_group_ids || [this.defaultVpc().attrs.default_security_group_id]; }
    if (type === "aws_nat_gateway") { c.public_ip = "35.182.10." + (20 + this.seq % 200); c.private_ip = "10.0.1.5"; }
    if (type === "aws_eip") { c.public_ip = "35.183.4." + (20 + this.seq % 200); c.allocation_id = id; }
    if (type === "aws_s3_object") { c.etag = hex(String(a.content || ""), 32); a.content_type = a.content_type || "binary/octet-stream"; const b = this.s3[a.bucket]; if (b) b[a.key] = a.content || ""; }
    if (type === "aws_lambda_function") { c.invoke_arn = "arn:aws:apigateway:" + REGION + ":lambda:path/2015-03-31/functions/" + arnOf + "/invocations"; c.version = "$LATEST"; }
    if (type === "aws_dynamodb_table") c.stream_arn = "";
    if (type === "random_id") { const h = hex("rid" + JSON.stringify(a) + this.seq, (a.byte_length || 4) * 2); c.hex = h; c.dec = String(parseInt(h.slice(0, 12), 16)); c.b64_url = btoa(h.match(/../g).map((x) => String.fromCharCode(parseInt(x, 16))).join("")).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_"); c.id = c.b64_url; }
    if (type === "random_pet") { const w = ["happy", "brave", "calm", "eager", "fancy", "gentle", "jolly", "lucky"], n = ["otter", "falcon", "panda", "lynx", "heron", "beaver", "moose", "koala"]; c.id = (a.prefix ? a.prefix + a.separator : "") + w[this.seq % 8] + (a.separator || "-") + n[(this.seq * 3) % 8]; }
    if (type === "random_password") { c.result = hex("pw" + this.seq, a.length || 16).replace(/[0-9]/g, (d) => "ABCDEFGHIJ"[d]); c.id = "none"; }
    if (sch) for (const [k, s] of Object.entries(sch.args)) if (a[k] === undefined && s.def !== undefined) a[k] = s.def;
    if (sch && sch.args.tags) { a.tags = a.tags || {}; c.tags_all = { ...a.tags }; }
    const r = { type, id: c.id, attrs: { ...a, ...c }, meta };
    this.res[type + "/" + r.id] = r;
    return r;
  }
  defaultVpc() { return this.list("aws_vpc").find((v) => v.meta.isDefault); }
  byId(id) { return Object.values(this.res).find((r) => r.id === id); }
  remove(type, id) { delete this.res[type + "/" + id]; if (type === "aws_s3_bucket") { this.buckets.delete(id); delete this.s3[id]; } }

  /** Vérifie une création avant de la faire ; lève une AwsErr au format du SDK v2 de Go. */
  check(type, a, self) {
    const E = (op, code, msg, st) => { throw new AwsErr(op, code, msg, st); };
    const exists = (id) => this.byId(id);
    switch (type) {
      case "aws_vpc": if (!validCidr(a.cidr_block)) E("EC2: CreateVpc", "InvalidParameterValue", "Value (" + a.cidr_block + ") for parameter cidrBlock is invalid. This is not a valid CIDR block."); { const l = +a.cidr_block.split("/")[1]; if (l < 16 || l > 28) E("EC2: CreateVpc", "InvalidVpc.Range", "The CIDR '" + a.cidr_block + "' is invalid."); } break;
      case "aws_subnet": {
        const v = exists(a.vpc_id); if (!v) E("EC2: CreateSubnet", "InvalidVpcID.NotFound", "The vpc ID '" + a.vpc_id + "' does not exist");
        if (!validCidr(a.cidr_block)) E("EC2: CreateSubnet", "InvalidParameterValue", "Value (" + a.cidr_block + ") for parameter cidrBlock is invalid. This is not a valid CIDR block.");
        const [s0, s1] = cidrRange(a.cidr_block), [v0, v1] = cidrRange(v.attrs.cidr_block);
        if (s0 < v0 || s1 > v1) E("EC2: CreateSubnet", "InvalidSubnet.Range", "The CIDR '" + a.cidr_block + "' is invalid.");
        for (const s of this.list("aws_subnet")) if (s !== self && s.attrs.vpc_id === a.vpc_id) { const [o0, o1] = cidrRange(s.attrs.cidr_block); if (s0 <= o1 && o0 <= s1) E("EC2: CreateSubnet", "InvalidSubnet.Conflict", "The CIDR '" + a.cidr_block + "' conflicts with another subnet"); }
        if (a.availability_zone && !AZS.includes(a.availability_zone)) E("EC2: CreateSubnet", "InvalidParameterValue", "Value (" + a.availability_zone + ") for parameter availabilityZone is invalid. Subnets can currently only be created in the following availability zones: " + AZS.join(", ") + ".");
        break;
      }
      case "aws_internet_gateway": case "aws_route_table": if (a.vpc_id && !exists(a.vpc_id)) E("EC2: CreateRouteTable", "InvalidVpcID.NotFound", "The vpc ID '" + a.vpc_id + "' does not exist"); break;
      case "aws_security_group": if (a.vpc_id && !exists(a.vpc_id)) E("EC2: CreateSecurityGroup", "InvalidVpcID.NotFound", "The vpc ID '" + a.vpc_id + "' does not exist"); if (this.list("aws_security_group").some((g) => g !== self && g.attrs.name === a.name && g.attrs.vpc_id === (a.vpc_id || this.defaultVpc().id))) E("EC2: CreateSecurityGroup", "InvalidGroup.Duplicate", "The security group '" + a.name + "' already exists for VPC '" + (a.vpc_id || this.defaultVpc().id) + "'"); for (const r of [...(a.ingress || []), ...(a.egress || [])]) for (const c of r.cidr_blocks || []) if (!validCidr(c)) E("EC2: AuthorizeSecurityGroupIngress", "InvalidParameterValue", "CIDR block " + c + " is malformed"); break;
      case "aws_instance":
        if (!AMIS[a.ami]) E("EC2: RunInstances", "InvalidAMIID.Malformed".replace("Malformed", /^ami-[0-9a-f]{8,17}$/.test(a.ami) ? "NotFound" : "Malformed"), /^ami-[0-9a-f]{8,17}$/.test(a.ami) ? "The image id '[" + a.ami + "]' does not exist" : 'Invalid id: "' + a.ami + '" (expecting "ami-...")');
        if (!INSTANCE_TYPES.includes(a.instance_type)) E("EC2: RunInstances", "InvalidParameterValue", "Invalid value '" + a.instance_type + "' for InstanceType.");
        if (a.subnet_id && !exists(a.subnet_id)) E("EC2: RunInstances", "InvalidSubnetID.NotFound", "The subnet ID '" + a.subnet_id + "' does not exist");
        for (const g of a.vpc_security_group_ids || []) { const sg = exists(g); if (!sg) E("EC2: RunInstances", "InvalidGroup.NotFound", "The security group '" + g + "' does not exist in VPC '" + (exists(a.subnet_id) || {}).attrs?.vpc_id + "'"); const sub = a.subnet_id ? exists(a.subnet_id) : null; if (sub && sg.attrs.vpc_id !== sub.attrs.vpc_id) E("EC2: RunInstances", "InvalidParameter", "Security group " + g + " and subnet " + a.subnet_id + " belong to different networks."); }
        break;
      case "aws_s3_bucket":
        if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(a.bucket) || /\.\./.test(a.bucket)) E("S3: CreateBucket", "InvalidBucketName", "The specified bucket is not valid.");
        if (this.buckets.has(a.bucket) && !self) E("S3: CreateBucket", "BucketAlreadyExists", "The requested bucket name is not available. The bucket namespace is shared by all users of the system. Please select a different name and try again.", 409);
        break;
      case "aws_iam_role": case "aws_iam_policy": {
        const doc = type === "aws_iam_role" ? a.assume_role_policy : a.policy;
        let j; try { j = JSON.parse(doc); } catch (e) { E("IAM: " + (type === "aws_iam_role" ? "CreateRole" : "CreatePolicy"), "MalformedPolicyDocument", "This policy contains invalid Json"); }
        if (!j.Version || !j.Statement) E("IAM: CreatePolicy", "MalformedPolicyDocument", "Syntax errors in policy.");
        if (this.list(type).some((r) => r !== self && r.id === a.name)) E("IAM: " + (type === "aws_iam_role" ? "CreateRole" : "CreatePolicy"), "EntityAlreadyExists", (type === "aws_iam_role" ? "Role" : "A policy called " + a.name + " already exists. Duplicate names are not allowed.").replace(/^Role$/, "Role with name " + a.name + " already exists."), 409);
        break;
      }
      case "aws_iam_role_policy_attachment": if (!this.get("aws_iam_role", a.role)) E("IAM: AttachRolePolicy", "NoSuchEntity", "The role with name " + a.role + " cannot be found.", 404); if (!/^arn:aws:iam::(aws|\d{12}):policy\//.test(a.policy_arn)) E("IAM: AttachRolePolicy", "InvalidInput", "ARN " + a.policy_arn + " is not valid."); break;
      case "aws_s3_bucket_versioning": case "aws_s3_bucket_public_access_block": case "aws_s3_bucket_server_side_encryption_configuration": case "aws_s3_object": if (!this.get("aws_s3_bucket", a.bucket)) E("S3: PutBucketVersioning", "NoSuchBucket", "The specified bucket does not exist", 404); break;
      case "aws_db_instance": if (a.password !== undefined && String(a.password).length < 8) E("RDS: CreateDBInstance", "InvalidParameterValue", "The parameter MasterUserPassword is not a valid password because it is shorter than 8 characters."); break;
    }
  }
  /** Suppression : refus si des ressources dépendent encore de celle-ci (comme l'API EC2). */
  checkDelete(r) {
    const E = (op, code, msg) => { throw new AwsErr(op, code, msg); };
    if (r.type === "aws_vpc" && this.list("aws_subnet").some((s) => s.attrs.vpc_id === r.id)) E("EC2: DeleteVpc", "DependencyViolation", "The vpc '" + r.id + "' has dependencies and cannot be deleted.");
    if (r.type === "aws_s3_bucket" && Object.keys(this.s3[r.id] || {}).length && !r.attrs.force_destroy) E("S3: DeleteBucket", "BucketNotEmpty", "The bucket you tried to delete is not empty");
  }
}
