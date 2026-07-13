# ALBAN ELOH TECHNOLOGIE — Version GitHub/Netlify corrigée

Ce dépôt est prévu pour **garder la même URL Netlify** déjà liée à GitHub.

## Important
Si votre site affiche encore l'ancienne interface bleue, cela veut dire que **l'ancien `index.html` est toujours dans la branche `main`** ou que GitHub/Netlify n'a pas encore redéployé le nouveau commit.

## Fichiers à mettre à la racine du repo
- `index.html` → nouvelle version rouge/blanc style mobile inspirée du modèle demandé
- `_headers` → force Netlify à éviter de servir l'ancienne page en cache
- `netlify.toml` → configuration simple pour le déploiement Netlify lié à GitHub
- `huhu-stream-home-integration.js` → script optionnel pour huhu.to
- `huhu-watch-live-menu-open.js` → script optionnel pour huhu.to

## Remplacement recommandé sur GitHub
Sur le repo `AET-TV`, branche `main` :
1. supprimer ou remplacer l'ancien `index.html`
2. envoyer ce nouveau `index.html`
3. ajouter `_headers`
4. ajouter `netlify.toml`
5. committer sur `main`

## Vérification après commit
Quand GitHub est à jour, Netlify redéploie automatiquement tout en gardant la **même URL**.

### Signe que la bonne version est en ligne
Vous devez voir :
- une **barre rouge** en haut
- un **fond rouge**
- le badge visible **VERSION GITHUB V3**
- les gros boutons blancs bordés de rouge
- la barre rouge du bas

Si vous voyez encore l'ancien thème bleu, c'est que le repo n'a pas encore été remplacé par ces fichiers.
