require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { extractDownloadInfo } = require('./utils/downloader');
const { isValidHttpUrl } = require('./utils/validation');
const {
  resolveSecret,
  createRequestFingerprint,
  createIntegrityToken,
  createSecureId,
  createDownloadHash
} = require('./utils/security');

const app = express();
const secret = resolveSecret(process.env.DOWNLOADER_SECRET);
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(express.json({ limit: '1mb' }));
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    }
  })
);
app.use(morgan('combined'));
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 25,
    legacyHeaders: false,
    standardHeaders: 'draft-7'
  })
);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.post('/api/download', async (req, res) => {
  const { url, fingerprint } = req.body ?? {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'A valid URL is required.' });
  }

  if (!isValidHttpUrl(url)) {
    return res.status(400).json({ error: 'Only TikTok, Instagram, or Facebook URLs are supported.' });
  }

  const expectedFingerprint = createRequestFingerprint(url);
  if (!fingerprint || fingerprint !== expectedFingerprint) {
    return res.status(400).json({ error: 'The request fingerprint is invalid.' });
  }

  try {
    const downloadInfo = await extractDownloadInfo(url);
    const id = createSecureId();
    const downloadHash = createDownloadHash(downloadInfo.url);
    const integrityToken = createIntegrityToken(id, downloadInfo.url, secret);

    return res.json({
      id,
      downloadUrl: downloadInfo.url,
      downloadHash,
      integrityToken,
      title: downloadInfo.title
    });
  } catch (error) {
    console.error('Download error', error);
    return res.status(502).json({ error: error.message || 'Failed to process download request.' });
  }
});

app.use((err, req, res, next) => {
  console.error('Unhandled error', err);
  res.status(500).json({ error: 'Unexpected server error.' });
});

const port = Number(process.env.PORT) || 5000;
app.listen(port, () => {
  console.log(`Downloader backend listening on port ${port}`);
});
