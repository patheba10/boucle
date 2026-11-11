/* Simulateur Git pédagogique.
   JavaScript pur, sans DOM : le même code tourne dans le navigateur (terminal des leçons)
   et en CI (scripts/validate.mjs, tests/unit). Les sorties imitent le vrai Git (en anglais).

   Modèle :
   - World : magasin d'objets partagé (commits) et horloge logique (hachages et dates déterministes).
   - Repo  : copie de travail (fs), index, branches, HEAD, tags, stash, états merge/rebase/cherry-pick.
   - Un dépôt distant « origin » est un autre Repo du même World : push/fetch ne copient que des références.
*/

const HOME = "/home/eleve/projet";
const AUTHOR = "Élève <eleve@boucle.dev>";

/* ---------- Utilitaires ---------- */
function fnv(str, seed) {
  let h = (0x811c9dc5 ^ seed) >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}
const hash40 = (s) => [1, 2, 3, 4, 5].map((k) => fnv(s, k * 7919)).join("");
const short = (id) => id.slice(0, 7);
const plural = (n, word) => n + " " + word + (n > 1 ? "s" : "");
const sortedKeys = (o) => Object.keys(o).sort();
const toLines = (s) => (s === undefined || s === "" ? [] : s.replace(/\n$/, "").split("\n"));
const firstLine = (msg) => msg.split("\n")[0];
const sameTree = (a, b) => { const ka = Object.keys(a), kb = Object.keys(b); return ka.length === kb.length && ka.every((k) => k in b && a[k] === b[k]); };

function tokenize(line) {
  const out = []; let cur = ""; let q = null; let has = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === q) q = null; else if (c === "\\" && q === '"' && i + 1 < line.length && '"\\$'.includes(line[i + 1])) cur += line[++i]; else cur += c; continue; }
    if (c === '"' || c === "'") { q = c; has = true; continue; }
    if (c === " " || c === "\t") { if (has || cur) { out.push(cur); cur = ""; has = false; } continue; }
    if (c === ">") { if (has || cur) { out.push(cur); cur = ""; has = false; } if (line[i + 1] === ">") { out.push(">>"); i++; } else out.push(">"); continue; }
    cur += c;
  }
  if (q) throw new SimError("syntaxe : guillemet non fermé");
  if (has || cur) out.push(cur);
  return out;
}

class SimError extends Error {}

/* Diff ligne à ligne (plus longue sous-séquence commune) */
function diffLines(a, b) {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = []; let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push(" " + a[i]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) ops.push("-" + a[i++]);
    else ops.push("+" + b[j++]);
  }
  while (i < n) ops.push("-" + a[i++]);
  while (j < m) ops.push("+" + b[j++]);
  return ops;
}

/* ---------- .gitignore ---------- */
function ignoreRules(content) {
  return toLines(content).map((l) => l.trim()).filter((l) => l && !l.startsWith("#")).map((p) => {
    const dir = p.endsWith("/"); const pat = p.replace(/\/$/, "").replace(/^\//, "");
    const rx = new RegExp("^" + pat.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]") + "$");
    return { dir, rx };
  });
}
function isIgnored(path, rules) {
  const parts = path.split("/");
  return rules.some((r) => {
    if (r.dir) return parts.slice(0, -1).some((p) => r.rx.test(p));
    return parts.some((p) => r.rx.test(p)) || r.rx.test(path);
  });
}

/* ---------- Monde et dépôts ---------- */
class World {
  constructor() { this.objects = new Map(); this.clock = 0; this.repos = new Map(); }
  tick() { return ++this.clock; }
  commit(parents, message, tree) {
    const time = this.tick();
    const id = hash40(JSON.stringify([parents, message, tree, time]));
    this.objects.set(id, { id, parents, message, tree: { ...tree }, time, author: AUTHOR });
    return id;
  }
  get(id) { return this.objects.get(id); }
  ancestors(id) {
    const seen = new Set(); const stack = id ? [id] : [];
    while (stack.length) { const c = stack.pop(); if (seen.has(c)) continue; seen.add(c); stack.push(...this.get(c).parents); }
    return seen;
  }
  isAncestor(a, b) { return this.ancestors(b).has(a); }
  mergeBase(a, b) {
    const A = this.ancestors(a); let best = null;
    for (const c of this.ancestors(b)) if (A.has(c) && (!best || this.get(c).time > this.get(best).time)) best = c;
    return best;
  }
}

class Repo {
  constructor(world, name) {
    this.world = world; this.name = name; this.url = "https://github.com/eleve/" + name + ".git";
    this.fs = {}; this.index = {}; this.inited = false;
    this.branches = {}; this.head = { branch: "main" }; this.tags = {};
    this.stash = []; this.op = null; // { kind: "merge" | "rebase" | "cherry-pick" | "revert", ... }
    this.remotes = {}; this.remoteRefs = {}; this.upstream = {};
  }
  headId() { return this.head.branch ? this.branches[this.head.branch] || null : this.head.detached; }
  headTree() { const id = this.headId(); return id ? this.world.get(id).tree : {}; }
  ignore() { return ignoreRules(this.fs[".gitignore"]); }
  setHead(id) { if (this.head.branch) this.branches[this.head.branch] = id; else this.head.detached = id; }
  conflicts() { return this.op && this.op.conflicts ? this.op.conflicts : new Set(); }
}

/* ---------- Simulateur ---------- */
export class GitSim {
  constructor() {
    this.world = new World();
    this.repo = new Repo(this.world, "projet");
    this.world.repos.set("projet", this.repo);
  }

  origin() {
    let o = this.world.repos.get("origin");
    if (!o) { o = new Repo(this.world, "projet-origin"); o.inited = true; this.world.repos.set("origin", o); }
    return o;
  }

  /** Exécute une ligne (commandes séparées par &&). Renvoie { out, ok }. */
  run(line) {
    line = line.trim();
    if (!line || line.startsWith("#")) return { out: "", ok: true };
    let repo = this.repo;
    if (line.startsWith("@origin ")) { repo = this.origin(); line = line.slice(8); }
    const outs = [];
    for (const part of line.split(/\s+&&\s+/)) {
      try {
        const out = this.exec(repo, tokenize(part));
        if (out) outs.push(out);
      } catch (e) {
        if (e instanceof SimError) { outs.push(e.message); return { out: outs.join("\n"), ok: false }; }
        throw e;
      }
    }
    return { out: outs.join("\n"), ok: true };
  }

  exec(repo, argv) {
    const [cmd, ...args] = argv;
    switch (cmd) {
      case "git": return this.git(repo, args);
      case "echo": return shEcho(repo, args);
      case "cat": return args.map((f) => { if (!(f in repo.fs)) throw new SimError("cat: " + f + ": No such file or directory"); return repo.fs[f].replace(/\n$/, ""); }).join("\n");
      case "ls": { const all = args.includes("-a"); return sortedKeys(repo.fs).filter((f) => all || !f.startsWith(".")).join("  "); }
      case "touch": args.forEach((f) => { if (!(f in repo.fs)) repo.fs[f] = ""; }); return "";
      case "rm": args.filter((a) => !a.startsWith("-")).forEach((f) => { if (!(f in repo.fs)) throw new SimError("rm: cannot remove '" + f + "': No such file or directory"); delete repo.fs[f]; }); return "";
      case "mkdir": case "clear": case "cd": return "";
      case "pwd": return HOME;
      case "help": return HELP;
      default: throw new SimError(cmd + ": command not found");
    }
  }

  git(repo, args) {
    const [sub, ...rest] = args;
    if (!sub) return "usage: git <command> [<args>]";
    if (sub === "--version" || sub === "version") return "git version 2.47.0 (simulateur Boucle)";
    if (sub === "init") return gInit(repo);
    if (sub === "config") return "";
    if (!repo.inited) throw new SimError("fatal: not a git repository (or any of the parent directories): .git");
    const fn = GIT[sub];
    if (!fn) throw new SimError("git: '" + sub + "' is not a git command. See 'git --help'.");
    return fn.call(this, repo, rest);
  }
}

export function createSim() { return new GitSim(); }

/** Crée un simulateur, exécute la mise en place (sans afficher), puis des commandes. */
export function runScript(setup, commands) {
  const sim = createSim();
  for (const l of setup || []) { const r = sim.run(l); if (!r.ok) throw new Error("mise en place invalide : " + l + " → " + r.out); }
  const transcript = [];
  for (const l of commands || []) transcript.push({ cmd: l, ...sim.run(l) });
  return { sim, transcript };
}

const HELP = [
  "Commandes disponibles dans ce terminal simulé :",
  "  fichiers : ls, cat, echo \"texte\" > fichier, echo \"texte\" >> fichier, touch, rm, pwd",
  "  git : init, status, add, restore, rm, commit, log, diff, show, branch, switch, checkout,",
  "        merge, rebase, cherry-pick, revert, reset, stash, tag, remote, push, fetch, pull",
].join("\n");

/* ---------- Commandes shell ---------- */
function shEcho(repo, args) {
  let interp = false; const words = [];
  let redirect = null, target = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "-e" && !words.length) { interp = true; continue; }
    if (args[i] === ">" || args[i] === ">>") { redirect = args[i]; target = args[i + 1]; break; }
    words.push(args[i]);
  }
  let text = words.join(" ");
  if (interp) text = text.replace(/\\n/g, "\n").replace(/\\t/g, "\t");
  if (!redirect) return text;
  if (!target) throw new SimError("syntaxe : fichier manquant après " + redirect);
  repo.fs[target] = (redirect === ">>" ? repo.fs[target] || "" : "") + text + "\n";
  return "";
}

/* ---------- Résolution de références ---------- */
function resolve(repo, ref, quiet) {
  const W = repo.world;
  let m = /^(.+?)((?:[~^]\d*)*)$/.exec(ref);
  let base = m[1], suffix = m[2];
  let id = null;
  if (base === "HEAD" || base === "@") id = repo.headId();
  else if (repo.branches[base]) id = repo.branches[base];
  else if (repo.tags[base]) id = repo.tags[base];
  else if (repo.remoteRefs[base]) id = repo.remoteRefs[base];
  else if (/^[0-9a-f]{4,40}$/.test(base)) {
    const found = [...W.objects.keys()].filter((k) => k.startsWith(base));
    if (found.length === 1) id = found[0];
  }
  if (!id) { if (quiet) return null; throw new SimError("fatal: ambiguous argument '" + ref + "': unknown revision or path not in the working tree."); }
  for (const s of suffix.match(/[~^]\d*/g) || []) {
    const n = s.length > 1 ? parseInt(s.slice(1), 10) : 1;
    if (s[0] === "~") { for (let k = 0; k < n; k++) { const p = W.get(id).parents[0]; if (!p) throw new SimError("fatal: ambiguous argument '" + ref + "': unknown revision or path not in the working tree."); id = p; } }
    else { const p = W.get(id).parents[n - 1]; if (!p) throw new SimError("fatal: ambiguous argument '" + ref + "': unknown revision or path not in the working tree."); id = p; }
  }
  return id;
}

/* ---------- États des fichiers ---------- */
function changes(repo) {
  const head = repo.headTree(), idx = repo.index, fs = repo.fs, rules = repo.ignore();
  const staged = [], unstaged = [], untracked = [];
  for (const p of new Set([...Object.keys(head), ...Object.keys(idx)])) {
    if (!(p in head)) staged.push(["new file", p]);
    else if (!(p in idx)) staged.push(["deleted", p]);
    else if (head[p] !== idx[p]) staged.push(["modified", p]);
  }
  for (const p of Object.keys(idx)) {
    if (!(p in fs)) unstaged.push(["deleted", p]);
    else if (fs[p] !== idx[p]) unstaged.push(["modified", p]);
  }
  for (const p of Object.keys(fs)) if (!(p in idx) && !isIgnored(p, rules)) untracked.push(p);
  const by = (a, b) => (a[1] < b[1] ? -1 : 1);
  return { staged: staged.sort(by), unstaged: unstaged.sort(by), untracked: untracked.sort() };
}
function isDirty(repo) { const c = changes(repo); return c.staged.length + c.unstaged.length > 0; }

/** Applique un arbre à la copie de travail et à l'index (les fichiers non suivis sont conservés). */
function checkoutTree(repo, fromTree, toTree) {
  for (const p of new Set([...Object.keys(fromTree), ...Object.keys(toTree)])) {
    if (p in toTree) { repo.fs[p] = toTree[p]; repo.index[p] = toTree[p]; }
    else { delete repo.fs[p]; delete repo.index[p]; }
  }
}
function refuseIfOverwritten(repo, target, verb) {
  const head = repo.headTree(); const bad = [];
  for (const p of Object.keys({ ...head, ...repo.index, ...target })) {
    const dirty = repo.fs[p] !== head[p] || repo.index[p] !== head[p];
    if (dirty && target[p] !== head[p] && (p in head || p in repo.index)) bad.push(p);
  }
  if (bad.length) throw new SimError("error: Your local changes to the following files would be overwritten by " + verb + ":\n" + bad.map((p) => "\t" + p).join("\n") + "\nPlease commit your changes or stash them before you " + (verb === "checkout" ? "switch branches" : verb) + ".\nAborting");
}

/* ---------- Fusion à trois voies (niveau fichier) ---------- */
function merge3(base, ours, theirs, labels) {
  const result = {}; const conflicts = new Set();
  for (const p of new Set([...Object.keys(base), ...Object.keys(ours), ...Object.keys(theirs)])) {
    const b = base[p], o = ours[p], t = theirs[p];
    let r;
    if (o === t) r = o;
    else if (o === b) r = t;
    else if (t === b) r = o;
    else {
      conflicts.add(p);
      r = "<<<<<<< " + labels[0] + "\n" + (o || "") + "=======\n" + (t || "") + ">>>>>>> " + labels[1] + "\n";
    }
    if (r !== undefined) result[p] = r;
  }
  return { result, conflicts };
}

/** Applique un « patch » (base → theirs) sur HEAD. Renvoie { conflicts } et met à jour fs/index. */
function applyChange(repo, base, theirs, labels) {
  const ours = repo.headTree();
  const { result, conflicts } = merge3(base, ours, theirs, labels);
  checkoutTree(repo, ours, result);
  for (const p of conflicts) repo.index[p] = ours[p] !== undefined ? ours[p] : result[p];
  return conflicts;
}

/* ---------- Affichage ---------- */
function decorations(repo, id) {
  const d = [];
  if (repo.head.branch && repo.branches[repo.head.branch] === id) d.push("HEAD -> " + repo.head.branch);
  else if (!repo.head.branch && repo.head.detached === id) d.push("HEAD");
  for (const [b, v] of Object.entries(repo.branches)) if (v === id && b !== repo.head.branch) d.push(b);
  for (const [b, v] of Object.entries(repo.remoteRefs)) if (v === id) d.push(b);
  for (const [t, v] of Object.entries(repo.tags)) if (v === id) d.push("tag: " + t);
  return d.length ? " (" + d.join(", ") + ")" : "";
}
function fakeDate(time) {
  const d = new Date(Date.UTC(2026, 10, 2, 14, 0, 0) + time * 60000);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return days[d.getUTCDay()] + " " + months[d.getUTCMonth()] + " " + d.getUTCDate() + " " + String(d.getUTCHours() - 5).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0") + ":00 " + d.getUTCFullYear() + " -0500";
}
function statSummary(before, after) {
  let files = 0, ins = 0, del = 0;
  for (const p of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (before[p] === after[p]) continue;
    files++;
    for (const op of diffLines(toLines(before[p]), toLines(after[p]))) { if (op[0] === "+") ins++; else if (op[0] === "-") del++; }
  }
  const parts = [" " + plural(files, "file") + " changed"];
  if (ins) parts.push(ins + " insertion" + (ins > 1 ? "s" : "") + "(+)");
  if (del) parts.push(del + " deletion" + (del > 1 ? "s" : "") + "(-)");
  return parts.join(", ");
}
function unifiedDiff(path, a, b) {
  if (a === b) return "";
  const head = ["diff --git a/" + path + " b/" + path];
  if (a === undefined) head.push("new file mode 100644", "--- /dev/null", "+++ b/" + path);
  else if (b === undefined) head.push("deleted file mode 100644", "--- a/" + path, "+++ /dev/null");
  else head.push("--- a/" + path, "+++ b/" + path);
  const ops = diffLines(toLines(a), toLines(b));
  return head.concat(["@@ -1," + toLines(a).length + " +1," + toLines(b).length + " @@"], ops).join("\n");
}
function newCommit(repo, parents, message, tree, label) {
  const before = parents[0] ? repo.world.get(parents[0]).tree : {};
  const id = repo.world.commit(parents, message, tree);
  repo.setHead(id);
  const where = repo.head.branch || "detached HEAD " + short(id);
  return "[" + where + (parents.length ? "" : " (root-commit)") + " " + short(id) + "] " + firstLine(label || message) + "\n" + statSummary(before, tree);
}

/* ---------- Commandes git ---------- */
function gInit(repo) {
  if (repo.inited) return "Reinitialized existing Git repository in " + HOME + "/.git/";
  repo.inited = true; repo.head = { branch: "main" };
  return "Initialized empty Git repository in " + HOME + "/.git/";
}

function opBanner(repo) {
  const op = repo.op;
  if (!op) return [];
  if (op.kind === "merge") return op.conflicts.size ? ["You have unmerged paths.", '  (fix conflicts and run "git commit")', '  (use "git merge --abort" to abort the merge)', ""] : ["All conflicts fixed but you are still merging.", '  (use "git commit" to conclude merge)', ""];
  if (op.kind === "rebase") return ["interactive rebase in progress; onto " + short(op.onto), op.conflicts.size ? '  (fix conflicts and then run "git rebase --continue")' : '  (all conflicts fixed: run "git rebase --continue")', '  (use "git rebase --abort" to check out the original branch)', ""];
  return [op.kind + " in progress", '  (fix conflicts and run "git ' + op.kind + ' --continue")', '  (use "git ' + op.kind + ' --abort" to cancel the ' + op.kind + " operation)", ""];
}

function trackingInfo(repo) {
  const b = repo.head.branch; const up = b && repo.upstream[b];
  if (!up || !repo.remoteRefs[up]) return [];
  const W = repo.world, local = repo.branches[b], remote = repo.remoteRefs[up];
  const A = W.ancestors(local), B = W.ancestors(remote);
  const ahead = [...A].filter((c) => !B.has(c)).length, behind = [...B].filter((c) => !A.has(c)).length;
  if (!ahead && !behind) return ["Your branch is up to date with '" + up + "'.", ""];
  if (ahead && !behind) return ["Your branch is ahead of '" + up + "' by " + plural(ahead, "commit") + ".", '  (use "git push" to publish your local commits)', ""];
  if (behind && !ahead) return ["Your branch is behind '" + up + "' by " + plural(behind, "commit") + ", and can be fast-forwarded.", '  (use "git pull" to update your local branch)', ""];
  return ["Your branch and '" + up + "' have diverged,", "and have " + ahead + " and " + behind + " different commits each, respectively.", ""];
}

const GIT = {
  status(repo) {
    const lines = [repo.head.branch ? "On branch " + repo.head.branch : "HEAD detached at " + short(repo.head.detached)];
    lines.push(...trackingInfo(repo).map((l) => l));
    if (!repo.headId()) lines.push("", "No commits yet", "");
    else if (!trackingInfo(repo).length) lines.push("");
    lines.push(...opBanner(repo));
    const c = changes(repo); const unmerged = repo.conflicts();
    const staged = c.staged.filter(([, p]) => !unmerged.has(p)), unstaged = c.unstaged.filter(([, p]) => !unmerged.has(p));
    if (staged.length) lines.push("Changes to be committed:", '  (use "git restore --staged <file>..." to unstage)', ...staged.map(([k, p]) => "\t" + (k + ":").padEnd(12) + p), "");
    if (unmerged.size) lines.push("Unmerged paths:", '  (use "git add <file>..." to mark resolution)', ...[...unmerged].sort().map((p) => "\tboth modified:   " + p), "");
    if (unstaged.length) lines.push("Changes not staged for commit:", '  (use "git add <file>..." to update what will be committed)', '  (use "git restore <file>..." to discard changes in working directory)', ...unstaged.map(([k, p]) => "\t" + (k + ":").padEnd(12) + p), "");
    if (c.untracked.length) lines.push("Untracked files:", '  (use "git add <file>..." to include in what will be committed)', ...c.untracked.map((p) => "\t" + p), "");
    if (!staged.length && !unstaged.length && !unmerged.size) {
      if (c.untracked.length) lines.push(repo.headId() ? 'nothing added to commit but untracked files present (use "git add" to track)' : 'nothing added to commit but untracked files present (use "git add" to track)');
      else lines.push(repo.headId() ? "nothing to commit, working tree clean" : 'nothing to commit (create/copy files and use "git add" to track)');
    } else if (!staged.length && unstaged.length) lines.push('no changes added to commit (use "git add" and/or "git commit -a")');
    return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
  },

  add(repo, args) {
    const files = args.filter((a) => !a.startsWith("-"));
    if (!files.length && !args.includes("-A") && !args.includes("--all")) throw new SimError("Nothing specified, nothing added.\nhint: Maybe you wanted to say 'git add .'?");
    const rules = repo.ignore(); const conflicts = repo.conflicts();
    const all = args.includes("-A") || args.includes("--all") || files.includes(".");
    const targets = all ? new Set([...Object.keys(repo.fs).filter((p) => !isIgnored(p, rules) || p in repo.index), ...Object.keys(repo.index)]) : new Set(files);
    const ignored = [];
    for (const p of targets) {
      if (p in repo.fs) {
        if (!all && !(p in repo.index) && isIgnored(p, rules)) { ignored.push(p); continue; }
        repo.index[p] = repo.fs[p];
      } else if (p in repo.index) delete repo.index[p];
      else throw new SimError("fatal: pathspec '" + p + "' did not match any files");
      conflicts.delete(p);
    }
    if (ignored.length) throw new SimError("The following paths are ignored by one of your .gitignore files:\n" + ignored.join("\n") + "\nhint: Use -f if you really want to add them.");
    return "";
  },

  rm(repo, args) {
    const cached = args.includes("--cached");
    const files = args.filter((a) => !a.startsWith("-"));
    for (const p of files) {
      if (!(p in repo.index)) throw new SimError("fatal: pathspec '" + p + "' did not match any files");
      delete repo.index[p];
      if (!cached) delete repo.fs[p];
    }
    return files.map((p) => "rm '" + p + "'").join("\n");
  },

  restore(repo, args) {
    const staged = args.includes("--staged") || args.includes("-S");
    const files = args.filter((a) => !a.startsWith("-"));
    if (!files.length) throw new SimError("fatal: you must specify path(s) to restore");
    const head = repo.headTree();
    const targets = files.includes(".") ? Object.keys({ ...head, ...repo.index }) : files;
    for (const p of targets) {
      if (staged) { if (p in head) repo.index[p] = head[p]; else delete repo.index[p]; }
      else {
        if (!(p in repo.index)) throw new SimError("error: pathspec '" + p + "' did not match any file(s) known to git");
        repo.fs[p] = repo.index[p];
      }
    }
    return "";
  },

  commit(repo, args) {
    let message = null, all = false, amend = false, allowEmpty = false;
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === "-m") message = (message ? message + "\n\n" : "") + args[++i];
      else if (a === "-a" || a === "--all") all = true;
      else if (a === "-am") { all = true; message = args[++i]; }
      else if (a === "--amend") amend = true;
      else if (a === "--allow-empty") allowEmpty = true;
      else if (a === "--no-edit") { /* garde le message */ }
    }
    if (repo.conflicts().size) throw new SimError("error: Committing is not possible because you have unmerged files.\nhint: Fix them up in the work tree, and then use 'git add/rm <file>'\nhint: as appropriate to mark resolution and make a commit.\nfatal: Exiting because of an unresolved conflict.");
    if (all) for (const p of Object.keys(repo.index)) { if (p in repo.fs) repo.index[p] = repo.fs[p]; else delete repo.index[p]; }
    const headId = repo.headId();
    const op = repo.op;
    if (op && op.kind === "rebase") throw new SimError('hint: You are in the middle of a rebase: use "git rebase --continue" after "git add".');
    if (op && (op.kind === "cherry-pick" || op.kind === "revert")) { if (!message) message = op.message; }
    if (amend) {
      if (!headId) throw new SimError("fatal: You have nothing to amend.");
      const old = repo.world.get(headId);
      return newCommit(repo, old.parents, message || old.message, { ...repo.index });
    }
    const merging = op && op.kind === "merge";
    if (!merging && !allowEmpty && sameTree(repo.index, repo.headTree())) {
      const c = changes(repo);
      if (c.unstaged.length) throw new SimError(GIT.status(repo).split("\n").slice(0, 1).concat(["", 'no changes added to commit (use "git add" and/or "git commit -a")']).join("\n"));
      if (c.untracked.length) throw new SimError('nothing added to commit but untracked files present (use "git add" to track)');
      throw new SimError(headId ? "On branch " + (repo.head.branch || "HEAD") + "\nnothing to commit, working tree clean" : 'nothing to commit (create/copy files and use "git add" to track)');
    }
    if (merging && !message) message = op.message;
    if (!message) throw new SimError("Aborting commit due to empty commit message.\nhint: Dans ce terminal, utilise git commit -m \"message\".");
    const parents = headId ? [headId] : [];
    if (merging) parents.push(op.theirs);
    repo.op = null;
    return newCommit(repo, parents, message, { ...repo.index });
  },

  log(repo, args) {
    const W = repo.world;
    const oneline = args.includes("--oneline");
    let limit = Infinity;
    const refs = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === "-n") limit = parseInt(args[++i], 10);
      else if (/^-\d+$/.test(a)) limit = parseInt(a.slice(1), 10);
      else if (a === "--all") refs.push(...Object.values(repo.branches), ...Object.values(repo.remoteRefs), ...Object.values(repo.tags));
      else if (!a.startsWith("-")) refs.push(resolve(repo, a));
    }
    if (!refs.length) {
      const h = repo.headId();
      if (!h) throw new SimError("fatal: your current branch '" + (repo.head.branch || "HEAD") + "' does not have any commits yet");
      refs.push(h);
    }
    const ids = new Set(); refs.forEach((r) => W.ancestors(r).forEach((c) => ids.add(c)));
    const list = [...ids].map((id) => W.get(id)).sort((a, b) => b.time - a.time).slice(0, limit);
    if (oneline) return list.map((c) => short(c.id) + decorations(repo, c.id) + " " + firstLine(c.message)).join("\n");
    return list.map((c) => {
      const lines = ["commit " + c.id + decorations(repo, c.id)];
      if (c.parents.length > 1) lines.push("Merge: " + c.parents.map(short).join(" "));
      lines.push("Author: " + c.author, "Date:   " + fakeDate(c.time), "", ...c.message.split("\n").map((l) => "    " + l));
      return lines.join("\n");
    }).join("\n\n");
  },

  diff(repo, args) {
    const staged = args.includes("--staged") || args.includes("--cached");
    const paths = args.filter((a) => !a.startsWith("-"));
    let from, to;
    if (paths.length >= 1 && resolve(repo, paths[0], true)) {
      from = repo.world.get(resolve(repo, paths[0])).tree;
      to = paths[1] && resolve(repo, paths[1], true) ? repo.world.get(resolve(repo, paths[1])).tree : repo.fs;
      paths.splice(0, paths[1] && resolve(repo, paths[1], true) ? 2 : 1);
    } else if (staged) { from = repo.headTree(); to = repo.index; }
    else { from = repo.index; to = {}; for (const p of Object.keys(repo.index)) to[p] = repo.fs[p]; }
    const keys = [...new Set([...Object.keys(from), ...Object.keys(to)])].sort().filter((p) => !paths.length || paths.includes(p));
    return keys.map((p) => unifiedDiff(p, from[p], to[p])).filter(Boolean).join("\n");
  },

  show(repo, args) {
    const id = resolve(repo, args.find((a) => !a.startsWith("-")) || "HEAD");
    const c = repo.world.get(id);
    const parent = c.parents[0] ? repo.world.get(c.parents[0]).tree : {};
    const header = GIT.log(repo, ["-1", id]);
    const diff = [...new Set([...Object.keys(parent), ...Object.keys(c.tree)])].sort().map((p) => unifiedDiff(p, parent[p], c.tree[p])).filter(Boolean).join("\n");
    return header + (diff ? "\n\n" + diff : "");
  },

  branch(repo, args) {
    const W = repo.world;
    if (!args.length || args[0] === "--list" || args[0] === "-a" || args[0] === "-v") {
      const names = Object.keys(repo.branches).sort();
      const lines = [];
      if (!repo.head.branch) lines.push("* (HEAD detached at " + short(repo.head.detached) + ")");
      for (const b of names) lines.push((b === repo.head.branch ? "* " : "  ") + b);
      if (args[0] === "-a") for (const r of Object.keys(repo.remoteRefs).sort()) lines.push("  remotes/" + r);
      return lines.join("\n");
    }
    if (args[0] === "-d" || args[0] === "-D") {
      const name = args[1];
      if (!repo.branches[name]) throw new SimError("error: branch '" + name + "' not found.");
      if (name === repo.head.branch) throw new SimError("error: Cannot delete branch '" + name + "' checked out at '" + HOME + "'");
      const id = repo.branches[name];
      if (args[0] === "-d" && !W.isAncestor(id, repo.headId())) throw new SimError("error: the branch '" + name + "' is not fully merged.\nhint: If you are sure you want to delete it, run 'git branch -D " + name + "'");
      delete repo.branches[name];
      return "Deleted branch " + name + " (was " + short(id) + ").";
    }
    if (args[0] === "-m" || args[0] === "-M") {
      const [from, to] = args.length > 2 ? [args[1], args[2]] : [repo.head.branch, args[1]];
      if (!repo.branches[from] && from !== repo.head.branch) throw new SimError("error: refname refs/heads/" + from + " not found");
      if (repo.branches[from]) repo.branches[to] = repo.branches[from];
      delete repo.branches[from];
      if (repo.head.branch === from) repo.head.branch = to;
      return "";
    }
    const name = args[0];
    if (!repo.headId()) throw new SimError("fatal: not a valid object name: '" + repo.head.branch + "'");
    if (repo.branches[name]) throw new SimError("fatal: a branch named '" + name + "' already exists");
    if (!/^[\w./-]+$/.test(name) || name.includes("..")) throw new SimError("fatal: '" + name + "' is not a valid branch name");
    repo.branches[name] = args[1] ? resolve(repo, args[1]) : repo.headId();
    return "";
  },

  switch(repo, args) {
    if (args[0] === "-c" || args[0] === "-C" || args[0] === "--create") {
      const name = args[1];
      if (!name) throw new SimError("error: switch `c' requires a value");
      if (repo.branches[name] && args[0] !== "-C") throw new SimError("fatal: a branch named '" + name + "' already exists");
      const start = args[2] ? resolve(repo, args[2]) : repo.headId();
      if (!repo.headId() && !args[2]) { repo.head = { branch: name }; return "Switched to a new branch '" + name + "'"; }
      refuseIfOverwritten(repo, repo.world.get(start).tree, "checkout");
      checkoutTree(repo, repo.headTree(), repo.world.get(start).tree);
      repo.branches[name] = start; repo.head = { branch: name };
      return "Switched to a new branch '" + name + "'";
    }
    if (args[0] === "--detach") return switchTo(repo, args[1], true);
    if (args[0] === "-") throw new SimError("Ce terminal ne gère pas « git switch - » : indique le nom de la branche.");
    return switchTo(repo, args[0], false);
  },

  checkout(repo, args) {
    if (args[0] === "-b" || args[0] === "-B") return GIT.switch(repo, ["-c", args[1], ...(args[2] ? [args[2]] : [])]);
    if (args[0] === "--") return GIT.restore(repo, args.slice(1));
    const target = args[0];
    if (!target) throw new SimError("error: you must specify a branch or file");
    if (!repo.branches[target] && !resolve(repo, target, true) && target in repo.index) return GIT.restore(repo, [target]);
    return switchTo(repo, target, !repo.branches[target]);
  },

  merge(repo, args) {
    const W = repo.world;
    if (args[0] === "--abort") {
      if (!repo.op || repo.op.kind !== "merge") throw new SimError("fatal: There is no merge to abort (MERGE_HEAD missing).");
      const head = repo.headTree(); repo.index = { ...head };
      for (const p of Object.keys(repo.fs)) if (!(p in head) && repo.op.touched.has(p)) delete repo.fs[p];
      for (const p of Object.keys(head)) repo.fs[p] = head[p];
      repo.op = null; return "";
    }
    if (args[0] === "--continue") return GIT.commit(repo, []);
    if (repo.op) throw new SimError("error: Merging is not possible because you have unmerged files.\nfatal: Exiting because of an unresolved conflict.");
    const noFF = args.includes("--no-ff");
    const mi = args.indexOf("-m"); const customMsg = mi >= 0 ? args[mi + 1] : null;
    const name = args.filter((a, i) => !a.startsWith("-") && !(mi >= 0 && i === mi + 1))[0];
    if (!name) throw new SimError("fatal: No remote for the current branch.");
    const theirs = resolve(repo, name), ours = repo.headId();
    if (!ours) throw new SimError("fatal: Le dépôt n'a pas encore de commit.");
    if (W.isAncestor(theirs, ours)) return "Already up to date.";
    if (isDirty(repo)) refuseIfOverwritten(repo, W.get(theirs).tree, "merge");
    if (!noFF && W.isAncestor(ours, theirs)) {
      const from = repo.headTree(), to = W.get(theirs).tree;
      checkoutTree(repo, from, to); repo.setHead(theirs);
      return "Updating " + short(ours) + ".." + short(theirs) + "\nFast-forward\n" + statSummary(from, to);
    }
    const base = W.mergeBase(ours, theirs);
    const label = repo.remoteRefs[name] ? "remote-tracking branch '" + name + "'" : "branch '" + name + "'";
    const message = customMsg || "Merge " + label + (repo.head.branch && repo.head.branch !== "main" ? " into " + repo.head.branch : "");
    const conflicts = applyChange(repo, base ? W.get(base).tree : {}, W.get(theirs).tree, ["HEAD", name]);
    const touched = new Set(Object.keys(W.get(theirs).tree));
    if (conflicts.size) {
      repo.op = { kind: "merge", theirs, message, conflicts, touched };
      throw new SimError([...conflicts].sort().map((p) => "Auto-merging " + p + "\nCONFLICT (content): Merge conflict in " + p).join("\n") + "\nAutomatic merge failed; fix conflicts and then commit the result.");
    }
    const parents = [ours, theirs];
    const out = newCommit(repo, parents, message, { ...repo.index });
    return "Merge made by the 'ort' strategy.\n" + out.split("\n").slice(1).join("\n");
  },

  rebase(repo, args) {
    const W = repo.world;
    if (args[0] === "--abort") {
      const op = repo.op;
      if (!op || op.kind !== "rebase") throw new SimError("fatal: No rebase in progress?");
      const from = repo.headTree(); repo.head = { branch: op.branch }; repo.branches[op.branch] = op.orig;
      checkoutTree(repo, from, W.get(op.orig).tree); repo.op = null; return "";
    }
    if (args[0] === "--continue") {
      const op = repo.op;
      if (!op || op.kind !== "rebase") throw new SimError("fatal: No rebase in progress?");
      if (op.conflicts.size) throw new SimError("error: you must edit all merge conflicts and then\nmark them as resolved using git add\n" + [...op.conflicts].map((p) => "\t" + p).join("\n"));
      const c = W.get(op.current);
      const out = [];
      if (!sameTree(repo.index, repo.headTree())) { const id = W.commit([repo.headId()], c.message, { ...repo.index }); repo.head.detached = id; out.push("[detached HEAD " + short(id) + "] " + firstLine(c.message)); }
      op.conflicts = new Set();
      return rebaseResult(repo, out.concat(continueRebase(repo)));
    }
    if (repo.op) throw new SimError("fatal: It seems that there is already a rebase-merge directory, and\nI wonder if you are in the middle of another rebase.");
    if (!repo.head.branch) throw new SimError("fatal: Ce terminal ne rebase que depuis une branche.");
    const upstream = resolve(repo, args.find((a) => !a.startsWith("-")) || (repo.upstream[repo.head.branch] || "origin/main"));
    const head = repo.headId();
    if (isDirty(repo)) throw new SimError("error: cannot rebase: You have unstaged changes.\nerror: Please commit or stash them.");
    if (W.isAncestor(head, upstream) && head !== upstream) {
      const from = repo.headTree(); checkoutTree(repo, from, W.get(upstream).tree); repo.setHead(upstream);
      return "Successfully rebased and updated refs/heads/" + repo.head.branch + ".";
    }
    const up = W.ancestors(upstream);
    const todo = [];
    for (let c = head; c && !up.has(c); c = W.get(c).parents[0]) if (W.get(c).parents.length < 2) todo.unshift(c);
    if (!todo.length || W.isAncestor(upstream, head) && W.get(todo[0]).parents[0] === upstream) return "Current branch " + repo.head.branch + " is up to date.";
    const branch = repo.head.branch;
    const from = repo.headTree();
    repo.head = { detached: upstream };
    checkoutTree(repo, from, W.get(upstream).tree);
    repo.op = { kind: "rebase", onto: upstream, orig: head, branch, todo, current: null, conflicts: new Set() };
    return rebaseResult(repo, continueRebase(repo));
  },

  "cherry-pick"(repo, args) { return pickLike(repo, args, "cherry-pick"); },
  revert(repo, args) { return pickLike(repo, args, "revert"); },

  reset(repo, args) {
    const mode = args.find((a) => a === "--soft" || a === "--mixed" || a === "--hard") || "--mixed";
    const rest = args.filter((a) => !a.startsWith("--"));
    if (rest.length && !resolve(repo, rest[0], true) && (rest[0] in repo.index || rest[0] in repo.headTree())) return GIT.restore(repo, ["--staged", ...rest]);
    const target = resolve(repo, rest[0] || "HEAD");
    const W = repo.world;
    const tree = W.get(target).tree;
    const from = repo.headTree();
    repo.setHead(target);
    repo.op = null;
    if (mode === "--soft") return "";
    if (mode === "--mixed") {
      repo.index = { ...tree };
      const c = changes(repo).unstaged;
      return c.length ? "Unstaged changes after reset:\n" + c.map(([k, p]) => (k === "deleted" ? "D" : "M") + "\t" + p).join("\n") : "";
    }
    repo.index = { ...tree };
    for (const p of new Set([...Object.keys(from), ...Object.keys(tree)])) { if (p in tree) repo.fs[p] = tree[p]; else delete repo.fs[p]; }
    return "HEAD is now at " + short(target) + " " + firstLine(W.get(target).message);
  },

  stash(repo, args) {
    const sub = args[0] || "push";
    const W = repo.world;
    if (sub === "push" || sub === "save" || sub === "-m") {
      const mi = args.indexOf("-m");
      if (!isDirty(repo)) return "No local changes to save";
      const head = repo.headTree();
      const saved = { index: { ...repo.index }, fs: {} };
      for (const p of new Set([...Object.keys(head), ...Object.keys(repo.index)])) saved.fs[p] = repo.fs[p];
      const base = repo.headId();
      saved.label = (mi >= 0 ? "On " + (repo.head.branch || "HEAD") + ": " + args[mi + 1] : "WIP on " + (repo.head.branch || "HEAD") + ": " + short(base) + " " + firstLine(W.get(base).message));
      repo.stash.unshift(saved);
      repo.index = { ...head };
      for (const p of Object.keys(saved.fs)) { if (p in head) repo.fs[p] = head[p]; else delete repo.fs[p]; }
      return "Saved working directory and index state " + saved.label;
    }
    if (sub === "list") return repo.stash.map((s, i) => "stash@{" + i + "}: " + s.label).join("\n");
    if (sub === "pop" || sub === "apply") {
      if (!repo.stash.length) throw new SimError("No stash entries found.");
      const s = repo.stash[0];
      const head = repo.headTree();
      const clash = Object.keys(s.fs).filter((p) => repo.fs[p] !== head[p]);
      if (clash.length) throw new SimError("error: Your local changes to the following files would be overwritten by merge:\n" + clash.map((p) => "\t" + p).join("\n") + "\nPlease commit your changes or stash them before you merge.\nAborting");
      for (const [p, v] of Object.entries(s.fs)) { if (v === undefined) delete repo.fs[p]; else repo.fs[p] = v; }
      for (const p of Object.keys(s.fs)) { if (p in s.index && s.index[p] !== head[p]) repo.index[p] = s.index[p]; }
      if (sub === "pop") repo.stash.shift();
      return GIT.status(repo) + (sub === "pop" ? "\nDropped refs/stash@{0}" : "");
    }
    if (sub === "drop") { if (!repo.stash.length) throw new SimError("No stash entries found."); repo.stash.shift(); return "Dropped refs/stash@{0}"; }
    if (sub === "clear") { repo.stash = []; return ""; }
    throw new SimError("error: unknown subcommand: '" + sub + "'");
  },

  tag(repo, args) {
    if (!args.length || args[0] === "-l" || args[0] === "--list") return Object.keys(repo.tags).sort().join("\n");
    if (args[0] === "-d") { const t = args[1]; if (!repo.tags[t]) throw new SimError("error: tag '" + t + "' not found."); const id = repo.tags[t]; delete repo.tags[t]; return "Deleted tag '" + t + "' (was " + short(id) + ")"; }
    const clean = []; for (let i = 0; i < args.length; i++) { if (args[i] === "-m") { i++; continue; } if (!args[i].startsWith("-")) clean.push(args[i]); }
    const [name, ref] = clean;
    if (repo.tags[name]) throw new SimError("fatal: tag '" + name + "' already exists");
    repo.tags[name] = resolve(repo, ref || "HEAD");
    return "";
  },

  remote(repo, args) {
    if (!args.length) return Object.keys(repo.remotes).sort().join("\n");
    if (args[0] === "-v") return Object.entries(repo.remotes).flatMap(([n, u]) => [n + "\t" + u + " (fetch)", n + "\t" + u + " (push)"]).join("\n");
    if (args[0] === "add") {
      const [, name, url] = args;
      if (!name || !url) throw new SimError("usage: git remote add <name> <url>");
      if (repo.remotes[name]) throw new SimError("error: remote " + name + " already exists.");
      if (name !== "origin") throw new SimError("Ce terminal simule un seul dépôt distant, nommé « origin ».");
      repo.remotes[name] = url; this.origin().url = url;
      return "";
    }
    if (args[0] === "remove" || args[0] === "rm") { delete repo.remotes[args[1]]; for (const k of Object.keys(repo.remoteRefs)) if (k.startsWith(args[1] + "/")) delete repo.remoteRefs[k]; return ""; }
    throw new SimError("error: unknown subcommand: '" + args[0] + "'");
  },

  push(repo, args) {
    const W = repo.world;
    const setUp = args.includes("-u") || args.includes("--set-upstream");
    const force = args.includes("--force") || args.includes("-f") || args.includes("--force-with-lease");
    const tags = args.includes("--tags");
    const pos = args.filter((a) => !a.startsWith("-"));
    const remoteName = pos[0] || "origin";
    if (!repo.remotes[remoteName]) throw new SimError("fatal: No configured push destination.\nEither specify the URL from the command-line or configure a remote repository using\n\n    git remote add <name> <url>\n\nand then push using the remote name\n\n    git push <name>");
    const o = this.origin(); const url = repo.remotes[remoteName];
    const lines = ["To " + url];
    if (tags) {
      for (const [t, id] of Object.entries(repo.tags)) if (!o.tags[t]) { o.tags[t] = id; lines.push(" * [new tag]         " + t + " -> " + t); }
      return lines.length > 1 ? lines.join("\n") : "Everything up-to-date";
    }
    const branch = pos[1] || repo.head.branch;
    if (!branch) throw new SimError("fatal: You are not currently on a branch.");
    if (!pos[1] && !setUp && !repo.upstream[branch]) throw new SimError("fatal: The current branch " + branch + " has no upstream branch.\nTo push the current branch and set the remote as upstream, use\n\n    git push --set-upstream origin " + branch + "\n");
    const local = repo.branches[branch];
    if (!local) throw new SimError("error: src refspec " + branch + " does not match any");
    const remote = o.branches[branch];
    if (remote === local) { if (setUp) repo.upstream[branch] = remoteName + "/" + branch; return "Everything up-to-date"; }
    if (remote && !W.isAncestor(remote, local) && !force) {
      throw new SimError(lines[0] + "\n ! [rejected]        " + branch + " -> " + branch + " (fetch first)\nerror: failed to push some refs to '" + url + "'\nhint: Updates were rejected because the remote contains work that you do not\nhint: have locally. This is usually caused by another repository pushing to\nhint: the same ref. If you want to integrate the remote changes, use\nhint: 'git pull' before pushing again.");
    }
    o.branches[branch] = local; repo.remoteRefs[remoteName + "/" + branch] = local;
    if (o.head.branch === branch) { const t = W.get(local).tree; o.fs = { ...t }; o.index = { ...t }; } // le « collègue » voit le travail poussé
    if (!remote) lines.push(" * [new branch]      " + branch + " -> " + branch);
    else lines.push("   " + short(remote) + (force && !W.isAncestor(remote, local) ? "..." : "..") + short(local) + "  " + branch + " -> " + branch + (force && !W.isAncestor(remote, local) ? " (forced update)" : ""));
    if (setUp) { repo.upstream[branch] = remoteName + "/" + branch; lines.push("branch '" + branch + "' set up to track '" + remoteName + "/" + branch + "'."); }
    return lines.join("\n");
  },

  fetch(repo, args) {
    const name = args.find((a) => !a.startsWith("-")) || "origin";
    if (!repo.remotes[name]) throw new SimError("fatal: '" + name + "' does not appear to be a git repository\nfatal: Could not read from remote repository.");
    const o = this.origin(); const lines = [];
    for (const [b, id] of Object.entries(o.branches)) {
      const key = name + "/" + b, old = repo.remoteRefs[key];
      if (old === id) continue;
      lines.push(old ? "   " + short(old) + ".." + short(id) + "  " + b.padEnd(10) + " -> " + key : " * [new branch]      " + b.padEnd(10) + " -> " + key);
      repo.remoteRefs[key] = id;
    }
    for (const [t, id] of Object.entries(o.tags)) if (!repo.tags[t]) { repo.tags[t] = id; lines.push(" * [new tag]         " + t.padEnd(10) + " -> " + t); }
    return lines.length ? "From " + repo.remotes[name] + "\n" + lines.join("\n") : "";
  },

  pull(repo, args) {
    const name = args.find((a) => !a.startsWith("-")) || "origin";
    const fetched = GIT.fetch.call(this, repo, [name]);
    const branch = repo.head.branch;
    const up = repo.upstream[branch] || name + "/" + branch;
    if (!repo.remoteRefs[up]) throw new SimError((fetched ? fetched + "\n" : "") + "fatal: couldn't find remote ref " + branch);
    const merged = GIT.merge(repo, [up, "-m", "Merge branch '" + branch + "' of " + repo.remotes[name]]);
    return (fetched ? fetched + "\n" : "") + merged;
  },

  clone() { throw new SimError("Ce terminal démarre déjà dans un dépôt : utilise les commandes sur le dépôt courant."); },
};

function switchTo(repo, target, detach) {
  const W = repo.world;
  if (!target) throw new SimError("fatal: missing branch or commit argument");
  if (repo.op) throw new SimError("error: you need to resolve your current index first");
  let id, branch = null;
  if (repo.branches[target]) { id = repo.branches[target]; branch = target; }
  else if (repo.remoteRefs["origin/" + target] && !detach) {
    id = repo.remoteRefs["origin/" + target]; repo.branches[target] = id; repo.upstream[target] = "origin/" + target; branch = target;
  } else {
    id = resolve(repo, target, true);
    if (!id) throw new SimError("error: pathspec '" + target + "' did not match any file(s) known to git");
    if (!detach) throw new SimError("fatal: a branch is expected, got commit '" + target + "'\nhint: If you want to detach HEAD at the commit, try again with the --detach option.");
  }
  if (branch && branch === repo.head.branch) return "Already on '" + branch + "'";
  refuseIfOverwritten(repo, W.get(id).tree, "checkout");
  const dirty = new Set(); const head = repo.headTree();
  for (const p of Object.keys({ ...head, ...repo.index })) if (repo.fs[p] !== head[p] || repo.index[p] !== head[p]) dirty.add(p);
  const keep = {}; for (const p of dirty) keep[p] = [repo.fs[p], repo.index[p]];
  checkoutTree(repo, head, W.get(id).tree);
  for (const [p, [f, i]] of Object.entries(keep)) { if (f === undefined) delete repo.fs[p]; else repo.fs[p] = f; if (i === undefined) delete repo.index[p]; else repo.index[p] = i; }
  repo.head = branch ? { branch } : { detached: id };
  if (branch) {
    const up = repo.upstream[branch];
    return "Switched to branch '" + branch + "'" + (up ? "\n" + (trackingInfo(repo)[0] || "") : "");
  }
  return "Note: switching to '" + target + "'.\n\nYou are in 'detached HEAD' state.\nHEAD is now at " + short(id) + " " + firstLine(W.get(id).message);
}

/** Un rebase arrêté sur conflit se termine en échec (code de sortie 1), comme le vrai Git. */
function rebaseResult(repo, lines) {
  if (repo.op && repo.op.kind === "rebase" && repo.op.conflicts.size) throw new SimError(lines.join("\n"));
  return lines.join("\n");
}

function continueRebase(repo) {
  const W = repo.world, op = repo.op, out = [];
  while (op.todo.length) {
    const id = op.todo.shift(); const c = W.get(id);
    op.current = id;
    const base = c.parents[0] ? W.get(c.parents[0]).tree : {};
    const conflicts = applyChange(repo, base, c.tree, ["HEAD", short(id) + " (" + firstLine(c.message) + ")"]);
    if (conflicts.size) {
      op.conflicts = conflicts;
      out.push(...[...conflicts].sort().map((p) => "Auto-merging " + p + "\nCONFLICT (content): Merge conflict in " + p));
      out.push("error: could not apply " + short(id) + "... " + firstLine(c.message), 'hint: Resolve all conflicts manually, mark them as resolved with\nhint: "git add/rm <conflicted_files>", then run "git rebase --continue".\nhint: To abort and get back to the state before "git rebase", run "git rebase --abort".');
      return out;
    }
    if (sameTree(repo.index, repo.headTree())) continue;
    repo.head.detached = W.commit([repo.headId()], c.message, { ...repo.index });
  }
  const tip = repo.headId();
  repo.branches[op.branch] = tip; repo.head = { branch: op.branch }; repo.op = null;
  out.push("Successfully rebased and updated refs/heads/" + op.branch + ".");
  return out;
}

function pickLike(repo, args, kind) {
  const W = repo.world;
  if (args[0] === "--abort") {
    if (!repo.op || repo.op.kind !== kind) throw new SimError("error: no " + kind + " in progress");
    const head = repo.headTree(); checkoutTree(repo, { ...repo.fs }, head); repo.index = { ...head }; repo.op = null; return "";
  }
  if (args[0] === "--continue") {
    if (!repo.op || repo.op.kind !== kind) throw new SimError("error: no " + kind + " in progress");
    return GIT.commit(repo, []);
  }
  if (repo.op) throw new SimError("error: " + kind + " is not possible because you have unmerged files.");
  const ref = args.find((a) => !a.startsWith("-"));
  if (!ref) throw new SimError("usage: git " + kind + " <commit>");
  const id = resolve(repo, ref); const c = W.get(id);
  if (c.parents.length > 1) throw new SimError("error: commit " + short(id) + " is a merge but no -m option was given.");
  if (isDirty(repo)) throw new SimError("error: your local changes would be overwritten by " + kind + ".\nhint: commit your changes or stash them to proceed.");
  const parentTree = c.parents[0] ? W.get(c.parents[0]).tree : {};
  const [base, theirs] = kind === "revert" ? [c.tree, parentTree] : [parentTree, c.tree];
  const message = kind === "revert" ? 'Revert "' + firstLine(c.message) + '"\n\nThis reverts commit ' + id + "." : c.message;
  const conflicts = applyChange(repo, base, theirs, ["HEAD", short(id) + " (" + firstLine(c.message) + ")"]);
  if (conflicts.size) {
    repo.op = { kind, message, conflicts };
    throw new SimError([...conflicts].sort().map((p) => "Auto-merging " + p + "\nCONFLICT (content): Merge conflict in " + p).join("\n") + "\nerror: could not " + (kind === "revert" ? "revert" : "apply") + " " + short(id) + "... " + firstLine(c.message) + '\nhint: After resolving the conflicts, mark them with\nhint: "git add/rm <pathspec>", then run\nhint: "git ' + kind + ' --continue".');
  }
  if (sameTree(repo.index, repo.headTree())) throw new SimError("The previous " + kind + " is now empty, possibly due to conflict resolution.");
  return newCommit(repo, [repo.headId()], message, { ...repo.index });
}

/* ---------- Vérifications déclaratives ----------
   checks : objet dont chaque clé est un critère ; renvoie [{ label, ok }] avec des libellés en français. */
export function evaluate(sim, checks) {
  const repo = sim.repo, W = sim.world;
  const head = repo.headId();
  const chain = []; for (let c = head; c; c = W.get(c).parents[0]) chain.push(W.get(c));
  const allMsgs = head ? [...W.ancestors(head)].map((id) => firstLine(W.get(id).message)) : [];
  const tree = repo.headTree();
  const norm = (s) => (s === undefined || s === null ? null : String(s).replace(/\s+$/, ""));
  const q = (s) => "« " + s + " »";
  const res = [];
  const add = (label, ok) => res.push({ label, ok: !!ok });
  for (const [key, want] of Object.entries(checks)) {
    switch (key) {
      case "initialized": add("Le dossier est un dépôt Git (git init)", repo.inited); break;
      case "branch": add("Tu es sur la branche " + want, repo.head.branch === want); break;
      case "branches": add("Branches locales : " + want.join(", "), JSON.stringify(Object.keys(repo.branches).sort()) === JSON.stringify([...want].sort())); break;
      case "commits": add("La branche courante contient " + plural(want, "commit"), head && W.ancestors(head).size === want); break;
      case "headMessage": add("Le dernier commit a pour message " + q(want), head && firstLine(W.get(head).message) === want); break;
      case "messages": add("Historique (du plus récent au plus ancien) : " + want.map(q).join(", "), JSON.stringify(chain.map((c) => firstLine(c.message))) === JSON.stringify(want)); break;
      case "hasMessages": for (const m of want) add("L'historique contient le commit " + q(m), allMsgs.includes(m)); break;
      case "lacksMessages": for (const m of want) add("L'historique ne contient pas le commit " + q(m), !allMsgs.includes(m)); break;
      case "clean": { const c = changes(repo); add("Copie de travail propre : rien à committer", !c.staged.length && !c.unstaged.length && !repo.op); break; }
      case "staged": { const s = changes(repo).staged.map(([, p]) => p); add(want.length ? "Fichiers prêts à être commités : " + want.join(", ") : "Aucun fichier dans l'index", JSON.stringify(s) === JSON.stringify([...want].sort())); break; }
      case "untracked": { const u = changes(repo).untracked; add(want.length ? "Fichiers non suivis : " + want.join(", ") : "Aucun fichier non suivi (ni oublié, ni à ignorer)", JSON.stringify(u) === JSON.stringify([...want].sort())); break; }
      case "files": for (const [p, v] of Object.entries(want)) add(v === null ? "Le fichier " + p + " n'existe pas" : "Le fichier " + p + " contient " + q(v.replace(/\n/g, " ⏎ ")), norm(repo.fs[p]) === norm(v)); break;
      case "committed": for (const [p, v] of Object.entries(want)) add(v === null ? p + " n'est pas dans le dernier commit" : "Dans le dernier commit, " + p + " contient " + q(v.replace(/\n/g, " ⏎ ")), norm(tree[p]) === norm(v)); break;
      case "mergeCommit": add(want ? "Le dernier commit est un commit de fusion (deux parents)" : "Le dernier commit n'est pas un commit de fusion", head && (W.get(head).parents.length > 1) === want); break;
      case "linear": add("Historique linéaire : aucun commit de fusion", head && [...W.ancestors(head)].every((id) => W.get(id).parents.length < 2)); break;
      case "noConflict": add("Aucun conflit en cours, plus aucun marqueur <<<<<<< dans les fichiers", !repo.op && !Object.values(repo.fs).some((v) => /^(<{7}|>{7}|={7})/m.test(v))); break;
      case "tags": for (const [t, m] of Object.entries(want)) add("Le tag " + t + " pointe sur le commit " + q(m), repo.tags[t] && firstLine(W.get(repo.tags[t]).message) === m); break;
      case "pushed": { const o = W.repos.get("origin"); for (const b of [].concat(want)) add("La branche " + b + " est poussée sur origin (à jour)", o && repo.branches[b] && o.branches[b] === repo.branches[b]); break; }
      case "remoteTags": { const o = W.repos.get("origin"); for (const t of want) add("Le tag " + t + " est poussé sur origin", o && o.tags[t] && o.tags[t] === repo.tags[t]); break; }
      case "upstream": for (const [b, u] of Object.entries(want)) add("La branche " + b + " suit " + u, repo.upstream[b] === u); break;
      case "stash": add(want ? plural(want, "entrée") + " dans le stash" : "Le stash est vide", repo.stash.length === want); break;
      case "branchAt": for (const [b, m] of Object.entries(want)) add("La branche " + b + " pointe sur le commit " + q(m), repo.branches[b] && firstLine(W.get(repo.branches[b]).message) === m); break;
      case "remote": add("Le dépôt distant origin est configuré", !!repo.remotes.origin); break;
      default: throw new Error("critère de vérification inconnu : " + key);
    }
  }
  return res;
}

/** Vue d'ensemble pour l'interface : graphe des commits et états des fichiers. */
export function snapshot(sim) {
  const repo = sim.repo, W = sim.world;
  const refs = {};
  const pushRef = (id, label, kind) => { if (id) (refs[id] = refs[id] || []).push({ label, kind }); };
  for (const [b, id] of Object.entries(repo.branches)) pushRef(id, b, b === repo.head.branch ? "head" : "branch");
  for (const [b, id] of Object.entries(repo.remoteRefs)) pushRef(id, b, "remote");
  for (const [t, id] of Object.entries(repo.tags)) pushRef(id, t, "tag");
  if (!repo.head.branch && repo.head.detached) pushRef(repo.head.detached, "HEAD", "head");
  const ids = new Set();
  for (const id of [...Object.values(repo.branches), ...Object.values(repo.remoteRefs), ...Object.values(repo.tags), repo.headId()].filter(Boolean)) W.ancestors(id).forEach((c) => ids.add(c));
  const commits = [...ids].map((id) => W.get(id)).sort((a, b) => a.time - b.time).map((c) => ({ id: c.id, short: short(c.id), message: firstLine(c.message), parents: c.parents, time: c.time }));
  // Couloirs : chaque branche (la courante d'abord, puis main) suit ses premiers parents.
  const lane = {}; let n = 0;
  const order = [repo.head.branch, "main", ...Object.keys(repo.branches).sort(), ...Object.keys(repo.remoteRefs).sort()].filter((v, i, a) => v && a.indexOf(v) === i);
  const tips = order.map((b) => repo.branches[b] || repo.remoteRefs[b]).concat(Object.values(repo.tags), [repo.headId()]).filter(Boolean);
  for (const tip of tips) {
    let used = false;
    for (let c = tip; c && lane[c] === undefined; c = W.get(c).parents[0]) { lane[c] = n; used = true; }
    if (used) n++;
  }
  const c = repo.inited ? changes(repo) : { staged: [], unstaged: [], untracked: [] };
  return {
    inited: repo.inited, branch: repo.head.branch, detached: !repo.head.branch, op: repo.op ? repo.op.kind : null,
    commits: commits.map((x) => ({ ...x, lane: lane[x.id] || 0, refs: refs[x.id] || [] })),
    lanes: Math.max(n, 1),
    files: Object.keys(repo.fs).sort().map((p) => ({
      path: p,
      staged: (c.staged.find((s) => s[1] === p) || [])[0] || null,
      unstaged: (c.unstaged.find((s) => s[1] === p) || [])[0] || null,
      untracked: c.untracked.includes(p),
      conflict: repo.conflicts().has(p),
      ignored: !(p in repo.index) && !c.untracked.includes(p) && isIgnored(p, repo.ignore()),
    })).concat(c.staged.filter(([k]) => k === "deleted").map(([, p]) => ({ path: p, staged: "deleted", unstaged: null, untracked: false, conflict: false, ignored: false }))),
  };
}
