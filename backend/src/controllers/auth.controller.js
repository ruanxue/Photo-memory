import { prisma } from '../config/prisma.js';
import { comparePassword, hashPassword } from '../utils/password.js';
import { signToken } from '../utils/jwt.js';
import { created, fail, success } from '../utils/response.js';
import { getClientIp } from '../utils/request.js';

const loginWindowMs = 15 * 60 * 1000;
const loginLockMs = 15 * 60 * 1000;
const accountFailureLimit = 5;
const ipFailureLimit = 20;

const publicUser = (user) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  nickname: user.nickname,
  avatar: user.avatar,
  bio: user.bio,
  role: user.role,
  status: user.status,
  createdAt: user.createdAt
});

const normalizeAccount = (value) => String(value || '').trim().toLowerCase().slice(0, 160);

const getLoginKeys = (req, account) => {
  const ip = getClientIp(req) || 'unknown';
  const normalizedAccount = normalizeAccount(account);
  return [`account:${ip}:${normalizedAccount}`, `ip:${ip}`];
};

const emptyBucket = (now = Date.now()) => ({ count: 0, firstAt: new Date(now), lockedUntil: null });

const getBucket = async (key) => {
  const now = Date.now();
  const bucket = await prisma.loginGuardBucket.findUnique({ where: { key } });
  if (!bucket) return emptyBucket(now);
  if (bucket.lockedUntil && bucket.lockedUntil.getTime() > now) return bucket;
  if (now - bucket.firstAt.getTime() > loginWindowMs) {
    await prisma.loginGuardBucket.deleteMany({ where: { key } });
    return emptyBucket(now);
  }
  return bucket;
};

const getActiveLoginLock = async (req, account) => {
  const now = Date.now();
  const buckets = await Promise.all(getLoginKeys(req, account).map((key) => getBucket(key)));
  const lockedUntil = buckets
    .map((bucket) => bucket.lockedUntil?.getTime?.() || 0)
    .filter((value) => value > now)
    .sort((a, b) => b - a)[0];
  return lockedUntil ? Math.ceil((lockedUntil - now) / 1000 / 60) : 0;
};

const recordLoginFailure = async (req, account) => {
  const now = Date.now();
  let longestLock = 0;
  await prisma.loginGuardBucket.deleteMany({
    where: { updatedAt: { lt: new Date(now - 24 * 60 * 60 * 1000) }, lockedUntil: null }
  });
  for (const key of getLoginKeys(req, account)) {
    const limit = key.startsWith('account:') ? accountFailureLimit : ipFailureLimit;
    const bucket = await getBucket(key);
    const count = bucket.count + 1;
    const lockedUntil = count >= limit ? new Date(now + loginLockMs) : bucket.lockedUntil;
    await prisma.loginGuardBucket.upsert({
      where: { key },
      update: { count, firstAt: bucket.firstAt, lockedUntil },
      create: { key, count, firstAt: bucket.firstAt, lockedUntil }
    });
    const lockTime = lockedUntil?.getTime?.() || 0;
    if (lockTime > longestLock) longestLock = lockTime;
  }
  return longestLock ? Math.ceil((longestLock - now) / 1000 / 60) : 0;
};

const clearLoginFailure = async (req, account) => {
  await prisma.loginGuardBucket.deleteMany({ where: { key: getLoginKeys(req, account)[0] } });
};

const failBadLogin = async (req, res, account) => {
  const lockedMinutes = await recordLoginFailure(req, account);
  if (lockedMinutes) return fail(res, 429, `登录失败次数过多，请 ${lockedMinutes} 分钟后再试`);
  return fail(res, 401, '账号或密码错误');
};

export const register = async (req, res) => {
  const username = String(req.body.username || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const { password, confirmPassword } = req.body;
  if (password !== confirmPassword) return fail(res, 422, '两次输入的密码不一致');

  const allowRegister = await prisma.systemSetting.findUnique({ where: { key: 'allowRegister' } });
  if (allowRegister && allowRegister.value === 'false') return fail(res, 403, '当前站点已关闭注册');

  const exists = await prisma.user.findFirst({ where: { OR: [{ username }, { email }] } });
  if (exists) return fail(res, 409, '用户名或邮箱已存在');

  const user = await prisma.user.create({
    data: {
      username,
      email,
      passwordHash: await hashPassword(password),
      nickname: username
    }
  });
  const token = signToken(user);
  return created(res, { token, user: publicUser(user) }, '注册成功');
};

export const login = async (req, res) => {
  const account = String(req.body.account || '').trim();
  const password = String(req.body.password || '');
  const lockedMinutes = await getActiveLoginLock(req, account);
  if (lockedMinutes) return fail(res, 429, `登录失败次数过多，请 ${lockedMinutes} 分钟后再试`);

  const user = await prisma.user.findFirst({
    where: { OR: [{ username: account }, { email: account.toLowerCase() }] }
  });
  if (!user) return await failBadLogin(req, res, account);
  if (user.status !== 'active') return fail(res, 403, '账号已被禁用');

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) return await failBadLogin(req, res, account);

  await clearLoginFailure(req, account);
  const token = signToken(user);
  return success(res, { token, user: publicUser(user) }, '登录成功');
};

export const profile = async (req, res) => {
  return success(res, publicUser(req.user));
};

export const updateProfile = async (req, res) => {
  const { nickname, avatar, bio } = req.body;
  const email = req.body.email ? String(req.body.email).trim().toLowerCase() : req.user.email;
  if (email && email !== req.user.email) {
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return fail(res, 409, '邮箱已被使用');
  }
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { nickname, avatar, bio, email }
  });
  return success(res, publicUser(user), '资料已更新');
};

export const changePassword = async (req, res) => {
  const { oldPassword, newPassword, confirmPassword } = req.body;
  if (newPassword !== confirmPassword) return fail(res, 422, '两次输入的新密码不一致');

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const valid = await comparePassword(oldPassword, user.passwordHash);
  if (!valid) return fail(res, 401, '原密码错误');

  await prisma.user.update({
    where: { id: req.user.id },
    data: { passwordHash: await hashPassword(newPassword) }
  });
  return success(res, null, '密码已修改，请重新登录');
};

export const logout = async (req, res) => {
  return success(res, null, '已退出登录');
};
