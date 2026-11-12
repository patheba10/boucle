/* mcu.h : le microcontrôleur simulé du cours de C embarqué.

   Ses périphériques imitent ceux d'un STM32 et de ses en-têtes CMSIS : chaque périphérique est une structure de
   registres de 32 bits, et GPIOA, TIM2, ADC1 ou USART1 sont des pointeurs vers ces structures. Sur une vraie puce,
   ces pointeurs valent une adresse fixe (par exemple 0x40020000) ; ici, ce sont des variables, pour que le même
   programme tourne dans le navigateur (minic) et sur ta machine (gcc).

   Les fonctions sim_… jouent le rôle du matériel : les tests les appellent pour faire avancer le temps,
   changer le niveau d'une broche ou terminer une conversion. Ton code ne les appelle pas. */
#ifndef BOUCLE_MCU_H
#define BOUCLE_MCU_H

#include <stdint.h>

#define F_CPU 16000000u /* horloge du processeur : 16 MHz */

/* ---- GPIO : broches d'entrée et de sortie ---- */
typedef struct {
    volatile uint32_t MODER; /* 2 bits par broche : 00 entrée, 01 sortie, 10 fonction alternative, 11 analogique */
    volatile uint32_t PUPDR; /* 2 bits par broche : 00 aucune, 01 pull-up, 10 pull-down */
    volatile uint32_t IDR;   /* niveaux lus sur les broches (lecture seule) */
    volatile uint32_t ODR;   /* niveaux imposés aux broches en sortie */
    volatile uint32_t BSRR;  /* écriture seule : bit n met la broche n à 1, bit n + 16 la met à 0 */
} GPIO_TypeDef;

/* ---- Timer : compteur, débordement, comparaison (PWM) ---- */
typedef struct {
    volatile uint32_t CR1;   /* bit 0 CEN : compteur en marche */
    volatile uint32_t DIER;  /* bit 0 UIE : interruption au débordement */
    volatile uint32_t SR;    /* bit 0 UIF : débordement survenu (à effacer par logiciel) */
    volatile uint32_t CNT;   /* valeur du compteur */
    volatile uint32_t PSC;   /* prédiviseur : le compteur avance tous les PSC + 1 cycles d'horloge */
    volatile uint32_t ARR;   /* rechargement : après ARR, le compteur revient à 0 */
    volatile uint32_t CCR1;  /* comparaison : en PWM, la sortie vaut 1 tant que CNT < CCR1 */
} TIM_TypeDef;

/* ---- Convertisseur analogique-numérique, 12 bits ---- */
typedef struct {
    volatile uint32_t CR;    /* bit 0 ADON : allumé ; bit 1 START : lance une conversion */
    volatile uint32_t SR;    /* bit 1 EOC : conversion terminée */
    volatile uint32_t DR;    /* résultat, de 0 à 4095 */
} ADC_TypeDef;

/* ---- Liaison série ---- */
typedef struct {
    volatile uint32_t SR;    /* bit 7 TXE : prêt à émettre ; bit 5 RXNE : un octet a été reçu */
    volatile uint32_t DR;    /* octet émis ou reçu */
    volatile uint32_t BRR;   /* diviseur de débit : F_CPU / débit */
    volatile uint32_t CR1;   /* bit 13 UE : activée ; bit 3 TE : émetteur ; bit 2 RE : récepteur */
} USART_TypeDef;

#define TIM_CR1_CEN   (1u << 0)
#define TIM_DIER_UIE  (1u << 0)
#define TIM_SR_UIF    (1u << 0)
#define ADC_CR_ADON   (1u << 0)
#define ADC_CR_START  (1u << 1)
#define ADC_SR_EOC    (1u << 1)
#define USART_SR_TXE  (1u << 7)
#define USART_SR_RXNE (1u << 5)
#define USART_CR1_UE  (1u << 13)
#define USART_CR1_TE  (1u << 3)
#define USART_CR1_RE  (1u << 2)

GPIO_TypeDef sim_gpioa, sim_gpiob;
TIM_TypeDef sim_tim2;
ADC_TypeDef sim_adc1;
USART_TypeDef sim_usart1;

#define GPIOA  (&sim_gpioa)
#define GPIOB  (&sim_gpiob)
#define TIM2   (&sim_tim2)
#define ADC1   (&sim_adc1)
#define USART1 (&sim_usart1)

/* ---- Simulation du matériel (utilisée par les tests) ---- */

/* Fonction appelée par sim_timer à chaque débordement si l'interruption est activée (le « vecteur »). */
void (*sim_isr_tim2)(void);

/* Applique BSRR à ODR comme le ferait le matériel, puis recopie les sorties dans IDR. */
void sim_gpio(GPIO_TypeDef *g) {
    uint32_t sorties = 0;
    for (int b = 0; b < 16; b++)
        if (((g->MODER >> (2 * b)) & 3u) == 1u) sorties |= 1u << b;
    g->ODR = (g->ODR | (g->BSRR & 0xFFFFu)) & ~(g->BSRR >> 16);
    g->BSRR = 0;
    g->IDR = (g->IDR & ~sorties) | (g->ODR & sorties);
}

/* Impose le niveau d'une broche d'entrée (un bouton, un capteur). */
void sim_broche(GPIO_TypeDef *g, int broche, int niveau) {
    if (niveau) g->IDR |= 1u << broche;
    else g->IDR &= ~(1u << broche);
}

/* Fait passer `cycles` cycles d'horloge ; renvoie le nombre de débordements. */
uint32_t sim_timer(TIM_TypeDef *t, uint32_t cycles) {
    static uint32_t reste = 0;
    uint32_t debordements = 0, pas;
    if (!(t->CR1 & TIM_CR1_CEN)) return 0;
    reste += cycles % (t->PSC + 1);
    pas = cycles / (t->PSC + 1) + reste / (t->PSC + 1);
    reste %= t->PSC + 1;
    while (pas > 0) {
        uint32_t avant = t->ARR - t->CNT; /* pas restants avant d'atteindre ARR */
        if (pas <= avant) {
            t->CNT += pas;
            break;
        }
        pas -= avant + 1;
        t->CNT = 0;
        t->SR |= TIM_SR_UIF;
        debordements++;
        if ((t->DIER & TIM_DIER_UIE) && sim_isr_tim2) sim_isr_tim2();
    }
    return debordements;
}

/* Termine la conversion en cours avec le résultat `valeur` (0 à 4095). */
void sim_adc(ADC_TypeDef *a, uint16_t valeur) {
    if ((a->CR & ADC_CR_ADON) && (a->CR & ADC_CR_START)) {
        a->DR = valeur & 0xFFFu;
        a->SR |= ADC_SR_EOC;
        a->CR &= ~ADC_CR_START;
    }
}

#endif
