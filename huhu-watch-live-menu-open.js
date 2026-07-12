/* ============================================================
 * huhu-watch-live-menu-open.js — v2 corrigée
 * ------------------------------------------------------------
 * Sur la page /watch?live=..., déplie automatiquement le menu
 * latéral (chaînes) sur écran large et le garde ouvert.
 * À charger comme userscript ou content-script sur huhu.to.
 * ============================================================ */
(function () {
  'use strict';

  const STYLE_ID = 'aet-watch-live-menu-style';

  function isLiveWatchPage() {
    return location.pathname === '/watch' &&
           !!new URLSearchParams(location.search).get('live');
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      @media (min-width: 1100px) {
        .view-watch-live { padding-right: 380px !important; }
        .lc {
          position: absolute !important;
          inset: 0 !important;
          pointer-events: none !important;
          z-index: 5 !important;
        }
        .lc-bar { pointer-events: auto !important; z-index: 6 !important; }
        .lc-backdrop { display: none !important; }
        .lc-panel {
          position: absolute !important;
          top: 0 !important; right: 0 !important; bottom: 0 !important;
          width: 360px !important;
          transform: translateX(0) !important;
          pointer-events: auto !important;
          box-shadow: -8px 0 24px rgba(0,0,0,.35) !important;
          z-index: 7 !important;
        }
        .lc-close { display: none !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function openMenu() {
    // huhu.to expose typiquement un bouton .lc-bar-btn ou similaire.
    const btn = document.querySelector('.lc-bar-btn, [data-open="live-channels"], .live-channels-toggle');
    if (btn && !document.querySelector('.lc-panel.open, .lc-panel[data-open="true"]')) {
      try { btn.click(); } catch {}
    }
    // On force aussi l'attribut ouvert au cas où
    document.querySelectorAll('.lc-panel').forEach(p => {
      p.classList.add('open');
      p.setAttribute('data-open', 'true');
    });
  }

  function apply() {
    if (!isLiveWatchPage()) return;
    injectStyle();
    document.body.classList.add('view-watch-live');
    openMenu();
  }

  // Réagit aux changements d'URL (SPA)
  let lastHref = location.href;
  const check = () => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      // On retire l'état si on n'est plus sur /watch?live=
      if (!isLiveWatchPage()) {
        document.body.classList.remove('view-watch-live');
      }
    }
    apply();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }

  // Observer les changements SPA
  const obs = new MutationObserver(check);
  obs.observe(document.body, { childList: true, subtree: true });

  // Support pushState/replaceState pour SPA
  ['pushState', 'replaceState'].forEach(fn => {
    const orig = history[fn];
    history[fn] = function () {
      const r = orig.apply(this, arguments);
      setTimeout(check, 50);
      return r;
    };
  });
  window.addEventListener('popstate', () => setTimeout(check, 50));
})();
