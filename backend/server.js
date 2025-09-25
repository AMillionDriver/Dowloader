const express = require('express');
const cors = require('cors');
const { getDownloadInfo, DownloadError } = require('./utils');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: true }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/download', async (req, res) => {
  const { url } = req.body || {};

  try {
    const payload = await getDownloadInfo(url);
    res.json(payload);
  } catch (error) {
    if (error instanceof DownloadError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    console.error('Unexpected error while processing download request', error);
    res.status(500).json({ error: 'Failed to prepare the download link. Please try again later.' });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Video downloader backend listening on port ${PORT}`);
});
