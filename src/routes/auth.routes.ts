import { Router } from 'express';
import { login } from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { loginSchema } from '../schemas/auth.schema.js';

const router = Router();

/**
 * @route   POST /api/v1/auth/login
 * @desc    Authenticate SLSEA user and receive signed JWT with role and jurisdiction claims
 * @access  Public
 */
router.post('/login', validate({ body: loginSchema }), login);

export default router;
