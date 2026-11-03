import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/helpers';
import { isMaintenanceMode } from '../utils/settings';
import { AppError } from '../utils/errors';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * While maintenance mode is on, the site stays browsable but nobody except
 * admins can post, edit or message. Sign-in and the admin API stay open so
 * an admin can always get back in and switch it off.
 */
export async function maintenanceGuard(req: Request, _res: Response, next: NextFunction) {
  if (READ_METHODS.has(req.method) || req.path.startsWith('/auth') || req.path.startsWith('/admin')) return next();

  try {
    if (!(await isMaintenanceMode())) return next();
  } catch {
    return next(); // never block the site because the settings lookup failed
  }

  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      if (verifyAccessToken(header.slice(7)).roles?.includes('ADMIN')) return next();
    } catch {
      /* fall through */
    }
  }

  next(new AppError('CAV CONNECT is undergoing maintenance. You can browse, but posting and messaging are paused for a short while.', 503));
}
