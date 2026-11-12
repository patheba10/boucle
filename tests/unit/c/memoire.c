#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

typedef struct Noeud { int val; struct Noeud *suiv; } Noeud;
typedef void (*Handler)(void);
static volatile uint32_t ticks;
void isr_a(void) { ticks += 1; }
void isr_b(void) { ticks += 100; }
Handler vecteurs[2] = { isr_a, isr_b };
const uint8_t TABLE[] = { 0x3F, 0x06, 0x5B, 0x4F };
struct Capteur { char nom[8]; uint16_t valeurs[3]; float gain; };

uint8_t crc8(const uint8_t *d, size_t n) {
    uint8_t crc = 0;
    for (size_t i = 0; i < n; i++) {
        crc ^= d[i];
        for (int b = 0; b < 8; b++) crc = (crc & 0x80) ? (uint8_t)((crc << 1) ^ 0x07) : (uint8_t)(crc << 1);
    }
    return crc;
}

int main(void) {
    Noeud *tete = NULL;
    for (int i = 1; i <= 4; i++) { Noeud *n = malloc(sizeof *n); n->val = i * i; n->suiv = tete; tete = n; }
    for (Noeud *n = tete; n != NULL; n = n->suiv) printf("%d ", n->val);
    printf("\n");
    vecteurs[0](); vecteurs[1](); (*vecteurs[0])(); printf("%u\n", ticks);
    int m[3][4]; for (int i = 0; i < 3; i++) for (int j = 0; j < 4; j++) m[i][j] = i * 10 + j;
    printf("%d %d %lu\n", m[2][3], *(*(m + 1) + 2), sizeof m);
    struct Capteur cs[2] = { { "temp", {1, 2, 3}, 0.5f }, { .nom = "hum", .gain = 2.0f } };
    printf("%s %u %.1f %s %u\n", cs[0].nom, cs[0].valeurs[2], cs[0].gain * cs[0].valeurs[1], cs[1].nom, cs[1].valeurs[0]);
    printf("%lu %lu\n", sizeof(struct Capteur), sizeof(cs));
    const char *msg = "123456789"; printf("0x%02X\n", crc8((const uint8_t *)msg, strlen(msg)));
    uint64_t grand = 1ULL << 40; printf("%lu %lu\n", (unsigned long)grand, (unsigned long)-1);
    printf("%d %d\n", TABLE[2], 'A' + 2);
    char c = 'a'; c -= 32; printf("%c%c\n", c, c + 1);
    unsigned long long cumul = 0; for (uint32_t i = 0; i < 100000; i++) cumul += i; printf("%llu\n", cumul);
    int v = 0x7FFFFFFF; v += 1; printf("%d\n", v);
    printf("%d\n", 1 ? 2 : 3);
    uint8_t reg = 0b10110010; printf("%u %u\n", (reg >> 4) & 0x0F, reg & ~(1u << 1));
    int arr[5] = {5, 3, 1, 4, 2};
    for (int i = 0; i < 5; i++) for (int j = 0; j < 4 - i; j++) if (arr[j] > arr[j + 1]) { int t = arr[j]; arr[j] = arr[j + 1]; arr[j + 1] = t; }
    for (int i = 0; i < 5; i++) printf("%d", arr[i]);
    printf("\n");
    return 0;
}
