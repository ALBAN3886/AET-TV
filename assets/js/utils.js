export const $ = (selector, scope = document) => scope.querySelector(selector);
export const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

export const STORAGE_KEYS = {
  catalog: 'aet.catalog.v6',
  catalogTime: 'aet.catalog.time.v6',
  favorites: 'aet.favorites.v6',
  history: 'aet.history.v6',
  views: 'aet.views.v6',
  profile: 'aet.profile.v6',
  settings: 'aet.settings.v6',
  searchHistory: 'aet.search.history.v6'
};

export const PLAYLIST_URL = 'https://iptv-org.github.io/iptv/index.country.m3u';
export const CORS_PROXY = 'https://api.allorigins.win/raw?url=';
export const CACHE_MS = 1000 * 60 * 60 * 6;

export const CATEGORY_RULES = [
  { id: 'sports', label: 'Sports', keywords: ['sport', 'football', 'soccer', 'nba', 'nfl', 'fight', 'bein', 'espn', 'eurosport', 'tennis', 'f1', 'ufc', 'golf'] },
  { id: 'movies', label: 'Films', keywords: ['movie', 'film', 'cinema', 'ciné', 'action', 'max', 'hbo', 'cinemax'] },
  { id: 'series', label: 'Séries', keywords: ['series', 'show', 'drama', 'tv series', 'episode', 'soap'] },
  { id: 'music', label: 'Musique', keywords: ['music', 'hits', 'mtv', 'trace', 'radio', 'dj', 'dance', 'song'] },
  { id: 'news', label: 'Actualités', keywords: ['news', 'info', '24', 'cnn', 'bbc', 'france 24', 'al jazeera', 'sky news'] },
  { id: 'kids', label: 'Jeunesse', keywords: ['kids', 'junior', 'cartoon', 'toon', 'baby', 'nick'] }
];

export const APP_SHORTCUTS = [
  { id: 'youtube', title: 'YouTube', icon: '▶', description: 'Ouvrir la recherche et les lives YouTube', action: 'https://www.youtube.com/' },
  { id: 'browser', title: 'Navigateur', icon: '🌐', description: 'Ouvrir le site officiel AET TV', action: 'https://alban3886.github.io/AET-TV/' },
  { id: 'radio', title: 'Radio & Musique', icon: '♫', description: 'Accès rapide aux chaînes musicales', filter: 'music' },
  { id: 'sports', title: 'Sports Live', icon: '⚽', description: 'Revenir directement sur la rangée Sports', filter: 'sports' },
  { id: 'movies', title: 'Films', icon: '🎬', description: 'Sélection films et cinéma', filter: 'movies' },
  { id: 'search', title: 'Recherche', icon: '🔎', description: 'Suggestions instantanées et historique', modal: 'search' }
];

export const countriesFromChannels = (channels) => [...new Set(channels.map((item) => item.country).filter(Boolean))].length;

export const safeJSONParse = (value, fallback) => {
  try {
    return JSON.parse(value) ?? fallback;
  } catch {
    return fallback;
  }
};

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const formatCount = (value) => new Intl.NumberFormat('fr-FR').format(value || 0);

export const formatTime = (seconds = 0) => {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h > 0 ? String(h).padStart(2, '0') : null, String(m).padStart(2, '0'), String(s).padStart(2, '0')].filter(Boolean).join(':');
};

export const hashNumber = (input = '') => [...String(input)].reduce((acc, char, index) => acc + char.charCodeAt(0) * (index + 1), 0);

export const inferQuality = (name = '') => {
  const n = name.toLowerCase();
  if (/(4k|uhd)/.test(n)) return '4K';
  if (/(fhd|1080)/.test(n)) return 'FHD';
  if (/(hd|720)/.test(n)) return 'HD';
  return 'HD';
};

export const inferCategory = (item) => {
  const haystack = `${item.name} ${item.country} ${item.group}`.toLowerCase();
  const match = CATEGORY_RULES.find((rule) => rule.keywords.some((word) => haystack.includes(word)));
  return match ? match.id : 'live';
};

export const makeCountryFlag = (country = '') => {
  const map = {
    france: '🇫🇷', senegal: '🇸🇳', cameroon: '🇨🇲', nigeria: '🇳🇬', ghana: '🇬🇭', canada: '🇨🇦', germany: '🇩🇪', spain: '🇪🇸', italy: '🇮🇹',
    morocco: '🇲🇦', algeria: '🇩🇿', tunisia: '🇹🇳', 'united states': '🇺🇸', usa: '🇺🇸', uk: '🇬🇧', 'united kingdom': '🇬🇧', india: '🇮🇳', japan: '🇯🇵',
    brazil: '🇧🇷', portugal: '🇵🇹', turkey: '🇹🇷', switzerland: '🇨🇭', belgium: '🇧🇪', netherlands: '🇳🇱', qatar: '🇶🇦', egypt: '🇪🇬'
  };
  return map[country.toLowerCase()] || '🌍';
};

export const buildCardSummary = (item) => `${item.categoryLabel} · ${item.country || 'Monde'} · ${item.quality}`;

export const dedupeBy = (items, selector) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = selector(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
