export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif'
];

export const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/webm'
];

export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export function isValidMediaType(mimeType: string): boolean {
  return [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES].includes(mimeType);
}

export function isImageType(mimeType: string): boolean {
  return ALLOWED_IMAGE_TYPES.includes(mimeType);
}

export function isVideoType(mimeType: string): boolean {
  return ALLOWED_VIDEO_TYPES.includes(mimeType);
}

export function getMediaType(mimeType: string): 'image' | 'video' | null {
  if (isImageType(mimeType)) return 'image';
  if (isVideoType(mimeType)) return 'video';
  return null;
} 