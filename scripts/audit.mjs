/* Audit des dépendances (job « Audit des dépendances » de la CI) : npm audit et pip-audit sur les trois fichiers
   requirements. Échoue sur toute faille connue, sauf les exceptions ci-dessous, chacune justifiée (voir SECURITY.md).
   Une exception devenue inutile est signalée, pour être retirée. */
import { spawnSync } from "node:child_process";

const EXCEPTIONS_NPM = {
  // printf < 0.6.1 (ReDoS), embarqué dans JSCPP 2.0.6. Seul le programme de l'élève fournit les formats, dans son
  // propre worker, arrêté au bout de 6 s : il ne peut ralentir que lui-même. JSCPP 2.0.9 n'a plus de version navigateur.
  "GHSA-xfhp-gmh8-r8v2": "printf (JSCPP 2.0.6) : déni de service sur soi-même seulement"
};
const EXCEPTIONS_PIP = {
  // Versions de Pyodide 0.29.5 (requirements.txt), utilisées seulement pour valider les exercices dans un runner
  // jetable : failles de serveur web (starlette, anyio) ou de machine partagée (pytest). À lever avec Pyodide.
  "PYSEC-2026-1942": "starlette", "PYSEC-2026-161": "starlette", "PYSEC-2026-2281": "starlette", "PYSEC-2026-2280": "starlette",
  "PYSEC-2026-249": "starlette", "PYSEC-2026-248": "starlette", "PYSEC-2026-4025": "anyio", "PYSEC-2026-4024": "anyio",
  "PYSEC-2026-1845": "pytest"
};

let echec = false;
const vus = new Set();

// npm
const npm = spawnSync("npm", ["audit", "--json"], { encoding: "utf8" });
const rapport = JSON.parse(npm.stdout || "{}");
for (const [nom, v] of Object.entries(rapport.vulnerabilities || {})) {
  for (const via of v.via || []) {
    if (typeof via !== "object") continue;
    const id = (via.url || "").split("/").pop();
    if (EXCEPTIONS_NPM[id]) { vus.add(id); continue; }
    echec = true;
    console.error("npm : " + nom + " " + via.range + " " + via.severity + " " + via.url + " " + via.title);
  }
}

// pip
for (const f of ["requirements.txt", "requirements-dev.txt", "requirements-tf.txt"]) {
  const r = spawnSync("pip-audit", ["--no-deps", "--disable-pip", "--progress-spinner", "off", "--format", "json", "-r", f], { encoding: "utf8" });
  if (r.error || !r.stdout) { console.error("pip-audit indisponible ou en échec sur " + f + " : " + (r.error || r.stderr)); echec = true; continue; }
  for (const dep of JSON.parse(r.stdout).dependencies || []) {
    for (const vuln of dep.vulns || []) {
      const ids = [vuln.id, ...(vuln.aliases || [])];
      const connu = ids.find((i) => EXCEPTIONS_PIP[i]);
      if (connu) { vus.add(connu); continue; }
      echec = true;
      console.error(f + " : " + dep.name + " " + dep.version + " " + vuln.id + " (corrigé en " + (vuln.fix_versions || []).join(", ") + ")");
    }
  }
}

const inutiles = [...Object.keys(EXCEPTIONS_NPM), ...Object.keys(EXCEPTIONS_PIP)].filter((id) => !vus.has(id));
if (inutiles.length) console.log("Exceptions devenues inutiles, à retirer de scripts/audit.mjs : " + inutiles.join(", "));
console.log(echec ? "Audit : failles non traitées (voir ci-dessus)." : "Audit : aucune faille non traitée (" + vus.size + " exceptions justifiées).");
process.exit(echec ? 1 : 0);
