import { Request, Response, NextFunction } from 'express';
import { searchService } from '../services/search.service';
import { successResponse } from '../utils/response';

export class SearchController {
  async search(req: Request, res: Response, next: NextFunction) {
    try {
      const { q, type, page, limit } = req.query;
      const result = await searchService.search({
        q: q as string,
        type: type as string,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });
      res.json(successResponse(result, 'Search results'));
    } catch (error) {
      next(error);
    }
  }
}

export const searchController = new SearchController();
