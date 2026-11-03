import prisma from '../config/database';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../utils/errors';
import { paginate } from '../utils/response';
import { messagesService } from './messages.service';
import { formatPlain } from '../utils/format';

export type OrderTargetType = 'LISTING' | 'SERVICE' | 'PROPERTY';
export type OrderAction = 'accept' | 'decline' | 'complete' | 'cancel';

export interface CreateOrderInput {
  targetType: OrderTargetType;
  targetId: number;
  quantity?: number;
  message?: string;
  contactPhone: string;
  meetingPlace?: string;
  preferredDate?: string;
}

const PERSON = { select: { id: true, firstName: true, lastName: true, username: true, avatar: true, phone: true, email: true } };

/** Words used in messages and notifications for each kind of order. */
const NOUN: Record<OrderTargetType, { order: string; item: string; path: string }> = {
  LISTING: { order: 'order', item: 'item', path: '/marketplace' },
  SERVICE: { order: 'booking request', item: 'service', path: '/services' },
  PROPERTY: { order: 'viewing request', item: 'property', path: '/accommodation' },
};

async function loadTarget(type: OrderTargetType, id: number) {
  if (type === 'LISTING') {
    const l = await prisma.marketplaceListing.findUnique({ where: { id } });
    if (!l || l.deletedAt) return null;
    return { ownerId: l.userId, title: l.title, slug: l.slug, status: l.status, price: l.price, currency: l.currency, stock: l.quantity, location: l.location };
  }
  if (type === 'SERVICE') {
    const s = await prisma.service.findUnique({ where: { id } });
    if (!s || s.deletedAt) return null;
    return { ownerId: s.userId, title: s.title, slug: s.slug, status: s.status, price: s.priceMin, currency: s.currency, stock: null as number | null, location: s.location };
  }
  const p = await prisma.property.findUnique({ where: { id } });
  if (!p || p.deletedAt) return null;
  return { ownerId: p.userId, title: p.title, slug: p.slug, status: p.status, price: p.monthlyPrice, currency: p.currency, stock: p.availableRooms, location: p.location };
}

async function notify(userId: number, type: 'ORDER_RECEIVED' | 'ORDER_UPDATE', title: string, message: string, orderId: number) {
  await prisma.notification.create({ data: { userId, type, title, message, targetType: 'ORDER', targetId: orderId } });
}

export class OrdersService {
  async create(buyerId: number, input: CreateOrderInput) {
    const t = await loadTarget(input.targetType, input.targetId);
    if (!t || t.status !== 'ACTIVE') throw new NotFoundError('This post is no longer available');
    if (t.ownerId === buyerId) throw new BadRequestError("You can't order your own post");

    const quantity = Math.max(1, Math.floor(input.quantity ?? 1));
    if (t.stock !== null && quantity > t.stock) {
      throw new BadRequestError(t.stock === 0 ? 'None left right now' : `Only ${t.stock} available`);
    }
    const open = await prisma.order.findFirst({
      where: { buyerId, targetType: input.targetType, targetId: input.targetId, status: { in: ['PENDING', 'ACCEPTED'] } },
      select: { id: true },
    });
    if (open) throw new ConflictError('You already have an open request for this. Check “My orders”.');

    const noun = NOUN[input.targetType];
    const order = await prisma.order.create({
      data: {
        buyerId,
        sellerId: t.ownerId,
        targetType: input.targetType,
        targetId: input.targetId,
        title: t.title,
        unitPrice: t.price ?? null,
        currency: t.currency,
        quantity,
        message: input.message?.trim() || null,
        contactPhone: input.contactPhone.trim(),
        meetingPlace: input.meetingPlace?.trim() || null,
        preferredDate: input.preferredDate ? new Date(input.preferredDate) : null,
      },
    });

    // Start (or reuse) the chat with the seller and post the request there,
    // so the conversation and the order stay together.
    let conversationId: number | null = null;
    try {
      const conversation = await messagesService.createOrGetConversation(buyerId, t.ownerId);
      conversationId = conversation.id;
      const lines = [
        `New ${noun.order}: ${t.title}`,
        input.targetType !== 'SERVICE' ? `${input.targetType === 'PROPERTY' ? 'Rooms' : 'Quantity'}: ${quantity}` : '',
        order.preferredDate ? `Preferred date: ${formatPlain(order.preferredDate)}` : '',
        order.meetingPlace ? `Meeting place: ${order.meetingPlace}` : '',
        `Phone: ${order.contactPhone}`,
        order.message ? `\n${order.message}` : '',
      ].filter(Boolean);
      await messagesService.sendMessage(buyerId, conversation.id, lines.join('\n'));
      await prisma.order.update({ where: { id: order.id }, data: { conversationId } });
    } catch {
      /* the order still stands even if the chat message could not be sent */
    }

    const buyer = await prisma.user.findUnique({ where: { id: buyerId }, select: { firstName: true, lastName: true } });
    await notify(
      t.ownerId,
      'ORDER_RECEIVED',
      `New ${noun.order}`,
      `${buyer?.firstName ?? 'Someone'} ${buyer?.lastName ?? ''}`.trim() + ` sent a ${noun.order} for “${t.title}”.`,
      order.id
    );
    return { ...order, conversationId };
  }

  async list(userId: number, role: 'buyer' | 'seller', status: string | undefined, page = 1, limit = 20) {
    const where: any = role === 'buyer' ? { buyerId: userId } : { sellerId: userId };
    if (status === 'open') where.status = { in: ['PENDING', 'ACCEPTED'] };
    else if (status) where.status = status;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { buyer: PERSON, seller: PERSON },
        orderBy: [{ updatedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    // Attach each post's slug and photo so the order card can link to it.
    const ids = (type: OrderTargetType) => orders.filter((o) => o.targetType === type).map((o) => o.targetId);
    const img = { orderBy: { sortOrder: 'asc' as const }, take: 1, select: { url: true } };
    const [l, s, p] = await Promise.all([
      prisma.marketplaceListing.findMany({ where: { id: { in: ids('LISTING') } }, select: { id: true, slug: true, location: true, images: img } }),
      prisma.service.findMany({ where: { id: { in: ids('SERVICE') } }, select: { id: true, slug: true, location: true, images: img } }),
      prisma.property.findMany({ where: { id: { in: ids('PROPERTY') } }, select: { id: true, slug: true, location: true, images: img } }),
    ]);
    const map = new Map<string, { url: string; image: string | null; location: string | null }>();
    for (const [type, rows] of [['LISTING', l], ['SERVICE', s], ['PROPERTY', p]] as const) {
      for (const r of rows) map.set(`${type}:${r.id}`, { url: `${NOUN[type].path}/${r.slug}`, image: r.images[0]?.url ?? null, location: r.location ?? null });
    }

    return {
      orders: orders.map((o) => ({ ...o, target: map.get(`${o.targetType}:${o.targetId}`) ?? null })),
      meta: paginate(total, page, limit),
    };
  }

  async counts(userId: number) {
    const [incomingPending, myOpen] = await Promise.all([
      prisma.order.count({ where: { sellerId: userId, status: 'PENDING' } }),
      prisma.order.count({ where: { buyerId: userId, status: { in: ['PENDING', 'ACCEPTED'] } } }),
    ]);
    return { incomingPending, myOpen };
  }

  async act(userId: number, orderId: number, action: OrderAction, note?: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundError('Order');
    const isSeller = order.sellerId === userId;
    const isBuyer = order.buyerId === userId;
    if (!isSeller && !isBuyer) throw new ForbiddenError('This is not your order');

    const rules: Record<OrderAction, { who: boolean; from: string[]; to: 'ACCEPTED' | 'DECLINED' | 'COMPLETED' | 'CANCELLED' }> = {
      accept: { who: isSeller, from: ['PENDING'], to: 'ACCEPTED' },
      decline: { who: isSeller, from: ['PENDING'], to: 'DECLINED' },
      complete: { who: isSeller, from: ['ACCEPTED'], to: 'COMPLETED' },
      cancel: { who: isBuyer, from: ['PENDING', 'ACCEPTED'], to: 'CANCELLED' },
    };
    const rule = rules[action];
    if (!rule.who) throw new ForbiddenError(action === 'cancel' ? 'Only the customer can cancel' : 'Only the seller can do this');
    if (!rule.from.includes(order.status)) throw new BadRequestError(`This order is already ${order.status.toLowerCase()}`);

    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.order.update({
        where: { id: orderId },
        data: {
          status: rule.to,
          sellerNote: isSeller && note?.trim() ? note.trim() : order.sellerNote,
          ...(action === 'accept' || action === 'decline' ? { respondedAt: now } : {}),
          ...(action === 'complete' ? { completedAt: now } : {}),
        },
      });
      // A completed sale reduces stock; the last one marks the item sold.
      if (action === 'complete' && order.targetType === 'LISTING') {
        const l = await tx.marketplaceListing.findUnique({ where: { id: order.targetId } });
        if (l) {
          const left = Math.max(0, l.quantity - order.quantity);
          await tx.marketplaceListing.update({ where: { id: l.id }, data: { quantity: left, ...(left === 0 ? { status: 'SOLD' } : {}) } });
        }
      }
      if (action === 'complete' && order.targetType === 'PROPERTY') {
        const p = await tx.property.findUnique({ where: { id: order.targetId } });
        if (p) await tx.property.update({ where: { id: p.id }, data: { availableRooms: Math.max(0, p.availableRooms - order.quantity) } });
      }
      return u;
    });

    const noun = NOUN[order.targetType as OrderTargetType].order;
    const text: Record<OrderAction, string> = {
      accept: `Your ${noun} for “${order.title}” was accepted.`,
      decline: `Your ${noun} for “${order.title}” was declined.`,
      complete: `Your ${noun} for “${order.title}” is complete. Thank you!`,
      cancel: `The ${noun} for “${order.title}” was cancelled by the customer.`,
    };
    await notify(isSeller ? order.buyerId : order.sellerId, 'ORDER_UPDATE', `Order ${rule.to.toLowerCase()}`, text[action] + (isSeller && note?.trim() ? ` Note: ${note.trim()}` : ''), order.id);
    return updated;
  }
}

export const ordersService = new OrdersService();
