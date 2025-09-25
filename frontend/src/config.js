export const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  window?.__APP_CONFIG__?.apiBaseUrl ||
  'http://localhost:5000';

export const REQUEST_TIMEOUT = 1000 * 30; // 30 seconds
