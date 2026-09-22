import { Router } from 'express';
import { HierarchyController } from '../controllers/hierarchy.controller.js';
import { authenticateUser, requireRole } from '../middleware/auth-user.middleware.js';
import { requireJurisdiction } from '../middleware/require-jurisdiction.middleware.js';
import { validate } from '../middleware/validate.js';
import {
  provinceParamsSchema,
  districtParamsSchema,
} from '../schemas/hierarchy.schema.js';

const router = Router();

// Protect all hierarchy routes with SLSEA Bearer JWT
router.use(authenticateUser);

/**
 * Province Endpoints
 */
// GET /api/v1/provinces - Collection (National Admin only)
router.get(
  '/provinces',
  requireRole('national_admin'),
  HierarchyController.listProvinces
);

// GET /api/v1/provinces/:id - Atomic (National / Assigned Province)
router.get(
  '/provinces/:id',
  validate({ params: provinceParamsSchema }),
  requireJurisdiction({ entityType: 'province' }),
  HierarchyController.getProvinceById
);

// GET /api/v1/provinces/:id/districts - Scoped Collection (National / Assigned Province)
router.get(
  '/provinces/:id/districts',
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
  requireRole('national_admin'),
  HierarchyController.listDistricts
);

// GET /api/v1/districts/:id - Atomic (National / Assigned District)
router.get(
  '/districts/:id',
  validate({ params: districtParamsSchema }),
  requireJurisdiction({ entityType: 'district' }),
  HierarchyController.getDistrictById
);

// GET /api/v1/districts/:id/grid-substations - Scoped Collection (National / Assigned District)
router.get(
  '/districts/:id/grid-substations',
  validate({ params: districtParamsSchema }),
  requireJurisdiction({ entityType: 'district', paramName: 'id' }),
  HierarchyController.getSubstationsByDistrict
);

export default router;
