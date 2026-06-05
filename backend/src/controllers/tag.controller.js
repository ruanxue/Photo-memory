import { prisma } from '../config/prisma.js';
import { success, fail } from '../utils/response.js';
import { buildPageMeta, getPagination } from '../utils/pagination.js';
import { attachViewerState, photoIncludeForViewer, visibilityFilter, buildPhotoOrder } from '../services/photo.service.js';

export const listTags = async (req, res) => {
  const tags = await prisma.tag.findMany({ orderBy: [{ photoCount: 'desc' }, { name: 'asc' }] });
  success(res, tags);
};

export const getTagPhotos = async (req, res) => {
  const id = Number(req.params.id);
  const tag = await prisma.tag.findUnique({ where: { id } });
  if (!tag) return fail(res, 404, '标签不存在');
  const { page, pageSize, skip, take } = getPagination(req.query);
  const where = { AND: [visibilityFilter(req.user), { tags: { some: { tagId: id } } }] };
  const [items, total] = await Promise.all([
    prisma.photo.findMany({ where, include: photoIncludeForViewer(req.user), orderBy: buildPhotoOrder(req.query.sort), skip, take }),
    prisma.photo.count({ where })
  ]);
  success(res, { tag, photos: attachViewerState(items, req.user) }, 'ok', buildPageMeta(total, page, pageSize));
};
