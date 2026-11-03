import { Router } from 'express';
import { body } from 'express-validator';
import { paymentController, promotionController } from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

router.get('/payments', authenticate, paymentController.getMyPayments);

router.get('/promotions/plans', authenticate, promotionController.getPlans);
router.get('/promotions/settings', authenticate, promotionController.getPromotionSettings);

router.post('/promotions/purchase', authenticate, [
  body('planId').isInt({ min: 1 }).withMessage('Plan is required'),
  body('targetType').isIn(['MARKETPLACE', 'SERVICE', 'ACCOMMODATION']).withMessage('Valid target type is required'),
  body('targetId').isInt({ min: 1 }).withMessage('Target is required'),
  validate,
], promotionController.purchasePromotion);

export default router;