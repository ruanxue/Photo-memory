import { prisma } from '../config/prisma.js';
import { buildPageMeta, getPagination } from '../utils/pagination.js';
import { success } from '../utils/response.js';
import { attachViewerState, photoInclude, photoIncludeForViewer, buildPhotoOrder } from '../services/photo.service.js';

export const myPhotos = async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req.query);
  const where = {
    userId: req.user.id,
    status: { not: 'deleted' },
    ...(req.query.q ? { title: { contains: String(req.query.q) } } : {})
  };
  const [items, total] = await Promise.all([
    prisma.photo.findMany({ where, include: photoIncludeForViewer(req.user), orderBy: buildPhotoOrder(req.query.sort), skip, take }),
    prisma.photo.count({ where })
  ]);
  success(res, attachViewerState(items, req.user), 'ok', buildPageMeta(total, page, pageSize));
};

export const myAlbums = async (req, res) => {
  const albums = await prisma.album.findMany({
    where: { userId: req.user.id },
    include: { photos: { take: 1, orderBy: [{ sortOrder: 'desc' }, { createdAt: 'desc' }] } },
    orderBy: [{ sortOrder: 'desc' }, { createdAt: 'desc' }]
  });
  const coverIds = albums.map((album) => album.coverPhotoId).filter(Boolean);
  const covers = coverIds.length
    ? await prisma.photo.findMany({ where: { id: { in: coverIds }, userId: req.user.id }, include: photoInclude })
    : [];
  const coverMap = new Map(covers.map((photo) => [photo.id, photo]));
  success(res, albums.map((album) => ({ ...album, coverPhoto: coverMap.get(album.coverPhotoId) || album.photos?.[0] || null })));
};

export const myFavorites = async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req.query);
  const where = { userId: req.user.id, photo: { status: 'normal' } };
  const [items, total] = await Promise.all([
    prisma.favorite.findMany({ where, include: { photo: { include: photoIncludeForViewer(req.user) } }, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.favorite.count({ where })
  ]);
  success(res, items.map((item) => ({ ...item, photo: attachViewerState([item.photo], req.user)[0] })), 'ok', buildPageMeta(total, page, pageSize));
};

export const myComments = async (req, res) => {
  const comments = await prisma.comment.findMany({
    where: { userId: req.user.id },
    include: { photo: { select: { id: true, title: true, thumbnailUrl: true, externalStatus: true } } },
    orderBy: { createdAt: 'desc' }
  });
  success(res, comments);
};

export const myStatistics = async (req, res) => {
  const [photoCount, albumCount, favoriteCount, commentCount, views] = await Promise.all([
    prisma.photo.count({ where: { userId: req.user.id, status: { not: 'deleted' } } }),
    prisma.album.count({ where: { userId: req.user.id } }),
    prisma.favorite.count({ where: { userId: req.user.id } }),
    prisma.comment.count({ where: { userId: req.user.id } }),
    prisma.photo.aggregate({ where: { userId: req.user.id }, _sum: { viewCount: true } })
  ]);
  success(res, {
    photoCount,
    albumCount,
    favoriteCount,
    commentCount,
    viewCount: views._sum.viewCount || 0
  });
};
