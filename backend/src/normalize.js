// Нормализация входной строки: невидимые символы, пробелы, двуязычные склейки через «/».
// Склейки «66квартал», «Назарбаева8», «4подьезд» разбирает токенайзер в parser.js —
// там известно, был ли номер приклеен к слову, и это важно для разбора.

import { LWORD, KZ_ONLY } from './lexicon.js';

const KZ_ONLY_RE = new RegExp(`[${KZ_ONLY}]`, 'i');

// Нулевой ширины, мягкий перенос, управляющие символы направления текста и т.п.
const INVISIBLE = /[\u00AD\u200B-\u200F\u2028\u2029\u202A-\u202E\u2060\uFEFF\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const EXOTIC_SPACES = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000\t\r]/g;

export function normalize(str) {
  if (!str) return '';
  let text = String(str).normalize('NFC');
  text = text.replace(EXOTIC_SPACES, ' ').replace(INVISIBLE, '');
  text = resolveBilingual(text);
  return text.replace(/[ ]{2,}/g, ' ').trim();
}

// «город Актобе/Ақтөбе қаласы» -> «город Актобе».
// Если одна половина содержит казахские буквы, а другая нет — остаётся русская.
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

  // Общий случай «слово/слово».
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
