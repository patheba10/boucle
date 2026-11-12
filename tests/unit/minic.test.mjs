/* minic : l'interpréteur C du navigateur. Parité avec gcc sur des programmes qui couvrent le langage (types à largeur
   fixe, débordements, promotions, pointeurs, structures, unions, pointeurs de fonction, printf) et le microcontrôleur
   simulé de mcu.h ; messages d'erreur en français avec la ligne. */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { cProgram } from "../../public/assets/js/lib/engines.js";

const RUNNER = fileURLToPath(new URL("../../scripts/run_py.py", import.meta.url));
const MCU = fileURLToPath(new URL("../../public/assets/py", import.meta.url));
const C_DIR = fileURLToPath(new URL("./c", import.meta.url));
const minic = (code) => JSON.parse(spawnSync("python3", [RUNNER], { input: JSON.stringify({ code: cProgram(code), stdin: "" }), encoding: "utf8" }).stdout);

function gcc(fichier) {
  const dir = mkdtempSync(join(tmpdir(), "minic-"));
  try {
    const bin = join(dir, "a.out");
    const c = spawnSync("gcc", ["-std=c11", "-O0", "-fwrapv", "-w", "-I", MCU, fichier, "-o", bin, "-lm"], { encoding: "utf8" });
    assert.equal(c.status, 0, c.stderr);
    return spawnSync(bin, { encoding: "utf8" }).stdout;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

for (const nom of ["langage", "memoire", "mcu"]) {
  test("même sortie que gcc : " + nom + ".c", () => {
    const fichier = join(C_DIR, nom + ".c");
    const attendu = gcc(fichier);
    const r = minic(readFileSync(fichier, "utf8"));
    assert.equal(r.err, null);
    assert.ok(attendu.length > 20);
    assert.equal(r.out, attendu);
  });
}

test("erreurs d'exécution et de compilation : message en français et numéro de ligne", () => {
  const cas = [
    ["int main(void) { int *p = 0;\n  *p = 3;\n  return 0; }", /^ErreurC: ligne 2 : déréférencement d'un pointeur NULL/],
    ["int main(void) { int a = 0;\n  return 5 / a; }", /^ErreurC: ligne 2 : division par zéro/],
    ["int main(void) {\n  x = 3;\n  return 0; }", /^ErreurC: ligne 2 : « x » n'est pas déclaré/],
    ["int main(void) { int a = 3\n  return a; }", /^ErreurC: ligne 2 : erreur de syntaxe/],
    ["int main(void) { while (1) { }\n  return 0; }", /^ErreurC: ligne 1 : trop d'étapes/],
    ["int f(void) { return 1; }", /pas de fonction main/],
    ["int main(void) { return g(2); }", /fonction « g » non déclarée/],
    ["#include <stdio.h>\nint main(void) { printf(\"%d %d\\n\", 1); return 0; }", /il manque des arguments/],
    ["#include <stdint.h>\nint main(void) { uint32_t x = 1; int n = 32; x = x << n; return (int)x; }", /décalage de 32 bits/],
    ["struct S { unsigned a : 3; };\nint main(void) { return 0; }", /champs de bits/]
  ];
  for (const [code, rx] of cas) {
    const r = minic(code);
    assert.match(String(r.err), rx, code);
  }
});

test("la sortie produite avant une erreur est conservée", () => {
  const r = minic('#include <stdio.h>\nint main(void) { int t[2] = {1, 2}; printf("avant\\n"); int *p = t + 1000000000; return *p; }');
  assert.equal(r.out, "avant\n");
  assert.match(r.err, /hors limites/);
});

test("préprocesseur : macros à paramètres, #if, #ifdef, stringification", () => {
  const r = minic(`#include <stdio.h>
#define CARRE(x) ((x) * (x))
#define NOM(x) #x
#define VERSION 3
int main(void) {
#if VERSION >= 2 && defined(VERSION)
    printf("%d %s\\n", CARRE(2 + 1), NOM(registre));
#else
    printf("ancien\\n");
#endif
#ifdef ABSENT
    printf("non\\n");
#endif
    return 0;
}`);
  assert.equal(r.err, null);
  assert.equal(r.out, "9 registre\n");
});
