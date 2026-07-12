/* ============================================================
 * Huhu.to — Home integration (AET Stream) — v2 corrigée
 * ------------------------------------------------------------
 * À injecter en tant que userscript ou content-script sur
 * https://huhu.to/*  (via Tampermonkey / une extension).
 *
 * Ajoute sur la page d'accueil huhu.to un panneau AET Stream
 * qui :
 *   - liste les chaînes/films/séries mis en favoris
 *   - permet de lire un flux HLS/MP4 directement dans huhu.to
 *   - synchronise la bibliothèque avec le site AET Stream
 *     (mêmes clés localStorage que l'index.html principal)
 * ============================================================ */
(function () {
  'use strict';

  const STYLE_ID   = 'aet-huhu-stream-style';
  const ROOT_ID    = 'aet-huhu-stream-root';
  const STORAGE_KEY = 'aet_stream_library_v2';   // aligné avec index.html
  const LAST_KEY    = 'aet_stream_last_v2';

  // ---------- utils ----------
  function safeJsonParse(value, fallback) {
    try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
  }
  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }
  function detectType(url) {
    const v = String(url || '').toLowerCase();
    if (v.includes('youtube.com') || v.includes('youtu.be')) return 'youtube';
    if (v.includes('vimeo.com')) return 'vimeo';
    if (v.includes('.m3u8')) return 'hls';
    if (v.match(/\.(mp4|webm|ogg)(\?|#|$)/)) return 'video';
    if (v.includes('/watch') || v.includes('/embed') || v.includes('/live')) return 'embed';
    return 'video';
  }
  function normalizeTitle(url, title) {
    if (title && title.trim()) return title.trim();
    try {
      const u = new URL(url);
      const file = u.pathname.split('/').filter(Boolean).pop();
      return file || u.hostname || 'Flux';
    } catch { return 'Flux'; }
  }
  function escapeHtml(v) {
    return String(v).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
  }
  function getLibrary() { return safeJsonParse(localStorage.getItem(STORAGE_KEY), []); }
  function saveLibrary(items) { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }
  function setLastPlayed(item){ localStorage.setItem(LAST_KEY, JSON.stringify(item)); }

  // ---------- hls.js loader ----------
  function ensureHls(cb) {
    if (window.Hls) return cb();
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/hls.js@1';
    s.onload = cb;
    s.onerror = () => console.warn('[AET] hls.js failed to load');
    document.head.appendChild(s);
  }

  // ---------- style ----------
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID}{margin:18px 0 28px;font-family:Inter,system-ui,sans-serif;color:#eef2ff}
      #${ROOT_ID} .aet-wrap{background:linear-gradient(180deg,#121933,#0b1020);border:1px solid rgba(148,163,184,.18);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.35);overflow:hidden}
      #${ROOT_ID} .aet-head{display:flex;justify-content:space-between;align-items:end;gap:16px;padding:18px 20px 14px;border-bottom:1px solid rgba(148,163,184,.18);flex-wrap:wrap}
      #${ROOT_ID} .aet-kicker{font-size:.78rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#4f8ef7;margin-bottom:6px}
      #${ROOT_ID} .aet-title{font-size:1.45rem;font-weight:800;letter-spacing:-.02em;margin:0}
      #${ROOT_ID} .aet-sub{font-size:.92rem;color:#9aa7c7;margin-top:6px;max-width:780px}
      #${ROOT_ID} .aet-layout{display:grid;grid-template-columns:minmax(0,1.1fr) 340px;gap:16px;padding:16px 20px 20px}
      #${ROOT_ID} .aet-card{background:rgba(255,255,255,.03);border:1px solid rgba(148,163,184,.18);border-radius:12px}
      #${ROOT_ID} .aet-player-card{padding:16px}
      #${ROOT_ID} .aet-fields{display:grid;grid-template-columns:1.4fr .8fr;gap:10px;margin-bottom:10px}
      #${ROOT_ID} .aet-field{display:flex;flex-direction:column;gap:6px}
      #${ROOT_ID} .aet-label{font-size:.74rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#9aa7c7}
      #${ROOT_ID} input,#${ROOT_ID} select{min-height:42px;padding:10px 12px;border-radius:10px;border:1px solid rgba(148,163,184,.18);background:rgba(11,16,32,.55);color:#eef2ff;outline:none;font:inherit}
      #${ROOT_ID} input:focus,#${ROOT_ID} select:focus{border-color:#4f8ef7;box-shadow:0 0 0 3px rgba(79,142,247,.16)}
      #${ROOT_ID} .aet-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
      #${ROOT_ID} .aet-btn{border:none;cursor:pointer;border-radius:10px;min-height:40px;padding:0 14px;font-weight:800;color:#fff;display:inline-flex;align-items:center;gap:8px}
      #${ROOT_ID} .aet-btn.primary{background:linear-gradient(135deg,#4f8ef7,#7c3aed)}
      #${ROOT_ID} .aet-btn.ghost{background:rgba(255,255,255,.05);color:#eef2ff;border:1px solid rgba(148,163,184,.18)}
      #${ROOT_ID} .aet-btn.danger{background:rgba(239,68,68,.14);color:#fecaca;border:1px solid rgba(239,68,68,.24)}
      #${ROOT_ID} .aet-btn.success{background:linear-gradient(135deg,#10b981,#059669)}
      #${ROOT_ID} .aet-frame{border-radius:12px;overflow:hidden;border:1px solid rgba(148,163,184,.18);background:#020617;aspect-ratio:16/9;display:flex;align-items:center;justify-content:center;margin-top:10px}
      #${ROOT_ID} .aet-frame video,#${ROOT_ID} .aet-frame iframe{width:100%;height:100%;border:0;background:#000}
      #${ROOT_ID} .aet-placeholder{padding:20px;text-align:center;color:#9aa7c7}
      #${ROOT_ID} .aet-lib{padding:16px}
      #${ROOT_ID} .aet-list{display:flex;flex-direction:column;gap:8px;max-height:420px;overflow:auto}
      #${ROOT_ID} .aet-item{padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05)}
      #${ROOT_ID} .aet-item-title{font-weight:700;font-size:.95rem}
      #${ROOT_ID} .aet-item-sub{font-size:.75rem;color:#9aa7c7;word-break:break-all;margin-top:2px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
      #${ROOT_ID} .aet-item-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
      #${ROOT_ID} .aet-mini{min-height:32px;padding:0 10px;font-size:.8rem;border-radius:8px;font-weight:700;border:none;cursor:pointer}
      #${ROOT_ID} .aet-empty{padding:16px;color:#9aa7c7;text-align:center;border:1px dashed rgba(148,163,184,.24);border-radius:10px}
      #${ROOT_ID} .aet-hidden{display:none !important}
      @media (max-width:1000px){#${ROOT_ID} .aet-layout{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  // ---------- state ----------
  let hlsInstance = null;
  let library = [];

  // ---------- lecture ----------
  function stopPlayback(root) {
    const v = root.querySelector('.aet-video');
    const i = root.querySelector('.aet-embed');
    const p = root.querySelector('.aet-placeholder');
    if (hlsInstance) { try { hlsInstance.destroy(); } catch{} hlsInstance = null; }
    if (v) { try { v.pause(); } catch{} v.removeAttribute('src'); v.classList.add('aet-hidden'); }
    if (i) { i.removeAttribute('src'); i.classList.add('aet-hidden'); }
    if (p) p.classList.remove('aet-hidden');
  }

  function playInto(root, item) {
    const v = root.querySelector('.aet-video');
    const i = root.querySelector('.aet-embed');
    const p = root.querySelector('.aet-placeholder');
    stopPlayback(root);
    const type = item.type && item.type !== 'auto' ? item.type : detectType(item.url);

    if (type === 'hls') {
      ensureHls(() => {
        v.classList.remove('aet-hidden'); p.classList.add('aet-hidden');
        if (window.Hls && window.Hls.isSupported()) {
          hlsInstance = new window.Hls({ enableWorker: true });
          hlsInstance.loadSource(item.url);
          hlsInstance.attachMedia(v);
          hlsInstance.on(window.Hls.Events.MANIFEST_PARSED, () => v.play().catch(()=>{}));
        } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
          v.src = item.url; v.play().catch(()=>{});
        }
      });
    } else if (type === 'youtube') {
      const id = extractYouTubeId(item.url);
      i.classList.remove('aet-hidden'); p.classList.add('aet-hidden');
      i.src = id ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0` : item.url;
    } else if (type === 'vimeo') {
      const id = extractVimeoId(item.url);
      i.classList.remove('aet-hidden'); p.classList.add('aet-hidden');
      i.src = id ? `https://player.vimeo.com/video/${id}?autoplay=1` : item.url;
    } else if (type === 'embed') {
      i.classList.remove('aet-hidden'); p.classList.add('aet-hidden');
      i.src = item.url;
    } else {
      v.classList.remove('aet-hidden'); p.classList.add('aet-hidden');
      v.src = item.url; v.play().catch(()=>{});
    }
    setLastPlayed(item);
  }

  function extractYouTubeId(url) {
    try {
      const u = new URL(url);
      if (u.hostname.includes('youtu.be')) return u.pathname.split('/').filter(Boolean)[0];
      if (u.searchParams.get('v')) return u.searchParams.get('v');
      if (u.pathname.startsWith('/embed/')) return u.pathname.split('/embed/')[1];
    } catch {}
    return '';
  }
  function extractVimeoId(url) {
    try { return new URL(url).pathname.split('/').filter(Boolean).pop(); } catch { return ''; }
  }

  // ---------- rendu ----------
  function renderLibrary(root) {
    const list = root.querySelector('.aet-list');
    library = getLibrary();
    if (!library.length) {
      list.innerHTML = '<div class="aet-empty">Aucun favori. Ajoutez un lien via le formulaire.</div>';
      return;
    }
    list.innerHTML = library.map(it => `
      <div class="aet-item">
        <div class="aet-item-title">${escapeHtml(it.title)}</div>
        <div class="aet-item-sub">${escapeHtml(it.url)}</div>
        <div class="aet-item-actions">
          <button class="aet-mini aet-btn primary" data-play="${it.id}">▶ Lire</button>
          <button class="aet-mini aet-btn ghost"   data-fill="${it.id}">✎ Charger</button>
          <button class="aet-mini aet-btn danger"  data-del="${it.id}">✕</button>
        </div>
      </div>
    `).join('');
  }

  // ---------- panneau ----------
  function buildPanel() {
    const wrap = document.createElement('div');
    wrap.id = ROOT_ID;
    wrap.innerHTML = `
      <div class="aet-wrap">
        <div class="aet-head">
          <div>
            <div class="aet-kicker">AET Stream sur huhu.to</div>
            <h2 class="aet-title">Lecteur intégré &amp; favoris</h2>
            <p class="aet-sub">Collez une URL HLS (.m3u8), MP4/WebM ou un embed YouTube/Vimeo. La bibliothèque locale est partagée avec l'application AET Stream principale.</p>
          </div>
        </div>
        <div class="aet-layout">
          <div class="aet-card aet-player-card">
            <div class="aet-fields">
              <div class="aet-field">
                <label class="aet-label" for="aet-url">URL du flux</label>
                <input id="aet-url" type="url" placeholder="https://.../playlist.m3u8" />
              </div>
              <div class="aet-field">
                <label class="aet-label" for="aet-type">Type</label>
                <select id="aet-type">
                  <option value="auto">Détection automatique</option>
                  <option value="hls">HLS (.m3u8)</option>
                  <option value="video">Vidéo directe</option>
                  <option value="youtube">YouTube</option>
                  <option value="vimeo">Vimeo</option>
                  <option value="embed">Embed / Iframe</option>
                </select>
              </div>
            </div>
            <div class="aet-fields" style="grid-template-columns:1fr">
              <div class="aet-field">
                <label class="aet-label" for="aet-title">Titre</label>
                <input id="aet-title" type="text" placeholder="Nom de la chaîne / du contenu" />
              </div>
            </div>
            <div class="aet-row">
              <button class="aet-btn primary" data-act="play">▶ Lire</button>
              <button class="aet-btn success" data-act="save">＋ Enregistrer</button>
              <button class="aet-btn ghost"   data-act="reset">Réinitialiser</button>
              <button class="aet-btn ghost"   data-act="stop">■ Stop</button>
            </div>
            <div class="aet-frame">
              <div class="aet-placeholder">📺 Prêt à lire — collez une URL pour démarrer</div>
              <video class="aet-video aet-hidden" controls playsinline></video>
              <iframe class="aet-embed aet-hidden" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
            </div>
          </div>

          <div class="aet-card aet-lib">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px">
              <div>
                <div class="aet-kicker" style="margin-bottom:2px">Bibliothèque</div>
                <div style="font-weight:800">Mes favoris</div>
              </div>
              <button class="aet-mini aet-btn danger" data-act="clear-lib">Tout effacer</button>
            </div>
            <div class="aet-list"></div>
          </div>
        </div>
      </div>
    `;
    return wrap;
  }

  // ---------- attachement DOM ----------
  function mount() {
    if (document.getElementById(ROOT_ID)) return;
    injectStyle();
    const root = buildPanel();

    // On essaie de l'insérer sous la nav principale de huhu.to.
    const target = document.querySelector('main') || document.querySelector('#root') || document.body;
    target.prepend(root);

    // Bind boutons
    root.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      const playId = e.target.closest('[data-play]')?.dataset.play;
      const fillId = e.target.closest('[data-fill]')?.dataset.fill;
      const delId  = e.target.closest('[data-del]')?.dataset.del;

      if (act === 'play') {
        const url = root.querySelector('#aet-url').value.trim();
        if (!url) return alert('Entrez une URL.');
        const item = {
          id: uid(),
          url,
          title: normalizeTitle(url, root.querySelector('#aet-title').value),
          type: root.querySelector('#aet-type').value
        };
        playInto(root, item);
      }
      if (act === 'save') {
        const url = root.querySelector('#aet-url').value.trim();
        if (!url) return alert('Entrez une URL avant d\'enregistrer.');
        const lib = getLibrary();
        if (lib.find(x => x.url === url)) return alert('Déjà dans la bibliothèque.');
        lib.unshift({
          id: uid(),
          url,
          title: normalizeTitle(url, root.querySelector('#aet-title').value),
          type: root.querySelector('#aet-type').value,
          addedAt: Date.now()
        });
        saveLibrary(lib);
        renderLibrary(root);
      }
      if (act === 'reset') {
        root.querySelector('#aet-url').value = '';
        root.querySelector('#aet-title').value = '';
        root.querySelector('#aet-type').value = 'auto';
      }
      if (act === 'stop') stopPlayback(root);
      if (act === 'clear-lib') {
        if (!confirm('Vider toute la bibliothèque ?')) return;
        saveLibrary([]);
        renderLibrary(root);
      }

      if (playId) {
        const it = getLibrary().find(x => x.id === playId);
        if (it) playInto(root, it);
      }
      if (fillId) {
        const it = getLibrary().find(x => x.id === fillId);
        if (it) {
          root.querySelector('#aet-url').value = it.url;
          root.querySelector('#aet-title').value = it.title;
          root.querySelector('#aet-type').value = it.type || 'auto';
        }
      }
      if (delId) {
        saveLibrary(getLibrary().filter(x => x.id !== delId));
        renderLibrary(root);
      }
    });

    renderLibrary(root);
  }

  // huhu.to est une SPA : on remonte si le DOM est remplacé
  function autoMount() {
    mount();
    const obs = new MutationObserver(() => {
      if (!document.getElementById(ROOT_ID)) mount();
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMount);
  } else {
    autoMount();
  }
})();
