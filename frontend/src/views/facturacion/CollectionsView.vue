<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { mensajeWhatsappCobro } from '@/lib/sri'
import { useAuthStore } from '@/stores/auth'
import type { ElectronicDocument, PaymentMethod } from '@/types/database'

const auth = useAuthStore()

const documents = ref<ElectronicDocument[]>([])
const loading = ref(true)
const errorMsg = ref('')
const saving = ref(false)
const selectedDoc = ref<ElectronicDocument | null>(null)
const whatsappPreview = ref('')

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia bancaria' },
  { value: 'deposito', label: 'Depósito bancario' },
  { value: 'tarjeta', label: 'Tarjeta crédito/débito' },
  { value: 'cheque', label: 'Cheque' },
]

const form = reactive({
  payment_method: 'efectivo' as PaymentMethod,
  payment_notes: '',
})

const pending = computed(() => documents.value.filter((d) => !d.paid_at))

async function loadDocuments() {
  loading.value = true
  errorMsg.value = ''
  const { data, error } = await supabase
    .from('electronic_documents')
    .select('*')
    .eq('estado', 'AUTORIZADO')
    .is('paid_at', null)
    .order('fecha_emision')
  if (error) {
    errorMsg.value = error.message
  } else {
    documents.value = (data ?? []) as ElectronicDocument[]
  }
  loading.value = false
}

onMounted(loadDocuments)

function openCobro(doc: ElectronicDocument) {
  selectedDoc.value = doc
  form.payment_method = 'efectivo'
  form.payment_notes = ''
  whatsappPreview.value = ''
}

async function onConfirmarCobro() {
  if (!selectedDoc.value) return
  errorMsg.value = ''
  saving.value = true
  try {
    const { error } = await supabase
      .from('electronic_documents')
      .update({
        paid_at: new Date().toISOString(),
        payment_method: form.payment_method,
        payment_notes: form.payment_notes || null,
        paid_by: auth.user?.id,
      })
      .eq('id', selectedDoc.value.id)
    if (error) throw error

    whatsappPreview.value = mensajeWhatsappCobro(
      selectedDoc.value.razon_social_comprador,
      selectedDoc.value.importe_total,
      selectedDoc.value.numero_completo,
    )
    selectedDoc.value = null
    await loadDocuments()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo registrar el cobro'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-6 py-8">
    <div class="mb-6">
      <h1 class="text-xl font-semibold text-slate-900">Cobros</h1>
      <p class="text-sm text-slate-500">{{ pending.length }} facturas autorizadas pendientes de cobro</p>
    </div>

    <p v-if="errorMsg" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMsg }}</p>

    <div v-if="whatsappPreview" class="mb-4 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
      <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-teal-600">Notificación WhatsApp (simulada)</p>
      <p class="whitespace-pre-line">{{ whatsappPreview }}</p>
    </div>

    <div v-if="selectedDoc" class="mb-6 rounded-xl border border-slate-200 bg-white p-6">
      <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Registrar pago — {{ selectedDoc.numero_completo }}
      </h2>
      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Método de pago</label>
          <select v-model="form.payment_method" class="input">
            <option v-for="m in PAYMENT_METHODS" :key="m.value" :value="m.value">{{ m.label }}</option>
          </select>
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Notas (opcional)</label>
          <input v-model="form.payment_notes" placeholder="Nº de transferencia, etc." class="input" />
        </div>
      </div>
      <div class="mt-4 flex justify-end gap-3">
        <button type="button" class="px-3 py-2 text-sm text-slate-600" @click="selectedDoc = null">Cancelar</button>
        <button
          type="button"
          :disabled="saving"
          class="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          @click="onConfirmarCobro"
        >
          {{ saving ? 'Registrando…' : 'Confirmar cobro' }}
        </button>
      </div>
    </div>

    <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th class="px-4 py-3">Número</th>
            <th class="px-4 py-3">Fecha</th>
            <th class="px-4 py-3">Cliente</th>
            <th class="px-4 py-3">Total</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="loading">
            <td colspan="5" class="px-4 py-6 text-center text-slate-400">Cargando…</td>
          </tr>
          <tr v-else-if="!pending.length">
            <td colspan="5" class="px-4 py-6 text-center text-slate-400">No hay facturas pendientes de cobro</td>
          </tr>
          <tr v-for="d in pending" :key="d.id" class="hover:bg-slate-50">
            <td class="px-4 py-3 font-mono text-xs text-slate-700">{{ d.numero_completo }}</td>
            <td class="px-4 py-3 text-slate-600">{{ d.fecha_emision }}</td>
            <td class="px-4 py-3 text-slate-900">{{ d.razon_social_comprador }}</td>
            <td class="px-4 py-3 tabular-nums text-slate-600">${{ d.importe_total.toFixed(2) }}</td>
            <td class="px-4 py-3 text-right">
              <button class="text-sm font-medium text-teal-700 hover:text-teal-900" @click="openCobro(d)">
                Registrar pago
              </button>
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
