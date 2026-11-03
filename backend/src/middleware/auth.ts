import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/helpers';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import prisma from '../config/database';

export interface AuthRequest extends Request {
  user?: {
    userId: number;
    email: string;
    roles: string[];
  };
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(new UnauthorizedError('Access token required'));
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyAccessToken(token);
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      roles: decoded.roles,
    };
    next();
  } catch (error) {
    next(new UnauthorizedError('Invalid or expired access token'));
  }
}

export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyAccessToken(token);
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      roles: decoded.roles,
    };
  } catch {
    // Token invalid, continue without auth
  }
  
  next();
}

export function authorize(...allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }

    const hasRole = req.user.roles.some(role => allowedRoles.includes(role));
    
    if (!hasRole) {
      next(new ForbiddenError('Insufficient permissions'));
      return;
    }

    next();
  };
}

export async function requireVerified(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    next(new UnauthorizedError());
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    select: { isEmailVerified: true, isSuspended: true },
  });

  if (!user || user.isSuspended) {
    next(new ForbiddenError('Account is suspended'));
    return;
  }

  if (!user.isEmailVerified) {
    next(new ForbiddenError('Email verification required'));
    return;
  }

  next();
}
