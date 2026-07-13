/* ============================================================
 * huhu-watch-live-menu-open.js — version simplifiée compatible
 * ------------------------------------------------------------
 * Script optionnel pour huhu.to/watch?live=...
 * Garde le panneau latéral visible sur grand écran.
 * ============================================================ */
(function () {
  'use strict';

  const STYLE_ID = 'aet-watch-live-menu-style-v3';

  function isLiveWatchPage() {
    return location.pathname === '/watch' && !!new URLSearchParams(location.search).get('live');
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      @media (min-width: 1100px) {
        .view-watch-live { padding-right: 360px !important; }
        .lc {
          position: fixed !important;
          top: 80px !important;
          right: 0 !important;
          left: auto !important;
          bottom: 0 !important;
          width: 360px !important;
          transform: none !important;
          visibility: visible !important;
          opacity: 1 !important;
          z-index: 20 !important;
          background: #0f172a !important;
          overflow: auto !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function boot() {
    if (!isLiveWatchPage()) return;
    injectStyle();
  }

  boot();
  window.addEventListener('popstate', boot);
  setInterval(boot, 1500);
})();
