import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { servicesService } from '../services/services.service';
import { successResponse } from '../utils/response';

export class ServicesController {
  async createService(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const service = await servicesService.createService(req.user!.userId, req.body);
      res.status(201).json(successResponse(service, 'Service created'));
    } catch (error) {
      next(error);
    }
  }

  async getService(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const service = await servicesService.getService(req.params.slug as string, req.user);
      res.json(successResponse(service));
    } catch (error) {
      next(error);
    }
  }

  async getServices(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, category, minPrice, maxPrice, search, sort, location } = req.query;
      const result = await servicesService.getServices({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        category: category as string,
        minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
        search: search as string,
        sort: sort as string,
        location: location as string,
      });
      res.json(successResponse(result.services, 'Services retrieved', result.meta));
    } catch (error) {
      next(error);
    }
  }

  async updateService(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const service = await servicesService.updateService(
        req.user!.userId,
        parseInt(req.params.id as string),
        req.body
      );
      res.json(successResponse(service, 'Service updated'));
    } catch (error) {
      next(error);
    }
  }

  async deleteService(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await servicesService.deleteService(req.user!.userId, parseInt(req.params.id as string));
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async addImages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const images = await servicesService.addImages(
        req.user!.userId,
        parseInt(req.params.id as string),
        req.files as Express.Multer.File[]
      );
      res.status(201).json(successResponse(images, 'Images uploaded'));
    } catch (error) {
      next(error);
    }
  }

  async addPortfolio(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const portfolio = await servicesService.addPortfolio(
        req.user!.userId,
        parseInt(req.params.id as string),
        req.body
      );
      res.status(201).json(successResponse(portfolio, 'Portfolio item added'));
    } catch (error) {
      next(error);
    }
  }

  async getMyServices(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await servicesService.getMyServices(req.user!.userId, page, limit);
      res.json(successResponse(result.services, 'My services', result.meta));
    } catch (error) {
      next(error);
    }
  }
}

export const servicesController = new ServicesController();