import { logger } from '../utils/logger.js';

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  if (status >= 500) {
    logger.error(`${req.method} ${req.path} → ${status}: ${message}\n${err.stack}`);
  } else {
    logger.warn(`${req.method} ${req.path} → ${status}: ${message}`);
  }

  res.status(status).json({ error: message });
}
