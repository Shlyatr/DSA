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

  // 1. Нормализация и разделение склеек (dom10 -> dom 10, flat12 -> flat 12, қабат3 -> қабат 3)
  const normalized = normalize(rawAddress);

  // 2. Извлечение деталей мультиязычными регулярными выражениями
  const aptMatch = normalized.match(/(?:kv|kvartira|flat|apt|apartment|pater|кв|квартира|пәтер)\s*([0-9a-zA-Zа-яА-Я]+)/i);
  const houseMatch = normalized.match(/(?:dom|house|home|дом|д|үй)\s*(\d+[\/\d]*[a-яА-Яa-zA-Z]?)/i);
  const entMatch = normalized.match(/(?:entrance|ent|podyezd|pod|подъезд|подьезд|под|кіріс)\s*(\d+)/i);
  const flrMatch = normalized.match(/(?:floor|fl|etazh|et|qabat|kabat|этаж|эт|қабат)\s*(\d+)/i);

  const apartment = aptMatch ? aptMatch[1] : null;
  let house = houseMatch ? houseMatch[1] : null;
  const entrance = entMatch ? entMatch[1] : null;
  const floor = flrMatch ? flrMatch[1] : null;

  // 3. Определение типа улицы (русский, казахский, латиница)
  let streetType = null;
  const streetTypeMatch = normalized.match(/\b(улица|ул|проспект|пр|микрорайон|мкр|переулок|пер|квартал|кв-л|street|st|ulica|ul|prospekt|pr|microdistrict|mkr)\b/i);
  if (streetTypeMatch) {
    const rawType = streetTypeMatch[1].toLowerCase();
    if (['ул', 'улица', 'street', 'st', 'ulica', 'ul'].includes(rawType)) streetType = 'улица';
    else if (['пр', 'проспект', 'prospekt', 'pr'].includes(rawType)) streetType = 'проспект';
    else if (['мкр', 'микрорайон', 'microdistrict', 'mkr'].includes(rawType)) streetType = 'микрорайон';
    else if (['пер', 'переулок', 'lane'].includes(rawType)) streetType = 'переулок';
    else if (['кв-л', 'квартал', 'block'].includes(rawType)) streetType = 'квартал';
  }

  // 4. Удаление шума (служебных слов) для точного поиска гео-токенов в справочниках
  let city = null;
  let province = null;
  let district = null;
  let livingArea = null;
  let streetName = null;

  const noiseRegex = /\b(city|qala|город|г|street|st|ulica|ul|улица|region|oblast|область|district|район|dom|house|home|дом|д|үй|flat|apt|kv|кв|apartment|pater|пәтер|floor|etazh|qabat|kabat|этаж|эт|entrance|podyezd|подъезд|под)\b/gi;

  const words = normalized
    .replace(noiseRegex, ' ')
    .split(/[\s,./]+/)
    .filter(Boolean);

  // 5. Поиск городов, областей и улиц в справочниках
  for (let i = 0; i < words.length; i++) {
    const singleWord = words[i];
    const doubleWord = words[i + 1] ? `${words[i]} ${words[i + 1]}` : null;

    if (!city) {
      if (doubleWord && dictionary.findCity(doubleWord)) city = dictionary.findCity(doubleWord);
      else if (dictionary.findCity(singleWord)) city = dictionary.findCity(singleWord);
    }

    if (!province) {
      if (doubleWord && dictionary.findRegion(doubleWord)) province = dictionary.findRegion(doubleWord);
      else if (dictionary.findRegion(singleWord)) province = dictionary.findRegion(singleWord);
    }

    if (!streetName) {
      if (doubleWord && dictionary.findStreet(doubleWord)) streetName = dictionary.findStreet(doubleWord);
      else if (dictionary.findStreet(singleWord)) streetName = dictionary.findStreet(singleWord);
    }

    if (!district) {
      if (doubleWord && dictionary.findDistrict(doubleWord)) district = dictionary.findDistrict(doubleWord);
      else if (dictionary.findDistrict(singleWord)) district = dictionary.findDistrict(singleWord);
    }
  }

  // 6. Если номер дома не был найден по префиксу (dom/house), ищем стоящую отдельно цифру
  if (!house) {
    const numbers = normalized.match(/\b(\d+[\/\d]*[a-яА-Яa-zA-Z]?)\b/g) || [];
    for (const num of numbers) {
      if (num !== apartment && num !== floor && num !== entrance) {
        house = num;
        break;
      }
    }
  }

  // 7. Восстановление района по справочнику
  if (!district && streetName) {
    district = dictionary.lookupDistrictByStreet(city, streetName);
  }

  // 8. Расчет показателя уверенности (confidence)
  let confidence = 0.3;
  if (city) confidence += 0.2;
  if (streetName) confidence += 0.2;
  if (house) confidence += 0.15;
  if (apartment) confidence += 0.15;
  confidence = Math.min(confidence, 1.0);

  return {
    id: id,
    raw_address: rawAddress,
    province: province || (city === 'Астана' || city === 'Алматы' || city === 'Шымкент' ? city : null),
    city: city,
    district: district,
    living_area: livingArea,
    street_type: streetType,
    street_name: streetName,
    house: house,
    apartment: apartment,
    entrance: entrance,
    floor: floor,
    landmark: null,
    confidence: Number(confidence.toFixed(2))
  };
}

// Функция для обработки массива адресов (пакета)
export function parseAddressBatch(records) {
  // Если передали не массив, а один объект/строку — оборачиваем и обрабатываем
  if (!Array.isArray(records)) {
    return [parseAddress(records)];
  }
  
  // Если передан массив — обрабатываем каждый элемент по очереди
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