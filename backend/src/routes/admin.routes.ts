import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { adminController } from '../controllers/admin.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

router.use(authenticate, authorize('ADMIN'));

router.get('/dashboard/stats', adminController.getDashboardStats);

router.get('/users', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('role').optional().trim(),
  query('search').optional().trim(),
  query('status').optional().isIn(['active', 'suspended', 'inactive']),
  validate,
], adminController.listUsers);

router.post('/users', [
  body('firstName').trim().notEmpty().isLength({ max: 60 }).withMessage('First name is required'),
  body('lastName').trim().notEmpty().isLength({ max: 60 }).withMessage('Last name is required'),
  // Same normalisation as sign-in, so the stored email always matches what people type.
  body('email').trim().isEmail().normalizeEmail().withMessage('A valid email is required'),
  body('username').trim().isLength({ min: 3, max: 30 }).matches(/^[a-zA-Z0-9_]+$/).withMessage('Username must be 3-30 letters, numbers or underscores'),
  body('phone').optional({ values: 'falsy' }).trim().isLength({ max: 20 }),
  body('role').isIn(['STUDENT', 'SERVICE_PROVIDER', 'LANDLORD', 'VENDOR', 'ADMIN']).withMessage('Choose a valid role'),
  validate,
], adminController.createUser);

router.post('/users/:id/reset-password', [
  param('id').isInt({ min: 1 }),
  validate,
], adminController.resetUserPassword);

router.put('/users/:id/suspend', [
  param('id').isInt({ min: 1 }),
  validate,
], adminController.suspendUser);

router.put('/users/:id/activate', [
  param('id').isInt({ min: 1 }),
  validate,
], adminController.activateUser);

router.put('/users/:id/role', [
  param('id').isInt({ min: 1 }),
  body('roleName').trim().notEmpty().withMessage('Role name is required'),
  validate,
], adminController.changeUserRole);

const LISTING_STATUSES = ['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'SOLD', 'EXPIRED', 'REJECTED', 'SUSPENDED'];
const LISTING_KINDS = ['marketplace', 'service', 'accommodation'];
const listQuery = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('status').optional().isIn(LISTING_STATUSES),
  query('search').optional().trim().isLength({ max: 100 }),
  validate,
];
const statusBody = [
  param('id').isInt({ min: 1 }),
  body('status').isIn(LISTING_STATUSES).withMessage('Valid status is required'),
  body('reason').optional().trim().isLength({ max: 500 }),
  validate,
];

// One moderation API for all three post types: /admin/listings/:kind
router.get('/listings/:kind', [param('kind').isIn(LISTING_KINDS), ...listQuery], adminController.listListings);
router.put('/listings/:kind/:id/status', [param('kind').isIn(LISTING_KINDS), ...statusBody], adminController.updateListingStatus);

// Original marketplace-only paths, kept for compatibility.
router.get('/marketplace/listings', listQuery, adminController.listListings);
router.put('/marketplace/listings/:id/status', statusBody, adminController.updateListingStatus);

router.get('/reports', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('status').optional().isIn(['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED']),
  query('type').optional().isIn(['LISTING', 'SERVICE', 'ACCOMMODATION', 'USER', 'REVIEW']),
  validate,
], adminController.listReports);

router.put('/reports/:id', [
  param('id').isInt({ min: 1 }),
  body('status').isIn(['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED']).withMessage('Valid status is required'),
  body('resolution').optional().trim(),
  validate,
], adminController.updateReport);

router.get('/verification', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('status').optional().isIn(['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED']),
  query('type').optional().isIn(['STUDENT', 'SERVICE_PROVIDER', 'LANDLORD', 'BUSINESS']),
  validate,
], adminController.listVerifications);

router.put('/verification/:id', [
  param('id').isInt({ min: 1 }),
  body('status').isIn(['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED']).withMessage('Valid status is required'),
  body('rejectionReason').optional().trim(),
  validate,
], adminController.updateVerification);

router.get('/settings', adminController.getSettings);

router.put('/settings', [
  body('settings').isArray({ min: 1 }).withMessage('Settings array is required'),
  body('settings.*.key').trim().notEmpty().withMessage('Setting key is required'),
  body('settings.*.value').trim().notEmpty().withMessage('Setting value is required'),
  validate,
], adminController.updateSettings);

router.get('/audit-logs', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('entity').optional().trim(),
  query('action').optional().trim(),
  validate,
], adminController.listAuditLogs);

export default router;
