import { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { UserService } from '../services/user.service.js';

export class UserController {
  /**
   * POST /api/v1/users
   * Creates a new SLSEA user with sanitized output and Location header
   */
  static createUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = await UserService.createUser(req.body);
    res.setHeader('Location', `/api/v1/users/${user.id}`);
    res.status(201).json(user);
  });

  /**
   * GET /api/v1/users
   * Returns paginated collection of users filtered by role, status, and jurisdiction
   */
  static listUsers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const result = await UserService.listUsers(req.query as unknown as Parameters<typeof UserService.listUsers>[0]);
    res.status(200).json(result);
  });

  /**
   * GET /api/v1/users/:id
   * Returns single user representation, 404 if nonexistent or soft-deleted
   */
  static getUserById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const user = await UserService.getUserById(id);
    res.status(200).json(user);
  });

  /**
   * PUT /api/v1/users/:id
   * Updates mutable profile attributes; blocks self-elevation
   */
  static updateUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const currentAdminId = req.user!.sub;
    const updatedUser = await UserService.updateUser(id, req.body, currentAdminId);
    res.status(200).json(updatedUser);
  });

  /**
   * PUT /api/v1/users/:id/password
   * Dedicated password reset endpoint for administrators
   */
  static resetPassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    await UserService.resetPassword(id, req.body);
    res.status(200).json({
      status: 'success',
      message: 'User password has been reset successfully',
    });
  });

  /**
   * DELETE /api/v1/users/:id
   * Soft-deletes user; guards against self-deletion and last-admin lockout
   */
  static deleteUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const currentAdminId = req.user!.sub;
    const result = await UserService.deleteUser(id, currentAdminId);
    res.status(200).json(result);
  });
}
