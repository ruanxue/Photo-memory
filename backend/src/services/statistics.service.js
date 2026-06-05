import { prisma } from '../config/prisma.js';

export const getAdminStatistics = async () => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    photoCount,
    userCount,
    albumCount,
    commentCount,
    todayUploads,
    monthUploads,
    totalViews,
    popularPhotos,
    popularTags,
    categories,
    recentPhotos
  ] = await Promise.all([
    prisma.photo.count({ where: { status: 'normal' } }),
    prisma.user.count(),
    prisma.album.count(),
    prisma.comment.count(),
    prisma.photo.count({ where: { createdAt: { gte: today } } }),
    prisma.photo.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.photo.aggregate({ _sum: { viewCount: true } }),
    prisma.photo.findMany({
      where: { status: 'normal' },
      orderBy: [{ viewCount: 'desc' }],
      take: 8,
      select: { id: true, title: true, thumbnailUrl: true, viewCount: true }
    }),
    prisma.tag.findMany({ orderBy: [{ photoCount: 'desc' }], take: 12 }),
    prisma.category.findMany({ orderBy: [{ photoCount: 'desc' }] }),
    prisma.photo.findMany({
      where: { status: 'normal' },
      orderBy: [{ createdAt: 'desc' }],
      take: 8,
      select: { id: true, title: true, thumbnailUrl: true, createdAt: true }
    })
  ]);

  return {
    photoCount,
    userCount,
    albumCount,
    commentCount,
    todayUploads,
    monthUploads,
    viewCount: totalViews._sum.viewCount || 0,
    popularPhotos,
    popularTags,
    categories,
    recentPhotos
  };
};
