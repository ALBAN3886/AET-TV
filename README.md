# ALBAN ELOH TECHNOLOGIE — AET (V4 corrigée)

Version **V4** entièrement réécrite qui corrige les problèmes de lenteur et de blocage de la V3.

## ✅ Défauts corrigés dans cette version

| Problème V3 | Correction V4 |
|---|---|
| 1032 chaînes IPTV **inline dans le HTML** (191 KB sur 1 ligne JS) | Chaînes déplacées dans `channels.json`, **chargement asynchrone** en arrière-plan |
| Aucune **pagination** — 1000+ boutons rendus d'un coup | Pagination 40 chaînes/page + recherche filtrée |
| Écran **Paramètres** existant en HTML mais jamais activé (pas de switchScreen) | Système de navigation unifié `switchScreen()` qui active tous les écrans |
| **20 IDs orphelins** en HTML jamais liés à du JS | Structure nettoyée, tous les IDs sont utilisés |
| `.onclick=` qui écrasait les handlers | 100 % `addEventListener` avec **délégation d'événements** |
| Recherche sans debounce → re-render à chaque frappe | Debounce 200 ms sur toutes les recherches |
| Pas de cache | Cache localStorage des chaînes après premier chargement |

## 📁 Fichiers du dépôt

- **`index.html`** — application principale, 50 KB
- **`channels.json`** — base des 1032 chaînes IPTV (188 pays), chargée en arrière-plan
- **`_headers`** — configuration cache Netlify
- **`netlify.toml`** — configuration Netlify (CORS pour channels.json)
- **`huhu-watch-live-menu-open.js`** — userscript optionnel Tampermonkey
- **`huhu-stream-home-integration.js`** — userscript optionnel Tampermonkey

## 🚀 Déploiement

Netlify est lié à ce repo GitHub, **l'URL ne change pas**. Il suffit de :

1. Remplacer `index.html` par le nouveau
2. Ajouter `channels.json` à la racine
3. Ajouter `_headers` et `netlify.toml`
4. Commit sur `main` → Netlify redéploie automatiquement

## 🔍 Vérification après déploiement

Ouvrez le site en **navigation privée**. Vous devez voir :

- Badge **VERSION V4 · CORRIGÉE** sur l'accueil
- Chargement rapide (l'interface s'affiche avant même que les chaînes soient chargées)
- Un compteur "Chaînes : 1 032" et "Pays : 188" une fois le JSON téléchargé
- L'écran **Paramètres** s'ouvre bien depuis la barre du bas
- Recherche pays / chaînes réactive sans lag
- Pagination en bas de la liste des chaînes
