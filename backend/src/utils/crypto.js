const { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } = require('node:crypto');
const { DOWNLOAD_TOKEN_SECRET, DOWNLOAD_TOKEN_TTL } = require('../config/app-config');

const KEY = createHash('sha256').update(DOWNLOAD_TOKEN_SECRET).digest();
const ALGORITHM = 'aes-256-gcm';

function encryptPayload(payload) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const serialized = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(serialized), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64url');
}

function decryptPayload(encoded) {
  const buffer = Buffer.from(encoded, 'base64url');
  const iv = buffer.subarray(0, 12);
  const authTag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);
  const decipher = createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

function createSignature(payload, expiresAt) {
  const hmac = createHmac('sha256', KEY);
  hmac.update(payload);
  hmac.update(String(expiresAt));
  return hmac.digest('base64url');
}

function verifySignature(signature, payload, expiresAt) {
  const expected = createSignature(payload, expiresAt);
  const provided = Buffer.from(signature, 'base64url');
  const expectedBuffer = Buffer.from(expected, 'base64url');
  if (provided.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(provided, expectedBuffer);
}

function createSignedDownloadPayload(url, metadata) {
  const expiresAt = Date.now() + DOWNLOAD_TOKEN_TTL;
  const payload = encryptPayload({ url, metadata, expiresAt });
  const signature = createSignature(payload, expiresAt);
  return { payload, signature, expiresAt };
}

module.exports = {
  encryptPayload,
  decryptPayload,
  createSignature,
  verifySignature,
  createSignedDownloadPayload,
};
