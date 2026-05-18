import { Request, Response, NextFunction } from 'express';
import morgan, { StreamOptions } from 'morgan';
import logger from '../Config/logger';

// -------------------------------------------------------------
// 1. Morgan HTTP Logger Setup
// -------------------------------------------------------------

// Override the stream method to send Morgan logs to our Winston logger 'http' level
const stream: StreamOptions = {
  write: (message) => logger.http(message.trim()),
};

// Skip HTTP logging in test environments
const skip = () => {
  const env = process.env.NODE_ENV || 'development';
  return env === 'test';
};

// Morgan request logging middleware
export const httpLoggerMiddleware = morgan(
  ':remote-addr - :method :url :status :res[content-length] - :response-time ms',
  { stream, skip }
);

// -------------------------------------------------------------
// 2. Request Data Redaction / Sanitization (Security Best Practice)
// -------------------------------------------------------------
const sensitiveKeys = [
  'password',
  'token',
  'authorization',
  'cookie',
  'newpassword',
  'oldpassword',
  'confirmpassword',
  'secret',
  'key',
];

/**
 * Recursively redacts sensitive information (like passwords and tokens) from log metadata
 */
function sanitizeObject(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  const sanitized: any = {};
  for (const key of Object.keys(obj)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof obj[key] === 'object') {
      sanitized[key] = sanitizeObject(obj[key]);
    } else {
      sanitized[key] = obj[key];
    }
  }
  return sanitized;
}

// -------------------------------------------------------------
// 3. Global Express Error Handler Middleware
// -------------------------------------------------------------
export const errorHandlerMiddleware = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const status = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error';

  // Gather request-specific contextual metadata for rich logging
  const metadata = {
    path: req.path,
    method: req.method,
    ip: req.ip || req.socket.remoteAddress,
    userId: (req as any).userId || 'unauthenticated',
    userEmail: (req as any).userEmail || null,
    queryParams: sanitizeObject(req.query),
    body: sanitizeObject(req.body),
    headers: {
      host: req.headers.host,
      'user-agent': req.headers['user-agent'],
      accept: req.headers.accept,
      // Intentionally omit cookies/authorization headers to protect user privacy
    },
  };

  // Log the error with high level of detail
  logger.error(`API Failed: ${req.method} ${req.path} - Status: ${status} - Error: ${message}`, {
    metadata,
    stack: err.stack,
  });

  // Respond to the client safely (do not expose full stack trace in production)
  const isDevelopment = (process.env.NODE_ENV || 'development') === 'development';
  res.status(status).json({
    message,
    ...(isDevelopment && { error: err.message, stack: err.stack }),
  });
};
