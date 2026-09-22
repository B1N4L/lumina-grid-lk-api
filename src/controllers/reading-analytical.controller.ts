import { Request, Response, NextFunction } from 'express';
import { env } from '../config/environment.js';
import { ReadingQueryService } from '../services/reading-query.service.js';
import { CanonicalReadingsQuery } from '../schemas/query.schema.js';
import { buildHateoasLinks, createPaginatedEnvelope } from '../utils/pagination.js';
import { sendConditionalResponse } from '../middleware/etag.middleware.js';

export class ReadingAnalyticalController {
  /**
   * GET /api/v1/installations/:installationId/readings
   * Analytical historical generation readings sub-collection endpoint
   * Supports multi-field filtering, sorting, HATEOAS pagination, and conditional GET caching.
   */
  static async getHistoricalReadings(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const installationId = req.params.installationId as string;
      const query = req.query as unknown as CanonicalReadingsQuery;

      const result = await ReadingQueryService.queryReadings(installationId, query);

      const basePath = `${env.API_PREFIX}/installations/${installationId}/readings`;
      const links = buildHateoasLinks(basePath, query, result.totalPages);

      const envelope = createPaginatedEnvelope(
        result.readings,
        result.page,
        result.limit,
        result.totalCount,
        result.totalPages,
        links
      );

      sendConditionalResponse(req, res, envelope, {
        lastModified: result.maxTimestamp,
      });
    } catch (error) {
      next(error);
    }
  }
}
