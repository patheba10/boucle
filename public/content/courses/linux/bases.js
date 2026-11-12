/* Cours Linux — chapitres 1 (se repérer) et 2 (fichiers). */
import { R } from "./tag.js";

const WSL = R`<p><strong>Sur ta machine.</strong> Sous Windows, ouvre Ubuntu (WSL, voir la page <a href="#installer">Installer</a>) ; sous macOS, le Terminal suffit pour la plupart des commandes. Refais les commandes de la leçon : les sorties seront presque identiques.</p>`;

export default [
  {
    id: "lx-01", section: "Se repérer", title: "Le terminal et l'arborescence", xp: 50,
    theory: R`<p>Presque tous les serveurs, conteneurs et machines du cloud tournent sous Linux, et on les administre au clavier, souvent à distance par SSH, sans interface graphique. Le terminal affiche une <strong>invite</strong> (« prompt ») :</p>
<p>@@eleve@serveur:~$@@ : l'utilisateur @@eleve@@, la machine @@serveur@@, le dossier courant @@~@@ (ton dossier personnel, @@/home/eleve@@), et @@$@@ pour un utilisateur normal (@@#@@ pour root).</p>
<p>Tout part de la <strong>racine</strong> @@/@@. Pas de lettre de lecteur comme @@C:@@ : un disque supplémentaire est « monté » quelque part dans l'arbre.</p>
<ul><li>@@/home@@ : les dossiers des utilisateurs ; @@/root@@ celui de l'administrateur ;</li><li>@@/etc@@ : la configuration (@@/etc/nginx@@, @@/etc/ssh@@, @@/etc/passwd@@) ;</li><li>@@/var@@ : ce qui varie : journaux (@@/var/log@@), sites web (@@/var/www@@), données des services (@@/var/lib@@) ;</li><li>@@/usr/bin@@ : les programmes ; @@/tmp@@ : les fichiers temporaires, vidés au redémarrage ;</li><li>@@/proc@@ et @@/sys@@ : des fichiers virtuels qui exposent le noyau.</li></ul>
<p>Trois commandes pour se repérer : @@pwd@@ (où suis-je ?), @@ls@@ (qu'y a-t-il ici ?), @@cd@@ (aller ailleurs). Un chemin <strong>absolu</strong> commence par @@/@@ ; un chemin <strong>relatif</strong> part du dossier courant. @@.@@ est le dossier courant, @@..@@ le parent, @@~@@ ton dossier personnel, @@cd -@@ revient au précédent.</p>
~~~sh
pwd
ls /
cd /var/log
pwd
ls
cd ..
pwd
cd
pwd
~~~
<p>Astuces qui changent la vie : la touche <kbd>Tab</kbd> complète les noms (deux fois pour voir les choix), la flèche du haut rappelle les commandes précédentes, <kbd>Ctrl</kbd>+<kbd>C</kbd> interrompt une commande.</p>`,
    setup: WSL,
    quiz: [
      { q: "Tu es dans /var/log. Où mène cd ../www ?", options: ["/var/log/www", "/var/www", "/www", "/home/eleve/www"], answer: 1, explain: ".. remonte d'un niveau (/var), puis on descend dans www." },
      { q: "Où chercher la configuration du serveur web nginx ?", options: ["/usr/bin/nginx", "/var/log/nginx", "/etc/nginx", "/home/nginx"], answer: 2, explain: "/etc contient la configuration ; /var/log les journaux ; /usr/bin le programme lui-même." }
    ],
    challenge: {
      prompt: R`<p>Le site de l'équipe est dans @@/var/www@@. Va dans le dossier @@/var/www/boutique/images@@, puis vérifie avec @@pwd@@. Termine en listant son contenu avec @@ls@@ : la dernière commande doit afficher les deux images.</p>`,
      setup: { files: { "/var/www/boutique/index.html": "<h1>Boutique</h1>\n", "/var/www/boutique/images/logo.png": "PNG", "/var/www/boutique/images/banniere.jpg": "JPG" } },
      checks: { cwd: "/var/www/boutique/images", output: "banniere.jpg\nlogo.png" },
      solution: ["cd /var/www/boutique/images", "pwd", "ls"],
      hint: "cd avec le chemin absolu complet, puis ls. Dans le simulateur comme sur une vraie machine, ls trie les noms par ordre alphabétique."
    }
  },
  {
    id: "lx-02", section: "Se repérer", title: "Lister, lire et trouver de l'aide", xp: 55,
    theory: R`<p>@@ls@@ accepte des <strong>options</strong>, qui commencent par un tiret et se combinent : @@ls -la@@ = @@ls -l -a@@.</p>
<ul><li>@@-l@@ : format long (droits, propriétaire, taille, date) ;</li><li>@@-a@@ : affiche aussi les fichiers cachés, ceux dont le nom commence par un point (@@.bashrc@@, @@.env@@) ;</li><li>@@-h@@ : tailles lisibles (@@4.0K@@, @@12M@@) ; @@-t@@ : les plus récents d'abord ; @@-R@@ : récursif.</li></ul>
~~~sh
ls -la
ls -lh /var/log
~~~
<p>Lire un fichier : @@cat@@ affiche tout, @@head -n 5@@ le début, @@tail -n 5@@ la fin, @@less@@ permet de défiler (@@q@@ pour quitter, @@/mot@@ pour chercher). Sur un serveur, @@tail -f /var/log/syslog@@ suit un journal en direct.</p>
~~~sh
cat /etc/os-release
head -n 3 /etc/passwd
tail -n 1 /etc/passwd
~~~
<p><strong>Trouver de l'aide</strong> : @@commande --help@@ (résumé), @@man commande@@ (le manuel complet), ou le site <em>tldr</em> pour des exemples. En entretien, dire « je vérifierais dans le man » est une bonne réponse : personne ne retient toutes les options.</p>`,
    setup: WSL + R`<p>Essaie aussi @@man ls@@ (flèches pour défiler, @@q@@ pour quitter) et @@ls --help | head -20@@.</p>`,
    quiz: [
      { q: "Pourquoi ls ne montre-t-il pas le fichier .env ?", options: ["Il est vide", "Les noms qui commencent par un point sont cachés : il faut ls -a", "Il faut être root", ".env n'est pas un fichier"], answer: 1, explain: "Convention Unix : un point en tête de nom cache le fichier dans ls. Ce n'est pas une protection, seulement de la discrétion." },
      { q: "Quelle commande montre les 20 dernières lignes d'un journal ?", options: ["head -n 20 fichier", "tail -n 20 fichier", "cat -20 fichier", "less +20 fichier"], answer: 1, explain: "tail affiche la fin, et -f la suit en direct." }
    ],
    challenge: {
      prompt: R`<p>Un collègue dit que le projet contient un fichier de configuration caché qui fait planter l'application. Dans @@~/app@@, trouve-le, puis affiche ses <strong>2 dernières lignes</strong> : ta dernière commande doit afficher exactement ces deux lignes.</p>`,
      setup: { files: { "/home/eleve/app/main.py": "print('app')\n", "/home/eleve/app/README.md": "# App\n", "/home/eleve/app/.env": "APP_NAME=boutique\nDEBUG=false\nDB_HOST=localhost\nDB_PORT=54321\n" } },
      checks: { output: "DB_HOST=localhost\nDB_PORT=54321" },
      solution: ["cd ~/app", "ls -a", "tail -n 2 .env"],
      hint: "ls -a révèle les fichiers cachés. Ensuite tail -n 2 suivi du nom du fichier (avec son point)."
    }
  },
  {
    id: "lx-03", section: "Fichiers", title: "Créer, copier, déplacer, supprimer", xp: 60,
    theory: R`<p>Les commandes de base, à connaître par cœur :</p>
<ul><li>@@mkdir dossier@@, et @@mkdir -p a/b/c@@ pour créer toute l'arborescence d'un coup ;</li><li>@@touch fichier@@ : crée un fichier vide (ou met à jour sa date) ; @@echo "texte" > fichier@@ écrit dedans ;</li><li>@@cp source destination@@ copie ; @@cp -r@@ pour un dossier ;</li><li>@@mv source destination@@ déplace <strong>ou renomme</strong> ;</li><li>@@rm fichier@@ supprime ; @@rm -r dossier@@ supprime un dossier et tout son contenu ; @@rmdir@@ seulement un dossier vide.</li></ul>
~~~sh
mkdir -p projet/src projet/docs
touch projet/src/app.py projet/docs/notes.md
cp projet/docs/notes.md projet/docs/notes-v2.md
mv projet/docs/notes-v2.md projet/docs/journal.md
tree projet
! rm projet/src
rm -r projet
ls
~~~
<p><strong>Attention</strong> : il n'y a pas de corbeille. @@rm -rf@@ supprime sans rien demander, et une faute de frappe (@@rm -rf / tmp@@ au lieu de @@/tmp@@) peut détruire un serveur. Vérifie le chemin avec @@ls@@ avant de supprimer, et méfie-toi des variables vides dans les scripts : @@rm -rf "$DOSSIER/"@@ avec @@DOSSIER@@ vide vise la racine.</p>
<p>Les <strong>jokers</strong> (globbing) désignent plusieurs fichiers : @@*.log@@ (tous les .log), @@rapport-??.csv@@ (deux caractères), @@img[0-9].png@@. C'est le shell qui les remplace par la liste des fichiers avant de lancer la commande.</p>`,
    setup: WSL,
    quiz: [
      { q: "Comment renommer rapport.txt en rapport-2026.txt ?", options: ["rename rapport.txt rapport-2026.txt", "mv rapport.txt rapport-2026.txt", "cp -r rapport.txt rapport-2026.txt", "touch rapport-2026.txt"], answer: 1, explain: "mv déplace ou renomme : renommer, c'est déplacer vers un autre nom dans le même dossier." },
      { q: "Que fait rm *.log dans un dossier qui contient app.log, err.log et notes.txt ?", options: ["Supprime le fichier nommé *.log", "Supprime app.log et err.log", "Supprime tout le dossier", "Demande confirmation pour chaque fichier"], answer: 1, explain: "Le shell remplace *.log par la liste des fichiers qui correspondent, puis rm les supprime sans confirmation." }
    ],
    challenge: {
      prompt: R`<p>Ton dossier @@~/telechargements@@ est en désordre. Range-le :</p><ol><li>crée @@~/rapports/2026@@ ;</li><li>déplace-y tous les fichiers @@.csv@@ ;</li><li>copie @@modele.docx@@ dans @@~/rapports@@ (l'original reste en place) ;</li><li>supprime le dossier @@~/telechargements/tmp@@ et tout son contenu.</li></ol>`,
      setup: { files: { "/home/eleve/telechargements/ventes-janvier.csv": "mois,total\njanvier,1200\n", "/home/eleve/telechargements/ventes-fevrier.csv": "mois,total\nfevrier,1350\n", "/home/eleve/telechargements/modele.docx": "DOCX", "/home/eleve/telechargements/photo.jpg": "JPG", "/home/eleve/telechargements/tmp/cache.bin": "x", "/home/eleve/telechargements/tmp/vieux/a.tmp": "y" } },
      checks: { files: {
        "/home/eleve/rapports/2026/ventes-janvier.csv": { type: "f" }, "/home/eleve/rapports/2026/ventes-fevrier.csv": { type: "f" },
        "/home/eleve/telechargements/ventes-janvier.csv": null, "/home/eleve/telechargements/ventes-fevrier.csv": null,
        "/home/eleve/rapports/modele.docx": { type: "f" }, "/home/eleve/telechargements/modele.docx": { type: "f" },
        "/home/eleve/telechargements/tmp": null, "/home/eleve/telechargements/photo.jpg": { type: "f" }
      } },
      solution: ["mkdir -p ~/rapports/2026", "mv ~/telechargements/*.csv ~/rapports/2026/", "cp ~/telechargements/modele.docx ~/rapports/", "rm -r ~/telechargements/tmp"],
      hint: "mkdir -p crée les deux niveaux d'un coup ; mv accepte un joker (*.csv) et un dossier comme destination ; rm -r pour un dossier non vide."
    }
  },
  {
    id: "lx-04", section: "Fichiers", title: "Liens, recherche et archives", xp: 65,
    theory: R`<p><strong>Liens symboliques.</strong> @@ln -s cible lien@@ crée un raccourci. C'est partout dans l'administration : nginx active un site en créant un lien de @@sites-available@@ vers @@sites-enabled@@, et un déploiement bascule de version en faisant pointer @@current@@ vers @@releases/v2@@ (le rollback consiste à remettre le lien vers @@v1@@).</p>
~~~sh
mkdir -p releases/v1 releases/v2
ln -s releases/v1 current
ls -l current
ln -sfn releases/v2 current
ls -l current
~~~
<p><strong>Chercher des fichiers</strong> avec @@find@@ : @@find /var/log -name "*.log"@@, @@find . -type d@@ (dossiers), @@find /tmp -size +10M@@, @@find . -name "*.tmp" -delete@@, ou @@-exec commande {} \;@@ pour agir sur chaque résultat.</p>
~~~sh
mkdir -p site/css site/js
touch site/index.html site/css/style.css site/js/app.js site/js/old.tmp
find site -name "*.js"
find site -type d
find site -name "*.tmp" -delete
find site -type f
~~~
<p><strong>Archives</strong> : @@tar@@ regroupe des fichiers, @@-z@@ compresse en gzip. Mnémotechnique : @@c@@réer, e@@x@@traire, lis@@t@@er, @@v@@erbeux, @@f@@ichier.</p>
~~~sh
mkdir -p config && echo "port=80" > config/app.conf
tar -czf sauvegarde.tar.gz config
tar -tzf sauvegarde.tar.gz
rm -r config
tar -xzf sauvegarde.tar.gz
cat config/app.conf
~~~`,
    setup: WSL,
    quiz: [
      { q: "Pourquoi déployer avec un lien current → releases/v2 plutôt qu'en écrasant les fichiers ?", options: ["C'est plus joli", "La bascule est instantanée, et revenir en arrière consiste à refaire pointer le lien vers v1", "Les liens prennent moins de place", "nginx l'exige"], answer: 1, explain: "On prépare la nouvelle version à côté, puis on bascule d'un coup : pas d'état à moitié copié." },
      { q: "Que fait tar -xzf archive.tar.gz ?", options: ["Crée une archive", "Extrait le contenu de l'archive compressée", "Liste le contenu", "Supprime l'archive"], answer: 1, explain: "x pour extraire, z pour gzip, f pour indiquer le fichier." }
    ],
    challenge: {
      prompt: R`<p>Avant une mise à jour, sauvegarde la configuration et bascule la version :</p><ol><li>crée l'archive @@~/config-backup.tar.gz@@ du dossier @@~/app/config@@ (en lançant @@tar@@ depuis @@~/app@@) ;</li><li>supprime tous les fichiers @@.bak@@ sous @@~/app@@, où qu'ils soient ;</li><li>fais pointer le lien @@~/app/current@@ vers @@releases/v2@@ (il pointe aujourd'hui vers @@releases/v1@@).</li></ol>`,
      setup: { files: { "/home/eleve/app/config/app.conf": "port=8000\n", "/home/eleve/app/config/db.conf": "host=localhost\n", "/home/eleve/app/config/app.conf.bak": "port=7000\n", "/home/eleve/app/releases/v1/main.py": "v1\n", "/home/eleve/app/releases/v2/main.py": "v2\n", "/home/eleve/app/releases/v1/old.bak": "x\n" }, commands: ["cd ~/app && ln -s releases/v1 current"] },
      checks: { files: { "/home/eleve/config-backup.tar.gz": { type: "f", contains: ["config/app.conf", "config/db.conf"] }, "/home/eleve/app/config/app.conf.bak": null, "/home/eleve/app/releases/v1/old.bak": null, "/home/eleve/app/current": { type: "l", target: "releases/v2" }, "/home/eleve/app/config/app.conf": { type: "f" } } },
      solution: ["cd ~/app", "tar -czf ~/config-backup.tar.gz config", "find . -name '*.bak' -delete", "ln -sfn releases/v2 current"],
      hint: "tar -czf ~/config-backup.tar.gz config depuis ~/app. find . -name '*.bak' -delete. Pour remplacer un lien existant : ln -sfn releases/v2 current."
    }
  }
];
