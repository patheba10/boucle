/* Système de fichiers simulé : nœuds, chemins, utilisateurs et permissions Unix. */

export class FsError extends Error {
  constructor(code, msg) { super(msg || code); this.code = code; }
}
const MSG = { ENOENT: "No such file or directory", EACCES: "Permission denied", ENOTDIR: "Not a directory", EISDIR: "Is a directory", EEXIST: "File exists", ENOTEMPTY: "Directory not empty", ELOOP: "Too many levels of symbolic links", EINVAL: "Invalid argument" };
export const errText = (code) => MSG[code] || code;

let CLOCK = 0;
const now = () => new Date(Date.UTC(2026, 10, 12, 9, 0, 0) + 60000 * CLOCK++);
export const resetClock = () => { CLOCK = 0; };

function mk(t, props) { const d = now(); return Object.assign({ t, mode: t === "d" ? 0o755 : t === "l" ? 0o777 : 0o644, owner: "root", group: "root", mtime: d }, props); }

export function normalize(path) {
  const out = [];
  for (const p of path.split("/")) { if (!p || p === ".") continue; if (p === "..") out.pop(); else out.push(p); }
  return "/" + out.join("/");
}
export const dirname = (p) => { const n = normalize(p); return n === "/" ? "/" : n.slice(0, n.lastIndexOf("/")) || "/"; };
export const basename = (p) => { const n = normalize(p); return n === "/" ? "/" : n.slice(n.lastIndexOf("/") + 1); };

export class FS {
  constructor() { this.root = mk("d", { children: {} }); this.users = {}; this.groups = {}; }

  /* ---------- utilisateurs ---------- */
  nextId(list) { return Math.max(999, ...list.filter((x) => x < 60000)) + 1; }
  addGroup(name, gid) { this.groups[name] = { gid: gid ?? this.nextId(Object.values(this.groups).map((g) => g.gid)), members: [] }; }
  addUser(name, { uid, home, groups = [], shell = "/bin/bash" } = {}) {
    uid = uid ?? this.nextId(Object.values(this.users).map((u) => u.uid));
    if (!this.groups[name]) this.addGroup(name, uid >= 1000 && Object.values(this.groups).some((g) => g.gid === uid) ? undefined : uid);
    this.users[name] = { uid, home: home || "/home/" + name, shell };
    for (const g of groups) { if (!this.groups[g]) this.addGroup(g); if (!this.groups[g].members.includes(name)) this.groups[g].members.push(name); }
  }
  groupsOf(user) { return [user, ...Object.entries(this.groups).filter(([g, v]) => g !== user && v.members.includes(user)).map(([g]) => g)].filter((g) => this.groups[g]); }

  /* ---------- permissions ---------- */
  can(node, user, bit) { // bit : 4 lecture, 2 écriture, 1 exécution
    if (user === "root") return bit !== 1 || node.t === "d" || (node.mode & 0o111) !== 0;
    const m = node.mode;
    if (node.owner === user) return ((m >> 6) & bit) !== 0;
    if (this.groupsOf(user).includes(node.group)) return ((m >> 3) & bit) !== 0;
    return (m & bit) !== 0;
  }

  /* ---------- résolution ---------- */
  /** Renvoie { node, parent, name, path } ; lève FsError. follow : suivre le dernier lien. */
  lookup(path, { user = "root", follow = true, depth = 0 } = {}) {
    if (depth > 8) throw new FsError("ELOOP");
    const parts = normalize(path).split("/").filter(Boolean);
    let node = this.root, parent = null, cur = "/";
    for (let i = 0; i < parts.length; i++) {
      if (node.t !== "d") throw new FsError("ENOTDIR");
      if (!this.can(node, user, 1)) throw new FsError("EACCES");
      parent = node;
      const child = node.children[parts[i]];
      if (!child) throw new FsError("ENOENT");
      const here = (cur === "/" ? "" : cur) + "/" + parts[i];
      if (child.t === "l" && (follow || i < parts.length - 1)) {
        const target = child.target.startsWith("/") ? child.target : (cur === "/" ? "" : cur) + "/" + child.target;
        const rest = parts.slice(i + 1).join("/");
        return this.lookup(target + (rest ? "/" + rest : ""), { user, follow, depth: depth + 1 });
      }
      node = child; cur = here;
    }
    return { node, parent, name: parts[parts.length - 1] || "/", path: cur };
  }
  exists(path, user = "root") { try { this.lookup(path, { user }); return true; } catch (e) { return false; } }
  stat(path, user, follow = true) { return this.lookup(path, { user, follow }).node; }

  /** Dossier parent existant et inscriptible, plus le nom de l'entrée. */
  parentFor(path, user) {
    const p = normalize(path);
    if (p === "/") throw new FsError("EEXIST");
    const { node } = this.lookup(dirname(p), { user });
    if (node.t !== "d") throw new FsError("ENOTDIR");
    return { dir: node, name: basename(p) };
  }

  /* ---------- écriture ---------- */
  mkdir(path, user, { parents = false, mode } = {}) {
    const p = normalize(path);
    if (parents) {
      let cur = "";
      for (const part of p.split("/").filter(Boolean)) {
        cur += "/" + part;
        let n = null; try { n = this.lookup(cur, { user }).node; } catch (e) { if (e.code !== "ENOENT") throw e; }
        if (n) { if (n.t !== "d") throw new FsError("ENOTDIR"); continue; }
        this.mkdir(cur, user, { mode });
      }
      return;
    }
    const { dir, name } = this.parentFor(p, user);
    if (dir.children[name]) throw new FsError("EEXIST");
    if (!this.can(dir, user, 2)) throw new FsError("EACCES");
    dir.children[name] = mk("d", { children: {}, owner: user, group: this.primaryGroup(user), mode: mode ?? (0o777 & ~this.umask) });
  }
  primaryGroup(user) { return user === "root" ? "root" : this.groups[user] ? user : "users"; }
  get umask() { return this._umask ?? 0o022; }
  set umask(v) { this._umask = v; }

  write(path, data, user, { append = false, mode } = {}) {
    let n = null;
    try { n = this.lookup(path, { user }).node; } catch (e) { if (e.code !== "ENOENT") throw e; }
    if (n) {
      if (n.t === "d") throw new FsError("EISDIR");
      if (!this.can(n, user, 2)) throw new FsError("EACCES");
      n.data = append ? n.data + data : data; n.mtime = now();
      return n;
    }
    const { dir, name } = this.parentFor(path, user);
    if (!this.can(dir, user, 2)) throw new FsError("EACCES");
    return (dir.children[name] = mk("f", { data, owner: user, group: this.primaryGroup(user), mode: mode ?? (0o666 & ~this.umask) }));
  }
  read(path, user) {
    const n = this.lookup(path, { user }).node;
    if (n.t === "d") throw new FsError("EISDIR");
    if (!this.can(n, user, 4)) throw new FsError("EACCES");
    return n.data;
  }
  symlink(target, path, user) {
    const { dir, name } = this.parentFor(path, user);
    if (dir.children[name]) throw new FsError("EEXIST");
    if (!this.can(dir, user, 2)) throw new FsError("EACCES");
    dir.children[name] = mk("l", { target, owner: user, group: this.primaryGroup(user) });
  }
  remove(path, user, { recursive = false, dirOk = false } = {}) {
    const p = normalize(path);
    const { node, parent, name } = this.lookup(p, { user, follow: false });
    if (!parent) throw new FsError("EACCES");
    if (node.t === "d" && !recursive && !dirOk) throw new FsError("EISDIR");
    if (node.t === "d" && dirOk && !recursive && Object.keys(node.children).length) throw new FsError("ENOTEMPTY");
    if (!this.can(parent, user, 2)) throw new FsError("EACCES");
    if (node.t === "d" && recursive) for (const c of Object.keys(node.children)) this.remove(p + "/" + c, user, { recursive: true });
    delete parent.children[name];
  }
  /** Copie profonde d'un nœud (cp -r) ; l'utilisateur devient propriétaire, sauf root. */
  clone(node, user) {
    const c = Object.assign({}, node, { mtime: now() });
    if (user !== "root") { c.owner = user; c.group = this.primaryGroup(user); }
    if (node.t === "d") { c.children = {}; for (const [k, v] of Object.entries(node.children)) c.children[k] = this.clone(v, user); }
    return c;
  }
  place(path, node, user) {
    const { dir, name } = this.parentFor(path, user);
    if (!this.can(dir, user, 2)) throw new FsError("EACCES");
    dir.children[name] = node;
  }
  list(path, user) {
    const n = this.lookup(path, { user }).node;
    if (n.t !== "d") return null;
    if (!this.can(n, user, 4)) throw new FsError("EACCES");
    return Object.keys(n.children).sort((a, b) => a.replace(/^\./, "").localeCompare(b.replace(/^\./, ""), "en"));
  }
  size(node) { return node.t === "f" ? node.bytes ?? new TextEncoder().encode(node.data).length : node.t === "l" ? node.target.length : 4096; }
  du(node) { return node.t === "d" ? 4096 + Object.values(node.children).reduce((a, c) => a + this.du(c), 0) : this.size(node); }
}

/** Chaîne de droits façon ls -l : drwxr-xr-x */
export function modeString(node) {
  const t = node.t === "d" ? "d" : node.t === "l" ? "l" : "-";
  let s = "";
  for (let i = 2; i >= 0; i--) { const b = (node.mode >> (i * 3)) & 7; s += (b & 4 ? "r" : "-") + (b & 2 ? "w" : "-") + (b & 1 ? "x" : "-"); }
  return t + s;
}
export const octal = (node) => (node.mode & 0o777).toString(8).padStart(3, "0");
