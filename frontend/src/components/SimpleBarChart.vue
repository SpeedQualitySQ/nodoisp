<script setup lang="ts">
import { computed } from 'vue'

// Barra horizontal de una sola serie (magnitud por categoría) — con tan
// pocas categorías en cada uso (planes, franjas de mora, meses) alcanza con
// etiquetar cada barra directamente, sin necesitar tooltip por hover.
const props = defineProps<{
  data: { label: string; value: number }[]
  valuePrefix?: string
  valueSuffix?: string
}>()

const max = computed(() => Math.max(1, ...props.data.map((d) => d.value)))

function formatValue(v: number) {
  return `${props.valuePrefix ?? ''}${v.toLocaleString('es-EC', { maximumFractionDigits: 2 })}${props.valueSuffix ?? ''}`
}
</script>

<template>
  <div class="space-y-3">
    <div v-if="!data.length" class="text-sm text-slate-400">Sin datos para mostrar.</div>
    <div v-for="d in data" :key="d.label" class="space-y-1">
      <div class="flex items-baseline justify-between text-sm">
        <span class="text-slate-700">{{ d.label }}</span>
        <span class="tabular-nums font-medium text-slate-900">{{ formatValue(d.value) }}</span>
      </div>
      <div class="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div class="h-full rounded-full bg-teal-600" :style="{ width: `${(d.value / max) * 100}%` }" />
      </div>
    </div>
  </div>
</template>
