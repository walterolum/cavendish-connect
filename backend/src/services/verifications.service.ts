import prisma from '../config/database';
import { BadRequestError, ConflictError } from '../utils/errors';
import { auditLog } from '../middleware/audit';

export interface SubmitVerificationInput {
  type: 'STUDENT' | 'SERVICE_PROVIDER' | 'LANDLORD' | 'BUSINESS';
  documentUrl?: string;
  notes?: string;
}

export class VerificationsService {
  async submitRequest(userId: number, input: SubmitVerificationInput) {
    const lastRequest = await prisma.verificationRequest.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    if (lastRequest) {
      if (lastRequest.status === 'PENDING') {
        throw new ConflictError('You already have a verification request being reviewed');
      }
      if (lastRequest.status === 'VERIFIED') {
        throw new BadRequestError('Your account is already verified');
      }
    }

    const request = await prisma.verificationRequest.create({
      data: {
        userId,
        type: input.type,
        documentUrl: input.documentUrl,
        notes: input.notes,
        status: 'PENDING',
      },
      include: {
        user: { select: { id: true, username: true, firstName: true, lastName: true, email: true } },
      },
    });

    await auditLog(userId, 'SUBMIT', 'VERIFICATION', request.id, undefined, undefined, { type: input.type });

    return request;
  }

  async getMyRequests(userId: number) {
    return prisma.verificationRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const verificationsService = new VerificationsService();