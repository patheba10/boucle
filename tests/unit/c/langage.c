#include <stdio.h>
#include <stdint.h>
#include <string.h>
#include <stdbool.h>

#define BIT(n) (1u << (n))
#define SET(reg, n) ((reg) |= BIT(n))
#define CLR(reg, n) ((reg) &= ~BIT(n))
#define CARRE(x) ((x) * (x))

typedef struct { volatile uint32_t MODER; volatile uint32_t ODR; } GPIO_TypeDef;
GPIO_TypeDef sim_A;
#define GPIOA (&sim_A)

enum Etat { ARRET, MARCHE = 5, PAUSE };
struct Point { int16_t x, y; };
typedef struct Point Point;
union Mot { uint32_t u; uint8_t o[4]; };

static int compteur(void) { static int n = 0; return ++n; }
int fact(int n) { return n <= 1 ? 1 : n * fact(n - 1); }
void echange(int *a, int *b) { int t = *a; *a = *b; *b = t; }
Point milieu(Point a, Point b) { Point m = { (int16_t)((a.x + b.x) / 2), (int16_t)((a.y + b.y) / 2) }; return m; }
int somme(const int *t, size_t n) { int s = 0; for (size_t i = 0; i < n; i++) s += t[i]; return s; }
int appliquer(int (*f)(int), int x) { return f(x); }

int main(void) {
    uint8_t a = 250; a += 10; printf("%u\n", a);
    int8_t b = 127; b++; printf("%d\n", b);
    uint16_t c = 0; c--; printf("%u %x %X\n", c, c, c);
    uint32_t r = 0; SET(r, 5); SET(r, 31); CLR(r, 5); printf("0x%08X\n", r);
    GPIOA->MODER = (GPIOA->MODER & ~(3u << 10)) | (1u << 10); GPIOA->ODR ^= BIT(5);
    printf("%lu %u %u\n", sizeof(GPIO_TypeDef), GPIOA->MODER, GPIOA->ODR);
    enum Etat e = PAUSE; printf("%d %d\n", e, MARCHE);
    switch (e) { case ARRET: puts("arret"); break; case MARCHE: case PAUSE: puts("marche ou pause"); /* fall */ default: puts("defaut"); }
    { int c1 = compteur(); int c2 = compteur(); printf("%d %d %d\n", c1, c2, fact(10)); }
    int x = 3, y = 4; echange(&x, &y); printf("%d %d\n", x, y);
    Point p = {2, 4}, q = {.y = 10, .x = 8}; Point m = milieu(p, q); printf("%d %d %lu\n", m.x, m.y, sizeof(Point));
    union Mot mot; mot.u = 0x11223344; printf("%02x %02x\n", mot.o[0], mot.o[3]);
    int t[] = {1, 2, 3, 4, 5}; printf("%d %lu\n", somme(t, sizeof t / sizeof t[0]), sizeof(t));
    char s[16] = "bonjour"; s[0] = 'B'; printf("%s %lu %d\n", s, strlen(s), strcmp(s, "Bonjour"));
    printf("%d %d\n", -7 / 2, -7 % 2);
    printf("%d\n", -1 < 0u);
    printf("%d %u\n", (int)(uint8_t)300, (unsigned)-1);
    double d = 3.0 / 2; float f = 1.0f / 3; printf("%.3f %.6f %d\n", d, f, (int)2.9);
    printf("%d\n", appliquer(fact, 5));
    int *pt = t + 2; printf("%d %ld\n", *pt, pt - t);
    bool ok = 5; printf("%d\n", ok);
    printf("[%5d] [%-5d] [%05d] [%+d] [%x] [%#x] [%c] [%10s] [%.2s]\n", 42, 42, 42, 42, 255, 255, 'A', "abc", "abcdef");
    int16_t neg = -2; printf("%d %d\n", neg >> 1, (uint16_t)neg >> 1);
    uint32_t big = 0xFFFFFFFFu; printf("%u %u\n", big + 1, big * 2);
    int i = 0; do { i += 3; } while (i < 10); printf("%d\n", i);
    for (int k = 0; k < 10; k++) { if (k == 2) continue; if (k == 5) break; printf("%d", k); } printf("\n");
    printf("%d\n", CARRE(1 + 2));
    char buf[32]; int n = snprintf(buf, sizeof buf, "T=%d.%d", 23, 5); printf("%s %d\n", buf, n);
    uint8_t octets[4] = {0}; memset(octets, 0xAB, 3); printf("%x %x\n", octets[2], octets[3]);
    return 0;
}
