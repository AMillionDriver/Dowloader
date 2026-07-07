import express from 'express';
import { downloadController } from '../controllers/downloadController.js';

const router = express.Router();

router.post('/info', downloadController.getVideoInfo);
router.post('/download-manifest', downloadController.createDownloadManifest);
router.post('/download-chunk', downloadController.downloadChunk);
router.post('/download-stream', downloadController.downloadStream);

export default router;
