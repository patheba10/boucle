/* Syntaxe de tout le JavaScript du site : une erreur de guillemets dans une vue casse toute l'application (vu au
   sprint 9.4), et seuls les tests de bout en bout la voyaient. node --check la signale en une seconde. */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = fileURLToPath(new URL("../../public", import.meta.url));
function fichiers(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === "vendor" ? [] : fichiers(p);
    return p.endsWith(".js") ? [p] : [];
  });
}

test("tout le JavaScript de public/ est syntaxiquement valide", () => {
  const liste = fichiers(RACINE);
  assert.ok(liste.length > 30);
  const erreurs = liste.map((f) => [f, spawnSync(process.execPath, ["--check", f], { encoding: "utf8" })]).filter(([, r]) => r.status !== 0);
  assert.deepEqual(erreurs.map(([f, r]) => f + " : " + r.stderr.split("\n").slice(0, 4).join(" ")), []);
});
