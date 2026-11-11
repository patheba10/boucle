/* Guide « Installer ton environnement » (page #installer). */
const R = String.raw;

export default {
  title: "Installer ton environnement",
  intro: R`Tout ce qui est dans Boucle tourne dans le navigateur. Pour les projets, Jupyter et plus tard Docker ou TensorFlow, il te faut un vrai poste de travail. Ce guide vise Windows 10 et 11 (PowerShell), avec les équivalents macOS et Linux. Compte 30 minutes, à faire une seule fois.`,
  sections: [
    {
      id: "python",
      title: "Python 3.13",
      body: R`<p>Installe Python avec <strong>winget</strong>, le gestionnaire de paquets intégré à Windows, dans PowerShell :</p>
~~~ps
winget install --id Python.Python.3.13 -e
~~~
<p>Ferme puis rouvre PowerShell, et vérifie :</p>
~~~ps
py --version        # Python 3.13.x
py -m pip --version
~~~
<p>Sans winget, télécharge l'installateur sur python.org et coche <strong>« Add python.exe to PATH »</strong> au premier écran. Sur macOS : @@brew install python@3.13@@. Sur Ubuntu : @@sudo apt install python3 python3-venv python3-pip@@.</p>`
    },
    {
      id: "vscode",
      title: "VS Code et ses extensions",
      body: R`~~~ps
winget install --id Microsoft.VisualStudioCode -e
code --install-extension ms-python.python
code --install-extension ms-toolsai.jupyter
~~~
<p>L'extension Python apporte l'autocomplétion, le débogueur et la sélection de l'environnement. L'extension Jupyter ouvre les notebooks @@.ipynb@@ directement dans VS Code.</p>`
    },
    {
      id: "venv",
      title: "Un environnement virtuel par projet",
      body: R`<p>Un <strong>environnement virtuel</strong> isole les bibliothèques d'un projet. C'est la pratique standard en entreprise : deux projets peuvent utiliser deux versions différentes de pandas sans conflit.</p>
~~~ps
mkdir mon-projet; cd mon-projet
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1     # l'invite affiche (.venv)
python -m pip install --upgrade pip
~~~
<p>Si PowerShell refuse d'exécuter le script d'activation, autorise les scripts locaux pour ton compte uniquement, une seule fois :</p>
~~~ps
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
~~~
<p>Pour sortir de l'environnement : @@deactivate@@. Sur macOS et Linux, l'activation se fait avec @@source .venv/bin/activate@@. Ajoute @@.venv/@@ à ton @@.gitignore@@ : on ne versionne jamais un environnement virtuel.</p>`
    },
    {
      id: "data",
      title: "Les bibliothèques data",
      body: R`<p>Dans l'environnement activé :</p>
~~~ps
pip install numpy pandas matplotlib seaborn scipy scikit-learn jupyterlab
~~~
<p>Pour qu'un autre développeur (ou ta CI) retrouve exactement les mêmes versions, fige-les dans un fichier :</p>
~~~ps
pip freeze > requirements.txt     # enregistrer
pip install -r requirements.txt   # réinstaller ailleurs
~~~
<p>Boucle fait la même chose : son @@requirements.txt@@ épingle les versions utilisées par la CI.</p>`
    },
    {
      id: "jupyter",
      title: "Jupyter",
      body: R`<p>Les notebooks mélangent code, résultats et texte : l'outil standard pour explorer des données.</p>
~~~ps
jupyter lab
~~~
<p>Le navigateur s'ouvre sur @@http://localhost:8888@@. Tu peux aussi créer un fichier @@analyse.ipynb@@ dans VS Code et choisir le noyau @@.venv@@ en haut à droite.</p>`
    },
    {
      id: "git",
      title: "Git",
      body: R`~~~ps
winget install --id Git.Git -e
git --version
git config --global user.name "Ton Nom"
git config --global user.email "ID+pseudo@users.noreply.github.com"
git config --global init.defaultBranch main
~~~
<p>Utilise ton adresse <strong>noreply</strong> GitHub (Settings → Emails sur github.com) pour ne pas exposer ton e-mail dans les commits publics. Le cours Git de l'étape 3 part de là.</p>`
    },
    {
      id: "wsl",
      title: "WSL : Linux dans Windows",
      body: R`<p>DevOps, Docker, C++ et l'embarqué se pratiquent surtout sous Linux. WSL installe un vrai Ubuntu dans Windows. Lance PowerShell <strong>en administrateur</strong> :</p>
~~~ps
wsl --install -d Ubuntu
~~~
<p>Redémarre, crée ton utilisateur Ubuntu, puis installe les outils de compilation :</p>
~~~bash
sudo apt update && sudo apt install -y build-essential git python3-venv
g++ --version
~~~
<p>VS Code s'y connecte avec l'extension <strong>WSL</strong> : tape @@code .@@ depuis un dossier Ubuntu.</p>`
    },
    {
      id: "verifier",
      title: "Tout vérifier",
      body: R`<p>Dans ton environnement activé, enregistre ce script sous @@verifier.py@@ et lance @@python verifier.py@@ :</p>
~~~py norun
import sys
print("Python", sys.version.split()[0])
for nom in ["numpy", "pandas", "matplotlib", "scipy", "sklearn"]:
    try:
        module = __import__(nom)
        print(f"{nom:12} {module.__version__}")
    except ImportError:
        print(f"{nom:12} MANQUANT : pip install {nom if nom != 'sklearn' else 'scikit-learn'}")
~~~
<p>Les cinq lignes doivent afficher une version. Sinon, vérifie que l'invite affiche bien @@(.venv)@@.</p>`
    }
  ]
};
