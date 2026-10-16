// Нормализация входной строки и обработка двуязычных склеек через «/».

import { TYPO_FIXES, LWORD, KZ_ONLY } from './lexicon.js';

const INVISIBLE = /[\u00A0\u00AD\u200B-\u200F\u2028\u2029\u202A-\u202E\u2060\uFEFF]/g;
const KZ_ONLY_RE = new RegExp(`[${KZ_ONLY}]`, 'i');

export function normalize(str) {
  if (!str) return '';
  let text = String(str);

  // Разделение склеенных ключевых слов и цифр (dom10 -> dom 10, flat12 -> flat 12, қабат3 -> қабат 3)
  const keywords = 'dom|house|home|flat|apt|apartment|kv|kvartira|pater|podyezd|pod|entrance|etazh|et|qabat|kabat|street|st|ulica|ul|дом|кв|этаж|эт|подъезд|под|қабат|пәтер|үй';
  
  const regex1 = new RegExp(`\\b(${keywords})(\\d+)\\b`, 'gi');
  const regex2 = new RegExp(`\\b(\\d+)(${keywords})\\b`, 'gi');

  text = text.replace(regex1, '$1 $2');
  text = text.replace(regex2, '$1 $2');

  return text.trim();
}

// «город Актобе/Актөбе қаласы» → оставляем русскую половину.
// Также поддержаны варианты, где казахская половина идёт первой.
export function resolveBilingual(input) {
  let s = input;

  // <ru>/<kk> қаласы|ауданы|қ.
  s = s.replace(
    new RegExp(`(${LWORD})\\s*/\\s*${LWORD}\\s*(?:қаласы|қ\\.|ауданы|аудан\\.?)`, 'giu'),
    '$1',
  );

  // <kk> қаласы/<ru>
  s = s.replace(
    new RegExp(`${LWORD}\\s*(?:қаласы|қ\\.)\\s*/\\s*(${LWORD})`, 'giu'),
    '$1',
  );

  // Общий случай: если одна половина содержит казахские буквы, а другая нет —
  // оставляем «русскую» половину.
  s = s.replace(
    new RegExp(`(${LWORD})\\s*/\\s*(${LWORD})`, 'gu'),
    (whole, a, b) => {
      const aKz = KZ_ONLY_RE.test(a);
      const bKz = KZ_ONLY_RE.test(b);
      if (aKz && !bKz) return b;
      if (bKz && !aKz) return a;
      return a;
    },
  );

  return s;
}
