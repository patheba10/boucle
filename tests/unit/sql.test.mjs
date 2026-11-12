/* Défis SQL : programme Python généré, exécuté avec CPython (comme npm run validate ; Pyodide en CI e2e). */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { sqlRunProgram, sqlCheckProgram, parseSqlCheck, sqlTip } from "../../public/assets/js/lib/sql.js";

const RUNNER = fileURLToPath(new URL("../../scripts/run_py.py", import.meta.url));
const py = (code) => JSON.parse(spawnSync("python3", [RUNNER], { input: JSON.stringify({ code, stdin: "" }), encoding: "utf8" }).stdout);
const DB = "CREATE TABLE t (id INTEGER PRIMARY KEY, nom TEXT, n REAL);\nINSERT INTO t VALUES (1, 'a;b', 2.5), (2, 'c', NULL), (3, 'd', 1);";
const verdict = (ch, code) => parseSqlCheck(py(sqlCheckProgram(ch, DB, code)).out).verdict;

test("exécution : découpage des instructions, tableaux, lignes modifiées, NULL", () => {
  const r = py(sqlRunProgram(DB, "-- commentaire\nSELECT nom FROM t WHERE nom = 'a;b';\nUPDATE t SET n = 0 WHERE id > 1;\nSELECT id, n FROM t ORDER BY id"));
  assert.equal(r.err, null);
  assert.match(r.out, /^nom\n---\na;b\n\(1 ligne\)\n\n\(2 lignes modifiées\)\n\nid \| n\n---\+----\n1  \| 2\.5\n2  \| 0\.0\n3  \| 0\.0\n\(3 lignes\)/);
  assert.match(py(sqlRunProgram(DB, "SELECT * FROM t WHERE id > 9;")).out, /\(aucune ligne\)/);
});

test("erreurs : message de SQLite avec le numéro d'instruction, et conseil", () => {
  const r = py(sqlRunProgram(DB, "SELECT 1;\nSELECT nom FROM u;"));
  assert.equal(r.err, "ErreurSQL: instruction 2 : no such table: u");
  assert.match(sqlTip(r.err), /Table inconnue/);
  assert.match(sqlTip(py(sqlRunProgram(DB, "SELECT nom FROM t WHERE COUNT(*) > 1;")).err), /HAVING/);
});

test("vérification : ordre exigé avec ORDER BY, colonnes, valeurs numériques normalisées", () => {
  const ordered = { solution: "SELECT id FROM t ORDER BY id DESC;" };
  assert.equal(verdict(ordered, "SELECT id FROM t ORDER BY id DESC;").ok, true);
  const v = verdict(ordered, "SELECT id FROM t ORDER BY id;");
  assert.equal(v.ok, false); assert.match(v.note, /pas dans le bon ordre/);
  assert.equal(verdict({ solution: "SELECT id FROM t;" }, "SELECT id FROM t ORDER BY id DESC;").ok, true);
  assert.match(verdict({ solution: "SELECT id, nom FROM t;" }, "SELECT id FROM t;").note, /Attendu 2 colonnes, obtenu 1/);
  assert.match(verdict({ solution: "SELECT id AS ident FROM t;", columns: true }, "SELECT id FROM t;").note, /ident/);
  assert.equal(verdict({ solution: "SELECT 2 AS x;" }, "SELECT 2.0 AS x;").ok, true);
  assert.match(verdict({ solution: "SELECT id FROM t;" }, "UPDATE t SET n = 1;").note, /ne renvoie pas de lignes/);
});

test("vérification par requête de contrôle pour un exercice qui modifie les données", () => {
  const ch = { solution: "UPDATE t SET n = 9 WHERE id = 2;", check: "SELECT id, n FROM t ORDER BY id" };
  assert.equal(verdict(ch, "BEGIN; UPDATE t SET n = 9 WHERE nom = 'c'; COMMIT;").ok, true);
  assert.equal(verdict(ch, "BEGIN; UPDATE t SET n = 9 WHERE nom = 'c'; ROLLBACK;").ok, false);
  assert.equal(verdict(ch, "UPDATE t SET n = 9;").ok, false);
});
