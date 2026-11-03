import { Router } from 'express';
import { body } from 'express-validator';
import { reportsController } from '../controllers/reports.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

router.use(authenticate);

router.post('/', [
  body('targetType').isIn(['LISTING', 'SERVICE', 'ACCOMMODATION', 'USER', 'REVIEW']).withMessage('Valid target type is required'),
  body('targetId').isInt({ min: 1 }).withMessage('Valid target ID is required'),
  body('reason').isIn([
    'SCAM', 'FRAUD', 'FAKE_PRODUCT', 'FAKE_ACCOMMODATION', 'INAPPROPRIATE_CONTENT',
    'HARASSMENT', 'DUPLICATE_LISTING', 'WRONG_INFORMATION', 'OTHER',
  ]).withMessage('Valid reason is required'),
  body('description').optional().trim().isLength({ max: 2000 }),
  validate,
], reportsController.createReport);

router.get('/', reportsController.getMyReports);

export default router;