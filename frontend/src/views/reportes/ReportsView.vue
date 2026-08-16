<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ArrowDownTrayIcon, PrinterIcon } from '@heroicons/vue/24/outline'
import { supabase } from '@/lib/supabase'
import { descargarCsv } from '@/lib/sri'
import type { ClientStatus, ClientWithContract, ElectronicDocumentWithPaidBy, PaymentMethod } from '@/types/database'
import StatusBadge from '@/components/StatusBadge.vue'

type Tab = 'facturacion' | 'clientes' | 'deudas'
const tab = ref<Tab>('facturacion')

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  deposito: 'Depósito',
  tarjeta: 'Tarjeta',
  cheque: 'Cheque',
}

const today = new Date().toISOString().slice(0, 10)
const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

const errorMsg = ref('')

// --- Facturación --------------------------------------------------------
type EstadoFiltro = 'todas' | 'pagadas' | 'pendientes'
const desde = ref(firstOfMonth)
const hasta = ref(today)
const estadoFiltro = ref<EstadoFiltro>('todas')
const documents = ref<ElectronicDocumentWithPaidBy[]>([])
const loadingFacturacion = ref(true)

async function loadFacturacion() {
  loadingFacturacion.value = true
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
  if (error) errorMsg.value = error.message
  else documents.value = (data ?? []) as ElectronicDocumentWithPaidBy[]
  loadingFacturacion.value = false
}

watch([desde, hasta, estadoFiltro], loadFacturacion)

const totalFacturado = computed(() => documents.value.reduce((sum, d) => sum + d.importe_total, 0))
const totalCobrado = computed(() => documents.value.filter((d) => d.paid_at).reduce((sum, d) => sum + d.importe_total, 0))
const totalPorCobrar = computed(() => totalFacturado.value - totalCobrado.value)

function onExportarFacturacion() {
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

// --- Clientes -------------------------------------------------------------
const clienteEstadoFiltro = ref<ClientStatus | ''>('')
const clientesReporte = ref<ClientWithContract[]>([])
const loadingClientes = ref(true)

async function loadClientesReporte() {
  loadingClientes.value = true
  errorMsg.value = ''
  let query = supabase.from('clients_with_contract').select('*').order('last_name')
  if (clienteEstadoFiltro.value) query = query.eq('status', clienteEstadoFiltro.value)
  const { data, error } = await query
  if (error) errorMsg.value = error.message
  else clientesReporte.value = (data ?? []) as ClientWithContract[]
  loadingClientes.value = false
}

watch(clienteEstadoFiltro, loadClientesReporte)

function onExportarClientes() {
  const header = ['Nombre', 'Cédula', 'Teléfono', 'Email', 'Estado', 'Plan', 'Valor/mes']
  const rows = clientesReporte.value.map((c) => [
    `${c.last_name} ${c.first_name}`,
    c.identification,
    c.mobile || c.phone || '—',
    c.email || '—',
    c.status,
    c.plan_name || '—',
    c.monthly_fee != null ? c.monthly_fee.toFixed(2) : '—',
  ])
  descargarCsv(`clientes_${clienteEstadoFiltro.value || 'todos'}.csv`, [header, ...rows])
}

// --- Deudas -----------------------------------------------------------
type DeudaFiltro = 'todas' | '3' | '7' | '15' | '30'
const deudaFiltro = ref<DeudaFiltro>('todas')
type DeudaRow = {
  client: string
  phone: string
  numero: string
  fecha: string
  dias: number
  valor: number
  plan: string
}
const deudasRaw = ref<DeudaRow[]>([])
const loadingDeudas = ref(true)

function diasDeMora(fechaEmision: string) {
  return Math.floor((Date.now() - new Date(fechaEmision).getTime()) / (1000 * 60 * 60 * 24))
}

async function loadDeudas() {
  loadingDeudas.value = true
  errorMsg.value = ''
  const { data, error } = await supabase
    .from('electronic_documents')
    .select(
      'numero_completo, fecha_emision, importe_total, razon_social_comprador, client_id, clients(mobile), contract:service_contracts(plan:plans(name))',
    )
    .eq('tipo_comprobante', '01')
    .eq('estado', 'AUTORIZADO')
    .is('paid_at', null)
  if (error) {
    errorMsg.value = error.message
    loadingDeudas.value = false
    return
  }
  deudasRaw.value = (data ?? []).map((d) => {
    const clients = d.clients as unknown as { mobile: string | null }[] | { mobile: string | null } | null
    const client = Array.isArray(clients) ? clients[0] : clients
    const contract = d.contract as unknown as { plan: { name: string } | { name: string }[] | null }[] | null
    const plan = contract?.[0]?.plan
    const planName = Array.isArray(plan) ? plan[0]?.name : plan?.name
    return {
      client: d.razon_social_comprador,
      phone: client?.mobile || '—',
      numero: d.numero_completo,
      fecha: d.fecha_emision,
      dias: diasDeMora(d.fecha_emision),
      valor: d.importe_total,
      plan: planName || '—',
    }
  })
  loadingDeudas.value = false
}

onMounted(() => {
  loadFacturacion()
  loadClientesReporte()
  loadDeudas()
})

const deudasFiltradas = computed(() => {
  const min = deudaFiltro.value === 'todas' ? 0 : Number(deudaFiltro.value)
  return deudasRaw.value.filter((d) => d.dias >= min).sort((a, b) => b.dias - a.dias)
})

function onExportarDeudas() {
  const header = ['Cliente', 'Teléfono', 'Factura', 'Fecha emisión', 'Días mora', 'Valor', 'Plan']
  const rows = deudasFiltradas.value.map((d) => [d.client, d.phone, d.numero, d.fecha, d.dias, d.valor.toFixed(2), d.plan])
  descargarCsv(`deudas_${deudaFiltro.value}.csv`, [header, ...rows])
}

function onImprimir() {
  window.print()
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-6 py-8">
    <div class="no-print mb-6">
      <h1 class="text-xl font-semibold text-slate-900">Reportes</h1>
      <div class="mt-4 flex gap-1 border-b border-slate-200">
        <button
          class="border-b-2 px-3 py-2 text-sm font-medium"
          :class="tab === 'facturacion' ? 'border-teal-700 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'"
          @click="tab = 'facturacion'"
        >
          Facturación
        </button>
        <button
          class="border-b-2 px-3 py-2 text-sm font-medium"
          :class="tab === 'clientes' ? 'border-teal-700 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'"
          @click="tab = 'clientes'"
        >
          Clientes
        </button>
        <button
          class="border-b-2 px-3 py-2 text-sm font-medium"
          :class="tab === 'deudas' ? 'border-teal-700 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'"
          @click="tab = 'deudas'"
        >
          Deudas
        </button>
      </div>
    </div>

    <p v-if="errorMsg" class="no-print mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMsg }}</p>

    <!-- Facturación -->
    <template v-if="tab === 'facturacion'">
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
          <button class="btn-outline" @click="onExportarFacturacion">
            <ArrowDownTrayIcon class="h-4 w-4" />
            Exportar CSV
          </button>
          <button class="btn-outline" @click="onImprimir">
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
            <tr v-if="loadingFacturacion">
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
    </template>

    <!-- Clientes -->
    <template v-else-if="tab === 'clientes'">
      <div class="no-print mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-6">
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Estado</label>
          <select v-model="clienteEstadoFiltro" class="input">
            <option value="">Todos</option>
            <option value="prospect">Prospecto</option>
            <option value="pending">Pendiente</option>
            <option value="active">Activo</option>
            <option value="suspended">Suspendido</option>
            <option value="cut">Cortado</option>
            <option value="retired">Retirado</option>
          </select>
        </div>
        <div class="ml-auto flex gap-3">
          <button class="btn-outline" @click="onExportarClientes">
            <ArrowDownTrayIcon class="h-4 w-4" />
            Exportar CSV
          </button>
          <button class="btn-outline" @click="onImprimir">
            <PrinterIcon class="h-4 w-4" />
            Imprimir PDF
          </button>
        </div>
      </div>

      <div class="mb-4 hidden text-center print:block">
        <h1 class="text-lg font-semibold text-slate-900">Reporte de clientes</h1>
      </div>

      <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th class="px-4 py-3">Nombre</th>
              <th class="px-4 py-3">Cédula</th>
              <th class="px-4 py-3">Teléfono</th>
              <th class="px-4 py-3">Estado</th>
              <th class="px-4 py-3">Plan</th>
              <th class="px-4 py-3">Valor/mes</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="loadingClientes">
              <td colspan="6" class="px-4 py-6 text-center text-slate-400">Cargando…</td>
            </tr>
            <tr v-else-if="!clientesReporte.length">
              <td colspan="6" class="px-4 py-6 text-center text-slate-400">Sin resultados</td>
            </tr>
            <tr v-for="c in clientesReporte" :key="c.id" class="hover:bg-slate-50">
              <td class="px-4 py-3 text-slate-900">{{ c.last_name }} {{ c.first_name }}</td>
              <td class="px-4 py-3 font-mono text-xs text-slate-600">{{ c.identification }}</td>
              <td class="px-4 py-3 text-slate-600">{{ c.mobile || c.phone || '—' }}</td>
              <td class="px-4 py-3"><StatusBadge :status="c.status" /></td>
              <td class="px-4 py-3 text-slate-600">{{ c.plan_name || '—' }}</td>
              <td class="px-4 py-3 tabular-nums text-slate-600">{{ c.monthly_fee != null ? `$${c.monthly_fee.toFixed(2)}` : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- Deudas -->
    <template v-else>
      <div class="no-print mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-6">
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Días de mora</label>
          <select v-model="deudaFiltro" class="input">
            <option value="todas">Todas</option>
            <option value="3">≥ 3 días</option>
            <option value="7">≥ 7 días</option>
            <option value="15">≥ 15 días</option>
            <option value="30">≥ 30 días</option>
          </select>
        </div>
        <div class="ml-auto flex gap-3">
          <button class="btn-outline" @click="onExportarDeudas">
            <ArrowDownTrayIcon class="h-4 w-4" />
            Exportar CSV
          </button>
          <button class="btn-outline" @click="onImprimir">
            <PrinterIcon class="h-4 w-4" />
            Imprimir PDF
          </button>
        </div>
      </div>

      <div class="mb-4 hidden text-center print:block">
        <h1 class="text-lg font-semibold text-slate-900">Reporte de deudas</h1>
      </div>

      <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th class="px-4 py-3">Cliente</th>
              <th class="px-4 py-3">Teléfono</th>
              <th class="px-4 py-3">Factura</th>
              <th class="px-4 py-3">Fecha emisión</th>
              <th class="px-4 py-3">Días mora</th>
              <th class="px-4 py-3">Valor</th>
              <th class="px-4 py-3">Plan</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="loadingDeudas">
              <td colspan="7" class="px-4 py-6 text-center text-slate-400">Cargando…</td>
            </tr>
            <tr v-else-if="!deudasFiltradas.length">
              <td colspan="7" class="px-4 py-6 text-center text-slate-400">Sin deudas para este filtro</td>
            </tr>
            <tr v-for="(d, i) in deudasFiltradas" :key="i" class="hover:bg-slate-50">
              <td class="px-4 py-3 text-slate-900">{{ d.client }}</td>
              <td class="px-4 py-3 text-slate-600">{{ d.phone }}</td>
              <td class="px-4 py-3 font-mono text-xs text-slate-700">{{ d.numero }}</td>
              <td class="px-4 py-3 text-slate-600">{{ d.fecha }}</td>
              <td class="px-4 py-3 tabular-nums font-medium" :class="d.dias >= 15 ? 'text-red-600' : 'text-amber-600'">{{ d.dias }}</td>
              <td class="px-4 py-3 tabular-nums text-slate-600">${{ d.valor.toFixed(2) }}</td>
              <td class="px-4 py-3 text-slate-600">{{ d.plan }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.input {
  @apply rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600;
}
.btn-outline {
  @apply flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100;
}
</style>
