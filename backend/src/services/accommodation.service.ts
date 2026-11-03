import { storeImages } from '../utils/storage';
import { newPostStatus, editedPostStatus } from '../utils/settings';
import { pickDefined, canViewListing, Viewer } from '../utils/helpers';
import prisma from '../config/database';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import { paginate, PaginationMeta } from '../utils/response';
import { generateSlug } from '../utils/helpers';
import { auditLog } from '../middleware/audit';

interface CreatePropertyInput {
  title: string;
  description: string;
  categoryId: number;
  propertyType: string;
  location: string;
  latitude?: number;
  longitude?: number;
  monthlyPrice: number;
  depositAmount?: number;
  currency?: string;
  distanceFromCampus?: string;
  totalRooms?: number;
  availableRooms?: number;
  roomType?: string;
  isFurnished?: boolean;
  hasWifi?: boolean;
  hasWater?: boolean;
  hasElectricity?: boolean;
  hasSecurity?: boolean;
  hasParking?: boolean;
  rules?: string;
}

interface ListQuery {
  page?: number;
  limit?: number;
  category?: string;
  propertyType?: string;
  minPrice?: number;
  maxPrice?: number;
  hasWifi?: string;
  hasWater?: string;
  hasElectricity?: string;
  hasSecurity?: string;
  hasParking?: string;
  isFurnished?: string;
  search?: string;
  sort?: string;
  location?: string;
  minRooms?: number;
}

export class AccommodationService {
  async createProperty(userId: number, input: CreatePropertyInput) {
    const category = await prisma.propertyCategory.findUnique({ where: { id: input.categoryId } });
    if (!category) throw new NotFoundError('Property category');

    const slug = generateSlug(input.title) + '-' + Date.now().toString(36);

    const property = await prisma.property.create({
      data: {
        userId,
        propertyCategoryId: input.categoryId,
        title: input.title,
        slug,
        description: input.description,
        propertyType: input.propertyType as any,
        location: input.location,
        latitude: input.latitude,
        longitude: input.longitude,
        monthlyPrice: input.monthlyPrice,
        depositAmount: input.depositAmount,
        currency: input.currency || 'UGX',
        distanceFromCampus: input.distanceFromCampus,
        totalRooms: input.totalRooms || 1,
        availableRooms: input.availableRooms || 1,
        roomType: input.roomType,
        isFurnished: input.isFurnished || false,
        hasWifi: input.hasWifi || false,
        hasWater: input.hasWater ?? true,
        hasElectricity: input.hasElectricity ?? true,
        hasSecurity: input.hasSecurity || false,
        hasParking: input.hasParking || false,
        rules: input.rules,
        status: await newPostStatus(),
      },
      include: {
        propertyCategory: true,
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

    auditLog(userId, 'CREATE', 'ACCOMMODATION', property.id).catch(() => {});

    return property;
  }

  async getProperty(slug: string, viewer?: Viewer) {
    const viewerId = viewer?.userId;
    const property = await prisma.property.findUnique({
      where: { slug, deletedAt: null },
      include: {
        propertyCategory: true,
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
            verificationRequests: { where: { status: 'VERIFIED' }, select: { type: true } },
            bio: true,
            phone: true,
            email: true,
            location: true,
            createdAt: true,
            _count: {
              select: {
                properties: { where: { status: 'ACTIVE', deletedAt: null } },
              },
            },
          },
        },
        images: { orderBy: { sortOrder: 'asc' } },
        amenities: {
          include: { amenity: true },
        },
        _count: {
          select: {
            images: true,
            amenities: true,
          },
        },
      },
    });

    if (!property || property.deletedAt || !canViewListing(property.status, property.userId, viewer)) {
      throw new NotFoundError('Property');
    }

    const countView = viewerId !== property.userId;
    if (countView) {
      await prisma.property.update({
        where: { id: property.id },
        data: { viewCount: { increment: 1 } },
      });
    }

    // Reviews rate the landlord (a user), so the rating follows them across properties.
    const reviews = await prisma.review.aggregate({
      where: { targetType: 'LANDLORD', targetId: property.userId, status: 'ACTIVE' },
      _count: true,
      _avg: { rating: true },
    });

    let isFavorited = false;
    if (viewerId) {
      const fav = await prisma.favorite.findUnique({
        where: {
          userId_targetType_targetId: {
            userId: viewerId,
            targetType: 'ACCOMMODATION',
            targetId: property.id,
          },
        },
      });
      isFavorited = !!fav;
    }

    return {
      ...property,
      // Phone and email are for signed-in members only.
      user: viewer ? property.user : { ...property.user, phone: null, email: null },
      isFavorited,
      viewCount: property.viewCount + (countView ? 1 : 0),
      reviewsCount: reviews._count,
      averageRating: reviews._avg.rating,
    };
  }

  async getProperties(query: ListQuery) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 50);
    const skip = (page - 1) * limit;

    const where: any = {
      status: 'ACTIVE',
      deletedAt: null,
    };

    if (query.category) {
      const cat = await prisma.propertyCategory.findUnique({ where: { slug: query.category } });
      if (cat) where.propertyCategoryId = cat.id;
    }

    if (query.propertyType) {
      where.propertyType = query.propertyType;
    }

    if (query.minPrice || query.maxPrice) {
      where.monthlyPrice = {};
      if (query.minPrice) where.monthlyPrice.gte = query.minPrice;
      if (query.maxPrice) where.monthlyPrice.lte = query.maxPrice;
    }

    const booleanFilter = (value?: string): boolean | undefined => {
      if (value === 'true') return true;
      if (value === 'false') return false;
      return undefined;
    };

    const hasWifi = booleanFilter(query.hasWifi);
    if (hasWifi !== undefined) where.hasWifi = hasWifi;

    const hasWater = booleanFilter(query.hasWater);
    if (hasWater !== undefined) where.hasWater = hasWater;

    const hasElectricity = booleanFilter(query.hasElectricity);
    if (hasElectricity !== undefined) where.hasElectricity = hasElectricity;

    const hasSecurity = booleanFilter(query.hasSecurity);
    if (hasSecurity !== undefined) where.hasSecurity = hasSecurity;

    const hasParking = booleanFilter(query.hasParking);
    if (hasParking !== undefined) where.hasParking = hasParking;

    const isFurnished = booleanFilter(query.isFurnished);
    if (isFurnished !== undefined) where.isFurnished = isFurnished;

    if (query.minRooms && query.minRooms > 0) {
      where.availableRooms = { gte: query.minRooms };
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
        case 'price_asc': return { monthlyPrice: 'asc' as const };
        case 'price_desc': return { monthlyPrice: 'desc' as const };
        case 'oldest': return { createdAt: 'asc' as const };
        case 'popular': return { viewCount: 'desc' as const };
        default: return { createdAt: 'desc' as const };
      }
    })();

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        include: {
          propertyCategory: { select: { id: true, name: true, slug: true } },
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
          amenities: {
            include: { amenity: { select: { id: true, name: true, icon: true } } },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.property.count({ where }),
    ]);

    return {
      properties,
      meta: paginate(total, page, limit),
    };
  }

  async updateProperty(userId: number, propertyId: number, data: Partial<CreatePropertyInput>) {
    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new NotFoundError('Property');
    if (property.userId !== userId) throw new ForbiddenError('Not your property');

    const { categoryId, ...changes } = pickDefined(data, [
      'title', 'description', 'categoryId', 'propertyType', 'location', 'latitude', 'longitude', 'monthlyPrice',
      'depositAmount', 'currency', 'distanceFromCampus', 'totalRooms', 'availableRooms', 'roomType', 'isFurnished',
      'hasWifi', 'hasWater', 'hasElectricity', 'hasSecurity', 'hasParking', 'rules',
    ] as const);
    let propertyCategoryId: number | undefined;
    if (categoryId !== undefined) {
      const category = await prisma.propertyCategory.findUnique({ where: { id: Number(categoryId) } });
      if (!category) throw new NotFoundError('Property category');
      propertyCategoryId = category.id;
    }

    return prisma.property.update({
      where: { id: propertyId },
      data: {
        ...changes,
        propertyType: changes.propertyType as any,
        ...(propertyCategoryId !== undefined && { propertyCategoryId }),
        status: (await editedPostStatus(property.status)) as any,
      },
    });
  }

  async deleteProperty(userId: number, propertyId: number) {
    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new NotFoundError('Property');
    if (property.userId !== userId) throw new ForbiddenError('Not your property');

    await prisma.property.update({
      where: { id: propertyId },
      data: { deletedAt: new Date() },
    });

    return { message: 'Property deleted' };
  }

  async addImages(userId: number, propertyId: number, files: Express.Multer.File[]) {
    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new NotFoundError('Property');
    if (property.userId !== userId) throw new ForbiddenError('Not your property');

    const existing = await prisma.propertyImage.count({ where: { propertyId } });
    const urls = await storeImages(files);
    const images = await Promise.all(
      files.map((file, index) =>
        prisma.propertyImage.create({
          data: {
            propertyId,
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

  async addAmenities(userId: number, propertyId: number, amenityIds: number[]) {
    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new NotFoundError('Property');
    if (property.userId !== userId) throw new ForbiddenError('Not your property');

    const validAmenities = await prisma.amenity.findMany({
      where: { id: { in: amenityIds }, isActive: true },
      select: { id: true },
    });

    if (validAmenities.length === 0) throw new NotFoundError('Amenity');

    await prisma.propertyAmenity.createMany({
      data: validAmenities.map((a: { id: number }) => ({
        propertyId,
        amenityId: a.id,
      })),
      skipDuplicates: true,
    });

    return prisma.propertyAmenity.findMany({
      where: { propertyId },
      include: { amenity: true },
    });
  }

  async getMyProperties(userId: number, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where: { userId, deletedAt: null },
        include: {
          propertyCategory: { select: { id: true, name: true, slug: true } },
          images: { where: { isPrimary: true }, take: 1 },
          amenities: {
            include: { amenity: { select: { id: true, name: true, icon: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.property.count({ where: { userId, deletedAt: null } }),
    ]);

    return { properties, meta: paginate(total, page, limit) };
  }
}

export const accommodationService = new AccommodationService();