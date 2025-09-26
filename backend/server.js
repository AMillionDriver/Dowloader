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

// A simple regex to validate URL format. The frontend has more specific validation.
const URL_REGEX = /^(http(s)?:\/\/.)[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)$/;

app.post('/api/download', async (req, res) => {
  const { url } = req.body || {};

  if (!url) {
    return res.status(400).json({ error: 'Video URL is required' });
  }

  // Basic backend validation to complement the more specific frontend validation.
  if (!URL_REGEX.test(url)) {
    return res.status(400).json({ error: 'Please enter a valid URL' });
  }

  try {
    const downloadUrl = await resolveDownload(url);

    if (!downloadUrl) {
      return res.status(404).json({ error: 'This video platform is not supported or the link is invalid.' });
    }

    res.json({ downloadUrl });
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'An unexpected error occurred on the server.' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
