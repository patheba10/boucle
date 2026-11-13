/* Configuration des comptes injectée au déploiement : on publie une clé publique, jamais une clé secrète. */
import test from "node:test";
import assert from "node:assert/strict";
import { verifier, contenu } from "../../scripts/config.mjs";

const jwt = (role) => "eyJhbGciOiJIUzI1NiJ9." + Buffer.from(JSON.stringify({ role, iss: "supabase" })).toString("base64url") + ".signature";

test("sans variables : comptes désactivés", () => {
  assert.equal(verifier("", ""), null);
  assert.match(contenu(null), /SUPABASE_URL = "";/);
});

test("clé anon ou publishable acceptée", () => {
  assert.deepEqual(verifier("https://abcd1234.supabase.co", jwt("anon")), { url: "https://abcd1234.supabase.co", cle: jwt("anon") });
  assert.ok(verifier("https://abcd1234.supabase.co", "sb_publishable_AbC123_x"));
  assert.match(contenu(verifier("https://abcd1234.supabase.co", "sb_publishable_AbC123_x")), /export const SUPABASE_ANON_KEY = "sb_publishable_AbC123_x";/);
});

test("clé secrète, rôle service_role ou adresse douteuse refusés", () => {
  assert.throws(() => verifier("https://abcd1234.supabase.co", jwt("service_role")), /service_role/);
  assert.throws(() => verifier("https://abcd1234.supabase.co", "sb_secret_xyz"), /secrète/);
  assert.throws(() => verifier("http://abcd1234.supabase.co", jwt("anon")), /SUPABASE_URL/);
  assert.throws(() => verifier("https://evil.example/x", jwt("anon")), /SUPABASE_URL/);
  assert.throws(() => verifier("https://abcd1234.supabase.co", "n'importe quoi"), /SUPABASE_ANON_KEY/);
});
