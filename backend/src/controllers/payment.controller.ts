import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { paymentService, promotionService } from '../services/payment.service';
import { successResponse, paginate } from '../utils/response';

export class PaymentController {
  async getMyPayments(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await paymentService.getMyPayments(req.user!.userId, page, limit);
      res.json(successResponse(result.payments, 'Payments retrieved', paginate(result.total, page, limit)));
    } catch (error) {
      next(error);
    }
  }
}

export class PromotionController {
  async getPlans(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const plans = await promotionService.getPlans();
      res.json(successResponse(plans));
    } catch (error) {
      next(error);
    }
  }

  async getPromotionSettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const settings = await promotionService.getPromotionSettings();
      res.json(successResponse(settings));
    } catch (error) {
      next(error);
    }
  }

  async purchasePromotion(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { planId, targetType, targetId } = req.body;
      const purchase = await promotionService.purchasePromotion(
        req.user!.userId,
        planId,
        targetType,
        targetId
      );
      res.status(201).json(successResponse(purchase, 'Promotion activated'));
    } catch (error) {
      next(error);
    }
  }
}

export const paymentController = new PaymentController();
export const promotionController = new PromotionController();