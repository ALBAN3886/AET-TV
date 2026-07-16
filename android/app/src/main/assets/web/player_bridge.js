(function () {
  if (window.__nativeIptvBridgeInstalled) return;
  window.__nativeIptvBridgeInstalled = true;

  function hasBridge() {
    return !!(window.NativePlayer && typeof window.NativePlayer.openPlayer === 'function');
  }

  function detectStreamType(url) {
    const value = String(url || '').toLowerCase();
    if (value.includes('.m3u8')) return 'hls';
    if (/\.(ts|mpegts|mp4|m4v|mov|webm)(\?|#|$)/.test(value)) return 'video';
    return 'embed';
  }

  function buildHeaders(item) {
    const headers = {};
    const referrer = item.referrer || item.httpReferrer || item.http_referrer || '';
    const userAgent = item.userAgent || item.user_agent || item['user-agent'] || '';
    const origin = item.origin || item.httpOrigin || '';
    const authorization = item.authorization || item.Authorization || item.auth || '';
    const cookie = item.cookie || '';

    if (referrer) headers['Referer'] = referrer;
    if (userAgent) headers['User-Agent'] = userAgent;
    if (origin) headers['Origin'] = origin;
    if (authorization) headers['Authorization'] = authorization;
    if (cookie) headers['Cookie'] = cookie;

    return headers;
  }

  function canUseNativePlayer(item) {
    if (!item || !item.url) return false;
    const type = item.detectedType || (typeof window.detectType === 'function' ? window.detectType(item.url) : detectStreamType(item.url));
    return type === 'hls' || type === 'video';
  }

  function openNativePlayer(item) {
    if (!hasBridge()) return false;

    const payload = {
      url: item.url,
      title: item.name || item.title || 'Chaîne',
      channelName: item.name || item.title || 'Chaîne',
      channelGroup: item.group || item.category || '',
      type: item.detectedType || (typeof window.detectType === 'function' ? window.detectType(item.url) : detectStreamType(item.url)),
      headers: buildHeaders(item)
    };

    window.NativePlayer.openPlayer(JSON.stringify(payload));
    return true;
  }

  function installPlayItemHook() {
    if (typeof window.playItem !== 'function' || window.__nativePlayItemWrapped) return;

    const originalPlayItem = window.playItem;
    window.__nativePlayItemWrapped = true;

    window.playItem = function (item) {
      if (canUseNativePlayer(item) && openNativePlayer(item)) {
        return;
      }
      return originalPlayItem.apply(this, arguments);
    };
  }

  installPlayItemHook();

  window.NativePlayerBridge = {
    openChannel: function (item) {
      if (!item || !item.url) return false;
      return openNativePlayer(item);
    },
    reinstall: installPlayItemHook
  };
})();
