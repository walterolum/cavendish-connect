import { Router } from 'express';
import { body } from 'express-validator';
import { servicesController } from '../controllers/services.controller';
import { authenticate, optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { uploadMultiple } from '../middleware/upload';

const router = Router();

router.get('/', optionalAuth, servicesController.getServices);

router.get('/my-services', authenticate, servicesController.getMyServices);

router.get('/:slug', optionalAuth, servicesController.getService);

router.post('/', authenticate, [
  body('title').trim().notEmpty().isLength({ max: 200 }).withMessage('Title is required (max 200 chars)'),
  body('description').trim().notEmpty().isLength({ max: 5000 }).withMessage('Description is required'),
  body('categoryId').isInt({ min: 1 }).withMessage('Service category is required'),
  body('priceMin').optional().isFloat({ min: 0 }).withMessage('Minimum price must be a positive number'),
  body('priceMax').optional().isFloat({ min: 0 }).withMessage('Maximum price must be a positive number'),
  body('priceType').optional().isIn(['fixed', 'hourly', 'daily', 'negotiable', 'quote']).withMessage('Valid price type is required'),
  body('currency').optional().isIn(['UGX', 'USD', 'KES', 'TZS']),
  body('location').optional().trim(),
  body('availability').optional().trim().isLength({ max: 500 }),
  validate,
], servicesController.createService);

router.put('/:id', authenticate, [
  body('title').optional().trim().isLength({ max: 200 }),
  body('description').optional().trim().isLength({ max: 5000 }),
  body('categoryId').optional().isInt({ min: 1 }),
  body('priceMin').optional().isFloat({ min: 0 }),
  body('priceMax').optional().isFloat({ min: 0 }),
  body('priceType').optional().isIn(['fixed', 'hourly', 'daily', 'negotiable', 'quote']),
  body('currency').optional().isIn(['UGX', 'USD', 'KES', 'TZS']),
  body('location').optional().trim(),
  body('availability').optional().trim().isLength({ max: 500 }),
  validate,
], servicesController.updateService);

router.delete('/:id', authenticate, servicesController.deleteService);

router.post('/:id/images', authenticate, uploadMultiple, servicesController.addImages);

router.post('/:id/portfolio', authenticate, [
  body('title').trim().notEmpty().isLength({ max: 200 }).withMessage('Portfolio title is required'),
  body('description').optional().trim().isLength({ max: 2000 }),
  body('imageUrl').optional().trim().isURL().withMessage('Valid image URL is required'),
  body('link').optional().trim().isURL().withMessage('Valid link is required'),
  body('sortOrder').optional().isInt({ min: 0 }),
  validate,
], servicesController.addPortfolio);

export default router;