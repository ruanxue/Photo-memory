import slugify from 'slugify';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { created, fail, success } from '../utils/response.js';
import { buildPageMeta, getPagination } from '../utils/pagination.js';
import { hashPassword } from '../utils/password.js';
import { normalizeTrustProxyHops, parseTrustProxyValue } from '../utils/proxy.js';
import { getAdminStatistics } from '../services/statistics.service.js';
import {
  buildPhotoOrder,
  deletePhotoFiles,
  parseTagNames,
  photoInclude,
  refreshPhotoRelatedCounters,
  setPhotoTags
} from '../services/photo.service.js';
import {
  cacheExternalPhotoToLocal,
  externalPhotoUrls,
  isExternalPhotoRecord
} from '../services/external-image.service.js';

const toBool = (value) => value === true || value === 'true' || value === '1';
const toInt = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
};
const parseIds = (value) => {
  if (!value) return [];
  return [...new Set(String(value)
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0))]
    .slice(0, 200);
};
const toFloatOrNull = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const parseDate = (value) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};
const makeSlug = (value) => slugify(value, { lower: true, strict: true, locale: 'zh' }) || encodeURIComponent(value);
const safeUser = (user) => {
  const { passwordHash, ...rest } = user;
  return rest;
};
const normalizeImageUrl = (value) => {
  const url = String(value || '').trim();
  if (!url || !/^https?:\/\/[^<>"'\s]+$/i.test(url)) return '';
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    return parsed.toString();
  } catch {
    return '';
  }
};

const adminPhotoData = (body) => {
  const data = {};
  if (Object.prototype.hasOwnProperty.call(body, 'title')) {
    data.title = String(body.title || '').trim() || '未命名照片';
  }
  [
    'description',
    'cameraMake',
    'cameraModel',
    'lensModel',
    'shutterSpeed',
    'exposureCompensation',
    'whiteBalance',
    'country',
    'province',
    'city',
    'locationName'
  ].forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) data[field] = body[field] === '' ? null : body[field] || null;
  });
  if (Object.prototype.hasOwnProperty.call(body, 'visibility')) {
    data.visibility = body.visibility === 'private' ? 'private' : 'public';
  }
  if (Object.prototype.hasOwnProperty.call(body, 'status')) {
    data.status = ['normal', 'hidden', 'deleted'].includes(body.status) ? body.status : 'normal';
  }
  ['albumId', 'categoryId', 'iso'].forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) data[field] = toInt(body[field]) ?? null;
  });
  if (Object.prototype.hasOwnProperty.call(body, 'sortOrder')) data.sortOrder = toInt(body.sortOrder) ?? 0;
  ['focalLength', 'aperture', 'latitude', 'longitude'].forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) data[field] = toFloatOrNull(body[field]);
  });
  ['originalUrl', 'mediumUrl', 'thumbnailUrl'].forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(body, field)) return;
    const value = normalizeImageUrl(body[field]);
    if (!value) {
      const err = new Error('请填写有效的图片 URL');
      err.status = 422;
      throw err;
    }
    data[field] = value;
    data.externalStatus = 'unchecked';
    data.externalCheckedAt = null;
    data.externalError = null;
    if (field === 'originalUrl') data.externalSourceUrl = value;
    data.externalCachedAt = null;
  });
  if (Object.prototype.hasOwnProperty.call(body, 'takenAt')) data.takenAt = parseDate(body.takenAt) || null;
  if (Object.prototype.hasOwnProperty.call(body, 'isPinned')) {
    data.isPinned = toBool(body.isPinned);
    data.pinnedAt = data.isPinned ? new Date() : null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'isFeatured')) data.isFeatured = toBool(body.isFeatured);
  if (Object.prototype.hasOwnProperty.call(body, 'showInWaterfall')) data.showInWaterfall = toBool(body.showInWaterfall);
  return data;
};

export const statistics = async (req, res) => {
  success(res, await getAdminStatistics());
};

export const listUsers = async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req.query);
  const q = String(req.query.q || '').trim();
  const where = q
    ? { OR: [{ username: { contains: q } }, { email: { contains: q } }, { nickname: { contains: q } }] }
    : {};
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        email: true,
        nickname: true,
        avatar: true,
        bio: true,
        role: true,
        status: true,
        createdAt: true,
        _count: { select: { photos: true, albums: true, comments: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take
    }),
    prisma.user.count({ where })
  ]);
  success(res, items, 'ok', buildPageMeta(total, page, pageSize));
};

export const createUser = async (req, res) => {
  const { username, email, password, nickname, role, status } = req.body;
  const exists = await prisma.user.findFirst({ where: { OR: [{ username }, { email }] } });
  if (exists) return fail(res, 409, '用户名或邮箱已存在');
  const user = await prisma.user.create({
    data: {
      username,
      email,
      nickname: nickname || username,
      passwordHash: await hashPassword(password || '12345678'),
      role: role === 'admin' ? 'admin' : 'user',
      status: status === 'disabled' ? 'disabled' : 'active'
    }
  });
  created(res, safeUser(user), '用户已创建');
};

export const updateUser = async (req, res) => {
  const id = Number(req.params.id);
  const user = await prisma.user.update({
    where: { id },
    data: {
      username: req.body.username,
      email: req.body.email,
      nickname: req.body.nickname,
      avatar: req.body.avatar,
      bio: req.body.bio,
      status: req.body.status,
      role: req.body.role
    }
  });
  success(res, safeUser(user), '用户已更新');
};

export const deleteUser = async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return fail(res, 422, '不能删除当前登录管理员');
  await prisma.user.delete({ where: { id } });
  success(res, null, '用户已删除');
};

export const updateUserStatus = async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id && req.body.status === 'disabled') return fail(res, 422, '不能禁用当前登录管理员');
  const user = await prisma.user.update({ where: { id }, data: { status: req.body.status === 'disabled' ? 'disabled' : 'active' } });
  success(res, user, '用户状态已更新');
};

export const updateUserRole = async (req, res) => {
  const id = Number(req.params.id);
  const user = await prisma.user.update({ where: { id }, data: { role: req.body.role === 'admin' ? 'admin' : 'user' } });
  success(res, user, '用户角色已更新');
};

export const resetUserPassword = async (req, res) => {
  const id = Number(req.params.id);
  await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(req.body.password || '12345678') } });
  success(res, null, '密码已重置');
};

export const listPhotos = async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req.query);
  const q = String(req.query.q || '').trim();
  const clauses = [{ status: { not: 'deleted' } }];
  if (q) clauses.push({ OR: [{ title: { contains: q } }, { city: { contains: q } }, { country: { contains: q } }] });
  if (req.query.ids) {
    const ids = parseIds(req.query.ids);
    clauses.push(ids.length ? { id: { in: ids } } : { id: -1 });
  }
  if (req.query.userId) clauses.push({ userId: Number(req.query.userId) });
  if (req.query.visibility) clauses.push({ visibility: req.query.visibility });
  if (req.query.status) clauses.push({ status: req.query.status });
  const where = { AND: clauses };
  const abnormalStatuses = ['failed', 'partial'];
  const abnormalWhere = { AND: [...clauses, { externalStatus: { in: abnormalStatuses } }] };
  const restWhere = {
    AND: [
      ...clauses,
      { OR: [{ externalStatus: null }, { externalStatus: { notIn: abnormalStatuses } }] }
    ]
  };
  const orderBy = buildPhotoOrder(req.query.sort);
  const [abnormalTotal, total] = await Promise.all([
    prisma.photo.count({ where: abnormalWhere }),
    prisma.photo.count({ where })
  ]);
  const items = [];
  if (skip < abnormalTotal) {
    const abnormalTake = Math.min(take, abnormalTotal - skip);
    items.push(...await prisma.photo.findMany({
      where: abnormalWhere,
      include: photoInclude,
      orderBy: [{ externalStatus: 'asc' }, ...orderBy],
      skip,
      take: abnormalTake
    }));
  }
  if (items.length < take) {
    items.push(...await prisma.photo.findMany({
      where: restWhere,
      include: photoInclude,
      orderBy,
      skip: Math.max(0, skip - abnormalTotal),
      take: take - items.length
    }));
  }
  success(res, items, 'ok', buildPageMeta(total, page, pageSize));
};

export const updatePhoto = async (req, res) => {
  const id = Number(req.params.id);
  const before = await prisma.photo.findUnique({ where: { id }, select: { albumId: true, categoryId: true } });
  const photo = await prisma.photo.update({ where: { id }, data: adminPhotoData(req.body), include: photoInclude });
  if (Object.prototype.hasOwnProperty.call(req.body, 'tags')) await setPhotoTags(id, parseTagNames(req.body.tags));
  await refreshPhotoRelatedCounters({
    albumIds: [before?.albumId, photo.albumId],
    categoryIds: [before?.categoryId, photo.categoryId]
  });
  success(res, photo, '照片已更新');
};

export const deletePhoto = async (req, res) => {
  const id = Number(req.params.id);
  const photo = await prisma.photo.findUnique({ where: { id } });
  if (!photo) return fail(res, 404, '照片不存在');
  const tagLinks = await prisma.photoTag.findMany({ where: { photoId: id }, select: { tagId: true } });
  await deletePhotoFiles(photo);
  await prisma.photo.update({ where: { id }, data: { status: 'deleted' } });
  await refreshPhotoRelatedCounters({
    albumIds: [photo.albumId],
    categoryIds: [photo.categoryId],
    tagIds: tagLinks.map((link) => link.tagId)
  });
  success(res, null, '照片已删除');
};

export const featurePhoto = async (req, res) => {
  const id = Number(req.params.id);
  const photo = await prisma.photo.update({ where: { id }, data: { isFeatured: toBool(req.body.isFeatured) } });
  success(res, photo, photo.isFeatured ? '已设为精选' : '已取消精选');
};

export const visibilityPhoto = async (req, res) => {
  const id = Number(req.params.id);
  const visibility = req.body.visibility === 'private' ? 'private' : 'public';
  const photo = await prisma.photo.update({ where: { id }, data: { visibility } });
  success(res, photo, '可见性已更新');
};

export const batchPhotos = async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
  if (!ids.length) return fail(res, 422, '请选择照片');
  const { action } = req.body;
  const affectedPhotos = await prisma.photo.findMany({
    where: { id: { in: ids } },
    select: { albumId: true, categoryId: true }
  });
  const affectedTagLinks = await prisma.photoTag.findMany({ where: { photoId: { in: ids } }, select: { tagId: true } });
  const affectedAlbumIds = affectedPhotos.map((photo) => photo.albumId);
  const affectedCategoryIds = affectedPhotos.map((photo) => photo.categoryId);
  const affectedTagIds = affectedTagLinks.map((link) => link.tagId);
  if (action === 'delete') {
    const photos = await prisma.photo.findMany({ where: { id: { in: ids } } });
    await Promise.all(photos.map(deletePhotoFiles));
    await prisma.photo.updateMany({ where: { id: { in: ids } }, data: { status: 'deleted' } });
  } else if (action === 'visibility') {
    await prisma.photo.updateMany({ where: { id: { in: ids } }, data: { visibility: req.body.visibility === 'private' ? 'private' : 'public' } });
  } else if (action === 'category') {
    const categoryId = toInt(req.body.categoryId) || null;
    affectedCategoryIds.push(categoryId);
    await prisma.photo.updateMany({ where: { id: { in: ids } }, data: { categoryId } });
  } else if (action === 'album') {
    const albumId = toInt(req.body.albumId) || null;
    affectedAlbumIds.push(albumId);
    await prisma.photo.updateMany({ where: { id: { in: ids } }, data: { albumId } });
  } else if (action === 'feature') {
    await prisma.photo.updateMany({ where: { id: { in: ids } }, data: { isFeatured: toBool(req.body.isFeatured) } });
  } else if (action === 'waterfall') {
    await prisma.photo.updateMany({ where: { id: { in: ids } }, data: { showInWaterfall: toBool(req.body.showInWaterfall) } });
  } else if (action === 'tags') {
    for (const id of ids) await setPhotoTags(id, parseTagNames(req.body.tags));
  }
  await refreshPhotoRelatedCounters({
    albumIds: affectedAlbumIds,
    categoryIds: affectedCategoryIds,
    tagIds: action === 'delete' ? affectedTagIds : []
  });
  success(res, null, '批量操作已完成');
};

const externalPhotoWhere = (ids = []) => ({
  status: { not: 'deleted' },
  ...(ids.length ? { id: { in: ids } } : {}),
  OR: [
    { mimeType: 'image/external-url' },
    { fileSize: 0 },
    { originalUrl: { startsWith: 'http' } },
    { mediumUrl: { startsWith: 'http' } },
    { thumbnailUrl: { startsWith: 'http' } }
  ]
});

const externalPhotoIdsFromRequest = async (req) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
  if (ids.length) return [...new Set(ids)].slice(0, 200);
  if (!req.body.all) {
    const err = new Error('请选择要处理的外链照片');
    err.status = 422;
    throw err;
  }
  const rows = await prisma.photo.findMany({
    where: externalPhotoWhere(),
    select: { id: true },
    orderBy: { updatedAt: 'desc' },
    take: 500
  });
  return rows.map((item) => item.id);
};

export const cacheExternalPhoto = async (req, res) => {
  const result = await cacheExternalPhotoToLocal(req.params.id, req.user.id);
  success(res, result.photo, '外链图片已缓存到本地');
};

export const markExternalPhotoFailed = async (req, res) => {
  const id = Number(req.params.id);
  const photo = await prisma.photo.findUnique({ where: { id } });
  if (!photo) return fail(res, 404, '照片不存在');
  if (!isExternalPhotoRecord(photo)) return success(res, photo, '本地照片无需标记');
  const message = String(req.body?.message || '图片加载失败').replace(/<[^>]*>/g, '').trim().slice(0, 900);
  const updated = await prisma.photo.update({
    where: { id: photo.id },
    data: {
      externalStatus: 'failed',
      externalCheckedAt: new Date(),
      externalError: message || '图片加载失败',
      externalSourceUrl: photo.externalSourceUrl || externalPhotoUrls(photo)[0] || null
    },
    include: photoInclude
  });
  success(res, updated, '已标记为外链失效');
};

export const batchCacheExternalPhotos = async (req, res) => {
  const ids = await externalPhotoIdsFromRequest(req);
  const rows = await prisma.photo.findMany({ where: externalPhotoWhere(ids), select: { id: true } });
  const summary = { total: rows.length, cached: 0, failed: 0, skipped: ids.length - rows.length, errors: [] };
  for (const row of rows) {
    try {
      await cacheExternalPhotoToLocal(row.id, req.user.id);
      summary.cached += 1;
    } catch (error) {
      summary.failed += 1;
      summary.errors.push({ id: row.id, message: error.message });
    }
  }
  success(res, summary, '外链批量缓存完成');
};

export const listAlbums = async (req, res) => {
  const albums = await prisma.album.findMany({
    include: { user: { select: { id: true, username: true, nickname: true } }, photos: { take: 1, orderBy: [{ sortOrder: 'desc' }, { createdAt: 'desc' }] } },
    orderBy: [{ isPinned: 'desc' }, { sortOrder: 'desc' }, { createdAt: 'desc' }]
  });
  const coverIds = albums.map((album) => album.coverPhotoId).filter(Boolean);
  const covers = coverIds.length
    ? await prisma.photo.findMany({ where: { id: { in: coverIds } }, select: { id: true, thumbnailUrl: true, mediumUrl: true, title: true, externalStatus: true } })
    : [];
  const coverMap = new Map(covers.map((photo) => [photo.id, photo]));
  success(res, albums.map((album) => ({ ...album, coverPhoto: coverMap.get(album.coverPhotoId) || album.photos?.[0] || null })));
};

export const createAlbum = async (req, res) => {
  const album = await prisma.album.create({
    data: {
      userId: Number(req.body.userId) || req.user.id,
      title: req.body.title,
      description: req.body.description || null,
      visibility: req.body.visibility === 'private' ? 'private' : 'public',
      isPinned: toBool(req.body.isPinned),
      sortOrder: Number(req.body.sortOrder || 0)
    }
  });
  created(res, album, '相册已创建');
};

export const updateAlbum = async (req, res) => {
  const id = Number(req.params.id);
  const coverPhotoId = req.body.coverPhotoId ? Number(req.body.coverPhotoId) : null;
  if (coverPhotoId) {
    const cover = await prisma.photo.findFirst({ where: { id: coverPhotoId, albumId: id, status: { not: 'deleted' } } });
    if (!cover) return fail(res, 422, '卡片头图必须来自当前相册');
  }
  const album = await prisma.album.update({
    where: { id },
    data: {
      title: req.body.title,
      description: req.body.description,
      coverPhotoId,
      visibility: req.body.visibility,
      isPinned: toBool(req.body.isPinned),
      sortOrder: Number(req.body.sortOrder || 0),
      startDate: req.body.startDate ? new Date(req.body.startDate) : null,
      endDate: req.body.endDate ? new Date(req.body.endDate) : null
    }
  });
  success(res, album, '相册已更新');
};

export const deleteAlbum = async (req, res) => {
  const id = Number(req.params.id);
  await prisma.photo.updateMany({ where: { albumId: id }, data: { albumId: null } });
  await prisma.album.delete({ where: { id } });
  await refreshPhotoRelatedCounters({ albumIds: [id] });
  success(res, null, '相册已删除');
};

export const listCategories = async (req, res) => success(res, await prisma.category.findMany({ orderBy: [{ sortOrder: 'desc' }, { id: 'asc' }] }));

export const createCategory = async (req, res) => {
  const category = await prisma.category.create({
    data: {
      name: req.body.name,
      slug: req.body.slug || makeSlug(req.body.name),
      description: req.body.description || null,
      cover: req.body.cover || null,
      sortOrder: Number(req.body.sortOrder || 0)
    }
  });
  created(res, category, '分类已创建');
};

export const updateCategory = async (req, res) => {
  const id = Number(req.params.id);
  const category = await prisma.category.update({
    where: { id },
    data: {
      name: req.body.name,
      slug: req.body.slug || makeSlug(req.body.name),
      description: req.body.description,
      cover: req.body.cover,
      sortOrder: Number(req.body.sortOrder || 0)
    }
  });
  success(res, category, '分类已更新');
};

export const deleteCategory = async (req, res) => {
  const id = Number(req.params.id);
  await prisma.photo.updateMany({ where: { categoryId: id }, data: { categoryId: null } });
  await prisma.category.delete({ where: { id } });
  await refreshPhotoRelatedCounters({ categoryIds: [id] });
  success(res, null, '分类已删除');
};

export const listTags = async (req, res) => success(res, await prisma.tag.findMany({ orderBy: [{ photoCount: 'desc' }, { id: 'asc' }] }));

export const createTag = async (req, res) => {
  const tag = await prisma.tag.create({
    data: { name: req.body.name, slug: req.body.slug || makeSlug(req.body.name), color: null }
  });
  created(res, tag, '标签已创建');
};

export const updateTag = async (req, res) => {
  const id = Number(req.params.id);
  const tag = await prisma.tag.update({
    where: { id },
    data: { name: req.body.name, slug: req.body.slug || makeSlug(req.body.name), color: null }
  });
  success(res, tag, '标签已更新');
};

export const deleteTag = async (req, res) => {
  const id = Number(req.params.id);
  await prisma.tag.delete({ where: { id } });
  await refreshPhotoRelatedCounters({ tagIds: [id] });
  success(res, null, '标签已删除');
};

export const mergeTags = async (req, res) => {
  const sourceId = Number(req.body.sourceId);
  const targetId = Number(req.body.targetId);
  if (!sourceId || !targetId || sourceId === targetId) return fail(res, 422, '请选择要合并的标签');
  const sourceLinks = await prisma.photoTag.findMany({ where: { tagId: sourceId } });
  for (const link of sourceLinks) {
    await prisma.photoTag.upsert({
      where: { photoId_tagId: { photoId: link.photoId, tagId: targetId } },
      update: {},
      create: { photoId: link.photoId, tagId: targetId }
    });
  }
  await prisma.tag.delete({ where: { id: sourceId } });
  await refreshPhotoRelatedCounters({ tagIds: [targetId] });
  success(res, null, '标签已合并');
};

export const listComments = async (req, res) => {
  const comments = await prisma.comment.findMany({
    include: {
      user: { select: { id: true, username: true, nickname: true } },
      photo: { select: { id: true, title: true, thumbnailUrl: true, externalStatus: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  success(res, comments);
};

export const updateCommentStatus = async (req, res) => {
  const id = Number(req.params.id);
  const status = ['pending', 'approved', 'rejected'].includes(req.body.status) ? req.body.status : 'approved';
  const comment = await prisma.comment.update({ where: { id }, data: { status } });
  const count = await prisma.comment.count({ where: { photoId: comment.photoId, status: 'approved' } });
  await prisma.photo.update({ where: { id: comment.photoId }, data: { commentCount: count } });
  success(res, comment, '评论状态已更新');
};

export const deleteComment = async (req, res) => {
  const id = Number(req.params.id);
  const comment = await prisma.comment.findUnique({ where: { id } });
  if (!comment) return fail(res, 404, '评论不存在');
  await prisma.comment.delete({ where: { id } });
  const count = await prisma.comment.count({ where: { photoId: comment.photoId, status: 'approved' } });
  await prisma.photo.update({ where: { id: comment.photoId }, data: { commentCount: count } });
  success(res, null, '评论已删除');
};

const trustProxyHopsFromEnv = () => {
  if (typeof env.trustProxy === 'number') return String(env.trustProxy);
  return env.trustProxy ? '1' : '0';
};

const sanitizeWaterfallLoadCss = (value = '') => {
  const rules = String(value || '')
    .replace(/[\u0000-\u001f]+/g, ' ')
    .slice(0, 900)
    .split(';')
    .map((rule) => rule.trim())
    .filter(Boolean);

  const safeRules = [];
  for (const rule of rules) {
    const separator = rule.indexOf(':');
    if (separator <= 0) continue;
    const property = rule.slice(0, separator).trim().toLowerCase();
    const rawValue = rule.slice(separator + 1).trim();
    if (!rawValue || /url\s*\(|@import|expression\s*\(|javascript:|<|>/i.test(rawValue)) continue;

    if (property === 'opacity') {
      const opacity = Number(rawValue);
      if (Number.isFinite(opacity)) safeRules.push(`opacity: ${Math.max(0, Math.min(1, opacity))}`);
    } else if (property === 'filter' && rawValue.length <= 160) {
      safeRules.push(`filter: ${rawValue}`);
    } else if (property === 'transform' && rawValue.length <= 180) {
      safeRules.push(`transform: ${rawValue}`);
    } else if ((property === 'transition-timing-function' || property === 'animation-timing-function') && /^[a-z0-9.,()\s-]+$/i.test(rawValue)) {
      safeRules.push(`transition-timing-function: ${rawValue.slice(0, 90)}`);
    }
  }

  return safeRules.slice(0, 6).join('; ');
};

const themeColorKeys = new Set([
  'primary',
  'accent',
  'pageBg',
  'surface',
  'surfaceSoft',
  'surfaceOverlay',
  'text',
  'textSoft',
  'muted',
  'line',
  'buttonBg',
  'buttonText',
  'buttonHoverBg',
  'tagBg',
  'tagText',
  'mapControlBg',
  'mapControlText',
  'mapPopupBg',
  'mapPopupText',
  'dockActiveBg',
  'dockActiveText',
  'imageOverlayBg',
  'imageOverlayText'
]);
const colorPattern = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

const normalizeHexColor = (value) => {
  const color = String(value || '').trim();
  if (!colorPattern.test(color)) return '';
  if (color.length === 4) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`.toLowerCase();
  }
  return color.toLowerCase();
};

const sanitizeThemeColors = (value) => {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value || '{}');
    } catch {
      parsed = {};
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  return Object.fromEntries(
    Object.entries(parsed)
      .filter(([key]) => themeColorKeys.has(key))
      .map(([key, color]) => [key, normalizeHexColor(color)])
      .filter(([, color]) => color)
  );
};

const sanitizeSavedThemes = (value) => {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value || '[]');
    } catch {
      parsed = [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.slice(0, 16).map((theme, index) => {
    const name = String(theme?.name || `主题 ${index + 1}`).replace(/[<>]/g, '').trim().slice(0, 32);
    return {
      id: String(theme?.id || Date.now() + index).replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || String(index + 1),
      name: name || `主题 ${index + 1}`,
      colors: sanitizeThemeColors(theme?.colors || {}),
      savedAt: String(theme?.savedAt || '').replace(/[<>]/g, '').slice(0, 32)
    };
  }).filter((theme) => Object.keys(theme.colors).length);
};

const defaultAdminSettings = [
  { key: 'themeCustomEnabled', value: 'false', description: '自定义主题开关' },
  { key: 'themeCustomName', value: '', description: '自定义主题名称' },
  { key: 'themeCustomEditorMode', value: 'simple', description: '自定义主题编辑模式' },
  { key: 'themeCustomColors', value: '{}', description: '自定义主题颜色' },
  { key: 'savedThemes', value: '[]', description: '已保存主题方案' },
  { key: 'themeMode', value: 'light', description: '站点主题模式' },
  { key: 'waterfallFullBleed', value: 'false', description: '瀑布流铺满左右空隙' },
  { key: 'waterfallCardRadius', value: '4', description: '瀑布流卡片圆角' },
  { key: 'waterfallRevealAnimation', value: 'slide-up', description: '瀑布流滚动入场动画' },
  { key: 'waterfallLoadAnimation', value: 'blur', description: '瀑布流图片加载动画' },
  { key: 'waterfallLoadDurationMs', value: '720', description: '瀑布流图片加载动画时长' },
  { key: 'waterfallLoadStaggerMs', value: '24', description: '瀑布流图片加载错峰延迟' },
  { key: 'waterfallCustomLoadCss', value: '', description: '瀑布流图片自定义加载 CSS' },
  { key: 'mapTileProvider', value: 'amap', description: '地图底图来源' },
  { key: 'mapTileUrl', value: '', description: '自定义地图瓦片 URL' },
  { key: 'baiduMapWebAk', value: '', description: '百度地图 Web 端 AK' },
  { key: 'baiduMapServerAk', value: '', description: '百度地图服务端 AK' },
  { key: 'mapTileAttribution', value: '© 高德地图', description: '地图底图版权署名' }
];

defaultAdminSettings.push(
  { key: 'mapPageZoomChina', value: '12', description: '地图页中国视角 Zoom' },
  { key: 'mapPageZoomOverseas', value: '7', description: '地图页境外视角 Zoom' },
  { key: 'mapDetailZoomChina', value: '11', description: '详情页中国视角 Zoom' },
  { key: 'mapDetailZoomOverseas', value: '7', description: '详情页境外视角 Zoom' }
);

const normalizeAdminSettingValue = (key, value) => {
  if (key === 'trustProxyHops') return normalizeTrustProxyHops(value);
  if (key === 'themeMode') return ['light', 'dark', 'auto'].includes(value) ? value : 'light';
  if (key === 'themeCustomEnabled') return value === true || value === 'true' ? 'true' : 'false';
  if (key === 'themeCustomName') return String(value || '').replace(/[<>]/g, '').trim().slice(0, 32);
  if (key === 'themeCustomEditorMode') return ['simple', 'advanced'].includes(value) ? value : 'simple';
  if (key === 'themeCustomColors') return JSON.stringify(sanitizeThemeColors(value));
  if (key === 'savedThemes') return JSON.stringify(sanitizeSavedThemes(value));
  if (key === 'waterfallFullBleed') return value === true || value === 'true' ? 'true' : 'false';
  if (key === 'waterfallCardRadius') {
    const radius = Number(value);
    return String(Math.max(0, Math.min(24, Number.isFinite(radius) ? Math.round(radius) : 4)));
  }
  if (key === 'waterfallRevealAnimation') {
    return ['slide-up', 'fade', 'none'].includes(value) ? value : 'slide-up';
  }
  if (key === 'waterfallLoadAnimation') {
    return ['none', 'blur', 'custom'].includes(value) ? value : 'blur';
  }
  if (key === 'waterfallLoadDurationMs') {
    const duration = Number(value);
    return String(Math.max(200, Math.min(1600, Number.isFinite(duration) ? Math.round(duration) : 720)));
  }
  if (key === 'waterfallLoadStaggerMs') {
    const stagger = Number(value);
    return String(Math.max(0, Math.min(120, Number.isFinite(stagger) ? Math.round(stagger) : 24)));
  }
  if (key === 'waterfallCustomLoadCss') return sanitizeWaterfallLoadCss(value);
  if (key === 'mapTileProvider') return ['amap', 'osm', 'custom', 'baidu'].includes(value) ? value : 'amap';
  if (['mapPageZoomChina', 'mapPageZoomOverseas', 'mapDetailZoomChina', 'mapDetailZoomOverseas'].includes(key)) {
    const fallback = key === 'mapPageZoomChina' ? 12 : key === 'mapDetailZoomChina' ? 11 : 7;
    const zoom = Number(value);
    return String(Math.max(3, Math.min(14, Number.isFinite(zoom) ? Math.round(zoom) : fallback)));
  }
  if (key === 'mapTileUrl') {
    const url = String(value || '').trim();
    if (!url) return '';
    if (!/^https:\/\/[^<>"'\s]+$/i.test(url)) return '';
    return url.slice(0, 500);
  }
  if (key === 'mapTileAttribution') return String(value || '').replace(/[<>]/g, '').slice(0, 120);
  if (key === 'baiduMapWebAk' || key === 'baiduMapServerAk') return String(value || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 120);
  return String(value ?? '');
};

export const getSettings = async (req, res) => {
  const settings = await prisma.systemSetting.findMany({ orderBy: { key: 'asc' } });
  if (!settings.some((item) => item.key === 'trustProxyHops')) {
    settings.push({
      id: 0,
      key: 'trustProxyHops',
      value: trustProxyHopsFromEnv(),
      description: '反向代理层数',
      updatedAt: new Date()
    });
  }
  defaultAdminSettings.forEach((item, index) => {
    if (!settings.some((setting) => setting.key === item.key)) {
      settings.push({ id: -(index + 1), updatedAt: new Date(), ...item });
    }
  });
  success(res, settings);
};

export const updateSettings = async (req, res) => {
  const entries = Array.isArray(req.body) ? req.body : Object.entries(req.body).map(([key, value]) => ({ key, value }));
  for (const item of entries) {
    if (!item.key) continue;
    item.value = normalizeAdminSettingValue(item.key, item.value);
    await prisma.systemSetting.upsert({
      where: { key: item.key },
      update: { value: String(item.value ?? ''), description: item.description },
      create: { key: item.key, value: String(item.value ?? ''), description: item.description || null }
    });
  }
  const trustProxyEntry = entries.find((item) => item.key === 'trustProxyHops');
  if (trustProxyEntry) {
    const trustProxy = parseTrustProxyValue(trustProxyEntry.value);
    if (trustProxy) req.app.set('trust proxy', trustProxy);
    else req.app.set('trust proxy', false);
  }
  success(res, await prisma.systemSetting.findMany({ orderBy: { key: 'asc' } }), '设置已保存');
};
