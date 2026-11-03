import prisma from '../config/database';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { paginate } from '../utils/response';

const VALID_TYPES = ['MARKETPLACE', 'SERVICE', 'ACCOMMODATION'];

export class FavoritesService {
  async toggleFavorite(userId: number, targetType: string, targetId: number) {
    if (!VALID_TYPES.includes(targetType)) {
      throw new BadRequestError('Invalid target type');
    }

    const existing = await prisma.favorite.findUnique({
      where: {
        userId_targetType_targetId: {
          userId,
          targetType: targetType as any,
          targetId,
        },
      },
    });

    if (existing) {
      await prisma.favorite.delete({ where: { id: existing.id } });
      return { favorited: false };
    }

    await prisma.favorite.create({
      data: {
        userId,
        targetType: targetType as any,
        targetId,
      },
    });

    return { favorited: true };
  }

  async getUserFavorites(userId: number, type?: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (type && VALID_TYPES.includes(type)) {
      where.targetType = type;
    }

    const [favorites, total] = await Promise.all([
      prisma.favorite.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.favorite.count({ where }),
    ]);

    const enriched = await Promise.all(
      favorites.map(async (fav) => {
        let target = null;
        if (fav.targetType === 'MARKETPLACE') {
          target = await prisma.marketplaceListing.findFirst({
            where: { id: fav.targetId, deletedAt: null },
            select: {
              id: true, title: true, slug: true, price: true, currency: true,
              condition: true, status: true, createdAt: true,
              user: { select: { id: true, username: true, firstName: true, lastName: true, avatar: true } },
              category: { select: { id: true, name: true, slug: true } },
              images: { where: { isPrimary: true }, take: 1 },
            },
          });
        } else if (fav.targetType === 'SERVICE') {
          target = await prisma.service.findFirst({
            where: { id: fav.targetId, deletedAt: null },
            select: {
              id: true, title: true, slug: true, priceMin: true, priceMax: true, currency: true,
              status: true, createdAt: true,
              user: { select: { id: true, username: true, firstName: true, lastName: true, avatar: true } },
              serviceCategory: { select: { id: true, name: true, slug: true, icon: true } },
              images: { where: { isPrimary: true }, take: 1 },
            },
          });
        } else if (fav.targetType === 'ACCOMMODATION') {
          target = await prisma.property.findFirst({
            where: { id: fav.targetId, deletedAt: null },
            select: {
              id: true, title: true, slug: true, monthlyPrice: true, currency: true,
              location: true, status: true, createdAt: true,
              user: { select: { id: true, username: true, firstName: true, lastName: true, avatar: true } },
              propertyCategory: { select: { id: true, name: true, slug: true } },
              images: { where: { isPrimary: true }, take: 1 },
            },
          });
        }

        return { ...fav, target };
      })
    );

    return { favorites: enriched, meta: paginate(total, page, limit) };
  }

  async checkFavorited(userId: number, targetType: string, targetId: number) {
    if (!VALID_TYPES.includes(targetType)) {
      throw new BadRequestError('Invalid target type');
    }

    const favorite = await prisma.favorite.findUnique({
      where: {
        userId_targetType_targetId: {
          userId,
          targetType: targetType as any,
          targetId,
        },
      },
    });

    return { isFavorited: !!favorite };
  }
}

export const favoritesService = new FavoritesService();