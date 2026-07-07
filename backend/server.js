import app from './src/app.js';
import logger from './src/services/logger.js';
import { initialize as initializeDownloader } from './src/services/downloadService.js';

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await initializeDownloader();
    const server = app.listen(PORT, () => {
      logger.info(`Backend listening on port ${PORT}`);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(
          `Port ${PORT} is already in use. Stop the existing backend process or run "npm run dev:stop-port".`
        );
        process.exit(1);
      }

      logger.fatal(error, 'Backend server failed.');
      process.exit(1);
    });
  } catch (error) {
    logger.fatal(error, 'Failed to initialize backend. Shutting down.');
    process.exit(1);
  }
}

startServer();
