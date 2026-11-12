/* Prometheus dans le terminal : serveur sur le port 9090 (règles, alertes), promtool, critères. */
import { COMMANDS, HTTP_HOOKS, EXTRA_CHECKS, SETUP_HOOKS, addService } from "../shell/commands.js";
import { load, CORE_SCHEMA } from "../../vendor/js-yaml.mjs";
import { Prom, PromErr, NOW, defaultSeries, formatResult, fmtLabels, fmtValue, parse } from "./promql.js";

const DUR = { s: 1, m: 60, h: 3600, d: 86400 };
const dur = (s) => { if (s === undefined || s === null || s === "") return 0; const m = /^(\d+)(s|m|h|d)$/.exec(String(s)); return m ? +m[1] * DUR[m[2]] : NaN; };

/** Lit un fichier de règles ; renvoie { groups, errors }. Messages proches de promtool check rules. */
export function readRules(text, file) {
  let doc;
  try { doc = load(text, { schema: CORE_SCHEMA }); }
  catch (e) { return { errors: [file + ": yaml: line " + ((e.mark && e.mark.line + 1) || "?") + ": " + (e.reason || e.message)] }; }
  const errors = []; const rules = [];
  if (!doc || !Array.isArray(doc.groups)) return { errors: [file + ": yaml: unmarshal errors:\n  la clé groups (une liste) est obligatoire"] };
  doc.groups.forEach((g, gi) => {
    if (!g.name) errors.push(file + ": groupname must not be empty");
    for (const k of Object.keys(g)) if (!["name", "interval", "rules", "limit", "labels"].includes(k)) errors.push(file + ": field " + k + " not found in type rulefmt.RuleGroup");
    (g.rules || []).forEach((r, ri) => {
      const where = file + ': group "' + g.name + '", rule ' + (ri + 1) + ', "' + (r.alert || r.record || "") + '"';
      for (const k of Object.keys(r)) if (!["alert", "record", "expr", "for", "keep_firing_for", "labels", "annotations"].includes(k)) errors.push(file + ": field " + k + " not found in type rulefmt.RuleNode");
      if (!r.alert && !r.record) errors.push(where + ": one of 'record' or 'alert' must be set");
      if (r.expr === undefined || r.expr === "") { errors.push(where + ": field 'expr' must be set in rule"); return; }
      try { parse(String(r.expr)); } catch (e) { errors.push(where + ": could not parse expression: " + e.message); return; }
      if (r.for !== undefined && Number.isNaN(dur(r.for))) errors.push(where + ': not a valid duration string: "' + r.for + '"');
      if (r.record && r.for !== undefined) errors.push(where + ": invalid field 'for' in recording rule");
      rules.push({ group: g.name, ...r, expr: String(r.expr) });
    });
  });
  return { errors, rules };
}

/** État d'une alerte : inactive, pending (condition vraie depuis moins de « for ») ou firing. */
export function alertState(P, rule) {
  let res; try { res = P.query(rule.expr).result; } catch (e) { return { state: "inactive", items: [] }; }
  if (!Array.isArray(res) || !res.length) return { state: "inactive", items: [] };
  const f = dur(rule.for);
  let since = NOW;
  for (let t = NOW; t >= NOW - 86400; t -= 15) { let r; try { r = P.query(rule.expr, t).result; } catch (e) { break; } if (!r.length) break; since = t; }
  const active = NOW - since;
  return { state: active >= f ? "firing" : "pending", activeFor: active, items: res };
}

class PromServer {
  constructor(sh, setup) {
    this.sh = sh; this.P = new Prom(defaultSeries(setup)); this.loaded = []; this.dir = "/etc/prometheus/rules";
    this.reload();
  }
  reload() {
    const out = []; const errors = [];
    try { for (const n of this.sh.fs.list(this.dir, "root") || []) if (/\.ya?ml$/.test(n)) { const r = readRules(this.sh.fs.read(this.dir + "/" + n, "root"), this.dir + "/" + n); errors.push(...r.errors); out.push(...(r.rules || [])); } } catch (e) { /* pas de dossier */ }
    if (errors.length) return errors;
    this.loaded = out; return [];
  }
  alertsJson() {
    const alerts = [];
    for (const r of this.loaded.filter((x) => x.alert)) {
      const st = alertState(this.P, r); if (st.state === "inactive") continue;
      for (const it of st.items) alerts.push({ labels: { alertname: r.alert, ...Object.fromEntries(Object.entries(it.l).filter(([k]) => k !== "__name__")), ...(r.labels || {}) }, annotations: Object.fromEntries(Object.entries(r.annotations || {}).map(([k, v]) => [k, String(v).replace(/\{\{\s*\$labels\.(\w+)\s*\}\}/g, (_, x) => it.l[x] ?? "").replace(/\{\{\s*\$value\s*(\|\s*humanize(Percentage)?\s*)?\}\}/g, (_, h, pct) => (pct ? +(it.v * 100).toFixed(2) + "%" : fmtValue(it.v)))])), state: st.state, activeAt: new Date((NOW - st.activeFor) * 1000).toISOString(), value: fmtValue(it.v) });
    }
    return JSON.stringify({ status: "success", data: { alerts } });
  }
}

function promtool(sh, args, io) {
  const [cmd, sub, ...rest] = args;
  if (cmd === "query" && sub === "instant") {
    const [server, q] = rest.filter((a) => !a.startsWith("--"));
    if (!server || q === undefined) { io.err("promtool: error: required argument 'server' not provided, try --help\n"); return 1; }
    if (!sh.prom || !/localhost:9090|127\.0\.0\.1:9090/.test(server)) { io.err('query error: Post "' + server + '/api/v1/query": dial tcp 127.0.0.1:9090: connect: connection refused\n'); return 1; }
    if (!sh.services.prometheus || !sh.services.prometheus.active) { io.err('query error: Post "' + server + '/api/v1/query": dial tcp 127.0.0.1:9090: connect: connection refused\n'); return 1; }
    try { const r = sh.prom.P.query(q); io.out(formatResult(r)); return 0; }
    catch (e) { if (e instanceof PromErr) { io.err('query error: bad_data: invalid parameter "query": ' + e.message + "\n"); return 1; } throw e; }
  }
  if (cmd === "check" && sub === "rules") {
    let code = 0;
    for (const f of rest) {
      let text; try { text = sh.fs.read(sh.abs(f), sh.user); } catch (e) { io.err("Checking " + f + "\n  FAILED:\n" + f + ": open " + f + ": no such file or directory\n\n"); code = 1; continue; }
      const r = readRules(text, f);
      if (r.errors.length) { io.err("Checking " + f + "\n  FAILED:\n" + r.errors.join("\n") + "\n\n"); code = 1; continue; }
      io.out("Checking " + f + "\n  SUCCESS: " + r.rules.length + " rules found\n\n");
    }
    return code;
  }
  if (cmd === "check" && sub === "config") {
    const f = rest[0] || "/etc/prometheus/prometheus.yml";
    let text; try { text = sh.fs.read(sh.abs(f), sh.user); } catch (e) { io.err("Checking " + f + "\n  FAILED: open " + f + ": no such file or directory\n\n"); return 1; }
    try { const d = load(text, { schema: CORE_SCHEMA }); if (!d || !Array.isArray(d.scrape_configs)) throw new Error("scrape_configs manquant"); } catch (e) { io.err("Checking " + f + "\n  FAILED: parsing YAML file " + f + ": " + (e.reason || e.message) + "\n\n"); return 1; }
    io.out("Checking " + f + "\n SUCCESS: " + f + " is valid prometheus config file syntax\n\n"); return 0;
  }
  io.err("usage: promtool [<flags>] <command> [<args> ...]\n\nCommands:\n  check config <config-files>...\n  check rules <rule-files>...\n  query instant <server> <expr>\n"); return 1;
}

COMMANDS.promtool = promtool;
HTTP_HOOKS.push((sh, host, port, path, ip) => {
  if (!sh.prom || ip !== "127.0.0.1" || port !== 9090) return null;
  if (!sh.services.prometheus || !sh.services.prometheus.active) return { error: [7, "Failed to connect to " + host + " port 9090 after 0 ms: Couldn't connect to server"] };
  if (path === "/-/healthy") return { status: 200, type: "text/plain", body: "Prometheus Server is Healthy.\n", server: "" };
  if (path === "/-/reload") { const errs = sh.prom.reload(); return errs.length ? { status: 500, type: "text/plain", body: "failed to reload config: one or more errors occurred while applying the new configuration\n" } : { status: 200, type: "text/plain", body: "" }; }
  if (path === "/api/v1/alerts") return { status: 200, type: "application/json", body: sh.prom.alertsJson() + "\n" };
  if (path === "/api/v1/rules") return { status: 200, type: "application/json", body: JSON.stringify({ status: "success", data: { groups: [...new Set(sh.prom.loaded.map((r) => r.group))].map((g) => ({ name: g, rules: sh.prom.loaded.filter((r) => r.group === g).map((r) => ({ name: r.alert || r.record, query: r.expr, type: r.alert ? "alerting" : "recording", ...(r.alert ? { state: alertState(sh.prom.P, r).state, duration: dur(r.for) } : {}) })) })) } }) + "\n" };
  return { status: 404, type: "text/plain", body: "404 page not found\n" };
});
SETUP_HOOKS.push((sh, setup) => {
  if (!setup.prom) return;
  sh.fs.mkdir("/etc/prometheus/rules", "root", { parents: true });
  if (!sh.fs.groups.prometheus) sh.fs.addGroup("prometheus", 997);
  sh.fs.write("/etc/prometheus/prometheus.yml", "global:\n  scrape_interval: 15s\n  evaluation_interval: 15s\n\nrule_files:\n  - /etc/prometheus/rules/*.yml\n\nscrape_configs:\n  - job_name: api\n    static_configs:\n      - targets: [\"api-1:8000\", \"api-2:8000\"]\n  - job_name: node\n    static_configs:\n      - targets: [\"node-1:9100\", \"node-2:9100\", \"worker-1:9100\"]\n", "root");
  sh.prom = new PromServer(sh, setup.prom);
  addService(sh, "prometheus", { desc: "Monitoring system and time series database", exec: "/usr/bin/prometheus --config.file=/etc/prometheus/prometheus.yml --storage.tsdb.path=/var/lib/prometheus", ports: [9090], enabled: true, active: true, check: (sh2) => { const e = sh2.prom.reload(); return e.length ? { ok: false, msg: 'level=ERROR source=main.go msg="Error reloading config" err="one or more errors occurred while applying the new configuration: ' + e[0].replace(/"/g, '\\"').replace(/\n/g, " ") + '"' } : { ok: true }; } });
  sh.packages.add("prometheus");
});
// Les règles écrites pendant la mise en place sont chargées au démarrage du serveur.
SETUP_HOOKS[SETUP_HOOKS.length - 1].after = (sh, setup) => { if (setup.prom) sh.prom.reload(); };

/* ----- critères ----- */
EXTRA_CHECKS.promql = (sh, v, push) => {
  // { file, same } : la requête du fichier renvoie le même résultat (labels et valeurs) que la requête de référence.
  let q; try { q = sh.fs.read(v.file, "root"); } catch (e) { push(false, v.file + " existe"); return; }
  const P = sh.prom ? sh.prom.P : new Prom();
  let got, want;
  try { got = P.query(q); } catch (e) { push(false, "La requête est valide (" + e.message + ")"); return; }
  push(true, "La requête est valide");
  want = P.query(v.same);
  const norm = (r) => (r.type === "scalar" ? [["", r.result]] : (r.result || []).map((s) => [fmtLabels({ ...s.l, __name__: v.keepName ? s.l.__name__ : undefined }).replace(/^undefined/, ""), s.v]).sort());
  const a = norm(got), b = norm(want);
  const close = (x, y) => Math.abs(x - y) <= 1e-6 * Math.max(1, Math.abs(y));
  push(a.length === b.length && a.every(([l, x], i) => l === b[i][0] && close(x, b[i][1])), v.label || "Le résultat correspond à ce qui est demandé (" + b.length + " série" + (b.length > 1 ? "s" : "") + ")");
};
EXTRA_CHECKS.alerts = (sh, v, push) => {
  for (const [name, state] of Object.entries(v)) {
    const r = sh.prom.loaded.find((x) => x.alert === name);
    if (!r) { push(state === "absent", "L'alerte " + name + " est chargée par Prometheus"); continue; }
    const st = alertState(sh.prom.P, r).state;
    push(st === state, "L'alerte " + name + " est « " + state + " » (actuellement « " + st + " »)");
  }
};
