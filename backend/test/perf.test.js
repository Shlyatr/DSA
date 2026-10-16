import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAddress } from '../src/parser.js';

// Проверка, что разбор 5000 записей укладывается в разумное время
// (требование ТЗ: <= 5 минут на 1000 записей).
test('производительность: 5000 адресов', () => {
  const templates = [
    (i) => `город Алматы/Алматы қаласы, Мкр Аксай ${i}, 59, кв ${i % 300}`,
    (i) => `Ул. Курильская ${i} кв 1`,
    (i) => `Туран ${i}/6 магазин береке 4подьезд 9этаж`,
    (i) => `Нурсити 2 микрорайон ${i}дом 5 подьезд 239 кв`,
    (i) => `Алматинская область, Илийский район, пос. Борalдай, ул. Ленина ${i}`,
    (i) => `66квартал ${i}дом ${i}квартира`,
  ];
  const N = 5000;
  const start = process.hrtime.bigint();
  for (let i = 0; i < N; i++) {
    parseAddress(templates[i % templates.length](i));
  }
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  const per1000 = (ms / N) * 1000;
  assert.ok(per1000 < 5000, `too slow: ${per1000.toFixed(1)} ms/1000`);
  console.log(`      ${N} адресов за ${ms.toFixed(0)} ms (~${per1000.toFixed(0)} ms/1000)`);
});
