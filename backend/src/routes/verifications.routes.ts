import { Router } from 'express';
import { body } from 'express-validator';
import { verificationsController } from '../controllers/verifications.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

router.use(authenticate);

router.post('/', [
  body('type').isIn(['STUDENT', 'SERVICE_PROVIDER', 'LANDLORD', 'BUSINESS']).withMessage('Valid verification type is required'),
  body('documentUrl').optional().trim().isURL().withMessage('Valid document URL is required'),
  body('notes').optional().trim().isLength({ max: 2000 }),
  validate,
], verificationsController.submitRequest);

router.get('/me', verificationsController.getMyRequests);

export default router;