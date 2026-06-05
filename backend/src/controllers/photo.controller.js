import { prisma } from '../config/prisma.js';
import { buildPageMeta, getPagination } from '../utils/pagination.js';
import { created, fail, success } from '../utils/response.js';
import { safeUnlinkUpload } from '../utils/file.js';
import { getClientIp, getUserAgent } from '../utils/request.js';
import { attachViewerState, deletePhotoFiles, parseTagNames, photoInclude, photoIncludeForViewer, refreshCounters, requirePhotoAccess, setPhotoTags, visibilityFilter, buildPhotoOrder } from '../services/photo.service.js';
import { processUploadedFile } from '../services/upload.service.js';

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

const toBool = (value) => value === true || value === 'true' || value === '1';

const parseDate = (value) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const sanitizeComment = (content) => String(content || '').replace(/<[^>]*>/g, '').trim();
const sanitizeText = (value, maxLength = 120) => String(value || '').replace(/<[^>]*>/g, '').trim().slice(0, maxLength);
const getDeviceId = (req) => sanitizeText(req.headers['x-photo-device-id'], 128);
const getVisitorAudit = (req) => ({
  deviceId: getDeviceId(req) || null,
  ip: getClientIp(req),
  userAgent: getUserAgent(req)
});
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const validateUploadSizeBySetting = async (files) => {
  const setting = await prisma.systemSetting.findUnique({ where: { key: 'uploadMaxSizeMb' } });
  const maxMb = Number(setting?.value || 15);
  const maxBytes = maxMb * 1024 * 1024;
  const tooLarge = files.find((file) => file.size > maxBytes);
  if (tooLarge) {
    await Promise.all(files.map((file) => safeUnlinkUpload(`/uploads/originals/${file.filename}`)));
    const err = new Error(`图片不能超过 ${maxMb} MB`);
    err.status = 413;
    throw err;
  }
};

const buildPhotoWhere = (req) => {
  const q = String(req.query.q || '').trim();
  const clauses = [visibilityFilter(req.user)];
  const { albumId, categoryId, tagId, year, month, city, country, pinned, featured, ids } = req.query;

  if (q) {
    clauses.push({
      OR: [
        { title: { contains: q } },
        { description: { contains: q } },
        { city: { contains: q } },
        { country: { contains: q } },
        { locationName: { contains: q } },
        { cameraMake: { contains: q } },
        { cameraModel: { contains: q } }
      ]
    });
  }
  if (albumId) clauses.push({ albumId: Number(albumId) });
  if (categoryId) clauses.push({ categoryId: Number(categoryId) });
  if (tagId) clauses.push({ tags: { some: { tagId: Number(tagId) } } });
  if (ids) {
    const idList = parseIds(ids);
    clauses.push(idList.length ? { id: { in: idList } } : { id: -1 });
  }
  if (city) clauses.push({ city: { contains: String(city) } });
  if (country) clauses.push({ country: { contains: String(country) } });
  if (pinned === 'true') clauses.push({ isPinned: true });
  if (featured === 'true') clauses.push({ isFeatured: true });
  if (year) {
    const startMonth = month ? Number(month) - 1 : 0;
    const endMonth = month ? Number(month) : 12;
    clauses.push({
      takenAt: {
        gte: new Date(Number(year), startMonth, 1),
        lt: new Date(Number(year), endMonth, 1)
      }
    });
  }
  return clauses.length === 1 ? clauses[0] : { AND: clauses };
};

const normalizePhotoBody = (body, file, imageInfo, exifInfo) => {
  const titleFromFile = file?.originalname?.replace(/\.[^.]+$/, '') || '未命名照片';
  const takenAt = parseDate(body.takenAt) || parseDate(exifInfo.takenAt);
  const data = {
    albumId: toInt(body.albumId) || null,
    categoryId: toInt(body.categoryId) || null,
    title: body.title || titleFromFile,
    description: body.description || null,
    originalUrl: imageInfo.originalUrl,
    mediumUrl: imageInfo.mediumUrl,
    thumbnailUrl: imageInfo.thumbnailUrl,
    filename: file.filename,
    mimeType: file.mimetype,
    fileSize: file.size,
    width: imageInfo.width || null,
    height: imageInfo.height || null,
    takenAt,
    cameraMake: body.cameraMake || exifInfo.cameraMake || null,
    cameraModel: body.cameraModel || exifInfo.cameraModel || null,
    lensModel: body.lensModel || exifInfo.lensModel || null,
    focalLength: toFloatOrNull(body.focalLength) ?? exifInfo.focalLength ?? null,
    aperture: toFloatOrNull(body.aperture) ?? exifInfo.aperture ?? null,
    shutterSpeed: body.shutterSpeed || exifInfo.shutterSpeed || null,
    iso: toInt(body.iso) || exifInfo.iso || null,
    exposureCompensation: body.exposureCompensation || exifInfo.exposureCompensation || null,
    whiteBalance: body.whiteBalance || exifInfo.whiteBalance || null,
    latitude: toFloatOrNull(body.latitude) ?? exifInfo.latitude ?? null,
    longitude: toFloatOrNull(body.longitude) ?? exifInfo.longitude ?? null,
    country: body.country || null,
    province: body.province || null,
    city: body.city || null,
    locationName: body.locationName || null,
    visibility: body.visibility === 'private' ? 'private' : 'public',
    isPinned: toBool(body.isPinned),
    pinnedAt: toBool(body.isPinned) ? new Date() : null,
    isFeatured: toBool(body.isFeatured),
    sortOrder: toInt(body.sortOrder) || 0
  };
  return data;
};

const updatePhotoData = (body) => {
  const fields = [
    'title',
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
    'locationName',
    'visibility'
  ];
  const data = {};
  fields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) data[field] = body[field] || null;
  });
  ['albumId', 'categoryId', 'iso', 'sortOrder'].forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) data[field] = toInt(body[field]) || null;
  });
  ['focalLength', 'aperture', 'latitude', 'longitude'].forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) data[field] = toFloatOrNull(body[field]);
  });
  if (Object.prototype.hasOwnProperty.call(body, 'takenAt')) data.takenAt = parseDate(body.takenAt) || null;
  if (Object.prototype.hasOwnProperty.call(body, 'isPinned')) {
    data.isPinned = toBool(body.isPinned);
    data.pinnedAt = data.isPinned ? new Date() : null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'isFeatured')) data.isFeatured = toBool(body.isFeatured);
  if (data.visibility && !['public', 'private'].includes(data.visibility)) data.visibility = 'public';
  return data;
};

export const listPhotos = async (req, res) => {
  const { page, pageSize, skip, take } = getPagination(req.query);
  const where = buildPhotoWhere(req);
  const [rows, total] = await Promise.all([
    prisma.photo.findMany({ where, include: photoIncludeForViewer(req.user, getDeviceId(req)), orderBy: buildPhotoOrder(req.query.sort), skip, take }),
    prisma.photo.count({ where })
  ]);
  const items = attachViewerState(rows);
  success(res, items, 'ok', buildPageMeta(total, page, pageSize));
};

export const getPhoto = async (req, res) => {
  const { photo } = await requirePhotoAccess(req.params.id, req.user);
  const visitor = getVisitorAudit(req);
  await prisma.photo.update({ where: { id: photo.id }, data: { viewCount: { increment: 1 } } });
  await prisma.photoView.create({
    data: {
      photoId: photo.id,
      userId: req.user?.id || null,
      ip: visitor.ip,
      userAgent: visitor.userAgent
    }
  });

  const where = visibilityFilter(req.user);
  const [previous, next, favorited] = await Promise.all([
    prisma.photo.findFirst({ where: { AND: [where, { id: { lt: photo.id } }] }, orderBy: { id: 'desc' }, select: { id: true, title: true } }),
    prisma.photo.findFirst({ where: { AND: [where, { id: { gt: photo.id } }] }, orderBy: { id: 'asc' }, select: { id: true, title: true } }),
    req.user ? prisma.favorite.findUnique({ where: { photoId_userId: { photoId: photo.id, userId: req.user.id } } }) : null
  ]);
  success(res, { ...photo, viewCount: photo.viewCount + 1, previous, next, favorited: Boolean(favorited) });
};

export const uploadPhoto = async (req, res) => {
  if (!req.file) return fail(res, 422, '请选择要上传的图片');
  await validateUploadSizeBySetting([req.file]);
  const uploadAllowed = await prisma.systemSetting.findUnique({ where: { key: 'allowUserUpload' } });
  if (req.user.role !== 'admin' && uploadAllowed && uploadAllowed.value === 'false') {
    return fail(res, 403, '当前站点已关闭普通用户上传');
  }

  const { imageInfo, exifInfo } = await processUploadedFile(req.file, req.user.id);
  const photo = await prisma.photo.create({
    data: {
      userId: req.user.id,
      ...normalizePhotoBody(req.body, req.file, imageInfo, exifInfo)
    },
    include: photoInclude
  });
  await setPhotoTags(photo.id, parseTagNames(req.body.tags));
  const fresh = await prisma.photo.findUnique({ where: { id: photo.id }, include: photoInclude });
  await refreshCounters();
  created(res, fresh, '照片上传成功');
};

export const batchUploadPhotos = async (req, res) => {
  if (!req.files?.length) return fail(res, 422, '请选择要上传的图片');
  await validateUploadSizeBySetting(req.files);
  const photos = [];
  for (const file of req.files) {
    const { imageInfo, exifInfo } = await processUploadedFile(file, req.user.id);
    const photo = await prisma.photo.create({
      data: {
        userId: req.user.id,
        ...normalizePhotoBody(req.body, file, imageInfo, exifInfo)
      },
      include: photoInclude
    });
    await setPhotoTags(photo.id, parseTagNames(req.body.tags));
    photos.push(photo);
  }
  await refreshCounters();
  success(res, photos, '批量上传成功');
};

export const updatePhoto = async (req, res) => {
  const { photo, canManage } = await requirePhotoAccess(req.params.id, req.user, true);
  if (!canManage) return fail(res, 403, '没有权限编辑该照片');
  await prisma.photo.update({ where: { id: photo.id }, data: updatePhotoData(req.body) });
  if (Object.prototype.hasOwnProperty.call(req.body, 'tags')) await setPhotoTags(photo.id, parseTagNames(req.body.tags));
  await refreshCounters();
  const fresh = await prisma.photo.findUnique({ where: { id: photo.id }, include: photoInclude });
  success(res, fresh, '照片已更新');
};

export const deletePhoto = async (req, res) => {
  const { photo, canManage } = await requirePhotoAccess(req.params.id, req.user, true);
  if (!canManage) return fail(res, 403, '没有权限删除该照片');
  await deletePhotoFiles(photo);
  await prisma.photo.update({ where: { id: photo.id }, data: { status: 'deleted' } });
  await refreshCounters();
  success(res, null, '照片已删除');
};

export const favoritePhoto = async (req, res) => {
  const { photo } = await requirePhotoAccess(req.params.id, req.user);
  await prisma.favorite.upsert({
    where: { photoId_userId: { photoId: photo.id, userId: req.user.id } },
    update: {},
    create: { photoId: photo.id, userId: req.user.id }
  });
  const count = await prisma.favorite.count({ where: { photoId: photo.id } });
  await prisma.photo.update({ where: { id: photo.id }, data: { favoriteCount: count } });
  success(res, { favoriteCount: count }, '已收藏');
};

export const unfavoritePhoto = async (req, res) => {
  const photoId = Number(req.params.id);
  await prisma.favorite.deleteMany({ where: { photoId, userId: req.user.id } });
  const count = await prisma.favorite.count({ where: { photoId } });
  await prisma.photo.update({ where: { id: photoId }, data: { favoriteCount: count } });
  success(res, { favoriteCount: count }, '已取消收藏');
};

export const getComments = async (req, res) => {
  const photoId = Number(req.params.id);
  const enabled = await prisma.systemSetting.findUnique({ where: { key: 'commentsEnabled' } });
  if (enabled?.value === 'false') return success(res, []);
  const comments = await prisma.comment.findMany({
    where: { photoId, status: 'approved' },
    select: {
      id: true,
      photoId: true,
      userId: true,
      guestName: true,
      content: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { id: true, username: true, nickname: true, avatar: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  success(res, comments);
};

export const addComment = async (req, res) => {
  const { photo } = await requirePhotoAccess(req.params.id, req.user);
  const enabled = await prisma.systemSetting.findUnique({ where: { key: 'commentsEnabled' } });
  if (enabled?.value === 'false') return fail(res, 403, '评论区已关闭');
  const content = sanitizeComment(req.body.content);
  if (!content) return fail(res, 422, '评论内容不能为空');
  const guestName = sanitizeText(req.body.guestName, 40);
  const guestEmail = sanitizeText(req.body.guestEmail, 160).toLowerCase();
  if (!req.user && !guestName) return fail(res, 422, '请填写用户名');
  if (!req.user && !validEmail(guestEmail)) return fail(res, 422, '请填写有效邮箱');
  const visitor = getVisitorAudit(req);
  const review = await prisma.systemSetting.findUnique({ where: { key: 'commentReview' } });
  const comment = await prisma.comment.create({
    data: {
      photoId: photo.id,
      userId: req.user?.id || null,
      guestName: req.user ? null : guestName,
      guestEmail: req.user ? null : guestEmail,
      deviceId: visitor.deviceId,
      ip: visitor.ip,
      userAgent: visitor.userAgent,
      content,
      status: review?.value === 'true' ? 'pending' : 'approved'
    },
    include: { user: { select: { id: true, username: true, nickname: true, avatar: true } } }
  });
  const count = await prisma.comment.count({ where: { photoId: photo.id, status: 'approved' } });
  await prisma.photo.update({ where: { id: photo.id }, data: { commentCount: count } });
  const publicComment = { ...comment };
  delete publicComment.guestEmail;
  delete publicComment.deviceId;
  delete publicComment.ip;
  delete publicComment.userAgent;
  created(res, publicComment, comment.status === 'pending' ? '评论已提交，等待审核' : '评论成功');
};
