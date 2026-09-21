import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Hash plain-text password using bcrypt with 10 salt rounds
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare plain-text password against stored bcrypt hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Hash raw device API key using SHA-256 for secure database lookup
 */
export function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}
