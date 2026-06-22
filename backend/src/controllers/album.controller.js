import { prisma } from '../config/prisma.js';
import { buildPageMeta, getPagination } from '../utils/pagination.js';
import { created, fail, success } from '../utils/response.js';
import { attachViewerState, photoInclude, photoIncludeForViewer, refreshPhotoRelatedCounters, visibilityFilter } from '../services/photo.service.js';

const canManageAlbum = (album, user) => user && (user.role === 'admin' || album.userId === user.id);

const albumWhere = (user) => {
  if (user?.role === 'admin') return {};
  if (user) return { OR: [{ visibility: 'public' }, { userId: user.id }] };
  return { visibility: 'public' };
};

const visibleAlbumPhotoWhere = (albumId, user) => ({
  AND: [
    visibilityFilter(user),
    { albumId }
  ]
});

const attachVisiblePhotoCounts = async (albums, user) => {
  const counts = await Promise.all(albums.map((album) =>
    prisma.photo.count({ where: visibleAlbumPhotoWhere(album.id, user) })
  ));
  return albums.map((album, index) => ({ ...album, photoCount: counts[index] }));
};

const attachCoverPhotos = async (albums, user) => {
  const coverIds = albums.map((album) => album.coverPhotoId).filter(Boolean);
  if (!coverIds.length) return albums.map((album) => ({ ...album, coverPhoto: album.photos?.[0] || null }));
  const covers = await prisma.photo.findMany({
    where: { AND: [{ id: { in: coverIds } }, visibilityFilter(user)] },
    include: photoInclude
  });
  const coverMap = new Map(covers.map((photo) => [photo.id, photo]));
  return albums.map((album) => ({ ...album, coverPhoto: coverMap.get(album.coverPhotoId) || album.photos?.[0] || null }));
};

export const listAlbums = async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req.query);
  const where = albumWhere(req.user);
  const [items, total] = await Promise.all([
    prisma.album.findMany({
      where,
      include: {
        user: { select: { id: true, username: true, nickname: true } },
        photos: { where: visibilityFilter(req.user), take: 1, orderBy: [{ sortOrder: 'desc' }] }
      },
      orderBy: [{ isPinned: 'desc' }, { sortOrder: 'desc' }, { createdAt: 'desc' }],
      skip,
      take
    }),
    prisma.album.count({ where })
  ]);
  const withCovers = await attachCoverPhotos(items, req.user);
  success(res, await attachVisiblePhotoCounts(withCovers, req.user), 'ok', buildPageMeta(total, page, pageSize));
};

export const getAlbum = async (req, res) => {
  const id = Number(req.params.id);
  const album = await prisma.album.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, username: true, nickname: true } },
      photos: { where: visibilityFilter(req.user), include: photoIncludeForViewer(req.user), orderBy: [{ sortOrder: 'desc' }, { takenAt: 'desc' }] }
    }
  });
  if (!album) return fail(res, 404, '相册不存在');
  if (!canManageAlbum(album, req.user) && album.visibility !== 'public') return fail(res, 403, '没有权限查看该相册');
  success(res, { ...album, photoCount: album.photos.length, photos: attachViewerState(album.photos, req.user) });
};

export const createAlbum = async (req, res) => {
  const album = await prisma.album.create({
    data: {
      userId: req.user.id,
      title: req.body.title,
      description: req.body.description || null,
      visibility: req.body.visibility === 'private' ? 'private' : 'public',
      isPinned: req.body.isPinned === true || req.body.isPinned === 'true',
      sortOrder: Number(req.body.sortOrder || 0)
    }
  });
  created(res, album, '相册已创建');
};

export const updateAlbum = async (req, res) => {
  const id = Number(req.params.id);
  const album = await prisma.album.findUnique({ where: { id } });
  if (!album) return fail(res, 404, '相册不存在');
  if (!canManageAlbum(album, req.user)) return fail(res, 403, '没有权限编辑该相册');
  let coverPhotoId = album.coverPhotoId;
  if (Object.prototype.hasOwnProperty.call(req.body, 'coverPhotoId')) {
    coverPhotoId = Number(req.body.coverPhotoId) || null;
    if (coverPhotoId) {
      const cover = await prisma.photo.findFirst({ where: { id: coverPhotoId, albumId: id, status: { not: 'deleted' } } });
      if (!cover) return fail(res, 422, '卡片头图必须来自当前相册');
    }
  }
  const updated = await prisma.album.update({
    where: { id },
    data: {
      title: req.body.title ?? album.title,
      description: req.body.description ?? album.description,
      coverPhotoId,
      visibility: req.body.visibility || album.visibility,
      isPinned: req.body.isPinned === undefined ? album.isPinned : req.body.isPinned === true || req.body.isPinned === 'true',
      sortOrder: req.body.sortOrder === undefined ? album.sortOrder : Number(req.body.sortOrder),
      startDate: req.body.startDate ? new Date(req.body.startDate) : album.startDate,
      endDate: req.body.endDate ? new Date(req.body.endDate) : album.endDate
    }
  });
  success(res, updated, '相册已更新');
};

export const deleteAlbum = async (req, res) => {
  const id = Number(req.params.id);
  const album = await prisma.album.findUnique({ where: { id } });
  if (!album) return fail(res, 404, '相册不存在');
  if (!canManageAlbum(album, req.user)) return fail(res, 403, '没有权限删除该相册');
  await prisma.photo.updateMany({ where: { albumId: id }, data: { albumId: null } });
  await prisma.album.delete({ where: { id } });
  await refreshPhotoRelatedCounters({ albumIds: [id] });
  success(res, null, '相册已删除');
};

export const sortAlbumPhotos = async (req, res) => {
  const id = Number(req.params.id);
  const album = await prisma.album.findUnique({ where: { id } });
  if (!album) return fail(res, 404, '相册不存在');
  if (!canManageAlbum(album, req.user)) return fail(res, 403, '没有权限排序该相册');
  const photoIds = Array.isArray(req.body.photoIds) ? req.body.photoIds.map(Number) : [];
  await Promise.all(photoIds.map((photoId, index) => prisma.photo.updateMany({
    where: { id: photoId, albumId: id },
    data: { sortOrder: photoIds.length - index }
  })));
  success(res, null, '相册照片排序已保存');
};

export const setAlbumCover = async (req, res) => {
  const id = Number(req.params.id);
  const album = await prisma.album.findUnique({ where: { id } });
  if (!album) return fail(res, 404, '相册不存在');
  if (!canManageAlbum(album, req.user)) return fail(res, 403, '没有权限设置封面');
  const coverPhotoId = Number(req.body.photoId) || null;
  if (coverPhotoId) {
    const cover = await prisma.photo.findFirst({ where: { id: coverPhotoId, albumId: id, status: { not: 'deleted' } } });
    if (!cover) return fail(res, 422, '卡片头图必须来自当前相册');
  }
  const updated = await prisma.album.update({ where: { id }, data: { coverPhotoId } });
  success(res, updated, '封面已更新');
};
