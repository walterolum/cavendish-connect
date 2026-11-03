import { Router } from 'express';
import { body, param } from 'express-validator';
import { categoriesController } from '../controllers/categories.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

router.get('/', categoriesController.getAllActiveCategories);

router.get('/services', categoriesController.getServiceCategories);

router.get('/properties', categoriesController.getPropertyCategories);

router.get('/:slug', [
  param('slug').trim().notEmpty(),
  validate,
], categoriesController.getCategoryBySlug);

router.post('/', authenticate, authorize('ADMIN'), [
  body('name').trim().notEmpty().isLength({ max: 100 }).withMessage('Name is required'),
  body('description').optional().trim().isLength({ max: 500 }),
  body('icon').optional().trim(),
  body('image').optional().trim(),
  body('parentId').optional().isInt({ min: 1 }),
  body('sortOrder').optional().isInt({ min: 0 }),
  validate,
], categoriesController.createCategory);

router.put('/:id', authenticate, authorize('ADMIN'), [
  param('id').isInt({ min: 1 }),
  body('name').optional().trim().isLength({ max: 100 }),
  body('description').optional().trim().isLength({ max: 500 }),
  body('icon').optional().trim(),
  body('image').optional().trim(),
  body('parentId').optional().isInt({ min: 1 }),
  body('sortOrder').optional().isInt({ min: 0 }),
  body('isActive').optional().isBoolean(),
  validate,
], categoriesController.updateCategory);

router.delete('/:id', authenticate, authorize('ADMIN'), [
  param('id').isInt({ min: 1 }),
  validate,
], categoriesController.deleteCategory);

export default router;
