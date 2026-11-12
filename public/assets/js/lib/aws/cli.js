/* CLI aws (v2) sur le compte simulé : identités et IAM, S3, EC2 et réseau, RDS.
   Sorties JSON d'AWS, --output json|text|table, --query (sous-ensemble de JMESPath),
   refus d'accès décidés par l'évaluation IAM, joignabilité réseau d'une instance. */
import { COMMANDS, HTTP_HOOKS, DNS_HOOKS, EXTRA_CHECKS, SETUP_HOOKS } from "../shell/commands.js";
import { Account, ACCOUNT_ID, REGION } from "./account.js";
import { evaluate as iamEval, AWS_MANAGED, lintPolicy, s3Arn } from "./iam.js";

const T0 = "2026-11-12T09:30:00+00:00";
const DEFAULT_IP = "198.51.100.23";
class CliErr extends Error { constructor(msg, code = 254) { super(msg); this.code = code; } }

/* ===================== identités ===================== */
/** Profils de la CLI : { nom: { user | role, policies: [arn | document], ip, mfa } }. */
export function setupIdentities(acct, setup = {}) {
  const profiles = setup.profiles || { default: { user: "eleve", policies: ["arn:aws:iam::aws:policy/AdministratorAccess"] } };
  acct.profiles = {};
  for (const [p, def] of Object.entries(profiles)) {
    const isRole = !!def.role; const name = def.role || def.user || p;
    if (!isRole && !acct.get("aws_iam_user", name)) acct.put("aws_iam_user", { name, tags: {} }, { console: true });
    acct.profiles[p] = { name, isRole, arn: isRole ? "arn:aws:sts::" + ACCOUNT_ID + ":assumed-role/" + name + "/session" : "arn:aws:iam::" + ACCOUNT_ID + ":user/" + name, policies: def.policies || [], ip: def.ip || DEFAULT_IP, mfa: !!def.mfa };
  }
}
const docOf = (acct, arn) => AWS_MANAGED[arn] || (acct.find(arn) && acct.find(arn).type === "aws_iam_policy" ? JSON.parse(acct.find(arn).attrs.policy) : null);
/** Politiques d'identité d'un profil (ou d'un rôle) : celles du profil + celles attachées au rôle. */
export function policiesOf(acct, prof) {
  const out = [];
  for (const p of prof.policies || []) {
    if (typeof p === "string") { const doc = docOf(acct, p); if (doc) out.push({ name: p.split("/").pop(), doc }); }
    else out.push({ name: p.name || "politique en ligne", doc: p.doc || p });
  }
  if (prof.isRole) for (const a of acct.list("aws_iam_role_policy_attachment").filter((x) => x.attrs.role === prof.name)) { const doc = docOf(acct, a.attrs.policy_arn); if (doc) out.push({ name: a.attrs.policy_arn.split("/").pop(), doc }); }
  return out;
}

/* ===================== JMESPath (sous-ensemble) =====================
   Champs, a.b, [n], [] (aplatit), [*], [?x=='v' && y!='w'], [a, b], {K: a}, |, length(), sort(), join(), max(), min(), sum(). */
function parseJmes(src) {
  let i = 0;
  const err = () => { throw new CliErr("\nBad value for --query " + src + ": invalid token: Parse error at column " + i + ", token \"" + (src[i] || "") + "\" (" + (src[i] ? "UNKNOWN" : "EOF") + "), for expression:\n\"" + src + "\"\n" + " ".repeat(i + 1) + "^", 255); };
  const ws = () => { while (src[i] === " ") i++; };
  const peek = (s) => { ws(); return src.startsWith(s, i); };
  const eat = (s) => { if (peek(s)) { i += s.length; return true; } return false; };
  const ident = () => { ws(); if (src[i] === '"') { const j = src.indexOf('"', i + 1); const v = src.slice(i + 1, j); i = j + 1; return v; } const m = /^[A-Za-z_][\w-]*/.exec(src.slice(i)); if (!m) err(); i += m[0].length; return m[0]; };
  const literal = () => { ws(); if (src[i] === "'") { const j = src.indexOf("'", i + 1); const v = src.slice(i + 1, j); i = j + 1; return { lit: v }; } if (src[i] === "`") { const j = src.indexOf("`", i + 1); const v = JSON.parse(src.slice(i + 1, j)); i = j + 1; return { lit: v }; } const m = /^-?\d+(\.\d+)?/.exec(src.slice(i)); if (m) { i += m[0].length; return { lit: +m[0] }; } return null; };
  function pipe() { const parts = [chain()]; while (!peek("||") && eat("|")) parts.push(chain()); return parts.length === 1 ? parts[0] : { pipe: parts }; }
  function cond() { const ors = [[cmp()]]; for (;;) { if (eat("&&")) ors[ors.length - 1].push(cmp()); else if (eat("||")) ors.push([cmp()]); else break; } return ors; }
  function cmp() { const neg = eat("!"); const left = literal() || chain(); for (const op of ["==", "!=", "<=", ">=", "<", ">"]) if (eat(op)) return { neg, left, op, right: literal() || chain() }; return { neg, left }; }
  function chain() {
    const steps = [];
    ws();
    if (eat("@")) { /* nœud courant */ }
    else if (peek("[")) bracket(steps, true);
    else if (peek("{")) steps.push(hash());
    else { const id = ident(); if (eat("(")) { const args = []; if (!eat(")")) { do { args.push(literal() || pipe()); } while (eat(",")); if (!eat(")")) err(); } steps.push({ fn: id, args }); } else steps.push({ field: id }); }
    for (;;) {
      if (eat(".")) { if (peek("[")) { i++; steps.push({ list: list() }); } else if (peek("{")) steps.push(hash()); else steps.push({ field: ident() }); }
      else if (peek("[")) bracket(steps, false);
      else break;
    }
    return { steps };
  }
  function list() { const xs = []; do { xs.push(pipe()); } while (eat(",")); if (!eat("]")) err(); return xs; }
  function hash() { eat("{"); const kv = []; do { const k = ident(); if (!eat(":")) err(); kv.push([k, pipe()]); } while (eat(",")); if (!eat("}")) err(); return { hash: kv }; }
  function bracket(steps, first) {
    eat("[");
    if (eat("]")) return steps.push({ flatten: true });
    if (eat("*")) { if (!eat("]")) err(); return steps.push({ wild: true }); }
    if (eat("?")) { const c = cond(); if (!eat("]")) err(); return steps.push({ filter: c }); }
    const m = /^\s*(-?\d+)\s*\]/.exec(src.slice(i)); if (m) { i += m[0].length; return steps.push({ index: +m[1] }); }
    if (first) return steps.push({ list: list() });
    err();
  }
  const ast = pipe(); ws(); if (i < src.length) err(); return ast;
}
const isNull = (v) => v === null || v === undefined;
const truthy = (v) => !(isNull(v) || v === false || v === "" || (Array.isArray(v) && !v.length) || (typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length));
function evalNode(n, v) {
  if ("lit" in n) return n.lit;
  if (n.pipe) return n.pipe.reduce((acc, c) => evalNode(c, acc), v);
  // découpe aux [] : chaque aplatissement termine la projection en cours et en ouvre une nouvelle
  const segs = [[]]; for (const s of n.steps) { if (s.flatten) segs.push([]); else segs[segs.length - 1].push(s); }
  let cur = evalSteps(segs[0], 0, v);
  for (const seg of segs.slice(1)) { if (!Array.isArray(cur)) return null; cur = cur.flatMap((x) => (Array.isArray(x) ? x : [x])).map((x) => evalSteps(seg, 0, x)).filter((x) => !isNull(x)); }
  return isNull(cur) ? null : cur;
}
function evalSteps(steps, k, v) {
  if (k === steps.length) return v;
  const s = steps[k];
  if (s.fn) {
    const a = s.args.map((x) => evalNode(x, v));
    const f = { length: () => (isNull(a[0]) ? null : typeof a[0] === "object" && !Array.isArray(a[0]) ? Object.keys(a[0]).length : a[0].length), sort: () => [...(a[0] || [])].sort((x, y) => (x > y ? 1 : x < y ? -1 : 0)), join: () => (a[1] || []).join(a[0]), max: () => (a[0] && a[0].length ? a[0].reduce((x, y) => (y > x ? y : x)) : null), min: () => (a[0] && a[0].length ? a[0].reduce((x, y) => (y < x ? y : x)) : null), sum: () => (a[0] || []).reduce((x, y) => x + y, 0), to_string: () => (typeof a[0] === "string" ? a[0] : JSON.stringify(a[0])), contains: () => (Array.isArray(a[0]) || typeof a[0] === "string" ? a[0].includes(a[1]) : false), starts_with: () => typeof a[0] === "string" && a[0].startsWith(a[1]) }[s.fn];
    if (!f) throw new CliErr("\nBad value for --query: Unknown function: " + s.fn + "()", 255);
    return evalSteps(steps, k + 1, f());
  }
  if (isNull(v)) return null;
  if (s.field) return evalSteps(steps, k + 1, typeof v === "object" && !Array.isArray(v) ? v[s.field] : null);
  if ("index" in s) return Array.isArray(v) ? evalSteps(steps, k + 1, v[s.index < 0 ? v.length + s.index : s.index]) : null;
  if (s.list) return evalSteps(steps, k + 1, s.list.map((e) => evalNode(e, v) ?? null));
  if (s.hash) return evalSteps(steps, k + 1, Object.fromEntries(s.hash.map(([key, e]) => [key, evalNode(e, v) ?? null])));
  const project = (xs) => xs.map((x) => evalSteps(steps, k + 1, x)).filter((x) => !isNull(x));
  if (s.wild) return Array.isArray(v) ? project(v) : typeof v === "object" ? project(Object.values(v)) : null;
  if (s.filter) {
    if (!Array.isArray(v)) return null;
    const one = (c, x) => { const l = evalNode(c.left, x); let r; if (!c.op) r = truthy(l); else { const rv = evalNode(c.right, x); r = { "==": () => JSON.stringify(l) === JSON.stringify(rv), "!=": () => JSON.stringify(l) !== JSON.stringify(rv), "<": () => l < rv, "<=": () => l <= rv, ">": () => l > rv, ">=": () => l >= rv }[c.op](); } return c.neg ? !r : r; };
    return project(v.filter((x) => s.filter.some((and) => and.every((c) => one(c, x)))));
  }
  return null;
}
export function jmes(expr, data) { if (!String(expr).trim()) return data; return evalNode(parseJmes(String(expr)), data); }

function render(data, o) {
  if (o.query !== undefined) data = jmes(o.query, data);
  const fmt = o.output || "json";
  if (fmt === "text") {
    const s = (x) => (isNull(x) ? "None" : typeof x === "boolean" ? (x ? "True" : "False") : String(x));
    const lines = [];
    const walk = (v) => {
      if (isNull(v)) { lines.push("None"); return; }
      if (Array.isArray(v)) { if (v.every((x) => isNull(x) || typeof x !== "object")) { if (v.length) lines.push(v.map(s).join("\t")); } else v.forEach(walk); return; }
      if (typeof v === "object") { const scal = Object.keys(v).sort().filter((k) => isNull(v[k]) || typeof v[k] !== "object"); if (scal.length) lines.push(scal.map((k) => s(v[k])).join("\t")); for (const k of Object.keys(v).sort()) if (!isNull(v[k]) && typeof v[k] === "object") walk(v[k]); return; }
      lines.push(s(v));
    };
    walk(data); return lines.length ? lines.join("\n") + "\n" : "";
  }
  if (fmt === "table") {
    const rows0 = Array.isArray(data) ? data : [data];
    const rows = rows0.map((r) => (Array.isArray(r) ? Object.fromEntries(r.map((x, j) => ["Col" + (j + 1), x])) : r));
    if (rows.every((r) => isNull(r) || typeof r !== "object")) { const w = Math.max(...rows.map((r) => String(r ?? "None").length), 8); const line = "+" + "-".repeat(w + 2) + "+"; return line + "\n" + rows.map((r) => "|  " + String(r ?? "None").padEnd(w) + "|").join("\n") + "\n" + line + "\n"; }
    const keys = [...new Set(rows.flatMap((r) => Object.keys(r || {}).filter((k) => isNull(r[k]) || typeof r[k] !== "object")))];
    const cell = (r, k) => String(isNull((r || {})[k]) ? "None" : r[k]);
    const w = keys.map((k) => Math.max(k.length, ...rows.map((r) => cell(r, k).length)));
    const line = "+" + w.map((x) => "-".repeat(x + 2)).join("+") + "+";
    return line + "\n|" + keys.map((k, j) => " " + k.padEnd(w[j]) + " ").join("|") + "|\n" + line + "\n" + rows.map((r) => "|" + keys.map((k, j) => " " + cell(r, k).padEnd(w[j]) + " ").join("|") + "|").join("\n") + "\n" + line + "\n";
  }
  return JSON.stringify(data ?? null, null, 4) + "\n";
}

/* ===================== réseau : joignabilité ===================== */
const ipNum = (s) => s.split(".").reduce((x, y) => x * 256 + +y, 0);
export const ipIn = (ip, cidr) => { const [b, l = 32] = cidr.split("/"); const size = 2 ** (32 - +l); return Math.floor(ipNum(ip) / size) === Math.floor(ipNum(b) / size); };
/** Table de routage effective d'un sous-réseau (association explicite, sinon table principale du VPC). */
export function routeTableOf(acct, sub) {
  const assoc = acct.list("aws_route_table_association").find((x) => x.attrs.subnet_id === sub.id);
  if (assoc) { const rt = acct.byId(assoc.attrs.route_table_id); return { id: rt ? rt.id : assoc.attrs.route_table_id, routes: rt ? rt.attrs.route || [] : [], main: false }; }
  const vpc = acct.byId(sub.attrs.vpc_id);
  return { id: vpc.attrs.main_route_table_id, routes: vpc.meta.isDefault ? [{ cidr_block: "0.0.0.0/0", gateway_id: "igw-0d1e2f3a4b5c6d7e8" }] : [], main: true };
}
/** Une instance est-elle joignable depuis Internet sur ce port ? Renvoie { ok, why } (la première cause trouvée). */
export function reach(acct, inst, port, fromIp = DEFAULT_IP) {
  const a = inst.attrs; const sub = acct.byId(a.subnet_id); const vpc = acct.byId(sub.attrs.vpc_id);
  if (a.instance_state !== "running") return { ok: false, why: "l'instance n'est pas démarrée (état " + a.instance_state + ")" };
  if (!a.public_ip) return { ok: false, why: "l'instance n'a pas d'adresse IP publique" };
  const rt = routeTableOf(acct, sub);
  const def = rt.routes.find((r) => r.cidr_block === "0.0.0.0/0");
  const where = rt.main ? "table principale " + rt.id + " du VPC" : "table " + rt.id;
  if (!def) return { ok: false, why: "la " + where + " du sous-réseau " + sub.id + " n'a pas de route 0.0.0.0/0" };
  if (!String(def.gateway_id || "").startsWith("igw-")) return { ok: false, why: "la route 0.0.0.0/0 de la " + where + " passe par " + (def.nat_gateway_id || def.gateway_id) + ", pas par une passerelle Internet : le sous-réseau est privé" };
  if (!vpc.meta.isDefault) { const igw = acct.byId(def.gateway_id); if (!igw) return { ok: false, why: "la route 0.0.0.0/0 vise " + def.gateway_id + ", qui n'existe pas (blackhole)" }; if (igw.attrs.vpc_id !== vpc.id) return { ok: false, why: "la passerelle " + igw.id + " n'est pas attachée au VPC " + vpc.id }; }
  for (const gid of a.vpc_security_group_ids || []) {
    const g = acct.byId(gid); if (!g) continue;
    for (const r of g.attrs.ingress || []) {
      const all = r.protocol === "-1"; const okPort = all || (+r.from_port <= port && port <= +r.to_port);
      if (okPort && (r.cidr_blocks || []).some((c) => ipIn(fromIp, c))) return { ok: true, why: "autorisé par " + gid + " (" + (all ? "tout le trafic" : "tcp/" + (r.from_port === r.to_port ? r.from_port : r.from_port + "-" + r.to_port)) + " depuis " + r.cidr_blocks.join(", ") + ")" };
    }
  }
  return { ok: false, why: "aucune règle d'entrée de " + (a.vpc_security_group_ids || []).join(", ") + " n'autorise tcp/" + port + " depuis " + fromIp };
}
/** Port d'écoute du serveur web installé par user_data, ou null. */
export function webPort(inst) { const u = String(inst.attrs.user_data || ""); if (/http\.server/.test(u)) return +((/http\.server\s+(\d+)/.exec(u) || [])[1] || 8000); return /nginx|apache2|httpd/.test(u) ? 80 : null; }

/* ===================== commande ===================== */
const ACTIONS = {
  "sts get-caller-identity": "sts:GetCallerIdentity",
  "s3 ls": "s3:ListAllMyBuckets", "s3 mb": "s3:CreateBucket", "s3 rb": "s3:DeleteBucket", "s3 cp": "s3:PutObject", "s3 rm": "s3:DeleteObject",
  "s3api get-bucket-policy": "s3:GetBucketPolicy", "s3api put-bucket-policy": "s3:PutBucketPolicy", "s3api get-bucket-versioning": "s3:GetBucketVersioning", "s3api put-bucket-versioning": "s3:PutBucketVersioning", "s3api put-public-access-block": "s3:PutBucketPublicAccessBlock", "s3api get-public-access-block": "s3:GetBucketPublicAccessBlock",
  "ec2 describe-vpcs": "ec2:DescribeVpcs", "ec2 describe-subnets": "ec2:DescribeSubnets", "ec2 describe-route-tables": "ec2:DescribeRouteTables", "ec2 describe-internet-gateways": "ec2:DescribeInternetGateways", "ec2 describe-security-groups": "ec2:DescribeSecurityGroups", "ec2 describe-instances": "ec2:DescribeInstances",
  "ec2 run-instances": "ec2:RunInstances", "ec2 terminate-instances": "ec2:TerminateInstances", "ec2 stop-instances": "ec2:StopInstances", "ec2 start-instances": "ec2:StartInstances",
  "ec2 create-security-group": "ec2:CreateSecurityGroup", "ec2 authorize-security-group-ingress": "ec2:AuthorizeSecurityGroupIngress", "ec2 revoke-security-group-ingress": "ec2:RevokeSecurityGroupIngress",
  "iam list-users": "iam:ListUsers", "iam list-roles": "iam:ListRoles", "iam get-role": "iam:GetRole", "iam create-role": "iam:CreateRole", "iam create-policy": "iam:CreatePolicy", "iam attach-role-policy": "iam:AttachRolePolicy", "iam list-attached-role-policies": "iam:ListAttachedRolePolicies", "iam simulate-principal-policy": "iam:SimulatePrincipalPolicy",
  "rds describe-db-instances": "rds:DescribeDBInstances",
  "configure list": null, "configure get": null
};
const OPS = { ListAllMyBuckets: "ListBuckets", ListBucket: "ListObjectsV2" };
function parseOpts(args) {
  const o = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("="); const k = eq > 0 ? a.slice(2, eq) : a.slice(2);
      const vals = eq > 0 ? [a.slice(eq + 1)] : [];
      if (eq < 0) while (args[i + 1] !== undefined && !args[i + 1].startsWith("--")) vals.push(args[++i]);
      o[k] = vals.length === 0 ? true : vals.length === 1 ? vals[0] : vals;
    } else o._.push(a);
  }
  return o;
}
const many = (v) => (v === undefined || v === true ? [] : [].concat(v).flatMap((x) => String(x).split(/\s+/)).filter(Boolean));
const tagsList = (t) => Object.entries(t || {}).map(([Key, Value]) => ({ Key, Value }));
const withTags = (t) => (Object.keys(t || {}).length ? { Tags: tagsList(t) } : {});
const CODE = { pending: 0, running: 16, "shutting-down": 32, terminated: 48, stopping: 64, stopped: 80 };

function aws(sh, args, io) {
  const acct = sh.aws;
  if (!acct) { io.err("Command 'aws' not found, but can be installed with:\nsudo snap install aws-cli --classic\n"); return 127; }
  if (args[0] === "--version") { io.out("aws-cli/2.18.14 Python/3.12.6 Linux/6.8.0-49-generic exe/x86_64.ubuntu.24\n"); return 0; }
  const usage = "usage: aws [options] <command> <subcommand> [<subcommand> ...] [parameters]\nTo see help text, you can run:\n\n  aws help\n  aws <command> help\n  aws <command> <subcommand> help\n";
  if (!args.length) { io.err(usage + "\naws: error: the following arguments are required: command\n"); return 252; }
  if (args[0] === "help") { io.out(usage); return 0; }
  const [svc, op, ...rest] = args; const o = parseOpts(rest);
  const key = svc + " " + op;
  if (!(key in ACTIONS)) {
    const ops = Object.keys(ACTIONS).filter((k) => k.startsWith(svc + " ")).map((k) => k.split(" ")[1]);
    io.err(usage + "\n" + (ops.length ? "aws: error: argument operation: Found invalid choice '" + (op || "") + "'\n\nValid choices: " + ops.join(" | ") + "\n" : "aws: error: argument command: Found invalid choice '" + svc + "'\n")); return 252;
  }
  if (["json", "text", "table", undefined].indexOf(o.output) < 0) { io.err(usage + "\naws: error: argument --output: Found invalid choice '" + o.output + "'\n\nValid choices: json | text | table | yaml\n"); return 252; }
  const profName = o.profile || sh.vars.get("AWS_PROFILE") || "default";
  const prof = acct.profiles[profName];
  if (!prof) { io.err("\nThe config profile (" + profName + ") could not be found\n"); return 255; }
  const region = o.region || sh.vars.get("AWS_REGION") || sh.vars.get("AWS_DEFAULT_REGION") || REGION;
  if (svc === "configure") {
    if (op === "get") { const v = { region, output: "json" }[o._[0]]; if (v === undefined) return 1; io.out(v + "\n"); return 0; }
    io.out("      Name                    Value             Type    Location\n      ----                    -----             ----    --------\n   profile " + profName.padStart(23) + "      " + (profName === "default" ? "None " : "manual") + "    " + (profName === "default" ? "None" : "--profile") + "\naccess_key     ****************7XQA shared-credentials-file    \nsecret_key     ****************k2Tz shared-credentials-file    \n    region " + region.padStart(23) + "      config-file    ~/.aws/config\n"); return 0;
  }
  if (region !== REGION && (svc === "ec2" || svc === "rds") && /^describe-/.test(op)) {
    // le compte de l'exercice n'a de ressources qu'en ca-central-1
    const empty = { "describe-instances": { Reservations: [] }, "describe-vpcs": { Vpcs: [] }, "describe-subnets": { Subnets: [] }, "describe-security-groups": { SecurityGroups: [] }, "describe-route-tables": { RouteTables: [] }, "describe-internet-gateways": { InternetGateways: [] }, "describe-db-instances": { DBInstances: [] } }[op];
    io.out(render(empty, o)); return 0;
  }
  const ctx = { "aws:SecureTransport": "true", "aws:SourceIp": prof.ip, "aws:MultiFactorAuthPresent": String(prof.mfa), "aws:RequestedRegion": region };
  /** Lève l'erreur d'accès refusé au format de l'API visée si IAM ne permet pas l'action. */
  const authorize = (act, res = "*", rp = null) => {
    const d = iamEval(policiesOf(acct, prof), act, res, ctx, rp, prof.arn);
    if (d.decision === "allowed") return;
    const name = act.split(":")[1]; const opn = OPS[name] || name;
    const why = d.decision === "explicitDeny" ? "with an explicit deny in " + (d.by.res ? "a resource-based policy" : "an identity-based policy") : "because no identity-based policy allows the " + act + " action";
    const onRes = res === "*" ? "" : " on resource: " + (act.startsWith("s3:") ? '"' + res + '"' : res);
    const msg = "User: " + prof.arn + " is not authorized to perform: " + act + onRes + " " + why;
    if (act.startsWith("ec2:")) throw new CliErr("\nAn error occurred (UnauthorizedOperation) when calling the " + opn + " operation: You are not authorized to perform this operation. " + msg + ". Encoded authorization failure message: 4fB2kq9Lx-Ap0eRk3sT8wVb1…");
    throw Object.assign(new CliErr("\nAn error occurred (AccessDenied) when calling the " + opn + " operation: " + msg), { short: msg });
  };
  const readArg = (name) => {
    const v = o[name];
    if (typeof v !== "string" || !v.startsWith("file://")) return v;
    try { return sh.fs.read(sh.abs(v.slice(7)), sh.user); } catch (e) { throw new CliErr("\nError parsing parameter '--" + name + "': Unable to load paramfile " + v + ": [Errno 2] No such file or directory: '" + v.slice(7) + "'", 252); }
  };
  const need = (...names) => { const miss = names.filter((n) => o[n] === undefined); if (miss.length) throw new CliErr("\n" + usage + "\naws: error: the following arguments are required: " + miss.map((n) => "--" + n).join(", "), 252); };
  const out = (data) => { io.out(render(data, o)); return 0; };
  const s3uri = (u) => /^s3:\/\/([^/]+)\/?(.*)$/.exec(u || "");
  const bucketPol = (b) => (b && b.attrs.policy) || null;

  try {
    switch (key) {
      case "sts get-caller-identity":
        authorize("sts:GetCallerIdentity");
        return out({ UserId: prof.isRole ? ((acct.get("aws_iam_role", prof.name) || { attrs: {} }).attrs.unique_id || "AROAEXEMPLE") + ":session" : "AIDA" + prof.name.toUpperCase().replace(/[^A-Z0-9]/g, "").padEnd(17, "Q").slice(0, 17), Account: ACCOUNT_ID, Arn: prof.arn });

      /* ----- S3 ----- */
      case "s3 ls": {
        if (!o._[0]) { authorize("s3:ListAllMyBuckets"); io.out(acct.list("aws_s3_bucket").map((b) => "2026-11-12 09:30:00 " + b.id + "\n").sort().join("")); return 0; }
        const m = s3uri(o._[0]); if (!m) throw new CliErr("\nParameter validation failed:\nInvalid bucket name \"" + o._[0] + "\": Bucket name must match the regex \"^[a-zA-Z0-9.\\-_]{1,255}$\"", 252);
        const b = acct.get("aws_s3_bucket", m[1]);
        if (!b && !acct.buckets.has(m[1])) throw new CliErr("\nAn error occurred (NoSuchBucket) when calling the ListObjectsV2 operation: The specified bucket does not exist");
        if (!b) throw new CliErr("\nAn error occurred (AccessDenied) when calling the ListObjectsV2 operation: Access Denied");
        authorize("s3:ListBucket", s3Arn(m[1]), bucketPol(b));
        const pre = new Set(); const lines = [];
        const base = m[2].includes("/") ? m[2].slice(0, m[2].lastIndexOf("/") + 1) : "";
        for (const [k, v] of Object.entries(acct.s3[m[1]] || {}).sort(([x], [y]) => (x < y ? -1 : 1))) {
          if (!k.startsWith(m[2])) continue; const rel = k.slice(base.length);
          if (!o.recursive && rel.includes("/")) { pre.add(rel.split("/")[0] + "/"); continue; }
          lines.push("2026-11-11 22:14:03 " + String(new TextEncoder().encode(v).length).padStart(10) + " " + (o.recursive ? k : rel));
        }
        const all = [...[...pre].map((p) => "                           PRE " + p), ...lines];
        io.out(all.length ? all.join("\n") + "\n" : ""); return all.length || !m[2] ? 0 : 1;
      }
      case "s3 mb": {
        const m = s3uri(o._[0]); if (!m || m[2]) throw new CliErr("\nusage: aws s3 mb <S3Uri>\nError: Invalid argument type", 252);
        try { authorize("s3:CreateBucket", s3Arn(m[1])); acct.check("aws_s3_bucket", { bucket: m[1] }); }
        catch (e) { if (e instanceof CliErr && !e.short) throw e; io.err("make_bucket failed: s3://" + m[1] + " An error occurred (" + (e.short ? "AccessDenied" : e.code) + ") when calling the CreateBucket operation: " + (e.short || e.message) + "\n"); return 1; }
        acct.put("aws_s3_bucket", { bucket: m[1], force_destroy: false, tags: {} }, { cli: true }); io.out("make_bucket: " + m[1] + "\n"); return 0;
      }
      case "s3 rb": {
        const m = s3uri(o._[0]); if (!m) throw new CliErr("\nusage: aws s3 rb <S3Uri>", 252);
        const b = acct.get("aws_s3_bucket", m[1]);
        try { authorize("s3:DeleteBucket", s3Arn(m[1]), bucketPol(b)); } catch (e) { if (!e.short) throw e; io.err("remove_bucket failed: s3://" + m[1] + " An error occurred (AccessDenied) when calling the DeleteBucket operation: " + e.short + "\n"); return 1; }
        if (!b) { io.err("remove_bucket failed: s3://" + m[1] + " An error occurred (NoSuchBucket) when calling the DeleteBucket operation: The specified bucket does not exist\n"); return 1; }
        if (Object.keys(acct.s3[m[1]] || {}).length) {
          if (!o.force) { io.err("remove_bucket failed: s3://" + m[1] + " An error occurred (BucketNotEmpty) when calling the DeleteBucket operation: The bucket you tried to delete is not empty\n"); return 1; }
          for (const k of Object.keys(acct.s3[m[1]]).sort()) io.out("delete: s3://" + m[1] + "/" + k + "\n");
        }
        acct.remove("aws_s3_bucket", m[1]); io.out("remove_bucket: " + m[1] + "\n"); return 0;
      }
      case "s3 rm": {
        const m = s3uri(o._[0]); if (!m || (!m[2] && !o.recursive)) throw new CliErr("\nusage: aws s3 rm <S3Uri>", 252);
        const b = acct.get("aws_s3_bucket", m[1]);
        const keys = o.recursive ? Object.keys((b && acct.s3[m[1]]) || {}).filter((k) => k.startsWith(m[2])).sort() : [m[2]];
        for (const k of keys) {
          try { authorize("s3:DeleteObject", s3Arn(m[1], k), bucketPol(b)); } catch (e) { if (!e.short) throw e; io.err("delete failed: s3://" + m[1] + "/" + k + " An error occurred (AccessDenied) when calling the DeleteObject operation: " + e.short + "\n"); return 1; }
          if (!b) { io.err("delete failed: s3://" + m[1] + "/" + k + " An error occurred (NoSuchBucket) when calling the DeleteObject operation: The specified bucket does not exist\n"); return 1; }
          delete acct.s3[m[1]][k]; io.out("delete: s3://" + m[1] + "/" + k + "\n");
        }
        return 0;
      }
      case "s3 cp": {
        const [src, dst] = o._; if (!src || !dst) throw new CliErr("\nusage: aws s3 cp <LocalPath> <S3Uri> or <S3Uri> <LocalPath> or <S3Uri> <S3Uri>\nError: Invalid argument type", 252);
        if (!src.startsWith("s3://") && dst.startsWith("s3://")) {
          let data; try { data = sh.fs.read(sh.abs(src), sh.user); } catch (e) { throw new CliErr("\nThe user-provided path " + src + " does not exist.", 255); }
          const m = s3uri(dst); const k = !m[2] || m[2].endsWith("/") ? m[2] + src.split("/").pop() : m[2]; const b = acct.get("aws_s3_bucket", m[1]);
          try { authorize("s3:PutObject", s3Arn(m[1], k), bucketPol(b)); } catch (e) { if (!e.short) throw e; io.err("upload failed: " + src + " to s3://" + m[1] + "/" + k + " An error occurred (AccessDenied) when calling the PutObject operation: " + e.short + "\n"); return 1; }
          if (!b) { io.err("upload failed: " + src + " to s3://" + m[1] + "/" + k + " An error occurred (NoSuchBucket) when calling the PutObject operation: The specified bucket does not exist\n"); return 1; }
          acct.s3[m[1]][k] = data; io.out("upload: " + src + " to s3://" + m[1] + "/" + k + "\n"); return 0;
        }
        const m = s3uri(src); if (!m || !m[2]) throw new CliErr("\nusage: aws s3 cp <LocalPath> <S3Uri> or <S3Uri> <LocalPath> or <S3Uri> <S3Uri>\nError: Invalid argument type", 252);
        const b = acct.get("aws_s3_bucket", m[1]);
        try { authorize("s3:GetObject", s3Arn(m[1], m[2]), bucketPol(b)); } catch (e) { if (!e.short) throw e; io.err("fatal error: An error occurred (403) when calling the HeadObject operation: Forbidden\n"); return 1; }
        const data = b ? (acct.s3[m[1]] || {})[m[2]] : undefined;
        if (data === undefined) { io.err("fatal error: An error occurred (404) when calling the HeadObject operation: Key \"" + m[2] + "\" does not exist\n"); return 1; }
        if (dst === "-") { io.out(data); return 0; }
        if (dst.startsWith("s3://")) {
          const d = s3uri(dst); const k = !d[2] || d[2].endsWith("/") ? d[2] + m[2].split("/").pop() : d[2]; const db = acct.get("aws_s3_bucket", d[1]);
          try { authorize("s3:PutObject", s3Arn(d[1], k), bucketPol(db)); } catch (e) { if (!e.short) throw e; io.err("copy failed: " + src + " to s3://" + d[1] + "/" + k + " An error occurred (AccessDenied) when calling the CopyObject operation: " + e.short + "\n"); return 1; }
          if (!db) { io.err("copy failed: " + src + " to " + dst + " An error occurred (NoSuchBucket) when calling the CopyObject operation: The specified bucket does not exist\n"); return 1; }
          acct.s3[d[1]][k] = data; io.out("copy: " + src + " to s3://" + d[1] + "/" + k + "\n"); return 0;
        }
        let to = sh.abs(dst); let shown = dst; try { if (sh.fs.stat(to, sh.user).type === "dir") { to += "/" + m[2].split("/").pop(); shown = dst.replace(/\/?$/, "/") + m[2].split("/").pop(); } } catch (e) { /* nouveau fichier */ }
        sh.fs.write(to, data, sh.user); io.out("download: " + src + " to " + shown + "\n"); return 0;
      }
      case "s3api get-bucket-policy": case "s3api put-bucket-policy": case "s3api get-bucket-versioning": case "s3api put-bucket-versioning": case "s3api put-public-access-block": case "s3api get-public-access-block": {
        need("bucket"); const name = o.bucket; const b = acct.get("aws_s3_bucket", name); const opn = op.split("-").map((x) => x[0].toUpperCase() + x.slice(1)).join("");
        authorize(ACTIONS[key], s3Arn(name), bucketPol(b));
        if (!b) throw new CliErr("\nAn error occurred (NoSuchBucket) when calling the " + opn + " operation: The specified bucket does not exist");
        if (op === "get-bucket-policy") { if (!b.attrs.policy) throw new CliErr("\nAn error occurred (NoSuchBucketPolicy) when calling the GetBucketPolicy operation: The bucket policy does not exist"); return out({ Policy: b.attrs.policy }); }
        if (op === "put-bucket-policy") {
          need("policy"); const doc = readArg("policy"); const errs = lintPolicy(doc);
          if (errs.length) throw new CliErr("\nAn error occurred (MalformedPolicy) when calling the PutBucketPolicy operation: " + (errs[0] === "This policy contains invalid Json" ? "Policies must be valid JSON and the first byte must be '{'" : errs[0]));
          const j = JSON.parse(doc); const pab = b.attrs.publicAccessBlock || {};
          const isPublic = [].concat(j.Statement).some((s) => s.Effect === "Allow" && (s.Principal === "*" || (s.Principal && s.Principal.AWS === "*")) && !s.Condition);
          if (pab.BlockPublicPolicy && isPublic) throw new CliErr("\nAn error occurred (AccessDenied) when calling the PutBucketPolicy operation: User: " + prof.arn + " is not authorized to perform: s3:PutBucketPolicy on resource: \"arn:aws:s3:::" + name + "\" because public policies are blocked by the BlockPublicPolicy block public access setting.");
          b.attrs.policy = JSON.stringify(j); return 0;
        }
        if (op === "get-bucket-versioning") return out(b.attrs.versioning ? { Status: b.attrs.versioning } : {});
        if (op === "put-bucket-versioning") {
          need("versioning-configuration"); const raw = String(readArg("versioning-configuration"));
          let st; try { st = raw.trim().startsWith("{") ? JSON.parse(raw).Status : (/Status=(\w+)/.exec(raw) || [])[1]; } catch (e) { st = undefined; }
          if (!["Enabled", "Suspended"].includes(st)) throw new CliErr("\nAn error occurred (MalformedXML) when calling the PutBucketVersioning operation: The XML you provided was not well-formed or did not validate against our published schema");
          b.attrs.versioning = st; return 0;
        }
        if (op === "put-public-access-block") { need("public-access-block-configuration"); const c = String(readArg("public-access-block-configuration")); b.attrs.publicAccessBlock = c.trim().startsWith("{") ? JSON.parse(c) : Object.fromEntries([...c.matchAll(/(\w+)=(true|false)/g)].map((x) => [x[1], x[2] === "true"])); return 0; }
        if (!b.attrs.publicAccessBlock) throw new CliErr("\nAn error occurred (NoSuchPublicAccessBlockConfiguration) when calling the GetPublicAccessBlock operation: The public access block configuration was not found");
        return out({ PublicAccessBlockConfiguration: b.attrs.publicAccessBlock });
      }

      /* ----- EC2 et réseau ----- */
      case "ec2 describe-vpcs": authorize(ACTIONS[key]); return out({ Vpcs: acct.list("aws_vpc").filter((v) => match(acct, o, v)).map((v) => ({ CidrBlock: v.attrs.cidr_block, DhcpOptionsId: "dopt-0a1b2c3d4e5f60718", State: "available", VpcId: v.id, OwnerId: ACCOUNT_ID, InstanceTenancy: "default", IsDefault: !!v.meta.isDefault, ...withTags(v.attrs.tags) })) });
      case "ec2 describe-subnets": authorize(ACTIONS[key]); return out({ Subnets: acct.list("aws_subnet").filter((s) => match(acct, o, s)).map((s) => ({ AvailabilityZone: s.attrs.availability_zone, AvailableIpAddressCount: 2 ** (32 - +s.attrs.cidr_block.split("/")[1]) - 5 - acct.list("aws_instance").filter((i) => i.attrs.subnet_id === s.id).length, CidrBlock: s.attrs.cidr_block, DefaultForAz: !!s.meta.isDefault, MapPublicIpOnLaunch: !!s.attrs.map_public_ip_on_launch, State: "available", SubnetId: s.id, VpcId: s.attrs.vpc_id, OwnerId: ACCOUNT_ID, ...withTags(s.attrs.tags) })) });
      case "ec2 describe-internet-gateways": authorize(ACTIONS[key]); return out({ InternetGateways: acct.list("aws_internet_gateway").filter((g) => match(acct, o, g)).map((g) => ({ Attachments: g.attrs.vpc_id ? [{ State: "available", VpcId: g.attrs.vpc_id }] : [], InternetGatewayId: g.id, OwnerId: ACCOUNT_ID, ...withTags(g.attrs.tags) })) });
      case "ec2 describe-route-tables": {
        authorize(ACTIONS[key]);
        const tables = acct.list("aws_route_table").map((r) => ({ Associations: acct.list("aws_route_table_association").filter((a) => a.attrs.route_table_id === r.id).map((a) => ({ Main: false, RouteTableAssociationId: a.id, RouteTableId: r.id, SubnetId: a.attrs.subnet_id, AssociationState: { State: "associated" } })), RouteTableId: r.id, Routes: [{ DestinationCidrBlock: (acct.byId(r.attrs.vpc_id) || { attrs: {} }).attrs.cidr_block, GatewayId: "local", Origin: "CreateRouteTable", State: "active" }, ...(r.attrs.route || []).map((x) => ({ DestinationCidrBlock: x.cidr_block, ...(x.gateway_id ? { GatewayId: x.gateway_id } : {}), ...(x.nat_gateway_id ? { NatGatewayId: x.nat_gateway_id } : {}), Origin: "CreateRoute", State: acct.byId(x.gateway_id || x.nat_gateway_id) ? "active" : "blackhole" }))], VpcId: r.attrs.vpc_id, OwnerId: ACCOUNT_ID, ...withTags(r.attrs.tags) }));
        for (const v of acct.list("aws_vpc")) tables.push({ Associations: [{ Main: true, RouteTableAssociationId: "rtbassoc-0" + v.attrs.main_route_table_id.slice(5, 21), RouteTableId: v.attrs.main_route_table_id, AssociationState: { State: "associated" } }], RouteTableId: v.attrs.main_route_table_id, Routes: [{ DestinationCidrBlock: v.attrs.cidr_block, GatewayId: "local", Origin: "CreateRouteTable", State: "active" }, ...(v.meta.isDefault ? [{ DestinationCidrBlock: "0.0.0.0/0", GatewayId: "igw-0d1e2f3a4b5c6d7e8", Origin: "CreateRoute", State: "active" }] : [])], VpcId: v.id, OwnerId: ACCOUNT_ID });
        return out({ RouteTables: tables.filter((t) => many(o.filters).every((f) => { const m = /Name=([^,]+),Values=(.+)/.exec(f); if (!m) return true; const vals = m[2].split(","); if (m[1] === "vpc-id") return vals.includes(t.VpcId); if (m[1] === "association.subnet-id") return t.Associations.some((a) => vals.includes(a.SubnetId)); if (m[1] === "association.main") return t.Associations.some((a) => String(a.Main) === vals[0]); if (m[1] === "route-table-id") return vals.includes(t.RouteTableId); return true; })) });
      }
      case "ec2 describe-security-groups": {
        authorize(ACTIONS[key]);
        const ids = many(o["group-ids"]);
        for (const id of ids) if (!acct.get("aws_security_group", id)) throw new CliErr("\nAn error occurred (InvalidGroup.NotFound) when calling the DescribeSecurityGroups operation: The security group '" + id + "' does not exist");
        return out({ SecurityGroups: acct.list("aws_security_group").filter((g) => (!ids.length || ids.includes(g.id)) && match(acct, o, g)).map((g) => ({ Description: g.attrs.description, GroupName: g.attrs.name, IpPermissions: (g.attrs.ingress || []).map((r) => perm(r, g)), OwnerId: ACCOUNT_ID, GroupId: g.id, IpPermissionsEgress: (g.attrs.egress || []).map((r) => perm(r, g)), VpcId: g.attrs.vpc_id, ...withTags(g.attrs.tags) })) });
      }
      case "ec2 describe-instances": {
        authorize(ACTIONS[key]);
        const ids = many(o["instance-ids"]);
        for (const id of ids) if (!acct.get("aws_instance", id)) { const ok = /^i-[0-9a-f]{8,17}$/.test(id); throw new CliErr("\nAn error occurred (InvalidInstanceID." + (ok ? "NotFound" : "Malformed") + ") when calling the DescribeInstances operation: " + (ok ? "The instance ID '" + id + "' does not exist" : 'Invalid id: "' + id + '"')); }
        const insts = acct.list("aws_instance").filter((i) => (!ids.length || ids.includes(i.id)) && match(acct, o, i));
        return out({ Reservations: insts.map((i) => ({ Groups: [], Instances: [instJson(acct, i)], OwnerId: ACCOUNT_ID, ReservationId: "r-0" + i.id.slice(3) })) });
      }
      case "ec2 run-instances": {
        need("image-id");
        authorize(ACTIONS[key], "arn:aws:ec2:" + region + ":" + ACCOUNT_ID + ":instance/*");
        const a = { ami: o["image-id"], instance_type: o["instance-type"] || "m1.small", subnet_id: o["subnet-id"], vpc_security_group_ids: o["security-group-ids"] ? many(o["security-group-ids"]) : undefined, key_name: o["key-name"], user_data: o["user-data"] ? readArg("user-data") : undefined, associate_public_ip_address: o["associate-public-ip-address"] ? true : o["no-associate-public-ip-address"] ? false : undefined, iam_instance_profile: o["iam-instance-profile"] ? String(o["iam-instance-profile"]).replace(/^(Name|Arn)=(.*\/)?/, "") : undefined, tags: {} };
        for (const m of String(many(o["tag-specifications"]).join(" ")).matchAll(/Key=([^,}\]]+),Value=([^,}\]\s]+)/g)) a.tags[m[1]] = m[2];
        if (a.key_name && !(acct.keys || ["ma-cle"]).includes(a.key_name)) throw new CliErr("\nAn error occurred (InvalidKeyPair.NotFound) when calling the RunInstances operation: The key pair '" + a.key_name + "' does not exist");
        if (a.instance_type === "m1.small") throw new CliErr("\nAn error occurred (InvalidParameterCombination) when calling the RunInstances operation: The instance type 'm1.small' is not supported in this region. Specify --instance-type.");
        try { acct.check("aws_instance", a, null); } catch (e) { throw new CliErr("\nAn error occurred (" + e.code + ") when calling the RunInstances operation: " + e.message); }
        const n = +(o.count || 1); const made = [];
        for (let k = 0; k < n; k++) made.push(acct.put("aws_instance", { ...a, tags: { ...a.tags } }, { cli: true }));
        return out({ Groups: [], Instances: made.map((i) => { const j = instJson(acct, i); delete j.PublicIpAddress; j.PublicDnsName = ""; j.State = { Code: 0, Name: "pending" }; return j; }), OwnerId: ACCOUNT_ID, ReservationId: "r-0" + made[0].id.slice(3) });
      }
      case "ec2 terminate-instances": case "ec2 stop-instances": case "ec2 start-instances": {
        need("instance-ids"); const ids = many(o["instance-ids"]); const Op = op.split("-").map((x) => x[0].toUpperCase() + x.slice(1)).join("");
        for (const id of ids) authorize(ACTIONS[key], "arn:aws:ec2:" + region + ":" + ACCOUNT_ID + ":instance/" + id);
        for (const id of ids) if (!acct.get("aws_instance", id)) throw new CliErr("\nAn error occurred (InvalidInstanceID.NotFound) when calling the " + Op + " operation: The instance ID '" + id + "' does not exist");
        const res = ids.map((id) => {
          const i = acct.get("aws_instance", id);
          const prev = i.attrs.instance_state; const now = { "start-instances": "pending", "stop-instances": "stopping", "terminate-instances": "shutting-down" }[op];
          i.attrs.instance_state = { "start-instances": "running", "stop-instances": "stopped", "terminate-instances": "terminated" }[op];
          if (op === "stop-instances") { i.attrs.public_ip = ""; i.attrs.public_dns = ""; }
          if (op === "start-instances" && i.attrs.associate_public_ip_address && !i.attrs.public_ip) { const n = 60 + (acct.seq++ % 150); i.attrs.public_ip = "15.222." + n + "." + (n + 3); i.attrs.public_dns = "ec2-15-222-" + n + "-" + (n + 3) + ".ca-central-1.compute.amazonaws.com"; }
          if (op === "terminate-instances") acct.remove("aws_instance", id);
          return { CurrentState: { Code: CODE[now], Name: now }, InstanceId: id, PreviousState: { Code: CODE[prev], Name: prev } };
        });
        return out({ [{ "terminate-instances": "TerminatingInstances", "stop-instances": "StoppingInstances", "start-instances": "StartingInstances" }[op]]: res });
      }
      case "ec2 create-security-group": {
        need("group-name", "description"); authorize(ACTIONS[key]);
        const a = { name: o["group-name"], description: o.description, vpc_id: o["vpc-id"] || acct.defaultVpc().id, ingress: [], egress: [{ from_port: 0, to_port: 0, protocol: "-1", cidr_blocks: ["0.0.0.0/0"] }], tags: {} };
        try { acct.check("aws_security_group", a, null); } catch (e) { throw new CliErr("\nAn error occurred (" + e.code + ") when calling the CreateSecurityGroup operation: " + e.message); }
        const g = acct.put("aws_security_group", a, { cli: true }); return out({ GroupId: g.id, SecurityGroupArn: g.attrs.arn });
      }
      case "ec2 authorize-security-group-ingress": case "ec2 revoke-security-group-ingress": {
        need("group-id"); const Op = op.startsWith("auth") ? "AuthorizeSecurityGroupIngress" : "RevokeSecurityGroupIngress";
        authorize(ACTIONS[key], "arn:aws:ec2:" + region + ":" + ACCOUNT_ID + ":security-group/" + o["group-id"]);
        const g = acct.get("aws_security_group", o["group-id"]); const wellFormed = /^sg-[0-9a-f]{8,17}$/.test(o["group-id"]);
        if (!g) throw new CliErr("\nAn error occurred (InvalidGroupId." + (wellFormed ? "NotFound" : "Malformed") + ") when calling the " + Op + " operation: " + (wellFormed ? "The security group '" + o["group-id"] + "' does not exist" : "Invalid id: \"" + o["group-id"] + "\" (expecting \"sg-...\")"));
        const proto = o.protocol === "all" || o.protocol === "-1" ? "-1" : String(o.protocol || "tcp");
        if (!["tcp", "udp", "icmp", "-1"].includes(proto)) throw new CliErr("\nAn error occurred (InvalidParameterValue) when calling the " + Op + " operation: Invalid value '" + proto + "' for IP protocol. Unknown protocol.");
        if (proto !== "-1" && o.port === undefined) throw new CliErr("\nAn error occurred (InvalidParameterValue) when calling the " + Op + " operation: Invalid value 'Must specify both from and to ports with TCP/UDP.' for portRange");
        const ps = proto === "-1" ? ["0", "0"] : String(o.port).split("-"); const fp = +ps[0], tp = +(ps[1] ?? ps[0]);
        if (o.cidr && !/^\d+\.\d+\.\d+\.\d+\/\d+$/.test(o.cidr)) throw new CliErr("\nAn error occurred (InvalidParameterValue) when calling the " + Op + " operation: CIDR block " + o.cidr + " is malformed");
        if (!o.cidr && !o["source-group"]) throw new CliErr("\nAn error occurred (MissingParameter) when calling the " + Op + " operation: The request must contain the parameter ipPermissions");
        const rule = { from_port: fp, to_port: tp, protocol: proto, cidr_blocks: o.cidr ? [o.cidr] : [], security_groups: o["source-group"] ? [o["source-group"]] : [] };
        const same = (r) => +r.from_port === rule.from_port && +r.to_port === rule.to_port && r.protocol === rule.protocol && JSON.stringify(r.cidr_blocks || []) === JSON.stringify(rule.cidr_blocks) && JSON.stringify(r.security_groups || []) === JSON.stringify(rule.security_groups);
        if (op.startsWith("auth")) {
          if ((g.attrs.ingress || []).some(same)) throw new CliErr("\nAn error occurred (InvalidPermission.Duplicate) when calling the AuthorizeSecurityGroupIngress operation: the specified rule \"peer: " + (rule.cidr_blocks[0] || rule.security_groups[0]) + ", " + (proto === "-1" ? "ALL" : proto.toUpperCase()) + ", from port: " + fp + ", to port: " + tp + ", ALLOW\" already exists");
          g.attrs.ingress = [...(g.attrs.ingress || []), rule];
          const rid = "sgr-0" + g.id.slice(4, 20);
          return out({ Return: true, SecurityGroupRules: [{ SecurityGroupRuleId: rid, GroupId: g.id, GroupOwnerId: ACCOUNT_ID, IsEgress: false, IpProtocol: proto, FromPort: proto === "-1" ? -1 : fp, ToPort: proto === "-1" ? -1 : tp, ...(rule.cidr_blocks[0] ? { CidrIpv4: rule.cidr_blocks[0] } : { ReferencedGroupInfo: { GroupId: rule.security_groups[0], UserId: ACCOUNT_ID } }), SecurityGroupRuleArn: "arn:aws:ec2:" + region + ":" + ACCOUNT_ID + ":security-group-rule/" + rid }] });
        }
        const before = (g.attrs.ingress || []).length; g.attrs.ingress = (g.attrs.ingress || []).filter((r) => !same(r));
        if (before === g.attrs.ingress.length) throw new CliErr("\nAn error occurred (InvalidPermission.NotFound) when calling the RevokeSecurityGroupIngress operation: The specified rule does not exist in this security group.");
        return out({ Return: true });
      }

      /* ----- IAM ----- */
      case "iam list-users": authorize(ACTIONS[key], "arn:aws:iam::" + ACCOUNT_ID + ":user/"); return out({ Users: acct.list("aws_iam_user").map((u) => ({ Path: "/", UserName: u.id, UserId: "AIDA" + u.id.toUpperCase().replace(/[^A-Z0-9]/g, "").padEnd(17, "Q").slice(0, 17), Arn: u.attrs.arn, CreateDate: "2026-09-02T14:11:31+00:00" })) });
      case "iam list-roles": authorize(ACTIONS[key], "arn:aws:iam::" + ACCOUNT_ID + ":role/"); return out({ Roles: acct.list("aws_iam_role").map(roleJson) });
      case "iam get-role": { need("role-name"); authorize(ACTIONS[key], "arn:aws:iam::" + ACCOUNT_ID + ":role/" + o["role-name"]); const r = acct.get("aws_iam_role", o["role-name"]); if (!r) throw new CliErr("\nAn error occurred (NoSuchEntity) when calling the GetRole operation: The role with name " + o["role-name"] + " cannot be found."); return out({ Role: { ...roleJson(r), RoleLastUsed: {} } }); }
      case "iam create-role": {
        need("role-name", "assume-role-policy-document"); authorize(ACTIONS[key], "arn:aws:iam::" + ACCOUNT_ID + ":role/" + o["role-name"]);
        const doc = readArg("assume-role-policy-document"); const errs = lintPolicy(doc).filter((x) => !/field Resource/.test(x));
        if (errs.length) throw new CliErr("\nAn error occurred (MalformedPolicyDocument) when calling the CreateRole operation: " + errs[0]);
        if ([].concat(JSON.parse(doc).Statement).some((s) => !s.Principal)) throw new CliErr("\nAn error occurred (MalformedPolicyDocument) when calling the CreateRole operation: AssumeRolepolicy contained an invalid principal: Missing required field Principal");
        try { acct.check("aws_iam_role", { name: o["role-name"], assume_role_policy: doc }, null); } catch (e) { throw new CliErr("\nAn error occurred (" + e.code + ") when calling the CreateRole operation: " + e.message); }
        const r = acct.put("aws_iam_role", { name: o["role-name"], assume_role_policy: JSON.stringify(JSON.parse(doc)), description: o.description, tags: {} }, { cli: true });
        return out({ Role: roleJson(r) });
      }
      case "iam create-policy": {
        need("policy-name", "policy-document"); authorize(ACTIONS[key], "arn:aws:iam::" + ACCOUNT_ID + ":policy/" + o["policy-name"]);
        const doc = readArg("policy-document"); const errs = lintPolicy(doc);
        if (errs.length) throw new CliErr("\nAn error occurred (MalformedPolicyDocument) when calling the CreatePolicy operation: " + errs[0]);
        try { acct.check("aws_iam_policy", { name: o["policy-name"], policy: doc }, null); } catch (e) { throw new CliErr("\nAn error occurred (" + e.code + ") when calling the CreatePolicy operation: " + e.message); }
        const p = acct.put("aws_iam_policy", { name: o["policy-name"], policy: JSON.stringify(JSON.parse(doc)), tags: {} }, { cli: true });
        return out({ Policy: { PolicyName: p.id, PolicyId: p.attrs.policy_id, Arn: p.attrs.arn, Path: "/", DefaultVersionId: "v1", AttachmentCount: 0, PermissionsBoundaryUsageCount: 0, IsAttachable: true, CreateDate: T0, UpdateDate: T0 } });
      }
      case "iam attach-role-policy": {
        need("role-name", "policy-arn"); authorize(ACTIONS[key], "arn:aws:iam::" + ACCOUNT_ID + ":role/" + o["role-name"]);
        const arn = o["policy-arn"];
        if (!/^arn:aws:iam::(aws|\d{12}):policy\//.test(arn)) throw new CliErr("\nAn error occurred (InvalidInput) when calling the AttachRolePolicy operation: ARN " + arn + " is not valid.");
        if (!docOf(acct, arn)) throw new CliErr("\nAn error occurred (NoSuchEntity) when calling the AttachRolePolicy operation: Policy " + arn + " does not exist or is not attachable.");
        if (!acct.get("aws_iam_role", o["role-name"])) throw new CliErr("\nAn error occurred (NoSuchEntity) when calling the AttachRolePolicy operation: The role with name " + o["role-name"] + " cannot be found.");
        if (!acct.list("aws_iam_role_policy_attachment").some((x) => x.attrs.role === o["role-name"] && x.attrs.policy_arn === arn)) acct.put("aws_iam_role_policy_attachment", { role: o["role-name"], policy_arn: arn }, { cli: true });
        return 0;
      }
      case "iam list-attached-role-policies": {
        need("role-name"); authorize(ACTIONS[key], "arn:aws:iam::" + ACCOUNT_ID + ":role/" + o["role-name"]);
        if (!acct.get("aws_iam_role", o["role-name"])) throw new CliErr("\nAn error occurred (NoSuchEntity) when calling the ListAttachedRolePolicies operation: The role with name " + o["role-name"] + " cannot be found.");
        return out({ AttachedPolicies: acct.list("aws_iam_role_policy_attachment").filter((x) => x.attrs.role === o["role-name"]).map((x) => ({ PolicyName: x.attrs.policy_arn.split("/").pop(), PolicyArn: x.attrs.policy_arn })) });
      }
      case "iam simulate-principal-policy": {
        need("policy-source-arn", "action-names"); authorize(ACTIONS[key]);
        const src = o["policy-source-arn"]; const rm = /:role\/(.+)$/.exec(src);
        const target = Object.values(acct.profiles).find((p) => p.arn === src && !p.isRole) || (rm && acct.get("aws_iam_role", rm[1]) ? { name: rm[1], isRole: true, arn: src, policies: [] } : null);
        if (!target) throw new CliErr("\nAn error occurred (NoSuchEntity) when calling the SimulatePrincipalPolicy operation: Entity " + src + " does not exist.");
        const pols = policiesOf(acct, target); const resources = o["resource-arns"] ? many(o["resource-arns"]) : ["*"];
        const cx = { ...ctx }; for (const e of many(o["context-entries"]).join(" ").matchAll(/ContextKeyName=([^,]+),ContextKeyValues=([^,]+),ContextKeyType=\w+/g)) cx[e[1]] = e[2];
        return out({ EvaluationResults: many(o["action-names"]).flatMap((act) => resources.map((res) => { const d = iamEval(pols, act, res, cx); return { EvalActionName: act, EvalResourceName: res, EvalDecision: d.decision, MatchedStatements: d.by ? [{ SourcePolicyId: d.by.from, SourcePolicyType: "IAM Policy", StartPosition: { Line: 1, Column: 0 }, EndPosition: { Line: 1, Column: 0 } }] : [], MissingContextValues: [] }; })) });
      }

      /* ----- RDS ----- */
      case "rds describe-db-instances": {
        authorize(ACTIONS[key]);
        const id = o["db-instance-identifier"]; const dbs = acct.list("aws_db_instance").filter((d) => !id || d.id === id);
        if (id && !dbs.length) throw new CliErr("\nAn error occurred (DBInstanceNotFound) when calling the DescribeDBInstances operation: DBInstance " + id + " not found.");
        return out({ DBInstances: dbs.map((d) => ({ DBInstanceIdentifier: d.id, DBInstanceClass: d.attrs.instance_class, Engine: d.attrs.engine, DBInstanceStatus: "available", MasterUsername: d.attrs.username, Endpoint: { Address: d.attrs.address, Port: d.attrs.port, HostedZoneId: "Z1N2BMCP3NKAH4" }, AllocatedStorage: d.attrs.allocated_storage, BackupRetentionPeriod: d.attrs.backup_retention_period, VpcSecurityGroups: (d.attrs.vpc_security_group_ids || []).map((g) => ({ VpcSecurityGroupId: g, Status: "active" })), DBSubnetGroup: { DBSubnetGroupName: d.attrs.db_subnet_group_name }, MultiAZ: !!d.attrs.multi_az, EngineVersion: d.attrs.engine_version, PubliclyAccessible: !!d.attrs.publicly_accessible, StorageEncrypted: !!d.attrs.storage_encrypted, DBInstanceArn: d.attrs.arn })) });
      }
    }
  } catch (e) { if (e instanceof CliErr) { io.err(e.message + "\n"); return e.code; } throw e; }
  return 0;
}

function instJson(acct, i) {
  const a = i.attrs;
  return { AmiLaunchIndex: 0, ImageId: a.ami, InstanceId: i.id, InstanceType: a.instance_type, ...(a.key_name ? { KeyName: a.key_name } : {}), LaunchTime: T0, Monitoring: { State: a.monitoring ? "enabled" : "disabled" }, Placement: { AvailabilityZone: a.availability_zone, Tenancy: "default" }, PrivateDnsName: "ip-" + a.private_ip.replace(/\./g, "-") + ".ca-central-1.compute.internal", PrivateIpAddress: a.private_ip, PublicDnsName: a.public_dns || "", ...(a.public_ip ? { PublicIpAddress: a.public_ip } : {}), State: { Code: CODE[a.instance_state], Name: a.instance_state }, SubnetId: a.subnet_id, VpcId: acct.byId(a.subnet_id).attrs.vpc_id, ...(a.iam_instance_profile ? { IamInstanceProfile: { Arn: "arn:aws:iam::" + ACCOUNT_ID + ":instance-profile/" + a.iam_instance_profile } } : {}), SecurityGroups: (a.vpc_security_group_ids || []).map((g) => ({ GroupId: g, GroupName: (acct.byId(g) || { attrs: {} }).attrs.name })), ...withTags(a.tags) };
}
function roleJson(r) { return { Path: "/", RoleName: r.id, RoleId: r.attrs.unique_id, Arn: r.attrs.arn, CreateDate: r.attrs.create_date, AssumeRolePolicyDocument: JSON.parse(r.attrs.assume_role_policy), ...(r.attrs.description ? { Description: r.attrs.description } : {}), MaxSessionDuration: 3600 }; }
function perm(r, g) { return { IpProtocol: r.protocol, ...(r.protocol === "-1" ? {} : { FromPort: +r.from_port, ToPort: +r.to_port }), UserIdGroupPairs: (r.security_groups || []).map((x) => ({ GroupId: x, UserId: ACCOUNT_ID })).concat(r.self ? [{ GroupId: g.id, UserId: ACCOUNT_ID }] : []), IpRanges: (r.cidr_blocks || []).map((c) => ({ CidrIp: c, ...(r.description ? { Description: r.description } : {}) })), Ipv6Ranges: [], PrefixListIds: [] }; }
/** --filters Name=…,Values=… (plusieurs filtres = ET, plusieurs valeurs = OU), --vpc-ids, --subnet-ids. */
function match(acct, o, r) {
  for (const opt of ["vpc-ids", "subnet-ids", "internet-gateway-ids"]) if (o[opt] && !many(o[opt]).includes(r.id)) return false;
  for (const f of many(o.filters)) {
    const m = /^Name=([^,]+),Values=(.+)$/.exec(f); if (!m) throw new CliErr("\nError parsing parameter '--filters': Expected: '=', received: 'EOF' for input:\n" + f, 252);
    const vals = m[2].split(","); const n = m[1]; const a = r.attrs;
    const vpcOf = a.vpc_id || (a.subnet_id && acct.byId(a.subnet_id) ? acct.byId(a.subnet_id).attrs.vpc_id : undefined);
    const get = n.startsWith("tag:") ? (a.tags || {})[n.slice(4)]
      : { "instance-state-name": a.instance_state, "vpc-id": vpcOf, "subnet-id": a.subnet_id, "instance-type": a.instance_type, "group-name": a.name, "group-id": r.id, "availability-zone": a.availability_zone, "is-default": String(!!r.meta.isDefault), "default-for-az": String(!!r.meta.isDefault), "ip-address": a.public_ip, "attachment.vpc-id": a.vpc_id, "cidr-block": a.cidr_block }[n];
    const glob = (v, p) => new RegExp("^" + p.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$").test(String(v));
    if (get === undefined || !vals.some((v) => glob(get, v))) return false;
  }
  return true;
}

COMMANDS.aws = aws;
DNS_HOOKS.push((sh, host) => { if (!sh.aws || !/\.compute\.amazonaws\.com$/.test(host)) return null; const i = sh.aws.list("aws_instance").find((x) => x.attrs.public_dns === host); return i ? i.attrs.public_ip : null; });
HTTP_HOOKS.push((sh, host, port, path, ip) => {
  if (!sh.aws) return null;
  const inst = sh.aws.list("aws_instance").find((i) => i.attrs.public_ip && i.attrs.public_ip === ip);
  if (!inst) return null;
  const r = reach(sh.aws, inst, port, ((sh.aws.profiles || {}).default || {}).ip || DEFAULT_IP);
  if (!r.ok) return { error: [28, "Failed to connect to " + host + " port " + port + " after 30001 ms: Timeout was reached"] };
  if (webPort(inst) !== port) return { error: [7, "Failed to connect to " + host + " port " + port + " after 18 ms: Couldn't connect to server"] };
  return { status: 200, type: "text/html", body: "<!DOCTYPE html>\n<h1>" + ((inst.attrs.tags || {}).Name || "Bonjour") + "</h1>\n<p>Servi par " + inst.id + " (" + inst.attrs.availability_zone + ")</p>\n", server: /http\.server/.test(inst.attrs.user_data) ? "SimpleHTTP/0.6 Python/3.12.3" : "nginx/1.24.0 (Ubuntu)" };
});
SETUP_HOOKS.push((sh, setup) => {
  if (!setup.aws && !setup.terraform) return;
  sh.aws = sh.aws || new Account(setup.aws || {});
  setupIdentities(sh.aws, setup.aws || {});
  if (setup.aws) {
    sh.packages.add("awscli");
    for (const [b, cfg] of Object.entries(setup.aws.buckets || {})) { const r = sh.aws.get("aws_s3_bucket", b); if (r) Object.assign(r.attrs, cfg); }
    if (setup.aws.keys) sh.aws.keys = setup.aws.keys;
  }
});

/* ----- critères ----- */
EXTRA_CHECKS.iam = (sh, v, push) => {
  // { profile | role, allow: [[action, ressource]], deny: [[action, ressource]], context }
  const acct = sh.aws;
  if (v.role && !acct.get("aws_iam_role", v.role)) { push(false, "Le rôle " + v.role + " existe"); return; }
  const prof = v.role ? { name: v.role, isRole: true, arn: "arn:aws:iam::" + ACCOUNT_ID + ":role/" + v.role, policies: [] } : acct.profiles[v.profile || "default"];
  const pols = policiesOf(acct, prof); const ctx = { "aws:SecureTransport": "true", "aws:SourceIp": prof.ip || DEFAULT_IP, ...(v.context || {}) };
  const who = v.role ? "Le rôle " + v.role : "L'utilisateur " + prof.name;
  const dec = (a, r) => { const bk = /^arn:aws:s3:::([^/]+)/.exec(r); const b = bk && acct.get("aws_s3_bucket", bk[1]); return iamEval(pols, a, r, ctx, b && b.attrs.policy, prof.arn).decision; };
  for (const [a, r] of v.allow || []) push(dec(a, r) === "allowed", who + " peut faire " + a + (r === "*" ? "" : " sur " + r));
  for (const [a, r] of v.deny || []) push(dec(a, r) !== "allowed", who + " ne peut pas faire " + a + (r === "*" ? "" : " sur " + r));
};
EXTRA_CHECKS.reach = (sh, v, push) => {
  // { "Nom de l'instance": { "80": true, "22": false } }
  for (const [name, spec] of Object.entries(v)) {
    const inst = sh.aws.list("aws_instance").find((i) => (i.attrs.tags || {}).Name === name);
    if (!inst) { push(false, "L'instance « " + name + " » existe"); continue; }
    for (const [port, open] of Object.entries(spec)) {
      const r = reach(sh.aws, inst, +port, (sh.aws.profiles.default || {}).ip || DEFAULT_IP);
      push(r.ok === open, "Le port " + port + " de « " + name + " » " + (open ? "est joignable" : "n'est pas joignable") + " depuis Internet" + (r.ok !== open ? " (" + r.why + ")" : ""));
    }
  }
};
EXTRA_CHECKS.s3 = (sh, v, push) => {
  // { bucket: { exists, objects: [clés], noObjects: [clés], versioning, blockPublic } }
  for (const [name, spec] of Object.entries(v)) {
    const b = sh.aws.get("aws_s3_bucket", name);
    if (spec.exists === false) { push(!b, "Le bucket " + name + " n'existe plus"); continue; }
    push(!!b, "Le bucket " + name + " existe"); if (!b) continue;
    for (const k of spec.objects || []) push(k in (sh.aws.s3[name] || {}), "L'objet s3://" + name + "/" + k + " existe");
    for (const k of spec.noObjects || []) push(!(k in (sh.aws.s3[name] || {})), "L'objet s3://" + name + "/" + k + " n'existe pas");
    if (spec.versioning) push(b.attrs.versioning === spec.versioning, "Le versionnement du bucket " + name + " est " + spec.versioning);
    if (spec.blockPublic) { const p = b.attrs.publicAccessBlock || {}; push(["BlockPublicAcls", "IgnorePublicAcls", "BlockPublicPolicy", "RestrictPublicBuckets"].every((k) => p[k] === true), "Les quatre réglages Block Public Access du bucket " + name + " sont actifs"); }
  }
};
