# AET VPN — Intégration native (WireGuard) dans AET-TV

Ce document accompagne le code ajouté sous `android/app/src/main/java/com/albaneloh/iptv/vpn/`,
`.../bridge/AetVpnBridge.kt`, `index.html`, `functions/` et `server-agent/`.
Il explique l'architecture complète, de bout en bout : app Android → backend
→ serveur WireGuard.

## 1. Ce qui a été fait

- **Aucune fonctionnalité existante retirée** : WebView, `WebAppBridge`,
  `PlayerActivity` / `IptvPlayerManager` (Media3), proxies IPTV, Firebase
  Analytics : inchangés.
- Module Android **indépendant** `vpn/` (`VpnServer.kt`, `VpnState.kt`,
  `VpnRepository.kt`, `WireGuardManager.kt`, `AetVpnService.kt`) + pont
  `bridge/AetVpnBridge.kt` exposé à la WebView sous `window.AetVpnAndroid`,
  et `assets/web/aet_vpn_bridge.js` qui construit `window.AETVPN` par-dessus.
  Utilise la bibliothèque officielle `com.wireguard.android:tunnel`
  (`GoBackend`) — aucune primitive cryptographique réimplémentée.
- Écran "🔐 AET VPN" dans `index.html` (menu, statut, liste des serveurs,
  connexion automatique) qui consomme `window.AETVPN`.
- **Backend complet** : deux Cloud Functions (`functions/index.js`) +
  un agent Python à faire tourner sur chaque serveur WireGuard
  (`server-agent/`) + règles Firestore (`firestore.rules`).

## 2. Architecture de bout en bout

```
WebView (index.html, window.AETVPN)
  ↓
AetVpnBridge.kt → WireGuardManager.kt → GoBackend (WireGuard officiel)
  ↓ (HTTPS, Firebase ID token)
Cloud Function provisionVpnClient (functions/index.js)
  ↓ (transaction Firestore)
vpnAllocations/{serverId}  +  vpnClients/{serverId}_{uid}
  ↑ (poll toutes les 30s)
server-agent/aet-vpn-agent.py, exécuté SUR le serveur WireGuard
  ↓
wg set wg0 peer <clé publique client> allowed-ips <ip>/32 preshared-key ...
```

À aucun moment l'app Android ou la Cloud Function ne se connectent à un
serveur WireGuard ou n'exécutent de commande dessus : c'est l'agent, qui
tourne uniquement sur la machine du serveur, qui a ce rôle — et lui seul.

### Ce que fait chaque Cloud Function

- **`provisionVpnClient`** : vérifie le Firebase ID token, attribue (ou
  réutilise) une adresse IP tunnel unique par `(utilisateur, serveur)` via
  une transaction Firestore sur `vpnAllocations/{serverId}`, génère une
  preshared key aléatoire (32 octets, `crypto.randomBytes`), enregistre le
  tout dans `vpnClients/{serverId}_{uid}`, renvoie
  `{ clientAddress, presharedKey }`. Idempotent : une reconnexion avec la
  même clé publique renvoie toujours la même adresse ; avec une clé
  publique différente (réinstallation), l'adresse est conservée et seule la
  clé enregistrée est mise à jour.
- **`revokeVpnClient`** : marque `vpnClients/...` comme `revoked`, appelée
  automatiquement par `WireGuardManager.disconnect()` (best-effort : la
  déconnexion locale du tunnel n'attend jamais cet appel réseau).

`VpnRepository.kt` pointe déjà vers les URLs prévisibles (fonctions 1ère
génération) :

```
https://us-central1-aet-tv-5d58c.cloudfunctions.net/provisionVpnClient
https://us-central1-aet-tv-5d58c.cloudfunctions.net/revokeVpnClient
```

## 3. Schéma Firestore

### `vpnServers/{id}` — lecture seule pour les clients authentifiés

```json
{
  "name": "France 01",
  "country": "France",
  "countryCode": "FR",
  "flag": "🇫🇷",
  "host": "vpn-fr01.example.com",
  "port": 51820,
  "publicKey": "base64...",
  "dns": ["1.1.1.1", "1.0.0.1"],
  "allowedIps": ["0.0.0.0/0", "::/0"],
  "active": true,
  "serverLoad": 32,
  "latencyMs": 38,
  "protocol": "wireguard",
  "description": ""
}
```

`publicKey` est la clé **publique** du serveur (sans danger à exposer, comme
une IP). N'y mettez jamais de clé privée.

### `vpnUsers/{uid}` — lecture/écriture par le propriétaire uniquement

```json
{ "active": true, "plan": "free", "vpnEnabled": true, "currentServer": "france-01", "lastConnection": 1737000000000 }
```

### `vpnAllocations/{serverId}` — jamais lu/écrit par un client (Admin SDK only)

À créer manuellement (console Firebase ou script d'admin) avant le premier
provisioning sur un serveur :

```json
{ "subnetBase": "10.66.0.0/16", "nextHostId": 2 }
```

Un sous-réseau `/16` différent par serveur pour rester isolés entre eux.
`nextHostId` est incrémenté automatiquement par la Cloud Function à chaque
nouvelle attribution.

### `vpnClients/{serverId}_{uid}` — jamais lu/écrit par un client

```json
{
  "uid": "abc123",
  "serverId": "france-01",
  "clientPublicKey": "base64...",
  "address": "10.66.0.5",
  "presharedKey": "base64...",
  "revoked": false,
  "synced": false,
  "createdAt": "..."
}
```

C'est ce document que lit `server-agent/aet-vpn-agent.py` pour appliquer
(`synced:false` → applique puis passe à `true`) ou retirer
(`revoked:true`) le peer correspondant.

### Règles de sécurité

Fournies telles quelles dans `firestore.rules` à la racine du projet
(à déployer avec `firebase deploy --only firestore:rules`) : `vpnServers`
lisible par tout utilisateur authentifié mais jamais modifiable côté client,
`vpnUsers/{uid}` réservé à son propriétaire, `vpnAllocations` et
`vpnClients` totalement fermés aux clients (seuls la Cloud Function et
l'agent, via Admin SDK / compte de service, y accèdent).

## 4. Déploiement — étapes concrètes

1. **Avoir de vrais serveurs WireGuard** (les vôtres ou un fournisseur) —
   rien ici ne crée de serveur, seulement la coordination autour.
2. Pour chaque serveur : créer `vpnServers/{id}` et `vpnAllocations/{id}`
   (voir schémas ci-dessus).
3. Installer l'agent sur chaque serveur :
   `pip install -r server-agent/requirements.txt`, créer un compte de
   service Firebase **dédié** à l'agent avec un rôle IAM minimal (évitez
   `Editor`/`Owner`), placer la clé JSON avec des permissions `600`,
   renseigner `AET_VPN_SERVER_ID` (doit correspondre exactement à l'id du
   document `vpnServers`), copier `aet-vpn-agent.service` dans
   `/etc/systemd/system/`, ajuster les chemins, puis
   `systemctl enable --now aet-vpn-agent`.
4. Déployer le backend :
   `firebase use aet-tv-5d58c` (déjà référencé dans `.firebaserc`), puis
   `cd functions && npm install && cd .. && firebase deploy --only
   functions,firestore:rules`.
5. Ajouter au moins un document de test dans `vpnServers/` et son
   `vpnAllocations/` correspondant.
6. Builder l'app Android, installer sur un device réel (le VPN Android ne
   fonctionne pas dans certains émulateurs sans configuration réseau
   spécifique) et tester : connexion, déconnexion, refus d'autorisation,
   perte réseau, lecture IPTV pendant que le VPN est connecté.

Je n'ai pas pu compiler l'app Android ni déployer/exécuter ces fonctions
dans cet environnement (pas de SDK Android, pas d'accès réseau sortant, pas
de projet Firebase réel accessible ici) : relis le code avant de déployer,
et vérifie la dernière version de `com.wireguard.android:tunnel` sur Maven
Central avant de builder (`1.0.20230706` utilisé ici à titre de référence).

## 5. Déployer via GitHub Actions (recommandé, sans rien exécuter ici)

Le repo a deux workflows :

- `.github/workflows/build-android.yml` — déjà présent, build l'APK debug et
  publie la release "latest-debug". Il utilise `secrets.GITHUB_TOKEN`, le
  jeton automatique fourni par GitHub Actions à chaque run — **pas** besoin
  d'en créer un pour ça.
- `.github/workflows/deploy-firebase.yml` — nouveau, déploie
  `functions/` + `firestore.rules` à chaque push sur `main`.

⚠️ Un jeton GitHub (Personal Access Token) sert à pousser du code / gérer le
repo — il ne permet PAS de déployer sur Firebase/Google Cloud. Pour
`deploy-firebase.yml`, il faut un **compte de service Google Cloud** séparé :

1. Console Google Cloud → IAM & Admin → Comptes de service → créer un
   compte (ex. `github-deployer`) sur le projet `aet-tv-5d58c`, avec les
   rôles : `Cloud Functions Admin`, `Firebase Rules Admin`,
   `Service Account User`, `Cloud Datastore Owner` (ou plus restrictif si tu
   préfères affiner ensuite).
2. Générer une clé JSON pour ce compte.
3. Dans le repo GitHub → Settings → Secrets and variables → Actions →
   New repository secret → nom `FIREBASE_SERVICE_ACCOUNT_KEY`, valeur = le
   contenu du fichier JSON (jamais commité, jamais collé dans une
   conversation).
4. Pousser ce zip (ou son contenu) sur `main` : le déploiement se lance tout
   seul dès que `functions/` ou `firestore.rules` changent, ou manuellement
   via l'onglet Actions → "Deploy Firebase" → "Run workflow".

Alternative si tu préfères déployer depuis ta machine plutôt que par CI :

```bash
npm install -g firebase-tools
firebase login
firebase use aet-tv-5d58c
cd functions && npm install && cd ..
firebase deploy --only functions,firestore:rules
```

## 6. Ce qui n'est PAS fait (volontairement)

- Pas de transformation des proxies IPTV (`direct/proxy1/proxy2/proxy3`) en
  VPN : ce sont deux systèmes séparés, comme demandé.
- Pas de Kill Switch actif (section 17 du brief) : ce point demande des
  tests réels sur device avant d'être présenté comme fonctionnel.
- Pas de génération automatique de serveurs/infrastructure : `vpnServers`,
  `vpnAllocations`, et les machines WireGuard elles-mêmes restent à créer et
  gérer par vous (ou un fournisseur).
- `android/app/src/main/assets/web/index-204.html` (page de secours
  hors-ligne) n'a pas reçu l'écran VPN : ce fichier a déjà dérivé de
  `index.html` sur d'autres fonctionnalités (Historique, Override admin) —
  dites-moi si vous voulez d'abord réaligner les deux avant d'y répliquer
  l'écran VPN.
