<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ArrowDownTrayIcon, PrinterIcon } from '@heroicons/vue/24/outline'
import { supabase } from '@/lib/supabase'
import { descargarCsv } from '@/lib/sri'
import type { ElectronicDocumentWithPaidBy, PaymentMethod } from '@/types/database'

type EstadoFiltro = 'todas' | 'pagadas' | 'pendientes'

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  deposito: 'Depósito',
  tarjeta: 'Tarjeta',
  cheque: 'Cheque',
}

const today = new Date().toISOString().slice(0, 10)
const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  .toISOString()
  .slice(0, 10)

const desde = ref(firstOfMonth)
const hasta = ref(today)
const estadoFiltro = ref<EstadoFiltro>('todas')

const documents = ref<ElectronicDocumentWithPaidBy[]>([])
const loading = ref(true)
const errorMsg = ref('')

async function loadReport() {
  loading.value = true
  errorMsg.value = ''
  let query = supabase
    .from('electronic_documents')
    .select('*, paid_by_profile:profiles!electronic_documents_paid_by_fkey(full_name)')
    .gte('fecha_emision', desde.value)
    .lte('fecha_emision', hasta.value)
    .neq('estado', 'BORRADOR')
    .order('fecha_emision')

  if (estadoFiltro.value === 'pagadas') query = query.not('paid_at', 'is', null)
  if (estadoFiltro.value === 'pendientes') query = query.is('paid_at', null)

  const { data, error } = await query
  if (error) {
    errorMsg.value = error.message
  } else {
    documents.value = (data ?? []) as ElectronicDocumentWithPaidBy[]
  }
  loading.value = false
}

watch([desde, hasta, estadoFiltro], loadReport)
onMounted(loadReport)

const totalFacturado = computed(() => documents.value.reduce((sum, d) => sum + d.importe_total, 0))
const totalCobrado = computed(() =>
  documents.value.filter((d) => d.paid_at).reduce((sum, d) => sum + d.importe_total, 0),
)
const totalPorCobrar = computed(() => totalFacturado.value - totalCobrado.value)

function onExportarCsv() {
  const header = ['Número', 'Fecha', 'Cliente', 'Total', 'Estado', 'Método', 'Cobrado por']
  const rows = documents.value.map((d) => [
    d.numero_completo,
    d.fecha_emision,
    d.razon_social_comprador,
    d.importe_total.toFixed(2),
    d.paid_at ? 'Pagada' : 'Pendiente',
    d.payment_method ? PAYMENT_LABELS[d.payment_method] : '—',
    d.paid_by_profile?.full_name || '—',
  ])
  descargarCsv(`facturacion_${desde.value}_${hasta.value}.csv`, [header, ...rows])
}

function onImprimir() {
  window.print()
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-6 py-8">
    <div class="no-print mb-6">
      <h1 class="text-xl font-semibold text-slate-900">Reportes de facturación</h1>
      <div class="mt-4 flex gap-1 border-b border-slate-200">
        <span class="border-b-2 border-teal-700 px-3 py-2 text-sm font-medium text-teal-700">Facturación</span>
      </div>
    </div>

    <p v-if="errorMsg" class="no-print mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMsg }}</p>

    <div class="no-print mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-6">
      <div class="space-y-1">
        <label class="text-sm font-medium text-slate-700">Desde</label>
        <input v-model="desde" type="date" class="input" />
      </div>
      <div class="space-y-1">
        <label class="text-sm font-medium text-slate-700">Hasta</label>
        <input v-model="hasta" type="date" class="input" />
      </div>
      <div class="space-y-1">
        <label class="text-sm font-medium text-slate-700">Estado</label>
        <select v-model="estadoFiltro" class="input">
          <option value="todas">Todas</option>
          <option value="pagadas">Solo pagadas</option>
          <option value="pendientes">Solo pendientes</option>
        </select>
      </div>
      <div class="ml-auto flex gap-3">
        <button
          class="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          @click="onExportarCsv"
        >
          <ArrowDownTrayIcon class="h-4 w-4" />
          Exportar CSV
        </button>
        <button
          class="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          @click="onImprimir"
        >
          <PrinterIcon class="h-4 w-4" />
          Imprimir PDF
        </button>
      </div>
    </div>

    <div class="mb-4 hidden text-center print:block">
      <h1 class="text-lg font-semibold text-slate-900">Reporte de facturación — {{ desde }} a {{ hasta }}</h1>
    </div>

    <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th class="px-4 py-3">Número</th>
            <th class="px-4 py-3">Fecha</th>
            <th class="px-4 py-3">Cliente</th>
            <th class="px-4 py-3">Total</th>
            <th class="px-4 py-3">Estado</th>
            <th class="px-4 py-3">Método</th>
            <th class="px-4 py-3">Cobrado por</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="loading">
            <td colspan="7" class="px-4 py-6 text-center text-slate-400">Cargando…</td>
          </tr>
          <tr v-else-if="!documents.length">
            <td colspan="7" class="px-4 py-6 text-center text-slate-400">Sin resultados para este filtro</td>
          </tr>
          <tr v-for="d in documents" :key="d.id" class="hover:bg-slate-50">
            <td class="px-4 py-3 font-mono text-xs text-slate-700">{{ d.numero_completo }}</td>
            <td class="px-4 py-3 text-slate-600">{{ d.fecha_emision }}</td>
            <td class="px-4 py-3 text-slate-900">{{ d.razon_social_comprador }}</td>
            <td class="px-4 py-3 tabular-nums text-slate-600">${{ d.importe_total.toFixed(2) }}</td>
            <td class="px-4 py-3">
              <span
                class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                :class="d.paid_at ? 'bg-teal-100 text-teal-700' : 'bg-amber-100 text-amber-700'"
              >
                {{ d.paid_at ? 'Pagada' : 'Pendiente' }}
              </span>
            </td>
            <td class="px-4 py-3 text-slate-600">{{ d.payment_method ? PAYMENT_LABELS[d.payment_method] : '—' }}</td>
            <td class="px-4 py-3 text-slate-600">{{ d.paid_by_profile?.full_name || '—' }}</td>
          </tr>
        </tbody>
        <tfoot class="border-t border-slate-200 text-sm font-medium text-slate-900">
          <tr>
            <td colspan="3" class="px-4 py-3 text-right">Facturado</td>
            <td class="px-4 py-3 tabular-nums" colspan="4">${{ totalFacturado.toFixed(2) }}</td>
          </tr>
          <tr>
            <td colspan="3" class="px-4 py-3 text-right">Cobrado</td>
            <td class="px-4 py-3 tabular-nums" colspan="4">${{ totalCobrado.toFixed(2) }}</td>
          </tr>
          <tr>
            <td colspan="3" class="px-4 py-3 text-right">Por cobrar</td>
            <td class="px-4 py-3 tabular-nums" colspan="4">${{ totalPorCobrar.toFixed(2) }}</td>
          </tr>
        </tfoot>
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
