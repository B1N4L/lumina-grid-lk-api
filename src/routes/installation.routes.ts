import { Router } from 'express';
import { InstallationController } from '../controllers/installation.controller.js';
import { authenticateUser } from '../middleware/auth-user.middleware.js';
import {
  requireJurisdiction,
  enforceQueryJurisdiction,
} from '../middleware/require-jurisdiction.middleware.js';
import { validate } from '../middleware/validate.js';
import {
  installationParamsSchema,
  installationQuerySchema,
} from '../schemas/hierarchy.schema.js';

const router = Router();

// Protect all installation operational read routes with SLSEA Bearer JWT
router.use(authenticateUser);

/**
 * Solar Installation Endpoints
 */
// GET /api/v1/installations - Collection (Jurisdiction Scoped, Paginated, Filterable)
router.get(
  '/installations',
  validate({ query: installationQuerySchema }),
  enforceQueryJurisdiction,
  InstallationController.listInstallations
);

// GET /api/v1/installations/:id - Atomic (Jurisdiction Scoped)
router.get(
  '/installations/:id',
  validate({ params: installationParamsSchema }),
  requireJurisdiction({ entityType: 'installation' }),
  InstallationController.getInstallationById
);

// GET /api/v1/installations/:id/composite - Composite Resource (Jurisdiction Scoped)
router.get(
  '/installations/:id/composite',
  validate({ params: installationParamsSchema }),
  requireJurisdiction({ entityType: 'installation' }),
  InstallationController.getInstallationComposite
);

export default router;
