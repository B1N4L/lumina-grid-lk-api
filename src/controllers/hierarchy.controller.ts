import { Request, Response, NextFunction } from 'express';
import { HierarchyService } from '../services/hierarchy.service.js';
import { sendWithETag } from '../utils/etag.util.js';

export class HierarchyController {
  /**
   * GET /api/v1/provinces
   */
  static async listProvinces(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const provinces = await HierarchyService.listProvinces();
      sendWithETag(req, res, provinces);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/provinces/:id
   */
  static async getProvinceById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const province = await HierarchyService.getProvinceById(req.params.id as string);
      res.status(200).json(province);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/provinces/:id/districts
   */
  static async getDistrictsByProvince(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const districts = await HierarchyService.getDistrictsByProvince(req.params.id as string);
      res.status(200).json(districts);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/districts
   */
  static async listDistricts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const districts = await HierarchyService.listDistricts();
      sendWithETag(req, res, districts);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/districts/:id
   */
  static async getDistrictById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const district = await HierarchyService.getDistrictById(req.params.id as string);
      res.status(200).json(district);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/districts/:id/grid-substations
   */
  static async getSubstationsByDistrict(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const substations = await HierarchyService.getSubstationsByDistrict(req.params.id as string);
      res.status(200).json(substations);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/grid-substations/:id
   */
  static async getSubstationById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const substation = await HierarchyService.getSubstationById(req.params.id as string);
      res.status(200).json(substation);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/grid-substations/:id/installations
   */
  static async getInstallationsBySubstation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const installations = await HierarchyService.getInstallationsBySubstation(req.params.id as string);
      sendWithETag(req, res, installations);
    } catch (error) {
      next(error);
    }
  }
}
