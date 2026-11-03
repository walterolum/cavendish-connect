import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { accommodationService } from '../services/accommodation.service';
import { successResponse } from '../utils/response';

export class AccommodationController {
  async createProperty(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const property = await accommodationService.createProperty(req.user!.userId, req.body);
      res.status(201).json(successResponse(property, 'Property created'));
    } catch (error) {
      next(error);
    }
  }

  async getProperty(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const property = await accommodationService.getProperty(req.params.slug as string, req.user);
      res.json(successResponse(property));
    } catch (error) {
      next(error);
    }
  }

  async getProperties(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, category, propertyType, minPrice, maxPrice, hasWifi, hasWater, hasElectricity, hasSecurity, hasParking, isFurnished, search, sort, location, minRooms } = req.query;
      const result = await accommodationService.getProperties({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        category: category as string,
        propertyType: propertyType as string,
        minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
        hasWifi: hasWifi as string,
        hasWater: hasWater as string,
        hasElectricity: hasElectricity as string,
        hasSecurity: hasSecurity as string,
        hasParking: hasParking as string,
        isFurnished: isFurnished as string,
        search: search as string,
        sort: sort as string,
        location: location as string,
        minRooms: minRooms ? Math.max(0, parseInt(minRooms as string) || 0) : undefined,
      });
      res.json(successResponse(result.properties, 'Properties retrieved', result.meta));
    } catch (error) {
      next(error);
    }
  }

  async updateProperty(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const property = await accommodationService.updateProperty(
        req.user!.userId,
        parseInt(req.params.id as string),
        req.body
      );
      res.json(successResponse(property, 'Property updated'));
    } catch (error) {
      next(error);
    }
  }

  async deleteProperty(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await accommodationService.deleteProperty(req.user!.userId, parseInt(req.params.id as string));
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async addImages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const images = await accommodationService.addImages(
        req.user!.userId,
        parseInt(req.params.id as string),
        req.files as Express.Multer.File[]
      );
      res.status(201).json(successResponse(images, 'Images uploaded'));
    } catch (error) {
      next(error);
    }
  }

  async addAmenities(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const amenities = await accommodationService.addAmenities(
        req.user!.userId,
        parseInt(req.params.id as string),
        req.body.amenityIds
      );
      res.status(201).json(successResponse(amenities, 'Amenities added'));
    } catch (error) {
      next(error);
    }
  }

  async getMyProperties(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await accommodationService.getMyProperties(req.user!.userId, page, limit);
      res.json(successResponse(result.properties, 'My properties', result.meta));
    } catch (error) {
      next(error);
    }
  }
}

export const accommodationController = new AccommodationController();