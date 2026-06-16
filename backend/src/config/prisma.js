import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error']
});

let sqliteConfigured = false;

export const configureSqlite = async () => {
  if (sqliteConfigured) return;
  sqliteConfigured = true;
  await prisma.$queryRawUnsafe('PRAGMA foreign_keys = ON');
  await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL');
  await prisma.$queryRawUnsafe('PRAGMA synchronous = NORMAL');
  await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000');
};
