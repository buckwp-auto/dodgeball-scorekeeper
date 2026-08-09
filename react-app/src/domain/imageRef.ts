import {
  MAX_IMAGE_CONTENT_TYPE,
  MAX_IMAGE_URL,
  MAX_STORAGE_PATH,
  assertMaxLength,
} from './limits';

export type ImageKind = 'external' | 'storage';

export type ImageRef = {
  kind: ImageKind;
  /** Always an https URL the UI can put in <img src>. */
  url: string;
  /** Only when kind === 'storage'. Unused in Phase 1. */
  storagePath?: string;
  contentType?: string;
  updatedAt?: string;
};

export function isHttpsImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > MAX_IMAGE_URL) return false;
  try {
    return new URL(trimmed).protocol === 'https:';
  } catch {
    return false;
  }
}

export function imageSrc(ref?: ImageRef | null): string | null {
  if (!ref?.url) return null;
  const trimmed = ref.url.trim();
  return isHttpsImageUrl(trimmed) ? trimmed : null;
}

export function imageRefFromExternalUrl(url: string): ImageRef {
  const trimmed = url.trim();
  if (!trimmed) throw new Error('Image URL required');
  assertMaxLength(trimmed, MAX_IMAGE_URL, 'Image URL');
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Image URL must be https');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('Image URL must be https');
  }
  assertMaxLength(parsed.href, MAX_IMAGE_URL, 'Image URL');
  return {
    kind: 'external',
    url: parsed.href,
    updatedAt: new Date().toISOString(),
  };
}

export function parseImageRef(raw: unknown): ImageRef | null {
  if (raw == null || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  const kind: ImageKind | null =
    rec.kind === 'storage' ? 'storage' : rec.kind === 'external' ? 'external' : null;
  if (!kind || typeof rec.url !== 'string' || !isHttpsImageUrl(rec.url)) return null;

  const ref: ImageRef = { kind, url: rec.url.trim() };
  if (
    typeof rec.storagePath === 'string' &&
    rec.storagePath.length > 0 &&
    rec.storagePath.length <= MAX_STORAGE_PATH
  ) {
    ref.storagePath = rec.storagePath;
  }
  if (
    typeof rec.contentType === 'string' &&
    rec.contentType.length > 0 &&
    rec.contentType.length <= MAX_IMAGE_CONTENT_TYPE
  ) {
    ref.contentType = rec.contentType;
  }
  if (typeof rec.updatedAt === 'string' && rec.updatedAt.length <= 40) {
    ref.updatedAt = rec.updatedAt;
  }
  return ref;
}

export function entityInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase();
}
