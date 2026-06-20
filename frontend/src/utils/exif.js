export const exifRows = (photo) => [
  ['相机品牌', photo?.cameraMake],
  ['相机型号', photo?.cameraModel],
  ['镜头', photo?.lensModel],
  ['焦距', photo?.focalLength ? `${photo.focalLength} mm` : null],
  ['光圈', photo?.aperture ? `f/${photo.aperture}` : null],
  ['快门', photo?.shutterSpeed],
  ['ISO', photo?.iso],
  ['曝光补偿', photo?.exposureCompensation],
  ['白平衡', photo?.whiteBalance],
  ['分辨率', photo?.width && photo?.height ? `${photo.width} x ${photo.height}` : null]
].filter((row) => row[1] !== undefined && row[1] !== null && row[1] !== '');

const exifSignalFields = [
  'cameraMake',
  'cameraModel',
  'lensModel',
  'focalLength',
  'aperture',
  'shutterSpeed',
  'iso',
  'exposureCompensation',
  'whiteBalance'
];

export const hasExifInfo = (photo) => Boolean(photo && exifSignalFields.some((field) => {
  const value = photo[field];
  return value !== undefined && value !== null && value !== '';
}));

export const hasGpsInfo = (photo) => {
  const rawLatitude = photo?.latitude;
  const rawLongitude = photo?.longitude;
  if (rawLatitude === undefined || rawLatitude === null || rawLatitude === '') return false;
  if (rawLongitude === undefined || rawLongitude === null || rawLongitude === '') return false;
  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;
};
