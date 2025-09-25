const crypto = require('crypto');

const DEFAULT_SECRET = 'fallback-secret-change-me';

function resolveSecret(envSecret) {
  return envSecret && envSecret.trim().length >= 16 ? envSecret.trim() : DEFAULT_SECRET;
}

function createRequestFingerprint(url) {
  return crypto.createHash('sha256').update(url).digest('hex');
}

function createIntegrityToken(id, downloadUrl, secret) {
  return crypto.createHmac('sha512', secret).update(`${id}:${downloadUrl}`).digest('hex');
}

function createSecureId() {
  return crypto.createHash('sha256').update(crypto.randomUUID()).digest('hex');
}

function createDownloadHash(downloadUrl) {
  return crypto.createHash('sha256').update(downloadUrl).digest('hex');
}

module.exports = {
  resolveSecret,
  createRequestFingerprint,
  createIntegrityToken,
  createSecureId,
  createDownloadHash
};
