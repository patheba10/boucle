# Sprint 14.1

**Objectif** : Boucle s'installe comme une application et s'ouvre sans réseau (AUDIT #19).

| Story | Points | Statut |
|-------|--------|--------|
| #139 C-1 Boucle hors ligne (PWA) | 8 | Terminé |

## Conception

- Un manifeste (nom, icônes 192 et 512 dont une « maskable », affichage autonome) rend le site installable sur téléphone et ordinateur.
- Le service worker met tout le site en cache à l'installation : environ 190 fichiers, 3,5 Mo. Une page jamais ouverte s'affiche donc aussi hors ligne.
- Réseau d'abord pour les fichiers du site : en ligne, l'élève a toujours la dernière version, sans écran « mise à jour disponible » ni cache périmé, le piège classique des PWA. Le cache ne sert qu'en cas d'échec du réseau.
- Cache d'abord pour Pyodide et JSCPP : leurs adresses contiennent la version, leur contenu ne change jamais. Les gros fichiers (une dizaine de Mo pour Python) ne sont téléchargés qu'une fois.
- La liste des fichiers n'est pas écrite à la main : `scripts/precache.mjs` la génère avec une empreinte du contenu. Un fichier modifié change l'empreinte, donc `sw.js`, ce qui déclenche l'installation de la nouvelle version et la suppression de l'ancien cache. Un test unitaire refuse une liste périmée.

## Journal

- 13 nov. : manifeste et icônes, `sw.js`, générateur et test de la liste, enregistrement dans `main.js` avec un message quand le réseau tombe.
- 13 nov. : tests e2e. Le service worker est bloqué par défaut (chaque test part d'un navigateur neuf) ; deux tests le laissent actif, coupent le réseau et vérifient qu'une leçon jamais ouverte s'affiche et que Python s'exécute.
- 13 nov. : la CI a trouvé deux défauts invisibles en local. (1) Un dossier `__pycache__` local changeait l'empreinte : le générateur ignore maintenant les fichiers cachés et les caches Python. (2) Pyodide n'était jamais mis en cache : `importScripts` demande le fichier en mode no-cors, la réponse est opaque (statut 0) et le service worker l'écartait. Il redemande désormais en mode cors. En local, la copie de Pyodide servie par Playwright masquait le problème ; le test la retire avant de couper le réseau.
- 13 nov. : PR #142 verte et fusionnée ; version 0.41.0.

## Revue de sprint

| Story | Points | Livré |
|-------|--------|-------|
| #139 Boucle hors ligne (PWA) | 8 | Oui (PR #142) |

## Rétrospective

**Ce qui a marché.** Le test de bout en bout réseau coupé : il a trouvé le vrai défaut (réponse opaque), que la relecture du code n'aurait pas vu.

**Ce qui a coincé.** Un test passait en local pour une mauvaise raison (la copie locale de Pyodide répondait même hors ligne). Un test doit retirer ce qui pourrait le faire réussir à tort.

**À essayer.** Même méthode pour la CSP : les tests e2e échouent sur la moindre violation signalée par le navigateur.
