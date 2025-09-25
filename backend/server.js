import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { fetchDownloadLink } from './utils.js';

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.use(cors({
  origin: CLIENT_ORIGIN,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/download', async (req, res) => {
  const { url } = req.body ?? {};

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'A valid video URL is required.' });
  }

  try {
    const downloadInfo = await fetchDownloadLink(url);
    res.json(downloadInfo);
  } catch (error) {
    console.error('Failed to process download request:', error);

    if (error?.message?.toLowerCase().includes('unsupported url')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Unable to process the download request at this time.' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});
