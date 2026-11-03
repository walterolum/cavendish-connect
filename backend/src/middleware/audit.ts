import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import prisma from '../config/database';

export async function auditLog(
  userId: number | null,
  action: string,
  entity: string,
  entityId: number | null,
  req?: Request,
  oldValues?: any,
  newValues?: any
): Promise<void> {
  try {
    const forwardedFor = req?.headers['x-forwarded-for'];
    const ipAddress = typeof forwardedFor === 'string' ? forwardedFor.split(',')[0].trim() : req?.ip;
    const userAgent = req?.headers['user-agent'];

    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId,
        oldValues: oldValues || undefined,
        newValues: newValues || undefined,
        ipAddress,
        userAgent: typeof userAgent === 'string' ? userAgent : undefined,
      },
    });
  } catch (error) {
    console.error('Audit log error:', error);
  }
}

export function auditMiddleware(action: string, entity: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    
    res.json = function (body: any) {
      if (req.user && body?.success) {
        const entityId = req.params.id ? parseInt(req.params.id as string) : null;
        auditLog(req.user.userId, action, entity, entityId, req, undefined, body?.data);
      }
      return originalJson(body);
    };

    next();
  };
}
