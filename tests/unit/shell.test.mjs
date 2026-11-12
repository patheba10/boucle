/* Terminal Linux simulé : shell, fichiers, permissions, texte, services, scripts, critères. */
import test from "node:test";
import assert from "node:assert/strict";
import { createShell, evaluate } from "../../public/assets/js/lib/shell/shell.js";
import { runScriptTests, splitCommands } from "../../public/assets/js/lib/shterm.js";

const LOG = `203.0.113.5 - - [12/Nov/2026:09:00:01 +0000] "GET / HTTP/1.1" 200 612
198.51.100.7 - - [12/Nov/2026:09:00:02 +0000] "GET /admin HTTP/1.1" 404 162
203.0.113.5 - - [12/Nov/2026:09:00:03 +0000] "POST /login HTTP/1.1" 500 30
192.0.2.44 - - [12/Nov/2026:09:00:04 +0000] "GET /api HTTP/1.1" 200 88
`;
const run = (sh, c) => sh.run(c);

test("navigation, fichiers et messages GNU", () => {
  const sh = createShell();
  assert.equal(run(sh, "pwd").out, "/home/eleve\n");
  assert.equal(run(sh, "mkdir -p a/b && cd a/b && pwd").out, "/home/eleve/a/b\n");
  assert.equal(sh.prompt(), "eleve@serveur:~/a/b$ ");
  const r = run(sh, "cd /nulle/part");
  assert.equal(r.code, 1); assert.equal(r.err, "bash: cd: /nulle/part: No such file or directory\n");
  assert.equal(run(sh, "cd ~ && rm a").err, "rm: cannot remove 'a': Is a directory\n");
  assert.equal(run(sh, "rm -r a && ls a").code, 2);
  assert.equal(run(sh, "foo").err, "bash: foo: command not found\n");
  assert.match(run(sh, "vim x").err, /n'est pas simulé/);
});

test("redirections, pipes et codes de sortie", () => {
  const sh = createShell({ files: { "/var/log/nginx/access.log": LOG } });
  run(sh, "echo un > f.txt; echo deux >> f.txt");
  assert.equal(run(sh, "cat f.txt").out, "un\ndeux\n");
  assert.equal(run(sh, "wc -l < f.txt").out, "2\n");
  assert.equal(run(sh, "ls /nope 2> err.txt; cat err.txt").out, "ls: cannot access '/nope': No such file or directory\n");
  assert.equal(run(sh, "ls /nope > tout.txt 2>&1; wc -l < tout.txt").out, "1\n");
  assert.equal(run(sh, "ls /nope 2>/dev/null; echo $?").out, "2\n");
  assert.equal(run(sh, "grep -q 500 /var/log/nginx/access.log && echo trouvé || echo absent").out, "trouvé\n");
  assert.equal(run(sh, "awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head -1").out, "      2 203.0.113.5\n");
  assert.equal(run(sh, "cut -d' ' -f9 /var/log/nginx/access.log | sort | uniq -c | sort -k2").out, "      2 200\n      1 404\n      1 500\n");
  assert.equal(run(sh, "awk '$9 >= 400 {n++} END {print n}' /var/log/nginx/access.log").out, "2\n");
  assert.equal(run(sh, "sed -n '2p' /var/log/nginx/access.log | cut -d'\"' -f2").out, "GET /admin HTTP/1.1\n");
  assert.equal(run(sh, "false | true; echo $?").out, "0\n");
  assert.equal(run(sh, "set -o pipefail; false | true; echo $?").out, "1\n");
});

test("expansions : variables, $(…), $((…)), globbing, guillemets", () => {
  const sh = createShell();
  run(sh, "touch a.log b.log c.txt");
  assert.equal(run(sh, "echo *.log").out, "a.log b.log\n");
  assert.equal(run(sh, "echo '*.log' \"$HOME\"").out, "*.log /home/eleve\n");
  assert.equal(run(sh, "n=$(ls *.log | wc -l); echo \"$n fichiers, double : $((n * 2))\"").out, "2 fichiers, double : 4\n");
  assert.equal(run(sh, "f=archive.tar.gz; echo ${f%%.*} ${f#*.} ${f/tar/zip}").out, "archive tar.gz archive.zip.gz\n");
  assert.equal(run(sh, "echo ${INCONNU:-defaut}").out, "defaut\n");
  assert.equal(run(sh, "x='a  b'; for w in $x; do echo \"[$w]\"; done").out, "[a]\n[b]\n");
  assert.equal(run(sh, "x='a  b'; for w in \"$x\"; do echo \"[$w]\"; done").out, "[a  b]\n");
});

test("permissions, utilisateurs et sudo", () => {
  const sh = createShell();
  assert.equal(run(sh, "cat /etc/shadow").err, "cat: /etc/shadow: Permission denied\n");
  assert.equal(run(sh, "sudo head -1 /etc/shadow").out, "root:*:20000:0:99999:7:::\n");
  run(sh, "echo secret > cle.txt && chmod 600 cle.txt");
  assert.match(run(sh, "ls -l cle.txt").out, /^-rw------- 1 eleve eleve/);
  run(sh, "chmod u+x,g+r cle.txt");
  assert.match(run(sh, "ls -l cle.txt").out, /^-rwxr-----/);
  assert.equal(run(sh, "chown root cle.txt").err, "chown: changing ownership of 'cle.txt': Operation not permitted\n");
  assert.equal(run(sh, "sudo useradd -m alice && sudo groupadd devs && sudo usermod -aG devs alice && id alice").out, "uid=1001(alice) gid=1003(alice) groups=1003(alice),1004(devs)\n".replace(/1003/g, String(sh.fs.groups.alice.gid)).replace(/1004/, String(sh.fs.groups.devs.gid)));
  run(sh, "sudo mkdir /srv/partage && sudo chown alice:devs /srv/partage && sudo chmod 770 /srv/partage");
  assert.equal(run(sh, "touch /srv/partage/x").err, "touch: cannot touch '/srv/partage/x': Permission denied\n");
  const res = evaluate(sh, { files: { "/srv/partage": { type: "d", mode: "770", owner: "alice", group: "devs" } }, groups: { alice: ["devs"] }, users: ["alice"] });
  assert.deepEqual(res.filter((r) => !r.ok), []);
});

test("services systemd, journal et réseau", () => {
  const sh = createShell();
  assert.match(run(sh, "systemctl restart ssh").err, /Interactive authentication required/);
  run(sh, "sudo apt install nginx");
  assert.equal(run(sh, "systemctl is-active nginx").out, "active\n");
  assert.match(run(sh, "curl -s localhost").out, /Welcome to nginx/);
  assert.equal(run(sh, "curl -s localhost:8080; echo $?").out, "7\n");
  // Une configuration cassée empêche le redémarrage
  run(sh, "echo 'server { listen 80 }' | sudo tee /etc/nginx/sites-enabled/site > /dev/null");
  const r = run(sh, "sudo systemctl restart nginx");
  assert.equal(r.code, 1); assert.match(r.err, /Job for nginx.service failed/);
  assert.match(run(sh, "sudo journalctl -u nginx -n 3").out, /is not terminated by ";"/);
  assert.equal(run(sh, "systemctl status nginx; echo $?").out.split("\n").pop() === "" ? run(sh, "systemctl is-active nginx").out : "", "failed\n");
  run(sh, "echo 'server { listen 80; }' | sudo tee /etc/nginx/sites-enabled/site > /dev/null");
  assert.equal(run(sh, "sudo systemctl restart nginx && systemctl is-active nginx").out, "active\n");
  assert.match(run(sh, "ss -tln").out, /0\.0\.0\.0:80 /);
  assert.deepEqual(evaluate(sh, { services: { nginx: "active", ssh: "active" }, enabled: { nginx: true }, packages: ["nginx"] }).filter((x) => !x.ok), []);
});

test("processus et cron", () => {
  const sh = createShell();
  assert.match(run(sh, "ps aux").out, /sshd/);
  assert.equal(run(sh, "kill 701").err, "bash: kill: (701) - Operation not permitted\n");
  run(sh, "sudo kill 701");
  assert.equal(run(sh, "systemctl is-active ssh").out, "inactive\n");
  assert.equal(run(sh, "crontab -l").err, "no crontab for eleve\n");
  run(sh, "echo '0 3 * * * /home/eleve/sauvegarde.sh' > c.txt && crontab c.txt");
  assert.equal(run(sh, "crontab -l").out, "0 3 * * * /home/eleve/sauvegarde.sh\n");
  assert.equal(run(sh, "echo 'tous les jours' | crontab -").code, 1);
  assert.deepEqual(evaluate(sh, { cron: ["0 3 * * *"] }).map((x) => x.ok), [true]);
});

test("scripts : shebang, droit d'exécution, arguments, set -e, fonctions", () => {
  const sh = createShell();
  run(sh, "cat > s.sh <<'EOF'\n#!/bin/bash\nset -euo pipefail\nsaluer() { local nom=\"$1\"; echo \"Bonjour $nom\"; }\nif [ $# -lt 1 ]; then\n  echo \"usage: $0 nom\" >&2\n  exit 2\nfi\nfor n in \"$@\"; do saluer \"$n\"; done\ncat /inexistant\necho jamais\nEOF");
  assert.equal(run(sh, "./s.sh").err, "bash: ./s.sh: Permission denied\n");
  run(sh, "chmod +x s.sh");
  const a = run(sh, "./s.sh");
  assert.equal(a.code, 2); assert.equal(a.err, "usage: ./s.sh nom\n");
  const b = run(sh, "./s.sh Ada 'Grace H'");
  assert.equal(b.out, "Bonjour Ada\nBonjour Grace H\n"); assert.equal(b.code, 1); assert.match(b.err, /cat: \/inexistant: No such file or directory/);
  assert.equal(run(sh, "i=0; while [ $i -lt 3 ]; do i=$((i+1)); done; echo $i").out, "3\n");
  assert.equal(run(sh, "case nginx.conf in *.conf) echo config;; *) echo autre;; esac").out, "config\n");
});

test("défis de scripts et découpage des commandes", () => {
  const ch = { file: "/home/eleve/compter.sh", tests: [{ args: ["/var/log"], outHas: "fichiers" }, { args: [], code: 1 }] };
  const sol = '#!/bin/bash\n[ $# -eq 1 ] || { echo "usage" >&2; exit 1; }\necho "$(ls "$1" | wc -l) fichiers"\n';
  assert.deepEqual(runScriptTests(ch, sol).map((r) => r.ok), [true, true]);
  assert.deepEqual(runScriptTests(ch, "echo bonjour").map((r) => r.ok), [false, false]);
  assert.deepEqual(splitCommands("ls\nfor i in 1 2; do\n  echo $i\ndone\n# commentaire\ncat <<EOF\na\nEOF"), ["ls", "for i in 1 2; do\n  echo $i\ndone", "cat <<EOF\na\nEOF"]);
});

test("critères : sortie, fichiers, inconnu", () => {
  const sh = createShell();
  run(sh, "mkdir -p projet && echo 'x' > projet/a.txt && ln -s projet/a.txt lien && cd projet");
  assert.deepEqual(evaluate(sh, { cwd: "/home/eleve/projet", files: { "/home/eleve/projet/a.txt": "x", "/home/eleve/lien": { type: "l", target: "projet/a.txt" }, "/home/eleve/b": null } }).filter((r) => !r.ok), []);
  run(sh, "ls");
  assert.deepEqual(evaluate(sh, { output: "a.txt", exit: 0 }).map((r) => r.ok), [true, true]);
  assert.throws(() => evaluate(sh, { inconnu: 1 }), /critère de vérification inconnu/);
});

test("sprint 4.2 : trap, mktemp, find -mtime, unités systemd, ssh-keygen, services de l'exercice", () => {
  const sh = createShell({
    procs: [{ pid: 3001, cmd: "python3 fuite.py", cpu: 97.5, mem: 42.1 }],
    files: { "/var/backups/a.tar.gz": { content: "x", age: 10 }, "/var/backups/b.tar.gz": { content: "y", age: 2 } },
    services: { api: { ports: [8000], routes: { "/health": [200, '{"status":"ok"}'] } } },
  });
  run(sh, "cat > t.sh <<'EOF'\ntmp=$(mktemp)\ntrap 'rm -f \"$tmp\"; echo nettoyé' EXIT\necho données > \"$tmp\"\nexit 3\nEOF");
  const t = run(sh, "bash t.sh");
  assert.equal(t.out, "nettoyé\n"); assert.equal(t.code, 3);
  assert.equal(run(sh, "find /var/backups -name '*.tar.gz' -mtime +7").out, "/var/backups/a.tar.gz\n");
  assert.match(run(sh, "ps aux --sort=-%cpu | sed -n 2p").out, /fuite\.py/);
  run(sh, "sudo kill 3001");
  assert.deepEqual(evaluate(sh, { processes: { absent: ["fuite.py"] } }).map((r) => r.ok), [true]);
  assert.equal(run(sh, "curl -s localhost:8000/health").out, '{"status":"ok"}');
  // Une unité systemd écrite à la main
  run(sh, "printf '#!/bin/bash\\necho tic\\n' > tic.sh && sudo mv tic.sh /usr/local/bin/tic");
  run(sh, "printf '[Unit]\\nDescription=Tic\\n[Service]\\nExecStart=/usr/local/bin/tic\\n[Install]\\nWantedBy=multi-user.target\\n' | sudo tee /etc/systemd/system/tic.service > /dev/null");
  const f = run(sh, "sudo systemctl start tic");
  assert.equal(f.code, 1);
  assert.match(run(sh, "sudo journalctl -u tic").out, /Failed at step EXEC spawning \/usr\/local\/bin\/tic: Permission denied/);
  run(sh, "sudo chmod +x /usr/local/bin/tic && sudo systemctl daemon-reload && sudo systemctl enable --now tic");
  assert.deepEqual(evaluate(sh, { services: { tic: "active" }, enabled: { tic: true } }).filter((r) => !r.ok), []);
  run(sh, "ssh-keygen -t ed25519 -N '' -f ~/.ssh/id_ed25519");
  assert.deepEqual(evaluate(sh, { files: { "/home/eleve/.ssh": { type: "d", mode: "700" }, "/home/eleve/.ssh/id_ed25519": { mode: "600" }, "/home/eleve/.ssh/id_ed25519.pub": { contains: "ssh-ed25519 " } } }).filter((r) => !r.ok), []);
});

test("options : chiffres déclarés, xargs à la POSIX, nginx et services en échec", () => {
  const sh = createShell({ files: { "/home/eleve/a/s-1.tgz": "x", "/home/eleve/a/s-2.tgz": "x", "/home/eleve/a/s-3.tgz": "x" } });
  assert.equal(run(sh, "ls -1 a").out, "s-1.tgz\ns-2.tgz\ns-3.tgz\n");
  // Les options après la commande lancée par xargs lui appartiennent.
  run(sh, "ls -1 a/s-*.tgz | sort | head -n -2 | xargs -r rm -f");
  assert.equal(run(sh, "ls a").out, "s-2.tgz  s-3.tgz\n");
  assert.equal(run(sh, "true | xargs -r rm -f").code, 0);
  // Sans « ; », root avale la directive suivante : nginx refuse la configuration.
  run(sh, "sudo apt install -y nginx");
  run(sh, "printf 'server {\\n\\tlisten 8080;\\n\\troot /var/www/html\\n\\tindex index.html;\\n}\\n' | sudo tee /etc/nginx/sites-enabled/test > /dev/null");
  const t = run(sh, "sudo nginx -t");
  assert.equal(t.code, 1);
  assert.match(t.err, /invalid number of arguments in "root" directive in \/etc\/nginx\/sites-enabled\/test:4/);
  // Un service en échec dès la mise en place a un journal dans l'ordre.
  const sv = createShell({ services: { api: { ports: [8000], failed: true, src: "python3", journal: ["ERROR: boom"] } } });
  const j = run(sv, "sudo journalctl -u api").out.trim().split("\n");
  assert.match(j[0], /Started api\.service/);
  assert.match(j[1], /python3\[\d+\]: ERROR: boom/);
  assert.match(j[j.length - 1], /Failed with result 'exit-code'/);
  assert.equal(run(sv, "systemctl is-active api").out, "failed\n");
});
