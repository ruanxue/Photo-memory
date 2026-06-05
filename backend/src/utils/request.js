const stripPort = (value) => {
  if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(value)) return value.replace(/:\d+$/, '');
  const bracketedIpv6 = value.match(/^\[([^\]]+)](?::\d+)?$/);
  return bracketedIpv6 ? bracketedIpv6[1] : value;
};

export const normalizeIp = (value) => {
  if (!value) return null;
  const first = String(value).split(',')[0].trim();
  if (!first) return null;
  const withoutPrefix = stripPort(first.replace(/^::ffff:/, ''));
  if (withoutPrefix === '::1') return '127.0.0.1';
  return withoutPrefix.slice(0, 128);
};

export const getClientIp = (req) => normalizeIp(req.ip || req.socket?.remoteAddress);

export const getUserAgent = (req) => String(req.headers['user-agent'] || '').replace(/<[^>]*>/g, '').trim().slice(0, 500) || null;
