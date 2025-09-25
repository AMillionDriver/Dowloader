import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { resolveDownload } from './utils.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const rawOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const allowOrigins = rawOrigin === '*'
  ? rawOrigin
  : rawOrigin.split(',').map((origin) => origin.trim());

app.use(cors({
  origin: allowOrigins,
}));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/download', async (req, res) => {
  const { url } = req.body || {};

  if (!url) {
    return res.status(400).json({ error: 'Video URL is required' });
  }

  try {
    const downloadUrl = await resolveDownload(url);

    if (!downloadUrl) {
      return res.status(404).json({ error: 'Unable to resolve download link for the provided URL' });
    }

    res.json({ downloadUrl });
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Unexpected server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
