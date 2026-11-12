/* Cours C embarqué — chapitre 2 : périphériques (GPIO, timers et interruptions, PWM, ADC, UART, I2C et SPI),
   ordonnancement et énergie ; entretien. Le matériel est simulé par mcu.h. */
import { LAB } from "./langage.js";
const C = String.raw;

export default [
  {
    id: "em-06", section: "Périphériques", title: "Lire un bouton : anti-rebond logiciel", xp: 110,
    theory: `<p>Un bouton mécanique ne passe pas proprement de 0 à 1 : ses contacts <strong>rebondissent</strong> pendant 1 à 10 ms, et le microcontrôleur, qui lit l'entrée des millions de fois par seconde, voit une rafale de 0 et de 1. Sans précaution, un appui compte pour plusieurs.</p>
~~~text
niveau réel   ‾‾‾‾‾‾|_|‾|_|‾|________________|‾|_|‾‾‾‾‾‾
              repos   rebonds   appui stable   rebonds  relâché
~~~
<p>Le remède logiciel le plus robuste : lire l'entrée à intervalle régulier (toutes les 5 ms, depuis un timer) et ne valider un changement que lorsque la nouvelle valeur a été lue <strong>plusieurs fois de suite</strong>. Côté matériel, la broche a besoin d'un état de repos défini : une résistance de tirage (pull-up interne, activée par le registre @@PUPDR@@) ; le bouton relie alors la broche à la masse, et un appui se lit 0.</p>
~~~c
#include <stdio.h>
#include <stdint.h>

int main(void) {
    /* lectures brutes toutes les 5 ms : des rebonds puis un appui stable */
    int lectures[] = {1, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0};
    int stable = 1, compte = 0;
    for (int i = 0; i < 13; i++) {
        compte = (lectures[i] == stable) ? 0 : compte + 1;
        if (compte == 4) {               /* 4 lectures identiques : 20 ms */
            stable = lectures[i];
            compte = 0;
            printf("changement validé à t = %d ms : %d\\n", i * 5, stable);
        }
    }
    return 0;
}
~~~
<p>Cette petite machine à états ne bloque jamais (pas de @@delay@@) : elle peut gérer dix boutons en même temps, appelée depuis la boucle principale ou une interruption de timer.</p>`,
    setup: LAB,
    quiz: [
      { q: "Un bouton est câblé entre la broche et la masse, avec un pull-up. Que lit-on quand il est appuyé ?", options: ["1", "0", "Une valeur aléatoire", "3,3"], answer: 1, explain: "Le bouton tire la broche à la masse ; au repos, le pull-up la tient à 1." },
      { q: "Pourquoi éviter delay(20) pour l'anti-rebond ?", options: ["delay n'existe pas", "Il bloque tout le programme pendant l'attente", "Il consomme de la mémoire", "Il est trop précis"], answer: 1, explain: "Une machine à états appelée périodiquement fait le même travail sans bloquer." }
    ],
    challenge: {
      prompt: `<p>Un bouton est représenté par @@typedef struct { int stable; int compte; } Bouton;@@ (fourni). Écris @@void bouton_init(Bouton *b, int niveau)@@ et @@int bouton_maj(Bouton *b, int lecture)@@, appelée toutes les 5 ms avec la lecture brute : elle valide un changement quand @@SEUIL@@ (4) lectures <strong>consécutives</strong> diffèrent de l'état stable, et renvoie 1 au moment où un <strong>appui</strong> est validé (passage de l'état stable à 0, câblage avec pull-up), 0 sinon. Une lecture égale à l'état stable remet le compte à zéro.</p>`,
      starter: C`#define SEUIL 4

typedef struct {
    int stable;
    int compte;
} Bouton;

void bouton_init(Bouton *b, int niveau) {
    b->stable = niveau;
}

int bouton_maj(Bouton *b, int lecture) {
    return lecture == 0;
}
`,
      solution: C`#define SEUIL 4

typedef struct {
    int stable;
    int compte;
} Bouton;

void bouton_init(Bouton *b, int niveau) {
    b->stable = niveau;
    b->compte = 0;
}

int bouton_maj(Bouton *b, int lecture) {
    if (lecture == b->stable) {
        b->compte = 0;
        return 0;
    }
    b->compte++;
    if (b->compte < SEUIL) return 0;
    b->stable = lecture;
    b->compte = 0;
    return b->stable == 0;
}
`,
      tests: C`#include <stdio.h>

int main(void) {
    int signal[] = {1, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1};
    int n = sizeof signal / sizeof signal[0];
    Bouton b;
    bouton_init(&b, 1);
    int appuis = 0;
    for (int i = 0; i < n; i++) {
        if (bouton_maj(&b, signal[i])) {
            appuis++;
            printf("appui validé à t = %d ms\n", i * 5);
        }
    }
    printf("%d appui(s), état final %d\n", appuis, b.stable);
    return 0;
}
`,
      expected: "appui validé à t = 45 ms\nappui validé à t = 115 ms\n2 appui(s), état final 0\n",
      hint: "Si la lecture égale b->stable, remets b->compte à 0. Sinon incrémente ; à SEUIL, adopte la nouvelle valeur, remets le compte à 0 et renvoie 1 si c'est un passage à 0."
    }
  },
  {
    id: "em-07", section: "Périphériques", title: "Timers et interruptions", xp: 130,
    theory: `<p>Un <strong>timer</strong> est un compteur matériel cadencé par l'horloge. Un <em>prédiviseur</em> (PSC) le ralentit, et quand il atteint la valeur de <em>rechargement</em> (ARR), il revient à 0 et lève un drapeau de débordement. La fréquence des débordements vaut :</p>
~~~text
f = f_cpu / ((PSC + 1) × (ARR + 1))        à 16 MHz, PSC = 15 999 et ARR = 999 → 1 Hz
~~~
<p>Plutôt que de surveiller ce drapeau en boucle (<em>polling</em>), on active l'<strong>interruption</strong> : à chaque débordement, le processeur suspend le programme, exécute la routine d'interruption (ISR, ici @@TIM2_IRQHandler@@), puis reprend où il en était. Les règles d'or d'une ISR :</p>
<ul><li>courte : on note l'événement (un compteur, un drapeau), le traitement se fait dans la boucle principale ;</li><li>effacer la cause de l'interruption (le drapeau @@UIF@@), sinon elle se redéclenche aussitôt ;</li><li>toute variable partagée avec le programme principal est @@volatile@@, et une variable de plus de 32 bits (ou un ensemble de variables) se lit en masquant les interruptions, sinon la lecture peut être coupée en deux ;</li><li>jamais de @@printf@@, d'allocation ni d'attente active dans une ISR.</li></ul>
~~~c
#include <stdio.h>
#include "mcu.h"

volatile uint32_t secondes = 0;

void TIM2_IRQHandler(void) {
    TIM2->SR &= ~TIM_SR_UIF;   /* acquitter */
    secondes++;
}

int main(void) {
    TIM2->PSC = 15999;         /* 16 MHz / 16 000 = 1 kHz */
    TIM2->ARR = 999;           /* 1 000 pas : un débordement par seconde */
    TIM2->DIER |= TIM_DIER_UIE;
    TIM2->CR1 |= TIM_CR1_CEN;
    sim_isr_tim2 = TIM2_IRQHandler;      /* le « vecteur d'interruption » du simulateur */
    sim_timer(TIM2, 5 * F_CPU);          /* le matériel tourne 5 secondes */
    printf("secondes = %u\\n", secondes);
    return 0;
}
~~~`,
    setup: LAB,
    quiz: [
      { q: "À 16 MHz, quel couple PSC, ARR donne une interruption toutes les 10 ms ?", options: ["PSC = 15, ARR = 9 999", "PSC = 159, ARR = 999", "PSC = 1 599, ARR = 99", "Les trois conviennent"], answer: 3, explain: "16 MHz / (16 × 10 000) = 16 MHz / (160 × 1 000) = 16 MHz / (1 600 × 100) = 100 Hz." },
      { q: "Pourquoi la variable modifiée par une ISR doit-elle être volatile ?", options: ["Pour l'initialiser à zéro", "Le compilateur doit relire la mémoire : sans volatile, la boucle principale peut travailler sur une copie en registre et ne jamais voir le changement", "Pour la rendre atomique", "Par convention"], answer: 1, explain: "volatile ne rend pas l'accès atomique, il empêche seulement ces optimisations." }
    ],
    challenge: {
      prompt: `<p>Écris @@int timer_regler(uint32_t f_cpu, uint32_t f_voulue, uint32_t *psc, uint32_t *arr)@@ : cherche le plus petit @@PSC@@ (de 0 à 65 535) tel que @@f_cpu@@ soit divisible par @@(PSC + 1) × f_voulue@@ et que @@ARR + 1@@ tienne sur 16 bits (au plus 65 536) ; écrit @@PSC@@ et @@ARR@@ et renvoie 0, ou renvoie -1 si c'est impossible.</p><p>Puis l'ISR @@void TIM2_IRQHandler(void)@@ : elle acquitte @@UIF@@ et incrémente @@ticks@@ (déclarée dans le code de départ).</p>`,
      starter: C`#include "mcu.h"

volatile uint32_t ticks = 0;

int timer_regler(uint32_t f_cpu, uint32_t f_voulue, uint32_t *psc, uint32_t *arr) {
    *psc = 0;
    *arr = f_cpu / f_voulue;
    return 0;
}

void TIM2_IRQHandler(void) {
    ticks++;
}
`,
      solution: C`#include "mcu.h"

volatile uint32_t ticks = 0;

int timer_regler(uint32_t f_cpu, uint32_t f_voulue, uint32_t *psc, uint32_t *arr) {
    for (uint32_t p = 0; p <= 65535u; p++) {
        uint32_t diviseur = (p + 1u) * f_voulue;
        if (f_cpu % diviseur != 0u) continue;
        uint32_t pas = f_cpu / diviseur;
        if (pas <= 65536u) {
            *psc = p;
            *arr = pas - 1u;
            return 0;
        }
    }
    return -1;
}

void TIM2_IRQHandler(void) {
    TIM2->SR &= ~TIM_SR_UIF;
    ticks++;
}
`,
      tests: C`#include <stdio.h>

int main(void) {
    uint32_t psc, arr;
    uint32_t frequences[] = {1000u, 1u, 50u, 44100u, 7u};
    for (int i = 0; i < 5; i++) {
        int r = timer_regler(F_CPU, frequences[i], &psc, &arr);
        if (r == 0) printf("%u Hz : PSC = %u, ARR = %u\n", frequences[i], psc, arr);
        else printf("%u Hz : impossible\n", frequences[i]);
    }
    timer_regler(F_CPU, 1000u, &psc, &arr);
    TIM2->PSC = psc;
    TIM2->ARR = arr;
    TIM2->DIER |= TIM_DIER_UIE;
    TIM2->CR1 |= TIM_CR1_CEN;
    sim_isr_tim2 = TIM2_IRQHandler;
    sim_timer(TIM2, F_CPU / 4u);
    printf("ticks = %u, UIF = %u\n", ticks, TIM2->SR & TIM_SR_UIF);
    return 0;
}
`,
      expected: "1000 Hz : PSC = 0, ARR = 15999\n1 Hz : PSC = 249, ARR = 63999\n50 Hz : PSC = 4, ARR = 63999\n44100 Hz : impossible\n7 Hz : impossible\nticks = 250, UIF = 0\n",
      hint: "Boucle sur p de 0 à 65 535 : diviseur = (p + 1) × f_voulue ; s'il divise f_cpu et que pas = f_cpu / diviseur ≤ 65 536, écris *psc = p et *arr = pas − 1. Dans l'ISR, efface le bit avec TIM2->SR &= ~TIM_SR_UIF."
    }
  },
  {
    id: "em-08", section: "Périphériques", title: "PWM : moteurs, LED et servomoteurs", xp: 110,
    theory: `<p>Un microcontrôleur ne sort que 0 ou 3,3 V. Pour faire varier la luminosité d'une LED ou la vitesse d'un moteur, on alterne très vite les deux : c'est la <strong>modulation de largeur d'impulsion</strong> (PWM). La puissance moyenne est proportionnelle au <em>rapport cyclique</em>, la fraction du temps passée à 1.</p>
~~~text
25 %   ‾|___‾|___‾|___        période = (PSC + 1) × (ARR + 1) / f_cpu
75 %   ‾‾‾|_‾‾‾|_‾‾‾|_        rapport cyclique = CCR / (ARR + 1)
~~~
<p>Le timer compte de 0 à ARR ; en mode PWM, la sortie vaut 1 tant que le compteur est inférieur au registre de comparaison @@CCR@@. Pour un servomoteur de modélisme, la règle est différente : une impulsion toutes les 20 ms (50 Hz) dont la <em>largeur</em> fixe l'angle, de 1 ms (0°) à 2 ms (180°) environ. Avec un pas de 1 µs (PSC = 15 à 16 MHz) et ARR = 19 999, @@CCR@@ s'écrit directement en microsecondes.</p>
~~~c
#include <stdio.h>
#include "mcu.h"

int main(void) {
    TIM2->PSC = 15;        /* 1 MHz : un pas par microseconde */
    TIM2->ARR = 19999;     /* 20 000 µs : 50 Hz */
    TIM2->CCR1 = 1500;     /* impulsion de 1,5 ms : servo au centre */
    printf("période %u µs, impulsion %u µs, rapport %.1f %%\\n",
           TIM2->ARR + 1, TIM2->CCR1, 100.0 * TIM2->CCR1 / (TIM2->ARR + 1));
    return 0;
}
~~~
<p>Fréquence de PWM : quelques centaines de Hz suffisent pour une LED (au-delà de 100 Hz, l'œil ne voit plus le scintillement), 20 kHz ou plus pour un moteur (au-delà, le sifflement devient inaudible).</p>`,
    setup: LAB,
    quiz: [
      { q: "ARR = 999. Quel CCR pour un rapport cyclique de 30 % ?", options: ["30", "300", "299", "333"], answer: 1, explain: "CCR / (ARR + 1) = 300 / 1 000." },
      { q: "Pourquoi une PWM de moteur à 20 kHz plutôt qu'à 1 kHz ?", options: ["Pour plus de couple", "Au-delà de 20 kHz, le bobinage ne siffle plus de façon audible", "Pour consommer moins", "1 kHz ne marche pas"], answer: 1, explain: "Le moteur vibre à la fréquence de la PWM." }
    ],
    challenge: {
      prompt: `<p>Écris @@uint32_t pwm_ccr(uint32_t arr, uint32_t pour_mille)@@ : la valeur de CCR pour un rapport cyclique donné en pour mille (0 à 1000, au-delà on sature à 1000), calcul entier arrondi vers le bas, et @@uint32_t servo_ccr(int angle)@@ pour un servo avec un pas de 1 µs : 1000 µs à 0°, 2000 µs à 180°, linéaire entre les deux (division entière), l'angle étant d'abord ramené dans @@[0, 180]@@.</p>`,
      starter: C`#include "mcu.h"

uint32_t pwm_ccr(uint32_t arr, uint32_t pour_mille) {
    return arr * pour_mille / 1000u;
}

uint32_t servo_ccr(int angle) {
    return 1000u + (uint32_t)angle;
}
`,
      solution: C`#include "mcu.h"

uint32_t pwm_ccr(uint32_t arr, uint32_t pour_mille) {
    if (pour_mille > 1000u) pour_mille = 1000u;
    return (arr + 1u) * pour_mille / 1000u;
}

uint32_t servo_ccr(int angle) {
    if (angle < 0) angle = 0;
    if (angle > 180) angle = 180;
    return 1000u + (uint32_t)angle * 1000u / 180u;
}
`,
      tests: C`#include <stdio.h>

int main(void) {
    printf("%u %u %u %u %u\n", pwm_ccr(999u, 0u), pwm_ccr(999u, 250u), pwm_ccr(999u, 1000u), pwm_ccr(799u, 333u), pwm_ccr(999u, 1500u));
    printf("%u %u %u %u %u\n", servo_ccr(0), servo_ccr(90), servo_ccr(180), servo_ccr(45), servo_ccr(-30));
    TIM2->PSC = 15;
    TIM2->ARR = 19999;
    TIM2->CCR1 = servo_ccr(270);
    printf("CCR1 = %u\n", TIM2->CCR1);
    return 0;
}
`,
      expected: "0 250 1000 266 1000\n1000 1500 2000 1250 1000\nCCR1 = 2000\n",
      hint: "CCR = (arr + 1) × pour_mille / 1000 après saturation. Servo : borne l'angle, puis 1000 + angle × 1000 / 180."
    }
  },
  {
    id: "em-09", section: "Périphériques", title: "Le convertisseur analogique-numérique", xp: 110,
    theory: `<p>L'<strong>ADC</strong> transforme une tension en nombre : sur 12 bits, de 0 (0 V) à 4095 (presque Vref, souvent 3,3 V). Une conversion prend quelques microsecondes : on la <em>lance</em> (bit @@START@@), puis on attend la fin (drapeau @@EOC@@, end of conversion), et on lit le résultat dans @@DR@@. Lire @@DR@@ efface @@EOC@@ sur la plupart des puces ; ici on l'efface explicitement.</p>
<p>Plutôt qu'une boucle d'attente bloquante, on découpe en trois fonctions non bloquantes : lancer, tester si c'est prêt, lire. La boucle principale (ou une interruption de fin de conversion) fait le reste. Pour convertir en millivolts sans flottant, coûteux sur un petit processeur : on multiplie d'abord, on divise ensuite, en 32 bits.</p>
~~~c
#include <stdio.h>
#include <stdint.h>

int main(void) {
    uint16_t brut = 931;                      /* lu sur un ADC 12 bits, Vref = 3300 mV */
    uint32_t mv = (uint32_t)brut * 3300u / 4096u;
    printf("%u mV\\n", mv);                   /* multiplier d'abord : 931 / 4096 vaudrait 0 en entier */
    /* capteur TMP36 : 10 mV par °C et 500 mV à 0 °C, donc 1 mV = 0,1 °C */
    int32_t dixiemes = (int32_t)mv - 500;
    printf("%d,%d °C\\n", dixiemes / 10, dixiemes % 10);
    return 0;
}
~~~
<p>Les mesures sont bruitées : on <strong>moyenne</strong> plusieurs échantillons (moyenne glissante, ou filtre exponentiel @@y += (x − y) / 8@@ qui ne demande ni tableau ni division coûteuse avec une puissance de 2).</p>`,
    setup: LAB,
    quiz: [
      { q: "Pourquoi calculer brut × 3300 / 4096 et pas brut / 4096 × 3300 en entier ?", options: ["C'est pareil", "La division entière d'abord donne 0 pour tout brut < 4096 : on perd toute la précision", "Pour éviter un dépassement", "Par habitude"], answer: 1, explain: "Multiplier d'abord, en s'assurant que le produit tient sur 32 bits." },
      { q: "Quel est l'avantage d'un ADC non bloquant (lancer, tester, lire) ?", options: ["Plus de précision", "Le programme fait autre chose pendant la conversion", "Moins de bruit", "Il consomme moins de broches"], answer: 1, explain: "Même logique que l'anti-rebond : ne jamais attendre sans rien faire." }
    ],
    challenge: {
      prompt: `<p>Avec @@ADC1@@ de @@mcu.h@@, écris @@void adc_lancer(void)@@ (allume l'ADC avec @@ADON@@ et lance une conversion avec @@START@@), @@int adc_pret(void)@@ (1 si @@EOC@@ est levé), @@uint16_t adc_lire(void)@@ (renvoie @@DR@@ et efface @@EOC@@), et @@uint32_t adc_mv(uint16_t brut, uint32_t vref_mv)@@ (calcul entier, arrondi vers le bas).</p>`,
      starter: C`#include "mcu.h"

void adc_lancer(void) {
    ADC1->CR = ADC_CR_START;
}

int adc_pret(void) {
    return 1;
}

uint16_t adc_lire(void) {
    return (uint16_t)ADC1->DR;
}

uint32_t adc_mv(uint16_t brut, uint32_t vref_mv) {
    return brut / 4096u * vref_mv;
}
`,
      solution: C`#include "mcu.h"

void adc_lancer(void) {
    ADC1->CR |= ADC_CR_ADON | ADC_CR_START;
}

int adc_pret(void) {
    return (ADC1->SR & ADC_SR_EOC) != 0u;
}

uint16_t adc_lire(void) {
    uint16_t v = (uint16_t)ADC1->DR;
    ADC1->SR &= ~ADC_SR_EOC;
    return v;
}

uint32_t adc_mv(uint16_t brut, uint32_t vref_mv) {
    return (uint32_t)brut * vref_mv / 4096u;
}
`,
      tests: C`#include <stdio.h>

int main(void) {
    printf("prêt avant : %d\n", adc_pret());
    adc_lancer();
    printf("CR = 0x%X, prêt : %d\n", ADC1->CR, adc_pret());
    sim_adc(ADC1, 2482);
    printf("prêt : %d\n", adc_pret());
    uint16_t v = adc_lire();
    printf("brut %u, %u mV, prêt après lecture : %d\n", v, adc_mv(v, 3300u), adc_pret());
    printf("%u %u %u\n", adc_mv(4095u, 3300u), adc_mv(0u, 3300u), adc_mv(1024u, 5000u));
    return 0;
}
`,
      expected: "prêt avant : 0\nCR = 0x3, prêt : 0\nprêt : 1\nbrut 2482, 1999 mV, prêt après lecture : 0\n3299 0 1250\n",
      hint: "Lancer : ADC1->CR |= ADC_CR_ADON | ADC_CR_START. Prêt : (ADC1->SR & ADC_SR_EOC) != 0. Lire : garde DR, puis ADC1->SR &= ~ADC_SR_EOC. Millivolts : (uint32_t)brut × vref_mv / 4096."
    }
  },
  {
    id: "em-10", section: "Périphériques", title: "Liaison série et tampon circulaire", xp: 130,
    theory: `<p>L'<strong>UART</strong> transmet les octets un bit à la fois sur un fil, sans horloge commune : les deux côtés s'accordent sur un débit (115 200 bauds le plus souvent). Chaque octet est encadré d'un bit de start (0) et d'un bit de stop (1), données poids faible en premier : 10 bits par octet, soit 11 520 octets par seconde à 115 200 bauds. Le registre de débit vaut @@BRR = f_cpu / débit@@.</p>
<p>Les octets reçus arrivent n'importe quand, par une interruption (@@RXNE@@). L'ISR les range dans un <strong>tampon circulaire</strong> (ring buffer) que la boucle principale vide à son rythme : une file de taille fixe, sans allocation, où l'indice d'écriture (tête) et celui de lecture (queue) tournent modulo la taille.</p>
~~~text
 indices  0   1   2   3   4   5   6   7
         [ ] [ ] [A] [B] [C] [ ] [ ] [ ]      queue = 2 (prochaine lecture)
                  ^queue      ^tête            tête  = 5 (prochaine écriture), 3 octets en attente
~~~
<p>Avec un seul producteur (l'ISR) et un seul consommateur (la boucle principale), chacun ne modifiant que son propre indice, ce tampon fonctionne sans verrou. Quand il est plein, on choisit de rejeter le nouvel octet (et de compter la perte) : c'est le signe qu'il faut un tampon plus grand ou une lecture plus fréquente.</p>
~~~c
#include <stdio.h>
#include "mcu.h"

int main(void) {
    uint32_t debit = 115200u;
    USART1->BRR = F_CPU / debit;
    USART1->CR1 = USART_CR1_UE | USART_CR1_TE | USART_CR1_RE;
    printf("BRR = %u, débit réel = %u bauds\\n", USART1->BRR, F_CPU / USART1->BRR);
    printf("%u octets par seconde\\n", debit / 10u);
    return 0;
}
~~~`,
    setup: LAB,
    quiz: [
      { q: "À 9 600 bauds (8 bits, sans parité, 1 stop), combien d'octets par seconde au maximum ?", options: ["9 600", "1 200", "960", "800"], answer: 2, explain: "10 bits par octet (start + 8 + stop)." },
      { q: "Pourquoi un tampon circulaire entre l'ISR de réception et la boucle principale ?", options: ["Pour chiffrer", "L'ISR doit ranger l'octet immédiatement, la boucle le traite plus tard à son rythme, sans allocation", "Pour trier les octets", "Parce que l'UART l'impose"], answer: 1, explain: "C'est la structure de données la plus utilisée en embarqué." }
    ],
    challenge: {
      prompt: `<p>Le type est fourni : @@typedef struct { uint8_t donnees[TAILLE]; uint8_t tete, queue, nb; } Tampon;@@ avec @@TAILLE@@ = 8. Écris @@int tampon_ecrire(Tampon *t, uint8_t octet)@@ (0 si rangé, -1 si plein) et @@int tampon_lire(Tampon *t, uint8_t *octet)@@ (0 et l'octet le plus ancien, ou -1 si vide). Les indices reviennent à 0 après @@TAILLE − 1@@.</p>`,
      starter: C`#include <stdint.h>

#define TAILLE 8

typedef struct {
    uint8_t donnees[TAILLE];
    uint8_t tete, queue, nb;
} Tampon;

int tampon_ecrire(Tampon *t, uint8_t octet) {
    t->donnees[t->tete] = octet;
    t->tete++;
    return 0;
}

int tampon_lire(Tampon *t, uint8_t *octet) {
    *octet = t->donnees[t->queue];
    return 0;
}
`,
      solution: C`#include <stdint.h>

#define TAILLE 8

typedef struct {
    uint8_t donnees[TAILLE];
    uint8_t tete, queue, nb;
} Tampon;

int tampon_ecrire(Tampon *t, uint8_t octet) {
    if (t->nb == TAILLE) return -1;
    t->donnees[t->tete] = octet;
    t->tete = (uint8_t)((t->tete + 1) % TAILLE);
    t->nb++;
    return 0;
}

int tampon_lire(Tampon *t, uint8_t *octet) {
    if (t->nb == 0) return -1;
    *octet = t->donnees[t->queue];
    t->queue = (uint8_t)((t->queue + 1) % TAILLE);
    t->nb--;
    return 0;
}
`,
      tests: C`#include <stdio.h>

int main(void) {
    Tampon t = {{0}, 0, 0, 0};
    const char *recu = "BONJOUR!!";
    int perdus = 0;
    for (const char *p = recu; *p; p++) {
        if (tampon_ecrire(&t, (uint8_t)*p) != 0) perdus++;
    }
    printf("en attente %u, perdus %d\n", t.nb, perdus);
    uint8_t c;
    for (int i = 0; i < 3; i++) {
        tampon_lire(&t, &c);
        putchar(c);
    }
    putchar('\n');
    tampon_ecrire(&t, 'X');
    tampon_ecrire(&t, 'Y');
    while (tampon_lire(&t, &c) == 0) putchar(c);
    printf("\ntête %u, queue %u, vide : %d\n", t.tete, t.queue, tampon_lire(&t, &c));
    return 0;
}
`,
      expected: "en attente 8, perdus 1\nBON\nJOUR!XY\ntête 2, queue 2, vide : -1\n",
      hint: "Garde nb à jour : écrire refuse si nb == TAILLE, lire refuse si nb == 0. Après chaque accès, l'indice avance avec (indice + 1) % TAILLE."
    }
  },
  {
    id: "em-11", section: "Périphériques", title: "I2C et SPI : parler aux capteurs", xp: 110,
    theory: `<p>Deux bus relient le microcontrôleur à ses capteurs, écrans et mémoires :</p>
~~~text
            fils                       vitesse        adressage                     usage
I2C         SDA, SCL (+ pull-up)       100 k–1 MHz    7 bits, jusqu'à ~100 puces     capteurs, petits écrans
SPI         SCK, MOSI, MISO, CS/puce   1–50 MHz       une ligne CS par puce           écrans, mémoires flash, ADC rapides
~~~
<p>En <strong>I2C</strong>, le maître envoie une condition de start, puis l'<strong>octet d'adresse</strong> : l'adresse 7 bits de la puce décalée d'un cran, avec en bit 0 le sens (0 écriture, 1 lecture). La puce répond par un acquittement (ACK). Pour lire un registre : on écrit son numéro, puis on relit (start répété). Les lignes sont à drain ouvert : il faut des résistances de tirage (4,7 kΩ typiquement).</p>
<p>Exemple : le capteur de température <strong>TMP102</strong> (adresse 0x48) renvoie deux octets. Les 12 bits de poids fort forment la température en complément à deux, à 0,0625 °C par pas. 0x19 puis 0x00 donnent 0x190 = 400 pas, soit 25,0 °C :</p>
~~~c
#include <stdio.h>
#include <stdint.h>

int main(void) {
    uint8_t adresse = 0x48;
    printf("octet d'adresse en lecture : 0x%02X, en écriture : 0x%02X\\n", (adresse << 1) | 1, adresse << 1);
    uint8_t msb = 0x19, lsb = 0x00;
    int16_t brut = (int16_t)(((uint16_t)msb << 8) | lsb) >> 4;   /* 12 bits, signe conservé */
    printf("%d pas = %d centièmes de degré\\n", brut, brut * 625 / 100);
    return 0;
}
~~~
<p>En <strong>SPI</strong>, plus simple et plus rapide, chaque front d'horloge échange un bit dans chaque sens à la fois ; la puce est choisie en mettant sa ligne CS à 0. Les deux pièges classiques : le <em>mode</em> SPI (polarité et phase de l'horloge, à lire dans la datasheet) et l'ordre des octets dans les valeurs sur 16 bits.</p>`,
    setup: LAB,
    quiz: [
      { q: "Une puce I2C a l'adresse 0x3C. Quel octet envoyer pour lui écrire ?", options: ["0x3C", "0x78", "0x79", "0x1E"], answer: 1, explain: "0x3C << 1 = 0x78, bit 0 à 0 pour l'écriture (0x79 en lecture)." },
      { q: "Un bus I2C ne marche pas du tout, l'oscilloscope montre SDA et SCL toujours à 0. Cause probable ?", options: ["Mauvaise adresse", "Résistances de tirage absentes : les sorties à drain ouvert ne peuvent pas remonter les lignes", "Débit trop élevé", "Mode SPI incorrect"], answer: 1, explain: "Sans pull-up, rien ne ramène les lignes à 1." }
    ],
    challenge: {
      prompt: `<p>Écris @@uint8_t i2c_octet_adresse(uint8_t adresse7, int lecture)@@ et @@int32_t tmp102_centi(uint8_t msb, uint8_t lsb)@@ : la température en centièmes de degré (12 bits de poids fort en complément à deux, 6,25 centièmes par pas, division entière tronquée vers zéro comme en C). Exemple : 0xE7, 0x00 → -2500 (-25 °C).</p>`,
      starter: C`#include <stdint.h>

uint8_t i2c_octet_adresse(uint8_t adresse7, int lecture) {
    return adresse7;
}

int32_t tmp102_centi(uint8_t msb, uint8_t lsb) {
    return (msb * 256 + lsb) * 625 / 100;
}
`,
      solution: C`#include <stdint.h>

uint8_t i2c_octet_adresse(uint8_t adresse7, int lecture) {
    return (uint8_t)((adresse7 << 1) | (lecture ? 1u : 0u));
}

int32_t tmp102_centi(uint8_t msb, uint8_t lsb) {
    int32_t brut = (int32_t)(((uint32_t)msb << 4) | ((uint32_t)lsb >> 4));
    if (brut & 0x800) brut -= 0x1000;
    return brut * 625 / 100;
}
`,
      tests: C`#include <stdio.h>

int main(void) {
    printf("0x%02X 0x%02X 0x%02X\n", i2c_octet_adresse(0x48, 1), i2c_octet_adresse(0x48, 0), i2c_octet_adresse(0x3C, 0));
    uint8_t mesures[][2] = {{0x19, 0x00}, {0x7F, 0xF0}, {0x00, 0x10}, {0xFF, 0xF0}, {0xE7, 0x00}, {0x80, 0x00}};
    for (int i = 0; i < 6; i++) {
        printf("%d ", tmp102_centi(mesures[i][0], mesures[i][1]));
    }
    printf("\n");
    return 0;
}
`,
      expected: "0x91 0x90 0x78\n2500 12793 6 -6 -2500 -12800 \n",
      hint: "Les 12 bits : (msb << 4) | (lsb >> 4). Si le bit 11 vaut 1, retire 4096 pour obtenir la valeur négative. Puis × 625 / 100."
    }
  },
  {
    id: "em-12", section: "Périphériques", title: "Ordonnancement, énergie et FreeRTOS", xp: 120,
    theory: `<p>Un programme embarqué ne se termine jamais : c'est une <strong>super-boucle</strong> qui appelle chaque tâche à son rythme, à partir d'une horloge en millisecondes tenue par un timer. Chaque tâche mémorise sa prochaine échéance ; aucune ne bloque.</p>
~~~c norun
int main(void) {
    initialiser();
    for (;;) {
        uint32_t maintenant = millis();
        if ((int32_t)(maintenant - prochain_capteur) >= 0) { lire_capteur(); prochain_capteur += 100; }
        if (bouton_maj(&b, lire_broche())) basculer_led();
        __WFI();                              /* dormir jusqu'à la prochaine interruption */
    }
}
~~~
<p>Comparer des instants avec @@(int32_t)(maintenant - echeance) >= 0@@ plutôt qu'avec @@maintenant >= echeance@@ reste juste quand le compteur de millisecondes fait le tour (au bout de 49,7 jours sur 32 bits).</p>
<p><strong>Énergie</strong> : un microcontrôleur actif consomme quelques milliampères, en veille profonde quelques microampères. La règle : dormir dès qu'il n'y a rien à faire (@@__WFI@@, « wait for interrupt »), couper les périphériques inutiles, réveiller par une interruption (timer, bouton, réception). Le <strong>watchdog</strong> est un timer qui redémarre la puce si le programme ne le « nourrit » pas régulièrement : la protection contre un blocage en production.</p>
<p>Quand les tâches se multiplient, on passe à un <strong>RTOS</strong> comme FreeRTOS : chaque tâche a sa pile et sa priorité, l'ordonnanceur préemptif choisit la tâche prête la plus prioritaire, et les tâches communiquent par files de messages, sémaphores et mutex, jamais par des variables partagées sans protection.</p>
~~~c norun
void tache_capteur(void *param) {
    for (;;) {
        int16_t t = lire_temperature();
        xQueueSend(file_mesures, &t, 0);          /* envoyer sans attendre */
        vTaskDelay(pdMS_TO_TICKS(1000));           /* rend la main pendant 1 s */
    }
}
xTaskCreate(tache_capteur, "capteur", 256, NULL, 2, NULL);
vTaskStartScheduler();
~~~
<p>Piège célèbre : l'<em>inversion de priorité</em>. Une tâche basse priorité tient un mutex, une tâche haute priorité l'attend, et une tâche moyenne empêche la basse de s'exécuter : la haute reste bloquée. C'est ce qui a fait redémarrer en boucle le robot Mars Pathfinder en 1997 ; les mutex de FreeRTOS appliquent l'héritage de priorité pour l'éviter.</p>`,
    setup: LAB,
    quiz: [
      { q: "Pourquoi écrire (int32_t)(maintenant - echeance) >= 0 plutôt que maintenant >= echeance ?", options: ["C'est plus rapide", "La soustraction modulaire reste correcte quand le compteur de millisecondes fait le tour", "Pour éviter les nombres négatifs", "Par convention"], answer: 1, explain: "Juste après le tour, maintenant est petit et echeance grand : la comparaison directe se trompe." },
      { q: "Qu'est-ce que l'inversion de priorité ?", options: ["Une tâche de haute priorité bloquée indirectement par une tâche de priorité moyenne, parce qu'une tâche basse tient le mutex qu'elle attend", "Un bogue de compilation", "Le fait d'inverser deux priorités par erreur", "Une interruption désactivée"], answer: 0, explain: "L'héritage de priorité donne temporairement à la tâche basse la priorité de celle qui attend." }
    ],
    challenge: {
      prompt: `<p>Écris l'ordonnanceur coopératif : @@typedef struct { const char *nom; uint32_t periode; uint32_t prochain; } Tache;@@ (fourni). @@int ordonnancer(Tache *t, int n, uint32_t maintenant)@@ parcourt les tâches dans l'ordre ; chaque tâche échue (@@(int32_t)(maintenant - prochain) >= 0@@) est « exécutée » en appelant @@executer(t[i].nom, maintenant)@@ (fournie par les tests), puis sa prochaine échéance avance d'une période. La fonction renvoie le nombre de tâches exécutées.</p>`,
      starter: C`#include <stdint.h>

typedef struct {
    const char *nom;
    uint32_t periode;
    uint32_t prochain;
} Tache;

void executer(const char *nom, uint32_t maintenant);

int ordonnancer(Tache *t, int n, uint32_t maintenant) {
    for (int i = 0; i < n; i++) {
        if (maintenant >= t[i].prochain) executer(t[i].nom, maintenant);
    }
    return 0;
}
`,
      solution: C`#include <stdint.h>

typedef struct {
    const char *nom;
    uint32_t periode;
    uint32_t prochain;
} Tache;

void executer(const char *nom, uint32_t maintenant);

int ordonnancer(Tache *t, int n, uint32_t maintenant) {
    int executees = 0;
    for (int i = 0; i < n; i++) {
        if ((int32_t)(maintenant - t[i].prochain) >= 0) {
            executer(t[i].nom, maintenant);
            t[i].prochain += t[i].periode;
            executees++;
        }
    }
    return executees;
}
`,
      tests: C`#include <stdio.h>

void executer(const char *nom, uint32_t maintenant) {
    printf("  %u ms : %s\n", maintenant, nom);
}

int main(void) {
    Tache taches[] = {{"led", 250, 0}, {"capteur", 400, 100}, {"radio", 1000, 900}};
    int total = 0;
    for (uint32_t ms = 0; ms <= 1000; ms += 50) total += ordonnancer(taches, 3, ms);
    printf("%d exécutions\n", total);
    Tache tour[] = {{"apres-tour", 100, 4294967290u}};
    int avant = ordonnancer(tour, 1, 4294967200u);
    int apres = ordonnancer(tour, 1, 4u);
    printf("%d %d\n", avant, apres);
    printf("prochaine échéance : %u\n", tour[0].prochain);
    return 0;
}
`,
      expected: "  0 ms : led\n  100 ms : capteur\n  250 ms : led\n  500 ms : led\n  500 ms : capteur\n  750 ms : led\n  900 ms : capteur\n  900 ms : radio\n  1000 ms : led\n9 exécutions\n  4 ms : apres-tour\n0 1\nprochaine échéance : 94\n",
      hint: "Pour chaque tâche : si (int32_t)(maintenant − t[i].prochain) >= 0, appelle executer, ajoute t[i].periode à t[i].prochain et compte l'exécution."
    }
  },
  {
    id: "em-13", section: "Entretien", title: "Questions d'entretien : C embarqué", xp: 60, theoryOnly: true,
    theory: `<p>Les entretiens embarqués (firmware, IoT, automobile) reviennent toujours sur les mêmes notions. Réponds précisément, avec un exemple de code si possible.</p>
<div class="qa">
<details><summary>Que fait volatile, et quand l'utiliser ?</summary><p>Il oblige le compilateur à relire ou réécrire la mémoire à chaque accès, sans optimisation. Pour les registres de périphériques, les variables partagées avec une ISR, et celles modifiées par un autre cœur ou par DMA. Il ne rend pas les accès atomiques.</p></details>
<details><summary>Quelles règles pour écrire une routine d'interruption ?</summary><p>Courte, sans blocage, sans printf ni malloc ; acquitter la source ; partager des données par des variables volatile ou un tampon circulaire ; protéger les accès non atomiques (sections critiques) côté programme principal.</p></details>
<details><summary>Que signifient static et const devant une variable ?</summary><p>static sur une variable locale : elle garde sa valeur entre les appels ; sur une globale ou une fonction : visible seulement dans son fichier. const : en lecture seule, ce qui permet au compilateur de la placer en mémoire flash plutôt qu'en RAM.</p></details>
<details><summary>Comment mettre à 1 le bit 7 d'un registre, puis tester le bit 3 ?</summary><p>reg |= (1u << 7); puis if (reg & (1u << 3)). Et pour effacer : reg &= ~(1u << 7). Le u évite le comportement indéfini d'un décalage dans le bit de signe.</p></details>
<details><summary>Petit-boutiste ou gros-boutiste ? Comment le savoir ?</summary><p>L'ordre des octets d'un entier en mémoire : ARM et x86 rangent l'octet de poids faible en premier (little-endian), les protocoles réseau envoient le poids fort en premier. Test : uint32_t x = 1; puis lire *(uint8_t *)&x. On convertit explicitement avec des décalages pour du code portable.</p></details>
<details><summary>Pile, tas, données statiques : où vivent les variables ?</summary><p>Locales sur la pile, globales et static en zone statique (.data si initialisées, .bss sinon), allocations dynamiques sur le tas. En embarqué, on évite malloc (fragmentation, temps non borné) et on surveille la taille de la pile.</p></details>
<details><summary>Polling, interruptions ou DMA ?</summary><p>Polling : simple, mais monopolise le processeur. Interruptions : réactif et économe pour des événements ponctuels. DMA : un contrôleur copie les données (ADC, UART, SPI) en mémoire sans le processeur, indispensable pour les gros débits.</p></details>
<details><summary>Qu'est-ce qu'une condition de course, et comment l'éviter ?</summary><p>Un résultat qui dépend de l'entrelacement de deux exécutions (une ISR et la boucle principale, deux tâches). Sections critiques (masquer les interruptions brièvement), opérations atomiques, mutex sous RTOS, ou un seul écrivain par variable.</p></details>
</div>`,
    practice: { title: "S'entraîner", body: `<p>Sur Wokwi, prends un Raspberry Pi Pico ou un ESP32, et écris sans bibliothèque Arduino (avec le SDK C ou ESP-IDF) : une LED qui clignote par interruption de timer, un bouton avec anti-rebond, et l'envoi de la température interne sur la liaison série toutes les secondes. Puis explique ton code à voix haute comme en entretien : pourquoi volatile, que fait l'ISR, où dort le processeur.</p>` },
    quiz: [
      { q: "Une variable 64 bits est incrémentée dans une ISR et lue dans main sur un processeur 32 bits. Quel risque ?", options: ["Aucun", "La lecture se fait en deux fois : une interruption entre les deux donne une valeur incohérente", "Un dépassement", "Une erreur de compilation"], answer: 1, explain: "Il faut masquer les interruptions pendant la lecture, ou relire jusqu'à obtenir deux fois la même valeur." },
      { q: "Pourquoi éviter malloc dans un firmware ?", options: ["Il n'existe pas en C embarqué", "Fragmentation du tas et durée non bornée : un système qui doit tourner des années risque de ne plus trouver de bloc libre", "Il est trop lent à compiler", "Il est interdit par la norme"], answer: 1, explain: "On préfère l'allocation statique, ou des pools de blocs de taille fixe." }
    ]
  }
];
