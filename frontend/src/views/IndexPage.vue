<template>
  <div class="mx-auto max-w-5xl px-4 py-16 font-mono">
    <p class="text-sm text-comment">// Jana Post × Terricon Valley Hackathon 2026 — кейс 01</p>
    <h1 class="mt-4 text-4xl font-bold leading-tight md:text-6xl">
      <span class="text-primary glow">JANA</span> ADDRESS
      <span class="cursor-blink" />
    </h1>
    <p class="mt-6 max-w-2xl text-muted-foreground">
      Разбираем «66квартал 12дом 69квартира» на область, город, район, улицу, дом, квартиру,
      подъезд и этаж.
    </p>

    <pre class="mt-10 overflow-x-auto rounded-md border border-border bg-terminal p-5 text-sm">
      <span class="text-comment">$ </span>
      <span class="text-keyword">curl</span> -X POST /parse -d
      <span class="text-primary">'{"raw_address": "Туран 55/6 4подъезд 9этаж"}'</span>
    </pre>

    <div class="mt-10 grid gap-4 md:grid-cols-3">
      <RouterLink
        v-for="c in cards"
        :key="c.to"
        :to="c.to"
        class="group rounded-md border border-border bg-card p-5 transition hover:glow-box"
      >
        <p class="text-xs text-comment">POST {{ c.ep }}</p>
        <p class="mt-2 text-lg font-bold text-primary">{{ c.fn }}()</p>
        <p class="mt-2 text-sm text-muted-foreground">{{ c.d }}</p>
        <p class="mt-4 text-sm text-primary opacity-0 transition group-hover:opacity-100">
          → run
        </p>
      </RouterLink>
    </div>
  </div>
</template>

<script setup>
import { RouterLink } from 'vue-router';

const cards = [
  { to: '/parse', fn: 'parseAddress', ep: '/parse', d: 'Один адрес одной строкой' },
  { to: '/batch', fn: 'batchAddress', ep: '/parse/batch', d: 'JSON-массив записей' },
  { to: '/file', fn: 'sendFile', ep: '/parse/file', d: 'Загрузка .json файла' },
];
</script>