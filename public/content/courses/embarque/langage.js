/* Cours C embarqué — chapitre 1 : le C du microcontrôleur. Les programmes tournent dans le navigateur avec minic
   (assets/py/minic.py) et sont compilés par gcc en CI : les deux doivent afficher la même chose. */
const C = String.raw;

export const LAB = `<p><strong>Sur ta machine</strong> : installe gcc (@@sudo apt install gcc@@ sous Linux ou WSL, @@xcode-select --install@@ sur macOS), copie le code et l'en-tête @@mcu.h@@ du simulateur (onglet de la leçon, lien « mcu.h » ci-dessous), puis @@gcc -Wall -Wextra main.c -o main && ./main@@. Pour du vrai matériel sans rien acheter, le simulateur gratuit <em>Wokwi</em> (wokwi.com) fait tourner un Arduino, un ESP32 ou un Raspberry Pi Pico dans le navigateur. Le fichier : <a href="assets/py/mcu.h" target="_blank" rel="noopener">mcu.h</a>.</p>`;

export default [
  {
    id: "em-01", section: "Le C de l'embarqué", title: "Du Python au C", xp: 80,
    theory: `<p>Le C est la langue des microcontrôleurs : il se compile en instructions machine sans interpréteur ni ramasse-miettes, avec un contrôle total de la mémoire. Les différences avec Python qui comptent tout de suite :</p>
<ul><li>le programme est <strong>compilé</strong> (gcc, ou arm-none-eabi-gcc pour un STM32) ; il commence par @@main@@ ;</li><li>chaque variable a un <strong>type</strong> fixé à la déclaration, et sa taille en mémoire en découle ;</li><li>les blocs sont délimités par @@{ }@@, chaque instruction finit par @@;@@ ;</li><li>une fonction doit être déclarée avant d'être appelée ;</li><li>@@printf@@ affiche avec un <em>format</em> : @@%d@@ entier, @@%u@@ non signé, @@%x@@ hexadécimal, @@%c@@ caractère, @@%s@@ chaîne, @@%.2f@@ flottant à deux décimales.</li></ul>
~~~c
#include <stdio.h>

int carre(int x) {
    return x * x;
}

int main(void) {
    int total = 0;
    for (int i = 1; i <= 4; i++) {
        total += carre(i);
    }
    printf("somme des carrés : %d\\n", total);
    printf("en hexadécimal : 0x%02X\\n", total);
    return 0;
}
~~~
<p>Un tableau C n'est qu'une suite de cases en mémoire : il ne connaît pas sa longueur. On passe donc toujours la taille à côté, et on peut la calculer avec @@sizeof@@ à l'endroit où le tableau est déclaré : @@sizeof t / sizeof t[0]@@.</p>
<p>Ici, le code s'exécute dans ton navigateur grâce à <strong>minic</strong>, un interpréteur C écrit pour ce cours ; en coulisses, chaque exemple est aussi compilé par gcc pour vérifier que les deux affichent exactement la même chose.</p>`,
    setup: LAB,
    quiz: [
      { q: "Quel format affiche un entier en hexadécimal sur au moins deux chiffres ?", options: ["%d", "%02X", "%s", "%2d"], answer: 1, explain: "0 complète avec des zéros, 2 est la largeur, X l'hexadécimal en majuscules." },
      { q: "Pourquoi passe-t-on la taille d'un tableau à une fonction ?", options: ["Par convention", "Un tableau C ne mémorise pas sa longueur : la fonction ne reçoit qu'un pointeur vers sa première case", "Pour aller plus vite", "Ce n'est pas nécessaire"], answer: 1, explain: "D'où les paires (pointeur, taille) partout en C." }
    ],
    challenge: {
      prompt: `<p>Écris @@int maximum(const int *t, int n)@@ qui renvoie la plus grande valeur des @@n@@ cases de @@t@@ (n ≥ 1), et @@int compter_sup(const int *t, int n, int seuil)@@ qui compte les valeurs strictement supérieures à @@seuil@@.</p><p>Le @@main@@ est fourni par les tests : ton code ne contient que les fonctions. « Exécuter » lance ton code avec ce @@main@@.</p>`,
      starter: C`#include <stdio.h>

int maximum(const int *t, int n) {
    return t[0];
}

int compter_sup(const int *t, int n, int seuil) {
    return 0;
}
`,
      solution: C`#include <stdio.h>

int maximum(const int *t, int n) {
    int m = t[0];
    for (int i = 1; i < n; i++) {
        if (t[i] > m) m = t[i];
    }
    return m;
}

int compter_sup(const int *t, int n, int seuil) {
    int c = 0;
    for (int i = 0; i < n; i++) {
        if (t[i] > seuil) c++;
    }
    return c;
}
`,
      tests: C`int main(void) {
    int temperatures[] = {18, 21, 25, 19, 31, 24, 22};
    int n = sizeof temperatures / sizeof temperatures[0];
    printf("max %d, au-dessus de 22 : %d\n", maximum(temperatures, n), compter_sup(temperatures, n, 22));
    int negatifs[] = {-5, -2, -9};
    printf("max %d, au-dessus de -3 : %d\n", maximum(negatifs, 3), compter_sup(negatifs, 3, -3));
    return 0;
}
`,
      expected: "max 31, au-dessus de 22 : 3\nmax -2, au-dessus de -3 : 1\n",
      hint: "Une variable m initialisée à t[0], puis une boucle for de 1 à n − 1 qui garde la plus grande valeur. Même schéma avec un compteur pour compter_sup."
    }
  },
  {
    id: "em-02", section: "Le C de l'embarqué", title: "Types à largeur fixe et débordements", xp: 100,
    theory: `<p>La taille d'un @@int@@ dépend de la machine : 16 bits sur un AVR (Arduino Uno), 32 bits sur un ARM. En embarqué, on utilise donc les types de @@&lt;stdint.h&gt;@@ dont la taille est garantie : @@uint8_t@@, @@int16_t@@, @@uint32_t@@… Un registre de 32 bits se manipule en @@uint32_t@@, un octet reçu en @@uint8_t@@.</p>
<p>Un entier <strong>non signé</strong> de @@n@@ bits calcule modulo @@2ⁿ@@ : il « fait le tour ». C'est défini, et souvent voulu (compteurs, sommes de contrôle). Un dépassement <strong>signé</strong>, lui, est un comportement indéfini en C : le compilateur peut supposer qu'il n'arrive jamais. Les conversions implicites piègent aussi : un @@uint8_t@@ est promu en @@int@@ avant tout calcul, et une comparaison entre signé et non signé convertit le signé en non signé (gcc le signale avec @@-Wall -Wextra@@ : lis toujours les avertissements).</p>
~~~c avertissement
#include <stdio.h>
#include <stdint.h>

int main(void) {
    uint8_t octet = 250;
    octet += 10;                       /* 260 modulo 256 */
    printf("uint8_t : %u\\n", octet);

    uint16_t n = 0;
    n--;                               /* fait le tour par le haut */
    printf("uint16_t : %u\\n", n);

    int16_t brut = (int16_t)0xFF38;    /* -200 en complément à deux */
    printf("int16_t : %d\\n", brut);

    unsigned int u = 1;
    printf("-1 < 1u ? %d\\n", -1 < u);  /* -1 devient 4294967295 ! */
    return 0;
}
~~~
<p>Cas pratique courant : un capteur renvoie une mesure sur 12 bits en complément à deux (un accéléromètre, un capteur de température). Pour la ranger dans un @@int16_t@@, il faut <strong>étendre le signe</strong> : recopier le bit de signe (le bit 11) dans les bits de poids fort.</p>`,
    setup: LAB,
    quiz: [
      { q: "Que vaut un uint8_t qui contient 200 après += 100 ?", options: ["300", "44", "255", "Indéfini"], answer: 1, explain: "300 modulo 256 = 44 : l'arithmétique non signée est modulaire." },
      { q: "Pourquoi préférer uint16_t à unsigned short en embarqué ?", options: ["C'est plus rapide", "Sa taille est garantie sur toutes les plateformes ; celle de short dépend du compilateur", "C'est obligatoire", "unsigned short n'existe pas en C"], answer: 1, explain: "Même raison pour int : 16 bits sur AVR, 32 sur ARM." }
    ],
    challenge: {
      prompt: `<p>Écris trois fonctions :</p><ul><li>@@uint8_t moyenne_u8(uint8_t a, uint8_t b)@@ : la moyenne arrondie vers le bas, <strong>sans jamais dépasser 8 bits</strong> dans le calcul (indice : @@a / 2 + b / 2@@ plus un correctif quand les deux sont impairs) ;</li><li>@@int16_t etendre_signe(uint16_t brut, int bits)@@ : interprète les @@bits@@ bits de poids faible de @@brut@@ comme un nombre en complément à deux ;</li><li>@@uint8_t saturer_u8(int32_t v)@@ : ramène @@v@@ dans @@[0, 255]@@ au lieu de le laisser faire le tour.</li></ul>`,
      starter: C`#include <stdint.h>

uint8_t moyenne_u8(uint8_t a, uint8_t b) {
    return (uint8_t)(a + b) / 2;
}

int16_t etendre_signe(uint16_t brut, int bits) {
    return (int16_t)brut;
}

uint8_t saturer_u8(int32_t v) {
    return (uint8_t)v;
}
`,
      solution: C`#include <stdint.h>

uint8_t moyenne_u8(uint8_t a, uint8_t b) {
    return (uint8_t)(a / 2 + b / 2 + (a & b & 1u));
}

int16_t etendre_signe(uint16_t brut, int bits) {
    uint16_t masque = (uint16_t)((1u << bits) - 1u);
    uint16_t signe = (uint16_t)(1u << (bits - 1));
    brut &= masque;
    if (brut & signe) {
        return (int16_t)(brut | (uint16_t)~masque);
    }
    return (int16_t)brut;
}

uint8_t saturer_u8(int32_t v) {
    if (v < 0) return 0;
    if (v > 255) return 255;
    return (uint8_t)v;
}
`,
      tests: C`#include <stdio.h>

int main(void) {
    printf("%u %u %u %u\n", moyenne_u8(250, 252), moyenne_u8(255, 255), moyenne_u8(3, 5), moyenne_u8(0, 1));
    printf("%d %d %d %d\n", etendre_signe(0x7FF, 12), etendre_signe(0x800, 12), etendre_signe(0xF38, 12), etendre_signe(0xFFFF, 16));
    printf("%d\n", etendre_signe(0xAF38, 12));
    printf("%u %u %u\n", saturer_u8(-40), saturer_u8(300), saturer_u8(128));
    return 0;
}
`,
      expected: "251 255 4 0\n2047 -2048 -200 -1\n-200\n0 255 128\n",
      hint: "Pour le signe : masque = (1 << bits) − 1 ; si le bit (bits − 1) vaut 1, mets à 1 tous les bits au-dessus avec brut | ~masque."
    }
  },
  {
    id: "em-03", section: "Le C de l'embarqué", title: "Opérations bit à bit et masques", xp: 100,
    theory: `<p>Un registre de périphérique est un mot de 32 bits où chaque bit, ou groupe de bits (un <strong>champ</strong>), a un rôle. On ne le modifie jamais en entier : on change seulement les bits voulus, avec des <strong>masques</strong>.</p>
~~~text
mettre le bit n à 1      reg |=  (1u << n);
mettre le bit n à 0      reg &= ~(1u << n);
inverser le bit n        reg ^=  (1u << n);
tester le bit n          if (reg & (1u << n)) …
lire un champ            (reg >> pos) & ((1u << largeur) - 1u)
écrire un champ          reg = (reg & ~(masque << pos)) | ((val & masque) << pos);
~~~
<p>Le suffixe @@u@@ (@@1u@@) compte : @@1 << 31@@ décale un @@int@@ signé dans son bit de signe, ce qui est un comportement indéfini ; @@1u << 31@@ est correct. Exemple réel : le registre @@MODER@@ d'un GPIO de STM32 consacre 2 bits à chaque broche (00 entrée, 01 sortie, 10 fonction alternative, 11 analogique). Mettre la broche 5 en sortie, c'est écrire @@01@@ dans le champ des bits 10 et 11, sans toucher aux autres broches :</p>
~~~c
#include <stdio.h>
#include <stdint.h>

int main(void) {
    uint32_t moder = 0xABFFFFFFu;               /* valeur au démarrage d'un GPIOA de STM32F4 */
    moder = (moder & ~(3u << 10)) | (1u << 10); /* broche 5 : 01, sortie */
    printf("MODER = 0x%08X\\n", moder);
    printf("mode de la broche 5 : %u\\n", (moder >> 10) & 3u);
    return 0;
}
~~~
<p>Le motif « lire, modifier, écrire » n'est pas atomique : si une interruption modifie le même registre entre la lecture et l'écriture, son changement est perdu. C'est pourquoi les STM32 offrent le registre @@BSRR@@, qui met des broches à 1 ou à 0 en une seule écriture.</p>`,
    setup: LAB,
    quiz: [
      { q: "Quelle instruction met à 0 le bit 3 de reg sans toucher aux autres ?", options: ["reg = 0;", "reg &= ~(1u << 3);", "reg |= (0 << 3);", "reg ^= 3;"], answer: 1, explain: "Le masque ~(1u << 3) a tous ses bits à 1 sauf le bit 3." },
      { q: "Pourquoi écrire 1u << 31 plutôt que 1 << 31 ?", options: ["C'est plus lisible", "1 est un int signé : le décaler dans le bit de signe est un comportement indéfini", "Pour aller plus vite", "C'est pareil"], answer: 1, explain: "Avec un non signé, le résultat est bien défini : 0x80000000." }
    ],
    exercices: [
      { type: "sortie", code: C`#include <stdio.h>
#include <stdint.h>

int main(void) {
    uint8_t r = 0x0F;
    r |= (1u << 7);
    r &= ~(1u << 0);
    printf("0x%02X\n", r);
    return 0;
}`, reponse: "0x8E",
        explain: "0x0F | 0x80 donne 0x8F : le bit 7 passe à 1. Le masque ~(1u << 0) a tous ses bits à 1 sauf le bit 0, qui est donc effacé : 0x8E." },
      { type: "trous", code: C`#include <stdio.h>
#include <stdint.h>

int main(void) {
    uint32_t reg = 0;
    reg [[|=]] (1u << 5);   /* met le bit 5 à 1 sans toucher aux autres */
    unsigned actif = (reg [[>>]] 5) & 1u;
    printf("%u\n", actif);
    return 0;
}`, attendu: "1",
        explain: C`@@|=@@ allume un bit ; pour le lire, on le décale jusqu'à la position 0 avec @@>>@@ puis on isole ce bit avec @@& 1u@@.` },
      { type: "ordre", lignes: ["#include <stdio.h>", "int main(void) {", "    unsigned x = 0xF0u;", "    x ^= 0xFFu;", "    printf(\"0x%02X\\n\", x);", "    return 0;", "}"], attendu: "0x0F",
        explain: C`Le XOR avec 0xFF inverse les 8 bits bas : 0xF0 devient 0x0F. Il faut l'appliquer avant l'affichage.` }
    ],
    challenge: {
      prompt: `<p>Écris @@uint32_t champ_lire(uint32_t reg, unsigned pos, unsigned largeur)@@, @@uint32_t champ_ecrire(uint32_t reg, unsigned pos, unsigned largeur, uint32_t val)@@ (renvoie le nouveau registre ; seuls les bits du champ changent, et une valeur trop grande est tronquée à la largeur du champ) et @@int compter_bits(uint32_t x)@@ (le nombre de bits à 1). La largeur va de 1 à 31.</p>`,
      starter: C`#include <stdint.h>

uint32_t champ_lire(uint32_t reg, unsigned pos, unsigned largeur) {
    return reg >> pos;
}

uint32_t champ_ecrire(uint32_t reg, unsigned pos, unsigned largeur, uint32_t val) {
    return reg | (val << pos);
}

int compter_bits(uint32_t x) {
    return 0;
}
`,
      solution: C`#include <stdint.h>

uint32_t champ_lire(uint32_t reg, unsigned pos, unsigned largeur) {
    return (reg >> pos) & ((1u << largeur) - 1u);
}

uint32_t champ_ecrire(uint32_t reg, unsigned pos, unsigned largeur, uint32_t val) {
    uint32_t masque = (1u << largeur) - 1u;
    return (reg & ~(masque << pos)) | ((val & masque) << pos);
}

int compter_bits(uint32_t x) {
    int n = 0;
    while (x) {
        x &= x - 1u;
        n++;
    }
    return n;
}
`,
      tests: C`#include <stdio.h>

int main(void) {
    uint32_t moder = 0xABFFFFFFu;
    printf("broche 5 : %u, broche 15 : %u\n", champ_lire(moder, 10, 2), champ_lire(moder, 30, 2));
    moder = champ_ecrire(moder, 10, 2, 1u);
    printf("0x%08X\n", moder);
    printf("0x%08X\n", champ_ecrire(0u, 4, 3, 0xFFu));
    printf("0x%08X\n", champ_ecrire(0xFFFFFFFFu, 8, 8, 0x5Au));
    printf("%d %d %d\n", compter_bits(0u), compter_bits(0xF0F0u), compter_bits(0xFFFFFFFFu));
    return 0;
}
`,
      expected: "broche 5 : 3, broche 15 : 2\n0xABFFF7FF\n0x00000070\n0xFFFF5AFF\n0 8 32\n",
      hint: "masque = (1u << largeur) − 1u. Lire : (reg >> pos) & masque. Écrire : efface le champ avec & ~(masque << pos), puis ajoute (val & masque) << pos. Pour compter, x &= x − 1 retire le bit à 1 le plus bas."
    }
  },
  {
    id: "em-04", section: "Le C de l'embarqué", title: "Pointeurs, tableaux et chaînes", xp: 110,
    theory: `<p>Un <strong>pointeur</strong> contient une adresse mémoire. @@&x@@ donne l'adresse de @@x@@, @@*p@@ désigne la valeur pointée. Un tableau se comporte comme un pointeur vers sa première case : @@t[i]@@ est exactement @@*(t + i)@@, et @@p + 1@@ avance d'un <em>élément</em>, pas d'un octet.</p>
~~~c
#include <stdio.h>
#include <stdint.h>

void incrementer(uint32_t *compteur) {
    (*compteur)++;                       /* modifie la variable de l'appelant */
}

int main(void) {
    uint32_t n = 41;
    incrementer(&n);
    printf("n = %u\\n", n);

    const char *msg = "OK";
    for (const char *p = msg; *p != '\\0'; p++) {
        printf("'%c' = 0x%02X\\n", *p, *p);
    }
    return 0;
}
~~~
<p>Une <strong>chaîne</strong> C est un tableau de @@char@@ terminé par un octet nul (@@'\\0'@@). Rien ne vérifie qu'on reste dans les bornes : écrire après la fin d'un tableau écrase la mémoire voisine, et c'est la première source de bogues et de failles en C. Le mot-clé @@const@@ promet qu'une fonction ne modifiera pas ce qu'on lui passe.</p>
<p>Exemple de terrain : un module GPS envoie des phrases <strong>NMEA</strong> comme @@$GPGLL,4916.45,N,12311.12,W,225444,A*31@@. Les deux chiffres hexadécimaux après @@*@@ sont une <em>somme de contrôle</em> : le OU exclusif de tous les caractères entre @@$@@ et @@*@@. Le récepteur la recalcule pour détecter une phrase abîmée en route.</p>`,
    setup: LAB,
    quiz: [
      { q: "p pointe sur un uint32_t à l'adresse 0x1000. Que vaut p + 2 ?", options: ["0x1002", "0x1008", "0x1020", "0x1004"], answer: 1, explain: "On avance de 2 éléments de 4 octets." },
      { q: "Comment une fonction peut-elle modifier une variable de l'appelant ?", options: ["En la renvoyant seulement", "En recevant son adresse (un pointeur) et en écrivant à travers", "Avec global", "C'est impossible en C"], answer: 1, explain: "Le C passe les arguments par valeur ; le pointeur permet d'écrire dans la variable d'origine." }
    ],
    challenge: {
      prompt: `<p>Écris @@uint8_t nmea_somme(const char *phrase)@@ : le OU exclusif de tous les caractères situés après le @@$@@ initial et avant le @@*@@ (ou la fin de la chaîne). Puis @@int nmea_valide(const char *phrase)@@ : 1 si la phrase commence par @@$@@, contient un @@*@@ suivi de deux chiffres hexadécimaux (majuscules) égaux à la somme calculée, sinon 0.</p>`,
      starter: C`#include <stdint.h>

uint8_t nmea_somme(const char *phrase) {
    return 0;
}

int nmea_valide(const char *phrase) {
    return 1;
}
`,
      solution: C`#include <stdint.h>

uint8_t nmea_somme(const char *phrase) {
    uint8_t s = 0;
    const char *p = phrase;
    if (*p == '$') p++;
    while (*p != '\0' && *p != '*') {
        s ^= (uint8_t)*p;
        p++;
    }
    return s;
}

static int hex(char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return -1;
}

int nmea_valide(const char *phrase) {
    const char *p = phrase;
    if (*p != '$') return 0;
    while (*p != '\0' && *p != '*') p++;
    if (*p != '*') return 0;
    int fort = hex(p[1]);
    if (fort < 0) return 0;
    int faible = hex(p[2]);
    if (faible < 0) return 0;
    return (fort * 16 + faible) == nmea_somme(phrase);
}
`,
      tests: C`#include <stdio.h>

int main(void) {
    const char *gll = "$GPGLL,4916.45,N,12311.12,W,225444,A*31";
    printf("somme 0x%02X, valide %d\n", nmea_somme(gll), nmea_valide(gll));
    printf("%d %d %d %d\n", nmea_valide("$GPGLL,4916.45,N,12311.12,W,225444,A*32"),
           nmea_valide("GPGLL,4916.45,N*31"), nmea_valide("$GPGLL,4916.45"), nmea_valide("$A*41"));
    printf("0x%02X\n", nmea_somme("$GPRMC,092750.000,A,5321.6802,N,00630.3372,W,0.02,31.66,280511,,,A"));
    return 0;
}
`,
      expected: "somme 0x31, valide 1\n0 0 0 1\n0x43\n",
      hint: "Avance un pointeur p après le $, puis XOR chaque *p jusqu'au * ou au '\\0'. Pour la validation, retrouve le *, convertis p[1] et p[2] en valeurs de 0 à 15, et compare fort × 16 + faible à la somme."
    }
  },
  {
    id: "em-05", section: "Le C de l'embarqué", title: "Structures et registres mappés en mémoire", xp: 120,
    theory: `<p>Sur un microcontrôleur, les périphériques (GPIO, timers, convertisseurs) sont commandés par des <strong>registres</strong> placés à des adresses fixes : la documentation du STM32F4 indique par exemple que le registre de sortie du port A est à @@0x40020014@@. Écrire à cette adresse allume physiquement les broches :</p>
~~~c norun
#define GPIOA_ODR (*(volatile uint32_t *)0x40020014u)
GPIOA_ODR |= (1u << 5);       /* la LED de la carte Nucleo s'allume */
~~~
<p>Les registres d'un périphérique se suivent en mémoire : on les décrit par une <strong>structure</strong>, et on manipule le périphérique avec un pointeur vers elle. C'est exactement ce que font les en-têtes CMSIS des STM32 : @@GPIOA->ODR@@, @@TIM2->ARR@@. Le mot-clé <strong>@@volatile@@</strong> est indispensable : il interdit au compilateur de supposer que la valeur ne change pas toute seule, ou de supprimer une écriture qui lui semble inutile. Sans lui, une boucle qui attend un bit d'état peut être optimisée en boucle infinie.</p>
<p>Le simulateur de ce cours fournit @@mcu.h@@ : les mêmes structures que CMSIS (@@GPIO_TypeDef@@, @@TIM_TypeDef@@…), avec des variables à la place des adresses physiques, pour que le code tourne aussi bien ici qu'avec gcc. Le registre @@BSRR@@ (bit set/reset) met une broche à 1 avec le bit @@n@@, à 0 avec le bit @@n + 16@@, en une seule écriture atomique.</p>
~~~c
#include <stdio.h>
#include "mcu.h"

int main(void) {
    GPIOA->MODER = (GPIOA->MODER & ~(3u << 10)) | (1u << 10);  /* PA5 en sortie */
    GPIOA->BSRR = 1u << 5;                                     /* PA5 à 1 */
    sim_gpio(GPIOA);                                           /* le « matériel » applique BSRR */
    printf("ODR = 0x%04X, sizeof(GPIO_TypeDef) = %lu\\n", GPIOA->ODR, sizeof(GPIO_TypeDef));
    return 0;
}
~~~`,
    setup: LAB,
    quiz: [
      { q: "Que se passe-t-il si on oublie volatile sur un registre d'état lu dans une boucle d'attente ?", options: ["Rien", "Le compilateur peut lire le registre une seule fois et transformer l'attente en boucle infinie", "Le programme ne compile pas", "Le registre s'efface"], answer: 1, explain: "volatile force une vraie lecture mémoire à chaque accès." },
      { q: "Pourquoi utiliser BSRR plutôt que ODR |= … pour allumer une broche ?", options: ["C'est plus court", "Une seule écriture, sans lecture préalable : aucune interruption ne peut s'intercaler et perdre une modification", "ODR est en lecture seule", "BSRR est plus rapide à câbler"], answer: 1, explain: "Le lire-modifier-écrire sur ODR n'est pas atomique." }
    ],
    challenge: {
      prompt: `<p>Avec les structures de @@mcu.h@@, écris :</p><ul><li>@@void gpio_mode(GPIO_TypeDef *g, int broche, uint32_t mode)@@ : écrit @@mode@@ (0 à 3) dans le champ de 2 bits de la broche dans @@MODER@@, sans toucher aux autres broches ;</li><li>@@void gpio_ecrire(GPIO_TypeDef *g, int broche, int niveau)@@ : met la broche à 1 ou à 0 <strong>en une seule écriture de BSRR</strong> ;</li><li>@@int gpio_lire(GPIO_TypeDef *g, int broche)@@ : 0 ou 1, d'après @@IDR@@.</li></ul>`,
      starter: C`#include "mcu.h"

void gpio_mode(GPIO_TypeDef *g, int broche, uint32_t mode) {
    g->MODER = mode;
}

void gpio_ecrire(GPIO_TypeDef *g, int broche, int niveau) {
    g->ODR = niveau;
}

int gpio_lire(GPIO_TypeDef *g, int broche) {
    return g->IDR;
}
`,
      solution: C`#include "mcu.h"

void gpio_mode(GPIO_TypeDef *g, int broche, uint32_t mode) {
    g->MODER = (g->MODER & ~(3u << (2 * broche))) | ((mode & 3u) << (2 * broche));
}

void gpio_ecrire(GPIO_TypeDef *g, int broche, int niveau) {
    g->BSRR = niveau ? (1u << broche) : (1u << (broche + 16));
}

int gpio_lire(GPIO_TypeDef *g, int broche) {
    return (g->IDR >> broche) & 1u;
}
`,
      tests: C`#include <stdio.h>

int main(void) {
    GPIOA->MODER = 0xA8000000u;
    gpio_mode(GPIOA, 5, 1);
    gpio_mode(GPIOA, 0, 3);
    printf("MODER = 0x%08X\n", GPIOA->MODER);
    gpio_ecrire(GPIOA, 5, 1);
    printf("BSRR = 0x%08X\n", GPIOA->BSRR);
    sim_gpio(GPIOA);
    printf("ODR = 0x%04X, PA5 = %d\n", GPIOA->ODR, gpio_lire(GPIOA, 5));
    gpio_ecrire(GPIOA, 5, 0);
    printf("BSRR = 0x%08X\n", GPIOA->BSRR);
    sim_gpio(GPIOA);
    printf("ODR = 0x%04X, PA5 = %d\n", GPIOA->ODR, gpio_lire(GPIOA, 5));
    sim_broche(GPIOB, 13, 1);
    printf("PB13 = %d, PB12 = %d\n", gpio_lire(GPIOB, 13), gpio_lire(GPIOB, 12));
    return 0;
}
`,
      expected: "MODER = 0xA8000403\nBSRR = 0x00000020\nODR = 0x0020, PA5 = 1\nBSRR = 0x00200000\nODR = 0x0000, PA5 = 0\nPB13 = 1, PB12 = 0\n",
      hint: "Le champ de la broche b commence au bit 2 × b : efface-le avec & ~(3u << (2 * b)), puis ajoute (mode & 3u) << (2 * b). Pour BSRR : 1u << b pour 1, 1u << (b + 16) pour 0."
    }
  }
];
