/* Cluster Kubernetes simulé (un nœud, comme kind) : objets, validation, réconciliation.
   Les conteneurs des Pods tournent dans un moteur Docker dédié (le « containerd » du nœud) : mêmes images,
   mêmes comportements d'application que dans le cours Docker. */
import { load, loadAll, CORE_SCHEMA } from "../../vendor/js-yaml.mjs";
import { Docker, hash } from "../docker/engine.js";

export class K8sErr extends Error { constructor(msg, code = 1) { super(msg); this.code = code; } }

/** Types connus : nom court, pluriel, groupe d'API, portée. */
export const KINDS = {
  Pod: { plural: "pods", short: ["po", "pod"], api: "v1" },
  Service: { plural: "services", short: ["svc", "service"], api: "v1" },
  ConfigMap: { plural: "configmaps", short: ["cm", "configmap"], api: "v1" },
  Secret: { plural: "secrets", short: ["secret"], api: "v1" },
  Namespace: { plural: "namespaces", short: ["ns", "namespace"], api: "v1", cluster: true },
  Node: { plural: "nodes", short: ["no", "node"], api: "v1", cluster: true },
  Endpoints: { plural: "endpoints", short: ["ep"], api: "v1" },
  Event: { plural: "events", short: ["ev", "event"], api: "v1" },
  PersistentVolumeClaim: { plural: "persistentvolumeclaims", short: ["pvc"], api: "v1" },
  ServiceAccount: { plural: "serviceaccounts", short: ["sa", "serviceaccount"], api: "v1" },
  Deployment: { plural: "deployments", short: ["deploy", "deployment"], api: "apps/v1" },
  ReplicaSet: { plural: "replicasets", short: ["rs", "replicaset"], api: "apps/v1" },
  Ingress: { plural: "ingresses", short: ["ing", "ingress"], api: "networking.k8s.io/v1" },
  HorizontalPodAutoscaler: { plural: "horizontalpodautoscalers", short: ["hpa"], api: "autoscaling/v2" },
  Role: { plural: "roles", short: ["role"], api: "rbac.authorization.k8s.io/v1" },
  RoleBinding: { plural: "rolebindings", short: ["rolebinding"], api: "rbac.authorization.k8s.io/v1" }
};
export const GROUP = { Deployment: "apps", ReplicaSet: "apps", Ingress: "networking.k8s.io", HorizontalPodAutoscaler: "autoscaling", Role: "rbac.authorization.k8s.io", RoleBinding: "rbac.authorization.k8s.io" };
export function kindOf(word) {
  const w = String(word).toLowerCase().split(".")[0];
  for (const [k, d] of Object.entries(KINDS)) if (k.toLowerCase() === w || d.plural === w || d.short.includes(w)) return k;
  return null;
}
/** Nom tel que kubectl l'affiche : deployment.apps/api, service/api. */
export const fq = (kind, name) => kind.toLowerCase() + (GROUP[kind] ? "." + GROUP[kind] : "") + "/" + name;

const clone = (o) => JSON.parse(JSON.stringify(o));
const stable = (o) => JSON.stringify(o, Object.keys(flat(o)).sort());
function flat(o, acc = {}) { if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) { acc[k] = 1; flat(v, acc); } return acc; }
const RAND = "bcdfghjklmnpqrstvwxz2456789";
const suffix = (s, n) => { const h = hash(s); let out = ""; for (let i = 0; i < n; i++) out += RAND[parseInt(h.slice(i * 2, i * 2 + 2), 16) % RAND.length]; return out; };
export const matches = (sel, labels) => !!sel && Object.keys(sel).length > 0 && Object.entries(sel).every(([k, v]) => (labels || {})[k] === v);
const NAME_RE = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
export function parseQty(q, cpu) {
  if (q === undefined || q === null) return 0;
  const s = String(q); const m = /^([\d.]+)(m|Ki|Mi|Gi|Ti|k|M|G)?$/.exec(s); if (!m) return NaN;
  const n = parseFloat(m[1]); const u = m[2] || "";
  if (cpu) return u === "m" ? n : n * 1000;
  return n * ({ "": 1, Ki: 1024, Mi: 1024 ** 2, Gi: 1024 ** 3, Ti: 1024 ** 4, k: 1e3, M: 1e6, G: 1e9 }[u] || 1);
}

/* ===================== validation (comme l'API server) ===================== */
export function validate(o, file) {
  const errs = []; const kind = o.kind; const name = (o.metadata || {}).name;
  const where = (msg) => errs.push(msg);
  if (!o.apiVersion || !kind) return ["error validating \"" + file + "\": error validating data: [" + (!o.apiVersion ? "apiVersion not set" : "") + (!o.apiVersion && !kind ? ", " : "") + (!kind ? "kind not set" : "") + "]; if you choose to ignore these errors, turn validation off with --validate=false"];
  if (!KINDS[kind]) return ['error: resource mapping not found for name: "' + (name || "") + '" namespace: "" from "' + file + '": no matches for kind "' + kind + '" in version "' + o.apiVersion + '"\nensure CRDs are installed first'];
  if (KINDS[kind].api !== o.apiVersion) return ['error: resource mapping not found for name: "' + (name || "") + '" namespace: "" from "' + file + '": no matches for kind "' + kind + '" in version "' + o.apiVersion + '"\nensure CRDs are installed first'];
  if (!name) return ['error: error when retrieving current configuration of:\nResource: "' + KINDS[kind].plural + '", GroupVersionKind: "' + o.apiVersion + ", Kind=" + kind + '"\nfrom server for: "' + file + '": resource name may not be empty'];
  const inv = (field, val, msg) => where('The ' + kind + ' "' + name + '" is invalid: ' + field + ": " + (val === undefined ? "Required value" : 'Invalid value: "' + val + '": ' + msg));
  if (!NAME_RE.test(name) || name.length > 63) inv("metadata.name", name, "a lowercase RFC 1123 label must consist of lower case alphanumeric characters or '-', and must start and end with an alphanumeric character (e.g. 'my-name',  or '123-abc', regex used for validation is '[a-z0-9]([-a-z0-9]*[a-z0-9])?')");
  const unknown = (obj, allowed, path) => { for (const k of Object.keys(obj || {})) if (!allowed.includes(k)) where('Error from server (BadRequest): error when creating "' + file + '": ' + kind + " in version \"" + o.apiVersion.split("/").pop() + '" cannot be handled as a ' + kind + ': strict decoding error: unknown field "' + path + k + '"'); };
  const podSpec = (ps, base) => {
    if (!ps || !Array.isArray(ps.containers) || !ps.containers.length) { where('The ' + kind + ' "' + name + '" is invalid: ' + base + ".containers: Required value"); return; }
    unknown(ps, ["containers", "initContainers", "volumes", "restartPolicy", "serviceAccountName", "securityContext", "nodeSelector", "terminationGracePeriodSeconds", "imagePullSecrets", "affinity", "tolerations"], base + ".");
    ps.containers.forEach((c, i) => {
      const p = base + ".containers[" + i + "]";
      if (!c.name) where('The ' + kind + ' "' + name + '" is invalid: ' + p + ".name: Required value");
      if (!c.image) where('The ' + kind + ' "' + name + '" is invalid: ' + p + ".image: Required value");
      unknown(c, ["name", "image", "ports", "env", "envFrom", "command", "args", "resources", "readinessProbe", "livenessProbe", "startupProbe", "volumeMounts", "imagePullPolicy", "securityContext", "workingDir"], p + ".");
      for (const [j, pt] of (c.ports || []).entries()) {
        if (typeof pt.containerPort !== "number") where('Error from server (BadRequest): error when creating "' + file + '": ' + kind + ' in version "' + o.apiVersion.split("/").pop() + '" cannot be handled as a ' + kind + ': json: cannot unmarshal ' + (typeof pt.containerPort === "string" ? "string" : "object") + ' into Go struct field ContainerPort.' + p.replace(/\[\d+\]/g, "") + ".ports.containerPort of type int32");
        if (pt.name && pt.name.length > 15) inv(p + ".ports[" + j + "].name", pt.name, "must be no more than 15 characters");
      }
      for (const [j, e] of (c.env || []).entries()) if (e.value !== undefined && typeof e.value !== "string") where('Error from server (BadRequest): error when creating "' + file + '": ' + kind + ' in version "' + o.apiVersion.split("/").pop() + '" cannot be handled as a ' + kind + ': json: cannot unmarshal ' + (typeof e.value === "number" ? "number" : typeof e.value) + ' into Go struct field EnvVar.' + p.replace(/\[\d+\]/g, "").replace(/^spec\.template\.spec/, "spec.template.spec") + ".env.value of type string");
      const r = c.resources || {};
      for (const kk of ["requests", "limits"]) for (const [res, q] of Object.entries(r[kk] || {})) if (Number.isNaN(parseQty(q, res === "cpu"))) inv(p + ".resources." + kk + "[" + res + "]", q, "must match the regex ^([+-]?[0-9.]+)([eEinumkKMGTP]*[-+]?[0-9]*)$");
      if (r.requests && r.limits) for (const res of ["cpu", "memory"]) if (r.requests[res] && r.limits[res] && parseQty(r.requests[res], res === "cpu") > parseQty(r.limits[res], res === "cpu")) inv(p + ".resources.requests", r.requests[res], "must be less than or equal to " + res + " limit of " + r.limits[res]);
    });
  };
  const s = o.spec || {};
  if (kind === "Pod") podSpec(s, "spec");
  if (kind === "Deployment") {
    unknown(s, ["replicas", "selector", "template", "strategy", "revisionHistoryLimit", "minReadySeconds", "progressDeadlineSeconds", "paused"], "spec.");
    if (!s.selector) inv("spec.selector", undefined);
    else if (!matches(s.selector.matchLabels, ((s.template || {}).metadata || {}).labels)) where('The Deployment "' + name + '" is invalid: spec.template.metadata.labels: Invalid value: map[string]string{' + Object.entries(((s.template || {}).metadata || {}).labels || {}).map(([k, v]) => '"' + k + '":"' + v + '"').join(", ") + '}: `selector` does not match template `labels`');
    if (s.replicas !== undefined && (typeof s.replicas !== "number" || s.replicas < 0)) where('Error from server (BadRequest): error when creating "' + file + '": Deployment in version "v1" cannot be handled as a Deployment: json: cannot unmarshal ' + typeof s.replicas + ' into Go struct field DeploymentSpec.spec.replicas of type int32');
    podSpec((s.template || {}).spec, "spec.template.spec");
  }
  if (kind === "Service") {
    unknown(s, ["selector", "ports", "type", "clusterIP", "sessionAffinity", "externalTrafficPolicy"], "spec.");
    if (!Array.isArray(s.ports) || !s.ports.length) inv("spec.ports", undefined);
    for (const [i, p] of (s.ports || []).entries()) {
      if (typeof p.port !== "number") where('Error from server (BadRequest): error when creating "' + file + '": Service in version "v1" cannot be handled as a Service: json: cannot unmarshal ' + typeof p.port + ' into Go struct field ServicePort.spec.ports.port of type int32');
      if (p.nodePort !== undefined && (p.nodePort < 30000 || p.nodePort > 32767)) inv("spec.ports[" + i + "].nodePort", p.nodePort, "provided port is not in the valid range. The range of valid ports is 30000-32767");
    }
    if (s.type && !["ClusterIP", "NodePort", "LoadBalancer", "ExternalName"].includes(s.type)) where('The Service "' + name + '" is invalid: spec.type: Unsupported value: "' + s.type + '": supported values: "ClusterIP", "ExternalName", "LoadBalancer", "NodePort"');
  }
  if (kind === "ConfigMap" || kind === "Secret") {
    unknown(o, ["apiVersion", "kind", "metadata", "data", "stringData", "type", "immutable"], "");
    for (const [k, v] of Object.entries(o.data || {})) if (typeof v !== "string") where('Error from server (BadRequest): error when creating "' + file + '": ' + kind + ' in version "v1" cannot be handled as a ' + kind + ": json: cannot unmarshal " + typeof v + ' into Go struct field ' + kind + ".data of type " + (kind === "Secret" ? "[]uint8" : "string"));
    if (kind === "Secret") for (const [k, v] of Object.entries(o.data || {})) if (typeof v === "string" && !/^[A-Za-z0-9+/]*={0,2}$/.test(v)) where('Error from server (BadRequest): error when creating "' + file + '": Secret in version "v1" cannot be handled as a Secret: illegal base64 data at input byte ' + v.search(/[^A-Za-z0-9+/=]/));
  }
  return errs;
}

/* ===================== le cluster ===================== */
export class Cluster {
  constructor(sh, setup = {}) {
    this.sh = sh; this.t = 0; this.seq = 0; this.objs = {}; this.events = []; this.forwards = [];
    this.node = { name: setup.node || "boucle-control-plane", cpu: parseQty(setup.cpu || "2", true), mem: parseQty(setup.memory || "4Gi") };
    this.rt = new Docker(sh, { apps: setup.apps || (sh.docker && sh.docker.apps) || {}, images: setup.images || [] });
    if (sh.docker) this.rt.registry = sh.docker.registry; // images poussées avec docker push
    for (const [ref, img] of Object.entries(setup.registry || {})) this.rt.registry[ref] = img;
    this.rt.addNetwork("kind", "bridge", "10.244.0");
    this.ns = "default";
    for (const n of ["default", "kube-system", "kube-public", "kube-node-lease", ...(setup.namespaces || [])]) this.put({ apiVersion: "v1", kind: "Namespace", metadata: { name: n } }, true);
    this.put({ apiVersion: "v1", kind: "Node", metadata: { name: this.node.name, labels: { "kubernetes.io/hostname": this.node.name, "node-role.kubernetes.io/control-plane": "" } } }, true);
    this.put({ apiVersion: "v1", kind: "Service", metadata: { name: "kubernetes", namespace: "default" }, spec: { type: "ClusterIP", clusterIP: "10.96.0.1", ports: [{ name: "https", port: 443, targetPort: 6443, protocol: "TCP" }] } }, true);
    // Les noms de Services se résolvent depuis les Pods (DNS du cluster).
    const resolve0 = this.rt.resolveFrom.bind(this.rt); const http0 = this.rt.http.bind(this.rt);
    this.rt.resolveFrom = (c, name) => this.resolveSvc(c, name) || resolve0(c, name);
    // Un Service se présente comme un conteneur « mandataire » : son port est celui du Service.
    this.rt.http = (c, port, path, m) => (c && c.__svc ? this.svcHttp(c.__svc, port, path) : http0(c, port, path, m));
    this.created = true;
  }
  tick(s = 10) { this.t += s; this.rt.t += s; }
  key(kind, ns, name) { return kind + "/" + (KINDS[kind].cluster ? "" : ns || "default") + "/" + name; }
  get(kind, name, ns = this.ns) { return this.objs[this.key(kind, ns, name)] || null; }
  list(kind, ns = this.ns) { return Object.values(this.objs).filter((o) => o.kind === kind && (ns === null || KINDS[kind].cluster || o.metadata.namespace === ns)).sort((a, b) => a.metadata.name.localeCompare(b.metadata.name)); }
  event(obj, type, reason, msg, from = "kubelet") {
    const last = this.events.find((e) => e.uid === obj.metadata.uid && e.reason === reason && e.msg === msg);
    if (last) { last.count++; last.last = this.t; return; }
    this.events.push({ uid: obj.metadata.uid, kind: obj.kind, name: obj.metadata.name, ns: obj.metadata.namespace || "default", type, reason, msg, from, count: 1, first: this.t, last: this.t });
  }
  /** Crée ou remplace un objet. Renvoie « created », « configured » ou « unchanged ». */
  put(o, system = false) {
    const kind = o.kind; const ns = KINDS[kind].cluster ? undefined : (o.metadata.namespace || this.ns);
    if (ns && !this.get("Namespace", ns) && kind !== "Namespace") throw new K8sErr('Error from server (NotFound): namespaces "' + ns + '" not found');
    const k = this.key(kind, ns, o.metadata.name); const old = this.objs[k];
    const fresh = clone(o); fresh.metadata = { ...fresh.metadata, ...(ns ? { namespace: ns } : {}) };
    if (kind === "Secret" && fresh.stringData) { fresh.data = { ...(fresh.data || {}), ...Object.fromEntries(Object.entries(fresh.stringData).map(([a, b]) => [a, btoa(unescape(encodeURIComponent(String(b))))])) }; delete fresh.stringData; }
    if (old) {
      const same = stable(old.spec || old.data || {}) === stable(fresh.spec || fresh.data || {}) && stable(old.metadata.labels || {}) === stable(fresh.metadata.labels || {});
      if (same) return "unchanged";
      fresh.metadata = { ...old.metadata, labels: fresh.metadata.labels, annotations: { ...(old.metadata.annotations || {}), ...(fresh.metadata.annotations || {}) } };
      fresh.metadata.generation = (old.metadata.generation || 1) + 1; fresh.status = old.status;
      if (kind === "Service") fresh.spec.clusterIP = old.spec.clusterIP;
      this.objs[k] = fresh; return "configured";
    }
    fresh.metadata.uid = hash("uid:" + k + ":" + this.seq++).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12}).*/, "$1-$2-$3-$4-$5");
    fresh.metadata.creationTimestamp = system ? -86400 : this.t; fresh.metadata.generation = 1; fresh.status = fresh.status || {};
    if (kind === "Service" && !fresh.spec.clusterIP) fresh.spec.clusterIP = "10.96." + (parseInt(hash(k).slice(0, 2), 16) % 200 + 10) + "." + (parseInt(hash(k).slice(2, 4), 16) % 250 + 2);
    if (kind === "Service") { fresh.spec.type = fresh.spec.type || "ClusterIP"; for (const p of fresh.spec.ports) { p.protocol = p.protocol || "TCP"; if (p.targetPort === undefined) p.targetPort = p.port; if (fresh.spec.type === "NodePort" && !p.nodePort) p.nodePort = 30000 + parseInt(hash(k + p.port).slice(0, 4), 16) % 2768; } }
    if (kind === "Secret") fresh.type = fresh.type || "Opaque";
    if (kind === "Deployment") { fresh.spec.replicas = fresh.spec.replicas ?? 1; fresh.spec.strategy = fresh.spec.strategy || { type: "RollingUpdate", rollingUpdate: { maxSurge: "25%", maxUnavailable: "25%" } }; fresh.spec.revisionHistoryLimit = fresh.spec.revisionHistoryLimit ?? 10; }
    this.objs[k] = fresh; return "created";
  }
  remove(obj) {
    delete this.objs[this.key(obj.kind, obj.metadata.namespace, obj.metadata.name)];
    if (obj.kind === "Pod") { const c = this.rt.container(this.ctrName(obj), { must: false }); if (c) this.rt.remove(c); }
    if (obj.kind === "Deployment") for (const rs of this.ownedBy("ReplicaSet", obj)) this.remove(rs);
    if (obj.kind === "ReplicaSet") for (const p of this.ownedBy("Pod", obj)) this.remove(p);
    if (obj.kind === "Namespace") for (const o of Object.values(this.objs)) if (o.metadata.namespace === obj.metadata.name) this.remove(o);
  }
  ownedBy(kind, owner) { return this.list(kind, owner.metadata.namespace).filter((o) => (o.metadata.ownerReferences || []).some((r) => r.uid === owner.metadata.uid)); }
  ctrName(pod) { return "k8s_" + pod.metadata.namespace + "_" + pod.metadata.name; }

  /** Applique des manifests YAML (plusieurs documents possibles). */
  parse(text, file) {
    let docs;
    try { docs = loadAll(text, null, { schema: CORE_SCHEMA }).filter((d) => d !== null && d !== undefined); }
    catch (e) { const m = /\((\d+):(\d+)\)/.exec(e.message); throw new K8sErr("error: error parsing " + file + ": error converting YAML to JSON: yaml: line " + (m ? m[1] : "?") + ": " + (e.reason || e.message).replace(/^bad indentation of a mapping entry$/, "did not find expected key").replace(/^end of the stream or a document separator is expected$/, "did not find expected <document start>")); }
    const out = [];
    for (const d of docs) {
      if (typeof d !== "object" || Array.isArray(d)) throw new K8sErr("error: error validating \"" + file + "\": error validating data: invalid object to validate; if you choose to ignore these errors, turn validation off with --validate=false");
      if (d.kind === "List") { out.push(...(d.items || [])); continue; }
      out.push(d);
    }
    return out;
  }

  /* ----- réconciliation ----- */
  reconcile() {
    for (let i = 0; i < 4; i++) {
      for (const d of this.list("Deployment", null)) this.syncDeployment(d);
      for (const rs of this.list("ReplicaSet", null)) this.syncReplicaSet(rs);
      for (const p of this.list("Pod", null)) this.syncPod(p);
      for (const d of this.list("Deployment", null)) this.statusDeployment(d);
    }
    for (const s of this.list("Service", null)) this.syncEndpoints(s);
    for (const h of this.list("HorizontalPodAutoscaler", null)) this.syncHpa(h);
  }
  templateHash(d) { return suffix("tpl:" + stable(d.spec.template), 10); }
  syncDeployment(d) {
    const h = this.templateHash(d); const name = d.metadata.name + "-" + h; const ns = d.metadata.namespace;
    let rs = this.get("ReplicaSet", name, ns);
    const all = this.ownedBy("ReplicaSet", d);
    const rev = Math.max(0, ...all.map((r) => +((r.metadata.annotations || {})["deployment.kubernetes.io/revision"] || 0)));
    if (!rs) {
      const tpl = clone(d.spec.template); tpl.metadata = { ...(tpl.metadata || {}), labels: { ...((tpl.metadata || {}).labels || {}), "pod-template-hash": h } };
      this.put({ apiVersion: "apps/v1", kind: "ReplicaSet", metadata: { name, namespace: ns, labels: tpl.metadata.labels, annotations: { "deployment.kubernetes.io/revision": String(rev + 1), ...(d.metadata.annotations && d.metadata.annotations["kubernetes.io/change-cause"] ? { "kubernetes.io/change-cause": d.metadata.annotations["kubernetes.io/change-cause"] } : {}) }, ownerReferences: [{ kind: "Deployment", name: d.metadata.name, uid: d.metadata.uid }] }, spec: { replicas: 0, selector: { matchLabels: { ...d.spec.selector.matchLabels, "pod-template-hash": h } }, template: tpl } });
      rs = this.get("ReplicaSet", name, ns);
      this.event(d, "Normal", "ScalingReplicaSet", "Scaled up replica set " + name + " to " + Math.min(d.spec.replicas, 1), "deployment-controller");
    } else if (+(rs.metadata.annotations["deployment.kubernetes.io/revision"]) < rev && all.length > 1) {
      // Retour à un ancien gabarit (rollout undo) : il redevient la révision la plus récente.
      rs.metadata.annotations["deployment.kubernetes.io/revision"] = String(rev + 1);
    }
    const olds = all.filter((r) => r !== rs);
    const n = d.spec.replicas;
    if (d.spec.paused) return;
    const pct = (v, round) => (typeof v === "string" && v.endsWith("%") ? round(n * parseInt(v, 10) / 100) : +v);
    const ru = (d.spec.strategy.rollingUpdate || {}); const surge = d.spec.strategy.type === "Recreate" ? 0 : pct(ru.maxSurge ?? "25%", Math.ceil); const unavail = d.spec.strategy.type === "Recreate" ? n : pct(ru.maxUnavailable ?? "25%", Math.floor);
    const readyNew = this.ownedBy("Pod", rs).filter((p) => this.podReady(p)).length;
    const oldTotal = olds.reduce((a, r) => a + r.spec.replicas, 0);
    if (!oldTotal) { rs.spec.replicas = n; return; }
    if (readyNew >= n) { for (const r of olds) if (r.spec.replicas) { this.event(d, "Normal", "ScalingReplicaSet", "Scaled down replica set " + r.metadata.name + " to 0 from " + r.spec.replicas, "deployment-controller"); r.spec.replicas = 0; } rs.spec.replicas = n; return; }
    // Déploiement progressif : on ne dépasse pas n + surge, et on garde au moins n - unavail Pods disponibles.
    const target = Math.max(rs.spec.replicas, Math.min(n, Math.max(1, n + surge - oldTotal + Math.max(0, readyNew))));
    if (target !== rs.spec.replicas) { rs.spec.replicas = target; this.event(d, "Normal", "ScalingReplicaSet", "Scaled up replica set " + rs.metadata.name + " to " + target + " from " + (target - 1), "deployment-controller"); }
    const keepOld = Math.max(0, n - unavail - readyNew);
    let left = keepOld;
    for (const r of olds.sort((a, b) => b.metadata.creationTimestamp - a.metadata.creationTimestamp)) { const want = Math.min(r.spec.replicas, left); left -= want; if (want !== r.spec.replicas) { this.event(d, "Normal", "ScalingReplicaSet", "Scaled down replica set " + r.metadata.name + " to " + want + " from " + r.spec.replicas, "deployment-controller"); r.spec.replicas = want; } }
  }
  syncReplicaSet(rs) {
    const pods = this.ownedBy("Pod", rs).filter((p) => !p.metadata.deletionTimestamp);
    for (let i = pods.length; i < rs.spec.replicas; i++) {
      const name = rs.metadata.name + "-" + suffix("pod:" + rs.metadata.uid + ":" + this.seq++, 5);
      const tpl = clone(rs.spec.template);
      this.put({ apiVersion: "v1", kind: "Pod", metadata: { name, namespace: rs.metadata.namespace, labels: tpl.metadata.labels, ownerReferences: [{ kind: "ReplicaSet", name: rs.metadata.name, uid: rs.metadata.uid }] }, spec: tpl.spec });
      this.event(rs, "Normal", "SuccessfulCreate", "Created pod: " + name, "replicaset-controller");
    }
    if (pods.length > rs.spec.replicas) {
      // On supprime d'abord les Pods qui ne sont pas prêts, puis les plus récents.
      const order = pods.sort((a, b) => (this.podReady(a) - this.podReady(b)) || (b.metadata.creationTimestamp - a.metadata.creationTimestamp));
      for (const p of order.slice(0, pods.length - rs.spec.replicas)) { this.event(rs, "Normal", "SuccessfulDelete", "Deleted pod: " + p.metadata.name, "replicaset-controller"); this.remove(p); }
    }
    rs.status = { replicas: Math.min(pods.length, rs.spec.replicas) || this.ownedBy("Pod", rs).length, readyReplicas: this.ownedBy("Pod", rs).filter((p) => this.podReady(p)).length };
  }
  statusDeployment(d) {
    const rss = this.ownedBy("ReplicaSet", d); const h = this.templateHash(d);
    const pods = rss.flatMap((r) => this.ownedBy("Pod", r));
    const cur = rss.find((r) => r.metadata.name.endsWith("-" + h));
    const updated = cur ? this.ownedBy("Pod", cur).length : 0;
    const ready = pods.filter((p) => this.podReady(p)).length;
    d.status = { replicas: pods.length, updatedReplicas: updated, readyReplicas: ready, availableReplicas: ready, observedGeneration: d.metadata.generation, revision: cur ? cur.metadata.annotations["deployment.kubernetes.io/revision"] : "1" };
  }
  podReady(p) { return !!(p.status && p.status.phase === "Running" && (p.status.containerStatuses || []).every((c) => c.ready)); }
  requests(spec) { let cpu = 0, mem = 0; for (const c of spec.containers) { const r = (c.resources || {}).requests || (c.resources || {}).limits || {}; cpu += parseQty(r.cpu, true); mem += parseQty(r.memory); } return { cpu, mem }; }

  /** Kubelet : ordonnancement, tirage de l'image, configuration, démarrage, sondes. */
  syncPod(p) {
    const st = p.status = p.status || {};
    if (!st.phase) { st.phase = "Pending"; st.containerStatuses = p.spec.containers.map((c) => ({ name: c.name, ready: false, restartCount: 0, image: c.image, state: { waiting: { reason: "ContainerCreating" } } })); }
    if (!p.spec.nodeName) {
      const used = this.list("Pod", null).filter((o) => o !== p && o.spec.nodeName).reduce((a, o) => { const r = this.requests(o.spec); return { cpu: a.cpu + r.cpu, mem: a.mem + r.mem }; }, { cpu: 850, mem: parseQty("600Mi") });
      const r = this.requests(p.spec);
      const why = [r.cpu + used.cpu > this.node.cpu ? "Insufficient cpu" : null, r.mem + used.mem > this.node.mem ? "Insufficient memory" : null].filter(Boolean);
      if (why.length) { st.conditions = [{ type: "PodScheduled", status: "False", reason: "Unschedulable" }]; this.event(p, "Warning", "FailedScheduling", "0/1 nodes are available: " + why.map((w) => "1 " + w).join(", ") + ". preemption: 0/1 nodes are available: 1 No preemption victims found for incoming pod.", "default-scheduler"); return; }
      p.spec.nodeName = this.node.name; st.podIP = "10.244.0." + (5 + this.list("Pod", null).indexOf(p) + this.seq % 7);
      this.event(p, "Normal", "Scheduled", "Successfully assigned " + p.metadata.namespace + "/" + p.metadata.name + " to " + this.node.name, "default-scheduler");
    }
    const spec = p.spec.containers[0]; const cs = st.containerStatuses[0];
    let c = this.rt.container(this.ctrName(p), { must: false });
    if (c && c.state === "running") { this.probe(p, c, spec, cs); return; }
    // Image.
    const img = this.rt.image(spec.image) || this.rt.pullBase(spec.image);
    if (!img) {
      const first = !cs.state.waiting || !/ImagePull/.test(cs.state.waiting.reason);
      cs.state = { waiting: { reason: first ? "ErrImagePull" : "ImagePullBackOff", message: first ? "" : 'Back-off pulling image "' + spec.image + '"' } };
      this.event(p, "Normal", "Pulling", 'Pulling image "' + spec.image + '"');
      this.event(p, "Warning", "Failed", 'Failed to pull image "' + spec.image + '": rpc error: code = NotFound desc = failed to pull and unpack image "' + (spec.image.includes("/") && spec.image.split("/")[0].includes(".") ? spec.image : "docker.io/" + (spec.image.includes("/") ? "" : "library/") + spec.image) + '": failed to resolve reference "' + spec.image + '": ' + (spec.image.includes("/") && spec.image.split("/")[0].includes(".") ? spec.image.split("/")[0] + "/" + spec.image.split("/").slice(1).join("/").split(":")[0] + ": not found" : "pull access denied, repository does not exist or may require authorization: server message: insufficient_scope: authorization failed"));
      this.event(p, "Warning", "Failed", "Error: " + (first ? "ErrImagePull" : "ImagePullBackOff"));
      if (!first) this.event(p, "Normal", "BackOff", 'Back-off pulling image "' + spec.image + '"');
      return;
    }
    // Variables d'environnement : valeurs, ConfigMaps, Secrets.
    const env = {}; const ns = p.metadata.namespace;
    const fromRef = (ref, isSecret) => { const o = this.get(isSecret ? "Secret" : "ConfigMap", ref.name, ns); if (!o) return { err: (isSecret ? "secret" : "configmap") + ' "' + ref.name + '" not found' }; const v = (o.data || {})[ref.key]; if (v === undefined) return { err: "couldn't find key " + ref.key + " in " + (isSecret ? "Secret" : "ConfigMap") + " " + ns + "/" + ref.name }; return { v: isSecret ? decodeURIComponent(escape(atob(v))) : v }; };
    for (const e of spec.envFrom || []) {
      const ref = e.configMapRef || e.secretRef; const o = this.get(e.secretRef ? "Secret" : "ConfigMap", ref.name, ns);
      if (!o) return this.configError(p, cs, (e.secretRef ? "secret" : "configmap") + ' "' + ref.name + '" not found');
      for (const [k, v] of Object.entries(o.data || {})) env[(e.prefix || "") + k] = e.secretRef ? decodeURIComponent(escape(atob(v))) : v;
    }
    for (const e of spec.env || []) {
      if (e.value !== undefined) { env[e.name] = String(e.value).replace(/\$\((\w+)\)/g, (m, k) => env[k] ?? m); continue; }
      const vf = e.valueFrom || {};
      if (vf.configMapKeyRef || vf.secretKeyRef) { const r = fromRef(vf.configMapKeyRef || vf.secretKeyRef, !!vf.secretKeyRef); if (r.err) return this.configError(p, cs, r.err); env[e.name] = r.v; }
      if (vf.fieldRef) env[e.name] = vf.fieldRef.fieldPath === "metadata.name" ? p.metadata.name : vf.fieldRef.fieldPath === "metadata.namespace" ? ns : st.podIP;
    }
    if (c) this.rt.remove(c);
    const first = !cs.lastState && cs.restartCount === 0 && !cs.started;
    if (first) { this.event(p, "Normal", "Pulled", 'Container image "' + spec.image + '" already present on machine'); }
    try {
      c = this.rt.create({ imageObj: img, imageRef: spec.image, name: this.ctrName(p), cmd: spec.args, entrypoint: spec.command, env, network: "kind", workdir: spec.workingDir });
      const user = ((spec.securityContext || {}).runAsUser ?? ((p.spec.securityContext || {}).runAsUser));
      if (user !== undefined) c.user = String(user);
      this.event(p, "Normal", "Created", "Created container " + spec.name); cs.started = true;
      this.rt.start(c);
    } catch (e) { return this.configError(p, cs, String(e.message).replace(/^docker: Error response from daemon: /, ""), "RunContainerError"); }
    if (c.state === "running") {
      this.event(p, "Normal", "Started", "Started container " + spec.name);
      st.phase = "Running"; cs.state = { running: { startedAt: this.t } }; cs.containerID = "containerd://" + c.id; cs.imageID = img.id;
      this.probe(p, c, spec, cs);
    } else {
      // Le programme s'est arrêté : redémarrages avec attente croissante (CrashLoopBackOff).
      if (cs.started && cs.restartCount === 0) this.event(p, "Normal", "Started", "Started container " + spec.name);
      cs.lastState = { terminated: { exitCode: c.exitCode, reason: c.exitCode === 0 ? "Completed" : "Error", finishedAt: this.t } };
      cs.restartCount = Math.min(cs.restartCount + (cs.restartCount ? 1 : 3), 99); cs.ready = false;
      cs.state = { waiting: { reason: "CrashLoopBackOff", message: "back-off " + Math.min(10 * 2 ** cs.restartCount, 300) + "s restarting failed container=" + spec.name + " pod=" + p.metadata.name + "_" + ns + "(" + p.metadata.uid + ")" } };
      st.phase = "Running";
      this.event(p, "Warning", "BackOff", "Back-off restarting failed container " + spec.name + " in pod " + p.metadata.name + "_" + ns + "(" + p.metadata.uid + ")");
      cs.prevLogs = c.logs.slice();
    }
  }
  configError(p, cs, msg, reason = "CreateContainerConfigError") {
    cs.state = { waiting: { reason, message: msg } }; cs.ready = false;
    this.event(p, "Warning", "Failed", "Error: " + msg);
  }
  /** Sondes : readiness (Service), liveness (redémarrage). */
  probe(p, c, spec, cs) {
    const run = (pr) => {
      if (!pr) return true;
      if (pr.httpGet) { const port = typeof pr.httpGet.port === "string" ? ((spec.ports || []).find((x) => x.name === pr.httpGet.port) || {}).containerPort : pr.httpGet.port; const r = this.rt.http(c, +port, pr.httpGet.path || "/"); c.logs.length = Math.max(0, c.logs.length - 1); return { ok: !r.error && r.status < 400, why: r.error ? 'Get "http://' + p.status.podIP + ":" + port + (pr.httpGet.path || "/") + '": dial tcp ' + p.status.podIP + ":" + port + ": connect: connection refused" : "HTTP probe failed with statuscode: " + r.status }; }
      if (pr.tcpSocket) { const ok = c.listen && c.listen.port === +pr.tcpSocket.port; return { ok, why: "dial tcp " + p.status.podIP + ":" + pr.tcpSocket.port + ": connect: connection refused" }; }
      return { ok: true };
    };
    const live = run(spec.livenessProbe);
    if (live !== true && !live.ok) {
      this.event(p, "Warning", "Unhealthy", "Liveness probe failed: " + live.why);
      this.event(p, "Normal", "Killing", "Container " + spec.name + " failed liveness probe, will be restarted");
      cs.restartCount += 1; cs.lastState = { terminated: { exitCode: 137, reason: "Error", finishedAt: this.t } };
      if (cs.restartCount >= 3) { this.rt.stop(c); cs.state = { waiting: { reason: "CrashLoopBackOff", message: "back-off 40s restarting failed container=" + spec.name } }; cs.ready = false; cs.prevLogs = c.logs.slice(); return; }
    }
    const ready = run(spec.readinessProbe);
    cs.ready = ready === true || ready.ok;
    if (!cs.ready) this.event(p, "Warning", "Unhealthy", "Readiness probe failed: " + ready.why);
    p.status.conditions = [{ type: "Ready", status: cs.ready ? "True" : "False" }];
  }
  syncEndpoints(s) {
    const pods = s.spec.selector ? this.list("Pod", s.metadata.namespace).filter((p) => matches(s.spec.selector, p.metadata.labels)) : [];
    s.endpoints = pods.filter((p) => this.podReady(p)).map((p) => ({ pod: p, ip: p.status.podIP }));
    s.notReady = pods.filter((p) => !this.podReady(p));
  }
  syncHpa(h) {
    const d = this.get("Deployment", h.spec.scaleTargetRef.name, h.metadata.namespace); if (!d) return;
    const load = (h.metadata.annotations || {})["boucle/cpu"] ? +(h.metadata.annotations["boucle/cpu"]) : 30;
    const target = ((((h.spec.metrics || [])[0] || {}).resource || {}).target || {}).averageUtilization || 80;
    const want = Math.min(h.spec.maxReplicas, Math.max(h.spec.minReplicas || 1, Math.ceil(d.spec.replicas * load / target)));
    h.status = { currentReplicas: d.spec.replicas, desiredReplicas: want, current: load };
    if (want !== d.spec.replicas) { this.event(h, "Normal", "SuccessfulRescale", "New size: " + want + "; reason: cpu resource utilization (percentage of request) " + (want > d.spec.replicas ? "above" : "below") + " target", "horizontal-pod-autoscaler"); d.spec.replicas = want; }
  }
  /** DNS du cluster : nom-du-service, nom.namespace, nom.namespace.svc.cluster.local. */
  resolveSvc(c, name) {
    const pod = this.list("Pod", null).find((p) => this.ctrName(p) === c.name); if (!pod) return null;
    const parts = String(name).split("."); const ns = parts[1] && parts[1] !== "svc" ? parts[1] : pod.metadata.namespace;
    const s = this.get("Service", parts[0], ns); if (!s) return null;
    this.syncEndpoints(s); const ep = s.endpoints[0];
    const target = ep && this.rt.container(this.ctrName(ep.pod), { must: false });
    const tp = (sp) => (typeof sp.targetPort === "string" ? ((ep.pod.spec.containers[0].ports || []).find((x) => x.name === sp.targetPort) || {}).containerPort : sp.targetPort);
    const sp = target && target.listen ? s.spec.ports.find((x) => +tp(x) === target.listen.port) : null;
    const proxy = { __svc: s, name: s.metadata.name, id: s.metadata.uid, state: "running", listen: sp ? { port: sp.port, host: "0.0.0.0", kind: target.listen.kind } : null, pg: target ? target.pg : null };
    return { c: proxy, ip: s.spec.clusterIP };
  }
  /** Requête HTTP vers un Service (port du Service) : un Pod prêt au hasard, sur son targetPort. */
  svcHttp(s, port, path) {
    this.syncEndpoints(s);
    const sp = s.spec.ports.find((p) => p.port === port) || s.spec.ports[0];
    const ep = s.endpoints[this.seq++ % Math.max(1, s.endpoints.length)];
    if (!ep) return { error: [52, "Empty reply from server"] };
    const c = this.rt.container(this.ctrName(ep.pod), { must: false });
    const tp = typeof sp.targetPort === "string" ? ((ep.pod.spec.containers[0].ports || []).find((x) => x.name === sp.targetPort) || {}).containerPort : sp.targetPort;
    if (!c || !c.listen || c.listen.port !== +tp || c.listen.host === "127.0.0.1") return { error: [56, "Recv failure: Connection reset by peer"] };
    return this.rt.http(c, +tp, path);
  }
}

export { load };
