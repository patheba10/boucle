/* Exercices courts du cours C embarqué (format : README, « exercices »). Chaque programme est compilé par gcc
   et exécuté par l'interpréteur du navigateur dans npm run validate : les deux sorties doivent être identiques. */
const C = String.raw;

export default {
  "em-01": [
    { type: "sortie", code: C`#include <stdio.h>

int main(void) {
    int t[4] = {3, 1, 4, 1};
    int somme = 0;
    for (int i = 0; i < 4; i++) {
        somme += t[i];
    }
    printf("%d %d\n", somme, somme / 4);
    printf("%.2f\n", somme / 4.0);
    return 0;
}`, reponse: "9 2\n2.25",
      explain: "Entre deux int, / est une division entière : 9 / 4 vaut 2. Dès qu'un opérande est un double (4.0), le calcul se fait en flottant." },
    { type: "ordre", avant: "#include <stdio.h>\n", lignes: ["int double_de(int x) {", "    return 2 * x;", "}", "int main(void) {", "    printf(\"%d\\n\", double_de(21));", "    return 0;", "}"], attendu: "42",
      explain: "En C, une fonction doit être déclarée avant son premier appel : double_de est définie au-dessus de main." }
  ],
  "em-02": [
    { type: "sortie", code: C`#include <stdio.h>
#include <stdint.h>

int main(void) {
    uint8_t a = 250;
    a += 10;
    uint16_t b = 0;
    b--;
    printf("%u %u\n", a, b);
    return 0;
}`, reponse: "4 65535",
      explain: "Un entier non signé calcule modulo 2ⁿ : 260 mod 256 = 4 sur 8 bits, et 0 − 1 donne 65 535 sur 16 bits." },
    { type: "trous", consigne: "La deuxième ligne affichée doit être « 1 2 » : un octet non signé, puis un entier signé sur 16 bits.", code: C`#include <stdio.h>
#include <stdint.h>

int main(void) {
    ⟦uint8_t⟧ octet = 200;          /* un octet reçu : 0 à 255 */
    ⟦int16_t⟧ temperature = -125;   /* en dixièmes de degré */
    printf("%u %d\n", octet, temperature);
    printf("%u %u\n", (unsigned)sizeof(octet), (unsigned)sizeof(temperature));
    return 0;
}`, attendu: "200 -125\n1 2",
      explain: C`Les types de @@<stdint.h>@@ donnent la taille dans leur nom : @@uint8_t@@ tient sur 1 octet sans signe, @@int16_t@@ sur 2 octets avec signe.` }
  ],
  "em-03": [
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
    reg ⟦|=⟧ (1u << 5);   /* met le bit 5 à 1 sans toucher aux autres */
    unsigned actif = (reg ⟦>>⟧ 5) & 1u;
    printf("%u\n", actif);
    return 0;
}`, attendu: "1",
      explain: C`@@|=@@ allume un bit ; pour le lire, on le décale jusqu'à la position 0 avec @@>>@@ puis on isole ce bit avec @@& 1u@@.` },
    { type: "ordre", lignes: ["#include <stdio.h>", "int main(void) {", "    unsigned x = 0xF0u;", "    x ^= 0xFFu;", "    printf(\"0x%02X\\n\", x);", "    return 0;", "}"], attendu: "0x0F",
      explain: C`Le XOR avec 0xFF inverse les 8 bits bas : 0xF0 devient 0x0F. Il faut l'appliquer avant l'affichage.` }
  ],
  "em-04": [
    { type: "sortie", code: C`#include <stdio.h>

void echanger(int *a, int *b) {
    int t = *a;
    *a = *b;
    *b = t;
}

int main(void) {
    int x = 3, y = 8;
    int tab[3] = {10, 20, 30};
    int *p = tab;
    echanger(&x, &y);
    p++;
    printf("%d %d %d %d\n", x, y, *p, *(p + 1));
    return 0;
}`, reponse: "8 3 20 30",
      explain: C`@@echanger@@ reçoit les adresses : elle modifie les variables de l'appelant. @@p++@@ avance d'un élément ; @@*(p + 1)@@ est donc @@tab[2]@@.` },
    { type: "trous", code: C`#include <stdio.h>

unsigned longueur(const char *s) {
    unsigned n = 0;
    while (s[n] != ⟦'\0'§0⟧) {
        n++;
    }
    return n;
}

int main(void) {
    printf("%u\n", longueur("capteur"));
    return 0;
}`, attendu: "7",
      explain: C`Une chaîne C se termine par l'octet nul @@'\0'@@ : on compte les caractères jusqu'à lui, sans le compter.` }
  ],
  "em-05": [
    { type: "sortie", code: C`#include <stdio.h>
#include <stdint.h>

typedef struct {
    volatile uint32_t MODER;
    volatile uint32_t ODR;
} Gpio;

int main(void) {
    Gpio port = {0u, 0u};
    Gpio *g = &port;
    g->ODR |= (1u << 5);
    g->ODR |= (1u << 0);
    g->ODR &= ~(1u << 5);
    printf("0x%02X\n", g->ODR);
    return 0;
}`, reponse: "0x01",
      explain: "Le bit 5 est allumé puis éteint ; seul le bit 0 reste : 0x01. Les champs d'une structure de registres se manipulent comme n'importe quelle variable." },
    { type: "trous", consigne: "Accède au champ par le pointeur, puis directement par la structure.", code: C`#include <stdio.h>
#include <stdint.h>

typedef struct {
    uint32_t CR;
    uint32_t SR;
} Uart;

int main(void) {
    Uart u = {0u, 0x80u};
    Uart *p = &u;
    p⟦->⟧CR = 1u;
    printf("%u %u\n", u⟦.⟧CR, (p->SR >> 7) & 1u);
    return 0;
}`, attendu: "1 1",
      explain: C`@@->@@ accède à un champ à travers un pointeur (comme @@GPIOA->ODR@@), @@.@@ directement sur la structure.` }
  ],
  "em-06": [
    { type: "sortie", code: C`#include <stdio.h>

int main(void) {
    int lectures[10] = {0, 1, 0, 1, 1, 1, 1, 0, 1, 1};
    int etat = 0, compte = 0, appuis = 0;
    for (int i = 0; i < 10; i++) {
        if (lectures[i] != etat) {
            compte++;
            if (compte == 3) {
                etat = lectures[i];
                compte = 0;
                if (etat == 1) appuis++;
            }
        } else {
            compte = 0;
        }
    }
    printf("%d %d\n", etat, appuis);
    return 0;
}`, reponse: "1 1",
      explain: "Un changement n'est validé qu'après trois lectures différentes de suite : les rebonds des lectures 1 et 7 sont ignorés, l'appui est compté une seule fois." },
    { type: "trous", code: C`#include <stdio.h>
#include <stdint.h>

int main(void) {
    int lectures[12] = {1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1};
    uint8_t hist = 0;
    for (int i = 0; i < 12; i++) {
        hist = (uint8_t)((hist ⟦<<⟧ 1) | lectures[i]);
        if (hist == ⟦0xFF§0xff§255⟧) {
            printf("stable : lecture %d\n", i);
            break;
        }
    }
    return 0;
}`, attendu: "stable : lecture 9",
      explain: "Chaque lecture entre par la droite d'un octet d'historique ; huit 1 de suite donnent 0xFF : l'entrée est stable." }
  ],
  "em-07": [
    { type: "sortie", code: C`#include <stdio.h>
#include <stdint.h>

int main(void) {
    uint32_t f_cpu = 16000000u;
    uint32_t psc = 1599u, arr = 9999u;
    printf("%u Hz\n", f_cpu / ((psc + 1u) * (arr + 1u)));
    arr = 4999u;
    printf("%u Hz\n", f_cpu / ((psc + 1u) * (arr + 1u)));
    return 0;
}`, reponse: "1 Hz\n2 Hz",
      explain: "f = f_cpu / ((PSC + 1) × (ARR + 1)) : 16 000 000 / (1 600 × 10 000) = 1 Hz. Diviser ARR + 1 par deux double la fréquence." },
    { type: "trous", code: C`#include <stdio.h>
#include <stdint.h>

#define UIF (1u << 0)
uint32_t sr = 0;                   /* registre d'état simulé */
⟦volatile⟧ uint32_t ticks = 0;   /* partagé avec l'interruption */

void TIM2_IRQHandler(void) {
    if (sr & UIF) {
        sr &= ⟦~⟧UIF;            /* effacer la cause */
        ticks++;
    }
}

int main(void) {
    for (int i = 0; i < 3; i++) {
        sr |= UIF;                 /* le timer déborde */
        TIM2_IRQHandler();
        TIM2_IRQHandler();         /* appel en trop : rien ne doit changer */
    }
    printf("%u %u\n", ticks, sr);
    return 0;
}`, attendu: "3 0",
      explain: C`Une variable modifiée par une interruption est @@volatile@@. L'ISR efface son drapeau avec @@&= ~UIF@@ : sinon elle se redéclencherait aussitôt et compterait deux fois.` }
  ],
  "em-08": [
    { type: "sortie", code: C`#include <stdio.h>
#include <stdint.h>

int main(void) {
    uint32_t arr = 999u, ccr = 250u;
    printf("%u %%\n", ccr * 100u / (arr + 1u));
    uint32_t angle = 90u;              /* servo : 1000 us à 0°, 2000 us à 180° */
    printf("%u us\n", 1000u + angle * 1000u / 180u);
    return 0;
}`, reponse: "25 %\n1500 us",
      explain: "Rapport cyclique = CCR / (ARR + 1) = 250 / 1000. Pour le servo, 90° est à mi-chemin entre 1 ms et 2 ms." },
    { type: "trous", code: C`#include <stdio.h>
#include <stdint.h>

uint32_t ccr_pour(uint32_t pourcent, uint32_t arr) {
    return pourcent * (arr ⟦+⟧ 1u) ⟦/⟧ 100u;
}

int main(void) {
    printf("%u %u\n", ccr_pour(50u, 999u), ccr_pour(10u, 19999u));
    return 0;
}`, attendu: "500 2000",
      explain: "Le timer compte ARR + 1 pas par période ; CCR en est la fraction voulue. On multiplie avant de diviser pour ne pas perdre de précision." }
  ],
  "em-09": [
    { type: "sortie", code: C`#include <stdio.h>
#include <stdint.h>

int main(void) {
    uint32_t brut = 1000u;
    printf("%u\n", brut * 3300u / 4096u);
    printf("%u\n", brut / 4096u * 3300u);
    return 0;
}`, reponse: "805\n0",
      explain: "Multiplier d'abord garde la précision (3 300 000 / 4 096 = 805). Diviser d'abord donne 1000 / 4096 = 0 en entier, et tout est perdu." },
    { type: "trous", code: C`#include <stdio.h>
#include <stdint.h>

uint32_t vers_mv(uint16_t brut) {
    return (uint32_t)brut ⟦*⟧ 3300u ⟦/⟧ 4096u;
}

int main(void) {
    printf("%u %u %u\n", vers_mv(0), vers_mv(2048), vers_mv(4095));
    return 0;
}`, attendu: "0 1650 3299",
      explain: "Sur 12 bits, 4 096 pas couvrent 0 à Vref : le maximum 4 095 donne presque 3 300 mV. Le cast en 32 bits évite le dépassement de la multiplication." }
  ],
  "em-10": [
    { type: "sortie", code: C`#include <stdio.h>
#include <stdint.h>

#define TAILLE 4u

int main(void) {
    uint8_t buf[TAILLE];
    unsigned tete = 0, queue = 0;
    for (char c = 'A'; c <= 'F'; c++) {
        unsigned suivante = (tete + 1u) % TAILLE;
        if (suivante == queue) {
            printf("plein : %c\n", c);
            continue;
        }
        buf[tete] = (uint8_t)c;
        tete = suivante;
    }
    while (queue != tete) {
        printf("%c", buf[queue]);
        queue = (queue + 1u) % TAILLE;
    }
    printf("\n");
    return 0;
}`, reponse: "plein : D\nplein : E\nplein : F\nABC",
      explain: "Une case reste toujours vide pour distinguer « plein » de « vide » : un tampon de 4 cases garde 3 octets. Les suivants sont refusés, et la lecture rend A, B, C dans l'ordre d'arrivée." },
    { type: "trous", code: C`#include <stdio.h>
#include <stdint.h>
#include <stdbool.h>

#define TAILLE 8u

typedef struct {
    uint8_t donnees[TAILLE];
    unsigned tete, queue;
} Tampon;

bool pousser(Tampon *t, uint8_t o) {
    unsigned suivante = (t->tete + 1u) ⟦%⟧ TAILLE;
    if (suivante ⟦==⟧ t->queue) return false;
    t->donnees[t->tete] = o;
    t->tete = suivante;
    return true;
}

int main(void) {
    Tampon t = {{0}, 0u, 0u};
    int acceptes = 0;
    for (int i = 0; i < 10; i++) acceptes += pousser(&t, (uint8_t)i);
    printf("%d\n", acceptes);
    return 0;
}`, attendu: "7",
      explain: C`Les indices tournent modulo la taille. Le tampon est plein quand la prochaine case d'écriture rattraperait la lecture : 7 octets acceptés sur 8 cases.` }
  ],
  "em-11": [
    { type: "sortie", code: C`#include <stdio.h>
#include <stdint.h>

int main(void) {
    uint8_t adr = 0x48;                       /* TMP102 */
    printf("0x%02X 0x%02X\n", (adr << 1) | 0u, (adr << 1) | 1u);
    uint8_t msb = 0x19, lsb = 0x00;           /* deux octets lus */
    int brut = (msb << 4) | (lsb >> 4);       /* 12 bits utiles */
    int centiemes = brut * 625 / 100;         /* 0,0625 °C par pas */
    printf("%d.%02d\n", centiemes / 100, centiemes % 100);
    return 0;
}`, reponse: "0x90 0x91\n25.00",
      explain: "L'octet d'adresse I2C est l'adresse 7 bits décalée d'un cran, avec le sens en bit 0. La température 0x190 = 400 pas × 0,0625 = 25 °C." },
    { type: "trous", code: C`#include <stdio.h>
#include <stdint.h>

uint8_t octet_adresse(uint8_t adr7, int lecture) {
    return (uint8_t)((adr7 ⟦<<⟧ 1) | (lecture ? 1u : 0u));
}

int main(void) {
    printf("0x%02X 0x%02X\n", octet_adresse(0x76, 0), octet_adresse(0x76, 1));
    return 0;
}`, attendu: "0xEC 0xED",
      explain: "0x76 (un BME280) décalé d'un bit donne 0xEC pour écrire, 0xED pour lire." }
  ],
  "em-12": [
    { type: "sortie", code: C`#include <stdio.h>
#include <stdint.h>

int main(void) {
    uint32_t echeance = 4294967290u;   /* fixée juste avant que le compteur fasse le tour */
    uint32_t maintenant = 5u;          /* il a fait le tour */
    printf("%d %d\n", maintenant >= echeance, (int32_t)(maintenant - echeance) >= 0);
    return 0;
}`, reponse: "0 1",
      explain: "La comparaison directe croit l'échéance lointaine. La différence non signée vaut 11, positive : l'échéance est passée depuis 11 ms. C'est la forme sûre." },
    { type: "trous", code: C`#include <stdio.h>
#include <stdint.h>

int main(void) {
    uint32_t prochain = 100u;
    int lectures = 0;
    for (uint32_t maintenant = 0u; maintenant <= 350u; maintenant += 10u) {
        if ((int32_t)(maintenant ⟦-⟧ prochain) ⟦>=⟧ 0) {
            lectures++;
            prochain ⟦+=⟧ 100u;
        }
    }
    printf("%d %u\n", lectures, prochain);
    return 0;
}`, attendu: "3 400",
      explain: "La tâche se déclenche à 100, 200 et 300 ms ; chaque fois, sa prochaine échéance avance de sa période." }
  ],
  "em-14": [
    { type: "sortie", code: C`#include <stdio.h>
#include <stdint.h>

int main(void) {
    uint8_t lu = 0x57;    /* ctrl_meas du BME280 : osrs_t bits 7-5, osrs_p bits 4-2, mode bits 1-0 */
    printf("%u %u %u\n", (lu >> 5) & 7u, (lu >> 2) & 7u, lu & 3u);
    return 0;
}`, reponse: "2 5 3",
      explain: "0x57 = 010 101 11 en binaire : osrs_t = 2, osrs_p = 5, mode = 3 (normal). On décale le champ jusqu'au bit 0, puis on le masque sur sa largeur." },
    { type: "trous", consigne: "Dans ctrl_meas, osrs_t occupe les bits 7 à 5, osrs_p les bits 4 à 2 et mode les bits 1 et 0.", code: C`#include <stdio.h>
#include <stdint.h>

uint8_t ctrl(unsigned osrs_t, unsigned osrs_p, unsigned mode) {
    return (uint8_t)((osrs_t << ⟦5⟧) | (osrs_p << ⟦2⟧) | mode);
}

int main(void) {
    printf("0x%02X\n", ctrl(1u, 1u, 3u));
    return 0;
}`, attendu: "0x27",
      explain: "Chaque champ est décalé jusqu'à son bit de poids faible : 5 pour osrs_t, 2 pour osrs_p, 0 pour mode." }
  ],
  "em-15": [
    { type: "sortie", code: C`#include <stdio.h>

int main(void) {
    /* start, 8 bits de données (poids faible d'abord), stop */
    int trame[10] = {0, 1, 0, 0, 0, 0, 0, 1, 0, 1};
    unsigned octet = 0;
    for (int i = 0; i < 8; i++) {
        octet |= (unsigned)trame[1 + i] << i;
    }
    printf("0x%02X %c\n", octet, (char)octet);
    return 0;
}`, reponse: "0x41 A",
      explain: "Le premier bit de données est le bit 0 : les bits 0 et 6 sont à 1, soit 0x41, le code ASCII de A." },
    { type: "trous", code: C`#include <stdio.h>

int main(void) {
    unsigned haut_us = 250u, periode_us = 1000u;   /* mesurés à l'oscilloscope */
    printf("%u %%\n", haut_us * 100u ⟦/⟧ periode_us);
    printf("%u Hz\n", 1000000u ⟦/⟧ periode_us);
    return 0;
}`, attendu: "25 %\n1000 Hz",
      explain: "Le rapport cyclique est la durée haute sur la période ; la fréquence est l'inverse de la période (1 s = 1 000 000 µs)." }
  ],
  "em-17": [
    { type: "sortie", code: C`#include <stdio.h>

int quantifier(double x, double echelle, int zero) {
    int q = (int)(x / echelle + (x >= 0 ? 0.5 : -0.5)) + zero;
    if (q > 127) q = 127;
    if (q < -128) q = -128;
    return q;
}

int main(void) {
    printf("%d %d %d\n", quantifier(1.3, 0.25, -10), quantifier(-2.0, 0.25, -10), quantifier(40.0, 0.25, -10));
    return 0;
}`, reponse: "-5 -18 127",
      explain: "q = arrondi(x / échelle) + zéro : 5 − 10 = −5 et −8 − 10 = −18. 40 donnerait 150, hors de l'int8 : il est saturé à 127." },
    { type: "trous", code: C`#include <stdio.h>

double dequantifier(int q, double echelle, int zero) {
    return (q ⟦-⟧ zero) ⟦*⟧ echelle;
}

int main(void) {
    printf("%.2f %.2f\n", dequantifier(-5, 0.25, -10), dequantifier(127, 0.25, -10));
    return 0;
}`, attendu: "1.25 34.25",
      explain: "On retire le point zéro puis on multiplie par l'échelle. 127 redonne 34,25 et non 40 : la saturation a perdu de l'information." }
  ]
};
