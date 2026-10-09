import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error.js';
import { ApiErrorResponse, ErrorDetail } from '../types/error.types.js';
import { logger } from '../config/logger.js';
import { env } from '../config/environment.js';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const timestamp = new Date().toISOString();
  const path = req.originalUrl || req.url;

  // 1. Handled AppError instances
  if (err instanceof AppError) {
    const responsePayload: ApiErrorResponse = {
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        timestamp,
        path,
      },
    };

    if (err.statusCode >= 500) {
      logger.error({ err, path, method: req.method }, `Server error: ${err.message}`);
    }

    res.status(err.statusCode).json(responsePayload);
    return;
  }

  // 2. Direct Zod validation errors
  if (err instanceof ZodError) {
    const details: ErrorDetail[] = err.issues.map((issue) => ({
      field: issue.path.join('.') || undefined,
      message: issue.message,
      code: issue.code,
    }));

    const responsePayload: ApiErrorResponse = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request payload or parameter validation failed',
        details,
        timestamp,
        path,
      },
    };

    res.status(400).json(responsePayload);
    return;
  }

  // 3. JSON body parser syntax errors
  if (err instanceof SyntaxError && 'status' in err && (err as { status: number }).status === 400) {
    const responsePayload: ApiErrorResponse = {
      error: {
        code: 'MALFORMED_JSON',
        message: 'Malformed JSON payload in request body',
        details: [],
        timestamp,
        path,
      },
    };

    res.status(400).json(responsePayload);
    return;
  }

  // 4. Uncaught / Unexpected internal errors
  logger.error({ err, path, method: req.method }, 'Unhandled internal server exception');

  const responsePayload: ApiErrorResponse = {
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: env.NODE_ENV === 'production'
        ? 'An unexpected server error occurred'
        : err instanceof Error ? err.message : 'Unknown internal error',
      details: [],
      timestamp,
      path,
    },
  };

  res.status(500).json(responsePayload);
}
