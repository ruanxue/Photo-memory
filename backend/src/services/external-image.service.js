import dns from 'dns/promises';
import fs from 'fs/promises';
import net from 'net';
import path from 'path';
import { randomUUID } from 'crypto';
import { prisma } from '../config/prisma.js';
import { ensureUploadDirs, uploadDirs } from '../utils/file.js';
import { processUploadedFile } from './upload.service.js';

const requestTimeoutMs = 9000;
const maxDownloadBytes = 35 * 1024 * 1024;
const imageMimeByExt = new Map([
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['png', 'image/png'],
  ['webp', 'image/webp']
]);
const extByMime = new Map([...imageMimeByExt.entries()].map(([ext, mime]) => [mime, ext === 'jpeg' ? 'jpg' : ext]));

const isHttpUrl = (value) => {
  try {
    const url = new URL(String(value || '').trim());
    return ['http:', 'https:'].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
};

const isPrivateIPv4 = (address) => {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;
  const [a, b] = parts;
  return a === 10
    || a === 127
    || a === 0
    || a === 169 && b === 254
    || a === 172 && b >= 16 && b <= 31
    || a === 192 && b === 168
    || a >= 224;
};

const isPrivateIPv6 = (address) => {
  const lower = String(address || '').toLowerCase();
  return lower === '::1'
    || lower.startsWith('fc')
    || lower.startsWith('fd')
    || lower.startsWith('fe80:')
    || lower.startsWith('::ffff:127.')
    || lower.startsWith('::ffff:10.')
    || lower.startsWith('::ffff:192.168.');
};

const assertSafeExternalUrl = async (rawUrl) => {
  const url = isHttpUrl(rawUrl);
  if (!url) {
    const err = new Error('不是有效的图片 URL');
    err.status = 422;
    throw err;
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.local')) {
    const err = new Error('不允许检测本机或内网地址');
    err.status = 422;
    throw err;
  }
  if (net.isIP(hostname)) {
    const unsafeIp = net.isIP(hostname) === 4 ? isPrivateIPv4(hostname) : isPrivateIPv6(hostname);
    if (unsafeIp) {
      const err = new Error('不允许检测本机或内网地址');
      err.status = 422;
      throw err;
    }
    return url.toString();
  }

  let addresses = [];
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: false });
  } catch {
    const err = new Error('无法解析图片域名');
    err.status = 422;
    throw err;
  }

  const unsafe = addresses.some(({ address, family }) => {
    if (family === 4) return isPrivateIPv4(address);
    if (family === 6) return isPrivateIPv6(address);
    return true;
  });
  if (unsafe) {
    const err = new Error('不允许检测本机或内网地址');
    err.status = 422;
    throw err;
  }
  return url.toString();
};

const withTimeout = async (fn) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
};

const safeFetch = async (rawUrl, options = {}, signal, redirectCount = 0) => {
  if (redirectCount > 4) {
    const err = new Error('图片地址重定向次数过多');
    err.status = 422;
    throw err;
  }
  const url = await assertSafeExternalUrl(rawUrl);
  const response = await fetch(url, { ...options, redirect: 'manual', signal });
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get('location');
    if (!location) {
      const err = new Error('图片地址重定向无效');
      err.status = 422;
      throw err;
    }
    const nextUrl = new URL(location, url).toString();
    const nextOptions = response.status === 303 ? { ...options, method: 'GET' } : options;
    return safeFetch(nextUrl, nextOptions, signal, redirectCount + 1);
  }
  return { response, url };
};

const extFromUrl = (url) => {
  try {
    const ext = new URL(url).pathname.split('.').pop()?.toLowerCase() || '';
    return imageMimeByExt.has(ext) ? ext : 'jpg';
  } catch {
    return 'jpg';
  }
};

const mimeFromResponse = (response, url) => {
  const contentType = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (contentType.startsWith('image/')) return contentType;
  return imageMimeByExt.get(extFromUrl(url)) || '';
};

const checkResponseAsImage = (response, url) => {
  const contentType = mimeFromResponse(response, url);
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (!response.ok) return { ok: false, message: `HTTP ${response.status}` };
  if (!contentType) return { ok: false, message: '响应不是图片类型' };
  if (contentLength && contentLength > maxDownloadBytes) return { ok: false, message: '图片文件过大' };
  return {
    ok: true,
    status: response.status,
    contentType,
    contentLength: contentLength || null
  };
};

export const isExternalPhotoRecord = (photo) => {
  if (!photo) return false;
  return photo.mimeType === 'image/external-url'
    || Number(photo.fileSize) === 0
    || [photo.originalUrl, photo.mediumUrl, photo.smallUrl, photo.thumbnailUrl].some((url) => Boolean(isHttpUrl(url)));
};

export const externalPhotoUrls = (photo) => [...new Set([
  photo?.originalUrl,
  photo?.mediumUrl,
  photo?.smallUrl,
  photo?.thumbnailUrl
].filter((url) => Boolean(isHttpUrl(url))))];

export const checkExternalImageUrl = async (rawUrl) => {
  let url = String(rawUrl || '');
  try {
    url = await assertSafeExternalUrl(rawUrl);
  } catch (error) {
    return { url, ok: false, message: error.message || '不允许检测该地址' };
  }
  try {
    const { response, url: finalUrl } = await withTimeout((signal) => safeFetch(url, { method: 'HEAD' }, signal));
    const headResult = checkResponseAsImage(response, finalUrl);
    if (headResult.ok) return { url, ...headResult };
  } catch {
    // Some image hosts reject HEAD. Fall back to a tiny GET probe.
  }

  try {
    const { response, url: finalUrl } = await withTimeout((signal) => safeFetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-8191' }
    }, signal));
    return { url, ...checkResponseAsImage(response, finalUrl) };
  } catch (error) {
    return { url, ok: false, message: error.name === 'AbortError' ? '请求超时' : error.message || '图片无法访问' };
  }
};

export const checkExternalPhoto = async (photo) => {
  if (!isExternalPhotoRecord(photo)) {
    return { external: false, status: null, message: '' };
  }
  const urls = externalPhotoUrls(photo);
  if (!urls.length) return { external: true, status: 'failed', message: '没有可检测的外链地址', results: [] };

  const results = await Promise.all(urls.map(checkExternalImageUrl));
  const okCount = results.filter((item) => item.ok).length;
  const status = okCount === urls.length ? 'ok' : okCount > 0 ? 'partial' : 'failed';
  const message = results
    .filter((item) => !item.ok)
    .map((item) => `${item.url}: ${item.message || '失效'}`)
    .join('；');
  return { external: true, status, message, results };
};

export const updateExternalPhotoHealth = async (photoId) => {
  const photo = await prisma.photo.findUnique({ where: { id: Number(photoId) } });
  if (!photo) {
    const err = new Error('照片不存在');
    err.status = 404;
    throw err;
  }
  const result = await checkExternalPhoto(photo);
  if (!result.external) return { photo, result };

  const updated = await prisma.photo.update({
    where: { id: photo.id },
    data: {
      externalStatus: result.status,
      externalCheckedAt: new Date(),
      externalError: result.status === 'ok' ? null : result.message.slice(0, 900),
      externalSourceUrl: photo.externalSourceUrl || externalPhotoUrls(photo)[0] || null
    }
  });
  return { photo: updated, result };
};

const readResponseBuffer = async (response) => {
  const reader = response.body?.getReader?.();
  if (!reader) return Buffer.from(await response.arrayBuffer());
  const chunks = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxDownloadBytes) {
      const err = new Error('图片文件过大');
      err.status = 413;
      throw err;
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
};

const downloadExternalImage = async (rawUrl) => {
  const { response, url } = await withTimeout((signal) => safeFetch(rawUrl, { method: 'GET' }, signal));
  const checked = checkResponseAsImage(response, url);
  if (!checked.ok) {
    const err = new Error(checked.message || '图片无法访问');
    err.status = 422;
    throw err;
  }
  const buffer = await readResponseBuffer(response);
  return { url, buffer, mimeType: checked.contentType || 'image/jpeg' };
};

export const cacheExternalPhotoToLocal = async (photoId, userId) => {
  const photo = await prisma.photo.findUnique({ where: { id: Number(photoId) } });
  if (!photo) {
    const err = new Error('照片不存在');
    err.status = 404;
    throw err;
  }
  if (!isExternalPhotoRecord(photo)) {
    const err = new Error('这张照片不是外链照片');
    err.status = 422;
    throw err;
  }

  const sourceUrl = externalPhotoUrls(photo)[0];
  if (!sourceUrl) {
    const err = new Error('没有可缓存的外链地址');
    err.status = 422;
    throw err;
  }

  const downloaded = await downloadExternalImage(sourceUrl);
  await ensureUploadDirs();
  const ext = extByMime.get(downloaded.mimeType) || extFromUrl(downloaded.url);
  const filename = `external-${photo.id}-${randomUUID()}.${ext}`;
  const filePath = path.join(uploadDirs.originals, filename);
  await fs.writeFile(filePath, downloaded.buffer);

  const file = {
    path: filePath,
    filename,
    originalname: photo.filename || filename,
    mimetype: downloaded.mimeType,
    size: downloaded.buffer.length
  };
  const { imageInfo } = await processUploadedFile(file, userId || photo.userId);
  const updated = await prisma.photo.update({
    where: { id: photo.id },
    data: {
      originalUrl: imageInfo.originalUrl,
      mediumUrl: imageInfo.mediumUrl,
      smallUrl: imageInfo.smallUrl || imageInfo.mediumUrl,
      thumbnailUrl: imageInfo.thumbnailUrl,
      filename,
      mimeType: downloaded.mimeType,
      fileSize: downloaded.buffer.length,
      width: imageInfo.width || photo.width,
      height: imageInfo.height || photo.height,
      externalStatus: 'cached',
      externalCheckedAt: new Date(),
      externalError: null,
      externalSourceUrl: photo.externalSourceUrl || sourceUrl,
      externalCachedAt: new Date()
    }
  });
  return { photo: updated, sourceUrl };
};
