import dotenv from 'dotenv';
import { parseTrustProxyValue } from '../utils/proxy.js';

dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 13033),
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  uploadMaxSizeMb: Number(process.env.UPLOAD_MAX_SIZE_MB || 15),
  uploadTransportMaxSizeMb: Number(process.env.UPLOAD_TRANSPORT_MAX_SIZE_MB || process.env.UPLOAD_MAX_SIZE_MB || 100),
  publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:13033',
  trustProxy: parseTrustProxyValue(process.env.TRUST_PROXY ?? process.env.TRUST_PROXY_HOPS ?? '0')
};
