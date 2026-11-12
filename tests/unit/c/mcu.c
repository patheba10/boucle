#include <stdio.h>
#include "mcu.h"

volatile uint32_t ticks = 0;
void TIM2_IRQHandler(void) { TIM2->SR &= ~TIM_SR_UIF; ticks++; }

void gpio_sortie(GPIO_TypeDef *g, int b) { g->MODER = (g->MODER & ~(3u << (2 * b))) | (1u << (2 * b)); }
void gpio_ecrire(GPIO_TypeDef *g, int b, int v) { g->BSRR = v ? (1u << b) : (1u << (b + 16)); }

int main(void) {
    gpio_sortie(GPIOA, 5);
    gpio_ecrire(GPIOA, 5, 1); sim_gpio(GPIOA);
    printf("MODER=0x%08X ODR=0x%04X IDR=0x%04X\n", GPIOA->MODER, GPIOA->ODR, GPIOA->IDR);
    gpio_ecrire(GPIOA, 5, 0); sim_gpio(GPIOA);
    printf("ODR=0x%04X\n", GPIOA->ODR);
    sim_broche(GPIOB, 3, 1); printf("PB3=%u\n", (GPIOB->IDR >> 3) & 1u);
    TIM2->PSC = 15999; TIM2->ARR = 999; TIM2->DIER |= TIM_DIER_UIE; TIM2->CR1 |= TIM_CR1_CEN;
    sim_isr_tim2 = TIM2_IRQHandler;
    uint32_t d = sim_timer(TIM2, F_CPU * 3);
    printf("%u debordements, ticks=%u, CNT=%u\n", d, ticks, TIM2->CNT);
    return 0;
}
