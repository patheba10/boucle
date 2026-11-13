/* Liste des fichiers que le service worker (public/sw.js) met en cache à l'installation, pour que Boucle
   s'ouvre sans réseau. La liste et une empreinte du contenu sont écrites dans sw.js, entre deux marqueurs :
   tout changement d'un fichier change l'empreinte, donc sw.js, donc le navigateur installe la nouvelle version.
     node scripts/precache.mjs           réécrit la liste
     node scripts/precache.mjs --check   échoue si la liste est périmée (test unitaire, CI) */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const PUBLIC = fileURLToPath(new URL("../public/", import.meta.url));
const SW = join(PUBLIC, "sw.js");
const EXCLUS = new Set(["sw.js", "datasets/README.md"]);

function fichiers(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? fichiers(p) : [relative(PUBLIC, p).split(sep).join("/")];
  });
}

export function bloc() {
  const liste = fichiers(PUBLIC).filter((f) => !EXCLUS.has(f) && !f.split("/").some((p) => p.startsWith("."))).sort();
  const h = createHash("sha256");
  for (const f of liste) h.update(f + "\0").update(readFileSync(join(PUBLIC, f)));
  const files = ["./", ...liste.filter((f) => f !== "index.html"), "index.html"];
  return "// <precache> généré par scripts/precache.mjs, ne pas modifier à la main\n" +
    'const VERSION = "' + h.digest("hex").slice(0, 12) + '";\n' +
    "const PRECACHE = " + JSON.stringify(files, null, 1).replace(/\n /g, "\n  ") + ";\n" +
    "// </precache>";
}

export function aJour() {
  const sw = readFileSync(SW, "utf8");
  return sw.includes(bloc());
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const sw = readFileSync(SW, "utf8");
  const nouveau = sw.replace(/\/\/ <precache>[\s\S]*?\/\/ <\/precache>/, bloc());
  if (process.argv.includes("--check")) {
    if (nouveau !== sw) { console.error("public/sw.js : liste de précache périmée. Lancer : npm run precache"); process.exit(1); }
    console.log("public/sw.js : liste de précache à jour.");
  } else {
    writeFileSync(SW, nouveau);
    console.log("public/sw.js : " + (nouveau.match(/"\S+"/g) || []).length + " fichiers en précache.");
  }
}
