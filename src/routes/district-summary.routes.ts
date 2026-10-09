import { Router } from 'express';
import { DistrictSummaryController } from '../controllers/district-summary.controller.js';
import { authenticateUser } from '../middleware/auth-user.middleware.js';
import { requireJurisdiction } from '../middleware/require-jurisdiction.middleware.js';
import { validate } from '../middleware/validate.js';
import { districtSummaryParamsSchema } from '../schemas/hierarchy.schema.js';

const router = Router();

/**
 * @route   GET /api/v1/districts/:districtId/generation-summary
 * @route   GET /api/v1/districts/:id/generation-summary
 * @desc    Upper-band stretch goal: Aggregated real-time generation and cumulative daily energy
 * @access  Bearer JWT (National Admin or Assigned District Operator / Provincial Analyst)
 */
router.get(
  '/districts/:districtId/generation-summary',
  authenticateUser,
  validate({ params: districtSummaryParamsSchema }),
  requireJurisdiction({ entityType: 'district', paramName: 'districtId' }),
  DistrictSummaryController.getDistrictGenerationSummary
);

router.get(
  '/districts/:id/generation-summary',
  authenticateUser,
  validate({ params: districtSummaryParamsSchema }),
  requireJurisdiction({ entityType: 'district', paramName: 'id' }),
  DistrictSummaryController.getDistrictGenerationSummary
);

export default router;
