/* Huhu.to homepage integration for AET Stream */
(function () {
  const STYLE_ID = 'aet-huhu-stream-style';
  const ROOT_ID = 'aet-huhu-stream-root';
  const STORAGE_KEY = 'aet_huhu_stream_library_v1';
  const LAST_KEY = 'aet_huhu_stream_last_v1';

  function safeJsonParse(value, fallback) {
    try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
  }

  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }

  function detectType(url) {
    const value = String(url || '').toLowerCase();
    if (value.includes('youtube.com') || value.includes('youtu.be')) return 'youtube';
    if (value.includes('vimeo.com')) return 'vimeo';
    if (value.includes('.m3u8')) return 'hls';
    if (value.match(/\.(mp4|webm|ogg)(\?|#|$)/)) return 'video';
    return 'video';
  }

  function normalizeTitle(url, title) {
    if (title && title.trim()) return title.trim();
    try {
      const u = new URL(url);
      const file = u.pathname.split('/').filter(Boolean).pop();
      return file || u.hostname || 'Flux';
    } catch {
      return 'Flux';
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, s => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[s]));
  }

  function getLibrary() {
    return safeJsonParse(localStorage.getItem(STORAGE_KEY), []);
  }

  function saveLibrary(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function setLastPlayed(item) {
    localStorage.setItem(LAST_KEY, JSON.stringify(item));
  }

  function getLastPlayed() {
    return safeJsonParse(localStorage.getItem(LAST_KEY), null);
  }

  function ensureHls(cb) {
    if (window.Hls) return cb();
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
    script.onload = cb;
    document.head.appendChild(script);
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID}{margin:18px 0 28px}
      #${ROOT_ID} .aet-wrap{background:linear-gradient(180deg,var(--bg-2),var(--bg-1));border:1px solid var(--border);border-radius:14px;box-shadow:var(--shadow);overflow:hidden}
      #${ROOT_ID} .aet-head{display:flex;justify-content:space-between;align-items:end;gap:16px;padding:18px 20px 14px;border-bottom:1px solid var(--border);flex-wrap:wrap}
      #${ROOT_ID} .aet-kicker{font-size:.78rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);margin-bottom:6px}
      #${ROOT_ID} .aet-title{font-size:1.45rem;font-weight:800;letter-spacing:-.02em;color:var(--fg);margin:0}
      #${ROOT_ID} .aet-sub{font-size:.92rem;color:var(--fg-muted);margin-top:6px;max-width:780px}
      #${ROOT_ID} .aet-layout{display:grid;grid-template-columns:minmax(0,1.1fr) 340px;gap:16px;padding:16px 20px 20px}
      #${ROOT_ID} .aet-card{background:var(--bg-2);border:1px solid var(--border);border-radius:12px}
      #${ROOT_ID} .aet-player-card{padding:16px}
      #${ROOT_ID} .aet-fields{display:grid;grid-template-columns:1.4fr .8fr;gap:10px;margin-bottom:10px}
      #${ROOT_ID} .aet-field{display:flex;flex-direction:column;gap:6px}
      #${ROOT_ID} .aet-label{font-size:.74rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--fg-muted)}
      #${ROOT_ID} .aet-input,#${ROOT_ID} .aet-select{min-height:44px;border-radius:10px;border:1px solid var(--border);background:var(--bg-3);color:var(--fg);padding:10px 12px;outline:none}
      #${ROOT_ID} .aet-input:focus,#${ROOT_ID} .aet-select:focus{border-color:var(--accent)}
      #${ROOT_ID} .aet-actions,#${ROOT_ID} .aet-mini-actions,#${ROOT_ID} .aet-chip-row{display:flex;gap:8px;flex-wrap:wrap}
      #${ROOT_ID} .aet-chip{padding:8px 12px;border-radius:999px;background:var(--bg-3);border:1px solid var(--border);color:var(--fg);font-size:.82rem;font-weight:700}
      #${ROOT_ID} .aet-chip:hover{border-color:var(--accent)}
      #${ROOT_ID} .aet-btn{min-height:40px;padding:0 14px;border-radius:10px;border:1px solid var(--border);font-weight:700;display:inline-flex;align-items:center;justify-content:center;gap:8px;cursor:pointer}
      #${ROOT_ID} .aet-btn-primary{background:var(--accent);border-color:var(--accent);color:#fff}
      #${ROOT_ID} .aet-btn-primary:hover{background:var(--accent-2)}
      #${ROOT_ID} .aet-btn-secondary{background:var(--bg-3);color:var(--fg)}
      #${ROOT_ID} .aet-btn-danger{background:#eb2b5814;border-color:#eb2b5840;color:#ff9fb2}
      #${ROOT_ID} .aet-frame{margin-top:12px;aspect-ratio:16/9;background:#000;border:1px solid var(--border);border-radius:12px;overflow:hidden;display:flex;align-items:center;justify-content:center;position:relative}
      #${ROOT_ID} .aet-frame video,#${ROOT_ID} .aet-frame iframe{width:100%;height:100%;border:0;background:#000}
      #${ROOT_ID} .aet-placeholder{padding:22px;text-align:center;color:var(--fg-muted)}
      #${ROOT_ID} .aet-placeholder strong{display:block;color:var(--fg);font-size:1rem;margin-bottom:6px}
      #${ROOT_ID} .aet-meta{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px}
      #${ROOT_ID} .aet-meta-item{padding:12px;border-radius:10px;background:var(--bg-3);border:1px solid var(--border)}
      #${ROOT_ID} .aet-meta-k{font-size:.72rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--fg-muted);margin-bottom:6px}
      #${ROOT_ID} .aet-meta-v{font-size:.88rem;font-weight:700;color:var(--fg);word-break:break-word}
      #${ROOT_ID} .aet-lib-card{padding:14px}
      #${ROOT_ID} .aet-lib-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px}
      #${ROOT_ID} .aet-lib-title{font-size:1rem;font-weight:800;color:var(--fg)}
      #${ROOT_ID} .aet-lib-count{font-size:.8rem;color:var(--fg-muted)}
      #${ROOT_ID} .aet-search{width:100%;min-height:40px;border-radius:10px;border:1px solid var(--border);background:var(--bg-3);color:var(--fg);padding:10px 12px;outline:none;margin-bottom:10px}
      #${ROOT_ID} .aet-list{display:flex;flex-direction:column;gap:10px;max-height:600px;overflow:auto}
      #${ROOT_ID} .aet-item{padding:12px;border-radius:10px;background:var(--bg-3);border:1px solid var(--border)}
      #${ROOT_ID} .aet-item-title{font-size:.92rem;font-weight:800;color:var(--fg);line-height:1.35}
      #${ROOT_ID} .aet-item-url{font-size:.78rem;color:var(--fg-muted);margin-top:4px;word-break:break-all}
      #${ROOT_ID} .aet-tags{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 10px}
      #${ROOT_ID} .aet-tag{padding:4px 8px;border-radius:999px;border:1px solid var(--border);background:#ffffff08;color:var(--fg-muted);font-size:.72rem;font-weight:700}
      #${ROOT_ID} .aet-empty{padding:18px;border-radius:10px;border:1px dashed var(--border);text-align:center;color:var(--fg-muted)}
      #${ROOT_ID} .aet-hidden{display:none!important}
      @media (max-width: 980px){
        #${ROOT_ID} .aet-layout{grid-template-columns:1fr}
      }
      @media (max-width: 720px){
        #${ROOT_ID} .aet-head{padding:16px 14px 12px}
        #${ROOT_ID} .aet-layout{padding:12px 14px 14px}
        #${ROOT_ID} .aet-fields{grid-template-columns:1fr}
        #${ROOT_ID} .aet-meta{grid-template-columns:1fr}
      }
    `;
    document.head.appendChild(style);
  }

  function buildMarkup() {
    return `
      <section class="row" id="${ROOT_ID}">
        <div class="container">
          <div class="aet-wrap">
            <div class="aet-head">
              <div>
                <div class="aet-kicker">AET Stream intégré</div>
                <h2 class="aet-title">Regarder un flux directement depuis l’accueil</h2>
                <div class="aet-sub">Lecteur intégré compatible HLS (.m3u8), MP4/WebM et embeds YouTube/Vimeo, avec bibliothèque locale sauvegardée dans le navigateur.</div>
              </div>
              <div class="aet-mini-actions">
                <button class="aet-btn aet-btn-secondary" data-copy-current>Copier l’URL</button>
                <button class="aet-btn aet-btn-danger" data-clear-player>Vider</button>
              </div>
            </div>
            <div class="aet-layout">
              <div class="aet-card aet-player-card">
                <div class="aet-field" style="margin-bottom:10px">
                  <label class="aet-label">URL du flux</label>
                  <input class="aet-input" data-url type="url" placeholder="https://.../playlist.m3u8 ou https://.../video.mp4" />
                </div>
                <div class="aet-fields">
                  <div class="aet-field">
                    <label class="aet-label">Titre</label>
                    <input class="aet-input" data-title type="text" placeholder="Nom du flux" />
                  </div>
                  <div class="aet-field">
                    <label class="aet-label">Type</label>
                    <select class="aet-select" data-type>
                      <option value="auto">Détection automatique</option>
                      <option value="hls">HLS (.m3u8)</option>
                      <option value="video">Vidéo directe</option>
                      <option value="youtube">YouTube</option>
                      <option value="vimeo">Vimeo</option>
                    </select>
                  </div>
                </div>
                <div class="aet-chip-row" style="margin-bottom:10px">
                  <button class="aet-chip" data-example="https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8">Exemple HLS</button>
                  <button class="aet-chip" data-example="https://www.w3schools.com/html/mov_bbb.mp4">Exemple MP4</button>
                  <button class="aet-chip" data-example="https://www.youtube.com/watch?v=jNQXAC9IVRw">Exemple YouTube</button>
                </div>
                <div class="aet-actions">
                  <button class="aet-btn aet-btn-primary" data-play>Lire</button>
                  <button class="aet-btn aet-btn-secondary" data-save>Enregistrer</button>
                  <button class="aet-btn aet-btn-secondary" data-open-external>Ouvrir le flux</button>
                </div>
                <div class="aet-frame">
                  <div class="aet-placeholder" data-placeholder>
                    <strong>Lecteur prêt</strong>
                    Collez une URL autorisée puis lancez la lecture.
                  </div>
                  <video class="aet-hidden" data-video controls playsinline></video>
                  <iframe class="aet-hidden" data-embed allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
                </div>
                <div class="aet-meta">
                  <div class="aet-meta-item"><div class="aet-meta-k">Titre</div><div class="aet-meta-v" data-meta-title>Aucun flux</div></div>
                  <div class="aet-meta-item"><div class="aet-meta-k">Type</div><div class="aet-meta-v" data-meta-type>—</div></div>
                  <div class="aet-meta-item"><div class="aet-meta-k">URL active</div><div class="aet-meta-v" data-meta-url>—</div></div>
                </div>
              </div>
              <div class="aet-card aet-lib-card">
                <div class="aet-lib-head">
                  <div>
                    <div class="aet-lib-title">Bibliothèque</div>
                    <div class="aet-lib-count" data-lib-count>0 lien</div>
                  </div>
                  <button class="aet-btn aet-btn-danger" data-clear-library>Tout effacer</button>
                </div>
                <input class="aet-search" data-search type="search" placeholder="Rechercher un titre ou une URL" />
                <div class="aet-list" data-list></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function extractYouTubeId(url) {
    try {
      const u = new URL(url);
      if (u.hostname.includes('youtu.be')) return u.pathname.slice(1);
      if (u.searchParams.get('v')) return u.searchParams.get('v');
      const parts = u.pathname.split('/');
      return parts.includes('embed') ? parts[parts.indexOf('embed') + 1] : '';
    } catch { return ''; }
  }

  function extractVimeoId(url) {
    try {
      const u = new URL(url);
      const parts = u.pathname.split('/').filter(Boolean);
      return parts.pop() || '';
    } catch { return ''; }
  }

  function mount() {
    injectStyle();

    const homeHero = document.querySelector('.home-hero');
    const firstRow = document.querySelector('.row');
    const anchor = homeHero || firstRow;
    if (!anchor) return false;

    const existing = document.getElementById(ROOT_ID);
    if (existing) return true;

    anchor.insertAdjacentHTML(homeHero ? 'afterend' : 'beforebegin', buildMarkup());
    const root = document.getElementById(ROOT_ID);
    if (!root) return false;

    const $ = (sel) => root.querySelector(sel);
    const urlInput = $('[data-url]');
    const titleInput = $('[data-title]');
    const typeSelect = $('[data-type]');
    const placeholder = $('[data-placeholder]');
    const video = $('[data-video]');
    const embed = $('[data-embed]');
    const list = $('[data-list]');
    const search = $('[data-search]');
    const libCount = $('[data-lib-count]');
    let library = getLibrary();
    let currentItem = getLastPlayed();
    let hls = null;

    function notify(msg) {
      const el = document.createElement('div');
      el.textContent = msg;
      Object.assign(el.style, {
        position:'fixed', right:'16px', bottom:'16px', zIndex:'9999', background:'var(--bg-2)', color:'var(--fg)',
        border:'1px solid var(--border)', borderRadius:'10px', padding:'10px 12px', boxShadow:'var(--shadow)', fontSize:'13px'
      });
      document.body.appendChild(el);
      setTimeout(() => { el.remove(); }, 2200);
    }

    function cleanup() {
      if (hls) { hls.destroy(); hls = null; }
      video.pause();
      video.removeAttribute('src');
      video.load();
      embed.src = '';
      video.classList.add('aet-hidden');
      embed.classList.add('aet-hidden');
      placeholder.classList.remove('aet-hidden');
    }

    function updateMeta(item, type) {
      $('[data-meta-title]').textContent = item?.title || 'Aucun flux';
      $('[data-meta-type]').textContent = type || '—';
      $('[data-meta-url]').textContent = item?.url || '—';
    }

    function syncForm(item) {
      urlInput.value = item?.url || '';
      titleInput.value = item?.title || '';
      typeSelect.value = item?.type || 'auto';
    }

    function collect() {
      const url = urlInput.value.trim();
      const type = typeSelect.value;
      return {
        id: currentItem?.id || uid(),
        title: normalizeTitle(url, titleInput.value),
        url,
        type,
        detectedType: type === 'auto' ? detectType(url) : type,
        createdAt: currentItem?.createdAt || new Date().toISOString()
      };
    }

    function renderLibrary() {
      const q = search.value.trim().toLowerCase();
      const items = library.filter(item => !q || item.title.toLowerCase().includes(q) || item.url.toLowerCase().includes(q));
      libCount.textContent = `${library.length} lien${library.length > 1 ? 's' : ''}`;
      if (!items.length) {
        list.innerHTML = '<div class="aet-empty">Aucun lien enregistré.</div>';
        return;
      }
      list.innerHTML = items.map(item => `
        <div class="aet-item">
          <div class="aet-item-title">${escapeHtml(item.title)}</div>
          <div class="aet-item-url">${escapeHtml(item.url)}</div>
          <div class="aet-tags">
            <span class="aet-tag">${escapeHtml((item.detectedType || detectType(item.url)).toUpperCase())}</span>
            <span class="aet-tag">${new Date(item.createdAt).toLocaleDateString('fr-FR')}</span>
          </div>
          <div class="aet-mini-actions">
            <button class="aet-btn aet-btn-primary" data-play-id="${item.id}">Lire</button>
            <button class="aet-btn aet-btn-secondary" data-fill-id="${item.id}">Charger</button>
            <button class="aet-btn aet-btn-danger" data-del-id="${item.id}">Supprimer</button>
          </div>
        </div>
      `).join('');
    }

    function play(item) {
      if (!item?.url) return notify('Ajoutez une URL valide.');
      const type = item.type === 'auto' ? detectType(item.url) : item.type;
      cleanup();
      if (type === 'youtube') {
        const id = extractYouTubeId(item.url);
        if (!id) return notify('URL YouTube non reconnue.');
        embed.src = `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
        embed.classList.remove('aet-hidden');
      } else if (type === 'vimeo') {
        const id = extractVimeoId(item.url);
        if (!id) return notify('URL Vimeo non reconnue.');
        embed.src = `https://player.vimeo.com/video/${id}?autoplay=1`;
        embed.classList.remove('aet-hidden');
      } else if (type === 'hls') {
        ensureHls(() => {
          if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = item.url;
            video.classList.remove('aet-hidden');
            video.play().catch(()=>{});
          } else if (window.Hls && Hls.isSupported()) {
            hls = new Hls();
            hls.loadSource(item.url);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              video.classList.remove('aet-hidden');
              video.play().catch(()=>{});
            });
            hls.on(Hls.Events.ERROR, (_, data) => { if (data?.fatal) notify('Erreur HLS ou flux bloqué.'); });
          } else {
            notify('HLS non pris en charge par ce navigateur.');
          }
        });
      } else {
        video.src = item.url;
        video.classList.remove('aet-hidden');
        video.play().catch(()=>{});
      }
      placeholder.classList.add('aet-hidden');
      currentItem = { ...item, title: normalizeTitle(item.url, item.title), detectedType: type };
      updateMeta(currentItem, type.toUpperCase());
      syncForm(currentItem);
      setLastPlayed(currentItem);
    }

    root.addEventListener('click', (e) => {
      const example = e.target.closest('[data-example]')?.dataset.example;
      if (example) {
        urlInput.value = example;
        titleInput.value = normalizeTitle(example, 'Exemple');
        typeSelect.value = 'auto';
      }
      if (e.target.closest('[data-play]')) {
        const item = collect();
        if (!item.url) return notify('Veuillez coller une URL.');
        play(item);
      }
      if (e.target.closest('[data-save]')) {
        const item = collect();
        if (!item.url) return notify('Veuillez ajouter une URL.');
        const exists = library.find(x => x.url === item.url);
        library = exists
          ? library.map(x => x.url === item.url ? { ...x, title: item.title, type: item.type, detectedType: item.detectedType } : x)
          : [{ ...item }, ...library];
        saveLibrary(library);
        renderLibrary();
        notify(exists ? 'Lien mis à jour.' : 'Lien enregistré.');
      }
      if (e.target.closest('[data-open-external]')) {
        const url = currentItem?.url || urlInput.value.trim();
        if (!url) return notify('Aucune URL active.');
        window.open(url, '_blank', 'noopener');
      }
      if (e.target.closest('[data-copy-current]')) {
        const url = currentItem?.url || urlInput.value.trim();
        if (!url) return notify('Aucune URL à copier.');
        navigator.clipboard?.writeText(url).then(() => notify('URL copiée.')).catch(() => notify('Copie impossible.'));
      }
      if (e.target.closest('[data-clear-player]')) {
        cleanup();
        currentItem = null;
        updateMeta(null, '—');
        notify('Lecteur vidé.');
      }
      if (e.target.closest('[data-clear-library]')) {
        if (!library.length) return notify('Bibliothèque déjà vide.');
        if (!confirm('Supprimer toute la bibliothèque locale ?')) return;
        library = [];
        saveLibrary(library);
        renderLibrary();
      }
      const playId = e.target.closest('[data-play-id]')?.dataset.playId;
      if (playId) {
        const item = library.find(x => x.id === playId);
        if (item) play(item);
      }
      const fillId = e.target.closest('[data-fill-id]')?.dataset.fillId;
      if (fillId) {
        const item = library.find(x => x.id === fillId);
        if (item) { syncForm(item); notify('Lien chargé.'); }
      }
      const delId = e.target.closest('[data-del-id]')?.dataset.delId;
      if (delId) {
        library = library.filter(x => x.id !== delId);
        saveLibrary(library);
        renderLibrary();
      }
    });

    search.addEventListener('input', renderLibrary);
    urlInput.addEventListener('input', () => {
      const url = urlInput.value.trim();
      if (url && !titleInput.value.trim()) titleInput.value = normalizeTitle(url, '');
    });

    renderLibrary();
    if (currentItem?.url) {
      syncForm(currentItem);
      updateMeta(currentItem, (currentItem.detectedType || detectType(currentItem.url)).toUpperCase());
    }
    return true;
  }

  function boot() {
    if (mount()) return;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (mount() || tries > 40) clearInterval(timer);
    }, 500);
  }

  boot();
})();
