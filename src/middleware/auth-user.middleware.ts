import { Request, Response, NextFunction } from 'express';
import { verifyUserToken } from '../utils/jwt.js';
import { UnauthorizedError, ForbiddenError } from '../errors/app-error.js';
import { UserRole } from '../types/auth.types.js';

/**
 * Middleware verifying JWT Bearer tokens from SLSEA personnel
 * Populates req.user with decoded identity, role, and jurisdiction claims
 */
export function authenticateUser(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedError('Authentication required: Missing Authorization header');
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Invalid authorization format: Expected "Bearer <token>"');
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      throw new UnauthorizedError('Authentication required: Bearer token is empty');
    }

    const payload = verifyUserToken(token);
    req.user = payload;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware restricting access to specified user roles
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required: No active user session'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Forbidden: Insufficient privileges. Required role(s): ${allowedRoles.join(', ')}`
        )
      );
    }

    next();
  };
}
