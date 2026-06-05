export const formatDate = (value, fallback = '未知日期') => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

export const formatDateTime = (value) => {
  if (!value) return '未知时间';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未知时间';
  return date.toLocaleString('zh-CN', { hour12: false });
};

export const formatFileSize = (bytes) => {
  if (!bytes) return '未知大小';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export const numberText = (value) => Number(value || 0).toLocaleString('zh-CN');

const valueText = (map, value, fallback = '未知') => map[value] || fallback;

export const formatVisibility = (value) => valueText({
  public: '公开',
  private: '私密'
}, value);

export const formatUserRole = (value) => valueText({
  admin: '管理员',
  user: '普通用户'
}, value);

export const formatUserStatus = (value) => valueText({
  active: '启用',
  disabled: '禁用'
}, value);

export const formatCommentStatus = (value) => valueText({
  pending: '待审核',
  approved: '已通过',
  rejected: '已驳回'
}, value);

export const formatPhotoStatus = (value) => valueText({
  normal: '正常',
  hidden: '隐藏',
  deleted: '已删除'
}, value);
