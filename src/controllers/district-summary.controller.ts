import { Request, Response, NextFunction } from 'express';
import { DistrictSummaryService } from '../services/district-summary.service.js';
import { sendWithETag } from '../utils/etag.util.js';

export class DistrictSummaryController {
  /**
   * GET /api/v1/districts/:districtId/generation-summary
   * (also supports /api/v1/districts/:id/generation-summary)
   *
   * Processing-style derived resource aggregating real-time generation and cumulative
   * daily energy for an entire district.
   * Scoped by ABAC jurisdiction and supports HTTP conditional GET (ETag).
   */
  static async getDistrictGenerationSummary(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const districtId = (req.params.districtId || req.params.id) as string;
      const queryDate = typeof req.query.date === 'string' ? req.query.date : undefined;

      const summary = await DistrictSummaryService.getDistrictSummary(districtId, queryDate);

      sendWithETag(req, res, summary);
    } catch (error) {
      next(error);
    }
  }
}
