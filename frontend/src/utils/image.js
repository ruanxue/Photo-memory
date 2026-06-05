export const imageUrl = (url) => {
  if (!url) return 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80';
  if (/^https?:\/\//.test(url)) return url;
  return url;
};

export const albumCover = (album) => {
  if (!album) return imageUrl();
  const cover = album.coverPhoto?.mediumUrl
    || album.coverPhoto?.thumbnailUrl
    || album.photos?.[0]?.mediumUrl
    || album.photos?.[0]?.thumbnailUrl
    || album.coverUrl;
  return imageUrl(cover);
};
