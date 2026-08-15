<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { PlayIcon } from '@heroicons/vue/24/outline'
import { supabase } from '@/lib/supabase'
import { firmarYEnviarDocumento } from '@/lib/sri'
import type { ElectronicDocument } from '@/types/database'
import StatusBadge from '@/components/StatusBadge.vue'

const documents = ref<ElectronicDocument[]>([])
const loading = ref(true)
const errorMsg = ref('')
const generating = ref(false)
const signingId = ref<string | null>(null)
const resultMsg = ref('')
const fecha = ref(new Date().toISOString().slice(0, 10))

async function loadDocuments() {
  loading.value = true
  errorMsg.value = ''
  const { data, error } = await supabase
    .from('electronic_documents')
    .select('*')
    .eq('tipo_comprobante', '01')
    .not('contract_id', 'is', null)
    .order('created_at', { ascending: false })
  if (error) {
    errorMsg.value = error.message
  } else {
    documents.value = (data ?? []) as ElectronicDocument[]
  }
  loading.value = false
}

onMounted(loadDocuments)

async function onGenerar() {
  errorMsg.value = ''
  resultMsg.value = ''
  generating.value = true
  try {
    const { data, error } = await supabase.rpc('generar_facturas_recurrentes', { p_fecha: fecha.value })
    if (error) throw error
    const count = (data ?? []).length
    resultMsg.value =
      count > 0
        ? `Se generaron ${count} factura(s) en borrador para contratos con día de facturación ${new Date(fecha.value + 'T00:00:00').getDate()}.`
        : 'No hay contratos activos pendientes de facturar para esa fecha (o ya fueron generados este mes).'
    await loadDocuments()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo generar la facturación recurrente'
  } finally {
    generating.value = false
  }
}

async function onFirmarYEnviar(doc: ElectronicDocument) {
  errorMsg.value = ''
  signingId.value = doc.id
  try {
    await firmarYEnviarDocumento(doc.id)
    await loadDocuments()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo enviar la factura al SRI'
  } finally {
    signingId.value = null
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-6 py-8">
    <div class="mb-6">
      <h1 class="text-xl font-semibold text-slate-900">Facturación recurrente</h1>
      <p class="text-sm text-slate-500">
        Genera facturas en borrador para los contratos activos cuyo día de facturación coincide con la fecha elegida.
      </p>
    </div>

    <p v-if="errorMsg" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMsg }}</p>
    <p v-if="resultMsg" class="mb-4 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-700">{{ resultMsg }}</p>

    <div class="mb-6 flex items-end gap-3 rounded-xl border border-slate-200 bg-white p-6">
      <div class="space-y-1">
        <label class="text-sm font-medium text-slate-700">Fecha de facturación</label>
        <input v-model="fecha" type="date" class="input" />
      </div>
      <button
        :disabled="generating"
        class="flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
        @click="onGenerar"
      >
        <PlayIcon class="h-4 w-4" />
        {{ generating ? 'Generando…' : 'Generar facturas del día' }}
      </button>
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
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="loading">
            <td colspan="6" class="px-4 py-6 text-center text-slate-400">Cargando…</td>
          </tr>
          <tr v-else-if="!documents.length">
            <td colspan="6" class="px-4 py-6 text-center text-slate-400">Sin facturas recurrentes generadas</td>
          </tr>
          <tr v-for="d in documents" :key="d.id" class="hover:bg-slate-50">
            <td class="px-4 py-3 font-mono text-xs text-slate-700">{{ d.numero_completo }}</td>
            <td class="px-4 py-3 text-slate-600">{{ d.fecha_emision }}</td>
            <td class="px-4 py-3 text-slate-900">{{ d.razon_social_comprador }}</td>
            <td class="px-4 py-3 tabular-nums text-slate-600">${{ d.importe_total.toFixed(2) }}</td>
            <td class="px-4 py-3"><StatusBadge :status="d.estado" /></td>
            <td class="px-4 py-3 text-right">
              <button
                v-if="d.estado === 'BORRADOR' || d.estado === 'RECHAZADO'"
                :disabled="signingId === d.id"
                class="text-sm font-medium text-teal-700 hover:text-teal-900 disabled:opacity-60"
                @click="onFirmarYEnviar(d)"
              >
                {{ signingId === d.id ? 'Enviando…' : 'Firmar y enviar' }}
              </button>
              <span v-else-if="d.estado === 'AUTORIZADO'" class="font-mono text-xs text-slate-400" :title="d.clave_acceso">
                {{ d.numero_autorizacion?.slice(0, 10) }}…
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.input {
  @apply w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600;
}
</style>
