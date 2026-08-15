<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { PrinterIcon } from '@heroicons/vue/24/outline'
import { supabase } from '@/lib/supabase'
import type { ElectronicDocumentWithPaidBy, PaymentMethod } from '@/types/database'

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  deposito: 'Depósito',
  tarjeta: 'Tarjeta',
  cheque: 'Cheque',
}

const fecha = ref(new Date().toISOString().slice(0, 10))
const rows = ref<ElectronicDocumentWithPaidBy[]>([])
const loading = ref(true)
const errorMsg = ref('')

const totalsByMethod = computed(() => {
  const totals: Partial<Record<PaymentMethod, number>> = {}
  for (const r of rows.value) {
    if (!r.payment_method) continue
    totals[r.payment_method] = (totals[r.payment_method] ?? 0) + r.importe_total
  }
  return totals
})

const totalDia = computed(() => rows.value.reduce((sum, r) => sum + r.importe_total, 0))

async function loadCaja() {
  loading.value = true
  errorMsg.value = ''
  const start = `${fecha.value}T00:00:00`
  const end = `${fecha.value}T23:59:59.999`
  const { data, error } = await supabase
    .from('electronic_documents')
    .select('*, paid_by_profile:profiles!electronic_documents_paid_by_fkey(full_name)')
    .not('paid_at', 'is', null)
    .gte('paid_at', start)
    .lte('paid_at', end)
    .order('paid_at')
  if (error) {
    errorMsg.value = error.message
  } else {
    rows.value = (data ?? []) as ElectronicDocumentWithPaidBy[]
  }
  loading.value = false
}

watch(fecha, loadCaja)
onMounted(loadCaja)

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })
}

function onPrint() {
  window.print()
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-6 py-8">
    <div class="no-print mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-slate-900">Caja del día</h1>
        <p class="text-sm text-slate-500">Resumen de cobros registrados</p>
      </div>
      <div class="flex items-center gap-3">
        <input v-model="fecha" type="date" class="input" />
        <button
          class="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          @click="onPrint"
        >
          <PrinterIcon class="h-4 w-4" />
          Imprimir
        </button>
      </div>
    </div>

    <p v-if="errorMsg" class="no-print mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMsg }}</p>

    <div class="mb-4 hidden text-center print:block">
      <h1 class="text-lg font-semibold text-slate-900">Cierre de caja — {{ fecha }}</h1>
    </div>

    <div class="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
      <div
        v-for="(label, method) in PAYMENT_LABELS"
        :key="method"
        class="rounded-xl border border-slate-200 bg-white p-4"
      >
        <p class="text-xs font-medium uppercase tracking-wide text-slate-500">{{ label }}</p>
        <p class="mt-1 text-lg font-semibold tabular-nums text-slate-900">
          ${{ (totalsByMethod[method as PaymentMethod] ?? 0).toFixed(2) }}
        </p>
      </div>
      <div class="rounded-xl border border-teal-200 bg-teal-50 p-4">
        <p class="text-xs font-medium uppercase tracking-wide text-teal-700">Total del día</p>
        <p class="mt-1 text-lg font-semibold tabular-nums text-teal-800">${{ totalDia.toFixed(2) }}</p>
      </div>
    </div>

    <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th class="px-4 py-3">Hora</th>
            <th class="px-4 py-3">Comprobante</th>
            <th class="px-4 py-3">Cliente</th>
            <th class="px-4 py-3">Método</th>
            <th class="px-4 py-3">Cobrado por</th>
            <th class="px-4 py-3">Valor</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="loading">
            <td colspan="6" class="px-4 py-6 text-center text-slate-400">Cargando…</td>
          </tr>
          <tr v-else-if="!rows.length">
            <td colspan="6" class="px-4 py-6 text-center text-slate-400">Sin cobros registrados en esta fecha</td>
          </tr>
          <tr v-for="r in rows" :key="r.id" class="hover:bg-slate-50">
            <td class="px-4 py-3 tabular-nums text-slate-600">{{ formatHora(r.paid_at!) }}</td>
            <td class="px-4 py-3 font-mono text-xs text-slate-700">{{ r.numero_completo }}</td>
            <td class="px-4 py-3 text-slate-900">{{ r.razon_social_comprador }}</td>
            <td class="px-4 py-3 text-slate-600">{{ PAYMENT_LABELS[r.payment_method!] }}</td>
            <td class="px-4 py-3 text-slate-600">{{ r.paid_by_profile?.full_name || '—' }}</td>
            <td class="px-4 py-3 tabular-nums text-slate-600">${{ r.importe_total.toFixed(2) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.input {
  @apply rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600;
}
</style>
