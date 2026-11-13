/* Défis gradués du cours C embarqué : une question d'entretien embarqué classique par leçon (format : README,
   « defis »). npm run validate compile chaque solution avec gcc et l'exécute dans l'interpréteur du navigateur. */
const C = String.raw;

export default {
  "em-02": [{
    niveau: "entretien",
    prompt: C`<p>Écris @@int addition_sure(int32_t a, int32_t b, int32_t *res)@@ : si @@a + b@@ tient dans un @@int32_t@@, range la somme dans @@*res@@ et renvoie 1 ; sinon, ne touche pas à @@*res@@ et renvoie 0. Le débordement d'un entier signé est un comportement indéfini en C : il faut le détecter <em>avant</em> de faire l'addition.</p>`,
    starter: "#include <stdint.h>\n\nint addition_sure(int32_t a, int32_t b, int32_t *res) {\n    *res = a + b;\n    return 1;\n}\n",
    solution: C`#include <stdint.h>

int addition_sure(int32_t a, int32_t b, int32_t *res) {
    if (b > 0 && a > INT32_MAX - b) return 0;   /* dépasserait par le haut */
    if (b < 0 && a < INT32_MIN - b) return 0;   /* dépasserait par le bas */
    *res = a + b;
    return 1;
}
`,
    tests: C`#include <stdio.h>

int main(void) {
    int32_t r = 7;
    int ok = addition_sure(2000000000, 100000000, &r);
    printf("%d %d\n", ok, (int)r);
    ok = addition_sure(-2000000000, -200000000, &r);
    printf("%d %d\n", ok, (int)r);
    ok = addition_sure(2147483000, 647, &r);
    printf("%d %d\n", ok, (int)r);
    ok = addition_sure(-5, 3, &r);
    printf("%d %d\n", ok, (int)r);
    return 0;
}
`,
    expected: "1 2100000000\n0 2100000000\n1 2147483647\n1 -2",
    hints: ["Ne calcule pas a + b pour voir s'il déborde : c'est déjà trop tard (comportement indéfini).", "Si b > 0, la somme déborde exactement quand a > INT32_MAX − b ; si b < 0, quand a < INT32_MIN − b. Ces deux soustractions ne débordent jamais."]
  }],
  "em-03": [{
    niveau: "entretien",
    prompt: C`<p>Deux classiques : @@int bits_a_un(uint32_t x)@@ compte les bits à 1 de @@x@@, et @@int puissance_de_deux(uint32_t x)@@ renvoie 1 si @@x@@ est une puissance de deux (0 n'en est pas une). Sans boucle pour le second : une seule expression avec @@x & (x - 1)@@.</p>`,
    starter: "#include <stdint.h>\n\nint bits_a_un(uint32_t x) {\n    return x != 0;\n}\n\nint puissance_de_deux(uint32_t x) {\n    return x % 2 == 0;\n}\n",
    solution: C`#include <stdint.h>

int bits_a_un(uint32_t x) {
    int n = 0;
    while (x) {
        x &= x - 1;      /* efface le bit à 1 le plus bas */
        n++;
    }
    return n;
}

int puissance_de_deux(uint32_t x) {
    return x != 0 && (x & (x - 1)) == 0;
}
`,
    tests: C`#include <stdio.h>

int main(void) {
    printf("%d %d %d %d\n", bits_a_un(0), bits_a_un(0xB5u), bits_a_un(0xFFFFFFFFu), bits_a_un(0x80000000u));
    printf("%d %d %d %d %d\n", puissance_de_deux(0), puissance_de_deux(1), puissance_de_deux(64), puissance_de_deux(96), puissance_de_deux(0x80000000u));
    return 0;
}
`,
    expected: "0 5 32 1\n0 1 1 0 1",
    hints: ["x − 1 inverse le bit à 1 le plus bas et tous les zéros en dessous : x & (x − 1) efface donc exactement ce bit.", "Compter les bits : répéter x &= x − 1 jusqu'à 0. Une puissance de deux n'a qu'un bit à 1 : x & (x − 1) vaut 0, à condition que x ne soit pas nul."]
  }],
  "em-04": [{
    niveau: "entretien",
    prompt: C`<p>Écris @@void inverser(char *s)@@, qui retourne la chaîne @@s@@ <em>sur place</em> (sans tableau intermédiaire ni @@strlen@@), avec deux pointeurs qui se rapprochent. La chaîne vide doit rester vide.</p>`,
    starter: "void inverser(char *s) {\n    (void)s;\n}\n",
    solution: C`void inverser(char *s) {
    char *fin = s;
    while (*fin != '\0') fin++;   /* fin pointe sur le '\0' */
    if (fin == s) return;
    fin--;                        /* dernier caractère */
    while (s < fin) {
        char t = *s;
        *s = *fin;
        *fin = t;
        s++;
        fin--;
    }
}
`,
    tests: C`#include <stdio.h>

int main(void) {
    char a[] = "capteur";
    char b[] = "ab";
    char c[] = "x";
    char d[] = "";
    inverser(a); inverser(b); inverser(c); inverser(d);
    printf("%s %s %s [%s]\n", a, b, c, d);
    return 0;
}
`,
    expected: "ruetpac ba x []",
    hints: ["Un premier pointeur avance jusqu'au '\\0' ; recule d'un cran pour viser le dernier caractère.", "Échange *s et *fin, puis rapproche les deux pointeurs tant que s < fin. Attention à la chaîne vide : il n'y a rien avant le '\\0'."]
  }],
  "em-05": [{
    niveau: "entretien",
    prompt: C`<p>Un capteur envoie ses mesures en gros-boutiste (octet de poids fort d'abord), un autre attend du petit-boutiste. Écris @@uint32_t lire_be32(const uint8_t *p)@@ et @@void ecrire_le16(uint8_t *p, uint16_t v)@@ avec des décalages : le résultat ne doit pas dépendre du boutisme du processeur (pas de cast de pointeur ni de @@memcpy@@).</p>`,
    starter: "#include <stdint.h>\n\nuint32_t lire_be32(const uint8_t *p) {\n    return p[0];\n}\n\nvoid ecrire_le16(uint8_t *p, uint16_t v) {\n    p[0] = (uint8_t)v;\n    p[1] = 0;\n}\n",
    solution: C`#include <stdint.h>

uint32_t lire_be32(const uint8_t *p) {
    return ((uint32_t)p[0] << 24) | ((uint32_t)p[1] << 16) | ((uint32_t)p[2] << 8) | (uint32_t)p[3];
}

void ecrire_le16(uint8_t *p, uint16_t v) {
    p[0] = (uint8_t)(v & 0xFFu);   /* poids faible d'abord */
    p[1] = (uint8_t)(v >> 8);
}
`,
    tests: C`#include <stdio.h>

int main(void) {
    const uint8_t trame[4] = {0x12, 0x34, 0xAB, 0xCD};
    printf("0x%08X\n", lire_be32(trame));
    const uint8_t max[4] = {0xFF, 0xFF, 0xFF, 0xFE};
    printf("%u\n", lire_be32(max));
    uint8_t sortie[2];
    ecrire_le16(sortie, 0xBEEF);
    printf("%02X %02X\n", sortie[0], sortie[1]);
    return 0;
}
`,
    expected: "0x1234ABCD\n4294967294\nEF BE",
    hints: ["Gros-boutiste : p[0] est l'octet de poids fort, à décaler de 24 bits. Caste chaque octet en uint32_t avant de le décaler.", "Petit-boutiste : p[0] reçoit l'octet de poids faible (v & 0xFF), p[1] l'octet de poids fort (v >> 8)."]
  }],
  "em-10": [{
    niveau: "entretien",
    prompt: C`<p>Une moyenne glissante sur les @@N = 4@@ dernières mesures d'un ADC, en O(1) par mesure : la structure @@Moyenne@@ garde un tampon circulaire et la <em>somme courante</em>. Écris @@void moyenne_init(Moyenne *m)@@ et @@uint16_t moyenne_ajouter(Moyenne *m, uint16_t x)@@, qui renvoie la moyenne (division entière) des mesures disponibles, au plus N.</p>`,
    starter: "#include <stdint.h>\n\n#define N 4u\n\ntypedef struct {\n    uint16_t valeurs[N];\n    unsigned pos, compte;\n    uint32_t somme;\n} Moyenne;\n\nvoid moyenne_init(Moyenne *m) {\n    m->pos = 0;\n    m->compte = 0;\n    m->somme = 0;\n}\n\nuint16_t moyenne_ajouter(Moyenne *m, uint16_t x) {\n    return x;\n}\n",
    solution: C`#include <stdint.h>

#define N 4u

typedef struct {
    uint16_t valeurs[N];
    unsigned pos, compte;
    uint32_t somme;
} Moyenne;

void moyenne_init(Moyenne *m) {
    m->pos = 0;
    m->compte = 0;
    m->somme = 0;
}

uint16_t moyenne_ajouter(Moyenne *m, uint16_t x) {
    if (m->compte == N) {
        m->somme -= m->valeurs[m->pos];   /* la plus ancienne sort */
    } else {
        m->compte++;
    }
    m->valeurs[m->pos] = x;
    m->somme += x;
    m->pos = (m->pos + 1u) % N;
    return (uint16_t)(m->somme / m->compte);
}
`,
    tests: C`#include <stdio.h>

int main(void) {
    Moyenne m;
    moyenne_init(&m);
    const uint16_t mesures[7] = {100, 200, 300, 400, 500, 4095, 4095};
    for (int i = 0; i < 7; i++) printf("%u ", moyenne_ajouter(&m, mesures[i]));
    printf("\n");
    return 0;
}
`,
    expected: "100 150 200 250 350 1323 2272",
    hints: ["Garde la somme des valeurs du tampon : à chaque mesure, ajoute la nouvelle et retire celle qu'elle écrase.", "Tant que le tampon n'est pas plein, rien ne sort et compte augmente ; la moyenne est somme / compte. La position d'écriture tourne modulo N."]
  }],
  "em-11": [{
    niveau: "entretien",
    prompt: C`<p>Les capteurs I2C (SHT3x, SMBus) protègent leurs mesures par un CRC-8 de polynôme @@0x07@@. Écris @@uint8_t crc8(const uint8_t *d, unsigned n, uint8_t init)@@ : pour chaque octet, XOR dans le CRC, puis 8 tours où l'on décale à gauche et, si le bit sorti valait 1, XOR avec le polynôme.</p>`,
    starter: "#include <stdint.h>\n\nuint8_t crc8(const uint8_t *d, unsigned n, uint8_t init) {\n    uint8_t crc = init;\n    for (unsigned i = 0; i < n; i++) crc ^= d[i];\n    return crc;\n}\n",
    solution: C`#include <stdint.h>

uint8_t crc8(const uint8_t *d, unsigned n, uint8_t init) {
    uint8_t crc = init;
    for (unsigned i = 0; i < n; i++) {
        crc ^= d[i];
        for (int b = 0; b < 8; b++) {
            if (crc & 0x80u) crc = (uint8_t)((crc << 1) ^ 0x07u);
            else crc = (uint8_t)(crc << 1);
        }
    }
    return crc;
}
`,
    tests: C`#include <stdio.h>

int main(void) {
    const uint8_t ref[9] = {'1', '2', '3', '4', '5', '6', '7', '8', '9'};
    printf("0x%02X\n", crc8(ref, 9, 0x00));
    const uint8_t mesure[2] = {0xBE, 0xEF};   /* deux octets lus sur le bus */
    printf("0x%02X 0x%02X\n", crc8(mesure, 2, 0x00), crc8(mesure, 0, 0xFF));
    return 0;
}
`,
    expected: "0xF4\n0x1A 0xFF",
    hints: ["Le CRC se calcule bit à bit : après le XOR de l'octet, on regarde le bit de poids fort (crc & 0x80).", "S'il vaut 1 : crc = (crc << 1) ^ 0x07 ; sinon crc = crc << 1, toujours ramené sur 8 bits par un cast en uint8_t."]
  }]
};
