import { Router } from 'express';
import { body, query } from 'express-validator';
import { favoritesController } from '../controllers/favorites.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

router.post('/toggle', authenticate, [
  body('targetType').isIn(['MARKETPLACE', 'SERVICE', 'ACCOMMODATION']).withMessage('Valid target type is required'),
  body('targetId').isInt({ min: 1 }).withMessage('Valid target ID is required'),
  validate,
], favoritesController.toggleFavorite);

router.get('/', authenticate, [
  query('type').optional().isIn(['MARKETPLACE', 'SERVICE', 'ACCOMMODATION']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  validate,
], favoritesController.getUserFavorites);

router.get('/check', authenticate, [
  query('targetType').isIn(['MARKETPLACE', 'SERVICE', 'ACCOMMODATION']).withMessage('Valid target type is required'),
  query('targetId').isInt({ min: 1 }).withMessage('Valid target ID is required'),
  validate,
], favoritesController.checkFavorited);

export default router;
