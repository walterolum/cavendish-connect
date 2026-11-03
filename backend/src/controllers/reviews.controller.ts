import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { reviewsService } from '../services/reviews.service';
import { successResponse } from '../utils/response';

export class ReviewsController {
  async createReview(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const review = await reviewsService.createReview(req.user!.userId, req.body);
      res.status(201).json(successResponse(review, 'Review created'));
    } catch (error) {
      next(error);
    }
  }

  async getReviewsForTarget(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const targetType = req.params.targetType as string;
      const targetId = parseInt(req.params.targetId as string);
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await reviewsService.getReviewsForTarget(targetType, targetId, page, limit);
      res.json(successResponse({
        reviews: result.reviews,
        averageRating: result.averageRating,
        totalReviews: result.totalReviews,
      }, 'Reviews retrieved', result.meta));
    } catch (error) {
      next(error);
    }
  }

  async deleteReview(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await reviewsService.deleteReview(req.user!.userId, parseInt(req.params.id as string));
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }
}

export const reviewsController = new ReviewsController();
