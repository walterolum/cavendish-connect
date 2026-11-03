import prisma from '../config/database';
import { NotFoundError, ForbiddenError, BadRequestError, ConflictError } from '../utils/errors';
import { paginate } from '../utils/response';
import { auditLog } from '../middleware/audit';

interface CreateReviewInput {
  targetType: string;
  targetId: number;
  rating: number;
  title?: string;
  content?: string;
}

export class ReviewsService {
  async createReview(authorId: number, input: CreateReviewInput) {
    if (!['SELLER', 'SERVICE_PROVIDER', 'LANDLORD', 'BUSINESS'].includes(input.targetType)) {
      throw new BadRequestError('Invalid target type');
    }

    if (input.rating < 1 || input.rating > 5) {
      throw new BadRequestError('Rating must be between 1 and 5');
    }

    // Every review type rates a person, identified by their user id.
    if (input.targetId === authorId) {
      throw new BadRequestError('You cannot review yourself');
    }
    const target = await prisma.user.findFirst({ where: { id: input.targetId, deletedAt: null } });
    if (!target) throw new NotFoundError('User');

    const existing = await prisma.review.findUnique({
      where: {
        authorId_targetType_targetId: {
          authorId,
          targetType: input.targetType as any,
          targetId: input.targetId,
        },
      },
    });

    if (existing) {
      throw new ConflictError('You have already reviewed this item');
    }

    const review = await prisma.review.create({
      data: {
        authorId,
        targetType: input.targetType as any,
        targetId: input.targetId,
        rating: input.rating,
        title: input.title,
        content: input.content,
      },
      include: {
        author: {
          select: {
            id: true, username: true, firstName: true, lastName: true, avatar: true,
          },
        },
      },
    });

    auditLog(authorId, 'CREATE', 'REVIEW', review.id).catch(() => {});

    return review;
  }

  async getReviewsForTarget(targetType: string, targetId: number, page: number = 1, limit: number = 20) {
    if (!['SELLER', 'SERVICE_PROVIDER', 'LANDLORD', 'BUSINESS'].includes(targetType)) {
      throw new BadRequestError('Invalid target type');
    }

    const skip = (page - 1) * limit;

    const where = {
      targetType: targetType as any,
      targetId,
      status: 'ACTIVE' as const,
    };

    const [reviews, total, aggregate] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          author: {
            select: {
              id: true, username: true, firstName: true, lastName: true, avatar: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.review.count({ where }),
      prisma.review.aggregate({
        where,
        _avg: { rating: true },
        _count: true,
      }),
    ]);

    return {
      reviews,
      averageRating: aggregate._avg.rating,
      totalReviews: aggregate._count,
      meta: paginate(total, page, limit),
    };
  }

  async deleteReview(userId: number, reviewId: number) {
    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundError('Review');
    if (review.authorId !== userId) throw new ForbiddenError('Not your review');

    await prisma.review.update({
      where: { id: reviewId },
      data: { status: 'DELETED' },
    });

    return { message: 'Review deleted' };
  }

  async getAverageRating(targetType: string, targetId: number) {
    const aggregate = await prisma.review.aggregate({
      where: {
        targetType: targetType as any,
        targetId,
        status: 'ACTIVE',
      },
      _avg: { rating: true },
      _count: true,
    });

    return {
      averageRating: aggregate._avg.rating,
      totalReviews: aggregate._count,
    };
  }
}

export const reviewsService = new ReviewsService();
