# AET Stream — Huhu.to intégré

Site autonome qui charge **huhu.to** directement dans une iframe pour naviguer
sans jamais taper d'URL, et un lecteur intégré (HLS / MP4 / YouTube / Vimeo).

## 📁 Contenu de l'archive

| Fichier | Rôle |
|---|---|
| `index.html` | Application complète, à ouvrir directement dans un navigateur ou héberger. |
| `huhu-stream-home-integration.js` | Userscript qui injecte le panneau AET Stream **à l'intérieur** de huhu.to (via Tampermonkey / extension). |
| `huhu-watch-live-menu-open.js` | Userscript qui garde le menu des chaînes ouvert sur `/watch?live=…`. |
| `README.md` | Ce document. |

## 🚀 Utilisation

### 1. Ouvrir localement
1. Décompressez l'archive.
2. Double-cliquez sur `index.html`.
3. Le site huhu.to s'affiche directement dans l'onglet **🌐 Navigateur Huhu.to**.

### 2. Héberger en ligne
Uploadez le dossier sur n'importe quel hébergeur statique (Netlify, Vercel,
GitHub Pages, un simple serveur Apache/Nginx). Aucune dépendance backend.

### 3. Userscripts (optionnel)
Pour améliorer huhu.to lui-même :

1. Installez **Tampermonkey** (Chrome / Firefox / Edge).
2. Créez un nouveau script → collez le contenu de
   `huhu-stream-home-integration.js`.
3. En tête, ajoutez :
   ```js
   // ==UserScript==
   // @name         AET Stream — huhu.to
   // @match        https://huhu.to/*
   // @run-at       document-idle
   // ==/UserScript==
   ```
4. Idem pour `huhu-watch-live-menu-open.js` si vous voulez le menu chaînes
   toujours ouvert.

## 🎛️ Fonctionnalités

- **Onglet Navigateur** : huhu.to affiché en iframe plein-cadre, barre d'URL,
  boutons précédent / suivant / recharger, raccourcis (TV France, USA, UK,
  Films, Séries, Recherche).
- **Capture d'URL** : bouton « 📥 Capturer vers le lecteur » → l'URL courante
  de huhu.to est envoyée au lecteur intégré.
- **Lecteur** : HLS (via hls.js), MP4/WebM, YouTube, Vimeo, embed générique.
- **Bibliothèque locale** : sauvegarde dans le navigateur (`localStorage`),
  import/export JSON, recherche.
- **Chaînes rapides** : raccourcis pré-remplis (Canal+, TF1, France 2, BeIN,
  RMC Sport, etc.) qui ouvrent directement huhu.to sur la recherche
  correspondante.

## ⚠️ Notes techniques

- **X-Frame-Options** : au moment de la construction, huhu.to n'envoie pas
  d'en-tête bloquant l'iframe, donc l'intégration fonctionne. Si le site
  change de politique, l'overlay « Site refuse l'intégration » s'affichera et
  il faudra utiliser le bouton « Ouvrir dans un nouvel onglet ».
- **Cross-origin** : la barre d'URL n'est pas toujours synchronisable avec la
  navigation interne de l'iframe (protection navigateur), mais chaque
  raccourci met à jour manuellement l'URL.
- **CORS** : certains flux HLS/MP4 peuvent refuser d'être lus depuis un
  domaine tiers. Utilisez alors « Ouvrir dans un nouvel onglet ».

## 📜 Licence & usage

Usage prévu : vos propres flux, embeds publics autorisés, IPTV légitime,
démonstrations personnelles, contenus dont vous avez les droits d'accès.
