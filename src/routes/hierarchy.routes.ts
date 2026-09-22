import { Router } from 'express';
import { HierarchyController } from '../controllers/hierarchy.controller.js';
import { authenticateUser, requireRole } from '../middleware/auth-user.middleware.js';
import { requireJurisdiction } from '../middleware/require-jurisdiction.middleware.js';
import { validate } from '../middleware/validate.js';
import {
  provinceParamsSchema,
  districtParamsSchema,
  substationParamsSchema,
} from '../schemas/hierarchy.schema.js';

const router = Router();

/**
 * Province Endpoints
 */
// GET /api/v1/provinces - Collection (National Admin only)
router.get(
  '/provinces',
  authenticateUser,
  requireRole('national_admin'),
  HierarchyController.listProvinces
);

// GET /api/v1/provinces/:id - Atomic (National / Assigned Province)
router.get(
  '/provinces/:id',
  authenticateUser,
  validate({ params: provinceParamsSchema }),
  requireJurisdiction({ entityType: 'province' }),
  HierarchyController.getProvinceById
);

// GET /api/v1/provinces/:id/districts - Scoped Collection (National / Assigned Province)
router.get(
  '/provinces/:id/districts',
  authenticateUser,
  validate({ params: provinceParamsSchema }),
  requireJurisdiction({ entityType: 'province', paramName: 'id' }),
  HierarchyController.getDistrictsByProvince
);

/**
 * District Endpoints
 */
// GET /api/v1/districts - Collection (National Admin only)
router.get(
  '/districts',
  authenticateUser,
  requireRole('national_admin'),
  HierarchyController.listDistricts
);

// GET /api/v1/districts/:id - Atomic (National / Assigned District)
router.get(
  '/districts/:id',
  authenticateUser,
  validate({ params: districtParamsSchema }),
  requireJurisdiction({ entityType: 'district' }),
  HierarchyController.getDistrictById
);

// GET /api/v1/districts/:id/grid-substations - Scoped Collection (National / Assigned District)
router.get(
  '/districts/:id/grid-substations',
  authenticateUser,
  validate({ params: districtParamsSchema }),
  requireJurisdiction({ entityType: 'district', paramName: 'id' }),
  HierarchyController.getSubstationsByDistrict
);

/**
 * Grid Substation Endpoints
 */
// GET /api/v1/grid-substations/:id - Atomic (Jurisdiction Scoped)
router.get(
  '/grid-substations/:id',
  authenticateUser,
  validate({ params: substationParamsSchema }),
  requireJurisdiction({ entityType: 'substation' }),
  HierarchyController.getSubstationById
);

// GET /api/v1/grid-substations/:id/installations - Scoped Collection (Jurisdiction Scoped)
router.get(
  '/grid-substations/:id/installations',
  authenticateUser,
  validate({ params: substationParamsSchema }),
  requireJurisdiction({ entityType: 'substation', paramName: 'id' }),
  HierarchyController.getInstallationsBySubstation
);

export default router;
