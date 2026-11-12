/* Moteur des exercices GitHub Actions : lecture, lint, simulation, critères. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lint, plan, evaluate, parseExpr, evalExpr, globMatch, locate, parse } from "../../public/assets/js/lib/workflow.js";

const CI = `name: CI
on:
  push:
    branches: [main]
    tags: ["v*"]
  pull_request:
    branches: [main]
permissions:
  contents: read
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: ruff check .
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ["3.12", "3.13"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: \${{ matrix.python-version }}
      - run: pytest
      - name: Garder les logs
        if: failure()
        run: cat pytest.log
  deploy:
    needs: [lint, test]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - run: ./deploy.sh
`;
const errors = (t) => lint(t).issues.filter((i) => i.level === "error");
const msgs = (t) => lint(t).issues.map((i) => i.line + " " + i.msg).join("\n");
const status = (p) => Object.fromEntries(p.jobs.map((j) => [j.id, j.status]));

test("js-yaml copié dans le dépôt = version npm épinglée", () => {
  const a = readFileSync(new URL("../../public/assets/js/vendor/js-yaml.mjs", import.meta.url), "utf8");
  const b = readFileSync(new URL("../../node_modules/js-yaml/dist/js-yaml.mjs", import.meta.url), "utf8");
  assert.equal(a, b);
});

test("un workflow correct ne lève aucune erreur", () => {
  assert.deepEqual(errors(CI), [], msgs(CI));
});

test("erreurs YAML traduites, avec la ligne", () => {
  const p = parse("on: push\njobs:\n\ttest: {}");
  assert.equal(p.ok, false);
  assert.equal(p.error.line, 3);
  assert.match(p.error.msg, /tabulation/);
  assert.match(parse("a: 1\na: 2").error.msg, /clé en double/);
});

test("structure : runs-on, needs, cycles, uses sans version, clés inconnues", () => {
  const t = `on: push
jobs:
  build:
    steps:
      - uses: actions/checkout
  test:
    needs: deploi
    runs-on: ubuntu-latest
    step:
      - run: pytest
  a:
    needs: b
    runs-on: ubuntu-latest
    steps: [{run: x}]
  b:
    needs: a
    runs-on: ubuntu-latest
    steps: [{run: x}]
`;
  const m = msgs(t);
  assert.match(m, /^3 .*n'a pas de « runs-on »/m);
  assert.match(m, /^5 Il manque la version/m);
  assert.match(m, /^7 « needs » cite un job qui n'existe pas : « deploi »/m);
  assert.match(m, /^9 Clé inconnue dans le job « test » : « step ».* « steps »/m);
  assert.match(m, /circulaires/);
});

test("événements, filtres et permissions mal écrits", () => {
  const t = `on:
  pull-request:
  push:
    branch: [main]
permissions:
  content: read
  issues: admin
jobs:
  j: {runs-on: ubuntu-lastest, steps: [{run: x}]}
`;
  const m = msgs(t);
  assert.match(m, /Événement inconnu : « pull-request ».*pull_request/);
  assert.match(m, /Filtre inconnu pour push : « branch ».*branches/);
  assert.match(m, /Permission inconnue : « content ».*contents/);
  assert.match(m, /Niveau de permission invalide « admin »/);
  assert.match(m, /ubuntu-latest/);
});

test("expressions : syntaxe, contextes, needs et matrix", () => {
  const t = `on: push
jobs:
  a:
    runs-on: ubuntu-latest
    if: env.DEPLOY == "oui"
    steps:
      - run: echo \${{ needs.b.result }} \${{ matrix.os }}
      - if: github.ref = 'refs/heads/main'
        run: echo \${{ gihub.sha }}
      - run: echo "\${{ github.event.pull_request.title }}"
`;
  const m = msgs(t);
  assert.match(m, /apostrophes/);
  assert.match(m, /« needs\.b » : ce job n'attend pas « b »/);
  assert.match(m, /pas de « strategy\.matrix »/);
  assert.match(m, /« == »/);
  assert.match(m, /Contexte inconnu : « gihub ».*github/);
  assert.match(m, /Risque d'injection/);
  assert.match(msgs("on: push\njobs:\n  a:\n    runs-on: ubuntu-latest\n    if: env.X == 'o'\n    steps: [{run: x}]\n"), /« env » n'existe pas encore dans le « if » d'un job/);
});

test("le piège 3.10 lu comme 3.1 est signalé", () => {
  const issues = lint(CI.replace('["3.12", "3.13"]', "[3.9, 3.10]")).issues;
  assert.ok(issues.some((i) => i.level === "warn" && /3\.10/.test(i.msg) && i.line === 20));
});

test("expressions : évaluation façon GitHub", () => {
  const ctx = { github: { ref: "refs/heads/main", event_name: "push", event: { pull_request: { labels: [{ name: "deploy" }] } } } };
  const ev = (s, st) => evalExpr(parseExpr(s), ctx, st);
  assert.equal(ev("github.ref == 'REFS/HEADS/MAIN'"), true);
  assert.equal(ev("startsWith(github.ref, 'refs/tags/')"), false);
  assert.equal(ev("github.event_name == 'push' && github.ref == 'refs/heads/main'"), true);
  assert.equal(ev("contains(github.event.pull_request.labels.*.name, 'deploy')"), true);
  assert.equal(ev("!(1 == 2) && 'oui' || 'non'"), "oui");
  assert.equal(ev("format('v{0}.{1}', 1, 2)"), "v1.2");
  assert.equal(ev("success() || failure()", { success: false, failure: true }), true);
  assert.equal(ev("'3' == 3"), true);
});

test("filtres de branches et chemins", () => {
  assert.ok(globMatch("feature/*", "feature/login"));
  assert.ok(!globMatch("feature/*", "feature/a/b"));
  assert.ok(globMatch("feature/**", "feature/a/b"));
  assert.ok(globMatch("v*", "v1.2.0"));
  assert.ok(globMatch("src/**", "src/app/main.py"));
  assert.ok(globMatch("**.py", "src/app/main.py"));
});

test("simulation : PR, push sur main, branche, tag", () => {
  const doc = lint(CI).doc;
  assert.deepEqual(status(plan(doc, { name: "pull_request", head: "feature/x", base: "main" })), { lint: "success", test: "success", deploy: "skipped" });
  assert.deepEqual(status(plan(doc, { name: "push", branch: "main" })), { lint: "success", test: "success", deploy: "success" });
  const br = plan(doc, { name: "push", branch: "feature/x" });
  assert.equal(br.triggered, false);
  assert.match(br.why, /feature\/x/);
  assert.equal(plan(doc, { name: "push", tag: "v1.0.0" }).triggered, true);
  assert.deepEqual(status(plan(doc, { name: "push", tag: "v1.0.0" })), { lint: "success", test: "success", deploy: "skipped" });
  assert.equal(plan(doc, { name: "pull_request", base: "develop" }).triggered, false);
});

test("simulation : échec, jobs sautés en cascade, étape if: failure()", () => {
  const doc = lint(CI).doc;
  const p = plan(doc, { name: "push", branch: "main" }, { fail: ["test"] });
  assert.deepEqual(status(p), { lint: "success", test: "failure", deploy: "skipped" });
  const steps = p.jobs.find((j) => j.id === "test").steps;
  assert.deepEqual(steps.map((s) => [s.label, s.ran]), [["actions/checkout@v4", true], ["actions/setup-python@v5", true], ["pytest", true], ["Garder les logs", true]]);
  assert.equal(p.jobs.find((j) => j.id === "test").matrix, 2);
  assert.equal(p.jobs.find((j) => j.id === "deploy").stage, 1);
});

test("filtres paths et pushes de tags", () => {
  const doc = lint(`on:
  push:
    branches: [main]
    paths: ["src/**", "!src/docs/**"]
jobs:
  t: {runs-on: ubuntu-latest, steps: [{run: x}]}
`).doc;
  assert.equal(plan(doc, { name: "push", branch: "main", paths: ["README.md"] }).triggered, false);
  assert.equal(plan(doc, { name: "push", branch: "main", paths: ["src/app.py"] }).triggered, true);
  assert.equal(plan(doc, { name: "push", branch: "main", paths: ["src/docs/a.md"] }).triggered, false);
  assert.equal(plan(doc, { name: "push", tag: "v1" }).triggered, false);
});

test("critères d'un défi", () => {
  const res = evaluate(CI, {
    triggers: ["push", "pull_request"], jobs: ["lint", "test", "deploy"], needs: { deploy: ["lint", "test"], lint: [] },
    uses: { test: ["actions/checkout", "actions/setup-python"] }, run: { test: ["pytest"] },
    order: { test: ["actions/checkout", "actions/setup-python", "pytest"] },
    matrix: { test: { "python-version": ["3.12", "3.13"] } }, maxPermissions: { contents: "read" }, pinned: "major",
    scenarios: [{ event: { name: "pull_request", base: "main" }, run: ["lint", "test"], skip: ["deploy"] }, { event: { name: "push", branch: "dev" }, triggered: false }],
  });
  assert.deepEqual(res.filter((r) => !r.ok), []);
  assert.equal(res[0].label, "Le fichier est un YAML valide");
  assert.equal(res.at(-2).label, "Sur une pull request de feature vers main : lint et test tournent, deploy est sauté");
  const bad = evaluate(CI.replace("contents: read", "contents: write"), { maxPermissions: { contents: "read" }, matrix: { test: { "python-version": [3.12, 3.13] } } });
  assert.deepEqual(bad.map((r) => r.ok), [true, true, false, false]);
  assert.throws(() => evaluate(CI, { inconnu: 1 }), /critère de vérification inconnu/);
  assert.deepEqual(evaluate("on: [push", { jobs: ["a"] }).map((r) => r.ok), [false, false]);
});

test("locate retrouve la ligne d'un chemin", () => {
  assert.equal(locate(CI, ["jobs", "test", "steps", 1, "with"]), 24);
  assert.equal(locate(CI, ["jobs", "deploy", "if"]), 32);
  assert.equal(locate(CI, ["on", "pull_request"]), 6);
});

test("la CI de Boucle passe notre propre lint (actions épinglées sur un SHA)", () => {
  const t = readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");
  assert.deepEqual(lint(t).issues, []);
  assert.deepEqual(evaluate(t, { pinned: "sha", maxPermissions: { contents: "read", pages: "write", "id-token": "write" } }).filter((r) => !r.ok), []);
});

test("critères : services, environnement, cache, matrice, concurrence, entrées, texte", () => {
  const t = `on:
  push:
  workflow_dispatch:
    inputs:
      version: {required: true}
jobs:
  tests:
    runs-on: \${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest]
        python: ["3.13", "3.14"]
        exclude:
          - os: windows-latest
            python: "3.13"
    services:
      postgres:
        image: postgres:17
    steps:
      - uses: actions/setup-python@v7
        with:
          python-version: \${{ matrix.python }}
          cache: pip
  deploy:
    needs: tests
    environment: {name: production, url: https://exemple.ca}
    concurrency: {group: prod, cancel-in-progress: false}
    runs-on: ubuntu-latest
    steps: [{run: "./deploy.sh \${{ inputs.version }}"}]
`;
  const res = evaluate(t, { services: { tests: ["postgres"] }, environment: { deploy: "production" }, cache: { tests: "pip" }, matrixSize: { tests: 3 }, failFast: { tests: false }, jobConcurrency: { deploy: { cancel: false } }, dispatchInputs: ["version"], contains: ["postgres:17"], lacks: ["AWS_SECRET_ACCESS_KEY"] });
  assert.deepEqual(res.filter((r) => !r.ok), []);
  const p = plan(lint(t).doc, { name: "push", branch: "main" });
  assert.equal(p.jobs.find((j) => j.id === "deploy").environment, "production");
});

test("pull_request_target qui exécute le code de la PR : avertissement", () => {
  const t = `on: pull_request_target
jobs:
  t:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          ref: \${{ github.event.pull_request.head.sha }}
      - run: npm test
`;
  assert.ok(lint(t).issues.some((i) => i.level === "warn" && /pwn request/.test(i.msg) && i.line === 8));
});
