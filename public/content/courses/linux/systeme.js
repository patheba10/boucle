/* Cours Linux — chapitre 6 : processus, ressources, services systemd et journaux. */
import { R } from "./tag.js";

export default [
  {
    id: "lx-11", section: "Processus et services", title: "Processus et ressources", xp: 70,
    theory: R`<p>Un <strong>processus</strong> est un programme en cours d'exécution, identifié par un numéro, le <strong>PID</strong>. Chaque processus appartient à un utilisateur et a un parent (le PID 1, @@systemd@@, est l'ancêtre de tous).</p>
<ul><li>@@ps aux@@ : tous les processus, avec leur utilisateur, leur part de CPU et de mémoire ; @@ps aux --sort=-%cpu | head@@ : les plus gourmands ;</li><li>@@top@@ ou @@htop@@ : la même chose en direct (non simulés ici) ;</li><li>@@pgrep nom@@ trouve un PID, @@kill PID@@ envoie un signal, @@pkill nom@@ par nom.</li></ul>
<p><strong>Les signaux</strong> : @@kill@@ envoie par défaut @@SIGTERM@@ (15), une demande polie : le programme peut sauvegarder et fermer proprement. @@kill -9@@ (@@SIGKILL@@) le tue sans discussion : à réserver aux processus bloqués, car il ne libère ni verrous ni fichiers temporaires. @@Ctrl@@+@@C@@ envoie @@SIGINT@@ au programme au premier plan.</p>
<p><strong>Les ressources</strong> : @@uptime@@ affiche la charge moyenne (à comparer au nombre de cœurs), @@free -h@@ la mémoire, @@df -h@@ l'espace disque par partition, @@du -sh dossier@@ la taille d'un dossier. Un disque plein (@@100%@@ dans @@df@@) est l'une des pannes les plus fréquentes : les journaux qui grossissent sans rotation en sont la cause classique.</p>
~~~sh
ps aux
pgrep -l sshd
uptime
free -h
df -h
du -sh /var/log
~~~`,
    quiz: [
      { q: "Quelle différence entre kill 4242 et kill -9 4242 ?", options: ["Aucune", "kill envoie SIGTERM (le programme peut s'arrêter proprement), -9 envoie SIGKILL (arrêt immédiat, sans nettoyage)", "-9 tue 9 processus", "kill ne marche que pour root"], answer: 1, explain: "On commence toujours par SIGTERM. SIGKILL est le dernier recours." },
      { q: "uptime affiche « load average: 7.80 » sur une machine à 2 cœurs. Qu'en conclure ?", options: ["Tout va bien", "La machine est surchargée : environ 4 fois plus de travail en attente que de cœurs disponibles", "Il reste 7,8 Go de mémoire", "Le disque est plein"], answer: 1, explain: "La charge se compare au nombre de cœurs : au-delà, des processus attendent leur tour." }
    ],
    challenge: {
      prompt: R`<p>Le serveur rame. Un script de rapport lancé par @@www-data@@ s'est emballé et consomme tout le processeur.</p><ol><li>trouve le processus le plus gourmand en CPU ;</li><li>arrête-le proprement (il ne t'appartient pas) ;</li><li>le script a laissé un verrou, @@/tmp/rapport.lock@@ : supprime-le pour qu'il puisse repartir plus tard.</li></ol><p>nginx, lui, doit continuer de tourner.</p>`,
      setup: { commands: ["#apt install nginx", "#touch /tmp/rapport.lock", "#chown www-data:www-data /tmp/rapport.lock"], procs: [{ pid: 4242, user: "www-data", cmd: "python3 /opt/rapports/generer.py --mois 2026-10", cpu: 98.7, mem: 31.4 }, { pid: 4100, user: "eleve", cmd: "vim notes.md", cpu: 0.1, mem: 0.4 }] },
      checks: { processes: { absent: ["generer.py"], present: ["nginx"] }, files: { "/tmp/rapport.lock": null }, services: { nginx: "active" } },
      solution: ["ps aux --sort=-%cpu | head -3", "sudo kill 4242", "sudo rm /tmp/rapport.lock"],
      hint: "ps aux --sort=-%cpu | head montre le coupable et son PID. Il appartient à www-data : il faut sudo pour le tuer, et pour supprimer son fichier dans /tmp."
    }
  },
  {
    id: "lx-12", section: "Processus et services", title: "Services systemd et journaux", xp: 85,
    theory: R`<p>Sur un serveur, les programmes qui doivent tourner en permanence (nginx, une API, une base de données) sont des <strong>services</strong> gérés par <strong>systemd</strong> : il les démarre au boot, les relance s'ils plantent et collecte leurs journaux.</p>
<ul><li>@@systemctl status nginx@@ : état, PID, dernières lignes du journal ;</li><li>@@sudo systemctl start | stop | restart | reload nginx@@ (@@reload@@ relit la configuration sans couper les connexions) ;</li><li>@@sudo systemctl enable nginx@@ : démarrer au boot ; @@enable --now@@ fait les deux d'un coup ;</li><li>@@journalctl -u nginx -n 50@@ : les 50 dernières lignes du journal du service ; @@-f@@ pour suivre ; @@-p err@@ pour les erreurs seulement.</li></ul>
<p>Un service se décrit dans un fichier d'<strong>unité</strong>, par exemple @@/etc/systemd/system/api.service@@ :</p>
~~~text
[Unit]
Description=API de la boutique
After=network.target

[Service]
ExecStart=/opt/api/run.sh
User=www-data
Restart=on-failure

[Install]
WantedBy=multi-user.target
~~~
<p>Après avoir créé ou modifié une unité : @@sudo systemctl daemon-reload@@. Quand un service refuse de démarrer, le réflexe est toujours le même : @@systemctl status@@, puis @@journalctl -u@@ : la cause y est écrite.</p>
~~~sh
systemctl status ssh
! systemctl restart ssh
sudo systemctl restart ssh
systemctl is-active ssh
sudo journalctl -u ssh -n 3
~~~`,
    setup: R`<p><strong>Sur ta machine</strong> (Ubuntu, ou WSL avec systemd activé) : @@systemctl list-units --type=service@@, puis @@journalctl -b -p err@@ pour les erreurs depuis le dernier démarrage.</p>`,
    quiz: [
      { q: "Tu modifies /etc/systemd/system/api.service. Que faire avant de redémarrer le service ?", options: ["Rien", "sudo systemctl daemon-reload, pour que systemd relise l'unité", "Redémarrer la machine", "Supprimer le journal"], answer: 1, explain: "Sans daemon-reload, systemd utilise encore l'ancienne version de l'unité (et le signale dans status)." },
      { q: "Le service ne démarre pas. Où trouver la cause ?", options: ["Dans /etc/passwd", "Dans systemctl status et journalctl -u nom-du-service", "Dans le fichier .bashrc", "Nulle part, il faut réinstaller"], answer: 1, explain: "systemd enregistre la sortie d'erreur du programme et la raison de l'échec (fichier introuvable, droits, port occupé…)." }
    ],
    challenge: {
      prompt: R`<p>L'équipe a livré l'API dans @@/opt/api/run.sh@@. Fais-en un service :</p><ol><li>écris @@/etc/systemd/system/api.service@@ avec @@Description=API boutique@@, @@ExecStart=/opt/api/run.sh@@, @@User=www-data@@, @@Restart=on-failure@@ et @@WantedBy=multi-user.target@@ (sections @@[Unit]@@, @@[Service]@@, @@[Install]@@) ;</li><li>recharge systemd, puis démarre le service et active-le au boot ;</li><li>s'il refuse de démarrer, lis son journal et corrige la cause.</li></ol><p>Astuce : @@printf '[Unit]\nDescription=…\n' | sudo tee fichier@@ écrit un fichier de plusieurs lignes en une commande.</p>`,
      setup: { files: { "/opt/api/run.sh": { content: "#!/bin/bash\nexec python3 -m uvicorn api:app --port 8000\n", mode: "644" } } },
      checks: { files: { "/etc/systemd/system/api.service": { contains: ["[Service]", "ExecStart=/opt/api/run.sh", "User=www-data", "Restart=on-failure", "WantedBy=multi-user.target"] }, "/opt/api/run.sh": { executable: true } }, services: { api: "active" }, enabled: { api: true } },
      solution: ["printf '[Unit]\\nDescription=API boutique\\n\\n[Service]\\nExecStart=/opt/api/run.sh\\nUser=www-data\\nRestart=on-failure\\n\\n[Install]\\nWantedBy=multi-user.target\\n' | sudo tee /etc/systemd/system/api.service", "sudo systemctl daemon-reload", "sudo chmod +x /opt/api/run.sh", "sudo systemctl enable --now api", "systemctl status api"],
      allowFail: [],
      hint: "Si systemctl start échoue, sudo journalctl -u api donne la raison : « Failed at step EXEC spawning /opt/api/run.sh: Permission denied ». Le script n'est pas exécutable : sudo chmod +x, puis relance."
    }
  }
];
