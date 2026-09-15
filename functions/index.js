/**
 * AET VPN — Backend de provisioning des clients WireGuard.
 *
 * Ce fichier NE contient aucune primitive cryptographique WireGuard.
 * Son unique rôle : attribuer à chaque (utilisateur, serveur) une adresse IP
 * interne unique et une preshared key aléatoire, et exposer cette
 * information UNIQUEMENT au propriétaire du compte (vérifié via son
 * Firebase ID token).
 *
 * L'ajout réel du peer sur le serveur WireGuard (commande `wg set ...`) est
 * fait par un agent séparé qui tourne SUR le serveur VPN lui-même
 * (voir /server-agent/aet-vpn-agent.py) : cette fonction ne se connecte
 * jamais en SSH ni n'exécute de commande sur un serveur VPN. L'app Android
 * n'a donc jamais, à aucun moment, un accès administratif aux serveurs.
 *
 * Contrat HTTP (voir VpnRepository.kt côté Android) :
 *   POST /provisionVpnClient
 *   Headers: Authorization: Bearer <Firebase ID token>
 *   Body:    { "serverId": "france-01", "clientPublicKey": "base64..." }
 *   200:     { "clientAddress": "10.66.0.5/32", "presharedKey": "base64..." }
 *   4xx/5xx: { "error": "message" }
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();
const db = admin.firestore();

const MAX_HOST_ID = 65534; // limite d'une allocation /16 (voir allocateAddress)

/**
 * Convertit "10.66.0.0/16" + un compteur entier en adresse IP dans ce
 * sous-réseau. Ne gère que des masques /16 (suffisant pour un pool par
 * serveur ; à étendre si un serveur a besoin de plus de ~65k clients).
 */
function hostIdToAddress(subnetBase, hostId) {
  const [base] = subnetBase.split("/");
  const octets = base.split(".").map(Number);
  if (octets.length !== 4 || octets.some((o) => Number.isNaN(o))) {
    throw new Error(`subnetBase invalide: ${subnetBase}`);
  }
  const highByte = (hostId >> 8) & 0xff;
  const lowByte = hostId & 0xff;
  return `${octets[0]}.${octets[1]}.${(octets[2] + highByte) & 0xff}.${lowByte}`;
}

function isValidBase64Key(value) {
  return typeof value === "string" && /^[A-Za-z0-9+/]{42,44}=?$/.test(value.trim());
}

async function authenticate(req) {
  const header = req.get("Authorization") || "";
  const match = header.match(/^Bearer (.+)$/);
  if (!match) {
    const err = new Error("Authorization manquant");
    err.statusCode = 401;
    throw err;
  }
  try {
    return await admin.auth().verifyIdToken(match[1]);
  } catch (e) {
    const err = new Error("Token invalide");
    err.statusCode = 401;
    throw err;
  }
}

/**
 * Attribue (ou réutilise) une adresse IP tunnel pour (uid, serverId), et une
 * preshared key stable. Idempotent : un même utilisateur qui reconnecte
 * garde toujours la même adresse pour un serveur donné, seule la clé
 * publique enregistrée est mise à jour si l'appareil en a changé.
 */
async function allocateClientForServer(uid, serverId, clientPublicKey) {
  const serverRef = db.collection("vpnServers").doc(serverId);
  const allocationRef = db.collection("vpnAllocations").doc(serverId);
  const clientRef = db.collection("vpnClients").doc(`${serverId}_${uid}`);

  return db.runTransaction(async (tx) => {
    const [serverSnap, clientSnap] = await Promise.all([
      tx.get(serverRef),
      tx.get(clientRef),
    ]);

    if (!serverSnap.exists || serverSnap.get("active") === false) {
      const err = new Error("Serveur indisponible");
      err.statusCode = 404;
      throw err;
    }

    // Déjà provisionné pour ce serveur : on renvoie la même adresse, on met
    // juste à jour la clé publique (l'agent appliquera le changement de clé
    // sur le serveur au prochain cycle de sync).
    if (clientSnap.exists) {
      const data = clientSnap.data();
      if (data.clientPublicKey !== clientPublicKey) {
        tx.update(clientRef, {
          clientPublicKey,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          synced: false,
        });
      }
      return { address: data.address, presharedKey: data.presharedKey || null };
    }

    // Sous-réseau du serveur : configuré par l'admin dans vpnAllocations/{serverId}.
    // subnetBase par défaut si absent : dérivé du serveur pour rester isolé
    // d'un serveur à l'autre (10.<index>.0.0/16) — à ajuster manuellement si
    // besoin d'un plan d'adressage précis.
    const allocationSnap = await tx.get(allocationRef);
    let subnetBase = allocationSnap.exists ? allocationSnap.get("subnetBase") : null;
    let nextHostId = allocationSnap.exists ? allocationSnap.get("nextHostId") : null;

    if (!subnetBase) {
      const err = new Error(
        `vpnAllocations/${serverId} doit exister avec un champ 'subnetBase' ` +
          `(ex: "10.66.0.0/16") avant de pouvoir provisionner ce serveur.`
      );
      err.statusCode = 500;
      throw err;
    }
    if (typeof nextHostId !== "number") nextHostId = 2; // .0 = réseau, .1 = serveur

    if (nextHostId > MAX_HOST_ID) {
      const err = new Error("Pool d'adresses épuisé pour ce serveur");
      err.statusCode = 500;
      throw err;
    }

    const address = hostIdToAddress(subnetBase, nextHostId);
    const presharedKey = crypto.randomBytes(32).toString("base64");

    tx.set(allocationRef, { subnetBase, nextHostId: nextHostId + 1 }, { merge: true });
    tx.set(clientRef, {
      uid,
      serverId,
      clientPublicKey,
      address,
      presharedKey,
      revoked: false,
      synced: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { address, presharedKey };
  });
}

exports.provisionVpnClient = functions
  .region("us-central1")
  .https.onRequest(async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Méthode non autorisée" });
      return;
    }

    try {
      const decoded = await authenticate(req);
      const uid = decoded.uid;

      const { serverId, clientPublicKey } = req.body || {};
      if (typeof serverId !== "string" || !serverId.trim()) {
        res.status(400).json({ error: "serverId manquant" });
        return;
      }
      if (!isValidBase64Key(clientPublicKey)) {
        res.status(400).json({ error: "clientPublicKey invalide" });
        return;
      }

      // Gate simple, sans système de paiement (voir brief) : juste vérifier
      // que le compte n'est pas explicitement désactivé.
      const userSnap = await db.collection("vpnUsers").doc(uid).get();
      if (userSnap.exists && userSnap.get("active") === false) {
        res.status(403).json({ error: "Compte VPN désactivé" });
        return;
      }

      const { address, presharedKey } = await allocateClientForServer(
        uid,
        serverId.trim(),
        clientPublicKey.trim()
      );

      await db.collection("vpnUsers").doc(uid).set(
        {
          currentServer: serverId.trim(),
          lastConnection: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      res.status(200).json({
        clientAddress: `${address}/32`,
        presharedKey,
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;
      // Le détail technique reste dans les logs Cloud Functions, jamais dans
      // la réponse HTTP.
      functions.logger.error("provisionVpnClient a échoué", error);
      res.status(statusCode).json({
        error: statusCode === 401 ? "Non autorisé" : "Impossible de provisionner le client VPN",
      });
    }
  });

/**
 * Appelée par l'app (ou automatiquement, à brancher plus tard sur
 * disconnectVpn côté client) pour marquer un client comme révoqué :
 * l'agent supprimera alors le peer correspondant du serveur.
 */
exports.revokeVpnClient = functions
  .region("us-central1")
  .https.onRequest(async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Méthode non autorisée" });
      return;
    }
    try {
      const decoded = await authenticate(req);
      const { serverId } = req.body || {};
      if (typeof serverId !== "string" || !serverId.trim()) {
        res.status(400).json({ error: "serverId manquant" });
        return;
      }
      const clientRef = db.collection("vpnClients").doc(`${serverId.trim()}_${decoded.uid}`);
      await clientRef.set(
        { revoked: true, synced: false, revokedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
      res.status(200).json({ ok: true });
    } catch (error) {
      const statusCode = error.statusCode || 500;
      functions.logger.error("revokeVpnClient a échoué", error);
      res.status(statusCode).json({
        error: statusCode === 401 ? "Non autorisé" : "Impossible de révoquer le client VPN",
      });
    }
  });
