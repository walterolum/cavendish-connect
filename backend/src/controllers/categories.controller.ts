import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { categoriesService } from '../services/categories.service';
import { successResponse } from '../utils/response';

export class CategoriesController {
  async getAllActiveCategories(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const categories = await categoriesService.getAllActiveCategories();
      res.json(successResponse(categories, 'Categories retrieved'));
    } catch (error) {
      next(error);
    }
  }

  async getCategoryBySlug(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const category = await categoriesService.getCategoryBySlug(req.params.slug as string);
      res.json(successResponse(category));
    } catch (error) {
      next(error);
    }
  }

  async getServiceCategories(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const categories = await categoriesService.getActiveServiceCategories();
      res.json(successResponse(categories, 'Service categories retrieved'));
    } catch (error) {
      next(error);
    }
  }

  async getPropertyCategories(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const categories = await categoriesService.getActivePropertyCategories();
      res.json(successResponse(categories, 'Property categories retrieved'));
    } catch (error) {
      next(error);
    }
  }

  async createCategory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const category = await categoriesService.createCategory(req.body);
      res.status(201).json(successResponse(category, 'Category created'));
    } catch (error) {
      next(error);
    }
  }

  async updateCategory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const category = await categoriesService.updateCategory(parseInt(req.params.id as string), req.body);
      res.json(successResponse(category, 'Category updated'));
    } catch (error) {
      next(error);
    }
  }

  async deleteCategory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await categoriesService.deleteCategory(parseInt(req.params.id as string));
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }
}

export const categoriesController = new CategoriesController();
