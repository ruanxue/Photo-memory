import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import slugify from 'slugify';

const prisma = new PrismaClient();

const makeSlug = (value) => slugify(value, { lower: true, strict: true, locale: 'zh' }) || encodeURIComponent(value);

const categories = ['旅行', '生活', '城市', '风景', '人像', '美食', '建筑', '胶片', '黑白', '日常'];
const tags = ['日本', '台湾', '成都', '西安', '重庆', '上海', '海边', '夜景', '街头', '山川', '日落', '朋友', '家人', '美食', '胶片感', '建筑', '日常'];
const albums = [
  ['日本旅行', '从东京街头到京都小巷的旅行记录。'],
  ['台湾映像', '海风、夜市和老街的慢速片段。'],
  ['城市街头', '日常城市里的光、影和行人。'],
  ['日常生活', '不用远行也值得记录的日子。'],
  ['老照片', '带一点颗粒、旧色和时间感。'],
  ['美食记录', '路边摊、咖啡馆和餐桌上的记忆。']
];

const groups = [
  ['京都清晨小路', '旅行', '日本旅行', ['日本', '街头'], '日本', '京都', '祇园', 35.0037, 135.7788, '2025-05-02'],
  ['东京雨夜', '城市', '日本旅行', ['日本', '夜景', '街头'], '日本', '东京', '新宿', 35.6938, 139.7034, '2025-05-05'],
  ['台湾海边日落', '风景', '台湾映像', ['台湾', '海边', '日落'], '中国', '花莲', '七星潭', 24.029, 121.627, '2024-10-08'],
  ['台北老街', '城市', '台湾映像', ['台湾', '街头'], '中国', '台北', '迪化街', 25.063, 121.51, '2024-10-10'],
  ['成都九眼桥', '旅行', '城市街头', ['成都', '夜景'], '中国', '成都', '九眼桥', 30.641, 104.083, '2024-11-18'],
  ['宽窄巷子午后', '生活', '城市街头', ['成都', '街头'], '中国', '成都', '宽窄巷子', 30.669, 104.06, '2024-11-19'],
  ['西安城墙', '建筑', '城市街头', ['西安', '日落', '建筑'], '中国', '西安', '永宁门', 34.247, 108.942, '2024-09-21'],
  ['重庆夜景', '城市', '城市街头', ['重庆', '夜景'], '中国', '重庆', '洪崖洞', 29.5628, 106.576, '2025-01-12'],
  ['上海街角', '城市', '城市街头', ['上海', '街头'], '中国', '上海', '武康路', 31.216, 121.445, '2025-03-03'],
  ['海边朋友', '人像', '日常生活', ['朋友', '海边'], '中国', '厦门', '环岛路', 24.445, 118.11, '2024-07-16'],
  ['家里的晚餐', '美食', '美食记录', ['家人', '美食'], '中国', '上海', '家中', null, null, '2024-12-31'],
  ['咖啡馆窗边', '日常', '日常生活', ['美食', '日常'], '中国', '杭州', '湖滨', 30.255, 120.16, '2025-02-14'],
  ['山川远眺', '风景', '老照片', ['山川'], '中国', '丽江', '玉龙雪山', 27.1, 100.176, '2023-08-11'],
  ['黑白街头', '黑白', '老照片', ['街头', '胶片感'], '中国', '广州', '东山口', 23.125, 113.297, '2023-05-20'],
  ['胶片感午后', '胶片', '老照片', ['胶片感', '日常'], '中国', '苏州', '平江路', 31.315, 120.63, '2023-06-01'],
  ['夜市小吃', '美食', '台湾映像', ['台湾', '美食', '夜景'], '中国', '台南', '花园夜市', 23.01, 120.2, '2024-10-12'],
  ['建筑立面', '建筑', '城市街头', ['上海', '建筑'], '中国', '上海', '外滩', 31.24, 121.49, '2025-03-06'],
  ['朋友聚会', '生活', '日常生活', ['朋友', '日常'], '中国', '成都', '玉林', null, null, '2025-04-18'],
  ['海面晨光', '风景', '台湾映像', ['海边', '日落'], '中国', '垦丁', '南湾', 21.96, 120.765, '2024-10-15'],
  ['书房一角', '日常', '日常生活', ['日常', '家人'], '中国', '上海', '书房', null, null, '2025-05-01']
];

const variants = [
  ['近景', '把目光放近一点，留下现场的细节和空气。'],
  ['远景', '把环境一起收进画面，让地点本身参与叙事。'],
  ['侧光', '光线从侧面落下，轮廓和层次都更清楚。']
];

const imageSize = (index) => {
  const sizes = [
    [1600, 2200],
    [1600, 1200],
    [1600, 1900],
    [1600, 1450],
    [1600, 2500]
  ];
  return sizes[index % sizes.length];
};

const imageUrl = (seed, width, height) => `https://picsum.photos/seed/${seed}/${width}/${height}`;

async function upsertUsers() {
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@example.com',
      nickname: '管理员',
      passwordHash: await bcrypt.hash('admin123456', 12),
      role: 'admin'
    }
  });

  const demo = await prisma.user.upsert({
    where: { username: 'demo' },
    update: {},
    create: {
      username: 'demo',
      email: 'demo@example.com',
      nickname: 'Demo 用户',
      passwordHash: await bcrypt.hash('demo123456', 12),
      role: 'user'
    }
  });

  return { admin, demo };
}

async function upsertCategories() {
  const categoryMap = new Map();
  for (const [index, name] of categories.entries()) {
    const category = await prisma.category.upsert({
      where: { name },
      update: { sortOrder: categories.length - index },
      create: { name, slug: makeSlug(name), sortOrder: categories.length - index, description: `${name}主题照片` }
    });
    categoryMap.set(name, category);
  }
  return categoryMap;
}

async function upsertTags() {
  const tagMap = new Map();
  const colors = ['#8fb8c4', '#d89575', '#84a98c', '#e6c47a', '#b9a8d9'];
  for (const [index, name] of tags.entries()) {
    const tag = await prisma.tag.upsert({
      where: { name },
      update: {},
      create: { name, slug: makeSlug(name), color: colors[index % colors.length] }
    });
    tagMap.set(name, tag);
  }
  return tagMap;
}

async function upsertAlbums(userId) {
  const albumMap = new Map();
  for (const [index, item] of albums.entries()) {
    const existing = await prisma.album.findFirst({ where: { userId, title: item[0] } });
    const album = existing
      ? await prisma.album.update({
          where: { id: existing.id },
          data: { title: item[0], description: item[1], isPinned: index < 2, sortOrder: albums.length - index }
        })
      : await prisma.album.create({
          data: {
        userId,
        title: item[0],
        description: item[1],
        visibility: 'public',
        isPinned: index < 2,
        sortOrder: albums.length - index
      }
        });
    albumMap.set(item[0], album);
  }
  return albumMap;
}

async function createPhotos({ admin, demo, categoryMap, tagMap, albumMap }) {
  await prisma.photo.deleteMany({ where: { filename: { startsWith: 'sample-' } } });

  let index = 0;
  for (const group of groups) {
    for (const [variantIndex, variant] of variants.entries()) {
      index += 1;
      const [title, categoryName, albumName, tagNames, country, city, locationName, latitude, longitude, date] = group;
      const [variantTitle, variantDescription] = variant;
      const [width, height] = imageSize(index);
      const seed = `photo-memory-${index}`;
      const latitudeOffset = latitude ? latitude + variantIndex * 0.0008 : null;
      const longitudeOffset = longitude ? longitude + variantIndex * 0.0008 : null;
      const isPinned = index % 17 === 1;
      const isFeatured = index % 3 !== 2;
      const photo = await prisma.photo.create({
        data: {
          userId: demo.id,
          albumId: albumMap.get(albumName)?.id,
          categoryId: categoryMap.get(categoryName)?.id,
          title: `${title} · ${variantTitle}`,
          description: variantDescription,
          originalUrl: imageUrl(seed, 2400, Math.round((2400 * height) / width)),
          mediumUrl: imageUrl(seed, 1600, height),
          thumbnailUrl: imageUrl(seed, 720, Math.round((720 * height) / width)),
          filename: `sample-${index}.jpg`,
          mimeType: 'image/jpeg',
          fileSize: 1100000 + index * 39000,
          width,
          height,
          takenAt: new Date(`${date}T10:00:00.000Z`),
          cameraMake: index % 2 === 0 ? 'Fujifilm' : 'Sony',
          cameraModel: index % 2 === 0 ? 'X-T5' : 'A7C II',
          lensModel: index % 2 === 0 ? 'XF 23mm F1.4' : 'FE 35mm F1.8',
          focalLength: index % 2 === 0 ? 23 : 35,
          aperture: index % 2 === 0 ? 2.8 : 4,
          shutterSpeed: index % 2 === 0 ? '1/250s' : '1/125s',
          iso: 100 + index * 16,
          exposureCompensation: '0',
          whiteBalance: 'Auto',
          latitude: latitudeOffset,
          longitude: longitudeOffset,
          country,
          city,
          locationName,
          visibility: index % 29 === 0 ? 'private' : 'public',
          status: 'normal',
          isPinned,
          pinnedAt: isPinned ? new Date() : null,
          isFeatured,
          sortOrder: groups.length * variants.length - index,
          viewCount: 90 + index * 19,
          favoriteCount: 3 + Math.floor(index / 2),
          commentCount: index % 5 === 0 ? 1 : 0
        }
      });

      for (const tagName of tagNames) {
        await prisma.photoTag.create({ data: { photoId: photo.id, tagId: tagMap.get(tagName).id } });
      }

      if (index % 5 === 0) {
        await prisma.comment.create({
          data: {
            photoId: photo.id,
            userId: admin.id,
            content: '这张很有现场感。',
            status: 'approved'
          }
        });
      }
    }
  }
}

async function seedSettings() {
  const settings = [
    ['siteName', 'Photo Memory', '网站名称'],
    ['siteSubtitle', '私人影像馆', '网站副标题'],
    ['homeIntro', '记录旅行、生活与摄影作品。', '首页介绍文字'],
    ['faviconUrl', '', 'Favicon 图片地址'],
    ['heroMode', 'random', '首页主图模式'],
    ['heroPhotoIds', '[]', '首页主图候选照片 ID'],
    ['heroFixedPhotoId', '', '首页固定主图照片 ID'],
      ['allowRegister', 'true', '是否允许注册'],
      ['allowUserUpload', 'true', '是否允许普通用户上传'],
      ['commentsEnabled', 'true', '是否开放评论区'],
      ['commentReview', 'false', '是否开启评论审核'],
    ['uploadMaxSizeMb', '15', '上传文件大小限制 MB'],
    ['pageSize', '20', '每页照片数量'],
    ['waterfallColumns', 'auto', '瀑布流列数'],
    ['waterfallFullBleed', 'false', '瀑布流铺满左右空隙'],
    ['waterfallLoadAnimation', 'blur', '瀑布流图片加载动画'],
    ['waterfallLoadDurationMs', '720', '瀑布流图片加载动画时长'],
    ['waterfallLoadStaggerMs', '24', '瀑布流图片加载错峰延迟'],
    ['waterfallCustomLoadCss', '', '瀑布流图片自定义加载 CSS'],
    ['trustProxyHops', '0', '反向代理层数'],
    ['includeAlbumsInWaterfall', 'true', '瀑布流中展示相册'],
    ['showExifOnHover', 'true', '瀑布流卡片显示 EXIF 悬浮信息'],
    ['mapTileProvider', 'amap', '地图底图来源'],
    ['mapTileUrl', '', '自定义地图瓦片 URL'],
    ['mapTileAttribution', '© 高德地图', '地图底图版权署名'],
    ['defaultSort', 'latest', '默认排序方式'],
    ['icp', '', 'ICP备案号'],
    ['footerCopyright', '© Photo Memory', '页脚版权'],
    ['technologyCredit', 'Vue 3 & Express + Prisma + SQLite', '瀑布流技术署名'],
    ['watermarkEnabled', 'false', '照片水印开关'],
    ['hideLoginEntry', 'false', '前台隐藏登录入口']
  ];

  for (const [key, value, description] of settings) {
    await prisma.systemSetting.upsert({
      where: { key },
      update: {},
      create: { key, value, description }
    });
  }
}

async function refreshCounters() {
  const allCategories = await prisma.category.findMany({ select: { id: true } });
  for (const category of allCategories) {
    await prisma.category.update({
      where: { id: category.id },
      data: { photoCount: await prisma.photo.count({ where: { categoryId: category.id, status: 'normal' } }) }
    });
  }

  const allTags = await prisma.tag.findMany({ select: { id: true } });
  for (const tag of allTags) {
    await prisma.tag.update({
      where: { id: tag.id },
      data: { photoCount: await prisma.photoTag.count({ where: { tagId: tag.id, photo: { status: 'normal' } } }) }
    });
  }

  const allAlbums = await prisma.album.findMany({ select: { id: true } });
  for (const album of allAlbums) {
    const first = await prisma.photo.findFirst({ where: { albumId: album.id, status: 'normal' }, orderBy: { sortOrder: 'desc' } });
    const min = await prisma.photo.aggregate({ where: { albumId: album.id, takenAt: { not: null } }, _min: { takenAt: true } });
    const max = await prisma.photo.aggregate({ where: { albumId: album.id, takenAt: { not: null } }, _max: { takenAt: true } });
    await prisma.album.update({
      where: { id: album.id },
      data: {
        photoCount: await prisma.photo.count({ where: { albumId: album.id, status: 'normal' } }),
        coverPhotoId: first?.id || null,
        startDate: min._min.takenAt,
        endDate: max._max.takenAt
      }
    });
  }
}

async function main() {
  if (process.env.SEED_ONLY_EMPTY === 'true') {
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      console.log('Seed skipped because database already has users.');
      return;
    }
  }

  const users = await upsertUsers();
  const categoryMap = await upsertCategories();
  const tagMap = await upsertTags();
  const albumMap = await upsertAlbums(users.demo.id);
  await createPhotos({ ...users, categoryMap, tagMap, albumMap });
  await seedSettings();
  await refreshCounters();
  console.log('Seed completed with 60 sample photos.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
