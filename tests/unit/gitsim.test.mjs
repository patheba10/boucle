/* Tests unitaires du simulateur Git (node --test). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSim, runScript, evaluate, snapshot } from "../../public/assets/js/lib/gitsim.js";

/** Exécute des lignes et échoue si l'une échoue, sauf si elle est préfixée par « ! » (échec attendu). */
function sh(sim, ...lines) {
  let last;
  for (const raw of lines) {
    const expectFail = raw.startsWith("!");
    last = sim.run(expectFail ? raw.slice(1) : raw);
    assert.equal(last.ok, !expectFail, (expectFail ? "devait échouer : " : "a échoué : ") + raw + "\n" + last.out);
  }
  return last ? last.out : "";
}
const ok = (sim, checks) => evaluate(sim, checks).forEach((c) => assert.ok(c.ok, "critère non rempli : " + c.label));
const ko = (sim, checks) => assert.ok(evaluate(sim, checks).some((c) => !c.ok), "au moins un critère aurait dû échouer");
const base = () => { const s = createSim(); sh(s, "git init", 'echo "v1" > app.py', "git add .", 'git commit -m "init"'); return s; };

test("init, add, commit, status", () => {
  const s = createSim();
  assert.match(sh(s, "!git status"), /not a git repository/);
  assert.match(sh(s, "git init"), /Initialized empty Git repository/);
  sh(s, 'echo "# Projet" > README.md');
  assert.match(sh(s, "git status"), /No commits yet[\s\S]*Untracked files:[\s\S]*README\.md/);
  sh(s, "git add README.md");
  assert.match(sh(s, "git status"), /Changes to be committed:[\s\S]*new file:\s+README\.md/);
  assert.match(sh(s, 'git commit -m "docs: README"'), /^\[main \(root-commit\) [0-9a-f]{7}\] docs: README\n 1 file changed, 1 insertion\(\+\)$/);
  assert.match(sh(s, "git status"), /nothing to commit, working tree clean/);
  assert.match(sh(s, '!git commit -m "vide"'), /nothing to commit/);
  ok(s, { initialized: true, branch: "main", commits: 1, headMessage: "docs: README", clean: true, committed: { "README.md": "# Projet" } });
});

test("modifications, diff, restore et commit -a", () => {
  const s = base();
  sh(s, 'echo "v2" >> app.py');
  assert.match(sh(s, "git status"), /Changes not staged for commit:[\s\S]*modified:\s+app\.py/);
  assert.match(sh(s, "git diff"), /--- a\/app\.py\n\+\+\+ b\/app\.py[\s\S]* v1\n\+v2/);
  sh(s, "git add app.py");
  assert.equal(sh(s, "git diff"), "");
  assert.match(sh(s, "git diff --staged"), /\+v2/);
  sh(s, "git restore --staged app.py");
  ok(s, { staged: [] });
  sh(s, "git restore app.py");
  ok(s, { clean: true, files: { "app.py": "v1" } });
  sh(s, 'echo "v3" > app.py', 'git commit -am "v3"');
  ok(s, { commits: 2, committed: { "app.py": "v3" } });
});

test(".gitignore filtre les fichiers non suivis et git add", () => {
  const s = base();
  sh(s, 'echo ".venv/" > .gitignore', 'echo "*.log" >> .gitignore', 'echo "x" > debug.log', 'echo "y" > .venv/lib.py', 'echo "z" > notes.txt');
  const st = sh(s, "git status");
  assert.match(st, /\.gitignore/); assert.match(st, /notes\.txt/);
  assert.doesNotMatch(st, /debug\.log|\.venv/);
  assert.match(sh(s, "!git add debug.log"), /ignored by one of your \.gitignore files/);
  sh(s, "git add .");
  ok(s, { staged: [".gitignore", "notes.txt"], untracked: [] });
});

test("hachages déterministes", () => {
  const a = base(), b = base();
  assert.equal(sh(a, "git log --oneline"), sh(b, "git log --oneline"));
  assert.match(sh(a, "git log --oneline"), /^[0-9a-f]{7} \(HEAD -> main\) init$/);
});

test("branches, switch et fusion fast-forward", () => {
  const s = base();
  sh(s, "git switch -c feature", 'echo "def f(): pass" > feature.py', "git add .", 'git commit -m "feat: f"');
  ok(s, { branch: "feature", branches: ["feature", "main"] });
  assert.match(sh(s, "git switch main"), /Switched to branch 'main'/);
  ok(s, { files: { "feature.py": null } });
  assert.match(sh(s, "git merge feature"), /Fast-forward/);
  ok(s, { commits: 2, mergeCommit: false, files: { "feature.py": "def f(): pass" } });
  assert.match(sh(s, "git branch -d feature"), /Deleted branch feature/);
});

test("fusion à trois voies sans conflit puis branche non fusionnée", () => {
  const s = base();
  sh(s, "git switch -c feature", 'echo "a" > a.txt', "git add .", 'git commit -m "a"', "git switch main", 'echo "b" > b.txt', "git add .", 'git commit -m "b"');
  assert.match(sh(s, "git merge feature"), /Merge made by the 'ort' strategy/);
  ok(s, { mergeCommit: true, headMessage: "Merge branch 'feature'", files: { "a.txt": "a", "b.txt": "b" }, clean: true });
  sh(s, "git switch -c tmp", 'echo "t" > t.txt', "git add .", 'git commit -m "t"', "git switch main");
  assert.match(sh(s, "!git branch -d tmp"), /not fully merged/);
});

test("conflit de fusion, résolution et --abort", () => {
  const mk = () => {
    const s = base();
    sh(s, "git switch -c feature", 'echo "feature" > app.py', 'git commit -am "f"', "git switch main", 'echo "main" > app.py', 'git commit -am "m"');
    return s;
  };
  const s = mk();
  const r = s.run("git merge feature");
  assert.equal(r.ok, false); // comme le vrai Git : code de sortie 1 en cas de conflit
  assert.match(r.out, /CONFLICT \(content\): Merge conflict in app\.py/);
  assert.match(sh(s, "cat app.py"), /<<<<<<< HEAD\nmain\n=======\nfeature\n>>>>>>> feature/);
  assert.match(sh(s, "git status"), /Unmerged paths:[\s\S]*both modified:\s+app\.py/);
  assert.match(sh(s, '!git commit -m "x"'), /unmerged files/);
  ko(s, { noConflict: true });
  sh(s, 'echo "main et feature" > app.py', "git add app.py", "git commit");
  ok(s, { noConflict: true, mergeCommit: true, committed: { "app.py": "main et feature" }, clean: true });
  const t = mk(); t.run("git merge feature"); sh(t, "git merge --abort");
  ok(t, { clean: true, files: { "app.py": "main" }, mergeCommit: false });
});

test("rebase linéaire, puis rebase avec conflit et --continue", () => {
  const s = base();
  sh(s, "git switch -c feature", 'echo "f" > f.txt', "git add .", 'git commit -m "feat"', "git switch main", 'echo "m" > m.txt', "git add .", 'git commit -m "main"', "git switch feature");
  assert.match(sh(s, "git rebase main"), /Successfully rebased/);
  ok(s, { linear: true, messages: ["feat", "main", "init"], files: { "m.txt": "m", "f.txt": "f" } });
  const c = base();
  sh(c, "git switch -c feature", 'echo "F" > app.py', 'git commit -am "feat"', "git switch main", 'echo "M" > app.py', 'git commit -am "main"', "git switch feature");
  const r = c.run("git rebase main");
  assert.match(r.out, /could not apply [0-9a-f]{7}\.\.\. feat/);
  assert.match(sh(c, "!git rebase --continue"), /edit all merge conflicts/);
  sh(c, 'echo "M+F" > app.py', "git add app.py");
  assert.match(sh(c, "git rebase --continue"), /Successfully rebased/);
  ok(c, { branch: "feature", linear: true, messages: ["feat", "main", "init"], committed: { "app.py": "M+F" } });
});

test("reset --soft, --mixed et --hard", () => {
  const mk = () => { const s = base(); sh(s, 'echo "v2" > app.py', 'git commit -am "v2"'); return s; };
  let s = mk(); sh(s, "git reset --soft HEAD~1"); ok(s, { commits: 1, staged: ["app.py"], files: { "app.py": "v2" } });
  s = mk(); assert.match(sh(s, "git reset HEAD~1"), /Unstaged changes after reset:\nM\tapp\.py/); ok(s, { commits: 1, staged: [], files: { "app.py": "v2" } });
  s = mk(); assert.match(sh(s, "git reset --hard HEAD~1"), /HEAD is now at [0-9a-f]{7} init/); ok(s, { commits: 1, clean: true, files: { "app.py": "v1" }, lacksMessages: ["v2"] });
});

test("revert, cherry-pick et amend", () => {
  const s = base();
  sh(s, 'echo "bug" > app.py', 'git commit -am "bug"');
  assert.match(sh(s, "git revert HEAD"), /\[main [0-9a-f]{7}\] Revert "bug"/);
  ok(s, { commits: 3, files: { "app.py": "v1" }, hasMessages: ["bug", 'Revert "bug"'] });
  sh(s, "git switch -c dev", 'echo "fix" > fix.txt', "git add .", 'git commit -m "fix: correctif"', 'echo "wip" > wip.txt', "git add .", 'git commit -m "wip"', "git switch main");
  const id = sh(s, "git log --oneline dev").split("\n")[1].slice(0, 7);
  sh(s, "git cherry-pick " + id);
  ok(s, { headMessage: "fix: correctif", files: { "fix.txt": "fix", "wip.txt": null } });
  sh(s, 'git commit --amend -m "fix: correctif urgent"');
  ok(s, { headMessage: "fix: correctif urgent", commits: 4 });
});

test("stash push, list et pop", () => {
  const s = base();
  sh(s, 'echo "wip" >> app.py');
  assert.match(sh(s, "git stash"), /Saved working directory and index state WIP on main/);
  ok(s, { clean: true, stash: 1, files: { "app.py": "v1" } });
  assert.match(sh(s, "git stash list"), /^stash@\{0\}: WIP on main/);
  sh(s, "git stash pop");
  ok(s, { stash: 0, files: { "app.py": "v1\nwip" } });
});

test("tags", () => {
  const s = base();
  sh(s, "git tag v1.0.0", 'echo "v2" > app.py', 'git commit -am "v2"', 'git tag -a v1.1.0 -m "version 1.1"');
  assert.equal(sh(s, "git tag"), "v1.0.0\nv1.1.0");
  ok(s, { tags: { "v1.0.0": "init", "v1.1.0": "v2" } });
  assert.match(sh(s, "git log --oneline"), /\(HEAD -> main, tag: v1\.1\.0\) v2/);
});

test("remote : push -u, collègue, push rejeté, pull puis push", () => {
  const s = base();
  assert.match(sh(s, "!git push"), /No configured push destination/);
  sh(s, "git remote add origin https://github.com/eleve/projet.git");
  assert.match(sh(s, "!git push"), /has no upstream branch/);
  assert.match(sh(s, "git push -u origin main"), /\* \[new branch\]\s+main -> main[\s\S]*set up to track 'origin\/main'/);
  ok(s, { pushed: "main", upstream: { main: "origin/main" } });
  sh(s, '@origin echo "collègue" > equipe.txt', "@origin git add .", '@origin git commit -m "docs: equipe"');
  sh(s, 'echo "local" > local.txt', "git add .", 'git commit -m "feat: local"');
  assert.match(sh(s, "!git push"), /\[rejected\][\s\S]*fetch first/);
  assert.match(sh(s, "git pull"), /Merge made by the 'ort' strategy/);
  ok(s, { hasMessages: ["docs: equipe", "feat: local"], files: { "equipe.txt": "collègue" } });
  sh(s, "git push");
  ok(s, { pushed: "main" });
  assert.match(sh(s, "git status"), /up to date with 'origin\/main'/);
});

test("pull en avance rapide et branche distante", () => {
  const s = base();
  sh(s, "git remote add origin https://github.com/eleve/projet.git", "git push -u origin main");
  sh(s, "@origin git switch -c review", '@origin echo "r" > r.txt', "@origin git add .", '@origin git commit -m "review"', "@origin git switch main", '@origin echo "n" > n.txt', "@origin git add .", '@origin git commit -m "news"');
  assert.match(sh(s, "git status"), /up to date/);
  assert.match(sh(s, "git pull"), /Fast-forward/);
  ok(s, { headMessage: "news", mergeCommit: false });
  assert.match(sh(s, "git switch review"), /Switched to branch 'review'/);
  ok(s, { branch: "review", files: { "r.txt": "r" } });
});

test("switch refuse d'écraser des modifications", () => {
  const s = base();
  sh(s, "git switch -c f", 'echo "f" > app.py', 'git commit -am "f"', "git switch main", 'echo "local" > app.py');
  assert.match(sh(s, "!git switch f"), /would be overwritten by checkout/);
});

test("runScript, evaluate et snapshot", () => {
  const { sim, transcript } = runScript(["git init", 'echo "a" > a.txt'], ["git add a.txt", 'git commit -m "a"', "git switch -c f"]);
  assert.equal(transcript.length, 3);
  assert.ok(transcript.every((t) => t.ok));
  const snap = snapshot(sim);
  assert.equal(snap.commits.length, 1);
  assert.deepEqual(snap.commits[0].refs.map((r) => r.label).sort(), ["f", "main"]);
  assert.equal(snap.branch, "f");
  assert.throws(() => evaluate(sim, { inconnu: 1 }), /critère de vérification inconnu/);
  assert.throws(() => runScript(["git commit -m x"], []), /mise en place invalide/);
});
