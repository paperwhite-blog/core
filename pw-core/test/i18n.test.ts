import { describe, it, expect } from 'vitest';
import { parseDate, formatDate, calendarYear } from '../src/i18n/dates.ts';
import { persianTypography, normalizePersian, localizeDigits, toLatinDigits } from '../src/i18n/persian.ts';
import { slugify, encodePath } from '../src/i18n/slug.ts';
import { makeT, buildStrings } from '../src/i18n/strings.ts';
import { resolveConfig } from '../src/config.ts';

const cfg = resolveConfig({ site: { url: 'https://x.test', title: 'x' }, locales: { supported: { en: {}, fa: {} } } }, '/tmp');
const en = cfg.locales.supported.en!;
const fa = cfg.locales.supported.fa!;

describe('dates', () => {
  it('parses ISO, Date and Jalali (incl. Persian digits)', () => {
    expect(parseDate('2024-03-01')!.toISOString()).toBe('2024-03-01T00:00:00.000Z');
    expect(parseDate(new Date('2020-01-01'))!.getUTCFullYear()).toBe(2020);
    expect(parseDate('1403/07/14')!.toISOString()).toBe('2024-10-05T00:00:00.000Z');
    expect(parseDate('۱۴۰۳-۰۷-۱۴')!.toISOString()).toBe('2024-10-05T00:00:00.000Z');
    expect(parseDate('nonsense')).toBeUndefined();
  });
  it('formats Gregorian for en and Jalali with Persian digits for fa', () => {
    const d = new Date('2024-10-05T00:00:00Z');
    expect(formatDate(d, en)).toBe('October 5, 2024');
    expect(formatDate(d, fa)).toBe('۱۴ مهر ۱۴۰۳');
    expect(calendarYear(d, fa)).toBe(1403);
    expect(calendarYear(d, en)).toBe(2024);
  });
});

describe('persian typography', () => {
  it('normalizes Arabic ي/ك', () => expect(normalizePersian('كتاب يك')).toBe('کتاب یک'));
  it('fixes ZWNJ, quotes and plurals', () => {
    expect(persianTypography('من "کتاب ها" را مي خوانم')).toBe('من «کتاب‌ها» را می‌خوانم');
  });
  it('preserves existing ZWNJ', () => expect(persianTypography('می‌روم')).toBe('می‌روم'));
  it('converts digits both ways', () => {
    expect(localizeDigits(1403, 'arabext')).toBe('۱۴۰۳');
    expect(toLatinDigits('۱۴۰۳')).toBe('1403');
  });
});

describe('slugs', () => {
  it('keeps Unicode for Persian and lowercases Latin', () => {
    expect(slugify('سلام دنیا')).toBe('سلام-دنیا');
    expect(slugify('Hello, World!')).toBe('hello-world');
    expect(slugify('برنامه‌نویسی')).toBe('برنامه-نویسی');
    expect(slugify('يادداشت')).toBe('یادداشت');
  });
  it('percent-encodes paths for hrefs', () => {
    expect(encodePath('/fa/سلام/')).toBe('/fa/%D8%B3%D9%84%D8%A7%D9%85/');
  });
});

describe('strings', () => {
  it('merges core → theme → site and localizes numbers', () => {
    const s = buildStrings('fa', { fa: { 'post.toc': 'X' } }, { fa: { 'post.related': 'Y' } });
    const t = makeT(s, fa);
    expect(t('post.toc')).toBe('X');
    expect(t('post.related')).toBe('Y');
    expect(t('post.readingTime', { n: 5 })).toBe('۵ دقیقه مطالعه');
    expect(makeT(buildStrings('en'), en)('post.readingTime', { n: 5 })).toBe('5 min read');
  });
});
