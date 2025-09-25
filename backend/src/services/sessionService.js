import { randomBytes } from 'crypto';
import { createSignedToken, hashValue, validateSignedToken } from '../utils/security.js';

const SESSION_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const sessionStore = new Map();

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [key, session] of sessionStore.entries()) {
    if (session.expiresAt <= now) {
      sessionStore.delete(key);
    }
  }
}

setInterval(cleanupExpiredSessions, 5 * 60 * 1000).unref();

export function createSession() {
  const sessionId = randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const { signature } = createSignedToken(sessionId, expiresAt);
  const hashedId = hashValue(sessionId);
  sessionStore.set(hashedId, { expiresAt });

  return {
    sessionId,
    expiresAt,
    signature,
  };
}

export function verifySession(sessionId, expiresAt, signature) {
  if (!sessionId || !expiresAt || !signature) {
    return false;
  }

  const hashedId = hashValue(sessionId);
  const stored = sessionStore.get(hashedId);
  if (!stored) {
    return false;
  }

  if (stored.expiresAt.toString() !== expiresAt.toString()) {
    return false;
  }

  if (Date.now() > Number(expiresAt)) {
    sessionStore.delete(hashedId);
    return false;
  }

  const isValid = validateSignedToken(sessionId, expiresAt, signature);
  if (!isValid) {
    return false;
  }

  return true;
}
