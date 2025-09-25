import { Router } from 'express';
import { body } from 'express-validator';

import { handleDownloadRequest, streamDownload } from '../controllers/downloadController.js';
import { requireSession } from '../middleware/sessionAuth.js';

const router = Router();

router.post(
  '/',
  requireSession,
  [body('url').isURL().withMessage('A valid video URL is required.')],
  handleDownloadRequest,
);

router.get('/file/:id', streamDownload);

export default router;
