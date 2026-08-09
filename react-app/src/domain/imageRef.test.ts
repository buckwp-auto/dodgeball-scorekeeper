import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_URL } from './limits';
import {
  entityInitials,
  imageRefFromExternalUrl,
  imageSrc,
  isHttpsImageUrl,
  parseImageRef,
} from './imageRef';

describe('isHttpsImageUrl', () => {
  it('accepts https URLs', () => {
    expect(isHttpsImageUrl('https://example.com/logo.png')).toBe(true);
    expect(isHttpsImageUrl('  HTTPS://cdn.example.com/a.webp  ')).toBe(true);
  });

  it('rejects http, data, javascript, and junk', () => {
    expect(isHttpsImageUrl('http://example.com/logo.png')).toBe(false);
    expect(isHttpsImageUrl('data:image/png;base64,abc')).toBe(false);
    expect(isHttpsImageUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpsImageUrl('')).toBe(false);
    expect(isHttpsImageUrl('not a url')).toBe(false);
    expect(isHttpsImageUrl(`https://example.com/${'a'.repeat(MAX_IMAGE_URL)}`)).toBe(
      false,
    );
  });
});

describe('imageRefFromExternalUrl', () => {
  it('normalizes an https URL', () => {
    const ref = imageRefFromExternalUrl('  https://Example.com/logo.png  ');
    expect(ref.kind).toBe('external');
    expect(ref.url).toBe('https://example.com/logo.png');
    expect(ref.updatedAt).toEqual(expect.any(String));
  });

  it('throws for empty, http, and over-length URLs', () => {
    expect(() => imageRefFromExternalUrl('')).toThrow(/required/i);
    expect(() => imageRefFromExternalUrl('http://example.com/x.png')).toThrow(
      /https/,
    );
    expect(() => imageRefFromExternalUrl('data:image/png;base64,abc')).toThrow(
      /https/,
    );
    expect(() =>
      imageRefFromExternalUrl(`https://example.com/${'a'.repeat(MAX_IMAGE_URL)}`),
    ).toThrow(/at most/);
  });
});

describe('parseImageRef / imageSrc', () => {
  it('returns null for missing or junk values', () => {
    expect(parseImageRef(null)).toBeNull();
    expect(parseImageRef(undefined)).toBeNull();
    expect(parseImageRef('https://example.com/x.png')).toBeNull();
    expect(parseImageRef({ kind: 'external', url: 'http://example.com/x.png' })).toBeNull();
    expect(imageSrc(null)).toBeNull();
    expect(imageSrc({ kind: 'external', url: 'http://bad.example/x.png' })).toBeNull();
  });

  it('accepts external and storage kinds when url is https', () => {
    expect(
      parseImageRef({ kind: 'external', url: 'https://cdn.example/logo.webp' }),
    ).toMatchObject({
      kind: 'external',
      url: 'https://cdn.example/logo.webp',
    });
    const stored = parseImageRef({
      kind: 'storage',
      url: 'https://firebasestorage.googleapis.com/v0/b/x/o/logo.webp',
      storagePath: 'leagues/1/logo.webp',
      contentType: 'image/webp',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(stored).toEqual({
      kind: 'storage',
      url: 'https://firebasestorage.googleapis.com/v0/b/x/o/logo.webp',
      storagePath: 'leagues/1/logo.webp',
      contentType: 'image/webp',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(imageSrc(stored)).toBe(
      'https://firebasestorage.googleapis.com/v0/b/x/o/logo.webp',
    );
  });
});

describe('entityInitials', () => {
  it('uses one or two letters from the name', () => {
    expect(entityInitials('Hawks')).toBe('HA');
    expect(entityInitials('Home Hawks')).toBe('HH');
    expect(entityInitials('  ')).toBe('?');
  });
});
