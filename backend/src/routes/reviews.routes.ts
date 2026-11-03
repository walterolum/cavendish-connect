import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { reviewsController } from '../controllers/reviews.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

router.post('/', authenticate, [
  body('targetType').isIn(['SELLER', 'SERVICE_PROVIDER', 'LANDLORD', 'BUSINESS']).withMessage('Valid target type is required'),
  body('targetId').isInt({ min: 1 }).withMessage('Valid target ID is required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('title').optional().trim().isLength({ max: 200 }),
  body('content').optional().trim().isLength({ max: 2000 }),
  validate,
], reviewsController.createReview);

router.get('/:targetType/:targetId', [
  param('targetType').isIn(['SELLER', 'SERVICE_PROVIDER', 'LANDLORD', 'BUSINESS']),
  param('targetId').isInt({ min: 1 }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  validate,
], reviewsController.getReviewsForTarget);

router.delete('/:id', authenticate, reviewsController.deleteReview);

export default router;
