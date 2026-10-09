import { Request, Response, NextFunction } from 'express';
import { NotFoundError } from '../errors/app-error.js';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError(`Resource '${req.method} ${req.originalUrl}' does not exist`));
}
