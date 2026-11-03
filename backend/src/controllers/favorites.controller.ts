import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { favoritesService } from '../services/favorites.service';
import { successResponse } from '../utils/response';

export class FavoritesController {
  async toggleFavorite(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { targetType, targetId } = req.body;
      const result = await favoritesService.toggleFavorite(
        req.user!.userId,
        targetType,
        parseInt(targetId)
      );
      res.json(successResponse(result, result.favorited ? 'Added to favorites' : 'Removed from favorites'));
    } catch (error) {
      next(error);
    }
  }

  async getUserFavorites(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const type = req.query.type as string;
      const result = await favoritesService.getUserFavorites(req.user!.userId, type, page, limit);
      res.json(successResponse(result.favorites, 'Favorites retrieved', result.meta));
    } catch (error) {
      next(error);
    }
  }

  async checkFavorited(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { targetType, targetId } = req.query;
      const result = await favoritesService.checkFavorited(
        req.user!.userId,
        targetType as string,
        parseInt(targetId as string)
      );
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }
}

export const favoritesController = new FavoritesController();
