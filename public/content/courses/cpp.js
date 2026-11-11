/* Cours C++ */
const R = String.raw;

export default {
  id: "cpp", name: "C++", tag: "$ g++", lang: "cpp",
  blurb: "La mémoire, les types et les pointeurs. Un interpréteur pédagogique tourne dans le navigateur.",
  note: "Les défis tournent dans un interpréteur C++ pédagogique : iostream, types de base, boucles, fonctions, tableaux, pointeurs et récursion. string, vector, références et classes sont vus en théorie, à pratiquer avec g++ sur ta machine.",
  lessons: [
  {
    id: "cpp-01", title: "Premier programme", xp: 30,
    theory: R`<p>Tout programme C++ démarre dans la fonction @@main@@. @@cout@@ (de la bibliothèque @@<iostream>@@) écrit dans la console avec l'opérateur @@<<@@.</p>
~~~cpp
#include <iostream>
using namespace std;

int main() {
    cout << "Bonjour" << endl;   // endl = retour à la ligne
    cout << 2 + 3 << "\n";       // "\n" fait pareil
    return 0;                    // 0 = tout s'est bien passé
}
~~~
<p>Chaque instruction se termine par @@;@@. Sur ta machine : @@g++ main.cpp -o main && ./main@@.</p>`,
    quiz: [
      { q: R`Que signifie @@return 0;@@ dans @@main@@ ?`, options: ["Le programme recommence", "Le programme s'est terminé sans erreur", "La fonction affiche 0", "Rien"], answer: 1,
        explain: "Le code de sortie 0 signale au système (et aux scripts CI) que tout s'est bien passé." }
    ],
    challenge: {
      prompt: R`<p>Écris un programme complet qui affiche :</p><pre class="out">Bonjour, C++ !
Compilation reussie.</pre>`,
      starter: "#include <iostream>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}\n",
      solution: R`#include <iostream>
using namespace std;

int main() {
    cout << "Bonjour, C++ !" << endl;
    cout << "Compilation reussie." << endl;
    return 0;
}`,
      tests: [{ input: "", expected: "Bonjour, C++ !\nCompilation reussie." }],
      hint: "Deux lignes cout << \"...\" << endl; à l'intérieur des accolades de main."
    }
  },
  {
    id: "cpp-02", title: "Types et variables", xp: 30,
    theory: R`<p>En C++, chaque variable a un type <strong>déclaré</strong> et fixe.</p>
~~~cpp
#include <iostream>
using namespace std;

int main() {
    int a = 7;          // entier
    double x = 7.0;     // décimal
    char c = 'Z';       // un caractère, entre apostrophes
    bool ok = true;     // s'affiche 1

    cout << a / 2 << endl;   // 3  : division entière !
    cout << x / 2 << endl;   // 3.5
    cout << c << " " << ok << endl;
    return 0;
}
~~~
<p>Piège classique : @@int / int@@ donne un entier. Il suffit qu'un des deux soit un @@double@@ pour obtenir un décimal.</p>`,
    quiz: [
      { q: R`Que vaut @@9 / 2@@ si les deux sont des @@int@@ ?`, options: ["4.5", "4", "5", "Erreur de compilation"], answer: 1,
        explain: "La division entière tronque : 4." }
    ],
    challenge: {
      prompt: R`<p>Avec @@int largeur = 7@@ et @@int hauteur = 2@@, affiche l'aire, le périmètre et le ratio largeur / hauteur en décimal :</p><pre class="out">Aire : 14
Perimetre : 18
Ratio : 3.5</pre>`,
      starter: "#include <iostream>\nusing namespace std;\n\nint main() {\n    int largeur = 7;\n    int hauteur = 2;\n    \n    return 0;\n}\n",
      solution: R`#include <iostream>
using namespace std;

int main() {
    int largeur = 7;
    int hauteur = 2;
    cout << "Aire : " << largeur * hauteur << endl;
    cout << "Perimetre : " << 2 * (largeur + hauteur) << endl;
    double ratio = (double) largeur / hauteur;
    cout << "Ratio : " << ratio << endl;
    return 0;
}`,
      tests: [{ input: "", expected: "Aire : 14\nPerimetre : 18\nRatio : 3.5" }],
      hint: "Pour le ratio, convertis : (double) largeur / hauteur, sinon tu obtiendras 3."
    }
  },
  {
    id: "cpp-03", title: "Lire des entrées avec cin", xp: 35,
    theory: R`<p>@@cin >> variable@@ lit une valeur tapée par l'utilisateur (ou fournie en entrée standard). Les espaces et retours à la ligne séparent les valeurs.</p>
~~~cpp stdin:10 32
#include <iostream>
using namespace std;

int main() {
    int a, b;
    cin >> a >> b;
    cout << "Somme : " << a + b << endl;
    return 0;
}
~~~
<p>Dans Boucle, l'entrée est fournie dans le champ « Entrée (stdin) » sous l'éditeur. Les défis testent ton programme avec plusieurs entrées différentes.</p>`,
    quiz: [
      { q: R`Avec l'entrée @@10 32@@, que contient @@b@@ après @@cin >> a >> b;@@ ?`, options: ["10", "32", "1032", "42"], answer: 1,
        explain: "cin lit 10 dans a, saute l'espace, puis lit 32 dans b." }
    ],
    challenge: {
      prompt: R`<p>Lis deux entiers : l'année de naissance puis l'année actuelle. Affiche l'âge atteint cette année :</p><pre class="out">Entrée : 2001 2026
Sortie : Age : 25</pre>`,
      starter: "#include <iostream>\nusing namespace std;\n\nint main() {\n    int naissance, actuelle;\n    \n    return 0;\n}\n",
      solution: R`#include <iostream>
using namespace std;

int main() {
    int naissance, actuelle;
    cin >> naissance >> actuelle;
    cout << "Age : " << actuelle - naissance << endl;
    return 0;
}`,
      tests: [
        { input: "2001 2026", expected: "Age : 25" },
        { input: "1990 2026", expected: "Age : 36" }
      ],
      hint: "cin >> naissance >> actuelle; puis affiche la différence."
    }
  },
  {
    id: "cpp-04", title: "Conditions", xp: 35,
    theory: R`<p>Même logique qu'en Python, mais les conditions vont entre parenthèses et les blocs entre accolades.</p>
~~~cpp
#include <iostream>
using namespace std;

int main() {
    int score = 72;
    if (score >= 80) {
        cout << "Excellent" << endl;
    } else if (score >= 60) {
        cout << "Reussi" << endl;
    } else {
        cout << "Echec" << endl;
    }
    // && (et), || (ou), ! (non)
    bool admis = score >= 60 && score < 100;
    cout << admis << endl;
    return 0;
}
~~~`,
    quiz: [
      { q: R`En C++, quel opérateur signifie « ou » logique ?`, options: ["or", "|", "||", "//"], answer: 2,
        explain: "|| est le ou logique. | est le ou bit à bit, et // ouvre un commentaire." }
    ],
    challenge: {
      prompt: R`<p>Lis un entier n et affiche @@positif@@, @@negatif@@ ou @@zero@@.</p>`,
      starter: "#include <iostream>\nusing namespace std;\n\nint main() {\n    int n;\n    cin >> n;\n    \n    return 0;\n}\n",
      solution: R`#include <iostream>
using namespace std;

int main() {
    int n;
    cin >> n;
    if (n > 0) {
        cout << "positif" << endl;
    } else if (n < 0) {
        cout << "negatif" << endl;
    } else {
        cout << "zero" << endl;
    }
    return 0;
}`,
      tests: [
        { input: "12", expected: "positif" },
        { input: "-4", expected: "negatif" },
        { input: "0", expected: "zero" }
      ],
      hint: "if (n > 0) { ... } else if (n < 0) { ... } else { ... }"
    }
  },
  {
    id: "cpp-05", title: "Boucles for et while", xp: 35,
    theory: R`<p>La boucle @@for@@ C++ regroupe initialisation, condition et incrément.</p>
~~~cpp
#include <iostream>
using namespace std;

int main() {
    for (int i = 0; i < 4; i++) {
        cout << i << " ";
    }
    cout << endl;

    int n = 100;
    int etapes = 0;
    while (n > 1) {
        n = n / 2;
        etapes++;
    }
    cout << etapes << " divisions" << endl;
    return 0;
}
~~~`,
    quiz: [
      { q: R`Combien de fois s'exécute @@for (int i = 1; i <= 10; i += 3)@@ ?`, options: ["3", "4", "10", "Infini"], answer: 1,
        explain: "i vaut 1, 4, 7, 10 : quatre tours." }
    ],
    challenge: {
      prompt: R`<p>Lis un entier n et affiche la somme 1 + 2 + … + n, puis la somme des carrés :</p><pre class="out">Entrée : 10
Somme : 55
Carres : 385</pre>`,
      starter: "#include <iostream>\nusing namespace std;\n\nint main() {\n    int n;\n    cin >> n;\n    \n    return 0;\n}\n",
      solution: R`#include <iostream>
using namespace std;

int main() {
    int n;
    cin >> n;
    int somme = 0;
    int carres = 0;
    for (int i = 1; i <= n; i++) {
        somme += i;
        carres += i * i;
    }
    cout << "Somme : " << somme << endl;
    cout << "Carres : " << carres << endl;
    return 0;
}`,
      tests: [
        { input: "10", expected: "Somme : 55\nCarres : 385" },
        { input: "3", expected: "Somme : 6\nCarres : 14" },
        { input: "100", expected: "Somme : 5050\nCarres : 338350" }
      ],
      hint: "Deux accumulateurs initialisés à 0, une seule boucle for de 1 à n inclus."
    }
  },
  {
    id: "cpp-06", title: "Fonctions", xp: 40,
    theory: R`<p>Une fonction C++ déclare le type de ce qu'elle renvoie et le type de chaque paramètre. Elle doit être déclarée avant d'être appelée.</p>
~~~cpp
#include <iostream>
using namespace std;

int cube(int x) {
    return x * x * x;
}

void saluer(int fois) {      // void : ne renvoie rien
    for (int i = 0; i < fois; i++) {
        cout << "salut ";
    }
    cout << endl;
}

int main() {
    cout << cube(4) << endl;
    saluer(2);
    return 0;
}
~~~`,
    quiz: [
      { q: R`Que signifie @@void@@ devant un nom de fonction ?`, options: ["Elle est vide", "Elle ne renvoie pas de valeur", "Elle est privée", "Elle renvoie 0"], answer: 1,
        explain: "void indique qu'il n'y a pas de valeur de retour." }
    ],
    challenge: {
      prompt: R`<p>Complète @@pgcd(a, b)@@ avec l'<strong>algorithme d'Euclide</strong> : tant que b ≠ 0, on remplace (a, b) par (b, a % b). Le résultat est a.</p>`,
      starter: "#include <iostream>\nusing namespace std;\n\nint pgcd(int a, int b) {\n    // ton code ici\n    return 0;\n}\n\nint main() {\n    int a, b;\n    cin >> a >> b;\n    cout << pgcd(a, b) << endl;\n    return 0;\n}\n",
      solution: R`#include <iostream>
using namespace std;

int pgcd(int a, int b) {
    while (b != 0) {
        int r = a % b;
        a = b;
        b = r;
    }
    return a;
}

int main() {
    int a, b;
    cin >> a >> b;
    cout << pgcd(a, b) << endl;
    return 0;
}`,
      tests: [
        { input: "48 18", expected: "6" },
        { input: "17 5", expected: "1" },
        { input: "100 75", expected: "25" }
      ],
      hint: "Garde a % b dans une variable temporaire r, puis a = b; b = r;"
    }
  },
  {
    id: "cpp-07", title: "Tableaux", xp: 40,
    theory: R`<p>Un tableau C++ a une taille fixe et contient des éléments du même type, rangés côte à côte en mémoire.</p>
~~~cpp
#include <iostream>
using namespace std;

int main() {
    int notes[5] = {12, 15, 9, 18, 11};
    int total = 0;
    for (int i = 0; i < 5; i++) {
        total += notes[i];
    }
    cout << "Moyenne : " << total / 5.0 << endl;
    return 0;
}
~~~
<p>Le C++ ne vérifie pas les indices : lire @@notes[5]@@ ici est un comportement indéfini, source de bogues et de failles de sécurité.</p>`,
    quiz: [
      { q: R`Pour @@int t[4];@@, quel est le dernier indice valide ?`, options: ["4", "3", "5", "0"], answer: 1,
        explain: "Les indices vont de 0 à taille − 1." }
    ],
    challenge: {
      prompt: R`<p>Lis d'abord n (≤ 100), puis n entiers. Affiche le maximum et le minimum :</p><pre class="out">Entrée : 5
         3 9 -2 7 4
Max : 9
Min : -2</pre>`,
      starter: "#include <iostream>\nusing namespace std;\n\nint main() {\n    int n;\n    int t[100];\n    cin >> n;\n    \n    return 0;\n}\n",
      solution: R`#include <iostream>
using namespace std;

int main() {
    int n;
    int t[100];
    cin >> n;
    for (int i = 0; i < n; i++) {
        cin >> t[i];
    }
    int mx = t[0];
    int mn = t[0];
    for (int i = 1; i < n; i++) {
        if (t[i] > mx) mx = t[i];
        if (t[i] < mn) mn = t[i];
    }
    cout << "Max : " << mx << endl;
    cout << "Min : " << mn << endl;
    return 0;
}`,
      tests: [
        { input: "5\n3 9 -2 7 4", expected: "Max : 9\nMin : -2" },
        { input: "3\n-5 -1 -9", expected: "Max : -1\nMin : -9" },
        { input: "1\n42", expected: "Max : 42\nMin : 42" }
      ],
      hint: "Initialise max et min avec t[0], pas avec 0 : sinon les tableaux tout négatifs donnent un faux max."
    }
  },
  {
    id: "cpp-08", title: "Pointeurs", xp: 50,
    theory: R`<p>Un pointeur stocke une <strong>adresse mémoire</strong>. @@&x@@ donne l'adresse de x, @@*p@@ accède à la valeur pointée.</p>
~~~cpp
#include <iostream>
using namespace std;

void doubler(int *p) {
    *p = *p * 2;     // modifie la variable d'origine
}

int main() {
    int x = 21;
    int *p = &x;
    doubler(p);
    cout << x << endl;    // 42
    doubler(&x);
    cout << *p << endl;   // 84
    return 0;
}
~~~
<p>Passer une adresse permet à une fonction de modifier une variable de l'appelant. Sans pointeur, la fonction reçoit une copie.</p>`,
    quiz: [
      { q: R`Si @@int x = 5; int *p = &x; *p = 9;@@, que vaut x ?`, options: ["5", "9", "L'adresse de x", "Erreur"], answer: 1,
        explain: "*p désigne x lui-même : on écrit 9 dans x." }
    ],
    challenge: {
      prompt: R`<p>Écris @@echanger(int *a, int *b)@@ qui échange les valeurs pointées. Le @@main@@ fourni lit deux entiers, les échange et les affiche.</p><pre class="out">Entrée : 3 5
a=5 b=3</pre>`,
      starter: "#include <iostream>\nusing namespace std;\n\nvoid echanger(int *a, int *b) {\n    // ton code ici\n}\n\nint main() {\n    int a, b;\n    cin >> a >> b;\n    echanger(&a, &b);\n    cout << \"a=\" << a << \" b=\" << b << endl;\n    return 0;\n}\n",
      solution: R`#include <iostream>
using namespace std;

void echanger(int *a, int *b) {
    int tmp = *a;
    *a = *b;
    *b = tmp;
}

int main() {
    int a, b;
    cin >> a >> b;
    echanger(&a, &b);
    cout << "a=" << a << " b=" << b << endl;
    return 0;
}`,
      tests: [
        { input: "3 5", expected: "a=5 b=3" },
        { input: "-1 8", expected: "a=8 b=-1" }
      ],
      hint: "Une variable temporaire : int tmp = *a; *a = *b; *b = tmp;"
    }
  },
  {
    id: "cpp-09", title: "Récursion", xp: 50,
    theory: R`<p>Une fonction récursive s'appelle elle-même sur un problème plus petit. Il faut toujours un <strong>cas de base</strong> qui arrête les appels.</p>
~~~cpp
#include <iostream>
using namespace std;

int factorielle(int n) {
    if (n <= 1) return 1;          // cas de base
    return n * factorielle(n - 1); // appel récursif
}

int main() {
    cout << factorielle(5) << endl;  // 120
    return 0;
}
~~~
<p>Chaque appel occupe de la place sur la pile : une récursion trop profonde provoque un <em>stack overflow</em>.</p>`,
    quiz: [
      { q: "Que se passe-t-il sans cas de base ?", options: ["La fonction renvoie 0", "Les appels ne s'arrêtent pas jusqu'au débordement de pile", "Le compilateur l'ajoute", "Rien de spécial"], answer: 1,
        explain: "Sans condition d'arrêt, la pile d'appels grossit jusqu'au crash." }
    ],
    challenge: {
      prompt: R`<p>Écris @@fib(n)@@ <strong>récursive</strong> : fib(0) = 0, fib(1) = 1, fib(n) = fib(n−1) + fib(n−2). Le main lit n et affiche fib(n).</p>`,
      starter: "#include <iostream>\nusing namespace std;\n\nint fib(int n) {\n    return 0;\n}\n\nint main() {\n    int n;\n    cin >> n;\n    cout << fib(n) << endl;\n    return 0;\n}\n",
      solution: R`#include <iostream>
using namespace std;

int fib(int n) {
    if (n < 2) return n;
    return fib(n - 1) + fib(n - 2);
}

int main() {
    int n;
    cin >> n;
    cout << fib(n) << endl;
    return 0;
}`,
      tests: [
        { input: "0", expected: "0" },
        { input: "1", expected: "1" },
        { input: "10", expected: "55" }
      ],
      hint: "Cas de base : si n < 2, renvoie n. Sinon renvoie fib(n - 1) + fib(n - 2)."
    }
  },
  {
    id: "cpp-10", title: "string, vector et références", xp: 40, theoryOnly: true,
    theory: R`<p>Le C++ moderne remplace souvent les tableaux bruts par des outils de la bibliothèque standard. Ces exemples ne tournent pas dans l'interpréteur du navigateur : compile-les avec @@g++ -std=c++17 main.cpp@@.</p>
~~~cpp norun
#include <iostream>
#include <string>
#include <vector>
using namespace std;

void ajouterBonus(vector<int>& notes) {   // & : référence, pas de copie
    for (int& n : notes) n += 2;
}

int main() {
    string nom = "Ada";
    nom += " Lovelace";
    cout << nom << " (" << nom.size() << ")" << endl;

    vector<int> notes = {12, 15, 9};
    notes.push_back(18);
    ajouterBonus(notes);
    for (int n : notes) cout << n << " ";
    cout << endl;
    return 0;
}
~~~
<ul><li>@@string@@ gère sa mémoire tout seul et se concatène avec @@+@@.</li><li>@@vector@@ est un tableau qui grandit avec @@push_back@@.</li><li>Une <strong>référence</strong> @@int&@@ est un alias : plus simple qu'un pointeur, jamais nulle.</li></ul>`,
    quiz: [
      { q: R`Pourquoi écrire @@vector<int>& v@@ plutôt que @@vector<int> v@@ en paramètre ?`, options: ["Pour éviter de copier tout le vecteur et pouvoir le modifier", "Pour que le vecteur soit trié", "C'est obligatoire", "Pour le rendre constant"], answer: 0,
        explain: "Sans &, la fonction reçoit une copie complète. Avec const vector<int>&, on évite la copie sans autoriser la modification." },
      { q: R`Quelle méthode ajoute un élément à la fin d'un @@vector@@ ?`, options: ["append", "add", "push_back", "insert_end"], answer: 2,
        explain: "push_back (ou emplace_back) ajoute en fin de vecteur." }
    ]
  },
  {
    id: "cpp-11", title: "Classes et RAII", xp: 40, theoryOnly: true,
    theory: R`<p>Une classe C++ regroupe données et méthodes, avec un contrôle d'accès (@@public@@ / @@private@@). Le <strong>constructeur</strong> initialise l'objet, le <strong>destructeur</strong> @@~Nom()@@ libère ses ressources à la sortie de portée : c'est le principe <strong>RAII</strong>.</p>
~~~cpp norun
#include <iostream>
#include <string>
using namespace std;

class Compte {
private:
    string titulaire;
    double solde;
public:
    Compte(string t, double s = 0) : titulaire(t), solde(s) {}
    ~Compte() { cout << "Fermeture du compte de " << titulaire << endl; }

    bool retirer(double m) {
        if (m > solde) return false;
        solde -= m;
        return true;
    }
    double getSolde() const { return solde; }
};

int main() {
    Compte c("Ada", 100);
    c.retirer(30);
    cout << c.getSolde() << endl;   // 70
    return 0;                       // le destructeur s'exécute ici
}
~~~`,
    quiz: [
      { q: "Quand le destructeur d'un objet local est-il appelé ?", options: ["Jamais automatiquement", "À la sortie de la portée où l'objet a été créé", "Au prochain appel de new", "Quand le programme démarre"], answer: 1,
        explain: "C'est la base du RAII : fichiers, verrous et mémoire se libèrent automatiquement." },
      { q: R`Que garantit le @@const@@ à la fin de @@getSolde() const@@ ?`, options: ["Le solde ne change jamais", "La méthode ne modifie pas l'objet", "La méthode est plus rapide", "La valeur renvoyée est une constante globale"], answer: 1,
        explain: "Une méthode const peut être appelée sur un objet const et ne modifie pas ses attributs." }
    ]
  }
  ]
};
