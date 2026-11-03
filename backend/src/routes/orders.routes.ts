import { Router, Response, NextFunction } from 'express';
import { body, param, query } from 'express-validator';
import { authenticate, requireVerified, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { ordersService } from '../services/orders.service';
import { successResponse } from '../utils/response';

/**
 *   POST  /orders              place an order / booking / viewing request
 *   GET   /orders?role=buyer|seller&status=open|PENDING|...   your orders
 *   GET   /orders/counts       badge numbers
 *   PATCH /orders/:id          accept | decline | complete (seller), cancel (customer)
 */
const router = Router();
router.use(authenticate);

const wrap =
  (fn: (req: AuthRequest, res: Response) => Promise<void>) =>
  (req: AuthRequest, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

router.post(
  '/',
  requireVerified,
  [
    body('targetType').isIn(['LISTING', 'SERVICE', 'PROPERTY']).withMessage('Choose what you are ordering'),
    body('targetId').isInt({ min: 1 }),
    body('quantity').optional().isInt({ min: 1, max: 1000 }).withMessage('Quantity must be at least 1'),
    body('contactPhone').trim().isLength({ min: 7, max: 20 }).matches(/^[+\d\s()-]+$/).withMessage('Enter a phone number the seller can reach you on'),
    body('message').optional({ values: 'falsy' }).trim().isLength({ max: 1000 }),
    body('meetingPlace').optional({ values: 'falsy' }).trim().isLength({ max: 160 }),
    body('preferredDate').optional({ values: 'falsy' }).isISO8601().withMessage('Choose a valid date'),
    validate,
  ],
  wrap(async (req, res) => {
    const order = await ordersService.create(req.user!.userId, req.body);
    res.status(201).json(successResponse(order, 'Request sent'));
  })
);

router.get(
  '/',
  [
    query('role').optional().isIn(['buyer', 'seller']),
    query('status').optional().isIn(['open', 'PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'COMPLETED']),
    query('page').optional().isInt({ min: 1 }),
    validate,
  ],
  wrap(async (req, res) => {
    const role = req.query.role === 'seller' ? 'seller' : 'buyer';
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const result = await ordersService.list(req.user!.userId, role, req.query.status as string | undefined, page);
    res.json(successResponse(result.orders, 'Orders', result.meta));
  })
);

router.get(
  '/counts',
  wrap(async (req, res) => {
    res.json(successResponse(await ordersService.counts(req.user!.userId)));
  })
);

router.patch(
  '/:id',
  [
    param('id').isInt({ min: 1 }),
    body('action').isIn(['accept', 'decline', 'complete', 'cancel']).withMessage('Unknown action'),
    body('note').optional({ values: 'falsy' }).trim().isLength({ max: 500 }),
    validate,
  ],
  wrap(async (req, res) => {
    const order = await ordersService.act(req.user!.userId, parseInt(req.params.id as string), req.body.action, req.body.note);
    res.json(successResponse(order, 'Order updated'));
  })
);

export default router;
