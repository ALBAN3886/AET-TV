# ALBAN ELOH TECHNOLOGIE — V5

## Changements demandés appliqués

- Source des chaînes du monde changée vers : `https://iptv-org.github.io/iptv/index.country.m3u`
- Menu transformé en **plein écran**
- YouTube configuré avec **vrais liens d'ouverture**
- huhu.to intégré en **accès rapide externe** + copie de lien

## Important concernant huhu.to

Si huhu.to refuse l'ouverture dans une iframe ou renvoie un code de protection côté serveur, le site doit être ouvert normalement dans un onglet. Cette version ajoute donc les raccourcis, l'ouverture directe et le menu plein écran, sans essayer de contourner les protections du site tiers.

## Déploiement GitHub

Remplacez à la racine du repo :
- `index.html`
- `_headers`
- `netlify.toml`
- `README.md`

Netlify gardera la **même URL** si ce repo GitHub est déjà lié au site existant.
