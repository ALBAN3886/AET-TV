#!/usr/bin/env python3
"""
AET VPN — agent de synchronisation des peers WireGuard.

À installer et exécuter UNIQUEMENT sur chaque serveur WireGuard (jamais dans
l'app Android, jamais dans la Cloud Function). Rôle unique : lire les
documents `vpnClients` qui concernent CE serveur et appliquer les commandes
`wg set` correspondantes. N'importe/ne réimplémente aucune primitive
cryptographique : il se contente d'appeler le binaire `wg` officiel.

Pré-requis sur le serveur :
  - wireguard-tools installé (`wg`, interface ex. wg0 déjà créée et up)
  - Python 3.9+
  - pip install google-cloud-firestore
  - Un compte de service Firebase dédié à CET agent, avec un rôle IAM minimal
    (Cloud Datastore User suffit ; évitez "Editor"/"Owner"). Le fichier de clé
    JSON reste sur le serveur, avec des permissions 600, jamais commité ni
    copié ailleurs.

Utilisation recommandée : cron toutes les 30-60 secondes, ou service
systemd avec une boucle interne (voir __main__ en bas).

Variables d'environnement attendues :
  AET_VPN_SERVER_ID              ex. "france-01" (doit correspondre à l'id
                                  du document vpnServers/{id} dans Firestore)
  AET_VPN_WG_INTERFACE            ex. "wg0" (défaut : wg0)
  GOOGLE_APPLICATION_CREDENTIALS  chemin vers la clé de service dédiée
"""

import os
import subprocess
import logging
import time

from google.cloud import firestore

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [AETVPN-AGENT] %(levelname)s %(message)s",
)
log = logging.getLogger("aet-vpn-agent")

SERVER_ID = os.environ.get("AET_VPN_SERVER_ID")
WG_INTERFACE = os.environ.get("AET_VPN_WG_INTERFACE", "wg0")
POLL_INTERVAL_SECONDS = int(os.environ.get("AET_VPN_POLL_SECONDS", "30"))


def run_wg(args):
    """Exécute `wg <args>` et journalise le résultat. Ne loggue jamais les clés en clair."""
    cmd = ["wg"] + args
    redacted = ["wg"] + ["<redacted>" if i > 0 and args[i - 1] in ("peer", "preshared-key") else a
                          for i, a in enumerate(args)]
    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True)
        log.info("Commande appliquée: %s", " ".join(redacted))
        return True
    except subprocess.CalledProcessError as exc:
        log.error("Échec commande %s : %s", " ".join(redacted), exc.stderr.strip())
        return False


def apply_peer(client_doc):
    """Ajoute/actualise un peer WireGuard à partir d'un document vpnClients."""
    pubkey = client_doc.get("clientPublicKey")
    address = client_doc.get("address")
    psk = client_doc.get("presharedKey")
    if not pubkey or not address:
        log.warning("Document client incomplet, ignoré: %s", client_doc.get("id"))
        return False

    args = ["set", WG_INTERFACE, "peer", pubkey, "allowed-ips", f"{address}/32"]
    if psk:
        # `wg set` accepte un fichier ou "-" (stdin) pour la preshared key,
        # jamais en argument en clair sur la ligne de commande.
        proc = subprocess.run(
            ["wg", "set", WG_INTERFACE, "peer", pubkey, "allowed-ips", f"{address}/32",
             "preshared-key", "/dev/stdin"],
            input=psk + "\n",
            text=True,
            capture_output=True,
        )
        if proc.returncode != 0:
            log.error("Échec ajout peer (avec PSK): %s", proc.stderr.strip())
            return False
        log.info("Peer synchronisé (avec PSK) — allowed-ips=%s/32", address)
        return True

    return run_wg(args)


def remove_peer(client_doc):
    pubkey = client_doc.get("clientPublicKey")
    if not pubkey:
        return True
    return run_wg(["set", WG_INTERFACE, "peer", pubkey, "remove"])


def sync_once(db: firestore.Client):
    if not SERVER_ID:
        raise RuntimeError("AET_VPN_SERVER_ID n'est pas défini")

    query = (
        db.collection("vpnClients")
        .where("serverId", "==", SERVER_ID)
        .where("synced", "==", False)
    )

    docs = list(query.stream())
    if not docs:
        log.debug("Rien à synchroniser.")
        return

    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        ok = remove_peer(data) if data.get("revoked") else apply_peer(data)
        if ok:
            doc.reference.set(
                {"synced": True, "syncedAt": firestore.SERVER_TIMESTAMP}, merge=True
            )


def main():
    db = firestore.Client()
    log.info(
        "Agent AET VPN démarré pour le serveur '%s' (interface %s, intervalle %ss)",
        SERVER_ID, WG_INTERFACE, POLL_INTERVAL_SECONDS,
    )
    while True:
        try:
            sync_once(db)
        except Exception:  # noqa: BLE001 — on ne veut jamais que l'agent crashe silencieusement
            log.exception("Erreur pendant la synchronisation")
        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
