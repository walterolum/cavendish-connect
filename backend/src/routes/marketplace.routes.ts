import { Router } from 'express';
import { body } from 'express-validator';
import { marketplaceController } from '../controllers/marketplace.controller';
import { authenticate, optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { uploadMultiple } from '../middleware/upload';

const router = Router();

router.get('/', optionalAuth, marketplaceController.getListings);

router.get('/my-listings', authenticate, marketplaceController.getMyListings);

router.get('/:slug', optionalAuth, marketplaceController.getListing);

router.post('/', authenticate, [
  body('title').trim().notEmpty().isLength({ max: 200 }).withMessage('Title is required (max 200 chars)'),
  body('description').trim().notEmpty().isLength({ max: 5000 }).withMessage('Description is required'),
  body('categoryId').isInt({ min: 1 }).withMessage('Category is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('currency').optional().isIn(['UGX', 'USD', 'KES', 'TZS']),
  body('condition').isIn(['NEW', 'USED_EXCELLENT', 'USED_GOOD', 'USED_FAIR']).withMessage('Valid condition is required'),
  body('quantity').optional().isInt({ min: 1 }),
  body('location').optional().trim(),
  body('isNegotiable').optional().isBoolean(),
  validate,
], marketplaceController.createListing);

router.put('/:id', authenticate, [
  body('title').optional().trim().isLength({ max: 200 }),
  body('description').optional().trim().isLength({ max: 5000 }),
  body('price').optional().isFloat({ min: 0 }),
  body('condition').optional().isIn(['NEW', 'USED_EXCELLENT', 'USED_GOOD', 'USED_FAIR']),
  validate,
], marketplaceController.updateListing);

router.delete('/:id', authenticate, marketplaceController.deleteListing);

router.post('/:id/images', authenticate, uploadMultiple, marketplaceController.addImages);

export default router;
