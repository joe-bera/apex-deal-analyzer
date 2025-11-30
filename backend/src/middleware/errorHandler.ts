import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';

/**
 * Custom error class for application errors
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Global error handling middleware
 * Catches all errors and sends appropriate responses
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Default to 500 server error
  let statusCode = 500;
  let message = 'Internal server error';

  // If it's our custom AppError, use its properties
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  }

  // Log error details (in development, log stack trace)
  if (config.server.isDevelopment) {
    console.error('Error occurred:', {
      statusCode,
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  } else {
    // In production, log less detail
    console.error('Error occurred:', {
      statusCode,
      message: err.message,
      path: req.path,
    });
  }

  // Send error response (never expose stack traces to client)
  res.status(statusCode).json({
    success: false,
    error: message,
    ...(config.server.isDevelopment && { stack: err.stack }), // Include stack in dev only
  });
};

/**
 * 404 Not Found handler
 * Should be registered after all routes
 */
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path,
  });
};
