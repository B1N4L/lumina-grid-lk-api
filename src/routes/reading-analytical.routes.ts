import { Router } from 'express';
import { ReadingAnalyticalController } from '../controllers/reading-analytical.controller.js';
import { authenticateUser } from '../middleware/auth-user.middleware.js';
import { requireJurisdiction } from '../middleware/require-jurisdiction.middleware.js';
import { validate } from '../middleware/validate.js';
import { installationIdParamSchema } from '../schemas/reading.schema.js';
import { readingsQuerySchema } from '../schemas/query.schema.js';

const router = Router();

/**
 * @route   GET /api/v1/installations/:installationId/readings
 * @desc    Analytical historical generation readings sub-collection
 * @access  Bearer JWT (SLSEA Personnel - Jurisdiction Scoped)
 */
router.get(
  '/installations/:installationId/readings',
  authenticateUser,
  validate({
    params: installationIdParamSchema,
    query: readingsQuerySchema,
  }),
  requireJurisdiction({
    entityType: 'installation',
    paramName: 'installationId',
  }),
  ReadingAnalyticalController.getHistoricalReadings
);

export default router;
