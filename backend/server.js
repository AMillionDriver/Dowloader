const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { createDownloadLink } = require('./utils');

const app = express();

app.use(cors({ origin: true }));
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/download', (req, res) => {
  const { url } = req.body || {};

  if (!url) {
    return res.status(400).json({ error: 'URL wajib diisi.' });
  }

  try {
    const result = createDownloadLink(url);
    return res.json({
      downloadUrl: result.downloadUrl,
      platform: result.platform,
      platformLabel: result.label,
    });
  } catch (error) {
    const statusCode = error.code === 'INVALID_URL' ? 400 : 422;
    return res.status(statusCode).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend berjalan di port ${PORT}`);
});
