# AET ALBAN ELOH TECHNOLOGIE — Huhu Navigator Pro

## Correctif principal
Sur certains téléphones, `huhu.to` refuse l'affichage dans une iframe embarquée.
Cette version corrige le problème avec un **double fonctionnement** :

1. **Mode intégré** : la page essaie d'afficher huhu.to dans le site.
2. **Mode secours mobile** : si l'intégration échoue, un panneau moderne s'affiche
   et permet d'ouvrir immédiatement la bonne page **sans taper**.

## Fichiers
- `index.html` : application principale moderne et responsive.
- `huhu-stream-home-integration.js` : lanceur flottant à injecter dans huhu.to.
- `huhu-watch-live-menu-open.js` : helper pour garder le menu live ouvert.
- `README.md` : explications.

## Utilisation
1. Décompresser le ZIP.
2. Ouvrir `index.html`.
3. Utiliser les raccourcis : TV en direct, Films, Séries, Recherche.
4. Si l'iframe échoue sur mobile, cliquer sur **Ouvrir cette page ici**.

## Signature
Produit signé : **AET ALBAN ELOH TECHNOLOGIE**
