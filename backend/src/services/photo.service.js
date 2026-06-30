import slugify from 'slugify';
import { prisma } from '../config/prisma.js';
import { safeUnlinkUpload } from '../utils/file.js';

export const photoInclude = {
  user: { select: { id: true, username: true, nickname: true, avatar: true } },
  album: { select: { id: true, title: true } },
  category: { select: { id: true, name: true, slug: true } },
  tags: { include: { tag: true } }
};

export const photoIncludeForViewer = () => photoInclude;

export const photoWallSelect = {
  id: true,
  title: true,
  mediumUrl: true,
  smallUrl: true,
  thumbnailUrl: true,
  originalUrl: true,
  externalStatus: true,
  externalCheckedAt: true,
  width: true,
  height: true,
  takenAt: true,
  uploadedAt: true,
  city: true,
  locationName: true,
  viewCount: true,
  isPinned: true,
  isFeatured: true,
  sortOrder: true,
  createdAt: true,
  cameraMake: true,
  cameraModel: true,
  lensModel: true,
  focalLength: true,
  aperture: true,
  shutterSpeed: true,
  iso: true,
  tags: { select: { tag: { select: { id: true, name: true, slug: true, color: true } } } },
  album: { select: { id: true, title: true } }
};

export const attachViewerState = (items) => items;

export const attachWallCardFields = (items) => items.map((photo) => ({ ...photo, cardType: 'photo' }));

export const visibilityFilter = (user) => {
  if (user?.role === 'admin') return { status: { not: 'deleted' } };
  if (user) {
    return {
      status: 'normal',
      AND: [
        { OR: [{ visibility: 'public' }, { userId: user.id }] },
        {
          OR: [
            { albumId: null },
            { userId: user.id },
            { album: { visibility: 'public' } },
            { album: { userId: user.id } }
          ]
        }
      ]
    };
  }
  return {
    status: 'normal',
    visibility: 'public',
    OR: [
      { albumId: null },
      { album: { visibility: 'public' } }
    ]
  };
};

export const requirePhotoAccess = async (photoId, user, allowPrivate = false) => {
  const photo = await prisma.photo.findUnique({
    where: { id: Number(photoId) },
    include: {
      ...photoInclude,
      album: { select: { id: true, title: true, visibility: true, userId: true } }
    }
  });
  if (!photo || photo.status === 'deleted') {
    const err = new Error('照片不存在');
    err.status = 404;
    throw err;
  }
  const canManage = user && (user.role === 'admin' || user.id === photo.userId);
  const canManageAlbum = user && photo.album && (user.role === 'admin' || user.id === photo.album.userId);
  const hiddenByPhoto = photo.visibility !== 'public';
  const hiddenByAlbum = photo.album?.visibility === 'private' && !canManageAlbum;
  if (!canManage && !allowPrivate && (hiddenByPhoto || hiddenByAlbum)) {
    const err = new Error('没有权限查看该照片');
    err.status = 403;
    throw err;
  }
  const safePhoto = {
    ...photo,
    album: photo.album ? { id: photo.album.id, title: photo.album.title } : null
  };
  return { photo: safePhoto, canManage };
};

export const parseTagNames = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String).map((item) => item.trim()).filter(Boolean);
  } catch {
    // fall back to comma separated text
  }
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export const upsertTags = async (tagNames) => {
  const uniqueNames = [...new Set(tagNames)];
  const tags = [];
  for (const name of uniqueNames) {
    const slug = slugify(name, { lower: true, strict: true, locale: 'zh' }) || encodeURIComponent(name);
    const tag = await prisma.tag.upsert({
      where: { name },
      update: {},
      create: { name, slug, color: null }
    });
    tags.push(tag);
  }
  return tags;
};

const uniqueIds = (values = []) => [...new Set(values.map(Number).filter((id) => Number.isInteger(id) && id > 0))];

export const refreshCategoryCounters = async (categoryIds = []) => {
  const ids = uniqueIds(categoryIds);
  await Promise.all(ids.map(async (id) => {
    const count = await prisma.photo.count({ where: { categoryId: id, status: 'normal' } });
    await prisma.category.updateMany({ where: { id }, data: { photoCount: count } });
  }));
};

export const refreshTagCounters = async (tagIds = []) => {
  const ids = uniqueIds(tagIds);
  await Promise.all(ids.map(async (id) => {
    const count = await prisma.photoTag.count({ where: { tagId: id, photo: { status: 'normal' } } });
    await prisma.tag.updateMany({ where: { id }, data: { photoCount: count } });
  }));
};

export const refreshAlbumCounters = async (albumIds = []) => {
  const ids = uniqueIds(albumIds);
  await Promise.all(ids.map(async (id) => {
    const count = await prisma.photo.count({ where: { albumId: id, status: 'normal' } });
    await prisma.album.updateMany({ where: { id }, data: { photoCount: count } });
  }));
};

export const refreshPhotoRelatedCounters = async ({ categoryIds = [], tagIds = [], albumIds = [] } = {}) => {
  await Promise.all([
    refreshCategoryCounters(categoryIds),
    refreshTagCounters(tagIds),
    refreshAlbumCounters(albumIds)
  ]);
};

export const setPhotoTags = async (photoId, tagNames) => {
  if (tagNames === undefined) return { previousTagIds: [], tagIds: [], affectedTagIds: [] };
  const previousLinks = await prisma.photoTag.findMany({ where: { photoId }, select: { tagId: true } });
  const previousTagIds = previousLinks.map((link) => link.tagId);
  await prisma.photoTag.deleteMany({ where: { photoId } });
  const tags = await upsertTags(tagNames);
  if (tags.length) {
    await prisma.photoTag.createMany({
      data: tags.map((tag) => ({ photoId, tagId: tag.id }))
    });
  }
  const tagIds = tags.map((tag) => tag.id);
  const affectedTagIds = uniqueIds([...previousTagIds, ...tagIds]);
  await refreshTagCounters(affectedTagIds);
  return { previousTagIds, tagIds, affectedTagIds };
};

export const refreshCounters = async () => {
  const [categories, tags, albums] = await Promise.all([
    prisma.category.findMany({ select: { id: true } }),
    prisma.tag.findMany({ select: { id: true } }),
    prisma.album.findMany({ select: { id: true } })
  ]);

  await Promise.all([
    ...categories.map(async (category) =>
      prisma.category.update({
        where: { id: category.id },
        data: { photoCount: await prisma.photo.count({ where: { categoryId: category.id, status: 'normal' } }) }
      })
    ),
    ...tags.map(async (tag) =>
      prisma.tag.update({
        where: { id: tag.id },
        data: { photoCount: await prisma.photoTag.count({ where: { tagId: tag.id, photo: { status: 'normal' } } }) }
      })
    ),
    ...albums.map(async (album) =>
      prisma.album.update({
        where: { id: album.id },
        data: { photoCount: await prisma.photo.count({ where: { albumId: album.id, status: 'normal' } }) }
      })
    )
  ]);
};

export const deletePhotoFiles = async (photo) => {
  await Promise.all([
    safeUnlinkUpload(photo.originalUrl),
    safeUnlinkUpload(photo.mediumUrl),
    safeUnlinkUpload(photo.smallUrl),
    safeUnlinkUpload(photo.thumbnailUrl)
  ]);
};

export const buildPhotoOrder = (sort = 'latest') => {
  const base = [{ isPinned: 'desc' }, { sortOrder: 'desc' }];
  const map = {
    latest: { uploadedAt: 'desc' },
    taken: { takenAt: 'desc' },
    views: { viewCount: 'desc' },
    favorites: { favoriteCount: 'desc' },
    comments: { commentCount: 'desc' },
    custom: { sortOrder: 'desc' }
  };
  return [...base, map[sort] || map.latest, { createdAt: 'desc' }];
};
