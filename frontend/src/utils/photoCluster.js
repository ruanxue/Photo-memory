const toFiniteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const distanceSquared = (a, b) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

const average = (items, key) => {
  if (!items.length) return null;
  return items.reduce((sum, item) => sum + item[key], 0) / items.length;
};

export const createPhotoClusters = (photos = [], options = {}) => {
  const {
    project,
    radius = 74,
    zoom = 1,
    maxClusterZoom = 15,
    focusedPhotoId = null
  } = options;

  if (typeof project !== 'function') return [];

  const focusedId = focusedPhotoId ? Number(focusedPhotoId) : null;
  const shouldCluster = Number(zoom) < Number(maxClusterZoom);
  const radiusSquared = radius * radius;
  const clusters = [];

  photos.forEach((photo, index) => {
    const latitude = toFiniteNumber(photo?.latitude);
    const longitude = toFiniteNumber(photo?.longitude);
    if (latitude === null || longitude === null) return;

    const point = project(photo, latitude, longitude);
    const x = toFiniteNumber(point?.x);
    const y = toFiniteNumber(point?.y);
    if (x === null || y === null) return;

    const normalized = {
      ...photo,
      latitude,
      longitude,
      __clusterIndex: index,
      __clusterPoint: { x, y }
    };

    const isFocused = focusedId && Number(photo.id) === focusedId;
    let targetCluster = null;

    if (shouldCluster && !isFocused) {
      targetCluster = clusters.find((cluster) => {
        if (cluster.isFocused) return false;
        return distanceSquared(cluster.point, normalized.__clusterPoint) <= radiusSquared;
      });
    }

    if (targetCluster) {
      targetCluster.photos.push(normalized);
      targetCluster.point.x = average(targetCluster.photos.map((item) => item.__clusterPoint), 'x');
      targetCluster.point.y = average(targetCluster.photos.map((item) => item.__clusterPoint), 'y');
      return;
    }

    clusters.push({
      id: `photo-cluster-${photo.id}`,
      point: { ...normalized.__clusterPoint },
      photos: [normalized],
      isFocused
    });
  });

  return clusters.map((cluster) => {
    const orderedPhotos = [...cluster.photos].sort((a, b) => a.__clusterIndex - b.__clusterIndex);
    const coverPhoto = orderedPhotos[0];
    const ids = orderedPhotos.map((photo) => Number(photo.id)).filter(Number.isFinite);
    return {
      id: ids.length > 1 ? `photo-cluster-${ids.join('-')}` : `photo-${coverPhoto.id}`,
      count: orderedPhotos.length,
      coverPhoto,
      photos: orderedPhotos,
      latitude: average(orderedPhotos, 'latitude') ?? coverPhoto.latitude,
      longitude: average(orderedPhotos, 'longitude') ?? coverPhoto.longitude
    };
  });
};
