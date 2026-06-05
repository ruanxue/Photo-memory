import exifr from 'exifr';

const toNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatShutter = (value) => {
  if (!value) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  if (number >= 1) return `${number}s`;
  return `1/${Math.round(1 / number)}s`;
};

export const readExif = async (filePath) => {
  try {
    const exif = await exifr.parse(filePath, {
      tiff: true,
      ifd0: true,
      exif: true,
      gps: true,
      interop: true,
      translateValues: false,
      translateKeys: true,
      reviveValues: true,
      mergeOutput: true
    });

    if (!exif) return {};

    return {
      takenAt: exif.DateTimeOriginal || exif.CreateDate || exif.ModifyDate || null,
      cameraMake: exif.Make || null,
      cameraModel: exif.Model || null,
      lensModel: exif.LensModel || null,
      focalLength: toNumber(exif.FocalLength),
      aperture: toNumber(exif.FNumber),
      shutterSpeed: formatShutter(exif.ExposureTime),
      iso: exif.ISO ? Number(exif.ISO) : null,
      exposureCompensation: exif.ExposureCompensation ? String(exif.ExposureCompensation) : null,
      whiteBalance: exif.WhiteBalance ? String(exif.WhiteBalance) : null,
      latitude: toNumber(exif.latitude),
      longitude: toNumber(exif.longitude)
    };
  } catch {
    return {};
  }
};
