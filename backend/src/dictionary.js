// Справочник: индексы поверх data/reference/*.json (OSM-дамп по Казахстану).
//
// Что умеет:
//   findStreet()   — улица (+ город) -> район / область / тип улицы
//   findLiving()   — микрорайон / ЖК (+ город) -> район / область
//   cityInfo()     — населённый пункт -> область / район (по большинству голосов)
//   isCity()       — слово -> известный город/посёлок
//   districtAlias()— слово -> каноническое русское название района
//
// Все сравнения идут через fold(): нижний регистр, ё=е, казахские буквы -> русские,
// пунктуация -> пробел. Так «Қызылорда» == «Кызылорда», «Әуезов» == «Ауэзов»-подобные формы.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalCity, REPUBLICAN_CITIES } from './lexicon.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REF_DIR = process.env.REF_DIR || path.join(__dirname, '../data/reference');

function loadJson(name) {
  const file = path.join(REF_DIR, name);
  if (!fs.existsSync(file)) {
    console.warn(`[dictionary] справочник ${name} не найден — работаем без него`);
    return [];
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// ---------------------------------------------------------------- нормализация ключей

const KZ2RU = { ә: 'а', ғ: 'г', қ: 'к', ң: 'н', ө: 'о', ү: 'у', ұ: 'у', һ: 'х', і: 'и', ё: 'е' };

export function fold(s) {
  if (!s) return '';
  return String(s)
    .toLowerCase()
    .replace(/[әғқңөүұһіё]/g, (c) => KZ2RU[c])
    .replace(/[^\p{L}\d]+/gu, ' ')
    .trim();
}

// Служебные слова типов улиц — вырезаются из названий справочника, чтобы
// «улица Абая», «Абая көшесі» и «Абая» давали один ключ.
const TYPE_WORDS = new Set(
  [
    'улица', 'ул', 'улицы', 'проспект', 'пр', 'просп', 'переулок', 'пер', 'проезд', 'тупик',
    'бульвар', 'шоссе', 'набережная', 'площадь', 'аллея', 'көше', 'көшесі', 'даңғыл', 'даңғылы',
    'жолы', 'микрорайон', 'мкр', 'ықшам', 'шағын', 'аудан', 'ауданы', 'ауылы', 'ауыл',
    'жк', 'жилой', 'комплекс', 'массив', 'жилмассив', 'street', 'avenue',
  ].map(fold),
);

export function coreKey(name) {
  const tokens = fold(name).split(' ').filter((t) => t && !TYPE_WORDS.has(t));
  return tokens.join(' ');
}

// ---------------------------------------------------------------- районы: каз -> рус

const DISTRICT_OVERRIDES = new Map(
  Object.entries({
    іле: 'Илийский',
    // Астана
    алматы: 'Алматинский', есіл: 'Есильский', сарыарқа: 'Сарыаркинский',
    байқоңыр: 'Байконурский', нұра: 'Нуринский',
    // Шымкент
    'әл-фараби': 'Аль-Фарабийский', қаратау: 'Каратауский', абай: 'Абайский',
    еңбекші: 'Енбекшинский', тұран: 'Туранский',
    // Алматы и область
    түрксіб: 'Турксибский', қарасай: 'Карасайский', талғар: 'Талгарский',
  }).map(([k, v]) => [fold(k), v]),
);

// Эти «районы» в OSM — на самом деле администрации городов, районом не являются.
const CITY_ADMIN_RE = /(қалалық\s+әкімдігі|қаласының\s+әкімшілігі|қ\.?\s?ә\.?|қаласы)\s*$/i;

function translit(s) {
  return s.replace(/[әғқңөүұһі]/gi, (c) => {
    const low = c.toLowerCase();
    const r = KZ2RU[low];
    return c === low ? r : r.toUpperCase();
  });
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// «Қарасай ауданы» -> «Карасайский». Эвристика для районов без name_ru в справочнике.
function generateDistrictRu(kk) {
  if (!kk) return null;
  if (CITY_ADMIN_RE.test(kk.trim())) return null;
  const stem = kk.replace(/\s+(ауданы|аудан[іы]?)\s*$/i, '').trim();
  if (!stem) return null;
  const ov = DISTRICT_OVERRIDES.get(fold(stem));
  if (ov) return ov;
  const ru = cap(translit(stem.toLowerCase()));
  if (/ский$|цкий$/.test(ru)) return ru;
  if (/л$/.test(ru)) return `${ru}ьский`;
  if (/[ая]$/.test(ru)) return `${ru.slice(0, -1)}инский`;
  if (/[еиыоуэю]$/.test(ru)) return `${ru}йский`;
  return `${ru}ский`;
}

// ---------------------------------------------------------------- класс справочника

class Dictionary {
  constructor() {
    this.isLoaded = false;
    this.streetIdx = new Map();    // coreKey -> [{c, d, p, t, w}]
    this.livingIdx = new Map();    // coreKey -> [{c, d, p}]
    this.cityRegion = new Map();   // fold(city) -> Map(region -> n)
    this.cityDistrict = new Map(); // fold(city) -> Map(district -> n)
    this.cityIdx = new Map();      // fold(name|alias) -> {name, kind, population}
    this.districtIdx = new Map();  // fold(stem) -> русское название
    this.kkDistrictRu = new Map(); // fold(name_kk) -> name_ru (из districts.json)
    this.regionKkToRu = new Map();
    this.stats = {};
  }

  load() {
    if (this.isLoaded) return;
    const t0 = Date.now();

    const regions = loadJson('regions.json');
    const districts = loadJson('districts.json');
    const cities = loadJson('cities.json');
    const living = loadJson('living_areas.json');
    const streets = loadJson('streets.json');

    for (const r of regions) {
      if (r.name_kk && r.name_ru) this.regionKkToRu.set(fold(r.name_kk), r.name_ru);
    }

    for (const d of districts) {
      const stem = (d.name_kk || '').replace(/\s+(ауданы|аудан)\s*$/i, '');
      const ru = d.name_ru || generateDistrictRu(d.name_kk);
      if (d.name_ru) this.kkDistrictRu.set(fold(d.name_kk), d.name_ru);
      if (ru && stem) {
        this.districtIdx.set(fold(stem), ru);
        this.districtIdx.set(fold(ru), ru);
        this.districtIdx.set(fold(ru.replace(/(ский|цкий|ий)$/, '')), ru);
      }
    }

    for (const c of cities) {
      const names = [c.name, ...(c.aliases || [])];
      for (const n of names) {
        const k = fold(n);
        if (!k) continue;
        const prev = this.cityIdx.get(k);
        if (!prev || (c.population || 0) > (prev.population || 0)) {
          this.cityIdx.set(k, { name: c.name, kind: c.kind, population: c.population || 0 });
        }
      }
    }

    const vote = (map, key, val) => {
      if (!key || !val) return;
      let m = map.get(key);
      if (!m) map.set(key, (m = new Map()));
      m.set(val, (m.get(val) || 0) + 1);
    };

    for (const s of streets) {
      const key = coreKey(s.core || s.name);
      if (!key) continue;
      const cf = fold(canonicalCity(s.city) || s.city);
      const d = s.district_ru || this.districtFromKk(s.district_kk);
      const p = s.region_ru || this.regionKkToRu.get(fold(s.region_kk)) || null;
      let arr = this.streetIdx.get(key);
      if (!arr) this.streetIdx.set(key, (arr = []));
      arr.push({ c: cf, d, p, t: s.stype || null, w: s.parts || 1 });
      if (cf) {
        vote(this.cityRegion, cf, p);
        vote(this.cityDistrict, cf, d);
      }
    }

    for (const l of living) {
      const key = coreKey(l.name);
      if (!key) continue;
      const cf = fold(canonicalCity(l.city) || l.city);
      const d = l.district_ru || this.districtFromKk(l.district_kk);
      const p = l.region_ru || this.regionKkToRu.get(fold(l.region_kk)) || null;
      let arr = this.livingIdx.get(key);
      if (!arr) this.livingIdx.set(key, (arr = []));
      arr.push({ c: cf, d, p });
      if (cf) {
        vote(this.cityRegion, cf, p);
        vote(this.cityDistrict, cf, d);
      }
    }

    this.stats = {
      streets: this.streetIdx.size,
      living: this.livingIdx.size,
      cities: this.cityIdx.size,
      districts: this.districtIdx.size,
      loadMs: Date.now() - t0,
    };
    this.isLoaded = true;
  }

  districtFromKk(kk) {
    if (!kk) return null;
    return this.kkDistrictRu.get(fold(kk)) || generateDistrictRu(kk);
  }

  // Результат голосования: значение, если оно доминирует (>= minShare), иначе null.
  static top(map, minShare = 0.6) {
    if (!map || !map.size) return null;
    let total = 0;
    let best = null;
    let bestN = 0;
    for (const [k, n] of map) {
      total += n;
      if (n > bestN) { best = k; bestN = n; }
    }
    return bestN / total >= minShare ? { value: best, share: bestN / total, n: total } : null;
  }

  // Слово -> известный населённый пункт.
  isCity(name) {
    return this.cityIdx.get(fold(name)) || null;
  }

  // Слово -> русское название района («Ауэзов», «Әуезов», «Ауэзовский» -> «Ауэзовский»).
  districtAlias(name) {
    return this.districtIdx.get(fold(name)) || null;
  }

  // Область по городу/посёлку (по большинству записей справочника).
  cityInfo(city) {
    const cf = fold(canonicalCity(city) || city);
    if (!cf) return { province: null, district: null };
    const prov = Dictionary.top(this.cityRegion.get(cf), 0.8);
    // Район по городу имеет смысл только для небольших пунктов: у Алматы/Астаны
    // записи размазаны по десяткам районов и доминирующего нет — вернётся null.
    const dist = Dictionary.top(this.cityDistrict.get(cf), 0.8);
    return {
      province: prov ? prov.value : null,
      district: dist ? dist.value : null,
    };
  }

  // Поиск улицы. coreName — название без типа, ровно как в строке.
  // Возвращает { district, province, streetType, status, candidates }.
  //   status: 'unique' | 'majority' | 'ambiguous' | 'none'
  findStreet(coreName, { city = null, type = null } = {}) {
    return this._find(this.streetIdx, coreName, city, type);
  }

  findLiving(name, { city = null } = {}) {
    return this._find(this.livingIdx, name, city, null);
  }

  _find(index, name, city, type) {
    const none = { district: null, province: null, streetType: null, status: 'none', candidates: 0 };
    const list = index.get(coreKey(name));
    if (!list || !list.length) return none;

    let pool = list;
    let guessed = false;
    if (city) {
      const cf = fold(canonicalCity(city) || city);
      pool = list.filter((r) => r.c === cf);
      if (!pool.length) return none;
    } else {
      // Города в строке нет. Если улица встречается только в одном городе — берём его.
      // Если в нескольких — выбираем город, который заметно крупнее остальных
      // (это догадка, помечаем status='guess'); иначе честно возвращаем «неоднозначно».
      const cityKeys = [...new Set(list.map((r) => r.c).filter(Boolean))];
      if (cityKeys.length > 1) {
        const ranked = cityKeys
          .map((k) => ({ k, pop: this.cityIdx.get(k)?.population || 0 }))
          .sort((a, b) => b.pop - a.pop);
        if (ranked[0].pop >= 3 * Math.max(ranked[1].pop, 1)) {
          pool = list.filter((r) => r.c === ranked[0].k);
          guessed = true;
        } else {
          return { ...none, status: 'ambiguous', candidates: list.length };
        }
      }
    }
    if (type) {
      const typed = pool.filter((r) => r.t === type);
      if (typed.length) pool = typed;
    }

    const districts = new Map();
    const provinces = new Map();
    const types = new Map();
    for (const r of pool) {
      const w = r.w || 1;
      if (r.d) districts.set(r.d, (districts.get(r.d) || 0) + w);
      if (r.p) provinces.set(r.p, (provinces.get(r.p) || 0) + w);
      if (r.t) types.set(r.t, (types.get(r.t) || 0) + 1);
    }

    const d = Dictionary.top(districts, 0.6);
    const p = Dictionary.top(provinces, 0.9);
    const t = types.size === 1 && pool.every((r) => r.t) ? [...types.keys()][0] : null;

    let status = 'none';
    if (d) status = districts.size === 1 ? 'unique' : 'majority';
    else if (districts.size > 1) status = 'ambiguous';
    if (d && guessed) status = 'guess';

    return {
      district: d ? d.value : null,
      province: p ? p.value : null,
      streetType: t,
      status,
      candidates: pool.length,
    };
  }

  isBigCity(city) {
    return REPUBLICAN_CITIES.has(canonicalCity(city) || city);
  }
}

const dictionaryInstance = new Dictionary();
dictionaryInstance.load();

export default dictionaryInstance;
