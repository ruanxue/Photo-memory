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
  ['分辨率', photo?.width && photo?.height ? `${photo.width} x ${photo.height}` : null],
  ['文件类型', photo?.mimeType],
  ['GPS', photo?.latitude && photo?.longitude ? `${photo.latitude}, ${photo.longitude}` : null]
].filter((row) => row[1] !== undefined && row[1] !== null && row[1] !== '');
