/* ============================================================
 * huhu-stream-home-integration.js — v4
 * ------------------------------------------------------------
 * Userscript optionnel pour huhu.to
 * Ajoute une carte AET sur la page d'accueil avec favoris locaux.
 * ============================================================ */
(function () {
  'use strict';

  const ROOT_ID = 'aet-home-card-v4';
  const STORAGE_KEY = 'aet_v4_fav';

  function safeJsonParse(value, fallback) {
    try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
  }

  function getFavorites() {
    return safeJsonParse(localStorage.getItem(STORAGE_KEY), []);
  }

  function createCard() {
    if (document.getElementById(ROOT_ID)) return;

    const host = document.querySelector('main') || document.body;
    if (!host) return;

    const favorites = getFavorites();
    const card = document.createElement('section');
    card.id = ROOT_ID;
    card.style.cssText = [
      'margin:16px 0',
      'padding:16px',
      'border-radius:18px',
      'background:linear-gradient(135deg,#8e0610,#b30814)',
      'color:#fff',
      'box-shadow:0 10px 24px rgba(0,0,0,.18)'
    ].join(';');

    card.innerHTML = `
      <div style="font-weight:800;font-size:18px;margin-bottom:8px">ALBAN ELOH TECHNOLOGIE</div>
      <div style="font-size:13px;opacity:.92;margin-bottom:12px">Panneau rapide AET V4</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        <a href="/" style="background:#fff;color:#8e0610;padding:10px 14px;border-radius:999px;font-weight:800;text-decoration:none">Ouvrir le site</a>
      </div>
      <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px">Favoris détectés : ${favorites.length}</div>
      <div style="display:grid;gap:8px">
        ${favorites.slice(0, 5).map(item => `
          <div style="background:rgba(255,255,255,.12);padding:10px 12px;border-radius:12px">
            <div style="font-weight:700">${String(item.name || item.title || 'Sans titre').replace(/</g,'&lt;')}</div>
            <div style="font-size:12px;opacity:.85;word-break:break-all">${String(item.url || '').replace(/</g,'&lt;')}</div>
          </div>
        `).join('') || '<div style="font-size:13px;opacity:.9">Aucun favori local trouvé.</div>'}
      </div>
    `;

    host.prepend(card);
  }

  function boot() {
    createCard();
  }

  boot();
  setInterval(boot, 2000);
})();
