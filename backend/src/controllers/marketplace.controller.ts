import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { marketplaceService } from '../services/marketplace.service';
import { successResponse } from '../utils/response';

export class MarketplaceController {
  async createListing(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const listing = await marketplaceService.createListing(req.user!.userId, req.body);
      res.status(201).json(successResponse(listing, 'Listing created'));
    } catch (error) {
      next(error);
    }
  }

  async getListing(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const listing = await marketplaceService.getListing(req.params.slug as string, req.user);
      res.json(successResponse(listing));
    } catch (error) {
      next(error);
    }
  }

  async getListings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, category, minPrice, maxPrice, condition, search, sort, location } = req.query;
      const result = await marketplaceService.getListings({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        category: category as string,
        minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
        condition: condition as string,
        search: search as string,
        sort: sort as string,
        location: location as string,
      });
      res.json(successResponse(result.listings, 'Listings retrieved', result.meta));
    } catch (error) {
      next(error);
    }
  }

  async updateListing(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const listing = await marketplaceService.updateListing(
        req.user!.userId,
        parseInt(req.params.id as string),
        req.body
      );
      res.json(successResponse(listing, 'Listing updated'));
    } catch (error) {
      next(error);
    }
  }

  async deleteListing(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await marketplaceService.deleteListing(req.user!.userId, parseInt(req.params.id as string));
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async addImages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const images = await marketplaceService.addImages(
        req.user!.userId,
        parseInt(req.params.id as string),
        req.files as Express.Multer.File[]
      );
      res.status(201).json(successResponse(images, 'Images uploaded'));
    } catch (error) {
      next(error);
    }
  }

  async getMyListings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await marketplaceService.getMyListings(req.user!.userId, page, limit);
      res.json(successResponse(result.listings, 'My listings', result.meta));
    } catch (error) {
      next(error);
    }
  }
}

export const marketplaceController = new MarketplaceController();
