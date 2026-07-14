import {
  $, $$, APP_SHORTCUTS, CACHE_MS, CORS_PROXY, PLAYLIST_URL,
  buildCardSummary, clamp, countriesFromChannels, dedupeBy,
  formatCount, formatTime, hashNumber, inferCategory, inferQuality,
  makeCountryFlag, sleep
} from './utils.js';
import { store } from './store.js';

const state = {
  catalog: [],
  sections: [],
  featured: null,
  favorites: store.getFavorites(),
  history: store.getHistory(),
  views: store.getViews(),
  profile: store.getProfile(),
  settings: store.getSettings(),
  searchHistory: store.getSearchHistory(),
  currentPlayback: null,
  hls: null,
  deferredPrompt: null,
  activePanel: null,
  playerOpen: false,
  currentQuery: '',
  spatialScope: 'main'
};

const els = {
  splash: $('#splashScreen'),
  appShell: $('#appShell'),
  rows: $('#rowsStack'),
  rowTemplate: $('#rowTemplate'),
  channelTemplate: $('#channelCardTemplate'),
  appTemplate: $('#appCardTemplate'),
  heroBackdrop: $('#heroBackdrop'),
  heroTitle: $('#heroTitle'),
  heroDescription: $('#heroDescription'),
  heroBadges: $('#heroBadges'),
  heroLogo: $('#heroLogo'),
  heroChannelName: $('#heroChannelName'),
  heroChannelMeta: $('#heroChannelMeta'),
  totalChannelsStat: $('#totalChannelsStat'),
  totalCountriesStat: $('#totalCountriesStat'),
  statusStat: $('#statusStat'),
  networkStatus: $('#networkStatus'),
  pwaStatus: $('#pwaStatus'),
  hintStatus: $('#hintStatus'),
  searchModal: $('#searchModal'),
  searchBtn: $('#searchBtn'),
  searchInput: $('#searchInput'),
  searchSuggestions: $('#searchSuggestions'),
  searchHistory: $('#searchHistory'),
  voiceSearchBtn: $('#voiceSearchBtn'),
  profilePanel: $('#profilePanel'),
  settingsPanel: $('#settingsPanel'),
  profileBtn: $('#profileBtn'),
  settingsBtn: $('#settingsBtn'),
  profileNameTop: $('#profileNameTop'),
  profileNamePanel: $('#profileNamePanel'),
  profileNameInput: $('#profileNameInput'),
  profileAvatarPanel: $('#profileAvatarPanel'),
  profileStats: $('#profileStats'),
  profileHistorySummary: $('#profileHistorySummary'),
  saveProfileBtn: $('#saveProfileBtn'),
  resetProfileBtn: $('#resetProfileBtn'),
  themeSelect: $('#themeSelect'),
  languageSelect: $('#languageSelect'),
  qualitySelect: $('#qualitySelect'),
  parentalToggle: $('#parentalToggle'),
  notificationsToggle: $('#notificationsToggle'),
  soundToggle: $('#soundToggle'),
  systemInfo: $('#systemInfo'),
  installBtn: $('#installBtn'),
  refreshBtn: $('#refreshBtn'),
  heroPlayBtn: $('#heroPlayBtn'),
  heroFavoriteBtn: $('#heroFavoriteBtn'),
  heroInfoBtn: $('#heroInfoBtn'),
  playerOverlay: $('#playerOverlay'),
  videoPlayer: $('#videoPlayer'),
  embedPlayer: $('#embedPlayer'),
  playerPlaceholder: $('#playerPlaceholder'),
  playerTitle: $('#playerTitle'),
  playerSubtitle: $('#playerSubtitle'),
  playerProgressBar: $('#playerProgressBar'),
  playerCurrentTime: $('#playerCurrentTime'),
  playerDuration: $('#playerDuration'),
  playPauseBtn: $('#playPauseBtn'),
  muteBtn: $('#muteBtn'),
  subtitleBtn: $('#subtitleBtn'),
  fullscreenBtn: $('#fullscreenBtn'),
  closePlayerBtn: $('#closePlayerBtn'),
  nextChannelBtn: $('#nextChannelBtn'),
  prevChannelBtn: $('#prevChannelBtn')
};

const lang = {
  fr: {
    live: 'TV en direct',
    sports: 'Sports',
    movies: 'Films',
    series: 'Séries',
    music: 'Musique',
    favorites: 'Favoris',
    continue: 'Continuer à regarder',
    recommended: 'Chaînes recommandées',
    apps: 'Applications'
  },
  en: {
    live: 'Live TV',
    sports: 'Sports',
    movies: 'Movies',
    series: 'Series',
    music: 'Music',
    favorites: 'Favorites',
    continue: 'Continue Watching',
    recommended: 'Recommended Channels',
    apps: 'Apps'
  }
};

const notify = (message, tone = 'info') => {
  const toast = document.createElement('div');
  toast.className = 'glass-panel';
  Object.assign(toast.style, {
    position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: '22px', zIndex: '140',
    minWidth: '280px', maxWidth: 'min(92vw, 720px)', padding: '14px 18px', borderRadius: '18px',
    color: 'var(--text)', background: tone === 'error' ? 'rgba(133, 14, 48, .86)' : tone === 'success' ? 'rgba(8, 68, 54, .86)' : 'var(--panel-strong)'
  });
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2800);
};

const playUiTone = (kind = 'focus') => {
  if (!state.settings.sound) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  try {
    const ctx = playUiTone.ctx || (playUiTone.ctx = new AudioCtx());
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = kind === 'select' ? 'triangle' : 'sine';
    oscillator.frequency.value = kind === 'select' ? 520 : 340;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(kind === 'select' ? 0.025 : 0.015, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.09);
  } catch {}
};

const sanitizeItem = (item) => {
  const quality = inferQuality(item.name);
  const country = item.country || item.group || 'Monde';
  const category = inferCategory(item);
  const categoryLabel = ({ sports: 'Sports', movies: 'Films', series: 'Séries', music: 'Musique', news: 'Actualités', kids: 'Jeunesse', live: 'Live TV' })[category] || 'Live TV';
  const id = item.id || crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  return {
    ...item,
    id,
    quality,
    country,
    category,
    categoryLabel,
    flag: makeCountryFlag(country),
    isLive: true
  };
};

const parseM3U = (text) => {
  const lines = text.split(/\r?\n/);
  const out = [];
  let info = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF')) {
      const name = line.split(',').slice(-1)[0]?.trim() || 'Chaîne sans titre';
      const logo = (line.match(/tvg-logo="([^"]*)"/) || [])[1] || '';
      const group = (line.match(/group-title="([^"]*)"/) || [])[1] || 'Live';
      const country = (line.match(/tvg-country="([^"]*)"/) || [])[1] || group;
      info = { id: `${name}-${hashNumber(name + group)}`, name, logo, group, country };
    } else if (!line.startsWith('#') && info) {
      out.push(sanitizeItem({ ...info, url: line }));
      info = null;
    }
  }
  return dedupeBy(out, (item) => `${item.name}|${item.url}`);
};

const detectType = (url = '') => {
  const value = String(url).toLowerCase();
  if (value.includes('youtube.com') || value.includes('youtu.be')) return 'youtube';
  if (value.includes('.m3u8')) return 'hls';
  if (/\.(mp4|webm|ogg|mov)(\?|#|$)/.test(value)) return 'video';
  return 'embed';
};

const getYoutubeId = (input = '') => {
  if (/^[\w-]{11}$/.test(input.trim())) return input.trim();
  try {
    const url = new URL(input);
    if (url.hostname.includes('youtu.be')) return url.pathname.split('/').filter(Boolean)[0] || '';
    if (url.searchParams.get('v')) return url.searchParams.get('v');
    if (url.pathname.includes('/embed/')) return url.pathname.split('/embed/')[1]?.split('/')[0] || '';
  } catch {}
  return '';
};

const getViewCount = (item) => state.views[item.id] || 0;

const incrementView = (item) => {
  state.views[item.id] = (state.views[item.id] || 0) + 1;
  store.setViews(state.views);
};

const upsertHistory = (item, progress = 0, duration = 0) => {
  const previous = state.history.filter((entry) => entry.id !== item.id);
  const payload = {
    id: item.id,
    name: item.name,
    url: item.url,
    logo: item.logo,
    country: item.country,
    category: item.category,
    quality: item.quality,
    progress,
    duration,
    updatedAt: Date.now()
  };
  state.history = [payload, ...previous].slice(0, 24);
  store.setHistory(state.history);
};

const toggleFavorite = (item) => {
  const exists = state.favorites.some((entry) => entry.id === item.id);
  state.favorites = exists ? state.favorites.filter((entry) => entry.id !== item.id) : [item, ...state.favorites].slice(0, 30);
  store.setFavorites(state.favorites);
  renderSections();
  notify(exists ? 'Retiré des favoris' : 'Ajouté aux favoris', 'success');
};

const computeRecommendations = () => {
  const weight = new Map();
  state.history.forEach((entry, index) => {
    const boost = 24 - index;
    if (entry.category) weight.set(`category:${entry.category}`, (weight.get(`category:${entry.category}`) || 0) + boost * 2);
    if (entry.country) weight.set(`country:${entry.country}`, (weight.get(`country:${entry.country}`) || 0) + boost);
  });
  state.favorites.forEach((entry) => {
    if (entry.category) weight.set(`category:${entry.category}`, (weight.get(`category:${entry.category}`) || 0) + 18);
    if (entry.country) weight.set(`country:${entry.country}`, (weight.get(`country:${entry.country}`) || 0) + 9);
  });

  const scored = state.catalog.map((item) => {
    const score =
      (weight.get(`category:${item.category}`) || 0) +
      (weight.get(`country:${item.country}`) || 0) +
      (item.category === 'news' ? 8 : 0) +
      (item.quality === '4K' ? 10 : item.quality === 'FHD' ? 5 : 2) +
      hashNumber(item.name) % 6;
    return { ...item, score };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, 16);
};

const isAllowedByParental = (item) => {
  if (!state.settings.parental) return true;
  const blocked = ['adult', 'xxx', '18+', 'erotic', 'porn'];
  const haystack = `${item.name} ${item.country} ${item.group}`.toLowerCase();
  return !blocked.some((term) => haystack.includes(term));
};

const allowedCatalog = () => state.catalog.filter(isAllowedByParental);

const getSectionBuckets = () => {
  const historyIds = new Set(state.history.map((entry) => entry.id));
  const favoritesIds = new Set(state.favorites.map((entry) => entry.id));
  const labels = lang[state.settings.language] || lang.fr;
  const catalog = allowedCatalog();
  return [
    {
      id: 'continue', eyebrow: 'Reprise', title: labels.continue,
      items: state.history.filter((entry) => historyIds.has(entry.id)).slice(0, 12)
    },
    {
      id: 'recommended', eyebrow: 'Pour vous', title: labels.recommended,
      items: computeRecommendations().filter(isAllowedByParental)
    },
    {
      id: 'live', eyebrow: 'Maintenant', title: labels.live,
      items: catalog.slice(0, 18)
    },
    {
      id: 'movies', eyebrow: 'Grand écran', title: labels.movies,
      items: catalog.filter((item) => item.category === 'movies').slice(0, 14)
    },
    {
      id: 'series', eyebrow: 'Binge', title: labels.series,
      items: catalog.filter((item) => item.category === 'series').slice(0, 14)
    },
    {
      id: 'sports', eyebrow: 'Événements', title: labels.sports,
      items: catalog.filter((item) => item.category === 'sports').slice(0, 14)
    },
    {
      id: 'music', eyebrow: 'Ambiance', title: labels.music,
      items: catalog.filter((item) => item.category === 'music').slice(0, 14)
    },
    {
      id: 'favorites', eyebrow: 'Ma liste', title: labels.favorites,
      items: state.favorites.filter((item) => favoritesIds.has(item.id)).slice(0, 14)
    },
    {
      id: 'apps', eyebrow: 'Plateforme', title: labels.apps,
      apps: APP_SHORTCUTS
    }
  ].filter((section) => (section.apps?.length || 0) > 0 || (section.items?.length || 0) > 0);
};

const cardDescription = (item) => {
  const historyItem = state.history.find((entry) => entry.id === item.id);
  if (historyItem?.progress && historyItem.duration) {
    return `Reprendre à ${formatTime(historyItem.progress)} sur ${formatTime(historyItem.duration)}.`;
  }
  return `${item.name} · ${item.categoryLabel} · ${item.country}. Optimisé pour navigation télécommande et lecture rapide.`;
};

const buildHero = () => {
  state.featured = computeRecommendations().filter(isAllowedByParental)[0] || allowedCatalog()[0] || null;
  if (!state.featured) {
    els.heroTitle.textContent = 'AET TV';
    els.heroDescription.textContent = 'Aucun contenu disponible pour le moment.';
    return;
  }
  const item = state.featured;
  els.heroTitle.textContent = item.name;
  els.heroDescription.textContent = `${item.name} ouvre une expérience direct premium avec reprise de lecture, navigation télécommande, cache intelligent et rendu fluide plein écran.`;
  els.heroChannelName.textContent = item.name;
  els.heroChannelMeta.textContent = `${item.flag} ${item.country} • ${item.categoryLabel} • ${item.quality}`;
  els.heroLogo.src = item.logo || 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" rx="56" fill="#ffffff"/><text x="50%" y="55%" text-anchor="middle" font-family="Inter" font-size="72" font-weight="900" fill="#0b1120">AET</text></svg>`);
  els.heroBadges.innerHTML = '';
  [item.quality, item.categoryLabel, `${formatCount(getViewCount(item))} vues`, 'Smart Remote Ready'].forEach((label) => {
    const badge = document.createElement('span');
    badge.textContent = label;
    els.heroBadges.appendChild(badge);
  });
  els.heroBackdrop.style.background = `radial-gradient(circle at 18% 18%, rgba(43, 179, 255, 0.36), transparent 20%), radial-gradient(circle at 72% 14%, rgba(139, 124, 255, 0.26), transparent 18%), linear-gradient(120deg, rgba(4, 7, 16, 0.96), rgba(10, 19, 37, 0.72)), url('${item.logo || ''}') center / 22% no-repeat`;
};

const createChannelCard = (item) => {
  const card = els.channelTemplate.content.firstElementChild.cloneNode(true);
  card.dataset.id = item.id;
  card.dataset.type = 'channel';
  card.dataset.category = item.category;
  $('.card-logo', card).src = item.logo || 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><rect width="240" height="240" rx="48" fill="#fff"/><text x="50%" y="55%" text-anchor="middle" font-family="Inter" font-size="60" font-weight="900" fill="#061024">${item.flag}</text></svg>`);
  $('.card-logo', card).alt = `Logo ${item.name}`;
  $('.quality-pill', card).textContent = item.quality;
  $('.card-title', card).textContent = item.name;
  $('.card-country', card).textContent = `${item.flag} ${item.country}`;
  $('.card-tags', card).innerHTML = [item.categoryLabel, item.quality, item.country].slice(0, 3).map((tag) => `<span>${tag}</span>`).join('');
  $('.card-views', card).textContent = `${formatCount(getViewCount(item))} vues`;
  $('.card-state', card).textContent = item.isLive ? 'LIVE' : 'Disponible';
  $('.hover-title', card).textContent = item.name;
  $('.hover-copy', card).textContent = cardDescription(item);
  card.title = `${item.name} — ${buildCardSummary(item)}`;
  card.addEventListener('click', () => playItem(item));
  card.addEventListener('focus', () => focusCard(card));
  return card;
};

const createAppCard = (app) => {
  const card = els.appTemplate.content.firstElementChild.cloneNode(true);
  card.dataset.id = app.id;
  card.dataset.type = 'app';
  $('.app-icon', card).textContent = app.icon;
  $('.app-title', card).textContent = app.title;
  $('.app-copy', card).textContent = app.description;
  card.addEventListener('click', () => runAppShortcut(app));
  card.addEventListener('focus', () => focusCard(card));
  return card;
};

const renderSections = () => {
  state.sections = getSectionBuckets();
  els.rows.innerHTML = '';
  state.sections.forEach((section) => {
    const node = els.rowTemplate.content.firstElementChild.cloneNode(true);
    node.id = `section-${section.id}`;
    $('.row-eyebrow', node).textContent = section.eyebrow;
    $('.row-title', node).textContent = section.title;
    $('.row-count', node).textContent = `${section.apps?.length || section.items?.length || 0} éléments`;
    const rail = $('[data-rail]', node);
    if (section.apps) section.apps.forEach((app) => rail.appendChild(createAppCard(app)));
    if (section.items) section.items.forEach((item) => rail.appendChild(createChannelCard(item)));
    els.rows.appendChild(node);
  });
  updateProfilePanel();
  hydrateSpatialFocus();
};

const updateHeaderStats = () => {
  els.totalChannelsStat.textContent = formatCount(state.catalog.length);
  els.totalCountriesStat.textContent = formatCount(countriesFromChannels(state.catalog));
  els.statusStat.textContent = navigator.onLine ? 'En ligne' : 'Mode hors ligne';
  els.networkStatus.textContent = navigator.onLine ? 'Connexion : en ligne' : 'Connexion : hors ligne';
  els.pwaStatus.textContent = window.matchMedia('(display-mode: standalone)').matches ? 'PWA : installée' : 'PWA : installable';
};

const updateProfilePanel = () => {
  els.profileNameTop.textContent = state.profile.name;
  els.profileNamePanel.textContent = state.profile.name;
  els.profileNameInput.value = state.profile.name;
  els.profileAvatarPanel.textContent = state.profile.avatar;
  els.profileStats.textContent = `${state.favorites.length} favoris • ${state.history.length} éléments dans l’historique`;
  els.profileHistorySummary.innerHTML = '';
  const entries = [
    `Favoris synchronisés dans le navigateur : ${state.favorites.length}`,
    `Continuer à regarder : ${state.history.filter((entry) => entry.progress > 0).length}`,
    `Dernière activité : ${state.history[0] ? new Date(state.history[0].updatedAt).toLocaleString('fr-FR') : 'aucune'}`
  ];
  entries.forEach((label) => {
    const item = document.createElement('div');
    item.className = 'panel-list-item';
    item.textContent = label;
    els.profileHistorySummary.appendChild(item);
  });
};

const applySettings = () => {
  document.body.classList.toggle('light-mode', state.settings.theme === 'light');
  els.themeSelect.value = state.settings.theme;
  els.languageSelect.value = state.settings.language;
  els.qualitySelect.value = state.settings.quality;
  els.parentalToggle.checked = state.settings.parental;
  els.notificationsToggle.checked = state.settings.notifications;
  els.soundToggle.checked = state.settings.sound;
  const info = [
    `Rendu: ${window.innerWidth}×${window.innerHeight}`,
    `Mémoire appareil: ${navigator.deviceMemory || 'n/d'} Go`,
    `Cœurs logiques: ${navigator.hardwareConcurrency || 'n/d'}`,
    `Mode vidéo: ${state.settings.quality}`,
    `Cache catalogue: ${Math.round((Date.now() - store.getCatalogTime()) / 60000)} min`
  ];
  els.systemInfo.innerHTML = info.map((label) => `<div class="setting-card">${label}</div>`).join('');
};

const saveSettings = (patch) => {
  state.settings = { ...state.settings, ...patch };
  store.setSettings(state.settings);
  applySettings();
  renderSections();
};

const loadCatalog = async (force = false) => {
  const cached = store.getCatalog();
  const cacheTime = store.getCatalogTime();
  if (!force && cached.length && Date.now() - cacheTime < CACHE_MS) {
    state.catalog = cached.map(sanitizeItem);
    return state.catalog;
  }

  try {
    let text = '';
    try {
      const response = await fetch(PLAYLIST_URL, { cache: force ? 'reload' : 'default' });
      if (response.ok) text = await response.text();
    } catch {}
    if (!text.includes('#EXTINF')) {
      try {
        const proxyResponse = await fetch(CORS_PROXY + encodeURIComponent(PLAYLIST_URL));
        if (proxyResponse.ok) text = await proxyResponse.text();
      } catch {}
    }
    const parsed = parseM3U(text).slice(0, 320);
    if (!parsed.length) throw new Error('Catalogue vide');
    state.catalog = parsed;
    store.setCatalog(state.catalog);
    store.setCatalogTime(Date.now());
    return parsed;
  } catch (error) {
    if (cached.length) {
      state.catalog = cached.map(sanitizeItem);
      notify('Mode hors ligne : catalogue local restauré.', 'success');
      return state.catalog;
    }
    notify('Impossible de charger le catalogue IPTV.', 'error');
    throw error;
  }
};

const preloadHeroAssets = () => {
  state.sections.slice(0, 4).flatMap((section) => section.items || []).slice(0, 10).forEach((item) => {
    if (!item.logo) return;
    const img = new Image();
    img.loading = 'eager';
    img.src = item.logo;
  });
};

const focusableSelector = '.focusable:not([disabled]), .channel-card, .app-card, .nav-chip, .control-button, .search-chip';

const currentScopeRoot = () => {
  if (state.playerOpen) return els.playerOverlay;
  if (state.activePanel === 'profile') return els.profilePanel;
  if (state.activePanel === 'settings') return els.settingsPanel;
  if (els.searchModal.classList.contains('is-open')) return els.searchModal;
  return document;
};

const visibleFocusables = () => $$(focusableSelector, currentScopeRoot()).filter((element) => {
  const rect = element.getBoundingClientRect();
  const hidden = rect.width === 0 || rect.height === 0;
  return !hidden && !element.closest('[aria-hidden="true"]');
});

const focusCard = (element) => {
  $$('.is-focused').forEach((node) => node.classList.remove('is-focused'));
  element.classList.add('is-focused');
  element.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
};

const focusElement = (element) => {
  if (!element) return;
  element.focus({ preventScroll: true });
  if (element.classList.contains('channel-card') || element.classList.contains('app-card')) focusCard(element);
  playUiTone('focus');
};

const spatialTarget = (direction) => {
  const focusables = visibleFocusables();
  const active = document.activeElement;
  if (!focusables.length) return null;
  if (!focusables.includes(active)) return focusables[0];
  const currentRect = active.getBoundingClientRect();
  const cx = currentRect.left + currentRect.width / 2;
  const cy = currentRect.top + currentRect.height / 2;
  const candidates = focusables
    .filter((element) => element !== active)
    .map((element) => {
      const rect = element.getBoundingClientRect();
      const ex = rect.left + rect.width / 2;
      const ey = rect.top + rect.height / 2;
      const dx = ex - cx;
      const dy = ey - cy;
      const inDirection =
        (direction === 'left' && dx < -8) ||
        (direction === 'right' && dx > 8) ||
        (direction === 'up' && dy < -8) ||
        (direction === 'down' && dy > 8);
      if (!inDirection) return null;
      const primary = direction === 'left' || direction === 'right' ? Math.abs(dx) : Math.abs(dy);
      const secondary = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);
      return { element, score: primary + secondary * 1.6 };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score);
  return candidates[0]?.element || null;
};

const hydrateSpatialFocus = () => {
  const elements = visibleFocusables();
  if (!elements.length) return;
  if (!elements.includes(document.activeElement)) focusElement(elements[0]);
};

const hidePanel = (name) => {
  const panel = name === 'profile' ? els.profilePanel : els.settingsPanel;
  panel.classList.remove('is-open');
  panel.setAttribute('aria-hidden', 'true');
  if (state.activePanel === name) state.activePanel = null;
};

const hideSearch = () => {
  els.searchModal.classList.remove('is-open');
  els.searchModal.setAttribute('aria-hidden', 'true');
};

const openPanel = (name) => {
  if (state.activePanel) hidePanel(state.activePanel);
  if (els.searchModal.classList.contains('is-open')) hideSearch();
  state.activePanel = name;
  const panel = name === 'profile' ? els.profilePanel : els.settingsPanel;
  panel.classList.add('is-open');
  panel.setAttribute('aria-hidden', 'false');
  setTimeout(hydrateSpatialFocus, 20);
};

const closePanel = (name) => {
  hidePanel(name);
  setTimeout(() => focusElement(name === 'profile' ? els.profileBtn : els.settingsBtn), 30);
};

const openSearch = () => {
  if (state.activePanel) hidePanel(state.activePanel);
  els.searchModal.classList.add('is-open');
  els.searchModal.setAttribute('aria-hidden', 'false');
  renderSearchHistory();
  renderSearchSuggestions();
  setTimeout(() => els.searchInput.focus(), 40);
};

const closeSearch = () => {
  hideSearch();
  setTimeout(() => focusElement(els.searchBtn), 30);
};

const closeOverlays = () => {
  if (state.activePanel) hidePanel(state.activePanel);
  if (els.searchModal.classList.contains('is-open')) hideSearch();
};

const playerReset = () => {
  if (state.hls) {
    try { state.hls.destroy(); } catch {}
    state.hls = null;
  }
  els.videoPlayer.pause();
  els.videoPlayer.removeAttribute('src');
  els.videoPlayer.load();
  els.embedPlayer.removeAttribute('src');
  els.videoPlayer.classList.add('hidden');
  els.embedPlayer.classList.add('hidden');
  els.playerPlaceholder.classList.remove('hidden');
  els.playerProgressBar.style.width = '0%';
  els.playerCurrentTime.textContent = '00:00';
  els.playerDuration.textContent = '00:00';
};

const playHls = async (url) => {
  els.videoPlayer.classList.remove('hidden');
  els.playerPlaceholder.classList.add('hidden');
  if (window.Hls && window.Hls.isSupported()) {
    state.hls = new Hls({ lowLatencyMode: true, enableWorker: true, maxBufferLength: 24 });
    state.hls.loadSource(url);
    state.hls.attachMedia(els.videoPlayer);
    state.hls.on(Hls.Events.MANIFEST_PARSED, () => els.videoPlayer.play().catch(() => {}));
    state.hls.on(Hls.Events.ERROR, (_, data) => {
      if (data?.fatal) notify('Flux indisponible ou temporairement bloqué.', 'error');
    });
  } else if (els.videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
    els.videoPlayer.src = url;
    await els.videoPlayer.play().catch(() => {});
  } else {
    notify('Lecture HLS non supportée sur cet appareil.', 'error');
  }
};

const playVideoUrl = async (url) => {
  els.videoPlayer.classList.remove('hidden');
  els.playerPlaceholder.classList.add('hidden');
  els.videoPlayer.src = url;
  await els.videoPlayer.play().catch(() => {});
};

const playEmbed = (url) => {
  els.embedPlayer.classList.remove('hidden');
  els.playerPlaceholder.classList.add('hidden');
  els.embedPlayer.src = url;
};

const playbackIndex = () => state.catalog.findIndex((entry) => entry.id === state.currentPlayback?.id);

const playItem = async (item) => {
  if (!item?.url) return;
  playerReset();
  state.currentPlayback = item;
  state.playerOpen = true;
  incrementView(item);
  upsertHistory(item, 0, 0);
  renderSections();

  els.playerOverlay.classList.add('is-open');
  els.playerOverlay.setAttribute('aria-hidden', 'false');
  els.playerTitle.textContent = item.name;
  els.playerSubtitle.textContent = `${item.flag} ${item.country} • ${item.categoryLabel} • ${item.quality}`;
  const type = detectType(item.url);
  const resume = state.history.find((entry) => entry.id === item.id);

  try {
    if (type === 'hls') {
      await playHls(item.url);
    } else if (type === 'video') {
      await playVideoUrl(item.url);
    } else if (type === 'youtube') {
      const id = getYoutubeId(item.url);
      playEmbed(`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&controls=1`);
    } else {
      playEmbed(item.url);
    }
    if (resume?.progress && type !== 'youtube') {
      els.videoPlayer.addEventListener('loadedmetadata', () => {
        els.videoPlayer.currentTime = clamp(resume.progress, 0, els.videoPlayer.duration || resume.progress);
      }, { once: true });
    }
  } catch (error) {
    notify('Lecture impossible pour ce contenu.', 'error');
  }

  requestAnimationFrame(() => focusElement(els.playPauseBtn));
};

const closePlayer = () => {
  state.playerOpen = false;
  state.currentPlayback = null;
  els.playerOverlay.classList.remove('is-open');
  els.playerOverlay.setAttribute('aria-hidden', 'true');
  playerReset();
  setTimeout(() => hydrateSpatialFocus(), 20);
};

const updatePlayerTimeline = () => {
  if (!state.currentPlayback || Number.isNaN(els.videoPlayer.duration)) return;
  const current = els.videoPlayer.currentTime || 0;
  const duration = els.videoPlayer.duration || 0;
  els.playerCurrentTime.textContent = formatTime(current);
  els.playerDuration.textContent = formatTime(duration);
  els.playerProgressBar.style.width = `${duration ? (current / duration) * 100 : 0}%`;
  upsertHistory(state.currentPlayback, current, duration);
};

const togglePlayPause = async () => {
  if (els.videoPlayer.classList.contains('hidden')) return;
  if (els.videoPlayer.paused) {
    await els.videoPlayer.play().catch(() => {});
  } else {
    els.videoPlayer.pause();
  }
};

const nextChannel = (step = 1) => {
  const list = allowedCatalog();
  const index = list.findIndex((entry) => entry.id === state.currentPlayback?.id);
  if (index < 0) return;
  const target = list[(index + step + list.length) % list.length];
  if (target) playItem(target);
};

const runAppShortcut = (app) => {
  if (app.action) window.open(app.action, '_blank', 'noopener');
  if (app.modal === 'search') openSearch();
  if (app.filter) {
    document.getElementById(`section-${app.filter}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    notify(`Section ${app.title} affichée.`, 'success');
  }
};

const goHome = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  focusElement(els.heroPlayBtn);
};

const activateNav = (key) => {
  $$('.nav-chip').forEach((node) => node.classList.toggle('is-active', node.dataset.nav === key));
  if (key === 'home') return goHome();
  const target = document.getElementById(`section-${key}`) || document.getElementById('section-recommended');
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const focusTarget = $('.channel-card, .app-card', target);
  if (focusTarget) setTimeout(() => focusElement(focusTarget), 120);
};

const renderSearchHistory = () => {
  els.searchHistory.innerHTML = '';
  const history = state.searchHistory.slice(0, 8);
  if (!history.length) {
    els.searchHistory.innerHTML = '<div class="setting-card">Aucune recherche récente.</div>';
    return;
  }
  history.forEach((query) => {
    const button = document.createElement('button');
    button.className = 'search-chip focusable';
    button.textContent = query;
    button.addEventListener('click', () => {
      els.searchInput.value = query;
      state.currentQuery = query;
      renderSearchSuggestions();
    });
    els.searchHistory.appendChild(button);
  });
};

const saveSearchQuery = (query) => {
  const normalized = query.trim();
  if (!normalized) return;
  state.searchHistory = [normalized, ...state.searchHistory.filter((entry) => entry.toLowerCase() !== normalized.toLowerCase())].slice(0, 12);
  store.setSearchHistory(state.searchHistory);
};

const searchMatches = (query) => {
  const q = query.trim().toLowerCase();
  if (!q) return computeRecommendations().slice(0, 8);
  return allowedCatalog().filter((item) => {
    const haystack = `${item.name} ${item.country} ${item.categoryLabel}`.toLowerCase();
    return haystack.includes(q);
  }).slice(0, 12);
};

const renderSearchSuggestions = () => {
  const query = state.currentQuery || els.searchInput.value || '';
  const suggestions = searchMatches(query);
  els.searchSuggestions.innerHTML = '';
  if (!suggestions.length) {
    els.searchSuggestions.innerHTML = '<div class="setting-card">Aucun résultat. Essayez un autre mot-clé.</div>';
    return;
  }
  suggestions.forEach((item) => {
    const button = document.createElement('button');
    button.className = 'search-chip focusable';
    button.innerHTML = `<span>${item.name} • ${item.country}</span><strong>${item.categoryLabel}</strong>`;
    button.addEventListener('click', () => {
      saveSearchQuery(query || item.name);
      closeSearch();
      playItem(item);
    });
    els.searchSuggestions.appendChild(button);
  });
};

const startVoiceSearch = () => {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) return notify('Recherche vocale non disponible sur cet appareil.', 'error');
  const recognition = new Recognition();
  recognition.lang = state.settings.language === 'en' ? 'en-US' : 'fr-FR';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    els.searchInput.value = transcript;
    state.currentQuery = transcript;
    renderSearchSuggestions();
    saveSearchQuery(transcript);
  };
  recognition.onerror = () => notify('Échec de la dictée vocale.', 'error');
  recognition.start();
};

const syncFromStorage = () => {
  state.favorites = store.getFavorites();
  state.history = store.getHistory();
  state.views = store.getViews();
  state.profile = store.getProfile();
  state.settings = store.getSettings();
  state.searchHistory = store.getSearchHistory();
  applySettings();
  updateProfilePanel();
  buildHero();
  renderSections();
};

const registerPwa = async () => {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register('./sw.js');
    if (registration.waiting) els.pwaStatus.textContent = 'PWA : mise à jour prête';
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SW_UPDATED') {
        els.pwaStatus.textContent = 'PWA : mise à jour appliquée';
      }
    });
  } catch {
    els.pwaStatus.textContent = 'PWA : indisponible';
  }
};

const wireEvents = () => {
  els.heroPlayBtn.addEventListener('click', () => state.featured && playItem(state.featured));
  els.heroFavoriteBtn.addEventListener('click', () => state.featured && toggleFavorite(state.featured));
  els.heroInfoBtn.addEventListener('click', () => state.featured && notify(`${state.featured.name} — ${buildCardSummary(state.featured)}`));
  els.homeBtn.addEventListener('click', goHome);
  els.searchBtn.addEventListener('click', openSearch);
  els.profileBtn.addEventListener('click', () => openPanel('profile'));
  els.settingsBtn.addEventListener('click', () => openPanel('settings'));

  $$('[data-close-panel]').forEach((node) => node.addEventListener('click', () => closePanel(node.dataset.closePanel)));
  $$('[data-close-search]').forEach((node) => node.addEventListener('click', closeSearch));

  $$('.nav-chip').forEach((node) => node.addEventListener('click', () => activateNav(node.dataset.nav)));

  els.saveProfileBtn.addEventListener('click', () => {
    const name = els.profileNameInput.value.trim() || 'Invité';
    const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
    state.profile = { name, avatar: initials || 'AE' };
    store.setProfile(state.profile);
    updateProfilePanel();
    notify('Profil enregistré.', 'success');
  });

  els.resetProfileBtn.addEventListener('click', () => {
    state.profile = { name: 'Invité', avatar: 'AE' };
    store.setProfile(state.profile);
    updateProfilePanel();
  });

  els.themeSelect.addEventListener('change', (event) => saveSettings({ theme: event.target.value }));
  els.languageSelect.addEventListener('change', (event) => saveSettings({ language: event.target.value }));
  els.qualitySelect.addEventListener('change', (event) => saveSettings({ quality: event.target.value }));
  els.parentalToggle.addEventListener('change', (event) => saveSettings({ parental: event.target.checked }));
  els.notificationsToggle.addEventListener('change', async (event) => {
    if (event.target.checked && 'Notification' in window) await Notification.requestPermission();
    saveSettings({ notifications: event.target.checked });
  });
  els.soundToggle.addEventListener('change', (event) => saveSettings({ sound: event.target.checked }));
  els.refreshBtn.addEventListener('click', async () => {
    await loadCatalog(true);
    buildHero();
    renderSections();
    preloadHeroAssets();
    updateHeaderStats();
    notify('Catalogue actualisé.', 'success');
  });
  els.installBtn.addEventListener('click', async () => {
    if (!state.deferredPrompt) return notify('Installation non proposée pour le moment.');
    state.deferredPrompt.prompt();
    await state.deferredPrompt.userChoice.catch(() => {});
    state.deferredPrompt = null;
  });

  els.searchInput.addEventListener('input', (event) => {
    state.currentQuery = event.target.value;
    renderSearchSuggestions();
  });
  els.searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      saveSearchQuery(els.searchInput.value);
      renderSearchHistory();
      const target = searchMatches(els.searchInput.value)[0];
      if (target) {
        closeSearch();
        playItem(target);
      }
    }
  });
  els.voiceSearchBtn.addEventListener('click', startVoiceSearch);

  els.playPauseBtn.addEventListener('click', togglePlayPause);
  els.closePlayerBtn.addEventListener('click', closePlayer);
  els.nextChannelBtn.addEventListener('click', () => nextChannel(1));
  els.prevChannelBtn.addEventListener('click', () => nextChannel(-1));
  els.muteBtn.addEventListener('click', () => {
    els.videoPlayer.muted = !els.videoPlayer.muted;
    els.muteBtn.textContent = els.videoPlayer.muted ? '🔇' : '🔊';
  });
  els.subtitleBtn.addEventListener('click', () => {
    state.settings.subtitles = !state.settings.subtitles;
    const tracks = els.videoPlayer.textTracks || [];
    [...tracks].forEach((track) => { track.mode = state.settings.subtitles ? 'showing' : 'hidden'; });
    store.setSettings(state.settings);
    notify(state.settings.subtitles ? 'Sous-titres activés si disponibles.' : 'Sous-titres désactivés.');
  });
  els.fullscreenBtn.addEventListener('click', async () => {
    const element = els.playerOverlay.classList.contains('is-open') ? $('.player-stage') : document.documentElement;
    if (!document.fullscreenElement) await element.requestFullscreen?.(); else await document.exitFullscreen?.();
  });

  els.videoPlayer.addEventListener('timeupdate', updatePlayerTimeline);
  els.videoPlayer.addEventListener('loadedmetadata', updatePlayerTimeline);
  els.videoPlayer.addEventListener('pause', () => { els.playPauseBtn.textContent = '▶'; });
  els.videoPlayer.addEventListener('play', () => { els.playPauseBtn.textContent = '⏸'; });
  els.videoPlayer.addEventListener('ended', () => nextChannel(1));

  window.addEventListener('storage', syncFromStorage);
  window.addEventListener('online', updateHeaderStats);
  window.addEventListener('offline', updateHeaderStats);
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.deferredPrompt = event;
    els.pwaStatus.textContent = 'PWA : installation disponible';
  });

  document.addEventListener('keydown', (event) => {
    const key = event.key;
    const directionMap = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    if (directionMap[key]) {
      event.preventDefault();
      const next = spatialTarget(directionMap[key]);
      if (next) focusElement(next);
      return;
    }
    if (key === 'Enter' || key === ' ') {
      const active = document.activeElement;
      if (active?.click) {
        event.preventDefault();
        playUiTone('select');
        active.click();
      }
    }
    if (key === 'Escape' || key === 'Backspace' || key === 'BrowserBack') {
      event.preventDefault();
      if (state.playerOpen) return closePlayer();
      if (els.searchModal.classList.contains('is-open')) return closeSearch();
      if (state.activePanel) return closePanel(state.activePanel);
    }
    if (key === 'Home' || key === 'BrowserHome') {
      event.preventDefault();
      goHome();
    }
    if (key === 'MediaPlayPause') {
      event.preventDefault();
      togglePlayPause();
    }
  });
};

const boot = async () => {
  applySettings();
  wireEvents();
  updateProfilePanel();

  try {
    await loadCatalog();
  } catch (error) {
    console.error('Chargement du catalogue impossible :', error);
    notify('Catalogue indisponible pour le moment. Nouvelle tentative possible dans les réglages.', 'error');
  }

  try {
    await registerPwa();
  } catch (error) {
    console.error('PWA indisponible :', error);
  }

  buildHero();
  renderSections();
  preloadHeroAssets();
  updateHeaderStats();
  await sleep(850);
  els.splash.classList.add('is-hidden');
  hydrateSpatialFocus();
  if (state.settings.notifications && 'Notification' in window && Notification.permission === 'granted') {
    new Notification('AET TV est prêt', { body: 'Le Smart Hub premium est chargé.' });
  }
};

boot().catch((error) => {
  console.error(error);
  notify('Erreur critique durant le démarrage de AET TV.', 'error');
  els.splash.classList.add('is-hidden');
});
