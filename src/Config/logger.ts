import winston from 'winston';
import fs from 'fs';
import path from 'path';

// Define the root logs directory in the project
const logDir = path.join(process.cwd(), 'logs');

// Ensure the logs directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Define logging levels (syslog order)
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define clean colors for each log type
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'cyan',
};

// Add colors to Winston
winston.addColors(colors);

// Dynamically fetch the current environment level
const getLogLevel = (): string => {
  const env = process.env.NODE_ENV || 'development';
  return env === 'development' ? 'debug' : 'info';
};

// Console logger formatting (highly human-readable, colorized, with structured details)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, stack, metadata, ...rest } = info;
    let log = `[${timestamp}] ${level}: ${message}`;

    if (stack) {
      log += `\nStack trace:\n${stack}`;
    }

    const extraMetadata = metadata || (Object.keys(rest).length > 0 ? rest : null);
    if (extraMetadata) {
      log += `\nMetadata: ${JSON.stringify(extraMetadata, null, 2)}`;
    }

    return log;
  })
);

// File logger formatting (structured JSON for log aggregators or automated scripts)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Configure transports
const transports: winston.transport[] = [
  // 1. Console Transport
  new winston.transports.Console({
    format: consoleFormat,
  }),
  // 2. Error File Transport (captures errors only)
  new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    level: 'error',
    format: fileFormat,
  }),
  // 3. Combined File Transport (captures all logs)
  new winston.transports.File({
    filename: path.join(logDir, 'combined.log'),
    format: fileFormat,
  }),
];

// Instantiate the Winston Logger
const logger = winston.createLogger({
  level: getLogLevel(),
  levels,
  transports,
});

export default logger;
