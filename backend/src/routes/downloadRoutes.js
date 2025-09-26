import express from 'express';
import { downloadController } from '../controllers/downloadController.js';

const router = express.Router();

router.post('/download', downloadController.getDownloadLink);

export default router;
