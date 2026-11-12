/* Cours « API et tests » (étape 5 bis, US-6b #68). FastAPI, Pydantic et pytest tournent dans Pyodide ; le client de test
   et le lancement de pytest passent par le harnais commun (public/assets/py/harness.py), identique en CI. */
import web from "./api/web.js";
import tests from "./api/tests.js";

export default {
  id: "api", route: "api", badge: "API", name: "API et tests", tag: "FastAPI · pytest", lang: "py",
  blurb: "HTTP et REST, construire une API avec FastAPI et Pydantic (validation, codes de statut, authentification), puis la tester avec pytest : fixtures, paramétrage, client de test, mocks.",
  note: "FastAPI, Pydantic et pytest tournent dans ton navigateur. Les défis de tests sont vérifiés par mutation : tes tests doivent réussir sur le bon code et échouer sur chaque version fautive glissée par le vérificateur.",
  lessons: [...web, ...tests]
};
