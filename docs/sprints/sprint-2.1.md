# Sprint 2.1

**Objectif** : poser le socle data et livrer le module NumPy.

| Story | Points | Statut |
|-------|--------|--------|
| #1 US-2.0 Socle data | 5 | Terminé (PR #8) |
| #2 US-2a NumPy | 5 | Terminé (PR #9) |

**Capacité** : 10 points.

**Vélocité** : 10 points livrés sur 10.

## Rétrospective

- **Ce qui a marché** : le validateur a attrapé une erreur dans un énoncé (égalité dans un `argmax`) avant publication ; le test de parité a confirmé que les solutions passent aussi dans Pyodide 32 bits.
- **Ce qui a coincé** : `*.vercel.app` est bloqué par le réseau des résidences, donc les aperçus de PR ne se relisent que sur mobile ; les tags ne peuvent pas être poussés depuis la session de Claude.
- **Ce qu'on change** : les releases se créent dans l'interface GitHub en fin de sprint ; les relectures se font sur GitHub Pages après fusion, ou sur mobile.
