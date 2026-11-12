/* Cours C embarqué — chapitre 3 : outils (datasheets, instruments, conception de cartes, simulateurs) et TinyML,
   le pont avec le chapitre TensorFlow Lite du cours de deep learning. */
import { LAB } from "./langage.js";
const C = String.raw;

export default [
  {
    id: "em-14", section: "Outils et TinyML", title: "Lire une datasheet", xp: 100,
    theory: `<p>La <strong>datasheet</strong> (fiche technique) est la seule source fiable sur un composant. Elle fait souvent plus de 50 pages ; on apprend à y aller directement aux bonnes sections :</p>
<ul><li><strong>caractéristiques absolues maximales</strong> : ce qu'il ne faut jamais dépasser (tension, courant, température), sous peine de destruction ;</li><li><strong>caractéristiques électriques</strong> : les valeurs de fonctionnement, en colonnes minimum, typique, maximum. On conçoit avec les pires cas, pas avec le typique ;</li><li><strong>brochage</strong> et schéma d'application recommandé (condensateurs de découplage, résistances de tirage) ;</li><li><strong>carte des registres</strong> : adresse de chaque registre, rôle de chaque champ de bits, valeur au démarrage ;</li><li><strong>chronogrammes</strong> : l'ordre et les délais des signaux du bus (I2C, SPI).</li></ul>
<p>Exemple : le capteur environnemental Bosch <strong>BME280</strong> (température, pression, humidité) se configure par le registre @@ctrl_meas@@, à l'adresse 0xF4 :</p>
~~~text
bit     7   6   5 │ 4   3   2 │ 1   0
champ   osrs_t    │ osrs_p    │ mode          suréchantillonnage : 000 désactivé, 001 ×1, 010 ×2,
                                                                    011 ×4, 100 ×8, 101 ×16
                                              mode : 00 veille, 01 forcé (une mesure), 11 normal
~~~
~~~c
#include <stdio.h>
#include <stdint.h>

int main(void) {
    uint8_t ctrl_meas = (uint8_t)((1u << 5) | (1u << 2) | 3u);   /* température ×1, pression ×1, normal */
    printf("ctrl_meas = 0x%02X\\n", ctrl_meas);
    return 0;
}
~~~
<p>Bonne pratique : nommer chaque champ et chaque valeur par une constante (@@#define BME280_OSRS_X1 1u@@) plutôt que d'écrire 0x27 sans explication, et citer la section de la datasheet en commentaire.</p>`,
    setup: LAB,
    quiz: [
      { q: "Une datasheet donne une tension d'entrée haute minimale VIH = 0,7 × VDD. Ton signal vaut 2,0 V sous VDD = 3,3 V. Est-il lu à 1 de façon garantie ?", options: ["Oui, 2,0 V est une tension haute", "Non : 0,7 × 3,3 = 2,31 V, il est en dessous du minimum garanti", "Oui si le câble est court", "Ça dépend de la température seulement"], answer: 1, explain: "Entre VIL max et VIH min, la lecture n'est pas garantie." },
      { q: "Pourquoi concevoir avec les valeurs minimales et maximales plutôt que typiques ?", options: ["Par prudence excessive", "Tous les exemplaires, à toutes les températures, doivent fonctionner : le typique ne garantit rien pour une pièce donnée", "Parce que le typique est faux", "Pour réduire le coût"], answer: 1, explain: "La conception au pire cas évite les pannes qui n'apparaissent que sur une partie des cartes." }
    ],
    challenge: {
      prompt: `<p>Écris @@int code_surechantillonnage(int facteur)@@ qui traduit 0 (désactivé), 1, 2, 4, 8 ou 16 en code de 3 bits du BME280 (0 à 5), ou renvoie -1 pour un facteur invalide. Puis @@int bme280_ctrl_meas(int osrs_t, int osrs_p, int mode, uint8_t *valeur)@@ : assemble le registre (@@mode@@ est déjà le code de 2 bits, de 0 à 3) et renvoie 0, ou renvoie -1 sans rien écrire si un paramètre est invalide.</p>`,
      starter: C`#include <stdint.h>

int code_surechantillonnage(int facteur) {
    return facteur;
}

int bme280_ctrl_meas(int osrs_t, int osrs_p, int mode, uint8_t *valeur) {
    *valeur = (uint8_t)(osrs_t | osrs_p | mode);
    return 0;
}
`,
      solution: C`#include <stdint.h>

int code_surechantillonnage(int facteur) {
    switch (facteur) {
    case 0: return 0;
    case 1: return 1;
    case 2: return 2;
    case 4: return 3;
    case 8: return 4;
    case 16: return 5;
    default: return -1;
    }
}

int bme280_ctrl_meas(int osrs_t, int osrs_p, int mode, uint8_t *valeur) {
    int t = code_surechantillonnage(osrs_t);
    int p = code_surechantillonnage(osrs_p);
    if (t < 0 || p < 0 || mode < 0 || mode > 3) return -1;
    *valeur = (uint8_t)((t << 5) | (p << 2) | mode);
    return 0;
}
`,
      tests: C`#include <stdio.h>

int main(void) {
    printf("%d %d %d %d\n", code_surechantillonnage(4), code_surechantillonnage(16), code_surechantillonnage(3), code_surechantillonnage(0));
    uint8_t v = 0xAA;
    int r = bme280_ctrl_meas(1, 1, 3, &v);
    printf("%d 0x%02X\n", r, v);
    r = bme280_ctrl_meas(2, 16, 3, &v);
    printf("%d 0x%02X\n", r, v);
    r = bme280_ctrl_meas(1, 0, 1, &v);
    printf("%d 0x%02X\n", r, v);
    v = 0xAA;
    r = bme280_ctrl_meas(3, 1, 3, &v);
    printf("%d 0x%02X\n", r, v);
    r = bme280_ctrl_meas(1, 1, 4, &v);
    printf("%d 0x%02X\n", r, v);
    return 0;
}
`,
      expected: "3 5 -1 0\n0 0x27\n0 0x57\n0 0x21\n-1 0xAA\n-1 0xAA\n",
      hint: "Un switch traduit le facteur (4 → 3, 8 → 4, 16 → 5). Vérifie tout avant d'écrire, puis (t << 5) | (p << 2) | mode."
    }
  },
  {
    id: "em-15", section: "Outils et TinyML", title: "Multimètre, oscilloscope, analyseur logique", xp: 110,
    theory: `<p>Déboguer du matériel, c'est mesurer au lieu de supposer. Trois instruments couvrent l'essentiel :</p>
<ul><li>le <strong>multimètre</strong> : tensions continues (l'alimentation est-elle bien à 3,3 V ?), continuité (ce fil est-il coupé ?), résistance hors tension, courant en série dans le circuit (la consommation en veille) ;</li><li>l'<strong>oscilloscope</strong> : la forme des signaux dans le temps. Une PWM a-t-elle le bon rapport cyclique ? L'alimentation chute-t-elle quand le moteur démarre ? Les fronts I2C sont-ils trop lents faute de résistances de tirage ?</li><li>l'<strong>analyseur logique</strong> : 8 voies numériques ou plus pour quelques dizaines d'euros, avec un logiciel (PulseView, Saleae Logic) qui <em>décode</em> les protocoles : il affiche directement les octets UART, les adresses I2C et les transactions SPI.</li></ul>
<p>Le décodage d'une trame UART suit sa définition : la ligne est à 1 au repos ; un bit de start à 0 annonce un octet ; suivent 8 bits de données, poids faible en premier, puis un bit de stop à 1. Si le stop vaut 0, c'est une <strong>erreur de trame</strong> (framing error) : souvent un débit mal réglé d'un côté.</p>
~~~text
repos  start  b0 b1 b2 b3 b4 b5 b6 b7  stop  repos      'K' = 0x4B = 0100 1011
 1  1    0     1  1  0  1  0  0  1  0    1    1  1       envoyé b0 d'abord : 1 1 0 1 0 0 1 0
~~~
<p>Règle d'or au laboratoire : une seule modification à la fois, et noter chaque mesure. Et toujours vérifier d'abord les masses communes et les alimentations : c'est la cause de la plupart des « bogues logiciels » qui n'en sont pas.</p>`,
    setup: LAB,
    quiz: [
      { q: "Ton capteur I2C ne répond pas. Quelle première mesure ?", options: ["Réécrire le pilote", "Vérifier au multimètre l'alimentation et la masse du capteur, puis regarder SDA et SCL à l'oscilloscope ou à l'analyseur logique", "Changer de microcontrôleur", "Augmenter le débit"], answer: 1, explain: "On commence par le plus simple et le plus fréquent : l'alimentation et le câblage." },
      { q: "L'analyseur logique affiche des erreurs de trame UART en continu. Cause probable ?", options: ["Un bogue de l'analyseur", "Un débit différent entre l'émetteur et le récepteur (ou dans le réglage de l'analyseur)", "Une LED grillée", "Un manque de mémoire"], answer: 1, explain: "Le bit de stop tombe au mauvais moment : l'échantillonnage ne correspond plus aux bits réels." }
    ],
    challenge: {
      prompt: `<p>Tu reçois une capture d'analyseur logique : un échantillon par bit (@@bits[i]@@ vaut 0 ou 1), la ligne étant à 1 au repos. Écris @@int uart_decoder(const uint8_t *bits, int n, uint8_t *octets, int max, int *erreurs)@@ : parcourt la capture ; à chaque 0 trouvé au repos, lit une trame complète (start, 8 bits de données poids faible en premier, stop) si elle tient dans la capture. Un stop à 1 donne un octet valide (dans la limite de @@max@@) et la lecture reprend après la trame ; un stop à 0 compte une erreur dans @@*erreurs@@ et la recherche reprend juste après ce start. Renvoie le nombre d'octets décodés.</p><p>Remarque : comme un vrai récepteur, après une erreur de trame le décodeur se resynchronise sur le 0 suivant, ce qui peut produire un octet parasite ; le test en contient un.</p>`,
      starter: C`#include <stdint.h>

int uart_decoder(const uint8_t *bits, int n, uint8_t *octets, int max, int *erreurs) {
    *erreurs = 0;
    int k = 0;
    for (int i = 0; i + 8 < n && k < max; i += 8) {
        uint8_t v = 0;
        for (int b = 0; b < 8; b++) v = (uint8_t)((v << 1) | bits[i + b]);
        octets[k++] = v;
    }
    return k;
}
`,
      solution: C`#include <stdint.h>

int uart_decoder(const uint8_t *bits, int n, uint8_t *octets, int max, int *erreurs) {
    int k = 0, i = 0;
    *erreurs = 0;
    while (i + 9 < n) {
        if (bits[i] != 0) {
            i++;
            continue;
        }
        if (bits[i + 9] != 1) {
            (*erreurs)++;
            i++;
            continue;
        }
        uint8_t v = 0;
        for (int b = 0; b < 8; b++) v |= (uint8_t)(bits[i + 1 + b] << b);
        if (k < max) octets[k++] = v;
        i += 10;
    }
    return k;
}
`,
      tests: C`#include <stdio.h>

static int emettre(uint8_t *ligne, int pos, uint8_t octet, int stop) {
    ligne[pos++] = 0;
    for (int b = 0; b < 8; b++) ligne[pos++] = (octet >> b) & 1u;
    ligne[pos++] = (uint8_t)stop;
    return pos;
}

int main(void) {
    uint8_t ligne[120];
    int n = 0;
    for (int i = 0; i < 3; i++) ligne[n++] = 1;
    n = emettre(ligne, n, 'O', 1);
    n = emettre(ligne, n, 'K', 1);
    ligne[n++] = 1;
    n = emettre(ligne, n, 0x00, 0);
    for (int i = 0; i < 4; i++) ligne[n++] = 1;
    n = emettre(ligne, n, '!', 1);
    ligne[n++] = 1;
    uint8_t octets[8];
    int erreurs;
    int k = uart_decoder(ligne, n, octets, 8, &erreurs);
    printf("%d octet(s), %d erreur(s) :", k, erreurs);
    for (int i = 0; i < k; i++) printf(" 0x%02X", octets[i]);
    printf("\n");
    k = uart_decoder(ligne, 25, octets, 1, &erreurs);
    printf("%d octet(s), %d erreur(s), premier '%c'\n", k, erreurs, octets[0]);
    return 0;
}
`,
      expected: "4 octet(s), 1 erreur(s) : 0x4F 0x4B 0x00 0x21\n1 octet(s), 0 erreur(s), premier 'O'\n",
      hint: "Avance i tant que bits[i] vaut 1. Sur un 0 : si bits[i + 9] n'est pas 1, compte une erreur et avance d'un seul pas ; sinon assemble v |= bits[i + 1 + b] << b, range l'octet et saute 10 pas."
    }
  },
  {
    id: "em-16", section: "Outils et TinyML", title: "Du schéma à la carte : KiCad et Wokwi", xp: 70, theoryOnly: true,
    theory: `<p>Un prototype commence sur plaque d'essai ou dans un simulateur ; un produit finit sur un <strong>circuit imprimé</strong> (PCB). Les étapes avec <strong>KiCad</strong>, logiciel libre et gratuit utilisé jusque dans l'industrie :</p>
~~~text
1. Schéma        symboles des composants, fils, étiquettes de nets ; vérification électrique (ERC)
2. Empreintes    l'empreinte physique de chaque composant : boîtier, pastilles (0603, SOIC-8, QFN…)
3. Placement     connecteurs et composants sur la carte ; découplage au plus près des puces
4. Routage       pistes, plans de masse, vias ; largeur des pistes selon le courant
5. DRC           vérification des règles du fabricant (espacements, diamètres de perçage)
6. Fabrication   fichiers Gerber et de perçage, nomenclature (BOM), fichier de placement
~~~
<p>Les fabricants en ligne livrent cinq cartes en une à deux semaines pour quelques euros, et peuvent aussi souder les composants CMS. Erreurs de débutant : oublier le plan de masse, des pistes d'alimentation trop fines, un connecteur de programmation (SWD, UART) absent, aucun point de test pour l'oscilloscope.</p>
<p>Avant même la carte, <strong>Wokwi</strong> simule dans le navigateur un Arduino, un ESP32, un STM32 ou un Raspberry Pi Pico avec LED, boutons, écrans, capteurs et un analyseur logique virtuel. Le montage est décrit dans un fichier @@diagram.json@@ et le programme compilé pour de vrai : c'est le meilleur pont entre ce cours et le matériel, et il s'intègre aussi en CI pour tester un firmware automatiquement.</p>
~~~text
{
  "parts": [
    { "type": "wokwi-pi-pico", "id": "pico" },
    { "type": "wokwi-led", "id": "led1", "attrs": { "color": "red" } },
    { "type": "wokwi-resistor", "id": "r1", "attrs": { "value": "220" } }
  ],
  "connections": [ [ "pico:GP15", "r1:1", "green" ], [ "r1:2", "led1:A", "green" ], [ "led1:C", "pico:GND.8", "black" ] ]
}
~~~`,
    setup: LAB,
    practice: { title: "S'entraîner", body: `<p>Dans KiCad, dessine le schéma d'un capteur sur batterie vu dans le cours d'électronique : LDO, diviseur de mesure de la batterie, microcontrôleur avec ses condensateurs de découplage, connecteur SWD et bouton avec pull-up. Lance l'ERC jusqu'à zéro erreur. Puis, sur Wokwi, câble le même circuit avec un Raspberry Pi Pico et fais clignoter une LED par interruption de timer.</p>` },
    quiz: [
      { q: "À quoi sert le DRC dans KiCad ?", options: ["À dessiner le schéma", "À vérifier que le routage respecte les règles du fabricant (espacements, largeurs, perçages)", "À commander les composants", "À simuler le circuit"], answer: 1, explain: "L'ERC vérifie le schéma, le DRC vérifie la carte." },
      { q: "Pourquoi prévoir un connecteur SWD ou UART sur la carte ?", options: ["Pour l'alimenter", "Pour programmer et déboguer le microcontrôleur une fois soudé", "Pour l'esthétique", "C'est obligatoire légalement"], answer: 1, explain: "Sans lui, une carte au firmware défectueux est presque impossible à reprogrammer." }
    ]
  },
  {
    id: "em-17", section: "Outils et TinyML", title: "TinyML : un réseau de neurones sur microcontrôleur", xp: 140,
    theory: `<p>Le <strong>TinyML</strong> fait tourner un modèle d'apprentissage automatique sur un microcontrôleur de quelques centaines de kilo-octets : détection d'un mot-clé, reconnaissance de gestes avec un accéléromètre, maintenance prédictive à partir des vibrations. C'est le prolongement direct du chapitre TensorFlow Lite du cours de deep learning :</p>
~~~text
Keras (entraînement, sur PC)  →  LiteRT, quantification entière int8 avec un jeu représentatif
   →  modele.tflite  →  xxd -i modele.tflite > modele.cc  →  firmware + LiteRT for Microcontrollers
~~~
~~~cpp norun
#include "tensorflow/lite/micro/micro_interpreter.h"
#include "tensorflow/lite/micro/micro_mutable_op_resolver.h"

alignas(16) static uint8_t arena[10 * 1024];              // mémoire de travail fixe : pas de malloc
static tflite::MicroMutableOpResolver<3> ops;              // seulement les opérations utilisées

void setup() {
  ops.AddFullyConnected(); ops.AddRelu(); ops.AddSoftmax();
  static tflite::MicroInterpreter interp(tflite::GetModel(modele_tflite), ops, arena, sizeof(arena));
  interp.AllocateTensors();
  TfLiteTensor *entree = interp.input(0);
  entree->data.int8[0] = quantifier(mesure, entree->params.scale, entree->params.zero_point);
  interp.Invoke();
}
~~~
<p>À l'intérieur, une couche dense quantifiée n'utilise que des entiers. Les poids sont en int8 avec un zéro à 0, les entrées et sorties en int8 avec leur échelle et leur zéro, les biais en int32. Pour chaque neurone de sortie :</p>
~~~text
acc = biais + Σ (x[i] − zéro_x) × w[i]           calcul exact en int32
y   = arrondi(acc × M) + zéro_y                   M = échelle_x × échelle_w / échelle_y (calculé à la conversion)
y   = max(y, zéro_y) avec ReLU, puis borné à [−128, 127]
~~~
<p>Sur une vraie puce, le multiplicateur @@M@@ est lui-même codé en virgule fixe (un entier et un décalage) pour éviter tout flottant ; ici on garde un @@double@@ pour la lisibilité. Les processeurs Cortex-M ont des instructions qui accélèrent exactement ces multiplications-accumulations (bibliothèque CMSIS-NN).</p>`,
    setup: LAB,
    quiz: [
      { q: "Pourquoi l'arena de LiteRT for Microcontrollers est-elle un tableau statique ?", options: ["Par simplicité d'écriture", "Pas d'allocation dynamique en embarqué : la mémoire nécessaire est connue et réservée à la compilation", "Pour aller plus vite à l'entraînement", "Parce que le modèle change de taille"], answer: 1, explain: "Comme le reste du firmware : pas de malloc, pas de fragmentation, pas de surprise." },
      { q: "Pourquoi l'accumulateur d'une couche int8 est-il en int32 ?", options: ["Par convention", "Des centaines de produits de deux int8 (jusqu'à 127 × 128 chacun) dépassent largement 8 et 16 bits", "Pour stocker les flottants", "Pour la ReLU"], answer: 1, explain: "Le résultat n'est ramené en int8 qu'à la fin, par le multiplicateur et le zéro de sortie." }
    ],
    challenge: {
      prompt: `<p>Écris @@void dense_int8(const int8_t *x, int n_in, const int8_t *w, const int32_t *biais, int n_out, Quant q, int relu, int8_t *y)@@ selon les formules de la théorie. @@w@@ est rangé ligne par ligne : le poids de l'entrée @@i@@ pour la sortie @@o@@ est @@w[o * n_in + i]@@. @@Quant@@ (fourni) contient @@zx@@, @@m@@ et @@zy@@. L'arrondi se fait au plus proche, les demis s'éloignant de zéro. Puis @@int argmax_int8(const int8_t *y, int n)@@ : l'indice de la plus grande sortie (la première en cas d'égalité).</p>`,
      starter: C`#include <stdint.h>

typedef struct {
    int32_t zx;
    double m;
    int32_t zy;
} Quant;

void dense_int8(const int8_t *x, int n_in, const int8_t *w, const int32_t *biais, int n_out, Quant q, int relu, int8_t *y) {
    for (int o = 0; o < n_out; o++) {
        int32_t acc = 0;
        for (int i = 0; i < n_in; i++) acc += x[i] * w[i];
        y[o] = (int8_t)acc;
    }
}

int argmax_int8(const int8_t *y, int n) {
    return 0;
}
`,
      solution: C`#include <stdint.h>

typedef struct {
    int32_t zx;
    double m;
    int32_t zy;
} Quant;

void dense_int8(const int8_t *x, int n_in, const int8_t *w, const int32_t *biais, int n_out, Quant q, int relu, int8_t *y) {
    for (int o = 0; o < n_out; o++) {
        int32_t acc = biais[o];
        for (int i = 0; i < n_in; i++) {
            acc += ((int32_t)x[i] - q.zx) * (int32_t)w[o * n_in + i];
        }
        double r = acc * q.m;
        int32_t v = (int32_t)(r >= 0 ? r + 0.5 : r - 0.5) + q.zy;
        if (relu && v < q.zy) v = q.zy;
        if (v < -128) v = -128;
        if (v > 127) v = 127;
        y[o] = (int8_t)v;
    }
}

int argmax_int8(const int8_t *y, int n) {
    int meilleur = 0;
    for (int i = 1; i < n; i++) {
        if (y[i] > y[meilleur]) meilleur = i;
    }
    return meilleur;
}
`,
      tests: C`#include <stdio.h>

int main(void) {
    /* une couche 4 → 3, comme la dernière couche d'un petit classifieur de gestes */
    const int8_t x[4] = {-128, 20, 75, 127};
    const int8_t w[12] = {12, -7, 33, 90,   -45, 64, 8, -3,   100, 100, -128, 5};
    const int32_t biais[3] = {150, -2000, 30};
    Quant q = {-128, 0.003, -10};
    int8_t y[3];
    dense_int8(x, 4, w, biais, 3, q, 0, y);
    printf("sans ReLU : %d %d %d, classe %d\n", y[0], y[1], y[2], argmax_int8(y, 3));
    dense_int8(x, 4, w, biais, 3, q, 1, y);
    printf("avec ReLU : %d %d %d, classe %d\n", y[0], y[1], y[2], argmax_int8(y, 3));
    Quant fin = {0, 0.5, 0};
    const int8_t x2[2] = {3, -3};
    const int8_t w2[4] = {1, 0, 0, 1};
    const int32_t b2[2] = {0, 0};
    dense_int8(x2, 2, w2, b2, 2, fin, 0, y);
    printf("arrondis : %d %d\n", y[0], y[1]);
    const int8_t egal[4] = {5, 9, 9, -1};
    printf("argmax %d\n", argmax_int8(egal, 4));
    return 0;
}
`,
      expected: "sans ReLU : 76 15 -40, classe 0\navec ReLU : 76 15 -10, classe 0\narrondis : 2 -2\nargmax 1\n",
      hint: "acc = biais[o] + Σ (x[i] − zx) × w[o × n_in + i] en int32 ; r = acc × m ; arrondi : r ≥ 0 ? r + 0.5 : r − 0.5 converti en int32 ; ajoute zy, applique la ReLU (v ≥ zy) puis borne à [−128, 127]."
    }
  }
];
