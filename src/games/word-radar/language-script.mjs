/**
 * The inline script at the top of the page of Word Radar: it says the language of the address to the
 * stylesheet (`data-wr-language` on the html element) before anything of the game is drawn, so that
 * the placeholder of the game is shown in that language from the first frame (the page is static and
 * does not know the address). It is the same rule as `parseLanguage` in logic/language.ts, and a test
 * compares them.
 *
 * It lives in this file because two places need the exact text: the page (GamePage.astro writes it
 * into the HTML) and the configuration (astro.config.mjs computes the hash that the content security
 * policy needs for an inline script, Astro does not do that for a script marked `is:inline`). Do not
 * change the text without a reason, and not at all by editing it somewhere else.
 */
export const languageScript =
  "document.documentElement.dataset.wrLanguage=new URLSearchParams(window.location.search).get('lang')==='de'?'de':'en';";
