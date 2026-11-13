/* La liste de précache du service worker doit suivre les fichiers du site (sinon : npm run precache). */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { aJour, bloc } from "../../scripts/precache.mjs";

test("public/sw.js contient la liste de précache à jour", () => {
  assert.ok(aJour(), "liste périmée : lancer npm run precache");
});

test("la liste couvre la page, les modules, le contenu et le manifeste, sans sw.js ni fichier caché", () => {
  const liste = JSON.parse(bloc().match(/const PRECACHE = (\[[\s\S]*?\]);/)[1]);
  for (const f of ["./", "index.html", "manifest.webmanifest", "assets/js/main.js", "assets/js/workers/python-worker.js", "assets/py/harness.py", "content/index.js"]) assert.ok(liste.includes(f), f);
  assert.ok(!liste.includes("sw.js"));
  assert.ok(liste.every((f) => !f.split("/").some((p) => p.startsWith(".") && p !== ".")));
});

test("le manifeste déclare un nom, une page de départ, l'affichage autonome et des icônes 192 et 512", () => {
  const m = JSON.parse(readFileSync(new URL("../../public/manifest.webmanifest", import.meta.url), "utf8"));
  assert.equal(m.display, "standalone");
  assert.ok(m.name && m.short_name && m.start_url);
  for (const t of ["192x192", "512x512"]) assert.ok(m.icons.some((i) => i.sizes === t && i.type === "image/png"), t);
  assert.ok(m.icons.some((i) => i.purpose === "maskable"));
});
