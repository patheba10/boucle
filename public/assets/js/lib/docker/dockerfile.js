/* Dockerfile : analyse, règles de hadolint et vérifications de BuildKit (codes et messages réels). */

export class DockerfileError extends Error { constructor(msg, line) { super(msg); this.line = line; } }

const KNOWN = new Set(["FROM", "RUN", "CMD", "LABEL", "MAINTAINER", "EXPOSE", "ENV", "ADD", "COPY", "ENTRYPOINT", "VOLUME", "USER", "WORKDIR", "ARG", "ONBUILD", "STOPSIGNAL", "HEALTHCHECK", "SHELL"]);

/** Découpe une commande en mots (guillemets simples et doubles). */
export function words(s) {
  const out = []; let cur = "", q = null, has = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === q) q = null; else if (c === "\\" && q === '"' && i + 1 < s.length) cur += s[++i]; else cur += c; continue; }
    if (c === "'" || c === '"') { q = c; has = true; continue; }
    if (/\s/.test(c)) { if (cur || has) out.push(cur); cur = ""; has = false; continue; }
    if (c === "\\" && i + 1 < s.length) { cur += s[++i]; continue; }
    cur += c;
  }
  if (cur || has) out.push(cur);
  return out;
}

/** Analyse : [{ line, op, raw, args, json, flags, stage }] et les étapes [{ base, name, start }]. */
export function parseDockerfile(text) {
  const src = String(text).replace(/\r/g, "").split("\n");
  const ins = []; let buf = "", start = 0;
  for (let i = 0; i < src.length; i++) {
    const l = src[i];
    if (!buf && (/^\s*#/.test(l) || !l.trim())) continue;
    if (buf && /^\s*#/.test(l)) continue;
    if (!buf) start = i + 1;
    if (/\\\s*$/.test(l)) { buf += l.replace(/\\\s*$/, "") + " "; continue; }
    buf += l; ins.push({ line: start, text: buf.trim() }); buf = "";
  }
  if (buf.trim()) ins.push({ line: start, text: buf.trim() });
  const stages = []; const out = [];
  for (const { line, text: t } of ins) {
    const m = /^(\S+)\s*([\s\S]*)$/.exec(t); const op = m[1].toUpperCase(); let rest = m[2];
    if (!KNOWN.has(op)) throw new DockerfileError("dockerfile parse error on line " + line + ": unknown instruction: " + m[1], line);
    const flags = {};
    if (["COPY", "ADD", "RUN", "FROM", "HEALTHCHECK"].includes(op)) { let f; while ((f = /^--([a-z-]+)(?:=(\S+))?\s*/.exec(rest))) { flags[f[1]] = f[2] ?? true; rest = rest.slice(f[0].length); } }
    let json = null;
    if (/^\[/.test(rest.trim())) { try { const j = JSON.parse(rest.trim()); if (Array.isArray(j) && j.every((x) => typeof x === "string")) json = j; } catch (e) { /* forme shell */ } }
    const it = { line, op, keyword: m[1], raw: t, args: rest.trim(), json, flags, stage: stages.length - 1 };
    if (op === "FROM") {
      const w = words(rest); if (!w.length) throw new DockerfileError("dockerfile parse error on line " + line + ": FROM requires either one or three arguments", line);
      if (w.length !== 1 && w.length !== 3) throw new DockerfileError("dockerfile parse error on line " + line + ": FROM requires either one or three arguments", line);
      stages.push({ base: w[0], name: w.length === 3 ? w[2].toLowerCase() : null, asKeyword: w[1] || null, start: out.length, line });
      it.stage = stages.length - 1;
    } else if (!stages.length && op !== "ARG") throw new DockerfileError("dockerfile parse error on line " + line + ": no build stage in current context", line);
    out.push(it);
  }
  if (!stages.length) throw new DockerfileError("the Dockerfile cannot be empty", 0);
  return { ins: out, stages };
}

const RULES = {
  DL3000: ["error", "Use absolute WORKDIR"],
  DL3002: ["warning", "Last USER should not be root"],
  DL3003: ["warning", "Use WORKDIR to switch to a directory"],
  DL3004: ["error", "Do not use sudo as it leads to unpredictable behavior. Use a tool like gosu to enforce root"],
  DL3006: ["warning", "Always tag the version of an image explicitly"],
  DL3007: ["warning", "Using latest is prone to errors if the image will ever update. Pin the version explicitly to a release tag"],
  DL3008: ["warning", "Pin versions in apt get install. Instead of `apt-get install <package>` use `apt-get install <package>=<version>`"],
  DL3009: ["info", "Delete the apt-get lists after installing something"],
  DL3011: ["error", "Valid UNIX ports range from 0 to 65535"],
  DL3013: ["warning", "Pin versions in pip. Instead of `pip install <package>` use `pip install <package>==<version>` or `pip install --requirement <requirements file>`"],
  DL3014: ["warning", "Use the `-y` switch to avoid manual input `apt-get -y install <package>`"],
  DL3015: ["info", "Avoid additional packages by specifying `--no-install-recommends`"],
  DL3018: ["warning", "Pin versions in apk add. Instead of `apk add <package>` use `apk add <package>=<version>`"],
  DL3019: ["info", "Use the `--no-cache` switch to avoid the need to use `--update` and remove `/var/cache/apk/*` when done installing packages"],
  DL3020: ["error", "Use COPY instead of ADD for files and folders"],
  DL3022: ["warning", "`COPY --from` should reference a previously defined `FROM` alias"],
  DL3025: ["warning", "Use arguments JSON notation for CMD and ENTRYPOINT arguments"],
  DL3027: ["warning", "Do not use apt as it is meant to be an end-user tool, use apt-get or apt-cache instead"],
  DL3042: ["warning", "Avoid use of cache directory with pip. Use `pip install --no-cache-dir <package>`"],
  DL3045: ["warning", "`COPY` to a relative destination without `WORKDIR` set."],
  DL3059: ["info", "Multiple consecutive `RUN` instructions. Consider consolidation."],
  DL4000: ["error", "MAINTAINER is deprecated"],
  DL4006: ["warning", "Set the SHELL option -o pipefail before RUN with a pipe in it. If you are using /bin/sh in an alpine image or if your shell is symlinked to busybox then consider explicitly setting your SHELL to /bin/ash, or disable this check"]
};
export const RULE_TEXT = RULES;

const segs = (cmd) => cmd.split(/&&|\|\||;/).map((s) => words(s.trim())).filter((w) => w.length);

/** Règles de hadolint : [{ line, code, level, message }], triées par ligne. */
export function lint(text) {
  const { ins, stages } = parseDockerfile(text);
  const found = []; const add = (line, code) => found.push({ line, code, level: RULES[code][0], message: RULES[code][1] });
  const last = stages.length - 1; const aliases = new Set();
  let workdir = false, pipefail = false, prevRun = false, lastUser = null; const pipNoCache = { v: false };
  for (const it of ins) {
    if (it.op === "FROM") {
      const [img] = words(it.args); const ref = img.split("@")[0];
      const tagged = /:[^/]+$/.test(ref) || img.includes("@");
      if (ref !== "scratch" && !aliases.has(ref.toLowerCase())) { if (!tagged) add(it.line, "DL3006"); else if (/:latest$/.test(ref)) add(it.line, "DL3007"); }
      if (stages[it.stage].name) aliases.add(stages[it.stage].name);
      workdir = false; prevRun = false; lastUser = null; continue;
    }
    const isRun = it.op === "RUN";
    if (isRun && prevRun) add(it.line, "DL3059");
    prevRun = isRun;
    switch (it.op) {
      case "WORKDIR": workdir = true; if (!/^(\/|\$|[A-Za-z]:)/.test(it.args)) add(it.line, "DL3000"); break;
      case "USER": lastUser = it.args.split(":")[0]; break;
      case "ADD": if (!words(it.args).some((w) => /^https?:\/\//.test(w) || /\.(tar|tar\.gz|tgz|tar\.xz|tar\.bz2)$/.test(w))) add(it.line, "DL3020"); /* falls through */
      case "COPY": {
        const w = it.json || words(it.args); const dest = w[w.length - 1];
        if (it.op === "COPY" && it.flags.from && !aliases.has(String(it.flags.from).toLowerCase()) && !/^\d+$/.test(it.flags.from) && !/[:/]/.test(it.flags.from)) add(it.line, "DL3022");
        if (!workdir && dest && !dest.startsWith("/") && !dest.startsWith("$")) add(it.line, "DL3045");
        break;
      }
      case "CMD": case "ENTRYPOINT": if (!it.json) add(it.line, "DL3025"); break;
      case "EXPOSE": for (const p of it.args.split(/\s+/)) { const n = parseInt(p, 10); if (!(n >= 0 && n <= 65535)) add(it.line, "DL3011"); } break;
      case "MAINTAINER": add(it.line, "DL4000"); break;
      case "SHELL": if (it.json && it.json.includes("pipefail")) pipefail = true; break;
      case "ENV": if (/PIP_NO_CACHE_DIR\s*[= ]\s*(1|true|on|yes|off|0)/i.test(it.args)) pipNoCache.v = true; break;
      case "RUN": {
        const cmd = it.json ? it.json.join(" ") : it.args;
        if (/(^|[^|])\|([^|]|$)/.test(cmd) && !pipefail && !it.json) add(it.line, "DL4006");
        const ss = segs(cmd);
        let aptInstall = false;
        for (const w of ss) {
          const c = w[0];
          if (c === "sudo") add(it.line, "DL3004");
          if (c === "cd") add(it.line, "DL3003");
          if (c === "apt" && w.includes("install")) add(it.line, "DL3027");
          if ((c === "apt-get" || c === "apt") && w.includes("install")) {
            aptInstall = true;
            const pk = w.slice(w.indexOf("install") + 1).filter((x) => !x.startsWith("-"));
            if (pk.some((p) => !p.includes("="))) add(it.line, "DL3008");
            if (!w.some((x) => x === "--no-install-recommends")) add(it.line, "DL3015");
            if (!w.some((x) => /^-[a-z]*y|^--yes$|^--assume-yes$|^-qq?y$/.test(x))) add(it.line, "DL3014");
          }
          if (c === "apk" && w.includes("add")) {
            const pk = w.slice(w.indexOf("add") + 1).filter((x) => !x.startsWith("-"));
            if (pk.some((p) => !p.includes("="))) add(it.line, "DL3018");
            if (!w.includes("--no-cache")) add(it.line, "DL3019");
          }
          const pipAt = w.findIndex((x, i) => /^pip3?$/.test(x) || (/^python3?$/.test(x) && w[i + 1] === "-m" && /^pip3?$/.test(w[i + 2])));
          if (pipAt >= 0 && w.includes("install")) {
            const rest = w.slice(w.indexOf("install") + 1);
            if (!rest.includes("--no-cache-dir") && !pipNoCache.v) add(it.line, "DL3042");
            const req = rest.some((x) => x === "-r" || x === "--requirement" || x.startsWith("--requirement=") || x === "-e" || x === ".");
            const pk = rest.filter((x, i) => !x.startsWith("-") && !["-r", "--requirement", "-c", "--constraint"].includes(rest[i - 1]));
            if (!req && pk.some((p) => !/[=<>~]=|@|\.whl$|\.tar\.gz$|^\.$|^\//.test(p))) add(it.line, "DL3013");
          }
        }
        if (aptInstall && it.stage === last && !/rm\s+-[a-z]*r[a-z]*f?\s+\/var\/lib\/apt\/lists/.test(cmd) && !/apt-get\s+clean/.test(cmd)) add(it.line, "DL3009");
        break;
      }
    }
  }
  if (lastUser !== null && /^(root|0)$/.test(lastUser)) add(ins.filter((i) => i.op === "USER" && i.stage === last).pop().line, "DL3002");
  return found.sort((a, b) => a.line - b.line || a.code.localeCompare(b.code));
}

/** Vérifications intégrées à `docker build` (BuildKit) : [{ rule, message, line }]. */
export function buildChecks(text) {
  const { ins, stages } = parseDockerfile(text); const out = [];
  for (const s of stages) if (s.asKeyword && (s.asKeyword === s.asKeyword.toUpperCase()) !== (ins.find((i) => i.line === s.line).keyword === "FROM")) out.push({ rule: "FromAsCasing", message: "'" + s.asKeyword + "' and '" + ins.find((i) => i.line === s.line).keyword + "' keywords' casing do not match", line: s.line });
  const secret = /(?:^|_)(?:apikey|auth|credential|credentials|key|password|pass|pword|passwd|secret|token)(?:_|$)/i;
  for (const it of ins) {
    if ((it.op === "CMD" || it.op === "ENTRYPOINT") && !it.json) out.push({ rule: "JSONArgsRecommended", message: "JSON arguments recommended for " + it.op + " to prevent unintended behavior related to OS signals", line: it.line });
    if (it.op === "ENV" || it.op === "ARG") for (const name of envNames(it)) if (secret.test(name)) out.push({ rule: "SecretsUsedInArgOrEnv", message: "Do not use ARG or ENV instructions for sensitive data (" + it.op + ' "' + name + '")', line: it.line });
    if (it.op === "MAINTAINER") out.push({ rule: "MaintainerDeprecated", message: "Maintainer instruction is deprecated in favor of using label", line: it.line });
    if (it.op === "WORKDIR" && !/^(\/|\$)/.test(it.args)) out.push({ rule: "WorkdirRelativePath", message: 'Relative workdir "' + it.args + '" can have unexpected results if the base image changes', line: it.line });
  }
  return out;
}

/** Variables d'une instruction ENV ou ARG : « A=1 B=2 » ou « A 1 ». */
export function envPairs(it) {
  const w = words(it.args);
  if (it.op === "ENV" && w.length >= 2 && !w[0].includes("=")) return [[w[0], it.args.slice(it.args.indexOf(w[0]) + w[0].length).trim()]];
  return w.map((x) => { const i = x.indexOf("="); return i < 0 ? [x, undefined] : [x.slice(0, i), x.slice(i + 1)]; });
}
const envNames = (it) => envPairs(it).map(([k]) => k);
