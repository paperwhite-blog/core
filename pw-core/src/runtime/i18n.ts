import { config, strings } from 'virtual:paperwhite/config';
import { makeT } from '../i18n/strings.ts';
import { formatDate, formatNumber, calendarYear, type DateStyle } from '../i18n/dates.ts';
import { localizeDigits } from '../i18n/persian.ts';
import type { ResolvedLocale } from '../config.ts';

export function localeOf(lang: string | undefined): ResolvedLocale {
  const l = config.locales.supported;
  return (lang && l[lang]) || l[config.locales.default]!;
}

/** Everything a component needs to render text for a locale. */
export function useLocale(lang: string | undefined) {
  const locale = localeOf(lang);
  const t = makeT(strings[locale.code] ?? strings[config.locales.default] ?? {}, locale);
  return {
    locale,
    lang: locale.code,
    dir: locale.dir,
    t,
    date: (d: Date | string | undefined, style: DateStyle = 'long') => (d ? formatDate(new Date(d), locale, style) : ''),
    year: (d: Date) => calendarYear(d, locale),
    num: (n: number) => formatNumber(n, locale),
    digits: (s: string | number) => localizeDigits(s, locale.numerals),
  };
}

export type LocaleKit = ReturnType<typeof useLocale>;
