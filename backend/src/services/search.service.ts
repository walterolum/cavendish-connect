import prisma from '../config/database';
import { paginate } from '../utils/response';

interface SearchQuery {
  q: string;
  type?: string;
  page?: number;
  limit?: number;
}

export class SearchService {
  async search(query: SearchQuery) {
    const searchTerm = query.q;
    const type = query.type || 'all';
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 50);
    const skip = (page - 1) * limit;

    if (!searchTerm || searchTerm.trim().length === 0) {
      return { marketplace: { items: [], total: 0 }, services: { items: [], total: 0 }, accommodation: { items: [], total: 0 } };
    }

    const results: any = {};

    if (type === 'all' || type === 'marketplace') {
      const where: any = {
        status: 'ACTIVE',
        deletedAt: null,
        OR: [
          { title: { contains: searchTerm } },
          { description: { contains: searchTerm } },
          { location: { contains: searchTerm } },
        ],
      };

      const [items, total] = await Promise.all([
        prisma.marketplaceListing.findMany({
          where,
          include: {
            category: { select: { id: true, name: true, slug: true } },
            user: { select: { id: true, username: true, firstName: true, lastName: true, avatar: true, verificationRequests: { where: { status: 'VERIFIED' }, select: { type: true } } } },
            images: { where: { isPrimary: true }, take: 1 },
            
          },
          orderBy: { createdAt: 'desc' },
          skip: type === 'all' ? 0 : skip,
          take: type === 'all' ? 5 : limit,
        }),
        prisma.marketplaceListing.count({ where }),
      ]);

      results.marketplace = { items, total };
    }

    if (type === 'all' || type === 'services') {
      const where: any = {
        status: 'ACTIVE',
        deletedAt: null,
        OR: [
          { title: { contains: searchTerm } },
          { description: { contains: searchTerm } },
          { location: { contains: searchTerm } },
        ],
      };

      const [items, total] = await Promise.all([
        prisma.service.findMany({
          where,
          include: {
            serviceCategory: { select: { id: true, name: true, slug: true, icon: true } },
            user: { select: { id: true, username: true, firstName: true, lastName: true, avatar: true, verificationRequests: { where: { status: 'VERIFIED' }, select: { type: true } } } },
            images: { where: { isPrimary: true }, take: 1 },
            
          },
          orderBy: { createdAt: 'desc' },
          skip: type === 'all' ? 0 : skip,
          take: type === 'all' ? 5 : limit,
        }),
        prisma.service.count({ where }),
      ]);

      results.services = { items, total };
    }

    if (type === 'all' || type === 'accommodation') {
      const where: any = {
        status: 'ACTIVE',
        deletedAt: null,
        OR: [
          { title: { contains: searchTerm } },
          { description: { contains: searchTerm } },
          { location: { contains: searchTerm } },
        ],
      };

      const [items, total] = await Promise.all([
        prisma.property.findMany({
          where,
          include: {
            propertyCategory: { select: { id: true, name: true, slug: true } },
            user: { select: { id: true, username: true, firstName: true, lastName: true, avatar: true, verificationRequests: { where: { status: 'VERIFIED' }, select: { type: true } } } },
            images: { where: { isPrimary: true }, take: 1 },
            amenities: { include: { amenity: { select: { id: true, name: true, icon: true } } } },
            
          },
          orderBy: { createdAt: 'desc' },
          skip: type === 'all' ? 0 : skip,
          take: type === 'all' ? 5 : limit,
        }),
        prisma.property.count({ where }),
      ]);

      results.accommodation = { items, total };
    }

    return results;
  }
}

export const searchService = new SearchService();
