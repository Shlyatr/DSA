<template>
  <div v-if="loading || error || data" class="mt-6">
    <Panel title="output: JSON">
      <div v-if="loading" class="text-sm text-comment">Loading...</div>
      <div v-else-if="error" class="text-sm text-destructive font-bold">
        Error: {{ error }}
      </div>
      <pre v-else-if="data" class="overflow-x-auto text-xs text-primary font-mono"><code>{{ JSON.stringify(data, null, 2) }}</code></pre>
    </Panel>
  </div>
</template>

<script setup>
import Panel from './Panel.vue';

defineProps({
  data: [Object, Array, String, Number, Boolean],
  error: String,
  loading: Boolean,
});
</script>