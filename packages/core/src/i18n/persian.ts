/** Persian / Arabic script typography helpers. */

const ARABIC_TO_PERSIAN: Record<string, string> = {
  'ي': 'ی', // U+064A ARABIC YEH -> U+06CC FARSI YEH
  'ى': 'ی', // U+0649 ALEF MAKSURA
  'ك': 'ک', // U+0643 ARABIC KAF -> U+06A9 KEHEH
  'ۀ': 'هٔ',
};

/** Normalize Arabic code points to their Persian equivalents (ی/ک). */
export function normalizePersian(input: string): string {
  return input.replace(/[يىكۀ]/g, (c) => ARABIC_TO_PERSIAN[c] ?? c);
}

const DIGITS: Record<string, string> = {
  arabext: '۰۱۲۳۴۵۶۷۸۹',
  arab: '٠١٢٣٤٥٦٧٨٩',
};

export function localizeDigits(input: string | number, numerals: string): string {
  const s = String(input);
  const table = DIGITS[numerals];
  if (!table) return s;
  return s.replace(/[0-9]/g, (d) => table[Number(d)]!);
}

/** Convert Persian/Arabic digits back to ASCII. */
export function toLatinDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

const ZWNJ = '‌';

/**
 * Typographic fixes for Persian running text:
 * - Arabic ی/ک normalization
 * - straight double quotes -> « »
 * - common ZWNJ fixes: "می " / "نمی " prefixes and "ها" plural suffix written with a space
 * Existing ZWNJ characters are preserved.
 */
export function persianTypography(text: string): string {
  let t = normalizePersian(text);
  // «quotes» — only pairs within the same text run
  t = t.replace(/"([^"\n]+)"/g, '«$1»');
  // می رود -> می‌رود (only when followed by a Persian letter)
  t = t.replace(/(^|[\s(«])(ن?می) (?=[؀-ۿ])/g, `$1$2${ZWNJ}`);
  // کتاب ها -> کتاب‌ها ; کتاب های -> کتاب‌های
  t = t.replace(/([؀-ۿ]) (ها|های|هایی|هایم|هایت|هایش|تر|ترین)(?=$|[\s.,،؛:!?؟»)])/g, `$1${ZWNJ}$2`);
  return t;
}

/** True if the string contains Arabic-script letters. */
export function hasArabicScript(s: string): boolean {
  return /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/.test(s);
}

/** True if the string contains strong LTR letters (Latin etc.). */
export function hasLatin(s: string): boolean {
  return /[A-Za-zÀ-ɏ]/.test(s);
}
