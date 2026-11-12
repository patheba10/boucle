/* Cours Linux — chapitres 9 (mises en situation) et 10 (entretien). */
import { R } from "./tag.js";

const SITE_CASSE = "server {\n\tlisten 80 default_server;\n\tserver_name boutique.exemple.ca;\n\troot /var/www/boutique\n\tindex index.html;\n}\n";

export default [
  {
    id: "lx-19", section: "Mises en situation", title: "Incident : le site est tombé", xp: 110,
    theory: R`<p>Il est 9 h, le déploiement de ce matin a modifié la configuration nginx, et le site de la boutique ne répond plus. Méthode d'incident :</p>
<ol><li><strong>Constater</strong> : @@curl -I http://localhost@@, @@systemctl status nginx@@ ;</li><li><strong>Lire</strong> : @@sudo journalctl -u nginx -n 20@@, ou @@/var/log/nginx/error.log@@ ;</li><li><strong>Localiser</strong> : @@sudo nginx -t@@ indique le fichier et la ligne fautifs ;</li><li><strong>Corriger</strong> au plus petit : une ligne, pas une réécriture ;</li><li><strong>Valider</strong> avant d'appliquer : @@sudo nginx -t@@ doit dire « syntax is ok » ;</li><li><strong>Appliquer et vérifier</strong> : @@sudo systemctl restart nginx@@, puis @@curl@@ ;</li><li><strong>Raconter</strong> : un court post-mortem (cause, durée, correctif, et ce qui l'aurait évité, par exemple @@nginx -t@@ dans la CI).</li></ol>
<p>Rappel nginx : chaque directive se termine par un point-virgule, chaque bloc @@{ }@@ est fermé. Les sites sont dans @@/etc/nginx/sites-available/@@ et activés par un lien dans @@sites-enabled/@@.</p>`,
    quiz: [
      { q: "Pourquoi lancer sudo nginx -t avant sudo systemctl restart nginx ?", options: ["C'est plus rapide", "Pour valider la configuration : si elle est fausse, un restart arrêterait le serveur sans pouvoir le relancer", "-t redémarre plus proprement", "Pour vider le cache"], answer: 1, explain: "Avec reload, nginx garde l'ancienne configuration si la nouvelle est invalide ; avec restart, il s'arrête." }
    ],
    challenge: {
      prompt: R`<p>Le site @@http://localhost@@ ne répond plus. Trouve la cause, corrige-la, redémarre nginx et termine par @@curl -s http://localhost@@ : la page doit contenir @@<h1>Boutique</h1>@@.</p>`,
      setup: {
        files: { "/etc/nginx/sites-available/boutique": SITE_CASSE, "/var/www/boutique/index.html": "<!DOCTYPE html>\n<h1>Boutique</h1>\n<p>Bienvenue</p>\n" },
        commands: ["#apt install nginx", "#rm /etc/nginx/sites-enabled/default", "#ln -s /etc/nginx/sites-available/boutique /etc/nginx/sites-enabled/boutique", "#systemctl restart nginx"],
        allowFail: true
      },
      checks: { services: { nginx: "active" }, files: { "/etc/nginx/sites-available/boutique": { contains: ["root /var/www/boutique;", "index index.html;", "listen 80 default_server;"] } }, outputHas: ["<h1>Boutique</h1>"] },
      solution: ["systemctl status nginx", "sudo nginx -t", "sudo sed -i 's|root /var/www/boutique$|root /var/www/boutique;|' /etc/nginx/sites-available/boutique", "sudo nginx -t", "sudo systemctl restart nginx", "curl -s http://localhost"],
      allowFail: ["systemctl status nginx", "sudo nginx -t"],
      hint: "sudo nginx -t donne le fichier et la ligne : « invalid number of arguments in \"root\" ». Sans point-virgule, root avale la ligne suivante. Ajoute le « ; » avec sudo sed -i, revalide, puis redémarre."
    }
  },
  {
    id: "lx-20", section: "Mises en situation", title: "Script de sauvegarde avec rotation", xp: 120,
    theory: R`<p>Un grand classique, en entretien comme en poste : un script de sauvegarde lancé par cron chaque nuit. Ce qu'on attend d'un script de production :</p>
<ul><li>il <strong>valide ses entrées</strong> (nombre d'arguments, existence de la source) et échoue avec un message clair et un code non nul ;</li><li>il est <strong>idempotent</strong> autant que possible : le relancer ne casse rien (@@mkdir -p@@) ;</li><li>il nomme ses fichiers de façon <strong>triable</strong> : @@sauvegarde-2026-11-12.tar.gz@@ (@@date +%F@@), de sorte que l'ordre alphabétique est l'ordre chronologique ;</li><li>il fait la <strong>rotation</strong> : ne garder que les N dernières archives, sinon le disque finit plein ;</li><li>il dit ce qu'il a fait, pour le journal.</li></ul>
<p>Briques utiles : @@tar -czf archive.tar.gz -C dossier-parent nom@@ (archive avec un chemin relatif propre), @@ls -1 motif | sort@@, @@head -n -3@@ (tout sauf les 3 dernières lignes), @@xargs -r rm -f@@ (supprimer ce qui arrive sur l'entrée, et ne rien faire si elle est vide).</p>
~~~sh
mkdir -p arch && cd arch
touch sauvegarde-2026-11-08.tar.gz sauvegarde-2026-11-09.tar.gz sauvegarde-2026-11-10.tar.gz sauvegarde-2026-11-11.tar.gz
ls -1 sauvegarde-*.tar.gz | sort | head -n -3
ls -1 sauvegarde-*.tar.gz | sort | head -n -3 | xargs -r rm -f
ls
date +%F
~~~`,
    quiz: [
      { q: "Pourquoi nommer les archives sauvegarde-AAAA-MM-JJ plutôt que sauvegarde-JJ-MM-AAAA ?", options: ["C'est la norme française", "Avec l'année en premier, l'ordre alphabétique est l'ordre chronologique : sort et la rotation deviennent triviaux", "Les noms sont plus courts", "tar l'exige"], answer: 1, explain: "Le format ISO 8601 (date +%F) se trie naturellement." }
    ],
    challenge: {
      kind: "script", file: "/home/eleve/sauvegarder.sh",
      prompt: R`<p>Écris @@sauvegarder.sh SOURCE DESTINATION@@ :</p><ul><li>sans exactement deux arguments : @@usage : sauvegarder.sh SOURCE DESTINATION@@ sur la sortie d'erreur, code @@1@@ ;</li><li>si @@SOURCE@@ n'est pas un dossier : @@source introuvable : SOURCE@@ sur la sortie d'erreur, code @@2@@ ;</li><li>crée @@DESTINATION@@ si besoin, puis l'archive @@DESTINATION/sauvegarde-AAAA-MM-JJ.tar.gz@@ du dossier source (date du jour avec @@date +%F@@) ;</li><li>ne garde que les <strong>3</strong> archives @@sauvegarde-*.tar.gz@@ les plus récentes dans @@DESTINATION@@ ;</li><li>affiche @@sauvegarde créée : CHEMIN-DE-L-ARCHIVE@@.</li></ul><p>Sur la machine de test, la date du jour est le @@2026-11-12@@.</p>`,
      starter: R`#!/bin/bash
set -euo pipefail
# Usage : sauvegarder.sh SOURCE DESTINATION

`,
      solution: R`#!/bin/bash
set -euo pipefail
# Usage : sauvegarder.sh SOURCE DESTINATION
if [ $# -ne 2 ]; then
  echo "usage : sauvegarder.sh SOURCE DESTINATION" >&2
  exit 1
fi
source_dir="$1"
dest="$2"
if [ ! -d "$source_dir" ]; then
  echo "source introuvable : $source_dir" >&2
  exit 2
fi
mkdir -p "$dest"
archive="$dest/sauvegarde-$(date +%F).tar.gz"
tar -czf "$archive" -C "$(dirname "$source_dir")" "$(basename "$source_dir")"
ls -1 "$dest"/sauvegarde-*.tar.gz | sort | head -n -3 | xargs -r rm -f
echo "sauvegarde créée : $archive"
`,
      setup: { files: { "/home/eleve/projet/app.py": "print('app')\n", "/home/eleve/projet/config/app.conf": "port=8000\n" } },
      tests: [
        { args: [], code: 1, err: "usage" },
        { args: ["/home/eleve/absent", "/home/eleve/sauvegardes"], code: 2, err: "source introuvable : /home/eleve/absent" },
        { label: "Première sauvegarde : le dossier de destination est créé", args: ["/home/eleve/projet", "/home/eleve/sauvegardes"], code: 0, out: "sauvegarde créée : /home/eleve/sauvegardes/sauvegarde-2026-11-12.tar.gz", checks: { files: { "/home/eleve/sauvegardes/sauvegarde-2026-11-12.tar.gz": { contains: ["projet/app.py", "projet/config/app.conf"] } } } },
        { label: "Rotation : il reste les 3 archives les plus récentes", args: ["/home/eleve/projet", "/home/eleve/sauvegardes"], code: 0,
          setup: { files: { "/home/eleve/sauvegardes/sauvegarde-2026-11-08.tar.gz": "x", "/home/eleve/sauvegardes/sauvegarde-2026-11-09.tar.gz": "x", "/home/eleve/sauvegardes/sauvegarde-2026-11-10.tar.gz": "x", "/home/eleve/sauvegardes/sauvegarde-2026-11-11.tar.gz": "x", "/home/eleve/sauvegardes/notes.txt": "à garder" } },
          checks: { files: { "/home/eleve/sauvegardes/sauvegarde-2026-11-08.tar.gz": null, "/home/eleve/sauvegardes/sauvegarde-2026-11-09.tar.gz": null, "/home/eleve/sauvegardes/sauvegarde-2026-11-10.tar.gz": { type: "f" }, "/home/eleve/sauvegardes/sauvegarde-2026-11-11.tar.gz": { type: "f" }, "/home/eleve/sauvegardes/sauvegarde-2026-11-12.tar.gz": { type: "f" }, "/home/eleve/sauvegardes/notes.txt": { type: "f" } } } }
      ],
      hint: "Valide les arguments, mkdir -p, puis tar -czf \"$archive\" -C \"$(dirname \"$1\")\" \"$(basename \"$1\")\". Pour la rotation : ls -1 \"$dest\"/sauvegarde-*.tar.gz | sort | head -n -3 | xargs -r rm -f."
    }
  },
  {
    id: "lx-21", section: "Entretien", title: "Questions d'entretien Linux", xp: 60, theoryOnly: true,
    theory: R`<p>Les questions Linux reviennent dans presque tous les entretiens DevOps, SRE et cloud. Réponds à voix haute avant d'ouvrir chaque réponse.</p>
<div class="qa">
<details><summary>Que se passe-t-il quand tu tapes ls -l dans un terminal ?</summary><p>Le shell lit la ligne, la découpe en mots, fait les expansions (variables, jokers), cherche @@ls@@ dans les dossiers du @@PATH@@, crée un processus enfant (fork) qui charge le programme (exec) avec ses arguments ; @@ls@@ lit le dossier par des appels système, écrit sur sa sortie standard, et le shell récupère son code de sortie. Bonus : les droits (x sur le dossier, r pour lister).</p></details>
<details><summary>Le disque est plein. Comment trouves-tu le coupable ?</summary><p>@@df -h@@ pour voir quelle partition, puis @@du -sh /var/* | sort -h@@ en descendant dans l'arborescence, ou @@find / -xdev -size +500M@@. Souvent des journaux sans rotation ou des images Docker. Piège : un fichier supprimé mais encore ouvert par un processus occupe toujours la place (@@lsof +L1@@) ; il faut redémarrer le processus ou vider le fichier avec @@truncate -s 0@@.</p></details>
<details><summary>Différence entre un processus et un thread ? Entre SIGTERM et SIGKILL ?</summary><p>Un processus a son propre espace mémoire ; les threads d'un même processus partagent la mémoire. SIGTERM demande un arrêt propre que le programme peut intercepter ; SIGKILL est imposé par le noyau, sans nettoyage possible.</p></details>
<details><summary>Explique chmod 750 et le rôle du x sur un dossier.</summary><p>Propriétaire : lecture, écriture, exécution ; groupe : lecture et exécution ; autres : rien. Sur un dossier, x permet d'y entrer et d'accéder à son contenu par son nom ; r permet de lister les noms.</p></details>
<details><summary>Un service ne démarre pas. Ta démarche ?</summary><p>@@systemctl status@@, puis @@journalctl -u service -n 50@@ : la cause y est presque toujours (fichier ou droit manquant, port déjà pris, configuration invalide). Selon le cas : @@ss -tlnp@@, @@nginx -t@@ ou l'équivalent, les droits de l'utilisateur du service. Une correction minimale, une validation, un redémarrage, une vérification avec @@curl@@.</p></details>
<details><summary>Qu'est-ce qu'un inode ? Lien symbolique ou lien physique ?</summary><p>L'inode stocke les métadonnées d'un fichier (droits, propriétaire, taille, emplacement des données) ; le nom n'est qu'une entrée de dossier qui pointe vers l'inode. Un lien physique est un deuxième nom pour le même inode (même partition, pas de dossiers) ; un lien symbolique est un petit fichier qui contient un chemin, et il se casse si la cible disparaît.</p></details>
<details><summary>Que fait set -euo pipefail ?</summary><p>@@-e@@ arrête le script à la première commande en échec, @@-u@@ refuse les variables non définies, @@pipefail@@ fait échouer un pipeline dès qu'une de ses commandes échoue. Ensemble, ils transforment des erreurs silencieuses en arrêts visibles.</p></details>
<details><summary>Comment sécuriser un serveur Linux exposé sur Internet ?</summary><p>Mises à jour automatiques de sécurité, SSH par clés seulement et sans root, pare-feu qui n'ouvre que les ports nécessaires, comptes et services avec le moindre privilège, fail2ban ou équivalent contre la force brute, journaux centralisés, sauvegardes testées.</p></details>
<details><summary>Que signifie la charge moyenne (load average) ?</summary><p>Le nombre moyen de processus qui veulent le processeur ou attendent une entrée-sortie, sur 1, 5 et 15 minutes. À comparer au nombre de cœurs (@@nproc@@) : 4 sur une machine à 4 cœurs est une pleine charge ; une charge haute avec un processeur peu utilisé indique souvent des attentes disque ou réseau.</p></details>
<details><summary>Comment trouver quel processus écoute sur le port 8080 ?</summary><p>@@sudo ss -tlnp | grep 8080@@ (ou @@sudo lsof -i :8080@@). Puis @@ps -fp PID@@ pour savoir ce que c'est, et @@systemctl status@@ s'il s'agit d'un service.</p></details>
</div>`,
    practice: { title: "S'entraîner", body: R`<p>Choisis trois questions, réponds en deux minutes chacune et enregistre-toi. Puis refais les mises en situation de ce chapitre sous WSL, sans regarder les indices : en entretien technique, on te demandera souvent de partager ton écran et de diagnostiquer en direct.</p>` },
    quiz: [
      { q: "Un intervieweur demande : « df dit 100 %, mais du ne trouve rien de gros. » Quelle piste ?", options: ["Le disque est défectueux", "Un fichier supprimé est encore ouvert par un processus : la place n'est libérée qu'à sa fermeture (lsof +L1)", "du est bogué", "Il faut formater"], answer: 1, explain: "Classique avec un journal supprimé pendant que le service écrit encore dedans." },
      { q: "Quelle réponse montre la meilleure démarche face à un service qui ne démarre pas ?", options: ["« Je redémarre le serveur »", "« Je lis systemctl status puis journalctl -u, j'identifie la cause, je corrige au plus petit, je valide et je vérifie »", "« Je réinstalle le paquet »", "« Je mets chmod 777 partout »"], answer: 1, explain: "Constater, lire, corriger, valider, vérifier : c'est ce que l'intervieweur veut entendre." }
    ]
  }
];
