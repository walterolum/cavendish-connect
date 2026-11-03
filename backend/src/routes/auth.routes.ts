import { Router } from 'express';
import { body } from 'express-validator';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { ForbiddenError } from '../utils/errors';

const router = Router();

// Self sign-up is closed. Accounts are created by an administrator
// (POST /admin/users), who hands the person a temporary password.
router.post('/register', (_req, _res, next) => {
  next(new ForbiddenError('Accounts are created by the Cavendish Connect administrator. Please contact the admin office to get an account.'));
});

router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  validate,
], authController.login);

router.post('/refresh', [
  body('refreshToken').notEmpty().withMessage('Refresh token is required'),
  validate,
], authController.refreshToken);

router.get('/profile', authenticate, authController.getProfile);

router.put('/profile', authenticate, [
  body('firstName').optional().trim().notEmpty(),
  body('lastName').optional().trim().notEmpty(),
  body('phone').optional().isMobilePhone('any'),
  body('bio').optional().trim().isLength({ max: 500 }),
  body('location').optional().trim(),
  validate,
], authController.updateProfile);

router.post('/change-password', authenticate, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
    .matches(/[A-Za-z]/).withMessage('New password must contain a letter')
    .matches(/\d/).withMessage('New password must contain a number'),
  validate,
], authController.changePassword);

router.post('/logout', authenticate, authController.logout);

export default router;
