(function () {
  const STYLE_ID = 'aet-watch-live-menu-style';

  function isLiveWatchPage() {
    return location.pathname === '/watch' && !!new URLSearchParams(location.search).get('live');
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      @media (min-width: 1100px) {
        .view-watch-live {
          padding-right: 380px !important;
        }

        .lc {
          position: absolute !important;
          inset: 0 !important;
          pointer-events: none !important;
          z-index: 5 !important;
        }

        .lc-bar {
          pointer-events: auto !important;
          z-index: 6 !important;
        }

        .lc-backdrop {
          display: none !important;
        }

        .lc-panel {
          position: absolute !important;
          top: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 380px !important;
          max-width: 380px !important;
          transform: translateX(0) !important;
          border-left: 1px solid var(--border) !important;
          background: #101318f5 !important;
          backdrop-filter: blur(8px) !important;
          -webkit-backdrop-filter: blur(8px) !important;
          display: flex !important;
          z-index: 7 !important;
        }

        .lc-panel:not(.is-open) {
          transform: translateX(0) !important;
        }

        .lc-panel-close {
          display: none !important;
        }

        .lc.is-panel-open .lc-panel,
        .lc-panel.is-open {
          transform: translateX(0) !important;
        }
      }

      @media (max-width: 1099px) {
        .view-watch-live {
          padding-right: 0 !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function forcePanelOpen() {
    if (!isLiveWatchPage()) return false;

    const watchView = document.querySelector('.view-watch-live');
    const overlay = document.querySelector('.lc');
    const panel = document.querySelector('.lc-panel');

    if (!watchView || !overlay || !panel) return false;

    overlay.classList.add('is-panel-open');
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');

    const listBtn = document.querySelector(
      '.lc-btn[title="Channel list"], .lc-btn[aria-label="Channel list"]'
    );
    if (listBtn) listBtn.classList.add('is-on');

    return true;
  }

  function reapply() {
    injectStyle();
    forcePanelOpen();
  }

  function observeSpa() {
    const observer = new MutationObserver(() => {
      if (isLiveWatchPage()) {
        reapply();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  function hookHistory() {
    const rawPushState = history.pushState;
    history.pushState = function () {
      const result = rawPushState.apply(this, arguments);
      setTimeout(reapply, 50);
      setTimeout(reapply, 300);
      return result;
    };

    const rawReplaceState = history.replaceState;
    history.replaceState = function () {
      const result = rawReplaceState.apply(this, arguments);
      setTimeout(reapply, 50);
      setTimeout(reapply, 300);
      return result;
    };

    window.addEventListener('popstate', () => {
      setTimeout(reapply, 50);
      setTimeout(reapply, 300);
    });

    window.addEventListener('hashchange', () => {
      setTimeout(reapply, 50);
      setTimeout(reapply, 300);
    });
  }

  function boot() {
    injectStyle();

    const start = () => {
      reapply();
      observeSpa();
      hookHistory();
      setTimeout(reapply, 500);
      setTimeout(reapply, 1200);
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
      start();
    }
  }

  boot();
})();
      
