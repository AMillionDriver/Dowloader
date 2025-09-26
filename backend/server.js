import app from './src/app.js';
import logger from './src/services/logger.js';
import { initialize as initializeDownloader } from './src/services/downloadService.js';

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await initializeDownloader();
    app.listen(PORT, () => {
      logger.info(`Backend listening on port ${PORT}`);
    });
  } catch (error) {
    logger.fatal(error, 'Failed to initialize backend. Shutting down.');
    process.exit(1);
  }
}

startServer();
