(function () {
  if (window.__aetVpnBridgeInstalled) return;
  window.__aetVpnBridgeInstalled = true;

  function hasBridge() {
    return !!(window.AetVpnAndroid && typeof window.AetVpnAndroid.connectVpn === 'function');
  }

  var listeners = [];

  function emit(event) {
    listeners.forEach(function (fn) {
      try { fn(event); } catch (e) { /* un listener cassé ne doit pas bloquer les autres */ }
    });
  }

  // Appelé par MainActivity.dispatchVpnEvent() côté natif.
  window.__onAetVpnEvent = function (jsonString) {
    var payload;
    try {
      payload = JSON.parse(jsonString);
    } catch (e) {
      return;
    }
    emit(payload);
  };

  window.AETVPN = {
    /** true si le pont natif est disponible (toujours vrai dans l'app Android, faux sur le web classique). */
    isAvailable: hasBridge,

    /** Lance la connexion vers le serveur donné (id Firestore, ex. "france-01"). */
    connect: function (serverId) {
      if (!hasBridge() || !serverId) return false;
      window.AetVpnAndroid.connectVpn(String(serverId));
      return true;
    },

    disconnect: function () {
      if (!hasBridge()) return false;
      window.AetVpnAndroid.disconnectVpn();
      return true;
    },

    isConnected: function () {
      if (!hasBridge()) return false;
      return !!window.AetVpnAndroid.isVpnConnected();
    },

    /** Retourne un objet { state, server, vpnIp, durationSeconds, error }. */
    status: function () {
      if (!hasBridge()) return null;
      try { return JSON.parse(window.AetVpnAndroid.getVpnStatus()); } catch (e) { return null; }
    },

    currentServer: function () {
      if (!hasBridge()) return null;
      try { return JSON.parse(window.AetVpnAndroid.getCurrentServer()); } catch (e) { return null; }
    },

    connectionDuration: function () {
      if (!hasBridge()) return 0;
      return window.AetVpnAndroid.getConnectionDuration();
    },

    /**
     * Demande la liste des serveurs. La réponse immédiate est toujours vide ([]) :
     * le résultat réel arrive de façon asynchrone via onEvent({ type: 'servers', servers }).
     */
    servers: function () {
      if (!hasBridge()) return [];
      try { return JSON.parse(window.AetVpnAndroid.getServers()); } catch (e) { return []; }
    },

    /** S'abonne aux évènements { type: 'status' | 'servers', ... }. Retourne une fonction de désabonnement. */
    onEvent: function (callback) {
      if (typeof callback !== 'function') return function () {};
      listeners.push(callback);
      return function () {
        listeners = listeners.filter(function (fn) { return fn !== callback; });
      };
    }
  };
})();
