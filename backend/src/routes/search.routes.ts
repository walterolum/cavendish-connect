import { Router } from 'express';
import { query } from 'express-validator';
import { searchController } from '../controllers/search.controller';
import { validate } from '../middleware/validate';

const router = Router();

router.get('/', [
  query('q').trim().notEmpty().withMessage('Search query is required'),
  query('type').optional().isIn(['all', 'marketplace', 'services', 'accommodation']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  validate,
], searchController.search);

export default router;
