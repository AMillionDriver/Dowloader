export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

const DEFAULT_TIMEOUT = 15000;
const rawTimeout = import.meta.env.VITE_API_TIMEOUT;

export const API_TIMEOUT = Number.isFinite(Number(rawTimeout))
  ? Number(rawTimeout)
  : DEFAULT_TIMEOUT;
