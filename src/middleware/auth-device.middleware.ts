import { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db, solarInstallations } from '../db/index.js';
import { hashApiKey } from '../utils/crypto.js';
import { UnauthorizedError, ForbiddenError } from '../errors/app-error.js';

/**
 * Middleware enforcing device authentication via X-Device-Key header.
 * Ensures the device key is valid, the corresponding solar installation is active,
 * and the target route parameter matches the installation assigned to the key.
 */
export async function authenticateDevice(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawApiKey = req.headers['x-device-key'];

    if (!rawApiKey || typeof rawApiKey !== 'string' || rawApiKey.trim() === '') {
      throw new UnauthorizedError('Device API key required in X-Device-Key header');
    }

    const keyHash = hashApiKey(rawApiKey.trim());

    const [installation] = await db
      .select({
        id: solarInstallations.id,
        meterId: solarInstallations.meterId,
        name: solarInstallations.name,
        status: solarInstallations.status,
      })
      .from(solarInstallations)
      .where(eq(solarInstallations.apiKeyHash, keyHash))
      .limit(1);

    if (!installation) {
      throw new UnauthorizedError('Invalid device API key');
    }

    if (installation.status !== 'active') {
      throw new ForbiddenError(
        `Installation '${installation.id}' is currently ${installation.status} and cannot ingest readings`
      );
    }

    // Path parameter verification: route parameter must strictly match the device's installation
    const targetInstallationId = req.params.installationId || req.params.id;
    if (targetInstallationId && targetInstallationId !== installation.id) {
      throw new ForbiddenError(
        `Access denied: Device is only authorized for installation '${installation.id}', not '${targetInstallationId}'`
      );
    }

    // Attach verified device context to request
    req.device = {
      installationId: installation.id,
      meterId: installation.meterId,
      name: installation.name,
    };

    next();
  } catch (error) {
    next(error);
  }
}
