import { Router } from 'express';
import { UserController } from '../controllers/user.controller.js';
import { authenticateUser, requireRole } from '../middleware/auth-user.middleware.js';
import { validate } from '../middleware/validate.js';
import { ForbiddenError } from '../errors/app-error.js';
import {
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
  userQuerySchema,
  userIdParamSchema,
} from '../schemas/user.schema.js';

const router = Router();

// 1. Explicit Write-Read Split Guard: Reject any metering device presenting X-Device-Key
router.use((req, _res, next) => {
  if (req.headers['x-device-key']) {
    return next(
      new ForbiddenError(
        'Access denied: Metering devices are strictly forbidden from accessing user management administrative routes'
      )
    );
  }
  next();
});

// 2. National Admin Centralized RBAC Guard
router.use(authenticateUser);
router.use(requireRole('national_admin'));

/**
 * @route   POST /api/v1/users
 * @desc    Create new SLSEA user with domain jurisdiction check
 * @access  National Admin Only
 */
router.post('/', validate({ body: createUserSchema }), UserController.createUser);

/**
 * @route   GET /api/v1/users
 * @desc    List SLSEA users with filtering and pagination
 * @access  National Admin Only
 */
router.get('/', validate({ query: userQuerySchema }), UserController.listUsers);

/**
 * @route   GET /api/v1/users/:id
 * @desc    Retrieve single user profile (password redacted)
 * @access  National Admin Only
 */
router.get('/:id', validate({ params: userIdParamSchema }), UserController.getUserById);

/**
 * @route   PUT /api/v1/users/:id
 * @desc    Update mutable user profile attributes (blocks self-elevation)
 * @access  National Admin Only
 */
router.put(
  '/:id',
  validate({ params: userIdParamSchema, body: updateUserSchema }),
  UserController.updateUser
);

/**
 * @route   PUT /api/v1/users/:id/password
 * @desc    Reset user password
 * @access  National Admin Only
 */
router.put(
  '/:id/password',
  validate({ params: userIdParamSchema, body: resetPasswordSchema }),
  UserController.resetPassword
);

/**
 * @route   DELETE /api/v1/users/:id
 * @desc    Soft-delete user (status = 'deleted') with lockout guards
 * @access  National Admin Only
 */
router.delete('/:id', validate({ params: userIdParamSchema }), UserController.deleteUser);

export default router;
