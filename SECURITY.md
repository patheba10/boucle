# Sécurité

## Signaler une faille

Merci de **ne pas ouvrir d'issue publique**. Utilise le signalement privé de GitHub : onglet **Security** du dépôt, puis **Report a vulnerability**. Réponse visée sous 7 jours, correctif publié dans le CHANGELOG (section « Sécurité ») une fois la faille corrigée.

## Ce qui est couvert

Boucle est un site statique : pas de serveur, pas de compte, pas de données envoyées. Le code des élèves s'exécute dans leur navigateur (Pyodide, JSCPP et minic dans des Web Workers) et la progression reste dans leur navigateur.

Sont dans le périmètre :

- une injection de script dans la page (XSS), par exemple via un fichier de progression importé, une adresse ou la sortie d'un programme ;
- un contournement de la Content-Security-Policy ;
- le service worker (mise en cache de réponses qui ne devraient pas l'être) ;
- la CI et la publication (workflows GitHub Actions, déploiement Pages et Vercel).

Ne sont pas des failles : exécuter du code arbitraire dans son propre navigateur depuis l'atelier (c'est le principe du site), ou modifier sa propre progression.

## Mesures en place

| Mesure | Où |
|--------|-----|
| Content-Security-Policy stricte : `script-src 'self'`, ni inline ni eval | `public/index.html`, `vercel.json` (avec `frame-ancestors 'none'` et HSTS) |
| Tout texte affiché est échappé ; un fichier importé est validé champ par champ | `lib/util.js` (`esc`), `lib/sauvegarde.js` |
| JSCPP servi par le site, copie exacte du paquet npm (test d'empreinte) | `public/assets/vendor/`, `tests/unit/vendor.test.mjs` |
| Actions de la CI épinglées par SHA, permissions minimales, publication depuis `main` seulement | `.github/workflows/ci.yml` |
| Analyse CodeQL (JavaScript, Python, workflows) | `.github/workflows/codeql.yml` |
| Audit des dépendances npm et Python à chaque CI | job « Audit des dépendances » |
| Dependabot : actions, npm, outils de test Python | `.github/dependabot.yml` |

## Exceptions connues

- **Pyodide** est chargé depuis cdn.jsdelivr.net, à une version fixe (0.29.5), sans contrôle d'intégrité possible dans un worker (`importScripts`). Héberger ses ~30 Mo de paquets sur GitHub Pages n'est pas raisonnable. Risque accepté : compromission du CDN.
- **Paquets Python de la CI** : `requirements.txt` reprend exactement les versions de Pyodide, pour que la CI valide les exercices dans les mêmes conditions que le navigateur. Les failles signalées sur starlette 0.47.2, anyio 4.9.0 et pytest 8.3.5 touchent des serveurs web ou des machines partagées : ces paquets ne servent qu'à valider des exercices dans un runner jetable. Elles sont listées, avec leur justification, dans l'audit des dépendances de la CI ; elles seront levées en même temps que la mise à jour de Pyodide.
- `style-src 'unsafe-inline'` : l'interface pose des couleurs par attribut `style`. Pas d'exécution de code possible par ce biais.
