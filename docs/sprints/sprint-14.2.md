# Sprint 14.2

**Objectif** : une Content-Security-Policy stricte sur Boucle (AUDIT #21), et le C++ hors du fil principal (AUDIT #22).

| Story | Points | Statut |
|-------|--------|--------|
| #140 C-2 Content-Security-Policy | 5 | Terminé |

## Conception

- Inventaire avant d'écrire la politique : la page charge ses modules, les polices Google, et crée deux workers ; Pyodide vient du CDN mais dans le worker Python. Le seul obstacle était JSCPP : chargé sur la page, il appelle `eval` pour décoder les échappements des chaînes C++. L'autoriser (`'unsafe-eval'`) aurait affaibli toute la page.
- Choix : déplacer JSCPP dans un Web Worker. Cela règle aussi l'AUDIT #22 : une boucle infinie ne fige plus l'interface, et le worker est arrêté s'il ne répond plus.
- Politique : `script-src 'self'` (ni inline, ni domaine tiers, ni eval), `object-src 'none'`, `base-uri 'self'`, `form-action 'none'`, `connect-src 'self'`. `style-src` garde `'unsafe-inline'` pour les attributs `style` du rendu (risque faible, noté dans ARCHITECTURE).
- Deux emplacements : balise meta (GitHub Pages) et en-tête Vercel, qui seul permet `frame-ancestors 'none'`.
- Vérification : toute violation signalée par le navigateur fait échouer les tests e2e, et un test injecte un script inline pour vérifier qu'il est bloqué.

## Journal

- 13 nov. : worker C++ (`workers/cpp-worker.js`), `runCpp` réécrit autour de lui ; politique dans `index.html` et `vercel.json` ; écoute des violations dans les tests ; tests de la politique et de la boucle infinie C++.
- 13 nov. : un premier test vérifiait qu'`eval` était bloqué, mais `page.evaluate` de Playwright n'est pas soumis à la politique de la page. Remplacé par l'injection d'un script inline, le vrai scénario d'un XSS.
- 13 nov. : PR #144, les trois jobs verts (dont la parité navigateur : toutes les solutions C++ passent dans le worker). Fusionnée ; version 0.42.0.

## Revue de sprint

| Story | Points | Livré |
|-------|--------|-------|
| #140 Content-Security-Policy (et AUDIT #22) | 5 | Oui (PR #144) |

## Rétrospective

**Ce qui a marché.** Inventorier ce que la page charge avant d'écrire la politique : le seul blocage (eval dans JSCPP) est apparu tout de suite, et la solution a réglé un deuxième point de l'audit.

**Ce qui a coincé.** Un outil de test peut contourner ce qu'on teste (`page.evaluate` ignore la CSP). Tester le scénario réel, pas un raccourci.

**À essayer.** Les deux leçons DevOps reprennent ces deux sprints comme cas concret.
