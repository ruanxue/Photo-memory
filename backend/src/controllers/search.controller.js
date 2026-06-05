import { prisma } from '../config/prisma.js';
import { buildPageMeta, getPagination } from '../utils/pagination.js';
import { success } from '../utils/response.js';
import { photoInclude, visibilityFilter, buildPhotoOrder } from '../services/photo.service.js';

export const search = async (req, res) => {
  const q = String(req.query.q || '').trim();
  const { page, pageSize, skip, take } = getPagination(req.query);
  if (!q) return success(res, { photos: [], albums: [], tags: [], categories: [] }, 'ok', buildPageMeta(0, page, pageSize));

  const photoWhere = {
    AND: [
      visibilityFilter(req.user),
      {
        OR: [
          { title: { contains: q } },
          { description: { contains: q } },
          { city: { contains: q } },
          { country: { contains: q } },
          { cameraMake: { contains: q } },
          { cameraModel: { contains: q } },
          { album: { is: { title: { contains: q } } } },
          { category: { is: { name: { contains: q } } } },
          { tags: { some: { tag: { name: { contains: q } } } } }
        ]
      }
    ]
  };

  const albumWhere = req.user?.role === 'admin'
    ? { title: { contains: q } }
    : { AND: [{ title: { contains: q } }, req.user ? { OR: [{ visibility: 'public' }, { userId: req.user.id }] } : { visibility: 'public' }] };

  const [photos, total, albums, tags, categories] = await Promise.all([
    prisma.photo.findMany({ where: photoWhere, include: photoInclude, orderBy: buildPhotoOrder(req.query.sort), skip, take }),
    prisma.photo.count({ where: photoWhere }),
    prisma.album.findMany({ where: albumWhere, take: 8 }),
    prisma.tag.findMany({ where: { name: { contains: q } }, take: 20 }),
    prisma.category.findMany({ where: { name: { contains: q } }, take: 12 })
  ]);

  success(res, { photos, albums, tags, categories, keyword: q }, 'ok', buildPageMeta(total, page, pageSize));
};
