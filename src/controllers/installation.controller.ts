import { Request, Response, NextFunction } from 'express';
import { InstallationService } from '../services/installation.service.js';
import { InstallationQuery } from '../schemas/hierarchy.schema.js';
import { sendWithETag } from '../utils/etag.util.js';

export class InstallationController {
  /**
   * GET /api/v1/installations
   * Collection endpoint with pagination and jurisdiction-scoped filtering
   */
  static async listInstallations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as InstallationQuery;
      const result = await InstallationService.listInstallations(query, req.user!);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/installations/:id
   * Atomic resource endpoint returning installation metadata
   */
  static async getInstallationById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const installation = await InstallationService.getInstallationById(req.params.id as string);
      res.status(200).json(installation);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/installations/:id/composite
   * Composite resource bundling installation, substation, district, province, and operational summary
   */
  static async getInstallationComposite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const composite = await InstallationService.getInstallationComposite(req.params.id as string);
      sendWithETag(req, res, composite);
    } catch (error) {
      next(error);
    }
  }
}

