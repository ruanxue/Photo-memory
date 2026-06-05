export const parseTrustProxyValue = (input = '0') => {
  const value = String(input ?? '0').trim();
  const lower = value.toLowerCase();
  if (!value || ['0', 'false', 'off', 'no'].includes(lower)) return false;
  if (['true', 'on', 'yes'].includes(lower)) return true;
  const hops = Number(value);
  if (Number.isInteger(hops) && hops > 0) return hops;
  return value;
};

export const normalizeTrustProxyHops = (input = 0) => {
  const hops = Number(input);
  if (!Number.isInteger(hops) || hops < 0) return '0';
  return String(Math.min(hops, 10));
};
