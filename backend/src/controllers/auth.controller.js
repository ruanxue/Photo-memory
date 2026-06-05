import { prisma } from '../config/prisma.js';
import { comparePassword, hashPassword } from '../utils/password.js';
import { signToken } from '../utils/jwt.js';
import { created, fail, success } from '../utils/response.js';

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

export const register = async (req, res) => {
  const { username, email, password, confirmPassword } = req.body;
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
  const { account, password } = req.body;
  const user = await prisma.user.findFirst({
    where: { OR: [{ username: account }, { email: account }] }
  });
  if (!user) return fail(res, 401, '账号或密码错误');
  if (user.status !== 'active') return fail(res, 403, '账号已被禁用');

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) return fail(res, 401, '账号或密码错误');

  const token = signToken(user);
  return success(res, { token, user: publicUser(user) }, '登录成功');
};

export const profile = async (req, res) => {
  return success(res, publicUser(req.user));
};

export const updateProfile = async (req, res) => {
  const { nickname, avatar, bio, email } = req.body;
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
