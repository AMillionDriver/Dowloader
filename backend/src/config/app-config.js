const path = require('node:path');
const os = require('node:os');

const APP_NAME = process.env.APP_NAME || 'secure-video-downloader';
const PORT = Number.parseInt(process.env.PORT || '5000', 10);
const DOWNLOAD_TOKEN_SECRET = process.env.DOWNLOAD_TOKEN_SECRET || `${os.hostname()}-${APP_NAME}-default-secret`;
const DOWNLOAD_TOKEN_TTL = Number.parseInt(process.env.DOWNLOAD_TOKEN_TTL || String(5 * 60 * 1000), 10);
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || null;
const MAX_CONCURRENT_DOWNLOADS = Number.parseInt(process.env.MAX_CONCURRENT_DOWNLOADS || '2', 10);

const TEMP_DIR = process.env.TEMP_DIR || path.join(os.tmpdir(), APP_NAME);

module.exports = {
  APP_NAME,
  PORT,
  DOWNLOAD_TOKEN_SECRET,
  DOWNLOAD_TOKEN_TTL,
  PUBLIC_BASE_URL,
  MAX_CONCURRENT_DOWNLOADS,
  TEMP_DIR,
};
