// Нормализация входной строки и обработка двуязычных склеек через «/».

import { TYPO_FIXES, LWORD, KZ_ONLY } from './lexicon.js';

const INVISIBLE = /[\u00A0\u00AD\u200B-\u200F\u2028\u2029\u202A-\u202E\u2060\uFEFF]/g;
const KZ_ONLY_RE = new RegExp(`[${KZ_ONLY}]`, 'i');

export function normalize(str) {
  if (!str) return '';
  let text = String(str);

  // 1. Исправление частых опечаток буквы 'З' вместо цифры '3' в блоках/микрорайонах
  text = text.replace(/\b([а-яА-Яa-zA-Z]+)\s+З([а-яА-Яa-zA-Z]?)\b/g, '$1 3$2');

  // 2. Список ключевых слов для разделения склеек
  const keywords = 'дом|house|home|flat|apt|apartment|kv|kvartira|pater|podyezd|pod|entrance|etazh|et|qabat|kabat|street|st|ulica|ul|квартира|кв|этаж|эт|подъезд|подьезд|под|қабат|пәтер|үй|квартал|кв-л|микрорайон|мкр|улица|ул|область|облысы|район|ауданы|көшесі';

  // Число + ключевое слово (например: 66квартал -> 66 квартал, 12дом -> 12 дом)
  const numKeywordRegex = new RegExp(`(\\d+)(${keywords})\\b`, 'gi');
  text = text.replace(numKeywordRegex, '$1 $2');

  // Ключевое слово + число (например: dom10 -> dom 10, flat12 -> flat 12)
  const keywordNumRegex = new RegExp(`\\b(${keywords})(\\d+)`, 'gi');
  text = text.replace(keywordNumRegex, '$1 $2');

  // Слово + цифра на конце (например: Назарбаева8 -> Назарбаева 8)
  text = text.replace(/\b([a-zA-Zа-яА-ЯӘөүңғқұһӨҮҢҒҚҰҺ]{3,})(\d+)\b/g, '$1 $2');

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
