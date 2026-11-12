/* Cours Linux — chapitre 3 : permissions, utilisateurs et sudo. */
import { R } from "./tag.js";

export default [
  {
    id: "lx-05", section: "Permissions et utilisateurs", title: "Lire et changer les droits", xp: 65,
    theory: R`<p>Chaque fichier a un <strong>propriétaire</strong>, un <strong>groupe</strong>, et trois jeux de droits : pour le propriétaire (u), le groupe (g) et les autres (o). @@ls -l@@ les affiche :</p>
<p>@@-rwxr-x--- 1 eleve devs 220 Nov 12 09:00 deploy.sh@@</p>
<ul><li>premier caractère : @@-@@ fichier, @@d@@ dossier, @@l@@ lien ;</li><li>@@rwx@@ : le propriétaire @@eleve@@ peut lire (r), écrire (w), exécuter (x) ;</li><li>@@r-x@@ : le groupe @@devs@@ peut lire et exécuter ;</li><li>@@---@@ : les autres, rien.</li></ul>
<p>Sur un <strong>dossier</strong>, @@r@@ permet de lister son contenu, @@w@@ d'y créer ou supprimer des fichiers, et @@x@@ d'y entrer (@@cd@@) et d'accéder à ce qu'il contient.</p>
<p><strong>chmod en octal</strong> : r = 4, w = 2, x = 1, on additionne pour chaque groupe. @@755@@ = @@rwxr-xr-x@@ (scripts, dossiers), @@644@@ = @@rw-r--r--@@ (fichiers ordinaires), @@600@@ = @@rw-------@@ (clés privées, secrets), @@700@@ pour un dossier privé.</p>
<p><strong>chmod symbolique</strong> : @@chmod u+x script.sh@@, @@chmod go-w fichier@@, @@chmod o= secret.txt@@ (aucun droit pour les autres).</p>
~~~sh
echo 'echo bonjour' > salut.sh
ls -l salut.sh
! ./salut.sh
chmod u+x salut.sh
./salut.sh
echo "token=abc123" > secret.env
chmod 600 secret.env
ls -l secret.env
~~~
<p><strong>Pourquoi ça compte</strong> : SSH refuse une clé privée lisible par d'autres (« UNPROTECTED PRIVATE KEY FILE! »), un fichier @@.env@@ en @@644@@ sur un serveur partagé expose les mots de passe, et @@chmod 777@@ « pour que ça marche » est une faille, pas une solution. La valeur par défaut des nouveaux fichiers dépend de l'@@umask@@ (souvent @@022@@ : on retire l'écriture au groupe et aux autres).</p>`,
    quiz: [
      { q: "Que signifie chmod 640 rapport.txt ?", options: ["rw- r-- ---", "rwx r-- ---", "rw- rw- r--", "r-- r-- ---"], answer: 0, explain: "6 = 4+2 (lecture, écriture) pour le propriétaire, 4 (lecture) pour le groupe, 0 pour les autres." },
      { q: "Un script affiche « Permission denied » quand tu tapes ./deploy.sh. Cause probable ?", options: ["Le script est vide", "Il n'a pas le droit d'exécution : chmod u+x deploy.sh", "Il faut le renommer en .exe", "Le dossier est plein"], answer: 1, explain: "Lancer un fichier demande le droit x. bash deploy.sh fonctionne sans, car c'est bash qui lit le fichier." },
      { q: "Pourquoi chmod 777 est-il une mauvaise solution à un problème de droits ?", options: ["Ça ralentit le fichier", "Tout utilisateur de la machine peut alors modifier ou remplacer le fichier, y compris un processus compromis", "Ça ne marche que pour root", "777 n'existe pas"], answer: 1, explain: "On cherche plutôt le bon propriétaire ou le bon groupe, et on donne le minimum." }
    ],
    challenge: {
      prompt: R`<p>Sécurise le projet @@~/deploiement@@ :</p><ol><li>@@deploy.sh@@ doit être exécutable par toi seulement : @@rwx------@@ ;</li><li>@@.env@@ contient des mots de passe : lisible et modifiable par toi seulement ;</li><li>@@README.md@@ : lisible par tout le monde, modifiable par toi seulement ;</li><li>le dossier @@logs@@ : toi tous les droits, ton groupe peut lister et entrer, les autres rien.</li></ol>`,
      setup: { files: { "/home/eleve/deploiement/deploy.sh": { content: "#!/bin/bash\necho deploiement\n", mode: "666" }, "/home/eleve/deploiement/.env": { content: "DB_PASSWORD=s3cr3t\n", mode: "666" }, "/home/eleve/deploiement/README.md": { content: "# Déploiement\n", mode: "600" }, "/home/eleve/deploiement/logs": { dir: true, mode: "777" } } },
      checks: { files: { "/home/eleve/deploiement/deploy.sh": { mode: "700" }, "/home/eleve/deploiement/.env": { mode: "600" }, "/home/eleve/deploiement/README.md": { mode: "644" }, "/home/eleve/deploiement/logs": { mode: "750" } } },
      solution: ["cd ~/deploiement", "chmod 700 deploy.sh", "chmod 600 .env", "chmod 644 README.md", "chmod 750 logs"],
      hint: "En octal : 7 = rwx, 6 = rw-, 5 = r-x, 4 = r--, 0 = ---. Un chiffre pour toi, un pour ton groupe, un pour les autres."
    }
  },
  {
    id: "lx-06", section: "Permissions et utilisateurs", title: "Utilisateurs, groupes et sudo", xp: 70,
    theory: R`<p>Chaque personne et chaque service a son <strong>compte</strong> : @@www-data@@ fait tourner nginx, @@postgres@@ la base de données. Si nginx est compromis, l'attaquant n'a que les droits de @@www-data@@, pas ceux de root. C'est le <strong>moindre privilège</strong>.</p>
<ul><li>@@whoami@@, @@id@@, @@groups@@ : qui suis-je, dans quels groupes ;</li><li>@@/etc/passwd@@ liste les comptes, @@/etc/group@@ les groupes, @@/etc/shadow@@ les mots de passe chiffrés (lisible par root seulement) ;</li><li>@@sudo commande@@ exécute une commande en root si tu fais partie du groupe @@sudo@@. Chaque usage est journalisé : on préfère @@sudo@@ ponctuel à une session root permanente ;</li><li>@@useradd -m alice@@ crée un compte avec son dossier ; @@usermod -aG docker alice@@ ajoute alice au groupe docker (sans @@-a@@, elle quitterait tous ses autres groupes !) ; @@groupadd@@ crée un groupe ;</li><li>@@chown alice:devs fichier@@ change le propriétaire et le groupe (root uniquement), @@chown -R@@ pour un dossier.</li></ul>
~~~sh
id
! cat /etc/shadow
sudo head -n 2 /etc/shadow
sudo useradd -m alice
sudo groupadd devs
sudo usermod -aG devs alice
id alice
~~~
<p><strong>Dossier partagé d'équipe</strong> : un groupe, un dossier qui lui appartient, et des droits @@770@@ (ou @@2770@@ pour que les nouveaux fichiers héritent du groupe). Seuls les membres du groupe y accèdent.</p>
<p>Une nouvelle appartenance à un groupe ne s'applique qu'aux nouvelles sessions : il faut se reconnecter (ou @@newgrp docker@@). C'est la raison classique du « j'ai été ajouté au groupe docker mais ça ne marche toujours pas ».</p>`,
    setup: R`<p><strong>Sur ta machine</strong> (WSL ou Ubuntu) : @@id@@, @@sudo whoami@@, puis crée un utilisateur de test avec @@sudo adduser test@@ et supprime-le avec @@sudo deluser --remove-home test@@.</p>`,
    quiz: [
      { q: "Pourquoi nginx tourne-t-il avec l'utilisateur www-data plutôt qu'en root ?", options: ["C'est plus rapide", "Si nginx est piraté, l'attaquant n'obtient que les droits limités de www-data", "root ne peut pas ouvrir le port 80", "Par habitude"], answer: 1, explain: "Le moindre privilège limite les dégâts d'une compromission." },
      { q: "Que fait usermod -G docker alice (sans -a) ?", options: ["Ajoute alice au groupe docker", "Remplace tous les groupes secondaires d'alice par docker seul", "Crée le groupe docker", "Supprime alice"], answer: 1, explain: "Sans -a (append), -G remplace la liste. Une erreur classique qui retire un utilisateur du groupe sudo." }
    ],
    challenge: {
      prompt: R`<p>Deux développeurs arrivent. Prépare la machine :</p><ol><li>crée les comptes @@alice@@ et @@bob@@, avec leur dossier personnel ;</li><li>crée le groupe @@devs@@ et ajoutes-y les deux ;</li><li>crée le dossier @@/srv/projet@@, qui appartient à @@alice@@ et au groupe @@devs@@ ;</li><li>droits : tout pour le propriétaire et le groupe, rien pour les autres.</li></ol>`,
      setup: {},
      checks: { users: ["alice", "bob"], groups: { alice: ["devs"], bob: ["devs"] }, files: { "/home/alice": { type: "d", owner: "alice" }, "/home/bob": { type: "d", owner: "bob" }, "/srv/projet": { type: "d", owner: "alice", group: "devs", mode: "770" } } },
      solution: ["sudo useradd -m alice", "sudo useradd -m bob", "sudo groupadd devs", "sudo usermod -aG devs alice", "sudo usermod -aG devs bob", "sudo mkdir /srv/projet", "sudo chown alice:devs /srv/projet", "sudo chmod 770 /srv/projet"],
      hint: "Toutes ces commandes demandent sudo. useradd -m crée le dossier personnel ; usermod -aG devs nom ; chown alice:devs ; chmod 770."
    }
  }
];
