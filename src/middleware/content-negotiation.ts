import { Request, Response, NextFunction } from 'express';
import { NotAcceptableError } from '../errors/app-error.js';

/**
 * Content Negotiation Middleware
 *
 * Enforces Richardson Maturity Model Level 2 content negotiation:
 * - Ensures client accepts 'application/json' or wildcard representations.
 * - Rejects unsupported media types (e.g. text/xml, application/xml) with 406 Not Acceptable.
 * - Exempts documentation routes (/docs) to permit HTML rendering for Swagger UI.
 */
export function contentNegotiation(req: Request, res: Response, next: NextFunction): void {
  // Allow browser navigation to interactive documentation and specification files
  if (req.path.includes('/docs') || req.path.includes('/openapi') || req.path === '/favicon.ico') {
    return next();
  }

  const acceptHeader = req.headers.accept;

  // No Accept header implies client accepts standard default representation
  if (!acceptHeader) {
    res.type('application/json');
    return next();
  }

  // Check if client accepts application/json or general wildcards
  const acceptsJson = req.accepts(['application/json', 'json']);

  if (!acceptsJson) {
    return next(
      new NotAcceptableError(
        `Media type '${acceptHeader}' is not acceptable. Only 'application/json' is supported by this API.`
      )
    );
  }

  res.type('application/json');
  next();
}
