import { safeJSONParse, STORAGE_KEYS } from './utils.js';

const read = (key, fallback) => safeJSONParse(localStorage.getItem(key), fallback);
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));

export const store = {
  getCatalog: () => read(STORAGE_KEYS.catalog, []),
  setCatalog: (items) => write(STORAGE_KEYS.catalog, items),
  getCatalogTime: () => Number(localStorage.getItem(STORAGE_KEYS.catalogTime) || 0),
  setCatalogTime: (value) => localStorage.setItem(STORAGE_KEYS.catalogTime, String(value)),

  getFavorites: () => read(STORAGE_KEYS.favorites, []),
  setFavorites: (items) => write(STORAGE_KEYS.favorites, items),

  getHistory: () => read(STORAGE_KEYS.history, []),
  setHistory: (items) => write(STORAGE_KEYS.history, items),

  getViews: () => read(STORAGE_KEYS.views, {}),
  setViews: (value) => write(STORAGE_KEYS.views, value),

  getProfile: () => read(STORAGE_KEYS.profile, { name: 'Invité', avatar: 'AE' }),
  setProfile: (value) => write(STORAGE_KEYS.profile, value),

  getSettings: () => read(STORAGE_KEYS.settings, {
    theme: 'dark',
    language: 'fr',
    quality: 'auto',
    parental: false,
    notifications: false,
    sound: true,
    subtitles: false
  }),
  setSettings: (value) => write(STORAGE_KEYS.settings, value),

  getSearchHistory: () => read(STORAGE_KEYS.searchHistory, []),
  setSearchHistory: (value) => write(STORAGE_KEYS.searchHistory, value)
};
