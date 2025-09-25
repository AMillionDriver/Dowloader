const express = require('express');
const { createDownloadLink, streamDownload } = require('../controllers/download-controller');

const router = express.Router();

router.post('/download', createDownloadLink);
router.get('/download/stream', streamDownload);

module.exports = router;
