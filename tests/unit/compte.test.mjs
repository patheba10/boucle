/* Comptes : messages d'erreur en français, vérification des formulaires, nom affiché. compte.js importe
   config.js (vide en dépôt) : les comptes y sont désactivés. */
import test from "node:test";
import assert from "node:assert/strict";
import { actif, messageErreur, verifierFormulaire, nomAffiche } from "../../public/assets/js/lib/compte.js";

test("config.js du dépôt : comptes désactivés", () => {
  assert.equal(actif(), false);
});

test("erreurs Supabase traduites, par code puis par message", () => {
  assert.equal(messageErreur({ code: "invalid_credentials", message: "Invalid login credentials" }), "Adresse e-mail ou mot de passe incorrect.");
  assert.match(messageErreur({ message: "User already registered" }), /existe déjà/);
  assert.match(messageErreur({ code: "weak_password" }), /10 caractères/);
  assert.match(messageErreur(new TypeError("Failed to fetch")), /joindre le serveur/);
  assert.equal(messageErreur({ message: "boum" }), "Erreur : boum");
  assert.equal(messageErreur(null), "");
});

test("formulaires vérifiés avant l'envoi", () => {
  assert.equal(verifierFormulaire({ email: "ada@exemple.org", motDePasse: "x" }), "");
  assert.match(verifierFormulaire({ email: "ada@", motDePasse: "x" }), /e-mail invalide/);
  assert.match(verifierFormulaire({ email: "ada@exemple.org", motDePasse: "" }), /Saisis/);
  assert.match(verifierFormulaire({ email: "ada@exemple.org", motDePasse: "courtcourt", inscription: true }), /10 caractères/);
  assert.equal(verifierFormulaire({ email: "ada@exemple.org", motDePasse: "analytique1", inscription: true }), "");
  assert.match(verifierFormulaire({ email: "ada@exemple.org", motDePasse: "analytique1", confirmation: "analytique2" }), /identiques/);
  assert.equal(verifierFormulaire({ email: "ada@exemple.org" }), "");
});

test("nom affiché : profil, puis fournisseur, puis adresse", () => {
  assert.equal(nomAffiche({ email: "a@b.c" }, { nom: "Ada" }), "Ada");
  assert.equal(nomAffiche({ email: "a@b.c", user_metadata: { user_name: "ada-l" } }, null), "ada-l");
  assert.equal(nomAffiche({ email: "linus@b.c" }, { nom: null }), "linus");
  assert.equal(nomAffiche(null, null), "");
});
