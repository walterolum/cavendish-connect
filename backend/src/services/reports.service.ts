import prisma from '../config/database';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/errors';
import { auditLog } from '../middleware/audit';

export interface CreateReportInput {
  targetType: 'LISTING' | 'SERVICE' | 'ACCOMMODATION' | 'USER' | 'REVIEW';
  targetId: number;
  reason: string;
  description?: string;
}

export class ReportsService {
  private targetDelegates = {
    LISTING: prisma.marketplaceListing,
    SERVICE: prisma.service,
    ACCOMMODATION: prisma.property,
    USER: prisma.user,
    REVIEW: prisma.review,
  } as Record<string, any>;

  async createReport(userId: number, input: CreateReportInput) {
    const delegate = this.targetDelegates[input.targetType];
    if (!delegate) throw new BadRequestError('Valid target type is required');

    if (input.targetType === 'USER' && input.targetId === userId) {
      throw new BadRequestError('You cannot report yourself');
    }

    const target = await delegate.findUnique({ where: { id: input.targetId } });
    if (!target) throw new NotFoundError(input.targetType === 'LISTING' ? 'Listing' : 'Target');

    const existing = await prisma.report.findFirst({
      where: {
        reporterId: userId,
        targetType: input.targetType,
        targetId: input.targetId,
        status: { in: ['OPEN', 'UNDER_REVIEW'] },
      },
    });
    if (existing) throw new ConflictError('You have already reported this item');

    const report = await prisma.report.create({
      data: {
        reporterId: userId,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason as any,
        description: input.description,
        status: 'OPEN',
      },
      include: {
        reporter: { select: { id: true, username: true, firstName: true, lastName: true } },
      },
    });

    await auditLog(userId, 'CREATE', 'REPORT', report.id, undefined, undefined, { reason: input.reason });

    return report;
  }

  async getMyReports(userId: number) {
    return prisma.report.findMany({
      where: { reporterId: userId },
      include: {
        reporter: { select: { id: true, username: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}

export const reportsService = new ReportsService();