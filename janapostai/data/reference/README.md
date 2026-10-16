# Справочник (build из kazakhstan-261015-free.shp)

Генерируется скриптом `../build_reference.ps1` (PowerShell 5+, без внешних зависимостей).

| Файл | Что внутри |
|---|---|
| `regions.json` | Области и города республиканского значения (OSM admin_level4). Поля: `name_kk`, `name_ru`, `kind` (region/city), `bbox` [minLng,minLat,maxLng,maxLat]. У Алматы/Астаны/Шымкента дополнительно `rings` — полигоны для point-in-polygon. |
| `districts.json` | Районы (OSM admin_level6). Поля: `name_kk`, `name_ru` (алиас каз.→рус., есть не для всех), `city` (заполнен для районов внутри больших городов), `bbox`, у городских районов — `rings`. |
| `cities.json` | Населённые пункты (city/town/village/hamlet). Поля: `name`, `kind`, `population`, `aliases` (напр. Алма-Ата→Алматы), `bbox`, `lat`, `lng`. |
| `living_areas.json` | Микрорайоны и пригородные зоны: из landuse=residential с названием и из place=suburb. Поля: `name`, `kind`, `city`, `district_kk/ru`, `region_kk/ru`, `lat`, `lng`. |
| `streets.json` | Улицы OSM (все именованные дороги, ~250k). Поля: `name` (оригинал), `core` (без типа), `stype` (тип улицы), `city`, `district_kk/ru`, `region_kk/ru`, `lat`, `lng` (центр сегмента), `parts` (число сегментов). |
| `street_types.json` | Словарь типов улиц: `type` + `synonyms` (рус./каз./англ. сокращения) для парсера. |

## Как это использовать в парсере

1. Токенизировать raw_address, извлечь город → искать в `cities.json` (name + aliases).
2. Извлечь тип+название улицы → искать в `streets.json` по `core` (case-insensitive), фильтруя по `city`.
3. Из найденной улицы взять `district_ru`, `region_ru` — это и есть `district`/`province`.
4. Если улица не найдена — fallback: точка из `streets.json` ближайшего совпадения → cell resolution, либо ручной ввод (confidence ниже).
5. `rings` у district/region — для проверки спорных точек (point-in-polygon на клиенте).

## Точность

- Проверено на sample: «Мкр Аксай 3а» (Алматы) → `Әуезов ауданы` → `Ауэзовский` ✔
- Алиасы районов заполнены для Алматы, Астаны, Шымкента; для областей — все 17 областей.
- Для остальных районов `name_ru = null` (можно дописать в `$districtRu` в build_reference.ps1).

Лицензия данных: © OpenStreetMap contributors, ODbL 1.0.
