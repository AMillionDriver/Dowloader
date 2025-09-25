require('dotenv').config();
const express = require('express');
const compression = require('compression');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const { APP_NAME, PORT } = require('./config/app-config');
const downloadRouter = require('./routes/download');
const { notFoundHandler, errorHandler } = require('./middleware/error-handler');
const logger = require('./config/logger');

const app = express();

app.disable('x-powered-by');
app.use(logger);
app.use(morgan('combined'));
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'default-src': ["'self'"],
      'img-src': ["'self'", 'data:', 'https:'],
    },
  },
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: false,
}));
app.use(compression());
app.use(express.json({ limit: '1mb' }));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: APP_NAME, timestamp: new Date().toISOString() });
});

app.use('/api', downloadRouter);

app.use(notFoundHandler);
app.use(errorHandler);

function start() {
  app.listen(PORT, () => {
    console.log(`${APP_NAME} server berjalan di port ${PORT}`); // eslint-disable-line no-console
  });
}

if (require.main === module) {
  start();
}

module.exports = { app, start };
