<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { PlusIcon, TrashIcon } from '@heroicons/vue/24/outline'
import { supabase } from '@/lib/supabase'
import { calcularIva, firmarYEnviarDocumento } from '@/lib/sri'
import type { ClientWithContract, ElectronicDocument } from '@/types/database'
import StatusBadge from '@/components/StatusBadge.vue'

const documents = ref<ElectronicDocument[]>([])
const loading = ref(true)
const errorMsg = ref('')
const saving = ref(false)
const signingId = ref<string | null>(null)
const showForm = ref(false)

const clients = ref<ClientWithContract[]>([])
const clientSearch = ref('')
const selectedClientId = ref<string | null>(null)
const consumidorFinal = ref(true)

interface DraftItem {
  description: string
  quantity: number
  unit_price: number
}

const items = ref<DraftItem[]>([{ description: '', quantity: 1, unit_price: 0 }])

const filteredClients = computed(() => {
  const term = clientSearch.value.trim().toLowerCase()
  if (!term) return clients.value.slice(0, 20)
  return clients.value
    .filter(
      (c) =>
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(term) ||
        c.identification.toLowerCase().includes(term),
    )
    .slice(0, 20)
})

const subtotal = computed(() =>
  items.value.reduce((sum, it) => sum + (it.quantity || 0) * (it.unit_price || 0), 0),
)
const iva = computed(() => calcularIva(subtotal.value))
const total = computed(() => subtotal.value + iva.value)

async function loadClients() {
  const { data } = await supabase.from('clients_with_contract').select('*').order('first_name')
  clients.value = (data ?? []) as ClientWithContract[]
}

async function loadDocuments() {
  loading.value = true
  errorMsg.value = ''
  const { data, error } = await supabase
    .from('electronic_documents')
    .select('*')
    .eq('tipo_comprobante', '01')
    .is('contract_id', null)
    .order('created_at', { ascending: false })
  if (error) {
    errorMsg.value = error.message
  } else {
    documents.value = (data ?? []) as ElectronicDocument[]
  }
  loading.value = false
}

onMounted(async () => {
  await Promise.all([loadClients(), loadDocuments()])
})

function selectClient(client: ClientWithContract) {
  selectedClientId.value = client.id
  consumidorFinal.value = false
  clientSearch.value = `${client.first_name} ${client.last_name}`
  if (client.contract_id && client.plan_name && items.value.length === 1 && !items.value[0].description) {
    items.value = [
      {
        description: `Servicio de internet — ${client.plan_name}`,
        quantity: 1,
        unit_price: client.monthly_fee ?? 0,
      },
    ]
  }
}

function useConsumidorFinal() {
  consumidorFinal.value = true
  selectedClientId.value = null
  clientSearch.value = ''
}

function addItem() {
  items.value.push({ description: '', quantity: 1, unit_price: 0 })
}

function removeItem(index: number) {
  if (items.value.length > 1) items.value.splice(index, 1)
}

function resetForm() {
  selectedClientId.value = null
  consumidorFinal.value = true
  clientSearch.value = ''
  items.value = [{ description: '', quantity: 1, unit_price: 0 }]
}

async function onSave() {
  errorMsg.value = ''
  const validItems = items.value.filter((it) => it.description && it.quantity > 0)
  if (!validItems.length) {
    errorMsg.value = 'Agrega al menos una línea de detalle válida'
    return
  }
  saving.value = true
  try {
    const client = clients.value.find((c) => c.id === selectedClientId.value)
    const { data: doc, error: docError } = await supabase
      .from('electronic_documents')
      .insert({
        client_id: consumidorFinal.value ? null : selectedClientId.value,
        razon_social_comprador: consumidorFinal.value
          ? 'CONSUMIDOR FINAL'
          : `${client?.first_name} ${client?.last_name}`,
        identificacion_comprador: consumidorFinal.value ? '9999999999999' : client?.identification,
      })
      .select('id')
      .single()
    if (docError) throw docError

    const { error: itemsError } = await supabase.from('document_items').insert(
      validItems.map((it) => ({
        document_id: doc.id,
        description: it.description,
        quantity: it.quantity,
        unit_price: it.unit_price,
      })),
    )
    if (itemsError) throw itemsError

    resetForm()
    showForm.value = false
    await loadDocuments()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo guardar la factura'
  } finally {
    saving.value = false
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
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-slate-900">Facturación manual</h1>
        <p class="text-sm text-slate-500">{{ documents.length }} facturas</p>
      </div>
      <button
        class="flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
        @click="showForm = !showForm"
      >
        <PlusIcon class="h-4 w-4" />
        Nueva factura
      </button>
    </div>

    <p v-if="errorMsg" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMsg }}</p>

    <div v-if="showForm" class="mb-6 space-y-6 rounded-xl border border-slate-200 bg-white p-6">
      <div>
        <h2 class="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Cliente</h2>
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" :checked="consumidorFinal" class="h-4 w-4 rounded border-slate-300" @change="useConsumidorFinal" />
            Consumidor final
          </label>
        </div>
        <div v-if="!consumidorFinal" class="relative mt-2">
          <input
            v-model="clientSearch"
            type="text"
            placeholder="Buscar cliente por nombre o cédula/RUC…"
            class="input"
          />
          <div
            v-if="clientSearch && !selectedClientId"
            class="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg"
          >
            <button
              v-for="c in filteredClients"
              :key="c.id"
              type="button"
              class="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
              @click="selectClient(c)"
            >
              {{ c.first_name }} {{ c.last_name }} — {{ c.identification }}
            </button>
            <p v-if="!filteredClients.length" class="px-3 py-2 text-sm text-slate-400">Sin resultados</p>
          </div>
        </div>
      </div>

      <div>
        <div class="mb-2 flex items-center justify-between">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Detalle</h2>
          <button type="button" class="flex items-center gap-1 text-sm font-medium text-teal-700" @click="addItem">
            <PlusIcon class="h-4 w-4" />
            Agregar línea
          </button>
        </div>
        <div class="space-y-2">
          <div v-for="(it, idx) in items" :key="idx" class="grid grid-cols-12 gap-2">
            <input v-model="it.description" placeholder="Descripción" class="input col-span-6" />
            <input v-model.number="it.quantity" type="number" min="0" step="0.01" placeholder="Cant." class="input col-span-2" />
            <input v-model.number="it.unit_price" type="number" min="0" step="0.01" placeholder="Precio" class="input col-span-3" />
            <button type="button" class="col-span-1 flex items-center justify-center text-slate-400 hover:text-red-600" @click="removeItem(idx)">
              <TrashIcon class="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-end gap-8 border-t border-slate-100 pt-4 text-sm">
        <div class="text-right">
          <p class="text-slate-500">Subtotal <span class="ml-2 font-medium text-slate-900">${{ subtotal.toFixed(2) }}</span></p>
          <p class="text-slate-500">IVA 15% <span class="ml-2 font-medium text-slate-900">${{ iva.toFixed(2) }}</span></p>
          <p class="text-slate-900">Total <span class="ml-2 font-semibold">${{ total.toFixed(2) }}</span></p>
        </div>
      </div>

      <div class="flex justify-end gap-3">
        <button type="button" class="px-3 py-2 text-sm text-slate-600" @click="showForm = false">Cancelar</button>
        <button
          type="button"
          :disabled="saving"
          class="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          @click="onSave"
        >
          {{ saving ? 'Guardando…' : 'Guardar como borrador' }}
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
            <th class="px-4 py-3">Estado</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="loading">
            <td colspan="6" class="px-4 py-6 text-center text-slate-400">Cargando…</td>
          </tr>
          <tr v-else-if="!documents.length">
            <td colspan="6" class="px-4 py-6 text-center text-slate-400">Sin facturas registradas</td>
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
