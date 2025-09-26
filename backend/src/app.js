import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import downloadRoutes from './routes/downloadRoutes.js';
import errorHandler from './middleware/errorHandler.js';
import logger from './services/logger.js';

dotenv.config();

const app = express();

// --- Middleware ---
app.use(helmet()); // Apply basic security headers
app.use(express.json()); // Parse JSON bodies

// CORS configuration
const rawOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const allowOrigins = rawOrigin === '*'
  ? rawOrigin
  : rawOrigin.split(',').map((origin) => origin.trim());

app.use(cors({
  origin: allowOrigins,
}));

// --- Routes ---
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', downloadRoutes);

// --- Error Handling ---
app.use(errorHandler);

// --- 404 Handler for unknown routes ---
app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});


export default app;
