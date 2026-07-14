# AET TV Smart Hub

Refonte complète du projet **AET-TV** en une expérience type Smart TV premium inspirée des hubs TV modernes, tout en conservant l’identité AET TV.

## Points livrés

- interface 16:9 premium, sombre, plein écran et glassmorphism
- page d’accueil avec hero + rangées horizontales type Smart Hub
- cartes enrichies : logo, nom, qualité, pays, catégorie, vues locales, état LIVE
- navigation clavier / télécommande : haut, bas, gauche, droite, OK, retour, home, play/pause
- lecteur vidéo plein écran avec progression, reprise, mute, sous-titres, chaîne suivante/précédente
- recherche instantanée, historique, suggestions, recherche vocale si support navigateur
- profil utilisateur, favoris, historique et section “continuer à regarder”
- paramètres : thème, langue, qualité, contrôle parental, notifications, sons UI
- optimisation : cache local, préchargement des logos, lazy loading, PWA, service worker, mode hors ligne
- installation PWA + splash screen + icônes + mise à jour applicative

## Structure

- `index.html` : shell applicatif
- `assets/css/app.css` : design system + responsive TV/mobile
- `assets/js/app.js` : logique UI, navigation, lecteur, recherche, PWA
- `assets/js/store.js` : persistance locale
- `assets/js/utils.js` : helpers, parsing, catégorisation
- `manifest.webmanifest` : installation PWA
- `sw.js` : cache offline et mises à jour

## Déploiement

Déployez simplement le contenu à la racine du site statique ou du dépôt GitHub Pages.

## Remarque

Les données IPTV restent dépendantes des flux tiers (`iptv-org`). Certaines chaînes peuvent être indisponibles selon leur source, leur géoblocage ou leur politique CORS.
