import { normalizePersian } from './persian.ts';

/**
 * Slugify a title or filename. Unicode letters (Persian included) are preserved,
 * Arabic ی/ک normalized, ZWNJ turned into a hyphen, punctuation dropped, Latin lowercased.
 */
export function slugify(input: string): string {
  return normalizePersian(input.normalize('NFC'))
    .toLowerCase()
    .replace(/‌/g, '-')
    .replace(/[ً-ٰٟ]/g, '') // Arabic diacritics
    .replace(/['’"`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

/** Encode a path for use in href/canonical while keeping slashes. */
export function encodePath(path: string): string {
  return path
    .split('/')
    .map((seg) => (seg ? encodeURIComponent(decodeSafe(seg)) : seg))
    .join('/');
}

function decodeSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
