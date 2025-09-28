import express from 'express';
import { downloadController } from '../controllers/downloadController.js';

const router = express.Router();

router.post('/info', downloadController.getVideoInfo);
router.post('/prepare-download', downloadController.prepareDownload);
router.get('/download-progress/:downloadId', downloadController.streamDownloadProgress);
router.get('/get-file/:downloadId', downloadController.getFile);
router.post('/download-subtitle', downloadController.downloadSubtitle);

export default router;
