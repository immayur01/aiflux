import winston from 'winston';

const { combine, timestamp, printf, colorize } = winston.format;

const fmt = printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level}] ${message}`;
});

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), fmt),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: 'HH:mm:ss' }), fmt),
    }),
    new winston.transports.File({
      filename: './data/logs/error.log',
      level: 'error',
      maxsize: 5 * 1024 * 1024,
      maxFiles: 3,
    }),
    new winston.transports.File({
      filename: './data/logs/combined.log',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
});
