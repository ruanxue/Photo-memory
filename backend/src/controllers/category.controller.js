import { prisma } from '../config/prisma.js';
import { success, fail } from '../utils/response.js';
import { buildPageMeta, getPagination } from '../utils/pagination.js';
import { photoInclude, visibilityFilter, buildPhotoOrder } from '../services/photo.service.js';

export const listCategories = async (req, res) => {
  const categories = await prisma.category.findMany({ orderBy: [{ sortOrder: 'desc' }, { photoCount: 'desc' }, { name: 'asc' }] });
  success(res, categories);
};

export const getCategoryPhotos = async (req, res) => {
  const id = Number(req.params.id);
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) return fail(res, 404, '分类不存在');
  const { page, pageSize, skip, take } = getPagination(req.query);
  const where = { AND: [visibilityFilter(req.user), { categoryId: id }] };
  const [items, total] = await Promise.all([
    prisma.photo.findMany({ where, include: photoInclude, orderBy: buildPhotoOrder(req.query.sort), skip, take }),
    prisma.photo.count({ where })
  ]);
  success(res, { category, photos: items }, 'ok', buildPageMeta(total, page, pageSize));
};
