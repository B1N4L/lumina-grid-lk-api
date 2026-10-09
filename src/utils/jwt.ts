import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/environment.js';
import { UserTokenPayload } from '../types/auth.types.js';
import { UnauthorizedError } from '../errors/app-error.js';

const JWT_SECRET = env.JWT_SECRET || 'dev-secret-key-change-in-production-min-32-chars-long!';
const ISSUER = 'slsea.gov.lk';
const AUDIENCE = 'slsea-api-clients';

/**
 * Sign JWT token for authenticated SLSEA user containing role and jurisdiction claims
 */
export function signUserToken(payload: UserTokenPayload, expiresIn: string = '24h'): string {
  const options: SignOptions = {
    expiresIn: expiresIn as SignOptions['expiresIn'],
    issuer: ISSUER,
    audience: AUDIENCE,
  };

  return jwt.sign(payload, JWT_SECRET, options);
}

/**
 * Verify incoming Bearer JWT and return typed user token payload
 */
export function verifyUserToken(token: string): UserTokenPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: ISSUER,
      audience: AUDIENCE,
    }) as UserTokenPayload;

    return decoded;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Authentication token has expired');
    }
    if (err instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError('Invalid authentication token');
    }
    throw new UnauthorizedError('Failed to authenticate token');
  }
}
