import { Router } from 'express';
import { createSession } from '../services/sessionService.js';

const router = Router();

router.get('/handshake', (_req, res) => {
  const session = createSession();
  res.json({
    sessionId: session.sessionId,
    expiresAt: session.expiresAt,
    signature: session.signature,
  });
});

export default router;
