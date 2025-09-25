import { verifySession } from '../services/sessionService.js';

export function requireSession(req, res, next) {
  const sessionId = req.header('x-session-id');
  const signature = req.header('x-session-signature');
  const expiresAt = req.header('x-session-expires');

  if (!verifySession(sessionId, expiresAt, signature)) {
    return res.status(401).json({ error: 'Invalid or expired session. Please refresh the page.' });
  }

  return next();
}
