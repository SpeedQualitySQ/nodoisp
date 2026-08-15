<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ status: string }>()

const STYLES: Record<string, string> = {
  prospect: 'bg-slate-100 text-slate-600',
  pending: 'bg-amber-100 text-amber-700',
  active: 'bg-teal-100 text-teal-700',
  suspended: 'bg-orange-100 text-orange-700',
  cut: 'bg-red-100 text-red-700',
  retired: 'bg-slate-200 text-slate-500',
  terminated: 'bg-slate-200 text-slate-500',
  BORRADOR: 'bg-slate-100 text-slate-600',
  PROCESANDO: 'bg-amber-100 text-amber-700',
  AUTORIZADO: 'bg-teal-100 text-teal-700',
  RECHAZADO: 'bg-red-100 text-red-700',
  ANULADO: 'bg-slate-200 text-slate-500',
}

const LABELS: Record<string, string> = {
  prospect: 'Prospecto',
  pending: 'Pendiente',
  active: 'Activo',
  suspended: 'Suspendido',
  cut: 'Cortado',
  retired: 'Retirado',
  terminated: 'Terminado',
  BORRADOR: 'Borrador',
  PROCESANDO: 'Procesando',
  AUTORIZADO: 'Autorizado',
  RECHAZADO: 'Rechazado',
  ANULADO: 'Anulado',
}

const classes = computed(() => STYLES[props.status] ?? 'bg-slate-100 text-slate-600')
const label = computed(() => LABELS[props.status] ?? props.status)
</script>

<template>
  <span
    class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
    :class="classes"
  >
    {{ label }}
  </span>
</template>
