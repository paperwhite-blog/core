import en from '../../i18n/en.json' with { type: 'json' };
import fa from '../../i18n/fa.json' with { type: 'json' };
import { localizeDigits } from './persian.ts';
import type { ResolvedLocale } from '../config.ts';

export type Strings = Record<string, string>;

const CORE: Record<string, Strings> = { en, fa };

/** Merge core → theme → site strings. Missing keys fall back to English. */
export function buildStrings(
  locale: string,
  theme: Record<string, Strings> = {},
  site: Record<string, Strings> = {},
): Strings {
  return { ...CORE.en, ...theme.en, ...site.en, ...CORE[locale], ...theme[locale], ...site[locale] };
}

export function makeT(strings: Strings, locale: ResolvedLocale) {
  return (key: string, params: Record<string, string | number> = {}): string => {
    const tpl = strings[key] ?? key;
    return tpl.replace(/\{(\w+)\}/g, (_, k: string) => {
      const v = params[k];
      if (v === undefined) return `{${k}}`;
      return typeof v === 'number' ? localizeDigits(v, locale.numerals) : v;
    });
  };
}
