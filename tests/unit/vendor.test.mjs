/* Fichiers tiers servis par le site (public/assets/js/vendor) : chacun doit être identique, octet pour octet, au
   fichier du paquet npm installé par npm ci, dont package-lock.json garantit l'intégrité. */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";

const sha256 = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const VENDOR = new URL("../../public/assets/js/vendor/", import.meta.url);
const SOURCES = {
  "JSCPP-2.0.6.es5.min.js": ["JSCPP", "2.0.6", "dist/JSCPP.es5.min.js"],
  "js-yaml.mjs": ["js-yaml", "4.3.2", "dist/js-yaml.mjs"],
  "supabase-2.118.0.js": ["@supabase/supabase-js", "2.118.0", "dist/umd/supabase.js"]
};

test("chaque fichier de vendor/ a une source connue", () => {
  for (const f of readdirSync(VENDOR)) assert.ok(SOURCES[f], f + " : source inconnue, l'ajouter à SOURCES");
});

for (const [fichier, [paquet, version, chemin]] of Object.entries(SOURCES)) {
  test(fichier + " est la copie exacte de " + paquet + "@" + version, () => {
    const dossier = new URL("../../node_modules/" + paquet + "/", import.meta.url);
    assert.equal(JSON.parse(readFileSync(new URL("package.json", dossier), "utf8")).version, version);
    assert.equal(sha256(new URL(fichier, VENDOR)), sha256(new URL(chemin, dossier)));
  });
}
