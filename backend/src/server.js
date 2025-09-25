import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import hpp from 'hpp';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';

import downloadRouter from './routes/downloadRoutes.js';
import securityRouter from './routes/securityRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:3000';

app.use(cors({
  origin: clientOrigin,
  credentials: false,
}));

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(hpp());
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

const limiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/security', securityRouter);
app.use('/api/download', downloadRouter);

app.use(errorHandler);

const port = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Secure downloader backend listening on port ${port}`);
  });
}

export default app;
