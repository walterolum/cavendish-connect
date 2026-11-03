import { storeImages } from '../utils/storage';
import { newPostStatus, editedPostStatus } from '../utils/settings';
import { pickDefined, canViewListing, Viewer } from '../utils/helpers';
import prisma from '../config/database';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import { paginate, PaginationMeta } from '../utils/response';
import { generateSlug } from '../utils/helpers';
import { auditLog } from '../middleware/audit';

interface CreateServiceInput {
  title: string;
  description: string;
  categoryId: number;
  priceMin?: number;
  priceMax?: number;
  priceType?: string;
  currency?: string;
  location?: string;
  availability?: string;
}

interface PortfolioInput {
  title: string;
  description?: string;
  imageUrl?: string;
  link?: string;
  sortOrder?: number;
}

interface ListQuery {
  page?: number;
  limit?: number;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  sort?: string;
  location?: string;
}

export class ServicesService {
  async createService(userId: number, input: CreateServiceInput) {
    const category = await prisma.serviceCategory.findUnique({ where: { id: input.categoryId } });
    if (!category) throw new NotFoundError('Service category');

    const slug = generateSlug(input.title) + '-' + Date.now().toString(36);

    const service = await prisma.service.create({
      data: {
        userId,
        serviceCategoryId: input.categoryId,
        title: input.title,
        slug,
        description: input.description,
        priceMin: input.priceMin,
        priceMax: input.priceMax,
        priceType: input.priceType || 'fixed',
        currency: input.currency || 'UGX',
        location: input.location,
        availability: input.availability,
        status: await newPostStatus(),
      },
      include: {
        serviceCategory: true,
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
            verificationRequests: { where: { status: 'VERIFIED' }, select: { type: true } },
          },
        },
      },
    });

    auditLog(userId, 'CREATE', 'SERVICE', service.id).catch(() => {});

    return service;
  }

  async getService(slug: string, viewer?: Viewer) {
    const viewerId = viewer?.userId;
    const service = await prisma.service.findUnique({
      where: { slug, deletedAt: null },
      include: {
        serviceCategory: true,
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
            verificationRequests: { where: { status: 'VERIFIED' }, select: { type: true } },
            bio: true,
            location: true,
            createdAt: true,
            _count: {
              select: {
                services: { where: { status: 'ACTIVE', deletedAt: null } },
              },
            },
          },
        },
        images: { orderBy: { sortOrder: 'asc' } },
        portfolios: { orderBy: { sortOrder: 'asc' } },
        _count: {
          select: {
            images: true,
            portfolios: true,
          },
        },
      },
    });

    if (!service || service.deletedAt || !canViewListing(service.status, service.userId, viewer)) {
      throw new NotFoundError('Service');
    }

    const countView = viewerId !== service.userId;
    if (countView) {
      await prisma.service.update({
        where: { id: service.id },
        data: { viewCount: { increment: 1 } },
      });
    }

    // Reviews rate the provider (a user), so the rating follows them across services.
    const reviews = await prisma.review.aggregate({
      where: { targetType: 'SERVICE_PROVIDER', targetId: service.userId, status: 'ACTIVE' },
      _count: true,
      _avg: { rating: true },
    });

    let isFavorited = false;
    if (viewerId) {
      const fav = await prisma.favorite.findUnique({
        where: {
          userId_targetType_targetId: {
            userId: viewerId,
            targetType: 'SERVICE',
            targetId: service.id,
          },
        },
      });
      isFavorited = !!fav;
    }

    return {
      ...service,
      isFavorited,
      viewCount: service.viewCount + (countView ? 1 : 0),
      reviewsCount: reviews._count,
      averageRating: reviews._avg.rating,
    };
  }

  async getServices(query: ListQuery) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 50);
    const skip = (page - 1) * limit;

    const where: any = {
      status: 'ACTIVE',
      deletedAt: null,
    };

    if (query.category) {
      const cat = await prisma.serviceCategory.findUnique({ where: { slug: query.category } });
      if (cat) where.serviceCategoryId = cat.id;
    }

    if (query.minPrice || query.maxPrice) {
      where.priceMin = {};
      where.priceMax = {};
      if (query.minPrice) where.priceMax.gte = query.minPrice;
      if (query.maxPrice) where.priceMin.lte = query.maxPrice;
    }

    if (query.location) {
      where.location = { contains: query.location };
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search } },
        { description: { contains: query.search } },
      ];
    }

    const orderBy: any = (() => {
      switch (query.sort) {
        case 'price_asc': return { priceMin: 'asc' as const };
        case 'price_desc': return { priceMin: 'desc' as const };
        case 'oldest': return { createdAt: 'asc' as const };
        case 'popular': return { viewCount: 'desc' as const };
        default: return { createdAt: 'desc' as const };
      }
    })();

    const [services, total] = await Promise.all([
      prisma.service.findMany({
        where,
        include: {
          serviceCategory: { select: { id: true, name: true, slug: true, icon: true } },
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              avatar: true,
              verificationRequests: { where: { status: 'VERIFIED' }, select: { type: true } },
            },
          },
          images: {
            where: { isPrimary: true },
            take: 1,
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.service.count({ where }),
    ]);

    // Each card shows its provider's star rating, from reviews of that provider.
    const providerIds = [...new Set(services.map((s) => s.userId))];
    const ratings = providerIds.length
      ? await prisma.review.groupBy({
          by: ['targetId'],
          where: { targetType: 'SERVICE_PROVIDER', targetId: { in: providerIds }, status: 'ACTIVE' },
          _avg: { rating: true },
          _count: true,
        })
      : [];
    const byProvider = new Map(ratings.map((r) => [r.targetId, r]));

    return {
      services: services.map((s) => {
        const r = byProvider.get(s.userId);
        return { ...s, averageRating: r?._avg.rating ?? null, reviewsCount: r?._count ?? 0 };
      }),
      meta: paginate(total, page, limit),
    };
  }

  async updateService(userId: number, serviceId: number, data: Partial<CreateServiceInput>) {
    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) throw new NotFoundError('Service');
    if (service.userId !== userId) throw new ForbiddenError('Not your service');

    const { categoryId, ...changes } = pickDefined(data, [
      'title', 'description', 'categoryId', 'priceMin', 'priceMax', 'priceType', 'currency', 'location', 'availability',
    ] as const);
    let serviceCategoryId: number | undefined;
    if (categoryId !== undefined) {
      const category = await prisma.serviceCategory.findUnique({ where: { id: Number(categoryId) } });
      if (!category) throw new NotFoundError('Service category');
      serviceCategoryId = category.id;
    }

    return prisma.service.update({
      where: { id: serviceId },
      data: {
        ...changes,
        ...(serviceCategoryId !== undefined && { serviceCategoryId }),
        status: (await editedPostStatus(service.status)) as any,
      },
    });
  }

  async deleteService(userId: number, serviceId: number) {
    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) throw new NotFoundError('Service');
    if (service.userId !== userId) throw new ForbiddenError('Not your service');

    await prisma.service.update({
      where: { id: serviceId },
      data: { deletedAt: new Date() },
    });

    return { message: 'Service deleted' };
  }

  async addImages(userId: number, serviceId: number, files: Express.Multer.File[]) {
    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) throw new NotFoundError('Service');
    if (service.userId !== userId) throw new ForbiddenError('Not your service');

    const existing = await prisma.serviceImage.count({ where: { serviceId } });
    const urls = await storeImages(files);
    const images = await Promise.all(
      files.map((file, index) =>
        prisma.serviceImage.create({
          data: {
            serviceId,
            url: urls[index],
            alt: file.originalname,
            sortOrder: existing + index,
            isPrimary: existing === 0 && index === 0,
          },
        })
      )
    );

    return images;
  }

  async addPortfolio(userId: number, serviceId: number, input: PortfolioInput) {
    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) throw new NotFoundError('Service');
    if (service.userId !== userId) throw new ForbiddenError('Not your service');

    const portfolio = await prisma.servicePortfolio.create({
      data: {
        serviceId,
        title: input.title,
        description: input.description,
        imageUrl: input.imageUrl,
        link: input.link,
        sortOrder: input.sortOrder || 0,
      },
    });

    return portfolio;
  }

  async getMyServices(userId: number, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [services, total] = await Promise.all([
      prisma.service.findMany({
        where: { userId, deletedAt: null },
        include: {
          serviceCategory: { select: { id: true, name: true, slug: true, icon: true } },
          images: { where: { isPrimary: true }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.service.count({ where: { userId, deletedAt: null } }),
    ]);

    return { services, meta: paginate(total, page, limit) };
  }
}

export const servicesService = new ServicesService();