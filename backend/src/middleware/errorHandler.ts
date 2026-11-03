import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { AppError, ValidationError } from '../utils/errors';
import { errorResponse } from '../utils/response';
import { config } from '../config';

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  if (err instanceof ValidationError) {
    res.status(err.statusCode).json(errorResponse(err.message, err.errors));
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json(errorResponse(err.message));
    return;
  }

  if (err instanceof multer.MulterError) {
    const maxMb = Math.round(config.storage.maxSize / (1024 * 1024));
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? `Each photo must be ${maxMb} MB or smaller` :
      err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE' ? 'You can upload up to 10 photos at a time' :
      'Upload failed';
    res.status(400).json(errorResponse(message));
    return;
  }

  // Malformed JSON body
  if ((err as any).type === 'entity.parse.failed') {
    res.status(400).json(errorResponse('Request body is not valid JSON'));
    return;
  }

  console.error('Unhandled error:', err);

  if (config.nodeEnv === 'production') {
    res.status(500).json(errorResponse('Internal server error'));
  } else {
    res.status(500).json(errorResponse(err.message, [{ stack: err.stack }]));
  }
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json(errorResponse(`Route ${req.originalUrl} not found`));
}
