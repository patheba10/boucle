/* Cours Linux — chapitre 8 : réseau, SSH et tâches planifiées. */
import { R } from "./tag.js";

export default [
  {
    id: "lx-16", section: "Réseau, SSH et cron", title: "Réseau : ports, DNS et HTTP", xp: 80,
    theory: R`<p>Quand « le site ne répond pas », on remonte les couches une par une :</p>
<ol><li><strong>Le nom se résout-il ?</strong> @@dig +short api.exemple.ca@@ (ou @@nslookup@@) ; @@/etc/hosts@@ peut forcer une adresse en local ;</li><li><strong>La machine est-elle joignable ?</strong> @@ping -c 3 hôte@@ (beaucoup de serveurs bloquent le ping : un échec n'est pas une preuve) ;</li><li><strong>Le service écoute-t-il ?</strong> @@ss -tlnp@@ liste les ports TCP en écoute (@@t@@ TCP, @@l@@ en écoute, @@n@@ numérique, @@p@@ processus, avec @@sudo@@) ;</li><li><strong>Répond-il correctement ?</strong> @@curl -i http://localhost:8000/health@@ affiche le code HTTP et les en-têtes ; @@curl -I@@ les en-têtes seulement.</li></ol>
<p>Les ports à connaître : 22 (SSH), 80 (HTTP), 443 (HTTPS), 5432 (PostgreSQL), 3306 (MySQL), 6379 (Redis). Un service qui écoute sur @@127.0.0.1@@ n'est joignable que depuis la machine elle-même ; sur @@0.0.0.0@@, depuis le réseau (si le pare-feu, @@ufw@@ sur Ubuntu, le permet).</p>
~~~sh
ip a
dig +short exemple.ca
ping -c 2 exemple.ca
ss -tln
! curl -s http://localhost:8080
sudo apt install nginx
curl -I http://localhost
~~~
<p>Les erreurs de curl se lisent : @@Could not resolve host@@ (DNS), @@Couldn't connect to server@@ (rien n'écoute, ou un pare-feu), un code @@502@@ (le proxy n'atteint pas l'application derrière lui), @@504@@ (elle répond trop lentement).</p>`,
    quiz: [
      { q: "curl affiche « Failed to connect to localhost port 8000: Couldn't connect to server ». Prochaine commande ?", options: ["dig localhost", "ss -tlnp, pour voir si quelque chose écoute sur le port 8000", "chmod 777 /", "ping 8.8.8.8"], answer: 1, explain: "La connexion est refusée : soit le service est arrêté, soit il écoute sur un autre port ou une autre adresse." },
      { q: "Une base PostgreSQL écoute sur 127.0.0.1:5432. Une autre machine peut-elle s'y connecter ?", options: ["Oui, toujours", "Non : 127.0.0.1 n'accepte que les connexions de la machine elle-même", "Seulement en HTTPS", "Seulement en root"], answer: 1, explain: "C'est d'ailleurs le bon réglage par défaut pour une base de données." }
    ],
    challenge: {
      prompt: R`<p>L'API (service @@api@@, port @@8000@@) ne répond plus depuis qu'un collègue a fait un test. Diagnostique et répare :</p><ol><li>trouve pourquoi le service a échoué (statut, journal, ports) ;</li><li>supprime la cause sans toucher au service @@ssh@@ ;</li><li>redémarre @@api@@ ;</li><li>termine par @@curl -s http://localhost:8000/health@@, qui doit afficher @@{"status":"ok"}@@.</li></ol>`,
      setup: {
        services: { api: { desc: "API boutique", ports: [8000], exec: "/usr/bin/python3 -m uvicorn api:app --host 0.0.0.0 --port 8000", failed: true, bindMsg: "ERROR:    [Errno 98] error while attempting to bind on address ('0.0.0.0', {port}): address already in use", routes: { "/health": [200, '{"status":"ok"}'] }, src: "python3", journal: ["INFO:     Started server process", "ERROR:    [Errno 98] error while attempting to bind on address ('0.0.0.0', 8000): address already in use"] } },
        procs: [{ pid: 5150, user: "eleve", cmd: "python3 -m http.server 8000", port: 8000, cpu: 0.0, mem: 0.3 }]
      },
      checks: { services: { api: "active", ssh: "active" }, processes: { absent: ["http.server"] }, outputHas: ['{"status":"ok"}'] },
      solution: ["systemctl status api", "sudo journalctl -u api -n 5", "ss -tlnp", "kill 5150", "sudo systemctl restart api", "curl -s http://localhost:8000/health"],
      allowFail: ["systemctl status api"],
      hint: "Le journal dit « address already in use ». ss -tlnp montre qui occupe le port 8000 : un serveur de test lancé par toi-même. Arrête-le avec kill, puis sudo systemctl restart api."
    }
  },
  {
    id: "lx-17", section: "Réseau, SSH et cron", title: "SSH : clés et durcissement", xp: 85,
    theory: R`<p>SSH ouvre un shell chiffré sur une machine distante : @@ssh eleve@203.0.113.10@@. Deux façons de s'authentifier :</p>
<ul><li>par mot de passe : vulnérable aux attaques par force brute (les journaux d'un serveur exposé en montrent des milliers par jour) ;</li><li>par <strong>paire de clés</strong> : @@ssh-keygen -t ed25519@@ crée une clé privée (@@~/.ssh/id_ed25519@@, qui ne quitte jamais ta machine, protégée par une phrase de passe) et une clé publique (@@.pub@@) qu'on dépose sur le serveur dans @@~/.ssh/authorized_keys@@ (@@ssh-copy-id@@ le fait pour toi).</li></ul>
<p>SSH est strict sur les droits : @@~/.ssh@@ en @@700@@, @@authorized_keys@@ et la clé privée en @@600@@, le tout appartenant à l'utilisateur. Sinon, il refuse la clé sans message clair côté client.</p>
<p><strong>Durcir le serveur</strong> dans @@/etc/ssh/sshd_config@@ : @@PasswordAuthentication no@@ (clés seulement), @@PermitRootLogin no@@ (on se connecte en utilisateur, puis @@sudo@@), éventuellement @@AllowUsers@@. Toujours tester dans une <strong>seconde</strong> session avant de fermer la première : une erreur et tu perds l'accès. @@sudo sshd -t@@ vérifie la syntaxe, puis @@sudo systemctl reload ssh@@.</p>
~~~sh
ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519 -C "eleve@portable"
ls -la ~/.ssh
cat ~/.ssh/id_ed25519.pub
~~~
<p>Côté client, @@~/.ssh/config@@ évite de retaper les options (@@Host prod@@, @@HostName@@, @@User@@, @@IdentityFile@@), et @@scp@@ ou @@rsync -avz@@ copient des fichiers par SSH.</p>`,
    setup: R`<p><strong>Sur ta machine</strong> : @@ssh-keygen -t ed25519 -C "ton-compte@users.noreply.github.com"@@, puis ajoute le contenu de la clé publique à GitHub (<em>Settings → SSH and GPG keys</em>) et teste avec @@ssh -T git@github.com@@. C'est la même mécanique que pour un serveur.</p>`,
    quiz: [
      { q: "Quel fichier ne doit jamais quitter ta machine ?", options: ["id_ed25519.pub", "id_ed25519", "authorized_keys", "known_hosts"], answer: 1, explain: "La clé privée prouve ton identité. La clé publique, elle, peut être copiée partout." },
      { q: "Tu passes PasswordAuthentication à no et tu recharges SSH. Bonne pratique avant de fermer ta session ?", options: ["Redémarrer la machine", "Ouvrir une seconde session SSH pour vérifier que la connexion par clé fonctionne toujours", "Supprimer ta clé publique", "Rien"], answer: 1, explain: "Si la configuration est mauvaise, la session encore ouverte te permet de corriger." }
    ],
    challenge: {
      prompt: R`<p>Prépare le serveur pour les déploiements automatiques :</p><ol><li>génère pour toi une clé @@ed25519@@ sans phrase de passe dans @@~/.ssh/id_ed25519@@ (c'est un exercice) ;</li><li>autorise cette clé à se connecter au compte @@deploy@@ : ajoute ta clé publique dans @@/home/deploy/.ssh/authorized_keys@@ ;</li><li>droits stricts : @@/home/deploy/.ssh@@ en @@700@@ et @@authorized_keys@@ en @@600@@, appartenant tous deux à @@deploy@@ ;</li><li>durcis @@/etc/ssh/sshd_config@@ : @@PasswordAuthentication no@@ et @@PermitRootLogin no@@ ; puis recharge le service @@ssh@@.</li></ol>`,
      setup: { commands: ["#useradd -m deploy"] },
      checks: { files: {
        "/home/eleve/.ssh/id_ed25519": { mode: "600" }, "/home/deploy/.ssh": { type: "d", mode: "700", owner: "deploy" },
        "/home/deploy/.ssh/authorized_keys": { mode: "600", owner: "deploy", contains: "ssh-ed25519 " },
        "/etc/ssh/sshd_config": { contains: ["PasswordAuthentication no", "PermitRootLogin no"], lacks: ["PasswordAuthentication yes", "PermitRootLogin prohibit-password"] }
      }, services: { ssh: "active" } },
      solution: ["ssh-keygen -t ed25519 -N '' -f ~/.ssh/id_ed25519", "sudo mkdir -p /home/deploy/.ssh", "cat ~/.ssh/id_ed25519.pub | sudo tee -a /home/deploy/.ssh/authorized_keys", "sudo chown -R deploy:deploy /home/deploy/.ssh", "sudo chmod 700 /home/deploy/.ssh", "sudo chmod 600 /home/deploy/.ssh/authorized_keys", "sudo sed -i 's/^PasswordAuthentication yes/PasswordAuthentication no/; s/^PermitRootLogin .*/PermitRootLogin no/' /etc/ssh/sshd_config", "sudo systemctl reload ssh"],
      hint: "La clé publique se copie avec cat … | sudo tee -a fichier. Ensuite chown -R deploy:deploy, chmod 700 et 600. Pour sshd_config, sudo sed -i avec deux remplacements séparés par ; ."
    }
  },
  {
    id: "lx-18", section: "Réseau, SSH et cron", title: "Planifier avec cron", xp: 70,
    theory: R`<p><strong>cron</strong> lance des commandes à heure fixe. Chaque ligne d'une crontab a cinq champs de temps, puis la commande :</p>
~~~text
# min heure jour-du-mois mois jour-de-semaine  commande
  30  2     *            *    *                /home/eleve/sauvegarde.sh
  */5 *     *            *    *                /usr/local/bin/sonde.sh
  0   9     *            *    1-5              /usr/local/bin/rapport.sh
  0   4     *            *    0                /usr/local/bin/nettoyage.sh
~~~
<p>Soit : tous les jours à 2 h 30 ; toutes les 5 minutes ; à 9 h du lundi au vendredi ; le dimanche à 4 h (0 et 7 désignent le dimanche). Le site <em>crontab.guru</em> traduit une expression en français courant.</p>
<ul><li>@@crontab -l@@ affiche ta crontab, @@crontab -e@@ l'édite, @@crontab fichier@@ la remplace ;</li><li>cron n'a pas ton environnement : chemins <strong>absolus</strong> partout, et pas de @@~@@ ni d'alias ;</li><li>sans redirection, la sortie est perdue : @@>> /var/log/sauvegarde.log 2>&1@@ ;</li><li>dans une crontab, @@%@@ a un sens spécial : écris @@\%@@ dans @@date +\%F@@.</li></ul>
~~~sh
! crontab -l
echo '30 2 * * * /home/eleve/sauvegarde.sh >> /home/eleve/sauvegarde.log 2>&1' > ma-crontab
crontab ma-crontab
crontab -l
~~~
<p>Sur les distributions récentes, les <strong>timers systemd</strong> remplacent souvent cron : journalisation intégrée, rattrapage des exécutions manquées (@@Persistent=true@@).</p>`,
    quiz: [
      { q: "Que signifie */15 8-18 * * 1-5 ?", options: ["Toutes les 15 heures", "Toutes les 15 minutes, de 8 h à 18 h, du lundi au vendredi", "Le 15 de chaque mois à 8 h", "Une fois par semaine"], answer: 1, explain: "*/15 sur les minutes, 8-18 sur les heures, 1-5 sur les jours de la semaine." },
      { q: "Un script marche à la main mais pas depuis cron. Cause la plus fréquente ?", options: ["cron est trop lent", "L'environnement de cron est minimal : chemins relatifs, PATH réduit, variables absentes", "cron ne lance que des scripts Python", "Il faut redémarrer la machine"], answer: 1, explain: "Chemins absolus, et redirection de la sortie vers un journal pour voir l'erreur." }
    ],
    challenge: {
      prompt: R`<p>Installe ta crontab avec exactement ces deux tâches :</p><ol><li>@@/home/eleve/sauvegarde.sh@@ <strong>tous les jours à 2 h 30</strong>, sortie et erreurs ajoutées à @@/home/eleve/sauvegarde.log@@ ;</li><li>@@/home/eleve/nettoyage.sh@@ <strong>le dimanche à 4 h 00</strong> (écris le dimanche @@0@@).</li></ol><p>Les deux scripts existent déjà, mais l'un n'est pas exécutable : cron ne pourrait pas le lancer. Corrige-le.</p>`,
      setup: { files: { "/home/eleve/sauvegarde.sh": { content: "#!/bin/bash\ntar -czf /home/eleve/sauvegarde.tar.gz /home/eleve/projet\n", mode: "755" }, "/home/eleve/nettoyage.sh": { content: "#!/bin/bash\nfind /tmp -name '*.tmp' -delete\n", mode: "644" } } },
      checks: { cron: ["30 2 * * * /home/eleve/sauvegarde.sh >> /home/eleve/sauvegarde.log 2>&1", "0 4 * * 0 /home/eleve/nettoyage.sh"], files: { "/home/eleve/nettoyage.sh": { executable: true } } },
      solution: ["chmod +x ~/nettoyage.sh", "echo '30 2 * * * /home/eleve/sauvegarde.sh >> /home/eleve/sauvegarde.log 2>&1' > taches.cron", "echo '0 4 * * 0 /home/eleve/nettoyage.sh' >> taches.cron", "crontab taches.cron", "crontab -l"],
      hint: "Écris les deux lignes dans un fichier (echo … > fichier, puis echo … >> fichier), installe-le avec crontab fichier, et vérifie avec crontab -l. ls -l montre quel script n'a pas le x."
    }
  }
];
