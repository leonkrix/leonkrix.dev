/** The languages of Word Radar. English is the default; German is chosen by the address. */
export type Language = 'en' | 'de';

export const languages: readonly Language[] = ['en', 'de'];

/** The language written in the address (?lang=de). Anything else is English. */
export function parseLanguage(search: string): Language {
  return new URLSearchParams(search).get('lang') === 'de' ? 'de' : 'en';
}

/** The number format of a language, so that a rank reads 1,000 in English and 1.000 in German */
export const locales: Readonly<Record<Language, string>> = { en: 'en-US', de: 'de-DE' };
