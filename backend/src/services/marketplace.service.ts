import { newPostStatus, editedPostStatus } from '../utils/settings';
import { pickDefined, canViewListing, Viewer } from '../utils/helpers';
import prisma from '../config/database';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors';
import { paginate, PaginationMeta } from '../utils/response';
import { generateSlug } from '../utils/helpers';
import { auditLog } from '../middleware/audit';

interface CreateListingInput {
  title: string;
  description: string;
  categoryId: number;
  price: number;
  currency?: string;
  condition: string;
  quantity?: number;
  location?: string;
  isNegotiable?: boolean;
}

interface ListQuery {
  page?: number;
  limit?: number;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  condition?: string;
  search?: string;
  sort?: string;
  location?: string;
}

export class MarketplaceService {
  async createListing(userId: number, input: CreateListingInput) {
    const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
    if (!category) throw new NotFoundError('Category');

    const slug = generateSlug(input.title) + '-' + Date.now().toString(36);

    const listing = await prisma.marketplaceListing.create({
      data: {
        userId,
        categoryId: input.categoryId,
        title: input.title,
        slug,
        description: input.description,
        price: input.price,
        currency: input.currency || 'UGX',
        condition: input.condition as any,
        quantity: input.quantity || 1,
        location: input.location,
        isNegotiable: input.isNegotiable || false,
        status: await newPostStatus(),
      },
      include: {
        category: true,
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

    auditLog(userId, 'CREATE', 'MARKETPLACE', listing.id).catch(() => {});

    return listing;
  }

  async getListing(slug: string, viewer?: Viewer) {
    const viewerId = viewer?.userId;
    const listing = await prisma.marketplaceListing.findUnique({
      where: { slug, deletedAt: null },
      include: {
        category: true,
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
                marketplaceListings: { where: { status: 'ACTIVE', deletedAt: null } },
              },
            },
          },
        },
        images: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!listing || listing.deletedAt || !canViewListing(listing.status, listing.userId, viewer)) {
      throw new NotFoundError('Listing');
    }

    const countView = viewerId !== listing.userId;
    if (countView) {
      await prisma.marketplaceListing.update({
        where: { id: listing.id },
        data: { viewCount: { increment: 1 } },
      });
    }

    let isFavorited = false;
    if (viewerId) {
      const fav = await prisma.favorite.findUnique({
        where: {
          userId_targetType_targetId: {
            userId: viewerId,
            targetType: 'MARKETPLACE',
            targetId: listing.id,
          },
        },
      });
      isFavorited = !!fav;
    }

    return { ...listing, isFavorited, viewCount: listing.viewCount + (countView ? 1 : 0) };
  }

  async getListings(query: ListQuery) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 50);
    const skip = (page - 1) * limit;

    const where: any = {
      status: 'ACTIVE',
      deletedAt: null,
    };

    if (query.category) {
      const cat = await prisma.category.findUnique({ where: { slug: query.category } });
      if (cat) where.categoryId = cat.id;
    }

    if (query.minPrice || query.maxPrice) {
      where.price = {};
      if (query.minPrice) where.price.gte = query.minPrice;
      if (query.maxPrice) where.price.lte = query.maxPrice;
    }

    if (query.condition) {
      where.condition = query.condition;
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
        case 'price_asc': return { price: 'asc' as const };
        case 'price_desc': return { price: 'desc' as const };
        case 'oldest': return { createdAt: 'asc' as const };
        case 'popular': return { viewCount: 'desc' as const };
        default: return { createdAt: 'desc' as const };
      }
    })();

    const [listings, total] = await Promise.all([
      prisma.marketplaceListing.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true } },
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
      prisma.marketplaceListing.count({ where }),
    ]);

    return {
      listings,
      meta: paginate(total, page, limit),
    };
  }

  async updateListing(userId: number, listingId: number, data: Partial<CreateListingInput>) {
    const listing = await prisma.marketplaceListing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundError('Listing');
    if (listing.userId !== userId) throw new ForbiddenError('Not your listing');

    const changes = pickDefined(data, [
      'title', 'description', 'categoryId', 'price', 'currency', 'condition', 'quantity', 'location', 'isNegotiable',
    ] as const);
    if (changes.categoryId !== undefined) {
      const category = await prisma.category.findUnique({ where: { id: Number(changes.categoryId) } });
      if (!category) throw new NotFoundError('Category');
      changes.categoryId = category.id;
    }

    return prisma.marketplaceListing.update({
      where: { id: listingId },
      data: {
        ...changes,
        condition: changes.condition as any,
        // Edits stay live unless review is switched on (see utils/settings).
        status: (await editedPostStatus(listing.status)) as any,
      },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
  }

  async deleteListing(userId: number, listingId: number) {
    const listing = await prisma.marketplaceListing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundError('Listing');
    if (listing.userId !== userId) throw new ForbiddenError('Not your listing');

    await prisma.marketplaceListing.update({
      where: { id: listingId },
      data: { deletedAt: new Date() },
    });

    return { message: 'Listing deleted' };
  }

  async addImages(userId: number, listingId: number, files: Express.Multer.File[]) {
    const listing = await prisma.marketplaceListing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundError('Listing');
    if (listing.userId !== userId) throw new ForbiddenError('Not your listing');

    const existing = await prisma.marketplaceListingImage.count({ where: { listingId } });
    const images = await Promise.all(
      files.map((file, index) =>
        prisma.marketplaceListingImage.create({
          data: {
            listingId,
            url: `/uploads/${file.filename}`,
            alt: file.originalname,
            sortOrder: existing + index,
            isPrimary: existing === 0 && index === 0,
          },
        })
      )
    );

    return images;
  }

  async getMyListings(userId: number, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [listings, total] = await Promise.all([
      prisma.marketplaceListing.findMany({
        where: { userId, deletedAt: null },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          images: { where: { isPrimary: true }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.marketplaceListing.count({ where: { userId, deletedAt: null } }),
    ]);

    return { listings, meta: paginate(total, page, limit) };
  }
}

export const marketplaceService = new MarketplaceService();
