/* Évaluation des politiques IAM, dans l'ordre d'AWS : un Deny explicite l'emporte, puis un Allow,
   sinon refus implicite. Politiques d'identité et politiques de ressource (bucket S3). */

const globRe = (g) => new RegExp("^" + String(g).replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$", "i");
const globReCase = (g) => new RegExp("^" + String(g).replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
const arr = (x) => (x === undefined ? [] : Array.isArray(x) ? x : [x]);
const ipIn = (ip, cidr) => { const [b, l = 32] = cidr.split("/"); const n = (s) => s.split(".").reduce((a, x) => a * 256 + +x, 0); const size = 2 ** (32 - +l); return Math.floor(n(ip) / size) === Math.floor(n(b) / size); };

/** Vérifie la forme d'un document de politique ; renvoie une liste d'erreurs (format du validateur IAM). */
export function lintPolicy(doc) {
  let j; try { j = typeof doc === "string" ? JSON.parse(doc) : doc; } catch (e) { return ["This policy contains invalid Json"]; }
  const errs = [];
  if (j.Version !== "2012-10-17") errs.push(j.Version ? 'The policy failed legacy parsing (Version "' + j.Version + '" non reconnue : utilise "2012-10-17")' : "Missing required field Version");
  const st = arr(j.Statement); if (!st.length) errs.push("Missing required field Statement");
  for (const s of st) {
    if (!["Allow", "Deny"].includes(s.Effect)) errs.push("Missing required field Effect (Allow ou Deny)");
    if (!s.Action && !s.NotAction) errs.push("Missing required field Action");
    // IAM accepte une action inconnue (elle ne correspondra à rien) mais refuse une action sans préfixe de service.
    for (const a of [...arr(s.Action), ...arr(s.NotAction)]) if (a !== "*" && !/^[a-z0-9-]+:[A-Za-z0-9*?]+$/.test(a)) errs.push("Actions/Conditions must be prefaced by a vendor, e.g., iam, sdb, ec2, etc.");
    if (!s.Resource && !s.NotResource && !s.Principal) errs.push("Missing required field Resource");
  }
  return errs;
}

function condOk(cond, ctx) {
  for (const [op, kv] of Object.entries(cond || {})) for (const [key, want] of Object.entries(kv)) {
    const have = ctx[key]; const ws = arr(want);
    let ok;
    switch (op.replace(/IfExists$/, "")) {
      case "StringEquals": ok = have !== undefined && ws.some((w) => String(have) === String(w)); break;
      case "StringNotEquals": ok = have === undefined || ws.every((w) => String(have) !== String(w)); break;
      case "StringLike": ok = have !== undefined && ws.some((w) => globReCase(w).test(String(have))); break;
      case "StringNotLike": ok = have === undefined || ws.every((w) => !globReCase(w).test(String(have))); break;
      case "Bool": ok = have !== undefined && ws.some((w) => String(have) === String(w)); break;
      case "IpAddress": ok = have !== undefined && ws.some((w) => ipIn(have, w)); break;
      case "NotIpAddress": ok = have !== undefined && ws.every((w) => !ipIn(have, w)); break;
      case "NumericLessThanEquals": ok = have !== undefined && ws.some((w) => +have <= +w); break;
      case "NumericGreaterThan": ok = have !== undefined && ws.some((w) => +have > +w); break;
      default: ok = false;
    }
    if (op.endsWith("IfExists") && have === undefined) ok = true;
    if (!ok) return false;
  }
  return true;
}
function principalOk(p, who) {
  if (p === undefined) return true;
  if (p === "*" || (p && p.AWS === "*")) return true;
  const list = arr(p.AWS || p.Service);
  return list.some((x) => x === who || (x.endsWith(":root") && who.startsWith(x.replace(":root", ":"))) || globRe(x).test(who));
}
/** Une déclaration s'applique-t-elle à (action, ressource, contexte) ? */
export function matches(st, action, resource, ctx = {}, principal) {
  const actOk = st.NotAction ? !arr(st.NotAction).some((a) => globRe(a).test(action)) : arr(st.Action).some((a) => globRe(a).test(action));
  if (!actOk) return false;
  const resOk = st.NotResource ? !arr(st.NotResource).some((r) => globReCase(r).test(resource)) : st.Resource === undefined ? true : arr(st.Resource).some((r) => globReCase(r).test(resource));
  if (!resOk) return false;
  if (principal !== undefined && !principalOk(st.Principal, principal)) return false;
  return condOk(st.Condition, ctx);
}
/**
 * Décision pour une requête. policies : [{ name, doc }] (politiques d'identité), resourcePolicy : doc ou null.
 * Renvoie { decision: "allowed" | "explicitDeny" | "implicitDeny", by: [nom de politique, numéro de déclaration] }.
 */
export function evaluate(policies, action, resource, ctx = {}, resourcePolicy = null, principal = "") {
  const all = [];
  for (const p of policies) { const j = typeof p.doc === "string" ? JSON.parse(p.doc) : p.doc; arr(j.Statement).forEach((s, i) => all.push({ s, from: p.name, i: i + 1, sid: s.Sid })); }
  if (resourcePolicy) { const j = typeof resourcePolicy === "string" ? JSON.parse(resourcePolicy) : resourcePolicy; arr(j.Statement).forEach((s, i) => all.push({ s, from: "politique du bucket", i: i + 1, sid: s.Sid, res: true })); }
  const hit = (x) => matches(x.s, action, resource, ctx, x.res ? principal : undefined);
  const deny = all.find((x) => x.s.Effect === "Deny" && hit(x));
  if (deny) return { decision: "explicitDeny", by: deny };
  const allow = all.find((x) => x.s.Effect === "Allow" && hit(x));
  if (allow) return { decision: "allowed", by: allow };
  return { decision: "implicitDeny", by: null };
}

/** Politiques gérées par AWS les plus courantes (contenu simplifié mais fidèle). */
export const AWS_MANAGED = {
  "arn:aws:iam::aws:policy/AdministratorAccess": { Version: "2012-10-17", Statement: [{ Effect: "Allow", Action: "*", Resource: "*" }] },
  "arn:aws:iam::aws:policy/ReadOnlyAccess": { Version: "2012-10-17", Statement: [{ Effect: "Allow", Action: ["s3:Get*", "s3:List*", "ec2:Describe*", "iam:Get*", "iam:List*", "rds:Describe*", "cloudwatch:Get*", "cloudwatch:List*", "cloudwatch:Describe*", "logs:Get*", "logs:Describe*", "lambda:Get*", "lambda:List*", "dynamodb:Describe*", "dynamodb:List*", "sts:GetCallerIdentity"], Resource: "*" }] },
  "arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess": { Version: "2012-10-17", Statement: [{ Effect: "Allow", Action: ["s3:Get*", "s3:List*", "s3:Describe*"], Resource: "*" }] },
  "arn:aws:iam::aws:policy/AmazonS3FullAccess": { Version: "2012-10-17", Statement: [{ Effect: "Allow", Action: ["s3:*", "s3-object-lambda:*"], Resource: "*" }] },
  "arn:aws:iam::aws:policy/AmazonEC2ReadOnlyAccess": { Version: "2012-10-17", Statement: [{ Effect: "Allow", Action: ["ec2:Describe*", "elasticloadbalancing:Describe*", "cloudwatch:ListMetrics", "cloudwatch:GetMetricStatistics"], Resource: "*" }] },
  "arn:aws:iam::aws:policy/AmazonEC2FullAccess": { Version: "2012-10-17", Statement: [{ Effect: "Allow", Action: ["ec2:*", "elasticloadbalancing:*", "cloudwatch:*", "autoscaling:*"], Resource: "*" }] },
  "arn:aws:iam::aws:policy/CloudWatchLogsFullAccess": { Version: "2012-10-17", Statement: [{ Effect: "Allow", Action: ["logs:*", "cloudwatch:GenerateQuery"], Resource: "*" }] },
  "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole": { Version: "2012-10-17", Statement: [{ Effect: "Allow", Action: ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"], Resource: "*" }] }
};

/** ARN visé par une action S3 courante. */
export const s3Arn = (bucket, key) => "arn:aws:s3:::" + bucket + (key !== undefined ? "/" + key : "");
