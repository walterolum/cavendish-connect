import { Router, Response, NextFunction } from 'express';
import { body, param, query } from 'express-validator';
import prisma from '../config/database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { auditLog } from '../middleware/audit';
import { NotFoundError } from '../utils/errors';
import { successResponse } from '../utils/response';

/**
 * Campus events, managed by admins and shown on the Services Hub.
 *   GET    /events            upcoming published events (public)
 *   GET    /events/all        every event, newest first (admin)
 *   POST   /events            create (admin)
 *   PUT    /events/:id        update (admin)
 *   DELETE /events/:id        delete (admin)
 */
const router = Router();

const wrap =
  (fn: (req: AuthRequest, res: Response) => Promise<void>) =>
  (req: AuthRequest, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

router.get(
  '/',
  [query('limit').optional().isInt({ min: 1, max: 20 }), validate],
  wrap(async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
    const now = new Date();
    const events = await prisma.campusEvent.findMany({
      // Still show an event that has started but not yet ended.
      where: { isPublished: true, OR: [{ startsAt: { gte: now } }, { endsAt: { gte: now } }] },
      orderBy: { startsAt: 'asc' },
      take: limit,
    });
    res.set('Cache-Control', 'public, max-age=60');
    res.json(successResponse(events, 'Upcoming events'));
  })
);

const admin = [authenticate, authorize('ADMIN')];
const eventBody = [
  body('title').trim().notEmpty().isLength({ max: 120 }).withMessage('Title is required (max 120 characters)'),
  body('description').optional({ values: 'falsy' }).trim().isLength({ max: 2000 }),
  body('location').optional({ values: 'falsy' }).trim().isLength({ max: 120 }),
  body('category').optional({ values: 'falsy' }).trim().isLength({ max: 40 }),
  body('startsAt').isISO8601().withMessage('A valid start date and time is required'),
  body('endsAt')
    .optional({ values: 'falsy' })
    .isISO8601()
    .custom((v, { req }) => new Date(v) >= new Date(req.body.startsAt))
    .withMessage('End must be after the start'),
  body('isPublished').optional().isBoolean(),
  validate,
];

function eventData(b: any) {
  return {
    title: String(b.title).trim(),
    description: b.description?.trim() || null,
    location: b.location?.trim() || null,
    category: b.category?.trim() || 'Campus',
    startsAt: new Date(b.startsAt),
    endsAt: b.endsAt ? new Date(b.endsAt) : null,
    isPublished: b.isPublished === undefined ? true : Boolean(b.isPublished),
  };
}

router.get(
  '/all',
  ...admin,
  wrap(async (_req, res) => {
    const events = await prisma.campusEvent.findMany({ orderBy: { startsAt: 'desc' }, take: 200 });
    res.json(successResponse(events, 'All events'));
  })
);

router.post(
  '/',
  ...admin,
  ...eventBody,
  wrap(async (req, res) => {
    const event = await prisma.campusEvent.create({ data: { ...eventData(req.body), createdById: req.user!.userId } });
    await auditLog(req.user!.userId, 'CREATE', 'EVENT', event.id, undefined, undefined, { title: event.title });
    res.status(201).json(successResponse(event, 'Event created'));
  })
);

router.put(
  '/:id',
  ...admin,
  param('id').isInt({ min: 1 }),
  ...eventBody,
  wrap(async (req, res) => {
    const id = parseInt(req.params.id as string);
    if (!(await prisma.campusEvent.findUnique({ where: { id } }))) throw new NotFoundError('Event');
    const event = await prisma.campusEvent.update({ where: { id }, data: eventData(req.body) });
    await auditLog(req.user!.userId, 'UPDATE', 'EVENT', id, undefined, undefined, { title: event.title });
    res.json(successResponse(event, 'Event updated'));
  })
);

router.delete(
  '/:id',
  ...admin,
  [param('id').isInt({ min: 1 }), validate],
  wrap(async (req, res) => {
    const id = parseInt(req.params.id as string);
    const existing = await prisma.campusEvent.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Event');
    await prisma.campusEvent.delete({ where: { id } });
    await auditLog(req.user!.userId, 'DELETE', 'EVENT', id, undefined, { title: existing.title });
    res.json(successResponse(null, 'Event deleted'));
  })
);

export default router;
