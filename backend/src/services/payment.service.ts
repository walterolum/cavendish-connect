import prisma from '../config/database';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { auditLog } from '../middleware/audit';

export class PaymentService {
  async createPayment(userId: number, data: {
    amount: number;
    currency?: string;
    description?: string;
    provider?: string;
    metadata?: any;
  }) {
    return prisma.payment.create({
      data: {
        userId,
        amount: data.amount,
        currency: data.currency || 'UGX',
        description: data.description,
        provider: data.provider,
        metadata: data.metadata,
        status: 'PENDING',
      },
    });
  }

  async processPayment(paymentId: number, providerRef: string) {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundError('Payment');

    const updated = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'SUCCESSFUL',
        providerRef,
        paidAt: new Date(),
      },
    });

    return updated;
  }

  async getMyPayments(userId: number, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where: { userId } }),
    ]);

    return { payments, total, page, limit };
  }
}

export class PromotionService {
  async getPlans() {
    return prisma.promotionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getPromotionSettings() {
    const settings = await prisma.systemSetting.findMany({
      where: { group: 'promotions' },
    });
    return settings.reduce((acc: any, s) => {
      acc[s.key] = { value: s.value, type: s.type };
      return acc;
    }, {});
  }

  async purchasePromotion(userId: number, planId: number, targetType: string, targetId: number) {
    const plan = await prisma.promotionPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundError('Promotion plan');
    if (!plan.isActive) throw new BadRequestError('Promotion plan is not active');

    const payment = await prisma.payment.create({
      data: {
        userId,
        amount: plan.price,
        currency: plan.currency,
        description: `Promotion: ${plan.name}`,
        status: 'SUCCESSFUL',
        paidAt: new Date(),
      },
    });

    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + plan.durationDays);

    const purchase = await prisma.promotionPurchase.create({
      data: {
        userId,
        planId,
        targetType,
        targetId,
        status: 'SUCCESSFUL',
        paymentId: payment.id,
        startDate: now,
        endDate,
      },
    });

    // Set featuredAt on the target
    if (targetType === 'MARKETPLACE') {
      await prisma.marketplaceListing.update({
        where: { id: targetId },
        data: { featuredAt: now },
      });
    } else if (targetType === 'SERVICE') {
      await prisma.service.update({
        where: { id: targetId },
        data: { featuredAt: now },
      });
    } else if (targetType === 'ACCOMMODATION') {
      await prisma.property.update({
        where: { id: targetId },
        data: { featuredAt: now },
      });
    }

    await prisma.notification.create({
      data: {
        userId,
        type: 'PROMOTION_ACTIVE',
        title: 'Promotion is now active',
        message: `Your ${plan.name} promotion is active for ${plan.durationDays} days.`,
        targetType,
        targetId,
      },
    });

    auditLog(userId, 'PURCHASE', 'PROMOTION', purchase.id).catch(() => {});

    return purchase;
  }
}

export const paymentService = new PaymentService();
export const promotionService = new PromotionService();