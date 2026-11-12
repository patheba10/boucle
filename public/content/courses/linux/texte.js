/* Cours Linux — chapitres 4 (traiter du texte) et 5 (pipes, redirections, codes de sortie). */
import { R, ACCESS_LOG } from "./tag.js";

const LOGS = { files: { "/var/log/nginx/access.log": { content: ACCESS_LOG, mode: "644" } } };
const APP_LOG = `2026-11-12 09:00:01 INFO  api démarrage version=2.4.1
2026-11-12 09:00:05 INFO  api GET /api/produits 200 12ms
2026-11-12 09:00:09 WARN  db  requête lente 1840ms
2026-11-12 09:00:12 ERROR api GET /api/panier 500 base de données injoignable
2026-11-12 09:00:13 INFO  api GET /api/produits 200 9ms
2026-11-12 09:00:18 ERROR api POST /api/commandes 500 base de données injoignable
2026-11-12 09:00:20 WARN  api quota proche 92%
2026-11-12 09:00:31 INFO  api GET /api/panier 200 15ms
2026-11-12 09:00:40 ERROR auth jeton expiré user=1042
`;

export default [
  {
    id: "lx-07", section: "Traiter du texte", title: "Chercher avec grep", xp: 65,
    theory: R`<p>Les journaux, les fichiers de configuration et les sorties de commandes sont du texte. @@grep@@ affiche les lignes qui contiennent un motif :</p>
<ul><li>@@grep ERROR app.log@@ ; @@-i@@ ignore la casse ; @@-v@@ inverse (les lignes qui ne contiennent <em>pas</em> le motif) ;</li><li>@@-n@@ numéros de ligne ; @@-c@@ compte ; @@-r@@ cherche dans tout un dossier ; @@-l@@ liste seulement les fichiers qui contiennent le motif ;</li><li>@@-E@@ pour une expression régulière étendue : @@grep -E "ERROR|WARN"@@, @@grep -E " 5[0-9]{2} "@@ (codes HTTP 500 à 599) ; @@-o@@ n'affiche que la partie qui correspond ;</li><li>@@-w@@ mot entier, @@-x@@ ligne entière.</li></ul>
<p>Rappels de regex : @@^@@ début de ligne, @@$@@ fin, @@.@@ n'importe quel caractère, @@*@@ zéro ou plus, @@[0-9]@@ un chiffre, @@\.@@ un vrai point.</p>
~~~sh
printf 'INFO ok\nERROR disque plein\nWARN lent\nerror minuscule\n' > app.log
grep ERROR app.log
grep -i error app.log
grep -c -v INFO app.log
grep -n -E "ERROR|WARN" app.log
grep -ril "port" /etc/ssh
~~~
<p>En production, on commence presque toujours un diagnostic par @@grep@@ dans les journaux : « depuis quand ? combien ? quelle requête ? ».</p>`,
    setup: R`<p><strong>Sur ta machine</strong> : @@grep -r "PermitRootLogin" /etc/ssh/@@, ou @@grep -i error /var/log/syslog | tail@@ (avec @@sudo@@ si nécessaire). Sous WSL, @@journalctl -p err@@ donne aussi les erreurs du système.</p>`,
    quiz: [
      { q: "Quelle commande affiche les lignes de config.ini qui ne sont pas des commentaires (lignes qui commencent par #) ?", options: ["grep '#' config.ini", "grep -v '^#' config.ini", "grep -c '#' config.ini", "grep -w '#' config.ini"], answer: 1, explain: "^# désigne un # en début de ligne, et -v garde les lignes qui ne correspondent pas." },
      { q: "Que compte grep -c ' 404 ' access.log ?", options: ["Le nombre de fois que 404 apparaît dans tout le fichier", "Le nombre de lignes qui contiennent « 404 » entouré d'espaces", "Le nombre de fichiers", "Le nombre de caractères"], answer: 1, explain: "-c compte des lignes, pas des occurrences. Les espaces évitent de compter une taille de 404 octets ou une URL." }
    ],
    challenge: {
      prompt: R`<p>L'API a renvoyé des erreurs ce matin. Dans @@/var/log/app/api.log@@, affiche avec @@grep@@ <strong>les lignes ERROR et WARN</strong>, avec leur <strong>numéro de ligne</strong>. Ta dernière commande doit afficher exactement ces lignes, dans l'ordre du fichier.</p>`,
      setup: { files: { "/var/log/app/api.log": { content: APP_LOG, mode: "644" } } },
      checks: { output: APP_LOG.split("\n").map((l, i) => [l, i + 1]).filter(([l]) => /ERROR|WARN/.test(l)).map(([l, n]) => n + ":" + l).join("\n") },
      solution: ["grep -n -E 'ERROR|WARN' /var/log/app/api.log"],
      hint: "-n ajoute les numéros, -E permet l'alternative « ERROR|WARN » entre guillemets."
    }
  },
  {
    id: "lx-08", section: "Traiter du texte", title: "Trier, compter, découper", xp: 70,
    theory: R`<p>Une boîte à outils où chaque outil fait une seule chose :</p>
<ul><li>@@wc -l@@ compte les lignes (@@-w@@ les mots, @@-c@@ les octets) ;</li><li>@@sort@@ trie (@@-n@@ numérique, @@-r@@ décroissant, @@-k 2@@ selon la 2ᵉ colonne, @@-t ','@@ séparateur, @@-u@@ sans doublons) ;</li><li>@@uniq@@ supprime les doublons <strong>consécutifs</strong> : on trie d'abord. @@uniq -c@@ compte chaque valeur ;</li><li>@@cut -d' ' -f1@@ garde le 1ᵉʳ champ ; @@cut -d',' -f2,3@@ des colonnes d'un CSV ;</li><li>@@tr@@ remplace ou supprime des caractères : @@tr 'a-z' 'A-Z'@@, @@tr -d '\r'@@ (fichiers Windows) ;</li><li>@@head@@ et @@tail@@ pour garder le haut ou le bas d'un classement.</li></ul>
<p>Dans un journal nginx, chaque ligne a la même structure : l'adresse IP est le 1ᵉʳ champ, l'URL le 7ᵉ, le code HTTP le 9ᵉ.</p>
~~~sh
cat > ventes.csv <<'EOF'
ville,produit,montant
Gatineau,clavier,80
Montréal,souris,25
Gatineau,écran,240
Québec,clavier,80
Montréal,écran,240
EOF
tail -n +2 ventes.csv | cut -d',' -f1 | sort | uniq -c
tail -n +2 ventes.csv | sort -t',' -k3 -n -r | head -n 2
wc -l ventes.csv
~~~`,
    quiz: [
      { q: "Pourquoi écrire sort | uniq -c plutôt que uniq -c seul ?", options: ["uniq -c est plus lent sans sort", "uniq ne regroupe que les lignes identiques qui se suivent : il faut d'abord trier", "sort ajoute les nombres", "C'est une convention de style"], answer: 1, explain: "Sans tri, deux occurrences séparées par d'autres lignes seraient comptées séparément." },
      { q: "Dans un CSV « nom,ville,âge », quelle commande garde la colonne ville ?", options: ["cut -f2 fichier.csv", "cut -d',' -f2 fichier.csv", "cut -c2 fichier.csv", "sort -k2 fichier.csv"], answer: 1, explain: "Le séparateur par défaut de cut est la tabulation : il faut -d','." }
    ],
    challenge: {
      prompt: R`<p>Le serveur reçoit des requêtes suspectes. À partir de @@/var/log/nginx/access.log@@, affiche <strong>le nombre de requêtes par adresse IP</strong>, de la plus active à la moins active, au format de @@uniq -c@@. Ta dernière commande doit afficher exactement ce classement (en cas d'égalité, les IP sont triées par ordre alphabétique décroissant, comme le fait @@sort -rn@@).</p>`,
      setup: LOGS,
      checks: { output: "      5 203.0.113.5\n      4 198.51.100.7\n      4 192.0.2.44\n      2 203.0.113.80" },
      solution: ["cut -d' ' -f1 /var/log/nginx/access.log | sort | uniq -c | sort -rn"],
      hint: "Garde le 1er champ (cut -d' ' -f1 ou awk '{print $1}'), trie, compte avec uniq -c, puis trie les comptes du plus grand au plus petit avec sort -rn."
    }
  },
  {
    id: "lx-09", section: "Traiter du texte", title: "sed et awk", xp: 75,
    theory: R`<p><strong>sed</strong> modifie un flux de texte, ligne par ligne. L'usage le plus courant est le remplacement : @@sed 's/ancien/nouveau/g'@@ (@@g@@ = toutes les occurrences de la ligne). Avec @@-i@@, il modifie le fichier en place : c'est ainsi qu'on change une valeur de configuration dans un script.</p>
~~~sh
printf 'port=8000\ndebug=true\nhost=0.0.0.0\n' > app.conf
sed 's/debug=true/debug=false/' app.conf
sed -i 's/^port=.*/port=9000/' app.conf
cat app.conf
sed -n '2p' app.conf
sed '/^host/d' app.conf
~~~
<p><strong>awk</strong> découpe chaque ligne en champs (@@$1@@, @@$2@@… ; @@$0@@ la ligne entière, @@NF@@ le nombre de champs, @@NR@@ le numéro de ligne) et permet de calculer. Un programme awk est une suite de @@motif { action }@@.</p>
~~~sh
printf 'alice 3200\nbob 1500\nchloe 4100\n' > salaires.txt
awk '{print $1}' salaires.txt
awk '$2 > 2000 {print $1, $2}' salaires.txt
awk '{total += $2} END {print "total :", total}' salaires.txt
awk -F: '$3 >= 1000 {print $1}' /etc/passwd
~~~
<p>Les tableaux associatifs d'awk permettent d'agréger en une seule commande : @@awk '{n[$9]++} END {for (c in n) print c, n[c]}' access.log@@ compte les requêtes par code HTTP.</p>`,
    quiz: [
      { q: "Que fait sed -i 's/localhost/db.interne/g' config.yml ?", options: ["Affiche config.yml modifié sans le changer", "Remplace toutes les occurrences de localhost par db.interne directement dans le fichier", "Supprime les lignes contenant localhost", "Compte les occurrences"], answer: 1, explain: "-i (in place) écrit le résultat dans le fichier. Sans -i, sed affiche le résultat." },
      { q: "Dans un journal nginx, que calcule awk '{s += $10} END {print s}' ?", options: ["Le nombre de lignes", "La somme des tailles de réponse (10ᵉ champ), en octets", "Le code HTTP le plus fréquent", "La dernière ligne"], answer: 1, explain: "$10 est la taille de la réponse ; END s'exécute une fois toutes les lignes lues." }
    ],
    challenge: {
      prompt: R`<p>Deux tâches sur le serveur :</p><ol><li>dans @@~/app/config.ini@@, passe le niveau de journalisation de @@DEBUG@@ à @@INFO@@ (ligne @@log_level=DEBUG@@), directement dans le fichier ;</li><li>avec @@awk@@, calcule le <strong>total d'octets envoyés</strong> (10ᵉ champ) dans @@/var/log/nginx/access.log@@ : ta dernière commande doit afficher uniquement ce nombre.</li></ol>`,
      setup: { files: { ...LOGS.files, "/home/eleve/app/config.ini": "[app]\nport=8000\nlog_level=DEBUG\nworkers=4\n" } },
      checks: { files: { "/home/eleve/app/config.ini": "[app]\nport=8000\nlog_level=INFO\nworkers=4\n" }, output: "8336" },
      solution: ["sed -i 's/log_level=DEBUG/log_level=INFO/' ~/app/config.ini", "awk '{s += $10} END {print s}' /var/log/nginx/access.log"],
      hint: "sed -i 's/ancien/nouveau/' fichier. Puis awk avec une variable cumulée et un bloc END qui l'affiche."
    }
  },
  {
    id: "lx-10", section: "Pipes et redirections", title: "Redirections, pipes et codes de sortie", xp: 80,
    theory: R`<p>Chaque commande a trois canaux : l'<strong>entrée standard</strong> (0), la <strong>sortie standard</strong> (1) et la <strong>sortie d'erreur</strong> (2). On les redirige :</p>
<ul><li>@@> fichier@@ écrase, @@>> fichier@@ ajoute à la fin, @@< fichier@@ lit depuis un fichier ;</li><li>@@2> erreurs.txt@@ capture les erreurs ; @@> tout.log 2>&1@@ envoie les deux canaux dans le même fichier (l'ordre compte) ;</li><li>@@> /dev/null@@ jette la sortie : @@commande > /dev/null 2>&1@@ rend une commande silencieuse ;</li><li>@@|@@ (pipe) branche la sortie d'une commande sur l'entrée de la suivante ; @@tee fichier@@ écrit dans un fichier <em>et</em> laisse passer.</li></ul>
<p>Chaque commande renvoie un <strong>code de sortie</strong> : @@0@@ = succès, autre chose = échec. @@$?@@ contient le code de la dernière commande. @@&&@@ enchaîne seulement si la précédente a réussi, @@||@@ seulement si elle a échoué : @@mkdir build && cd build@@, @@grep -q erreur log || echo "rien à signaler"@@.</p>
~~~sh
! ls /etc/hostname /nexiste/pas > sortie.txt 2> erreurs.txt
cat sortie.txt
cat erreurs.txt
ls /nexiste/pas 2>/dev/null; echo "code : $?"
grep -q root /etc/passwd && echo "root existe"
echo "étape 1" | tee journal.txt | tr 'a-z' 'A-Z'
cat journal.txt
~~~
<p>Ces réflexes sont la base des scripts et des pipelines CI : une étape échoue si sa commande renvoie un code différent de 0. Un piège : dans @@commande | tee log@@, c'est le code de @@tee@@ qui compte, sauf avec @@set -o pipefail@@ (chapitre des scripts).</p>`,
    quiz: [
      { q: "Quelle commande envoie la sortie ET les erreurs de build.sh dans build.log ?", options: ["./build.sh 2>&1 > build.log", "./build.sh > build.log 2>&1", "./build.sh | build.log", "./build.sh 2> build.log"], answer: 1, explain: "On redirige d'abord la sortie vers le fichier, puis 2>&1 envoie les erreurs « là où va la sortie ». Dans l'autre ordre, les erreurs restent à l'écran." },
      { q: "make test && ./deploy.sh : que se passe-t-il si les tests échouent ?", options: ["deploy.sh se lance quand même", "deploy.sh ne se lance pas", "Le terminal se ferme", "deploy.sh se lance deux fois"], answer: 1, explain: "&& ne lance la suite que si la commande précédente a renvoyé 0." }
    ],
    challenge: {
      prompt: R`<p>Mise en situation : le site renvoie des erreurs et ton responsable veut un rapport. Dans @@~/rapport@@ (à créer) :</p><ol><li>@@erreurs.log@@ : uniquement les lignes du journal @@/var/log/nginx/access.log@@ dont le code HTTP est @@500@@ ou plus ;</li><li>@@urls-404.txt@@ : les URL qui ont renvoyé @@404@@ (7ᵉ champ), sans doublon, triées ;</li><li>@@resume.txt@@ : une ligne par code HTTP au format de @@uniq -c@@, triée par code (@@200@@ d'abord).</li></ol>`,
      setup: LOGS,
      checks: { files: {
        "/home/eleve/rapport/erreurs.log": ACCESS_LOG.split("\n").filter((l) => /" 5\d\d /.test(l)).join("\n") + "\n",
        "/home/eleve/rapport/urls-404.txt": "/.env\n/admin\n/favicon.ico\n/phpmyadmin\n/wp-login.php\n",
        "/home/eleve/rapport/resume.txt": "      7 200\n      1 201\n      5 404\n      2 500\n"
      } },
      solution: ["mkdir ~/rapport && cd ~/rapport", "awk '$9 >= 500' /var/log/nginx/access.log > erreurs.log", "awk '$9 == 404 {print $7}' /var/log/nginx/access.log | sort -u > urls-404.txt", "awk '{print $9}' /var/log/nginx/access.log | sort | uniq -c > resume.txt"],
      hint: "awk filtre par champ : awk '$9 >= 500' garde les lignes entières. Pour les URL : awk '$9 == 404 {print $7}' puis sort -u. Pour le résumé : extraire $9, sort, uniq -c, et rediriger chaque résultat avec >."
    }
  }
];
