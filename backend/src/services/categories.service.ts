import prisma from '../config/database';
import { NotFoundError, ConflictError } from '../utils/errors';
import { paginate } from '../utils/response';
import { generateSlug } from '../utils/helpers';

interface CreateCategoryInput {
  name: string;
  description?: string;
  icon?: string;
  image?: string;
  parentId?: number;
  sortOrder?: number;
}

export class CategoriesService {
  async createCategory(input: CreateCategoryInput) {
    const slug = generateSlug(input.name);

    const existing = await prisma.category.findUnique({ where: { slug } });
    if (existing) throw new ConflictError('Category with this name already exists');

    if (input.parentId) {
      const parent = await prisma.category.findUnique({ where: { id: input.parentId } });
      if (!parent) throw new NotFoundError('Parent category');
    }

    const category = await prisma.category.create({
      data: {
        name: input.name,
        slug,
        description: input.description,
        icon: input.icon,
        image: input.image,
        parentId: input.parentId,
        sortOrder: input.sortOrder || 0,
      },
    });

    return category;
  }

  async updateCategory(id: number, input: Partial<CreateCategoryInput>) {
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundError('Category');

    let slug = category.slug;
    if (input.name && input.name !== category.name) {
      slug = generateSlug(input.name);
      const existing = await prisma.category.findUnique({ where: { slug } });
      if (existing && existing.id !== id) {
        throw new ConflictError('Category with this name already exists');
      }
    }

    return prisma.category.update({
      where: { id },
      data: {
        name: input.name,
        slug,
        description: input.description,
        icon: input.icon,
        image: input.image,
        parentId: input.parentId,
        sortOrder: input.sortOrder,
        isActive: input as any,
      },
    });
  }

  async deleteCategory(id: number) {
    const category = await prisma.category.findUnique({
      where: { id },
      include: { children: true, listings: true },
    });
    if (!category) throw new NotFoundError('Category');

    if (category.children.length > 0) {
      throw new ConflictError('Cannot delete category with subcategories');
    }

    if (category.listings.length > 0) {
      throw new ConflictError('Cannot delete category with existing listings');
    }

    await prisma.category.delete({ where: { id } });
    return { message: 'Category deleted' };
  }

  async getAllActiveCategories() {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
        _count: { select: { listings: { where: { status: 'ACTIVE', deletedAt: null } } } },
      },
      orderBy: { sortOrder: 'asc' },
    });

    const tree = categories.filter(c => !c.parentId);
    const subcategories = categories.filter(c => c.parentId);

    return tree.map(parent => ({
      ...parent,
      children: subcategories.filter(sub => sub.parentId === parent.id),
    }));
  }

  async getCategoryBySlug(slug: string) {
    const category = await prisma.category.findUnique({
      where: { slug },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
        parent: true,
      },
    });

    if (!category) throw new NotFoundError('Category');
    return category;
  }

  async getActiveServiceCategories() {
    return prisma.serviceCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getActivePropertyCategories() {
    return prisma.propertyCategory.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }
}

export const categoriesService = new CategoriesService();
