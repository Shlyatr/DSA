// Разбор произвольной адресной строки (RU/KZ) на поля.
//
// Конвейер:
//   1. normalize()   — невидимые символы, пробелы, «Актобе/Ақтөбе қаласы» -> «Актобе»
//   2. tokenize()    — слова / числа / разделители; помним, был ли номер приклеен к слову
//   3. ориентир      — «магазин береке», «Qazpost Солнечный»
//   4. детали        — квартира / подъезд / этаж / дом (с учётом порядка «5 подъезд» / «подъезд 5»)
//   5. улица         — по маркеру типа (ул, пр, мкр, квартал, ЖК, көшесі ...)
//   6. админ-единицы — область, район, город/посёлок
//   7. остатки       — улица без типа («Туран 55/6»), голый номер дома, город без маркера
//   8. справочник    — район / область / тип улицы, которых нет в строке
//
// Правило из ТЗ: название улицы возвращается «ровно как в строке»
// (падеж не меняем, опечатки не исправляем).

import { normalize } from './normalize.js';
import refs from './dictionary.js';
import {
  canonicalCity,
  canonicalProvinceStem,
  CITY_MAP,
  REPUBLICAN_CITIES,
} from './lexicon.js';

// ------------------------------------------------------------------ настройки

// В ТЗ street_name — «название без типа». Для «66квартал» это «66».
// Если нужно «66 квартал» (числовое название + тип) — поставьте true.
export const KEEP_TYPE_FOR_NUMERIC_NAME = false;

// ------------------------------------------------------------------ таблицы маркеров

const APT = ['кв', 'квартира', 'квартиры', 'квартире', 'kv', 'kvartira', 'kvart', 'flat', 'apt', 'apartment', 'пәтер', 'патер'];
const ENT = ['подъезд', 'подьезд', 'подезд', 'подъезда', 'подьезда', 'подъезде', 'под', 'pod', 'podyezd', 'podezd', 'podjezd', 'entrance', 'ent', 'кіріс'];
const FLR = ['этаж', 'этажа', 'этажей', 'этаже', 'эт', 'floor', 'fl', 'etazh', 'etaj', 'et', 'қабат', 'qabat', 'kabat'];
const HOUSE = ['дом', 'дома', 'д', 'dom', 'house', 'home', 'үй', 'уй'];

const DETAIL = new Map();
for (const w of APT) DETAIL.set(w, 'apt');
for (const w of ENT) DETAIL.set(w, 'ent');
for (const w of FLR) DETAIL.set(w, 'flr');
for (const w of HOUSE) DETAIL.set(w, 'house');
const DETAIL_FIELDS = ['apt', 'ent', 'flr', 'house'];

// Типы улиц: слово -> { type, family, kk }
//   family: street | micro | living;   kk: название обычно стоит ПЕРЕД маркером («Абай даңғылы»)
const STREET_WORDS = new Map();
function defType(type, family, words, kk = false) {
  for (const w of words) STREET_WORDS.set(w, { type, family, kk });
}
defType('улица', 'street', ['улица', 'улицы', 'ул', 'ulica', 'ul', 'street', 'str']);
defType('улица', 'street', ['көше', 'көшесі'], true);
defType('проспект', 'street', ['проспект', 'проспекты', 'просп', 'пр', 'пр-т', 'пр-кт', 'prospekt', 'pr', 'avenue', 'ave']);
defType('проспект', 'street', ['даңғыл', 'даңғылы', 'жол', 'жолы'], true);
defType('переулок', 'street', ['переулок', 'переул', 'пер', 'lane']);
defType('проезд', 'street', ['проезд', 'пр-д']);
defType('тупик', 'street', ['тупик', 'туп']);
defType('бульвар', 'street', ['бульвар', 'бул', 'б-р', 'boulevard', 'blvd']);
defType('шоссе', 'street', ['шоссе']);
defType('площадь', 'street', ['площадь', 'пл']);
defType('набережная', 'street', ['набережная', 'наб']);
defType('аллея', 'street', ['аллея']);
defType('микрорайон', 'micro', ['микрорайон', 'микрорайона', 'микрор', 'микр', 'мкр', 'мкрн', 'мкр-н', 'м-н', 'mkr', 'microdistrict']);
defType('квартал', 'micro', ['квартал', 'квартала', 'кв-л', 'квл', 'кварт']);
defType('жилой комплекс', 'living', ['жк', 'жилкомплекс']);
defType('массив', 'living', ['массив', 'жилмассив']);

const PROV_WORDS = new Set(['область', 'области', 'обл', 'облысы', 'облыс', 'облысының']);
const DIST_WORDS = new Set(['район', 'района', 'районе', 'р-н', 'р-он', 'рн', 'ауданы', 'аудан', 'ауданының']);
const CITY_WORDS = new Set(['город', 'г', 'гор', 'city', 'қаласы', 'қала', 'қ', 'qalasy', 'qala']);
const SETTLE_WORDS = new Set(['пос', 'поселок', 'посёлок', 'пгт', 'село', 'с', 'ауыл', 'ауылы', 'деревня', 'дер', 'кент', 'кенті']);
// слова, после которых название стоит ПЕРЕД ними: «Алматы қаласы», «Боралдай ауылы»
const KK_AFTER = new Set(['қаласы', 'қала', 'қ', 'qalasy', 'qala', 'ауылы', 'кенті']);

// Ориентиры. «Сильные» входят в текст ориентира, «слабые» только вводят его.
const LM_STRONG = new Set([
  'магазин', 'магаз', 'маг', 'супермаркет', 'маркет', 'минимаркет', 'трц', 'трк', 'тц', 'бц', 'цон',
  'аптека', 'больница', 'поликлиника', 'школа', 'гимназия', 'лицей', 'садик', 'детсад',
  'рынок', 'базар', 'остановка', 'ост', 'вокзал', 'автовокзал', 'аэропорт', 'стадион', 'парк', 'сквер',
  'кафе', 'ресторан', 'столовая', 'мечеть', 'церковь', 'каспи', 'kaspi', 'qazpost', 'kazpost',
  'почтамат', 'постамат', 'локер', 'молл', 'mall', 'plaza',
]);
const LM_WEAK = new Set(['ориентир', 'орентир', 'рядом', 'возле', 'напротив', 'около', 'near']);

// ------------------------------------------------------------------ токенайзер

// группы: 1 разделитель | 2 число (дробь/литера) | 3 слово | 4 точка | 5 пробелы/пунктуация | 6 прочее
const TOKEN_RE = /([,;()|\n]+)|(\d+(?:\s*[/\\]\s*\d+)*(?:-?\p{L}(?![\p{L}\d]))?)|(\p{L}[\p{L}'’]*(?:-[\p{L}\d]+)*)|(\.)|([\s«»"“”'`№#:!?*+=_~<>[\]{}\\/-]+)|(.)/gu;

function mk(k, v, glued) {
  return { k, v, lo: v.toLowerCase(), glued, used: false, m: null };
}

function tokenize(text) {
  const tokens = [];
  let lastEnd = -1;
  let m;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(text)) !== null) {
    const end = m.index + m[0].length;
    if (m[1]) {
      tokens.push(mk('s', ',', false));
      lastEnd = -1;
    } else if (m[2]) {
      tokens.push(mk('n', m[2].replace(/\s+/g, '').replace('\\', '/'), m.index === lastEnd));
      lastEnd = end;
    } else if (m[3]) {
      // «кв-5», «дом-12» -> маркер + число
      const split = /^(\p{L}+)-(\d+\p{L}?)$/u.exec(m[3]);
      if (split && DETAIL.has(split[1].toLowerCase())) {
        tokens.push(mk('w', split[1], m.index === lastEnd));
        tokens.push(mk('n', split[2], false));
      } else {
        tokens.push(mk('w', m[3], m.index === lastEnd));
      }
      lastEnd = end;
    } else if (m[4]) {
      lastEnd = end; // точка не разрывает «склейку»: «кв.5», «ул.Абая»
    } else {
      lastEnd = -1;
    }
  }
  return tokens;
}

// ------------------------------------------------------------------ классификация слов

function classifyAll(tokens) {
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.k !== 'w') continue;
    const lo = t.lo;
    const next = tokens[i + 1];
    const prev = tokens[i - 1];

    // двусловные маркеры
    if (lo === 'жилой' && next && next.k === 'w' && (next.lo === 'комплекс' || next.lo === 'массив')) {
      t.m = { c: 'street', end: i + 1, ...STREET_WORDS.get(next.lo === 'комплекс' ? 'жк' : 'массив') };
      next.used = true;
      continue;
    }
    if ((lo === 'шағын' || lo === 'ықшам') && next && next.k === 'w' && next.lo === 'аудан') {
      t.m = { c: 'street', end: i + 1, ...STREET_WORDS.get('мкр') };
      next.used = true;
      continue;
    }

    if (DETAIL.has(lo)) {
      const hasNum = (next && next.k === 'n') || (prev && prev.k === 'n');
      // короткие слова («д», «под», «эт») — маркер только рядом с числом
      if (hasNum || ['кв', 'квартира', 'подъезд', 'подьезд', 'этаж'].includes(lo)) t.m = { c: DETAIL.get(lo) };
      continue;
    }
    if (STREET_WORDS.has(lo)) { t.m = { c: 'street', ...STREET_WORDS.get(lo) }; continue; }
    if (LM_STRONG.has(lo)) { t.m = { c: 'lm', weak: false }; continue; }
    if (LM_WEAK.has(lo)) { t.m = { c: 'lm', weak: true }; continue; }
    if (PROV_WORDS.has(lo)) { t.m = { c: 'prov' }; continue; }
    if (DIST_WORDS.has(lo)) { t.m = { c: 'dist' }; continue; }
    if (SETTLE_WORDS.has(lo)) {
      if (lo === 'с' && !(next && next.k === 'w')) continue; // «с» — только перед словом
      t.m = { c: 'settle', kkAfter: KK_AFTER.has(lo) };
      continue;
    }
    if (CITY_WORDS.has(lo)) { t.m = { c: 'city', kkAfter: KK_AFTER.has(lo) }; continue; }
  }
}

// ------------------------------------------------------------------ помощники по токенам

const isFreeNum = (tk, i) => !!tk[i] && tk[i].k === 'n' && !tk[i].used;
const isNameWord = (tk, i) => !!tk[i] && tk[i].k === 'w' && !tk[i].used && !tk[i].m;

function wordsAfter(tk, i, max) {
  const words = [];
  let j = (tk[i].m && tk[i].m.end ? tk[i].m.end : i) + 1; // у двусловных маркеров («жилой комплекс») пропускаем второе слово
  // «ул. им. Абая»
  while (tk[j] && tk[j].k === 'w' && !tk[j].used && (tk[j].lo === 'им' || tk[j].lo === 'имени')) j++;
  while (words.length < max && isNameWord(tk, j)) { words.push(j); j++; }
  return words;
}

function wordsBefore(tk, i, max) {
  const words = [];
  let j = i - 1;
  while (words.length < max && isNameWord(tk, j)) { words.unshift(j); j--; }
  return words;
}

const txt = (tk, idxs) => idxs.map((i) => tk[i].v).join(' ');
const use = (tk, idxs) => idxs.forEach((i) => { tk[i].used = true; });

// ------------------------------------------------------------------ публичный API

export function parseAddress(record) {
  return parseAddressDetailed(record).result;
}

export function parseAddressBatch(records) {
  if (!Array.isArray(records)) return [parseAddress(records)];
  return records.map((r) => parseAddress(r));
}

// Возвращает { result, meta }. meta.sources объясняет, откуда взято поле,
// которого не было в строке (для экрана проверки и защиты).
export function parseAddressDetailed(record) {
  let id = 'rec_00000';
  let rawAddress = '';
  if (typeof record === 'string') {
    rawAddress = record;
  } else if (record && typeof record === 'object') {
    id = record.id ?? id;
    rawAddress = record.raw_address ?? record.address ?? '';
  }
  rawAddress = String(rawAddress ?? '');

  const meta = { sources: {} };
  const text = normalize(rawAddress);
  const tokens = tokenize(text);
  if (!tokens.some((t) => t.k === 'w' || t.k === 'n')) {
    return { result: emptyResponse(id, rawAddress), meta };
  }
  classifyAll(tokens);

  // ---- 3. ориентир ---------------------------------------------------------
  let landmark = null;
  for (let i = 0; i < tokens.length && !landmark; i++) {
    const t = tokens[i];
    if (t.used || !t.m || t.m.c !== 'lm') continue;
    let j = i + 1;
    // «рядом с», «около»
    if (t.m.weak && tokens[j] && tokens[j].k === 'w' && (tokens[j].lo === 'с' || tokens[j].lo === 'со')) {
      tokens[j].used = true;
      j++;
    }
    const idxs = t.m.weak ? [] : [i];
    let count = 0;
    while (count < 2 && tokens[j] && tokens[j].k === 'w' && !tokens[j].used) {
      const nt = tokens[j];
      if (nt.m && !(nt.m.c === 'lm' && !nt.m.weak && count === 0 && t.m.weak)) break; // другой маркер — ориентир закончился
      idxs.push(j);
      j++;
      count++;
    }
    t.used = true;
    if (!idxs.length) continue;
    landmark = txt(tokens, idxs);
    use(tokens, idxs);
  }

  // ---- 4. квартира / подъезд / этаж / дом -----------------------------------
  const detail = { apt: null, ent: null, flr: null, house: null };
  const detailIdx = [];
  tokens.forEach((t, i) => {
    if (t.k === 'w' && !t.used && t.m && DETAIL_FIELDS.includes(t.m.c)) detailIdx.push(i);
  });

  // Стиль записи: «4подьезд 9этаж», «5 подъезд 239 кв» (число перед маркером)
  // или «подъезд 3, этаж 5, кв 78» (число после маркера).
  let before = 0;
  let after = 0;
  for (const i of detailIdx) {
    if (tokens[i].glued && tokens[i - 1] && tokens[i - 1].k === 'n') before++;
    if (tokens[i + 1] && tokens[i + 1].k === 'n' && tokens[i + 1].glued) after++;
  }
  let style = 'after';
  if (before > after) {
    style = 'before';
  } else if (before === after) {
    // маркер в конце без числа после него («239 кв») — тоже признак «число перед маркером»
    for (const i of detailIdx) {
      if (tokens[i].m.c === 'house') continue;
      const hasNext = tokens[i + 1] && tokens[i + 1].k === 'n';
      const hasPrev = tokens[i - 1] && tokens[i - 1].k === 'n';
      if (!hasNext && hasPrev) { style = 'before'; break; }
    }
  }

  const assign = (i, numIdx) => {
    const field = tokens[i].m.c;
    if (detail[field] !== null) return;
    detail[field] = tokens[numIdx].v;
    tokens[numIdx].used = true;
    tokens[i].used = true;
  };

  // проход 1: число приклеено к маркеру спереди («12дом», «4подьезд»)
  for (const i of detailIdx) {
    if (tokens[i].glued && isFreeNum(tokens, i - 1)) assign(i, i - 1);
  }
  // проход 2: остальные
  for (const i of detailIdx) {
    if (tokens[i].used) continue;
    const prevOk = isFreeNum(tokens, i - 1);
    const nextOk = isFreeNum(tokens, i + 1);
    const later = tokens[i + 2];
    const nextBelongsToLater = nextOk && later && later.k === 'w' && later.glued && later.m && DETAIL_FIELDS.includes(later.m.c);
    const afterOk = nextOk && !nextBelongsToLater;

    let dir = nextOk && tokens[i + 1].glued ? 'after' : style; // «кв5»
    if (dir === 'after' && !afterOk) dir = prevOk ? 'before' : null;
    else if (dir === 'before' && !prevOk) dir = afterOk ? 'after' : null;

    if (dir === 'after') assign(i, i + 1);
    else if (dir === 'before') assign(i, i - 1);
  }
  // маркеры без числа выбрасываем, чтобы не попали в названия
  for (const i of detailIdx) tokens[i].used = true;

  // ---- 5. улица / микрорайон / ЖК ---------------------------------------------
  let street = null;      // { type, name }
  let micro = null;
  let living = null;
  let streetHouse = null; // номер сразу после названия улицы с явным типом
  let microHouse = null;

  const otherFreeNumbers = (exceptIdx) => tokens.some((t, i) => i !== exceptIdx && t.k === 'n' && !t.used);

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.used || !t.m || t.m.c !== 'street') continue;
    const info = t.m;

    if (info.family === 'street') {
      if (street) { t.used = true; continue; }
      let idxs = info.kk ? wordsBefore(tokens, i, 3) : wordsAfter(tokens, i, 4);
      if (!idxs.length) idxs = info.kk ? wordsAfter(tokens, i, 4) : wordsBefore(tokens, i, 3);
      if (!idxs.length) { t.used = true; continue; }
      street = { type: info.type, name: txt(tokens, idxs) };
      use(tokens, [i, ...idxs]);
      const last = Math.max(i, t.m.end || i, ...idxs);
      if (detail.house === null && isFreeNum(tokens, last + 1)) {
        streetHouse = tokens[last + 1].v;
        tokens[last + 1].used = true;
      }
      continue;
    }

    // micro / living
    let name = null;
    let used = [i];
    let trailingHouse = null;

    if (info.family === 'micro' && isFreeNum(tokens, i - 1)) {
      // «Нурсити 2 микрорайон», «66 квартал»
      const pre = wordsBefore(tokens, i - 1, 2);
      name = txt(tokens, [...pre, i - 1]);
      used = [i, ...pre, i - 1];
    } else {
      const idxs = wordsAfter(tokens, i, 4);
      if (idxs.length) {
        const last = idxs[idxs.length - 1];
        name = txt(tokens, idxs);
        used = [i, ...idxs];
        if (isFreeNum(tokens, last + 1)) {
          const numIdx = last + 1;
          // «Айнабулак 4, дом 12» — число часть названия; «Аксай За 59» — это номер дома
          if (detail.house !== null || otherFreeNumbers(numIdx)) {
            name += ` ${tokens[numIdx].v}`;
          } else {
            trailingHouse = tokens[numIdx].v;
          }
          used.push(numIdx);
        }
      } else if (info.family === 'micro' && isFreeNum(tokens, i + 1)) {
        // «квартал 5», «мкр 12»
        name = tokens[i + 1].v;
        used = [i, i + 1];
      } else {
        const bef = wordsBefore(tokens, i, 3);
        if (bef.length) {
          name = txt(tokens, bef);
          used = [i, ...bef];
        }
      }
    }
    if (name === null) { t.used = true; continue; }
    use(tokens, used);
    const cand = { type: info.type, name };
    if (info.family === 'living') { if (!living) living = cand; }
    else if (!micro) micro = cand;
    if (trailingHouse && microHouse === null) microHouse = trailingHouse;
  }

  // ---- 6. область / район / город ---------------------------------------------
  let province = null;
  let district = null;
  let city = null;
  let citySpecific = false; // город взят по маркеру «пос./с.» — приоритетнее «город X»

  const knownCity = (name) => canonicalCity(name) || (refs.isCity(name) ? name : null);

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.used || !t.m) continue;
    const c = t.m.c;

    if (c === 'prov') {
      let idx = wordsBefore(tokens, i, 1);
      if (!idx.length) idx = wordsAfter(tokens, i, 1);
      t.used = true;
      if (!idx.length) continue;
      const name = tokens[idx[0]].v;
      use(tokens, idx);
      if (!province) province = `${canonicalProvinceStem(name) || name} область`;
    } else if (c === 'dist') {
      let idx = wordsBefore(tokens, i, 1);
      if (!idx.length) idx = wordsAfter(tokens, i, 1);
      t.used = true;
      if (!idx.length) continue;
      if (!district) district = tokens[idx[0]].v;
      use(tokens, idx);
    } else if (c === 'city' || c === 'settle') {
      const aft = wordsAfter(tokens, i, 2);
      const bef = wordsBefore(tokens, i, 1);
      const candidates = [];
      const addAfter = () => {
        if (!aft.length) return;
        if (aft.length === 2 && knownCity(txt(tokens, aft))) candidates.push(aft);
        else candidates.push([aft[0]]);
      };
      if (t.m.kkAfter) { if (bef.length) candidates.push(bef); addAfter(); }
      else { addAfter(); if (bef.length) candidates.push(bef); }
      t.used = true;
      if (!candidates.length) continue;
      // предпочитаем кандидата, который известен справочнику
      const pick = candidates.find((idx) => knownCity(txt(tokens, idx))) || candidates[0];
      const name = txt(tokens, pick);
      use(tokens, pick);
      const canon = canonicalCity(name) || name;
      if (c === 'settle') {
        if (!citySpecific) { city = canon; citySpecific = true; }
      } else if (!city) {
        city = canon;
      }
    }
  }

  // ---- 7. остатки -----------------------------------------------------------------
  tokens.forEach((t) => { if (t.m && !t.used && t.k === 'w') t.used = true; }); // маркеры без пары

  const runs = [];
  let cur = [];
  tokens.forEach((t, i) => {
    if (t.used || t.k === 's') {
      if (cur.length) runs.push(cur);
      cur = [];
    } else {
      cur.push(i);
    }
  });
  if (cur.length) runs.push(cur);

  let untyped = null; // { name, wordsOnly }
  let runHouse = null;
  let bareHouse = null;
  const wordOnlyRuns = [];

  const setCity = (name) => {
    if (!city) city = canonicalCity(name) || name;
  };

  for (let run of runs) {
    // курируемый город в начале строки без маркера: «Алматы Абая 12»
    const lead = [];
    for (const i of run) { if (tokens[i].k === 'w') lead.push(i); else break; }
    if (lead.length >= 2) {
      const two = txt(tokens, lead.slice(0, 2));
      const one = tokens[lead[0]].v;
      if (lead.length > 2 && canonicalCity(two)) {
        setCity(two);
        run = run.slice(2);
      } else if (CITY_MAP.has(one.toLowerCase())) {
        setCity(one);
        run = run.slice(1);
      }
    }
    if (!run.length) continue;

    const words = run.filter((i) => tokens[i].k === 'w');
    const nums = run.filter((i) => tokens[i].k === 'n');

    if (nums.length === 0) {
      const text = txt(tokens, words);
      if (canonicalCity(text)) { setCity(text); continue; }
      if (!district && refs.districtAlias(text)) { district = text; continue; }
      wordOnlyRuns.push(words);
      continue;
    }

    if (tokens[run[0]].k === 'n') {
      // начинается с числа: голый номер дома («, 59,»); «1/2 Nauryzbay batyr 55» — мусор
      if (words.length === 0 && bareHouse === null) bareHouse = tokens[run[0]].v;
      continue;
    }

    // слова, затем число: «Туран 55/6», «Назарбаева 8»
    const nameIdx = [];
    for (const i of run) { if (tokens[i].k === 'w') nameIdx.push(i); else break; }
    const numIdx = run[nameIdx.length];
    if (!untyped) {
      untyped = { name: txt(tokens, nameIdx) };
      runHouse = tokens[numIdx].v;
    }
  }

  // слова без чисел: либо город (крупный населённый пункт), либо название улицы
  const hasContent = !!(street || untyped || micro || living || detail.house || runHouse || bareHouse || microHouse || streetHouse);
  for (const words of wordOnlyRuns) {
    const text = txt(tokens, words);
    const info = refs.isCity(text);
    if (info && (info.kind === 'city' || info.kind === 'town') && hasContent && !city) {
      city = text;
      continue;
    }
    if (!street && !untyped && !micro && !living) untyped = { name: text, wordsOnly: true };
  }

  // ---- сборка улицы / жилого массива ----------------------------------------------
  let streetType = null;
  let streetName = null;
  let livingArea = null;
  let streetIsMicro = false;

  const separateStreet = street || untyped;
  if (separateStreet) {
    streetType = street ? street.type : null;
    streetName = separateStreet.name;
    livingArea = (living && living.name) || (micro && micro.name) || null;
  } else if (micro) {
    streetType = micro.type;
    streetName = micro.name;
    streetIsMicro = true;
    livingArea = (living && living.name) || null;
  } else {
    livingArea = (living && living.name) || null;
  }
  if (KEEP_TYPE_FOR_NUMERIC_NAME && streetIsMicro && /^\d+$/.test(streetName || '')) {
    streetName = `${streetName} ${streetType}`;
  }

  // ---- дом ----------------------------------------------------------------------------
  const house = detail.house ?? streetHouse ?? microHouse ?? runHouse ?? bareHouse ?? null;

  // ---- 8. справочник ------------------------------------------------------------------
  const cityCanon = city ? canonicalCity(city) || city : null;

  // область
  if (!province && cityCanon) {
    if (REPUBLICAN_CITIES.has(cityCanon)) {
      province = cityCanon;
      meta.sources.province = 'city';
    } else {
      const row = CITY_MAP.get(cityCanon.toLowerCase());
      if (row) {
        province = row.province;
        meta.sources.province = 'lexicon';
      } else {
        const info = refs.cityInfo(cityCanon);
        if (info.province) {
          province = info.province;
          meta.sources.province = 'reference:city';
        }
      }
    }
  }

  // район: из строки, иначе из справочника
  // Чисто числовое название («66» из «66квартал») без города в справочнике не ищем:
  // совпадение с какой-нибудь улицей «66» в другом конце страны ничего не значит.
  const numericOnly = /^\d+[а-яa-z]?$/i.test(streetName || '');
  const refStreet = streetName && (cityCanon || !numericOnly)
    ? refs.findStreet(streetName, { city: cityCanon, type: streetType })
    : null;
  const streetKnown = !!(refStreet && refStreet.candidates > 0);

  if (district) {
    meta.sources.district = 'string';
  } else {
    let found = null;
    if (refStreet && refStreet.district) {
      found = { value: refStreet.district, src: `reference:street(${refStreet.status})` };
    }
    if (!found && livingArea) {
      const r = refs.findLiving(livingArea, { city: cityCanon });
      if (r.district) found = { value: r.district, src: `reference:living_area(${r.status})` };
    }
    if (!found && streetIsMicro && streetName) {
      const r = refs.findLiving(streetName, { city: cityCanon });
      if (r.district) found = { value: r.district, src: `reference:living_area(${r.status})` };
    }
    if (!found && cityCanon && !REPUBLICAN_CITIES.has(cityCanon)) {
      const info = refs.cityInfo(cityCanon);
      if (info.district) found = { value: info.district, src: 'reference:city' };
    }
    if (found) {
      district = found.value;
      meta.sources.district = found.src;
    }
  }

  // тип улицы, если в строке не указан: только когда город известен и справочник однозначен
  if (!streetType && streetName && cityCanon && refStreet && refStreet.streetType) {
    streetType = refStreet.streetType;
    meta.sources.street_type = 'reference:street';
  }

  // ---- уверенность ---------------------------------------------------------------------
  let confidence = 0.15;
  if (cityCanon) confidence += 0.2;
  if (province) confidence += 0.05;
  if (streetName) {
    confidence += 0.25;
    if (street || streetIsMicro) confidence += 0.05;
    if (streetKnown) confidence += 0.1;
    if (separateStreet && separateStreet.wordsOnly) confidence -= 0.1;
  }
  if (house) confidence += 0.15;
  if (streetName && house) confidence += 0.05;
  if (detail.apt || detail.ent || detail.flr) confidence += 0.05;
  if (!streetName && !house && !cityCanon && !livingArea) confidence = 0.05;
  confidence = Math.max(0, Math.min(0.99, confidence));

  const result = {
    id,
    raw_address: rawAddress,
    province,
    city: cityCanon,
    district,
    living_area: livingArea,
    street_type: streetType,
    street_name: streetName,
    house,
    apartment: detail.apt,
    entrance: detail.ent,
    floor: detail.flr,
    landmark,
    confidence: Number(confidence.toFixed(2)),
  };
  return { result, meta };
}

function emptyResponse(id, rawAddress) {
  return {
    id,
    raw_address: rawAddress,
    province: null,
    city: null,
    district: null,
    living_area: null,
    street_type: null,
    street_name: null,
    house: null,
    apartment: null,
    entrance: null,
    floor: null,
    landmark: null,
    confidence: 0,
  };
}
