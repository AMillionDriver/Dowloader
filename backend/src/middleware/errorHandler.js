import logger from '../services/logger.js';

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  logger.error(err, 'An unexpected error occurred');

  const statusCode = err.statusCode || 500;
  const message = err.message || 'An unexpected server error occurred.';

  const payload = {
    error: message,
  };

  if (err.code) {
    payload.code = err.code;
  }

  res.status(statusCode).json(payload);
}

export default errorHandler;
