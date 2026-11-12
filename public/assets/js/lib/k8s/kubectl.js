/* kubectl simulé (sorties de kubectl 1.31), branché sur le terminal Linux, et critères des défis Kubernetes. */
import { COMMANDS, HTTP_HOOKS, EXTRA_CHECKS, SETUP_HOOKS } from "../shell/commands.js";
import { dump, CORE_SCHEMA } from "../../vendor/js-yaml.mjs";
import { execIn } from "../docker/cli.js";
import { Cluster, K8sErr, KINDS, kindOf, fq, validate, matches, parseQty } from "./cluster.js";

const VERSION = "v1.31.2";
const clone = (o) => JSON.parse(JSON.stringify(o));
function age(c, t0) {
  const s = Math.max(0, c.t - t0);
  if (t0 < 0) return "1d";
  if (s < 120) return s + "s";
  if (s < 600) return Math.floor(s / 60) + "m" + (s % 60 ? (s % 60) + "s" : "");
  if (s < 3600 * 3) return Math.floor(s / 60) + "m";
  return Math.floor(s / 3600) + "h";
}
const table = (rows, gap = 3) => {
  const w = rows[0].map((_, i) => Math.max(...rows.map((r) => String(r[i]).length)));
  return rows.map((r) => r.map((x, i) => (i === r.length - 1 ? String(x) : String(x).padEnd(w[i] + gap))).join("").replace(/\s+$/, "")).join("\n") + "\n";
};

/** État affiché d'un Pod (colonne STATUS). */
export function podStatus(cl, p) {
  if (p.metadata.deletionTimestamp) return "Terminating";
  const st = p.status || {}; const cs = (st.containerStatuses || [])[0];
  if (!p.spec.nodeName) return "Pending";
  if (cs && cs.state.waiting) return cs.state.waiting.reason;
  if (cs && cs.state.terminated) return cs.state.terminated.reason;
  return st.phase || "Pending";
}
function restarts(cl, p) { const cs = ((p.status || {}).containerStatuses || [])[0]; if (!cs || !cs.restartCount) return "0"; return cs.restartCount + " (" + Math.min(cl.t - (cs.lastState ? cs.lastState.terminated.finishedAt : cl.t) + 12, 59) + "s ago)"; }

/* ===================== analyse des arguments ===================== */
function parseArgs(args) {
  const o = { _: [], n: null, l: null, o: null, f: [], A: false, extra: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--") { o.extra = args.slice(i + 1); break; }
    const [k, v] = a.startsWith("--") && a.includes("=") ? [a.slice(0, a.indexOf("=")), a.slice(a.indexOf("=") + 1)] : [a, undefined];
    const val = () => (v !== undefined ? v : args[++i]);
    if (k === "-n" || k === "--namespace") o.n = val();
    else if (k === "-l" || k === "--selector") o.l = val();
    else if (k === "-o" || k === "--output") o.o = val();
    else if (/^-o\S/.test(k)) o.o = k.slice(2);
    else if (k === "-f" || k === "--filename") o.f.push(val());
    else if (k === "-A" || k === "--all-namespaces") o.A = true;
    else if (k === "-w" || k === "--watch") o.w = true;
    else if (k === "--previous" || k === "-p") o.previous = true;
    else if (k === "-it" || k === "-ti" || k === "-i" || k === "-t" || k === "--stdin" || k === "--tty") o.it = true;
    else if (k === "--rm") o.rm = true;
    else if (k === "--show-labels") o.showLabels = true;
    else if (k.startsWith("--")) o[k.slice(2)] = v !== undefined ? v : (args[i + 1] !== undefined && !args[i + 1].startsWith("-") && !["--all", "--dry-run", "--record", "--now", "--force"].includes(k) ? args[++i] : true);
    else if (k === "-c" || k === "--container") o.c = val();
    else o._.push(a);
  }
  return o;
}
const selectorMatch = (sel, labels) => !sel || sel.split(",").every((x) => { const neq = x.includes("!="); const [k, v] = x.split(neq ? "!=" : "="); return v === undefined ? (labels || {})[k] !== undefined : neq ? (labels || {})[k] !== v : (labels || {})[k] === v; });

/** « deploy/api », « deploy api », « pods » → { kind, name }. */
function target(o, cl, allowList = true) {
  let [a, b] = o._;
  if (!a) throw new K8sErr("error: You must specify the type of resource to get. Use \"kubectl api-resources\" for a complete list of supported resources.");
  if (a.includes("/")) [a, b] = a.split("/");
  const kinds = a.split(",").map((w) => { const k = kindOf(w); if (!k && w !== "all") throw new K8sErr('error: the server doesn\'t have a resource type "' + w + '"'); return k || "all"; });
  if (!b && !allowList) throw new K8sErr("error: resource(s) were provided, but no name was specified");
  return { kinds, name: b, names: o._.slice(a.includes("/") ? 1 : 2).concat(b ? [b] : []) };
}
function must(cl, kind, name, ns) {
  const obj = cl.get(kind, name, ns);
  if (!obj) throw new K8sErr("Error from server (NotFound): " + KINDS[kind].plural + (GROUPED[kind] ? "." + GROUPED[kind] : "") + ' "' + name + '" not found');
  return obj;
}
const GROUPED = { Deployment: "apps", ReplicaSet: "apps", Ingress: "networking.k8s.io", HorizontalPodAutoscaler: "autoscaling" };

/* ===================== affichage ===================== */
function rowsFor(cl, kind, items, o) {
  const wide = o.o === "wide"; const nsCol = o.A;
  const head = { Pod: ["NAME", "READY", "STATUS", "RESTARTS", "AGE", ...(wide ? ["IP", "NODE", "NOMINATED NODE", "READINESS GATES"] : [])], Deployment: ["NAME", "READY", "UP-TO-DATE", "AVAILABLE", "AGE", ...(wide ? ["CONTAINERS", "IMAGES", "SELECTOR"] : [])], ReplicaSet: ["NAME", "DESIRED", "CURRENT", "READY", "AGE", ...(wide ? ["CONTAINERS", "IMAGES", "SELECTOR"] : [])], Service: ["NAME", "TYPE", "CLUSTER-IP", "EXTERNAL-IP", "PORT(S)", "AGE", ...(wide ? ["SELECTOR"] : [])], ConfigMap: ["NAME", "DATA", "AGE"], Secret: ["NAME", "TYPE", "DATA", "AGE"], Namespace: ["NAME", "STATUS", "AGE"], Node: ["NAME", "STATUS", "ROLES", "AGE", "VERSION"], Endpoints: ["NAME", "ENDPOINTS", "AGE"], Ingress: ["NAME", "CLASS", "HOSTS", "ADDRESS", "PORTS", "AGE"], HorizontalPodAutoscaler: ["NAME", "REFERENCE", "TARGETS", "MINPODS", "MAXPODS", "REPLICAS", "AGE"], PersistentVolumeClaim: ["NAME", "STATUS", "VOLUME", "CAPACITY", "ACCESS MODES", "STORAGECLASS", "VOLUMEATTRIBUTESCLASS", "AGE"], ServiceAccount: ["NAME", "SECRETS", "AGE"], Role: ["NAME", "CREATED AT"], RoleBinding: ["NAME", "ROLE", "AGE"], Event: ["LAST SEEN", "TYPE", "REASON", "OBJECT", "MESSAGE"] }[kind];
  const sel = (m) => Object.entries(m || {}).map(([k, v]) => k + "=" + v).join(",");
  const row = (x) => {
    const A = age(cl, x.metadata.creationTimestamp); const s = x.spec || {};
    switch (kind) {
      case "Pod": { const cs = (x.status.containerStatuses || []); return [x.metadata.name, cs.filter((c) => c.ready).length + "/" + (s.containers || []).length, podStatus(cl, x), restarts(cl, x), A, ...(wide ? [x.status.podIP || "<none>", s.nodeName || "<none>", "<none>", "<none>"] : [])]; }
      case "Deployment": { const st = x.status || {}; return [x.metadata.name, (st.readyReplicas || 0) + "/" + s.replicas, st.updatedReplicas || 0, st.availableReplicas || 0, A, ...(wide ? [s.template.spec.containers.map((c) => c.name).join(","), s.template.spec.containers.map((c) => c.image).join(","), sel(s.selector.matchLabels)] : [])]; }
      case "ReplicaSet": { const pods = cl.ownedBy("Pod", x); return [x.metadata.name, s.replicas, pods.length, pods.filter((p) => cl.podReady(p)).length, A, ...(wide ? [s.template.spec.containers.map((c) => c.name).join(","), s.template.spec.containers.map((c) => c.image).join(","), sel(s.selector.matchLabels)] : [])]; }
      case "Service": return [x.metadata.name, s.type, s.clusterIP, s.type === "LoadBalancer" ? "<pending>" : "<none>", s.ports.map((p) => p.port + (p.nodePort ? ":" + p.nodePort : "") + "/" + p.protocol).join(","), A, ...(wide ? [sel(s.selector) || "<none>"] : [])];
      case "ConfigMap": return [x.metadata.name, Object.keys(x.data || {}).length, A];
      case "Secret": return [x.metadata.name, x.type, Object.keys(x.data || {}).length, A];
      case "Namespace": return [x.metadata.name, "Active", A];
      case "Node": return [x.metadata.name, "Ready", "control-plane", A, VERSION];
      case "Endpoints": { const svc = cl.get("Service", x.metadata.name, x.metadata.namespace); return [x.metadata.name, x.eps, A]; }
      case "Ingress": return [x.metadata.name, s.ingressClassName || "<none>", (s.rules || []).map((r) => r.host || "*").join(","), "localhost", "80", A];
      case "HorizontalPodAutoscaler": { const st = x.status || {}; const t = ((((s.metrics || [])[0] || {}).resource || {}).target || {}).averageUtilization || 80; return [x.metadata.name, "Deployment/" + s.scaleTargetRef.name, "cpu: " + (st.current ?? "<unknown>") + "%/" + t + "%", s.minReplicas || 1, s.maxReplicas, st.currentReplicas ?? 0, A]; }
      case "PersistentVolumeClaim": return [x.metadata.name, "Bound", "pvc-" + x.metadata.uid, (((s.resources || {}).requests || {}).storage) || "1Gi", (s.accessModes || ["ReadWriteOnce"]).map((m) => ({ ReadWriteOnce: "RWO", ReadOnlyMany: "ROX", ReadWriteMany: "RWX" })[m] || m).join(","), s.storageClassName || "standard", "<unset>", A];
      case "ServiceAccount": return [x.metadata.name, 0, A];
      case "Role": return [x.metadata.name, "2026-11-12T09:30:00Z"];
      case "RoleBinding": return [x.metadata.name, "Role/" + (x.roleRef || {}).name, A];
      default: return [x.metadata.name, A];
    }
  };
  return { head: (nsCol ? ["NAMESPACE"] : []).concat(head).concat(o.showLabels ? ["LABELS"] : []), rows: items.map((x) => (nsCol ? [x.metadata.namespace || ""] : []).concat(row(x)).concat(o.showLabels ? [sel(x.metadata.labels) || "<none>"] : [])) };
}
function endpointsList(cl, ns) {
  return cl.list("Service", ns).map((s) => { cl.syncEndpoints(s); const tp = (sp, p) => (typeof sp.targetPort === "string" ? ((p.spec.containers[0].ports || []).find((x) => x.name === sp.targetPort) || {}).containerPort : sp.targetPort); const eps = s.metadata.name === "kubernetes" ? ["172.18.0.2:6443"] : s.endpoints.flatMap((e) => s.spec.ports.map((sp) => e.ip + ":" + tp(sp, e.pod))); return { ...s, kind: "Endpoints", eps: eps.length ? (eps.length > 3 ? eps.slice(0, 3).join(",") + " + " + (eps.length - 3) + " more..." : eps.join(",")) : "<none>" }; });
}
function toYaml(obj) {
  const o = clone(obj); delete o.endpoints; delete o.notReady; delete o.eps;
  if (o.status && o.status.containerStatuses) for (const c of o.status.containerStatuses) { delete c.prevLogs; delete c.started; }
  if (typeof o.metadata.creationTimestamp === "number") o.metadata.creationTimestamp = "2026-11-12T09:" + String(30 + Math.floor(Math.max(0, o.metadata.creationTimestamp) / 60) % 30).padStart(2, "0") + ":00Z";
  return dump(o, { schema: CORE_SCHEMA, lineWidth: 120, noRefs: true });
}
function jsonpath(expr, obj) {
  const m = /^\{(.*)\}$/.exec(expr.trim()); if (!m) throw new K8sErr("error: error parsing jsonpath " + expr + ", unrecognized character in action");
  const walk = (val, path) => {
    if (!path) return [val];
    const mm = /^\.(?:\[\*\]|items\[\*\])?([\w-]*)(\[\*\]|\[\d+\])?(.*)$/.exec(path);
    if (path.startsWith(".items[*]")) return (val.items || []).flatMap((it) => walk(it, path.slice(9)));
    if (!mm) return [];
    let v = mm[1] ? (val || {})[mm[1]] : val;
    if (mm[2] === "[*]") return (v || []).flatMap((x) => walk(x, mm[3]));
    if (mm[2]) v = (v || [])[+mm[2].slice(1, -1)];
    return walk(v, mm[3]);
  };
  return walk(obj, m[1]).filter((x) => x !== undefined).map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(" ");
}

/* ===================== describe ===================== */
function eventsBlock(cl, obj) {
  const ev = cl.events.filter((e) => e.uid === obj.metadata.uid);
  if (!ev.length) return "Events:                   <none>\n";
  const rows = [["Type", "Reason", "Age", "From", "Message"], ["----", "------", "----", "----", "-------"], ...ev.map((e) => [e.type, e.reason, e.count > 1 ? age(cl, e.last) + " (x" + e.count + " over " + age(cl, e.first) + ")" : age(cl, e.first), e.from, e.msg])];
  return "Events:\n" + table(rows, 2).split("\n").filter(Boolean).map((l) => "  " + l).join("\n") + "\n";
}
const kv = (m, ind = 18) => { const e = Object.entries(m || {}); return e.length ? e.map(([k, v], i) => (i ? " ".repeat(ind) : "") + k + "=" + v).join("\n") : "<none>"; };
function containerBlock(cl, c, cs, p) {
  let out = "  " + c.name + ":\n";
  if (cs && cs.containerID) out += "    Container ID:   " + cs.containerID + "\n";
  out += "    Image:          " + c.image + "\n";
  for (const pt of c.ports || []) out += "    Port:           " + pt.containerPort + "/TCP" + (pt.name ? " (" + pt.name + ")" : "") + "\n";
  if (!(c.ports || []).length) out += "    Port:           <none>\n";
  if (c.command) out += "    Command:\n" + c.command.map((x) => "      " + x + "\n").join("");
  if (c.args) out += "    Args:\n" + c.args.map((x) => "      " + x + "\n").join("");
  if (cs) {
    const s = cs.state;
    if (s.running) out += "    State:          Running\n      Started:      Thu, 12 Nov 2026 09:30:00 +0000\n";
    else if (s.waiting) out += "    State:          Waiting\n      Reason:       " + s.waiting.reason + "\n" + (s.waiting.reason === "CreateContainerConfigError" ? "      Message:      " + s.waiting.message + "\n" : "");
    if (cs.lastState) out += "    Last State:     Terminated\n      Reason:       " + cs.lastState.terminated.reason + "\n      Exit Code:    " + cs.lastState.terminated.exitCode + "\n";
    out += "    Ready:          " + (cs.ready ? "True" : "False") + "\n    Restart Count:  " + cs.restartCount + "\n";
  }
  const r = c.resources || {};
  if (r.limits) out += "    Limits:\n" + Object.entries(r.limits).map(([k, v]) => "      " + k + ":     " + v + "\n").join("");
  if (r.requests) out += "    Requests:\n" + Object.entries(r.requests).map(([k, v]) => "      " + k + ":        " + v + "\n").join("");
  const probe = (pr) => (pr.httpGet ? "http-get http://:" + pr.httpGet.port + (pr.httpGet.path || "/") : pr.tcpSocket ? "tcp-socket :" + pr.tcpSocket.port : "exec [" + ((pr.exec || {}).command || []).join(" ") + "]") + " delay=" + (pr.initialDelaySeconds || 0) + "s timeout=" + (pr.timeoutSeconds || 1) + "s period=" + (pr.periodSeconds || 10) + "s #success=1 #failure=" + (pr.failureThreshold || 3);
  if (c.livenessProbe) out += "    Liveness:       " + probe(c.livenessProbe) + "\n";
  if (c.readinessProbe) out += "    Readiness:      " + probe(c.readinessProbe) + "\n";
  const env = (c.env || []).map((e) => "      " + e.name + ":  " + (e.value !== undefined ? e.value : e.valueFrom.secretKeyRef ? "<set to the key '" + e.valueFrom.secretKeyRef.key + "' in secret '" + e.valueFrom.secretKeyRef.name + "'>  Optional: false" : e.valueFrom.configMapKeyRef ? "<set to the key '" + e.valueFrom.configMapKeyRef.key + "' of config map '" + e.valueFrom.configMapKeyRef.name + "'>  Optional: false" : "(v1:" + ((e.valueFrom.fieldRef || {}).fieldPath) + ")"));
  out += "    Environment" + (env.length ? ":\n" + env.join("\n") + "\n" : ":    <none>\n");
  if ((c.envFrom || []).length) out += "    Environment Variables from:\n" + c.envFrom.map((e) => "      " + (e.configMapRef || e.secretRef).name + "  " + (e.configMapRef ? "ConfigMap" : "Secret") + "  Optional: false\n").join("");
  return out;
}
function describe(cl, kind, obj) {
  const m = obj.metadata; const s = obj.spec || {};
  let out = "Name:" + " ".repeat(kind === "Deployment" ? 19 : 13) + m.name + "\nNamespace:" + " ".repeat(kind === "Deployment" ? 14 : 8) + (m.namespace || "") + "\n";
  if (kind === "Pod") {
    const st = obj.status || {}; const owner = (m.ownerReferences || [])[0];
    out = "Name:             " + m.name + "\nNamespace:        " + m.namespace + "\nPriority:         0\nService Account:  " + (s.serviceAccountName || "default") + "\nNode:             " + (s.nodeName ? s.nodeName + "/172.18.0.2" : "<none>") + "\nLabels:           " + kv(m.labels) + "\nStatus:           " + (st.phase || "Pending") + "\nIP:               " + (st.podIP || "") + "\n" + (owner ? "Controlled By:  " + owner.kind + "/" + owner.name + "\n" : "") + "Containers:\n";
    s.containers.forEach((c, i) => { out += containerBlock(cl, c, (st.containerStatuses || [])[i], obj); });
    out += "Conditions:\n  Type              Status\n  PodScheduled      " + (s.nodeName ? "True" : "False") + "\n" + (s.nodeName ? "  Ready             " + (cl.podReady(obj) ? "True" : "False") + "\n" : "");
    out += "QoS Class:                   " + (s.containers.every((c) => (c.resources || {}).limits && (c.resources || {}).requests && JSON.stringify(c.resources.limits) === JSON.stringify(c.resources.requests)) ? "Guaranteed" : s.containers.some((c) => c.resources && (c.resources.requests || c.resources.limits)) ? "Burstable" : "BestEffort") + "\n";
    return out + eventsBlock(cl, obj);
  }
  if (kind === "Deployment") {
    const st = obj.status || {}; const rss = cl.ownedBy("ReplicaSet", obj); const h = cl.templateHash(obj); const cur = rss.find((r) => r.metadata.name.endsWith("-" + h));
    const ru = (s.strategy.rollingUpdate || {});
    out += "CreationTimestamp:      Thu, 12 Nov 2026 09:30:00 +0000\nLabels:                 " + kv(m.labels, 24) + "\nAnnotations:            deployment.kubernetes.io/revision: " + (st.revision || 1) + "\nSelector:               " + Object.entries(s.selector.matchLabels).map(([k, v]) => k + "=" + v).join(",") + "\nReplicas:               " + s.replicas + " desired | " + (st.updatedReplicas || 0) + " updated | " + (st.replicas || 0) + " total | " + (st.availableReplicas || 0) + " available | " + Math.max(0, (st.replicas || 0) - (st.availableReplicas || 0)) + " unavailable\nStrategyType:           " + s.strategy.type + "\nMinReadySeconds:        0\n" + (s.strategy.type === "RollingUpdate" ? "RollingUpdateStrategy:  " + (ru.maxUnavailable ?? "25%") + " max unavailable, " + (ru.maxSurge ?? "25%") + " max surge\n" : "") + "Pod Template:\n  Labels:  " + kv(s.template.metadata.labels, 11) + "\n  Containers:\n";
    for (const c of s.template.spec.containers) out += containerBlock(cl, c, null, null).split("\n").map((l) => (l ? "  " + l : l)).join("\n");
    const ok = (st.availableReplicas || 0) >= s.replicas;
    out += "Conditions:\n  Type           Status  Reason\n  ----           ------  ------\n  Available      " + (ok ? "True    MinimumReplicasAvailable" : "False   MinimumReplicasUnavailable") + "\n  Progressing    " + (st.updatedReplicas >= s.replicas && ok ? "True    NewReplicaSetAvailable" : "True    ReplicaSetUpdated") + "\n";
    const olds = rss.filter((r) => r !== cur && r.spec.replicas > 0);
    out += "OldReplicaSets:  " + (olds.length ? olds.map((r) => r.metadata.name + " (" + cl.ownedBy("Pod", r).length + "/" + r.spec.replicas + " replicas created)").join(", ") : "<none>") + "\nNewReplicaSet:   " + (cur ? cur.metadata.name + " (" + cl.ownedBy("Pod", cur).length + "/" + cur.spec.replicas + " replicas created)" : "<none>") + "\n";
    return out + eventsBlock(cl, obj);
  }
  if (kind === "Service") {
    cl.syncEndpoints(obj); const eps = endpointsList(cl, m.namespace).find((e) => e.metadata.name === m.name);
    out += "Labels:            " + kv(m.labels, 19) + "\nSelector:          " + (Object.entries(s.selector || {}).map(([k, v]) => k + "=" + v).join(",") || "<none>") + "\nType:              " + s.type + "\nIP Family Policy:  SingleStack\nIP Families:       IPv4\nIP:                " + s.clusterIP + "\nIPs:               " + s.clusterIP + "\n";
    for (const p of s.ports) out += "Port:              " + (p.name || "<unset>") + "  " + p.port + "/TCP\nTargetPort:        " + p.targetPort + "/TCP\n" + (p.nodePort ? "NodePort:          " + (p.name || "<unset>") + "  " + p.nodePort + "/TCP\n" : "") + "Endpoints:         " + eps.eps + "\n";
    return out + "Session Affinity:  None\nInternal Traffic Policy:  Cluster\n" + eventsBlock(cl, obj);
  }
  if (kind === "ConfigMap" || kind === "Secret") {
    out += "Labels:       " + kv(m.labels, 14) + "\nAnnotations:  <none>\n\n" + (kind === "Secret" ? "Type:  " + obj.type + "\n\nData\n====\n" + Object.entries(obj.data || {}).map(([k, v]) => k + ":  " + atob(v).length + " bytes\n").join("") : "Data\n====\n" + Object.entries(obj.data || {}).map(([k, v]) => k + ":\n----\n" + v + "\n\n").join("") + "\nBinaryData\n====\n\n");
    return out + "Events:  <none>\n";
  }
  if (kind === "Node") return "Name:               " + m.name + "\nRoles:              control-plane\nLabels:             " + kv(m.labels, 20) + "\nConditions:\n  Type             Status  Reason\n  MemoryPressure   False   KubeletHasSufficientMemory\n  DiskPressure     False   KubeletHasNoDiskPressure\n  Ready            True    KubeletReady\nCapacity:\n  cpu:                " + cl.node.cpu / 1000 + "\n  memory:             " + Math.round(cl.node.mem / 1024) + "Ki\n  pods:               110\nAllocated resources:\n  Resource           Requests\n  --------           --------\n  cpu                " + cl.list("Pod", null).reduce((a, p) => a + cl.requests(p.spec).cpu, 850) + "m\n  memory             " + Math.round(cl.list("Pod", null).reduce((a, p) => a + cl.requests(p.spec).mem, parseQty("600Mi")) / 1024 ** 2) + "Mi\nEvents:              <none>\n";
  return out + "Labels:       " + kv(m.labels, 14) + "\n" + eventsBlock(cl, obj);
}

/* ===================== la commande ===================== */
function kubectl(sh, args, io) {
  const cl = sh.k8s;
  if (!cl) { io.err("Command 'kubectl' not found, but can be installed with:\nsudo snap install kubectl --classic\n"); return 127; }
  try { cl.tick(); cl.reconcile(); const code = run(sh, cl, args, io); cl.reconcile(); return code; }
  catch (e) { if (e instanceof K8sErr) { io.err(e.message.replace(/\n?$/, "\n")); return e.code; } throw e; }
}
function readManifests(sh, cl, files, io) {
  const out = [];
  for (const f of files) {
    if (f === "-") { out.push({ file: "STDIN", text: (io && io.stdin) || "" }); continue; }
    const p = sh.abs(f); let node;
    try { node = sh.fs.stat(p, sh.user); } catch (e) { throw new K8sErr('error: the path "' + f + '" does not exist'); }
    if (node.t === "d") { for (const n of Object.keys(node.children).sort()) if (/\.(ya?ml|json)$/.test(n)) out.push({ file: f.replace(/\/$/, "") + "/" + n, text: sh.fs.read(p + "/" + n, sh.user) }); }
    else out.push({ file: f, text: sh.fs.read(p, sh.user) });
  }
  return out;
}
function run(sh, cl, args, io) {
  const verb = args[0]; const o = parseArgs(args.slice(1)); const ns = o.n || cl.ns;
  if (o.n && !cl.get("Namespace", o.n) && !["create", "apply"].includes(verb)) { /* kubectl affiche simplement « No resources found » */ }
  switch (verb) {
    case undefined: case "help": case "--help": io.out("kubectl controls the Kubernetes cluster manager.\n\nBasic Commands (Beginner):\n  create          Create a resource from a file or from stdin\n  expose          Take a replication controller, service, deployment or pod and expose it as a new Kubernetes service\n  run             Run a particular image on the cluster\n  set             Set specific features on objects\n\nBasic Commands (Intermediate):\n  get             Display one or many resources\n  delete          Delete resources by file names, stdin, resources and names, or by resources and label selector\n\nDeploy Commands:\n  rollout         Manage the rollout of a resource\n  scale           Set a new size for a deployment, replica set, or replication controller\n\nTroubleshooting and Debugging Commands:\n  describe        Show details of a specific resource or group of resources\n  logs            Print the logs for a container in a pod\n  exec            Execute a command in a container\n  port-forward    Forward one or more local ports to a pod\n\nAdvanced Commands:\n  apply           Apply a configuration to a resource by file name or stdin\n"); return 0;
    case "version": io.out("Client Version: " + VERSION + "\nKustomize Version: v5.4.2\nServer Version: " + VERSION + "\n"); return 0;
    case "cluster-info": io.out("Kubernetes control plane is running at https://127.0.0.1:41379\nCoreDNS is running at https://127.0.0.1:41379/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy\n\nTo further debug and diagnose cluster problems, use 'kubectl cluster-info dump'.\n"); return 0;
    case "config": {
      if (o._[0] === "current-context" || o._[0] === "get-contexts") { io.out(o._[0] === "current-context" ? "kind-boucle\n" : "CURRENT   NAME          CLUSTER       AUTHINFO      NAMESPACE\n*         kind-boucle   kind-boucle   kind-boucle   " + (cl.ns === "default" ? "" : cl.ns) + "\n"); return 0; }
      if (o._[0] === "set-context") { if (o.namespace) { cl.ns = o.namespace; io.out('Context "kind-boucle" modified.\n'); } return 0; }
      if (o._[0] === "view") { io.out("apiVersion: v1\nclusters:\n- cluster:\n    certificate-authority-data: DATA+OMITTED\n    server: https://127.0.0.1:41379\n  name: kind-boucle\ncontexts:\n- context:\n    cluster: kind-boucle\n    user: kind-boucle\n  name: kind-boucle\ncurrent-context: kind-boucle\nkind: Config\nusers:\n- name: kind-boucle\n  user:\n    client-certificate-data: DATA+OMITTED\n    client-key-data: DATA+OMITTED\n"); return 0; }
      throw new K8sErr("error: unknown command \"" + (o._[0] || "") + "\" for \"kubectl config\"");
    }
    case "api-resources": io.out(table([["NAME", "SHORTNAMES", "APIVERSION", "NAMESPACED", "KIND"], ...Object.entries(KINDS).map(([k, d]) => [d.plural, d.short.filter((x) => x !== k.toLowerCase()).join(",") || "", d.api, d.cluster ? "false" : "true", k])])); return 0;
    case "apply": case "create": {
      if (verb === "create" && !o.f.length) return create(sh, cl, o, io, ns);
      if (!o.f.length) throw new K8sErr("error: must specify one of -f and -k");
      const docs = []; for (const { file, text } of readManifests(sh, cl, o.f, io)) for (const d of cl.parse(text, file)) docs.push({ d, file });
      let code = 0;
      for (const { d, file } of docs) {
        const errs = validate(d, file);
        if (errs.length) { io.err(errs.join("\n") + "\n"); code = 1; continue; }
        if (o.n && !d.metadata.namespace) d.metadata.namespace = o.n;
        if (d.metadata.namespace && o.n && d.metadata.namespace !== o.n) { io.err("error: the namespace from the provided object \"" + d.metadata.namespace + "\" does not match the namespace \"" + o.n + "\". You must pass '--namespace=" + d.metadata.namespace + "' to perform this operation.\n"); code = 1; continue; }
        if (verb === "create" && cl.get(d.kind, d.metadata.name, d.metadata.namespace || ns)) { io.err('Error from server (AlreadyExists): error when creating "' + file + '": ' + KINDS[d.kind].plural + (GROUPED[d.kind] ? "." + GROUPED[d.kind] : "") + ' "' + d.metadata.name + '" already exists\n'); code = 1; continue; }
        try { const r = cl.put(d); cl.reconcile(); io.out(fq(d.kind, d.metadata.name) + " " + r + (o["dry-run"] ? " (dry run)" : "") + "\n"); }
        catch (e) { if (e instanceof K8sErr) { io.err(e.message + "\n"); code = 1; } else throw e; }
      }
      return code;
    }
    case "get": {
      if (o.w) io.err("(kubectl get -w suit les changements en continu ; ici, relance simplement la commande.)\n");
      let { kinds, names } = target(o, cl);
      if (kinds.includes("all")) kinds = ["Pod", "Service", "Deployment", "ReplicaSet", "HorizontalPodAutoscaler"];
      const nsSel = o.A ? null : ns; let out = ""; let found = 0; const objs = [];
      for (const kind of kinds) {
        let items = kind === "Endpoints" ? endpointsList(cl, nsSel) : kind === "Event" ? [] : cl.list(kind, nsSel);
        if (kind === "Event") {
          const ev = cl.events.filter((e) => o.A || e.ns === ns).sort((a, b) => a.last - b.last);
          if (!ev.length) continue; found++;
          out += table([["LAST SEEN", "TYPE", "REASON", "OBJECT", "MESSAGE"], ...ev.map((e) => [age(cl, e.last), e.type, e.reason, e.kind.toLowerCase() + "/" + e.name, e.msg])]);
          continue;
        }
        items = items.filter((x) => selectorMatch(o.l, x.metadata.labels));
        if (names.length) { for (const n of names) if (!items.some((x) => x.metadata.name === n)) { io.err("Error from server (NotFound): " + KINDS[kind].plural + (GROUPED[kind] ? "." + GROUPED[kind] : "") + ' "' + n + '" not found\n'); return 1; } items = items.filter((x) => names.includes(x.metadata.name)); }
        if (kinds.length > 1 && kind === "Service" && !o.l && args.includes("all")) items = items.filter(() => true);
        if (!items.length) continue;
        found++; objs.push(...items);
        if (o.o === "yaml" || o.o === "json" || (o.o && o.o.startsWith("jsonpath"))) continue;
        if (o.o === "name") { out += items.map((x) => fq(kind, x.metadata.name)).join("\n") + "\n"; continue; }
        const { head, rows } = rowsFor(cl, kind, items, o);
        if (kinds.length > 1) { head[0] = head[0]; rows.forEach((r) => { r[o.A ? 1 : 0] = fq(kind, r[o.A ? 1 : 0]).replace(/^deployment\.apps/, "deployment.apps").replace(/^horizontalpodautoscaler\.autoscaling/, "horizontalpodautoscaler.autoscaling"); }); }
        out += (out ? "\n" : "") + table([head, ...rows]);
      }
      if (o.o === "yaml" || o.o === "json") { const one = names.length === 1 && objs.length === 1 ? objs[0] : { apiVersion: "v1", items: objs, kind: "List" }; io.out(o.o === "json" ? JSON.stringify(one, (k, v) => (["endpoints", "notReady", "prevLogs", "eps"].includes(k) ? undefined : v), 4) + "\n" : toYaml(one)); return 0; }
      if (o.o && o.o.startsWith("jsonpath")) { const expr = o.o.slice(o.o.indexOf("=") + 1).replace(/^'|'$/g, ""); io.out(jsonpath(expr, names.length === 1 ? objs[0] : { items: objs })); return 0; }
      if (!found) { io.err(names.length ? "" : "No resources found" + (o.A ? "" : " in " + ns + " namespace") + ".\n"); return 0; }
      io.out(out); return 0;
    }
    case "describe": {
      const { kinds, names } = target(o, cl);
      const kind = kinds[0]; const items = names.length ? names.map((n) => must(cl, kind, n, ns)) : cl.list(kind, ns).filter((x) => selectorMatch(o.l, x.metadata.labels));
      if (!items.length) { io.err("No resources found in " + ns + " namespace.\n"); return 0; }
      io.out(items.map((x) => describe(cl, kind, x)).join("\n\n\n")); return 0;
    }
    case "logs": {
      let [ref] = o._; if (!ref) throw new K8sErr("error: expected 'logs [-f] [-p] (POD | TYPE/NAME) [-c CONTAINER]'.");
      let pod;
      if (ref.includes("/")) { const [w, n] = ref.split("/"); const kind = kindOf(w); const obj = must(cl, kind, n, ns); const sel = kind === "Deployment" ? obj.spec.selector.matchLabels : kind === "Service" ? obj.spec.selector : null; pod = kind === "Pod" ? obj : cl.list("Pod", ns).filter((p) => matches(sel, p.metadata.labels)).sort((a, b) => cl.podReady(b) - cl.podReady(a))[0]; if (!pod) throw new K8sErr("error: timed out waiting for the condition"); if (kind !== "Pod") io.err("Found " + cl.list("Pod", ns).filter((p) => matches(sel, p.metadata.labels)).length + " pods, using pod/" + pod.metadata.name + "\n"); }
      else if (o.l) { const pods = cl.list("Pod", ns).filter((p) => selectorMatch(o.l, p.metadata.labels)); for (const p of pods) { const c = cl.rt.container(cl.ctrName(p), { must: false }); if (c) io.out(c.logs.join("\n") + (c.logs.length ? "\n" : "")); } return 0; }
      else pod = must(cl, "Pod", ref, ns);
      if (o.f) io.err("(logs -f suit le journal en continu ; ici, la commande affiche ce qui est déjà écrit.)\n");
      const cs = ((pod.status || {}).containerStatuses || [])[0]; const c = cl.rt.container(cl.ctrName(pod), { must: false });
      if (o.previous) { if (!cs || !cs.prevLogs) throw new K8sErr('Error from server (BadRequest): previous terminated container "' + pod.spec.containers[0].name + '" in pod "' + pod.metadata.name + '" not found'); io.out(cs.prevLogs.join("\n") + "\n"); return 0; }
      if (!c || !cs || (cs.state.waiting && !cs.prevLogs)) throw new K8sErr('Error from server (BadRequest): container "' + pod.spec.containers[0].name + '" in pod "' + pod.metadata.name + '" is waiting to start: ' + (cs && /ImagePull/.test(cs.state.waiting.reason) ? "trying and failing to pull image" : cs && cs.state.waiting.reason === "CreateContainerConfigError" ? "CreateContainerConfigError" : "ContainerCreating"));
      const lines = c.logs.slice(-(+o.tail || c.logs.length));
      io.out(lines.join("\n") + (lines.length ? "\n" : "")); return 0;
    }
    case "exec": {
      let [ref] = o._; if (!ref) throw new K8sErr("error: you must specify at least one command for the container");
      if (ref.includes("/")) { const [w, n] = ref.split("/"); const kind = kindOf(w); const obj = must(cl, kind, n, ns); ref = kind === "Pod" ? n : (cl.list("Pod", ns).find((p) => matches(obj.spec.selector.matchLabels || obj.spec.selector, p.metadata.labels) && cl.podReady(p)) || {}).metadata?.name; }
      const pod = must(cl, "Pod", ref, ns); const c = cl.rt.container(cl.ctrName(pod), { must: false });
      if (!o.extra.length) throw new K8sErr("error: you must specify at least one command for the container");
      if (!c || c.state !== "running") throw new K8sErr("error: unable to upgrade connection: container not found (\"" + pod.spec.containers[0].name + "\")");
      if (o.it && ["sh", "bash", "/bin/sh", "/bin/bash"].includes(o.extra[0]) && o.extra.length === 1) { io.err("(shell interactif dans le conteneur : non simulé ici. Utilise kubectl exec POD -- commande.)\n"); return 0; }
      try { return execIn(sh, cl.rt, c, o.extra, io); } catch (e) { io.err(String(e.message).replace(/^OCI runtime exec failed: exec failed: unable to start container process: /, "error: Internal error occurred: Internal error occurred: error executing command in container: failed to exec in container: failed to start exec \"" + c.id.slice(0, 12) + "\": OCI runtime exec failed: exec failed: unable to start container process: ") + "\ncommand terminated with exit code 126\n"); return 126; }
    }
    case "delete": {
      if (o.f.length) { for (const { file, text } of readManifests(sh, cl, o.f, io)) for (const d of cl.parse(text, file)) { const obj = cl.get(d.kind, d.metadata.name, d.metadata.namespace || ns); if (!obj) { io.err("Error from server (NotFound): error when deleting \"" + file + "\": " + KINDS[d.kind].plural + (GROUPED[d.kind] ? "." + GROUPED[d.kind] : "") + ' "' + d.metadata.name + '" not found\n'); continue; } cl.remove(obj); io.out(fq(d.kind, d.metadata.name).replace("/", ' "').replace(/$/, '" deleted') + "\n"); } cl.reconcile(); return 0; }
      const { kinds, names } = target(o, cl);
      const kind = kinds[0];
      const items = o.all ? cl.list(kind, ns) : o.l ? cl.list(kind, ns).filter((x) => selectorMatch(o.l, x.metadata.labels)) : names.map((n) => must(cl, kind, n, ns));
      if (!items.length) { io.err("No resources found\n"); return 0; }
      for (const x of items) { cl.remove(x); io.out(kind.toLowerCase() + (GROUPED[kind] ? "." + GROUPED[kind] : "") + ' "' + x.metadata.name + '" deleted' + (kind === "Namespace" ? "" : (ns !== "default" ? " from " + ns + " namespace" : "")) + "\n"); }
      cl.reconcile(); return 0;
    }
    case "scale": {
      const { kinds, names } = target(o, cl, false); const n = o.replicas;
      if (n === undefined || n === true || !/^\d+$/.test(String(n))) throw new K8sErr("error: required flag(s) \"replicas\" not set");
      const d = must(cl, kinds[0], names[0], ns); d.spec.replicas = +n; d.metadata.generation++;
      cl.reconcile(); io.out(fq(kinds[0], names[0]) + " scaled\n"); return 0;
    }
    case "set": {
      if (o._[0] !== "image" && o._[0] !== "env") throw new K8sErr("error: unknown command \"" + o._[0] + "\" for \"kubectl set\"");
      const sub = o._.shift(); const ref = o._[0]; const [w, n] = ref.split("/"); const d = must(cl, kindOf(w), n, ns);
      const pairs = o._.slice(1);
      if (sub === "image") {
        for (const p of pairs) { const [cn, img] = p.split("="); const c = d.spec.template.spec.containers.find((x) => x.name === cn || cn === "*"); if (!c) throw new K8sErr('error: unable to find container named "' + cn + '"'); c.image = img; }
      } else {
        const c = d.spec.template.spec.containers[0]; c.env = c.env || [];
        for (const p of pairs) { const [k, v] = p.split("="); const e = c.env.find((x) => x.name === k); if (e) e.value = v; else c.env.push({ name: k, value: v }); }
      }
      d.metadata.generation++; cl.reconcile(); io.out(fq(d.kind, n) + " " + (sub === "image" ? "image" : "env") + " updated\n"); return 0;
    }
    case "rollout": {
      const sub = o._.shift(); const ref = o._[0]; if (!ref) throw new K8sErr("error: required resource not specified");
      const [w, n] = ref.includes("/") ? ref.split("/") : [ref, o._[1]]; const d = must(cl, kindOf(w), n, ns);
      const rss = cl.ownedBy("ReplicaSet", d).sort((a, b) => +a.metadata.annotations["deployment.kubernetes.io/revision"] - +b.metadata.annotations["deployment.kubernetes.io/revision"]);
      if (sub === "status") {
        const st = d.status;
        if (st.updatedReplicas >= d.spec.replicas && st.availableReplicas >= d.spec.replicas && st.replicas === d.spec.replicas) { io.out('deployment "' + n + '" successfully rolled out\n'); return 0; }
        let out = "";
        if (st.updatedReplicas < d.spec.replicas) out += 'Waiting for deployment "' + n + '" rollout to finish: ' + st.updatedReplicas + " out of " + d.spec.replicas + " new replicas have been updated...\n";
        else if (st.replicas > st.updatedReplicas) out += 'Waiting for deployment "' + n + '" rollout to finish: ' + (st.replicas - st.updatedReplicas) + " old replicas are pending termination...\n";
        else out += 'Waiting for deployment "' + n + '" rollout to finish: ' + st.availableReplicas + " of " + d.spec.replicas + " updated replicas are available...\n";
        io.out(out); io.err('error: deployment "' + n + '" exceeded its progress deadline\n'); return 1;
      }
      if (sub === "history") { io.out("deployment.apps/" + n + " \nREVISION  CHANGE-CAUSE\n" + rss.map((r) => r.metadata.annotations["deployment.kubernetes.io/revision"].padEnd(10) + (r.metadata.annotations["kubernetes.io/change-cause"] || "<none>")).join("\n") + "\n\n"); return 0; }
      if (sub === "undo") {
        const cur = rss.find((r) => r.metadata.name.endsWith("-" + cl.templateHash(d)));
        const want = o["to-revision"] ? rss.find((r) => r.metadata.annotations["deployment.kubernetes.io/revision"] === String(o["to-revision"])) : rss.filter((r) => r !== cur).pop();
        if (!want) throw new K8sErr("error: no rollout history found for deployment \"" + n + "\"");
        const tpl = clone(want.spec.template); delete tpl.metadata.labels["pod-template-hash"]; d.spec.template = tpl; d.metadata.generation++;
        cl.reconcile(); io.out(fq("Deployment", n) + " rolled back\n"); return 0;
      }
      if (sub === "restart") { d.spec.template.metadata.annotations = { ...(d.spec.template.metadata.annotations || {}), "kubectl.kubernetes.io/restartedAt": "2026-11-12T09:" + (30 + cl.t % 30) + ":00Z" }; d.metadata.generation++; cl.reconcile(); io.out(fq("Deployment", n) + " restarted\n"); return 0; }
      if (sub === "pause" || sub === "resume") { d.spec.paused = sub === "pause"; io.out(fq("Deployment", n) + " " + (sub === "pause" ? "paused" : "resumed") + "\n"); return 0; }
      throw new K8sErr("error: unknown command \"" + sub + "\" for \"kubectl rollout\"");
    }
    case "expose": {
      const { kinds, names } = target(o, cl, false); const d = must(cl, kinds[0], names[0], ns);
      const sel = kinds[0] === "Pod" ? d.metadata.labels : d.spec.selector.matchLabels;
      const port = +(o.port || ((d.spec.template || d).spec.containers[0].ports || [{}])[0].containerPort);
      if (!port) throw new K8sErr("error: couldn't find port via --port flag or introspection\nSee 'kubectl expose -h' for help and examples");
      const svc = { apiVersion: "v1", kind: "Service", metadata: { name: o.name || names[0], namespace: ns, labels: d.metadata.labels }, spec: { type: o.type || "ClusterIP", selector: sel, ports: [{ port, targetPort: o["target-port"] ? (/^\d+$/.test(o["target-port"]) ? +o["target-port"] : o["target-port"]) : port, protocol: "TCP" }] } };
      if (cl.get("Service", svc.metadata.name, ns)) throw new K8sErr('Error from server (AlreadyExists): services "' + svc.metadata.name + '" already exists');
      if (o["dry-run"]) { io.out(toYaml(svc)); return 0; }
      cl.put(svc); cl.reconcile(); io.out("service/" + svc.metadata.name + " exposed\n"); return 0;
    }
    case "port-forward": {
      const [ref, ports] = o._; if (!ref || !ports) throw new K8sErr("error: TYPE/NAME and list of ports are required for port-forward");
      const [w, n] = ref.includes("/") ? ref.split("/") : ["pod", ref]; const kind = kindOf(w); const obj = must(cl, kind, n, ns);
      const [lp, rp0] = ports.split(":"); const rp = +(rp0 || lp);
      let pod = kind === "Pod" ? obj : cl.list("Pod", ns).find((p) => matches(kind === "Service" ? obj.spec.selector : obj.spec.selector.matchLabels, p.metadata.labels) && cl.podReady(p));
      if (!pod) throw new K8sErr("error: unable to forward port because pod is not running. Current status=Pending");
      let cport = rp;
      if (kind === "Service") { const sp = obj.spec.ports.find((p) => p.port === rp); if (!sp) throw new K8sErr("error: Service " + n + " does not have a service port " + rp); cport = typeof sp.targetPort === "string" ? ((pod.spec.containers[0].ports || []).find((x) => x.name === sp.targetPort) || {}).containerPort : sp.targetPort; }
      if (cl.forwards.some((f) => f.lp === +lp) || Object.values(sh.services).some((s) => s.active && (s.ports || []).includes(+lp))) throw new K8sErr("Unable to listen on port " + lp + ": Listeners failed to create with the following errors: [unable to create listener: Error listen tcp4 127.0.0.1:" + lp + ": bind: address already in use]\nerror: unable to listen on any of the requested ports: [{" + lp + " " + cport + "}]");
      cl.forwards.push({ lp: +lp, pod: pod.metadata.name, ns, cport: +cport });
      io.out("Forwarding from 127.0.0.1:" + lp + " -> " + cport + "\nForwarding from [::1]:" + lp + " -> " + cport + "\n");
      io.err("(port-forward garde la main dans un vrai terminal : on l'ouvre dans un second terminal. Ici, la redirection reste active en arrière-plan.)\n");
      return 0;
    }
    case "run": {
      const name = o._[0]; if (!name || !o.image) throw new K8sErr("error: NAME is required for run");
      const pod = { apiVersion: "v1", kind: "Pod", metadata: { name, namespace: ns, labels: { run: name } }, spec: { restartPolicy: o.restart || "Always", containers: [{ name, image: o.image, ...(o.extra.length ? (o.command ? { command: o.extra } : { args: o.extra }) : {}), ...(o.port ? { ports: [{ containerPort: +o.port }] } : {}) }] } };
      if (o["dry-run"]) { io.out(toYaml(pod)); return 0; }
      if (cl.get("Pod", name, ns)) throw new K8sErr('Error from server (AlreadyExists): pods "' + name + '" already exists');
      if (o.rm && o.it && o.extra.length) {
        // Pod jetable pour tester depuis l'intérieur du cluster : la commande s'exécute, puis le Pod disparaît.
        cl.put(pod); cl.reconcile(); const p = cl.get("Pod", name, ns); const c = cl.rt.container(cl.ctrName(p), { must: false });
        let code = 0;
        if (c) { c.state = "running"; try { code = execIn(sh, cl.rt, c, o.extra, io); } catch (e) { io.err(e.message + "\n"); code = 1; } }
        else { io.err("error: timed out waiting for the condition\n"); code = 1; }
        cl.remove(p); io.out('pod "' + name + '" deleted\n'); return code;
      }
      cl.put(pod); cl.reconcile(); io.out("pod/" + name + " created\n"); return 0;
    }
    case "auth": {
      if (o._[0] !== "can-i") throw new K8sErr("error: unknown command \"" + o._[0] + "\" for \"kubectl auth\"");
      const [, vb, res] = o._; const as = o.as || "";
      if (!as) { io.out("yes\n"); return 0; }
      const m = /^system:serviceaccount:([^:]+):(.+)$/.exec(as); const sns = m ? m[1] : ns; const sa = m ? m[2] : as;
      const allowed = cl.list("RoleBinding", o.n || sns).some((b) => (b.subjects || []).some((s) => s.name === sa) && cl.list("Role", o.n || sns).some((r) => r.metadata.name === b.roleRef.name && (r.rules || []).some((rule) => (rule.verbs || []).some((v) => v === vb || v === "*") && (rule.resources || []).some((x) => x === kindOf(res) && false || KINDS[kindOf(res)] && x === KINDS[kindOf(res)].plural || x === "*"))));
      io.out(allowed ? "yes\n" : "no\n"); return allowed ? 0 : 1;
    }
    case "top": io.err("error: Metrics API not available\n(metrics-server n'est pas installé sur ce cluster simulé.)\n"); return 1;
    case "edit": io.err("(kubectl edit ouvre un éditeur : non simulé ici. Modifie le fichier YAML puis kubectl apply -f, ou utilise kubectl set / kubectl scale.)\n"); return 1;
    case "explain": io.err("(kubectl explain n'est pas simulé : la référence des champs est sur kubernetes.io/docs/reference.)\n"); return 1;
    default: throw new K8sErr('error: unknown command "' + verb + '" for "kubectl"\n\nDid you mean this?\n\tget\n\tapply\n\tdescribe');
  }
}
function create(sh, cl, o, io, ns) {
  const [what, name] = o._;
  let obj;
  if (what === "deployment" || what === "deploy") {
    if (!name || !o.image) throw new K8sErr("error: required flag(s) \"image\" not set");
    obj = { apiVersion: "apps/v1", kind: "Deployment", metadata: { name, namespace: ns, labels: { app: name } }, spec: { replicas: +(o.replicas || 1), selector: { matchLabels: { app: name } }, template: { metadata: { labels: { app: name } }, spec: { containers: [{ name: String(o.image).split("/").pop().split(":")[0], image: o.image, ...(o.port ? { ports: [{ containerPort: +o.port }] } : {}) }] } } } };
  } else if (what === "namespace" || what === "ns") obj = { apiVersion: "v1", kind: "Namespace", metadata: { name } };
  else if (what === "configmap" || what === "cm" || what === "secret") {
    const isSecret = what === "secret"; const nm = isSecret ? o._[2] : name;
    if (isSecret && name !== "generic") throw new K8sErr("error: unknown command \"" + name + "\" for \"kubectl create secret\" (utilise kubectl create secret generic NOM)");
    const lits = [].concat(o["from-literal"] || []); const all = sh.lastArgs || [];
    const data = {};
    for (const a of all) { const m = /^--from-literal=([^=]+)=(.*)$/.exec(a); if (m) data[m[1]] = m[2]; const f = /^--from-file=(?:([^=]+)=)?(.+)$/.exec(a); if (f) { try { data[f[1] || f[2].split("/").pop()] = sh.fs.read(sh.abs(f[2]), sh.user); } catch (e) { throw new K8sErr("error: error reading " + f[2] + ": no such file or directory"); } } }
    if (!Object.keys(data).length && lits.length) for (const l of lits) { const i = String(l).indexOf("="); data[String(l).slice(0, i)] = String(l).slice(i + 1); }
    obj = { apiVersion: "v1", kind: isSecret ? "Secret" : "ConfigMap", metadata: { name: nm, namespace: ns }, ...(isSecret ? { type: "Opaque", data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, btoa(unescape(encodeURIComponent(v)))])) } : { data }) };
  } else throw new K8sErr("error: unknown command \"" + what + "\" for \"kubectl create\"");
  if (o["dry-run"]) { io.out(o.o === "yaml" ? toYaml(obj) : fq(obj.kind, obj.metadata.name) + " created (dry run)\n"); return 0; }
  if (cl.get(obj.kind, obj.metadata.name, ns)) throw new K8sErr("error: failed to create " + obj.kind.toLowerCase() + ": " + KINDS[obj.kind].plural + (GROUPED[obj.kind] ? "." + GROUPED[obj.kind] : "") + ' "' + obj.metadata.name + '" already exists');
  cl.put(obj); cl.reconcile(); io.out(fq(obj.kind, obj.metadata.name) + " created\n"); return 0;
}

/* ===================== branchements ===================== */
COMMANDS.kubectl = (sh, args, io) => { sh.lastArgs = args; return kubectl(sh, args, io); };
COMMANDS.k = COMMANDS.kubectl;
COMMANDS.kind = (sh, args, io) => {
  if (args[0] === "get" && args[1] === "clusters") { io.out(sh.k8s ? "boucle\n" : "No kind clusters found.\n"); return 0; }
  if (args[0] === "load" && args[1] === "docker-image") {
    const ref = args[2]; const d = sh.docker; const img = d && d.image(ref);
    if (!img) { io.err('ERROR: image: "' + ref + '" not present locally\n'); return 1; }
    sh.k8s.rt.images[img.id] = JSON.parse(JSON.stringify(img)); sh.k8s.rt.tag(img.id, ref);
    io.out('Image: "' + ref + '" with ID "sha256:' + img.id + '" not yet present on node "boucle-control-plane", loading...\n'); return 0;
  }
  io.err("(kind : seules « kind get clusters » et « kind load docker-image » sont simulées ; le cluster « boucle » existe déjà.)\n"); return 1;
};
HTTP_HOOKS.push((sh, host, port, path, ip) => {
  const cl = sh.k8s; if (!cl || ip !== "127.0.0.1") return null;
  cl.reconcile();
  const f = cl.forwards.find((x) => x.lp === port); if (!f) return null;
  const pod = cl.get("Pod", f.pod, f.ns);
  if (!pod) return { error: [52, "Empty reply from server"] };
  const c = cl.rt.container(cl.ctrName(pod), { must: false });
  if (!c || !c.listen || c.listen.port !== f.cport || c.listen.host === "127.0.0.1") return { error: [52, "Empty reply from server"] };
  return cl.rt.http(c, f.cport, path);
});
const k8sHook = (sh, setup) => {
  if (!setup.k8s) return;
  sh.k8s = new Cluster(sh, setup.k8s);
  sh.fs.mkdir(sh.home() + "/.kube", "eleve", { parents: true });
  sh.fs.write(sh.home() + "/.kube/config", "apiVersion: v1\nkind: Config\ncurrent-context: kind-boucle\n", "eleve");
};
// Les objets de départ sont créés après les commandes de mise en place (images construites et poussées).
k8sHook.after = (sh, setup) => {
  if (!setup.k8s) return;
  for (const text of [].concat(setup.k8s.apply || [])) { for (const d of sh.k8s.parse(text, "setup.yaml")) sh.k8s.put(d); sh.k8s.reconcile(); sh.k8s.tick(30); sh.k8s.reconcile(); }
  sh.k8s.tick(60);
};
SETUP_HOOKS.push(k8sHook);

/* ----- critères ----- */
EXTRA_CHECKS.k8s = (sh, v, push) => {
  const cl = sh.k8s; cl.reconcile();
  for (const [ref, spec] of Object.entries(v)) {
    const [w, n] = ref.split("/"); const kind = kindOf(w); const ns = spec && spec.namespace || "default"; const obj = cl.get(kind, n, ns);
    const lbl = kind + " " + n + (ns !== "default" ? " (namespace " + ns + ")" : "");
    if (spec === null) { push(!obj, "Le " + lbl + " n'existe pas"); continue; }
    push(!!obj, "Le " + lbl + " existe"); if (!obj) continue;
    if (spec.replicas !== undefined) push(obj.spec.replicas === spec.replicas, "Le " + lbl + " demande " + spec.replicas + " réplique" + (spec.replicas > 1 ? "s" : ""));
    if (spec.ready !== undefined) push(((obj.status || {}).readyReplicas || 0) >= spec.ready && kind === "Deployment" ? ((obj.status || {}).replicas === obj.spec.replicas) : true, "Le " + lbl + " a " + spec.ready + " Pod" + (spec.ready > 1 ? "s" : "") + " prêt" + (spec.ready > 1 ? "s" : "") + " et aucun ancien Pod");
    if (spec.image) push(obj.spec.template.spec.containers.some((c) => c.image === spec.image), "Le " + lbl + " utilise l'image " + spec.image);
    if (spec.rolledOut) { const st = obj.status || {}; push(st.updatedReplicas >= obj.spec.replicas && st.availableReplicas >= obj.spec.replicas && st.replicas === obj.spec.replicas, "Le déploiement de " + n + " est terminé (tous les Pods à jour et disponibles)"); }
    if (spec.revision !== undefined) push(+((obj.status || {}).revision || 1) >= spec.revision, "Le " + lbl + " est au moins à la révision " + spec.revision);
    if (spec.type) push(obj.spec.type === spec.type, "Le " + lbl + " est de type " + spec.type);
    if (spec.endpoints !== undefined) { cl.syncEndpoints(obj); push(obj.endpoints.length >= spec.endpoints && (spec.endpoints > 0 || obj.endpoints.length === 0), "Le " + lbl + " envoie le trafic vers " + spec.endpoints + " Pod" + (spec.endpoints > 1 ? "s" : "") + " prêt" + (spec.endpoints > 1 ? "s" : "")); }
    if (spec.hasKeys) for (const k of spec.hasKeys) push(Object.keys(obj.data || {}).includes(k), "Le " + lbl + " contient la clé " + k);
    if (spec.probes) { const c = obj.spec.template.spec.containers[0]; for (const p of spec.probes) push(!!c[p + "Probe"], "Le conteneur de " + n + " a une sonde " + p); }
    if (spec.resources) { const c = obj.spec.template.spec.containers[0]; push(!!(c.resources && c.resources.requests && c.resources.limits && c.resources.requests.memory && c.resources.limits.memory), "Le conteneur de " + n + " déclare des requests et des limits"); }
    if (spec.envFromSecret) { const c = obj.spec.template.spec.containers[0]; push((c.env || []).some((e) => e.valueFrom && e.valueFrom.secretKeyRef && e.valueFrom.secretKeyRef.name === spec.envFromSecret) || (c.envFrom || []).some((e) => e.secretRef && e.secretRef.name === spec.envFromSecret), "Le conteneur de " + n + " lit le Secret " + spec.envFromSecret); }
    if (spec.envFromConfigMap) { const c = obj.spec.template.spec.containers[0]; push((c.env || []).some((e) => e.valueFrom && e.valueFrom.configMapKeyRef && e.valueFrom.configMapKeyRef.name === spec.envFromConfigMap) || (c.envFrom || []).some((e) => e.configMapRef && e.configMapRef.name === spec.envFromConfigMap), "Le conteneur de " + n + " lit le ConfigMap " + spec.envFromConfigMap); }
  }
};
EXTRA_CHECKS.pods = (sh, v, push) => {
  const cl = sh.k8s; cl.reconcile();
  const pods = cl.list("Pod", v.namespace || "default").filter((p) => selectorMatch(v.selector, p.metadata.labels));
  if (v.running !== undefined) push(pods.filter((p) => cl.podReady(p)).length === v.running && pods.length === v.running, v.running + " Pod" + (v.running > 1 ? "s" : "") + (v.selector ? " " + v.selector : "") + " tourne" + (v.running > 1 ? "nt" : "") + ", prêt" + (v.running > 1 ? "s" : "") + ", sans Pod en échec");
  if (v.noCrash) push(!pods.some((p) => ["CrashLoopBackOff", "ImagePullBackOff", "ErrImagePull", "CreateContainerConfigError", "Pending"].includes(podStatus(cl, p))), "Aucun Pod en échec ni en attente");
};
