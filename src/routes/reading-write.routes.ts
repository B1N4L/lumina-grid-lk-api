import { Router } from 'express';
import { ingestReading } from '../controllers/reading-write.controller.js';
import { authenticateDevice } from '../middleware/auth-device.middleware.js';
import { validate } from '../middleware/validate.js';
import {
  readingIngestionSchema,
  installationIdParamSchema,
} from '../schemas/reading.schema.js';

const router = Router();

/**
 * @route   POST /api/v1/installations/:installationId/readings
 * @desc    Ingest a new time-series generation reading from an authenticated metering device
 * @access  Device Only (X-Device-Key bound to installationId)
 */
router.post(
  '/installations/:installationId/readings',
  authenticateDevice,
  validate({
    params: installationIdParamSchema,
    body: readingIngestionSchema,
  }),
  ingestReading
);

export default router;
