import { toGregorian } from 'jalaali-js';
import { toLatinDigits } from './persian.ts';
import type { ResolvedLocale } from '../config.ts';

/**
 * Parse a frontmatter date. Accepts Date objects (YAML timestamps), ISO strings,
 * and Jalali dates such as `1403/07/14` or `۱۴۰۳-۰۷-۱۴` (any year < 1700 is treated as Jalali).
 */
export function parseDate(value: unknown, calendarHint: 'jalali' | 'gregorian' = 'gregorian'): Date | undefined {
  if (value == null || value === '') return undefined;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
  if (typeof value === 'number') return new Date(value);
  if (typeof value !== 'string') return undefined;
  const s = toLatinDigits(value.trim());
  const m = /^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const hh = Number(m[4] ?? 0);
    const mm = Number(m[5] ?? 0);
    const ss = Number(m[6] ?? 0);
    const isJalali = y < 1700 || (calendarHint === 'jalali' && y < 1700);
    if (isJalali) {
      const g = toGregorian(y, mo, d);
      return new Date(Date.UTC(g.gy, g.gm - 1, g.gd, hh, mm, ss));
    }
    if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(s) && !m[4]) {
      return new Date(Date.UTC(y, mo - 1, d));
    }
  }
  const t = new Date(s);
  return Number.isNaN(t.getTime()) ? undefined : t;
}

export type DateStyle = 'long' | 'medium' | 'short' | 'year' | 'month';

const cache = new Map<string, Intl.DateTimeFormat>();

function formatter(locale: ResolvedLocale, style: DateStyle): Intl.DateTimeFormat {
  const key = `${locale.code}|${locale.calendar}|${locale.numerals}|${style}`;
  let f = cache.get(key);
  if (!f) {
    const opts: Intl.DateTimeFormatOptions = {
      calendar: locale.calendar === 'jalali' ? 'persian' : 'gregory',
      numberingSystem: locale.numerals,
      timeZone: 'UTC',
    };
    if (style === 'year') opts.year = 'numeric';
    else if (style === 'month') Object.assign(opts, { year: 'numeric', month: 'long' });
    else opts.dateStyle = style;
    f = new Intl.DateTimeFormat(locale.intl, opts);
    cache.set(key, f);
  }
  return f;
}

/** Locale-aware date rendering (Gregorian/Jalali, Latin/Persian digits) via Intl. */
export function formatDate(date: Date, locale: ResolvedLocale, style: DateStyle = 'long'): string {
  // Intl appends the era (e.g. "AP"/"ه‍.ش.") for the Persian calendar in some locales; strip it.
  return formatter(locale, style)
    .format(date)
    .replace(/\s*(AP|ه‍\.ش\.|ه\.ش\.)$/u, '');
}

/** Year number in the locale's calendar (used for yearly archives). */
export function calendarYear(date: Date, locale: ResolvedLocale): number {
  const parts = new Intl.DateTimeFormat('en-US-u-nu-latn', {
    calendar: locale.calendar === 'jalali' ? 'persian' : 'gregory',
    year: 'numeric',
    timeZone: 'UTC',
  }).formatToParts(date);
  return Number(parts.find((p) => p.type === 'year')?.value ?? date.getUTCFullYear());
}

export function formatNumber(n: number, locale: ResolvedLocale): string {
  return new Intl.NumberFormat(locale.intl, { numberingSystem: locale.numerals }).format(n);
}
