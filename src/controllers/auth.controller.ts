import { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { AuthService } from '../services/auth.service.js';

export const login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const result = await AuthService.login(req.body);
  res.status(200).json(result);
});
