import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../errors/app-error.js';
import { ErrorDetail } from '../types/error.types.js';

export interface ValidationTargets {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export function validate(schemas: ValidationTargets) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schemas.params) {
        const parsedParams = await schemas.params.parseAsync(req.params);
        try {
          req.params = parsedParams as typeof req.params;
        } catch {
          Object.defineProperty(req, 'params', {
            value: parsedParams,
            writable: true,
            configurable: true,
            enumerable: true,
          });
        }
      }
      if (schemas.query) {
        const parsedQuery = await schemas.query.parseAsync(req.query);
        try {
          req.query = parsedQuery as typeof req.query;
        } catch {
          Object.defineProperty(req, 'query', {
            value: parsedQuery,
            writable: true,
            configurable: true,
            enumerable: true,
          });
        }
      }
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details: ErrorDetail[] = error.issues.map((issue) => ({
          field: issue.path.join('.') || undefined,
          message: issue.message,
          code: issue.code,
        }));
        return next(new ValidationError('Request payload or parameter validation failed', details));
      }
      next(error);
    }
  };
}
