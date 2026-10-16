import { normalize } from './normalize.js';
import dictionary from './dictionary.js';

export function parseAddress(record) {
  let id = 'rec_00000';
  let rawAddress = '';

  if (typeof record === 'string') {
    rawAddress = record;
  } else if (record && typeof record === 'object') {
    id = record.id || id;
    rawAddress = record.raw_address || '';
  }

  if (!rawAddress.trim()) {
    return createEmptyResponse(id, rawAddress);
  }

  // 1. Нормализация и разделение склеек
  let workingText = normalize(rawAddress);

  // 2. Извлечение ориентира (Landmark)
  let landmark = null;
  const explicitLandmarkMatch = workingText.match(/(?:магазин|магаз|тц|трц|тк|бц|жк|жилой комплекс|остановка|ост|рядом с|рядом|напротив|около|возле|ориентир|супермаркет|базар|рынок)\s+([a-яА-Яa-zA-Z0-9ӘөүңғқұһӨҮҢҒҚҰҺ"-]+(?:\s+[a-яА-Яa-zA-Z0-9ӘөүңғқұһӨҮҢҒҚҰҺ"-]+)?)/i);
  
  if (explicitLandmarkMatch) {
    landmark = explicitLandmarkMatch[0].trim();
    workingText = workingText.replace(explicitLandmarkMatch[0], ' ');
  } else if (/\bqazpost\b/i.test(workingText)) {
    const qazMatch = workingText.match(/\bqazpost\b\s*([a-яА-Яa-zA-Z0-9ӘөүңғқұһӨҮҢҒҚҰҺ"-]+)?/i);
    if (qazMatch) {
      landmark = qazMatch[0].trim();
      workingText = workingText.replace(qazMatch[0], ' ');
    }
  }

  // 3. Извлечение деталей помещения (квартира, подъезд, этаж)
  const aptMatch = workingText.match(/(?:kv|kvartira|flat|apt|apartment|pater|кв|квартира|пәтер)\s*([0-9a-zA-Zа-яА-Я]+)/i);
  const entMatch = workingText.match(/(?:entrance|ent|podyezd|pod|подъезд|подьезд|под|кіріс)\s*(\d+)/i);
  const flrMatch = workingText.match(/(?:floor|fl|etazh|et|qabat|kabat|этаж|эт|қабат)\s*(\d+)/i);

  const apartment = aptMatch ? aptMatch[1] : null;
  const entrance = entMatch ? entMatch[1] : null;
  const floor = flrMatch ? flrMatch[1] : null;

  if (aptMatch) workingText = workingText.replace(aptMatch[0], ' ');
  if (entMatch) workingText = workingText.replace(entMatch[0], ' ');
  if (flrMatch) workingText = workingText.replace(flrMatch[0], ' ');

  // 4. Извлечение номера дома по явным ключевым словам (дом, dom, house)
  let house = null;
  const houseExplicitMatch = workingText.match(/(?:dom|house|home|дом|д|үй)\s*(\d+[\/\d]*[a-яА-Яa-zA-Z]?)/i);
  if (houseExplicitMatch) {
    house = houseExplicitMatch[1];
    workingText = workingText.replace(houseExplicitMatch[0], ' ');
  }

  // 5. Определение типа улицы
  let streetType = null;
  const streetTypeMatch = workingText.match(/\b(улица|ул|проспект|пр|микрорайон|мкр|переулок|пер|квартал|кв-л|көшесі|көше|street|st|ulica|ul|prospekt|pr|microdistrict|mkr)\b/i);
  if (streetTypeMatch) {
    const rawType = streetTypeMatch[1].toLowerCase();
    if (['ул', 'улица', 'street', 'st', 'ulica', 'ul', 'көшесі', 'көше'].includes(rawType)) streetType = 'улица';
    else if (['пр', 'проспект', 'prospekt', 'pr'].includes(rawType)) streetType = 'проспект';
    else if (['мкр', 'микрорайон', 'microdistrict', 'mkr'].includes(rawType)) streetType = 'микрорайон';
    else if (['пер', 'переулок', 'lane'].includes(rawType)) streetType = 'переулок';
    else if (['кв-л', 'квартал', 'block'].includes(rawType)) streetType = 'квартал';
  }

  // 6. Извлечение области, района и города (с удалением из рабочей строки)
  let province = null;
  let district = null;
  let city = null;

  // Область
  const provinceMatch = workingText.match(/([a-яА-ЯӘөүңғқұһӨҮҢҒҚҰҺa-zA-Z-]+)\s*(?:область|облысы|обл)/i);
  if (provinceMatch) {
    province = provinceMatch[1] + (workingText.includes('облысы') ? ' облысы' : ' область');
    workingText = workingText.replace(provinceMatch[0], ' ');
  } else {
    for (const reg of dictionary.regions || []) {
      if (reg.name && new RegExp(`\\b${reg.name}\\b`, 'i').test(workingText)) {
        province = reg.name;
        workingText = workingText.replace(new RegExp(`\\b${reg.name}\\b`, 'gi'), ' ');
        break;
      }
    }
  }

  // Район
  const districtMatch = workingText.match(/([a-яА-ЯӘөүңғқұһӨҮҢҒҚҰҺa-zA-Z-]+)\s*(?:район|ауданы|р-н)/i);
  if (districtMatch) {
    district = districtMatch[1] + (workingText.includes('ауданы') ? ' ауданы' : ' район');
    workingText = workingText.replace(districtMatch[0], ' ');
  } else {
    for (const dist of dictionary.districts || []) {
      if (dist.name && new RegExp(`\\b${dist.name}\\b`, 'i').test(workingText)) {
        district = dist.name;
        workingText = workingText.replace(new RegExp(`\\b${dist.name}\\b`, 'gi'), ' ');
        break;
      }
    }
  }

  // Город / Поселок
  const cityMatch = workingText.match(/(?:город|г|город\.|пос|поселок|село|ауыл|qala|city)\s*[\/./]?\s*([a-яА-ЯӘөүңғқұһӨҮҢҒҚҰҺa-zA-Z-]+)/i);
  if (cityMatch) {
    const matchedCity = cityMatch[1];
    city = dictionary.findCity(matchedCity) || matchedCity;
    workingText = workingText.replace(cityMatch[0], ' ');
  } else {
    const tokens = workingText.split(/[\s,./]+/).filter(Boolean);
    for (const token of tokens) {
      const dictCity = dictionary.findCity(token);
      if (dictCity) {
        city = dictCity;
        workingText = workingText.replace(new RegExp(`\\b${token}\\b`, 'gi'), ' ');
        break;
      }
    }
  }

  if (!province && city && ['Астана', 'Алматы', 'Шымкент'].includes(city)) {
    province = city;
  }

  // 7. Поиск улицы / микрорайона из оставшихся токенов
  let streetName = null;

  const cleanWorkingText = workingText
    .replace(/\b(город|г|улица|ул|проспект|пр|микрорайон|мкр|переулок|пер|квартал|кв-л|көшесі|көше|street|st|ulica|ul|dom|house|flat|apt|kv|кв|қабат|этаж|подъезд)\b/gi, ' ')
    .replace(/[/,]/g, ' ')
    .trim();

  const mkrMatch = workingText.match(/(?:мкр|микрорайон)\s*([a-яА-Яa-zA-Z0-9ӘөүңғқұһӨҮҢҒҚҰҺ\s-]+)/i);
  if (mkrMatch) {
    streetType = 'микрорайон';
    streetName = mkrMatch[1].replace(/микрорайон|мкр/gi, '').trim();
  }

  if (!streetName && cleanWorkingText) {
    const tokens = cleanWorkingText.split(/\s+/).filter(Boolean);

    for (let i = 0; i < tokens.length; i++) {
      const single = tokens[i];
      const double = tokens[i + 1] ? `${tokens[i]} ${tokens[i + 1]}` : null;

      if (double && dictionary.findStreet(double)) {
        streetName = dictionary.findStreet(double);
        break;
      } else if (dictionary.findStreet(single)) {
        streetName = dictionary.findStreet(single);
        break;
      }
    }

    if (!streetName) {
      const textTokens = tokens.filter(t => !/^\d+$/.test(t));
      if (textTokens.length > 0) {
        streetName = textTokens.join(' ');
      }
    }
  }

  // 8. Если дом не был найден по слову "дом", берем оставшуюся цифру
  if (!house) {
    const numMatches = workingText.match(/\b(\d+[\/\d]*[a-яА-Яa-zA-Z]?)\b/g) || [];
    for (const num of numMatches) {
      if (num !== apartment && num !== floor && num !== entrance && num !== streetName) {
        house = num;
        break;
      }
    }
  }

  // 9. Автозаполнение района по связям улиц
  if (!district && streetName) {
    district = dictionary.lookupDistrictByStreet(city, streetName);
  }

  // 10. Расчет уверенности (confidence)
  let confidence = 0.3;
  if (city) confidence += 0.2;
  if (streetName) confidence += 0.2;
  if (house) confidence += 0.15;
  if (apartment) confidence += 0.15;
  confidence = Math.min(confidence, 1.0);

  return {
    id: id,
    raw_address: rawAddress,
    province: province,
    city: city,
    district: district,
    living_area: null,
    street_type: streetType,
    street_name: streetName,
    house: house,
    apartment: apartment,
    entrance: entrance,
    floor: floor,
    landmark: landmark,
    confidence: Number(confidence.toFixed(2))
  };
}

export function parseAddressBatch(records) {
  if (!Array.isArray(records)) {
    return [parseAddress(records)];
  }
  return records.map(record => parseAddress(record));
}

function createEmptyResponse(id, rawAddress) {
  return {
    id: id,
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
    confidence: 0.0
  };
}