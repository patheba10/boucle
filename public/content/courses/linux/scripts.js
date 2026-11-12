/* Cours Linux — chapitre 7 : variables, environnement et scripts Bash. */
import { R } from "./tag.js";

const LOG_ERR = "2026-11-12 09:00:01 INFO démarrage\n2026-11-12 09:00:12 ERROR base injoignable\n2026-11-12 09:00:13 INFO requête\n2026-11-12 09:00:18 ERROR base injoignable\n2026-11-12 09:00:40 ERROR jeton expiré\n";
const LOG_OK = "2026-11-12 10:00:01 INFO démarrage\n2026-11-12 10:00:05 INFO requête\n";

export default [
  {
    id: "lx-13", section: "Scripts Bash", title: "Variables et environnement", xp: 65,
    theory: R`<p><strong>Variables</strong> : @@nom=valeur@@, sans espace autour du @@=@@ ; on les lit avec @@$nom@@ ou @@\${nom}@@. Toujours entre guillemets doubles : @@"$fichier"@@, sinon un nom contenant un espace devient deux arguments.</p>
~~~sh
ville="Gatineau"
echo "Bonjour de $ville"
echo 'Pas d expansion entre apostrophes : $ville'
fichier="mon rapport.txt"
touch "$fichier"
ls -l "$fichier"
nb=$(ls | wc -l)
echo "$nb fichier(s), le double : $((nb * 2))"
echo "\${INCONNUE:-valeur par défaut}"
~~~
<p><strong>Environnement</strong> : une variable n'est transmise aux programmes lancés que si elle est <strong>exportée</strong> (@@export APP_ENV=production@@). @@env@@ liste l'environnement. Les applications lisent leur configuration ainsi (12-factor) : @@DATABASE_URL@@, @@PORT@@…</p>
<p><strong>PATH</strong> est la liste des dossiers où le shell cherche les commandes. Pour qu'un script de @@~/bin@@ soit appelable par son nom : @@export PATH="$HOME/bin:$PATH"@@. Pour que ce réglage survive à la fermeture du terminal, on l'ajoute à @@~/.bashrc@@, relu à chaque nouvelle session (ou tout de suite avec @@source ~/.bashrc@@).</p>`,
    quiz: [
      { q: "Pourquoi nom = valeur (avec des espaces) échoue-t-il ?", options: ["Les noms doivent être en majuscules", "Bash lance la commande « nom » avec les arguments « = » et « valeur »", "Il faut écrire set nom valeur", "Les espaces sont interdits dans les valeurs"], answer: 1, explain: "L'affectation s'écrit sans espace : nom=valeur. Pour une valeur avec des espaces : nom=\"deux mots\"." },
      { q: "Ton application ne voit pas la variable DB_HOST que tu as définie dans le terminal. Pourquoi ?", options: ["Elle est trop longue", "Elle n'est pas exportée : seules les variables exportées passent aux programmes lancés", "Il faut redémarrer le serveur", "Les variables ne marchent pas en Python"], answer: 1, explain: "export DB_HOST=… la place dans l'environnement des processus enfants." }
    ],
    challenge: {
      prompt: R`<p>Installe ton outil personnel :</p><ol><li>crée @@~/bin/bonjour@@, un script exécutable qui affiche @@Bonjour depuis mon outil@@ ;</li><li>ajoute @@~/bin@@ au début du @@PATH@@ <em>de la session</em> et exporte @@APP_ENV=production@@ ;</li><li>rends ces deux réglages permanents : ajoute à la fin de @@~/.bashrc@@ les lignes @@export PATH="$HOME/bin:$PATH"@@ et @@export APP_ENV=production@@ ;</li><li>termine en lançant simplement @@bonjour@@ (sans chemin).</li></ol>`,
      setup: {},
      checks: { files: { "/home/eleve/bin/bonjour": { executable: true }, "/home/eleve/.bashrc": { contains: ['export PATH="$HOME/bin:$PATH"', "export APP_ENV=production"] } }, env: { APP_ENV: "production" }, output: "Bonjour depuis mon outil" },
      solution: ["mkdir -p ~/bin", "printf '#!/bin/bash\\necho \"Bonjour depuis mon outil\"\\n' > ~/bin/bonjour", "chmod +x ~/bin/bonjour", "echo 'export PATH=\"$HOME/bin:$PATH\"' >> ~/.bashrc", "echo 'export APP_ENV=production' >> ~/.bashrc", "source ~/.bashrc", "bonjour"],
      hint: "Écris les lignes dans .bashrc entre apostrophes pour que $HOME et $PATH ne soient pas remplacés tout de suite. Puis source ~/.bashrc applique tout à la session courante."
    }
  },
  {
    id: "lx-14", section: "Scripts Bash", title: "Premier script : arguments, conditions, codes de sortie", xp: 90,
    theory: R`<p>Un script est un fichier de commandes. La première ligne, le <strong>shebang</strong> @@#!/bin/bash@@, dit quel interpréteur utiliser ; @@chmod +x@@ le rend exécutable.</p>
<ul><li>Arguments : @@$1@@, @@$2@@… ; @@$#@@ leur nombre ; @@"$@"@@ tous, chacun intact ; @@$0@@ le nom du script ;</li><li>Conditions : @@if [ condition ]; then … elif … else … fi@@. Tests de fichiers : @@-f@@ (fichier), @@-d@@ (dossier), @@-e@@ (existe), @@-x@@ (exécutable) ; de texte : @@=@@, @@!=@@, @@-z@@ (vide) ; de nombres : @@-eq@@, @@-ne@@, @@-lt@@, @@-gt@@ ;</li><li>Erreurs : un message sur la sortie d'erreur (@@echo "…" >&2@@) et un code de sortie différent de 0 (@@exit 1@@).</li></ul>
~~~sh
cat > verifier.sh <<'EOF'
#!/bin/bash
if [ $# -ne 1 ]; then
  echo "usage : $0 FICHIER" >&2
  exit 1
fi
if [ -f "$1" ]; then
  echo "$1 existe ($(wc -l < "$1") lignes)"
else
  echo "$1 introuvable" >&2
  exit 2
fi
EOF
chmod +x verifier.sh
! ./verifier.sh
./verifier.sh /etc/hostname
! ./verifier.sh /nulle/part
~~~
<p>Les codes de sortie sont le contrat d'un script : la CI, cron ou un autre script décident de la suite en les lisant.</p>`,
    quiz: [
      { q: "Dans un script lancé par ./script.sh a \"b c\", que vaut $#  ?", options: ["3", "2", "1", "4"], answer: 1, explain: "Les guillemets font de « b c » un seul argument." },
      { q: "Pourquoi écrire le message d'erreur avec >&2 ?", options: ["Pour qu'il soit en rouge", "Pour qu'il aille sur la sortie d'erreur : il ne se mélange pas à la sortie normale qu'on pourrait rediriger ou traiter", "C'est obligatoire avant exit", "Pour l'écrire dans un fichier nommé 2"], answer: 1, explain: "La sortie standard sert aux résultats, la sortie d'erreur aux diagnostics." }
    ],
    challenge: {
      kind: "script", file: "/home/eleve/compter-erreurs.sh",
      prompt: R`<p>Écris @@compter-erreurs.sh@@ qui compte les lignes @@ERROR@@ d'un journal :</p><ul><li>sans argument (ou avec plus d'un) : affiche @@usage : compter-erreurs.sh FICHIER@@ sur la sortie d'erreur et sort avec le code @@1@@ ;</li><li>si le fichier n'existe pas : affiche @@fichier introuvable : CHEMIN@@ sur la sortie d'erreur, code @@2@@ ;</li><li>sinon : affiche @@N erreur(s)@@ (par exemple @@3 erreur(s)@@, ou @@0 erreur(s)@@) et sort avec le code @@0@@.</li></ul><p>Attention : @@grep -c@@ renvoie le code 1 quand il ne trouve rien, même s'il affiche @@0@@.</p>`,
      starter: R`#!/bin/bash
# Usage : compter-erreurs.sh FICHIER

`,
      solution: R`#!/bin/bash
# Usage : compter-erreurs.sh FICHIER
if [ $# -ne 1 ]; then
  echo "usage : compter-erreurs.sh FICHIER" >&2
  exit 1
fi
if [ ! -f "$1" ]; then
  echo "fichier introuvable : $1" >&2
  exit 2
fi
n=$(grep -c "ERROR" "$1" || true)
echo "$n erreur(s)"
`,
      setup: { files: { "/var/log/app/api.log": { content: LOG_ERR, mode: "644" }, "/var/log/app/calme.log": { content: LOG_OK, mode: "644" } } },
      tests: [
        { args: [], code: 1, err: "usage" },
        { args: ["/var/log/app/api.log", "en-trop"], code: 1, err: "usage" },
        { args: ["/var/log/app/absent.log"], code: 2, err: "fichier introuvable : /var/log/app/absent.log" },
        { args: ["/var/log/app/api.log"], out: "3 erreur(s)", code: 0 },
        { args: ["/var/log/app/calme.log"], out: "0 erreur(s)", code: 0 }
      ],
      hint: "Deux if successifs avec [ $# -ne 1 ] puis [ ! -f \"$1\" ]. Pour compter : n=$(grep -c ERROR \"$1\") ; si tu ajoutes set -e, protège-le avec || true."
    }
  },
  {
    id: "lx-15", section: "Scripts Bash", title: "Boucles, fonctions et scripts robustes", xp: 95,
    theory: R`<p><strong>Boucles</strong> : @@for f in *.log; do … done@@ parcourt une liste ; @@while read -r ligne; do … done < fichier@@ lit un fichier ligne par ligne ; @@for i in $(seq 1 5)@@ compte.</p>
<p><strong>Fonctions</strong> : @@verifier() { local url="$1"; … }@@ ; @@local@@ garde la variable dans la fonction ; @@return 1@@ renvoie un code.</p>
<p><strong>Robustesse</strong> : en tête de script, @@set -euo pipefail@@ :</p>
<ul><li>@@-e@@ : arrêter au premier échec (sauf dans un @@if@@, ou avec @@|| true@@) ;</li><li>@@-u@@ : une variable non définie est une erreur, pas une chaîne vide (évite @@rm -rf "$DOSSIER/"@@ avec @@DOSSIER@@ vide) ;</li><li>@@-o pipefail@@ : un pipeline échoue si n'importe quelle commande échoue, pas seulement la dernière.</li></ul>
<p>@@trap 'commande' EXIT@@ s'exécute à la sortie du script, même en cas d'erreur : idéal pour supprimer un fichier temporaire créé avec @@mktemp@@.</p>
~~~sh
cat > urls.txt <<'EOF'
https://exemple.ca
https://api.exemple.ca/sante
EOF
cat > boucle.sh <<'EOF'
#!/bin/bash
set -euo pipefail
tmp=$(mktemp)
trap 'rm -f "$tmp"; echo "(nettoyé)"' EXIT
compter() { wc -l < "$1"; }
while read -r url; do
  echo "à vérifier : $url" >> "$tmp"
done < urls.txt
echo "$(compter "$tmp") URL"
EOF
bash boucle.sh
~~~
<p>Sur ta machine, <strong>shellcheck</strong> repère les erreurs classiques (guillemets oubliés, variables non définies) : c'est le linter à ajouter à la CI d'un dépôt qui contient des scripts.</p>`,
    quiz: [
      { q: "Sans set -o pipefail, que renvoie false | true ?", options: ["1, car false a échoué", "0 : seul le code de la dernière commande compte", "Une erreur de syntaxe", "2"], answer: 1, explain: "C'est pourquoi un « commande | tee log » qui échoue passe inaperçu sans pipefail." },
      { q: "À quoi sert trap 'rm -f \"$tmp\"' EXIT ?", options: ["À empêcher l'arrêt du script", "À supprimer le fichier temporaire à la sortie du script, même s'il s'arrête sur une erreur", "À intercepter Ctrl+C uniquement", "À créer le fichier temporaire"], answer: 1, explain: "EXIT se déclenche quelle que soit la cause de la sortie." }
    ],
    challenge: {
      kind: "script", file: "/home/eleve/verifier-sites.sh",
      prompt: R`<p>Écris @@verifier-sites.sh FICHIER@@, qui teste chaque URL du fichier (une par ligne) :</p><ul><li>pour chaque URL, récupère le code HTTP avec @@curl -s -o /dev/null -w "%{http_code}" URL@@ ;</li><li>affiche @@OK URL@@ si le code est @@200@@, sinon @@KO URL (CODE)@@ ;</li><li>à la fin, sort avec le code @@1@@ si au moins une URL est KO, @@0@@ sinon.</li></ul><p>Sur la machine de test, @@localhost:8000@@ héberge l'API : @@/sante@@ répond 200, @@/panier@@ 500, et rien n'écoute sur le port @@9000@@ (curl donne alors le code @@000@@).</p>`,
      starter: R`#!/bin/bash
set -euo pipefail
# Usage : verifier-sites.sh FICHIER

`,
      solution: R`#!/bin/bash
set -euo pipefail
# Usage : verifier-sites.sh FICHIER
echec=0
verifier() {
  local url="$1" code
  code=$(curl -s -o /dev/null -w "%{http_code}" "$url" || true)
  if [ "$code" = "200" ]; then
    echo "OK $url"
  else
    echo "KO $url ($code)"
    return 1
  fi
}
while read -r url; do
  verifier "$url" || echec=1
done < "$1"
exit $echec
`,
      setup: {
        services: { api: { ports: [8000], routes: { "/sante": [200, '{"ok":true}'], "/panier": [500, '{"detail":"erreur"}'] } } },
        files: { "/home/eleve/bons.txt": "http://localhost:8000/sante\n", "/home/eleve/mixte.txt": "http://localhost:8000/sante\nhttp://localhost:8000/panier\nhttp://localhost:9000/\n" }
      },
      tests: [
        { args: ["bons.txt"], out: "OK http://localhost:8000/sante", code: 0 },
        { args: ["mixte.txt"], out: "OK http://localhost:8000/sante\nKO http://localhost:8000/panier (500)\nKO http://localhost:9000/ (000)", code: 1 }
      ],
      hint: "while read -r url; do … done < \"$1\". Avec set -e, un curl qui échoue arrête tout : ajoute || true après la substitution, et note l'échec dans une variable plutôt que de sortir tout de suite."
    }
  }
];
