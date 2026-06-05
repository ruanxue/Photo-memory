import slugify from 'slugify';
import { prisma } from '../config/prisma.js';
import { safeUnlinkUpload } from '../utils/file.js';

export const photoInclude = {
  user: { select: { id: true, username: true, nickname: true, avatar: true } },
  album: { select: { id: true, title: true } },
  category: { select: { id: true, name: true, slug: true } },
  tags: { include: { tag: true } }
};

export const photoIncludeForViewer = (user, deviceId = null) => {
  const visitorMatches = [];
  if (user) visitorMatches.push({ userId: user.id });
  if (deviceId) visitorMatches.push({ deviceId });
  return visitorMatches.length
    ? { ...photoInclude, likes: { where: { isActive: true, OR: visitorMatches }, select: { id: true } } }
    : photoInclude;
};

export const attachViewerState = (items) => items.map((photo) => {
  if (!Object.prototype.hasOwnProperty.call(photo, 'likes')) return { ...photo, liked: false };
    const { likes, ...rest } = photo;
    return { ...rest, liked: Boolean(likes?.length) };
});

export const visibilityFilter = (user) => {
  if (user?.role === 'admin') return { status: { not: 'deleted' } };
  if (user) {
    return {
      status: 'normal',
      OR: [{ visibility: 'public' }, { userId: user.id }]
    };
  }
  return { status: 'normal', visibility: 'public' };
};

export const requirePhotoAccess = async (photoId, user, allowPrivate = false) => {
  const photo = await prisma.photo.findUnique({ where: { id: Number(photoId) }, include: photoInclude });
  if (!photo || photo.status === 'deleted') {
    const err = new Error('照片不存在');
    err.status = 404;
    throw err;
  }
  const canManage = user && (user.role === 'admin' || user.id === photo.userId);
  if (!canManage && photo.visibility !== 'public' && !allowPrivate) {
    const err = new Error('没有权限查看该照片');
    err.status = 403;
    throw err;
  }
  return { photo, canManage };
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
      create: { name, slug, color: '#eef2ff' }
    });
    tags.push(tag);
  }
  return tags;
};

export const setPhotoTags = async (photoId, tagNames) => {
  if (tagNames === undefined) return;
  await prisma.photoTag.deleteMany({ where: { photoId } });
  const tags = await upsertTags(tagNames);
  if (tags.length) {
    await prisma.photoTag.createMany({
      data: tags.map((tag) => ({ photoId, tagId: tag.id }))
    });
  }
  await refreshCounters();
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
    safeUnlinkUpload(photo.thumbnailUrl)
  ]);
};

export const buildPhotoOrder = (sort = 'latest') => {
  const base = [{ isPinned: 'desc' }, { sortOrder: 'desc' }, { isFeatured: 'desc' }];
  const map = {
    latest: { uploadedAt: 'desc' },
    taken: { takenAt: 'desc' },
    views: { viewCount: 'desc' },
    likes: { likeCount: 'desc' },
    favorites: { favoriteCount: 'desc' },
    comments: { commentCount: 'desc' },
    custom: { sortOrder: 'desc' }
  };
  return [...base, map[sort] || map.latest, { createdAt: 'desc' }];
};
