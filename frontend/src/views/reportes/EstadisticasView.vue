<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { supabase } from '@/lib/supabase'
import SimpleBarChart from '@/components/SimpleBarChart.vue'

type Tab = 'planes' | 'cuentas-cobrar' | 'desconexiones' | 'facturacion'
const tab = ref<Tab>('planes')
const errorMsg = ref('')
const loading = ref(true)

// --- Planes más usados ---------------------------------------------------
const planesData = ref<{ label: string; value: number }[]>([])

async function loadPlanes() {
  const { data, error } = await supabase
    .from('service_contracts')
    .select('plan:plans(name)')
    .eq('status', 'active')
  if (error) {
    errorMsg.value = error.message
    return
  }
  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    const plan = row.plan as unknown as { name: string } | { name: string }[] | null
    const name = (Array.isArray(plan) ? plan[0]?.name : plan?.name) ?? 'Sin plan'
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  planesData.value = [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
}

// --- Cuentas por cobrar (antigüedad) --------------------------------------
const cuentasCobrarData = ref<{ label: string; value: number }[]>([])

function diasDeMora(fechaEmision: string) {
  return Math.floor((Date.now() - new Date(fechaEmision).getTime()) / (1000 * 60 * 60 * 24))
}

async function loadCuentasCobrar() {
  const { data, error } = await supabase
    .from('electronic_documents')
    .select('fecha_emision, importe_total')
    .eq('tipo_comprobante', '01')
    .eq('estado', 'AUTORIZADO')
    .is('paid_at', null)
  if (error) {
    errorMsg.value = error.message
    return
  }
  const buckets = { '0-3 días': 0, '4-7 días': 0, '8-15 días': 0, '16-30 días': 0, '30+ días': 0 }
  for (const d of data ?? []) {
    const dias = diasDeMora(d.fecha_emision)
    if (dias <= 3) buckets['0-3 días'] += d.importe_total
    else if (dias <= 7) buckets['4-7 días'] += d.importe_total
    else if (dias <= 15) buckets['8-15 días'] += d.importe_total
    else if (dias <= 30) buckets['16-30 días'] += d.importe_total
    else buckets['30+ días'] += d.importe_total
  }
  cuentasCobrarData.value = Object.entries(buckets).map(([label, value]) => ({ label, value }))
}

// --- Desconexiones ----------------------------------------------------
type Desconexion = { client: string; old_status: string | null; new_status: string; changed_at: string }
const desconexiones = ref<Desconexion[]>([])

async function loadDesconexiones() {
  const { data, error } = await supabase
    .from('client_status_history')
    .select('old_status, new_status, changed_at, clients(first_name, last_name)')
    .in('new_status', ['suspended', 'cut'])
    .order('changed_at', { ascending: false })
    .limit(50)
  if (error) {
    errorMsg.value = error.message
    return
  }
  desconexiones.value = (data ?? []).map((d) => {
    const client = d.clients as unknown as { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
    const c = Array.isArray(client) ? client[0] : client
    return {
      client: c ? `${c.last_name} ${c.first_name}` : '—',
      old_status: d.old_status,
      new_status: d.new_status,
      changed_at: d.changed_at,
    }
  })
}

// --- Facturación 6 meses -------------------------------------------------
const facturacionData = ref<{ label: string; value: number }[]>([])

async function loadFacturacion6m() {
  const desde = new Date()
  desde.setMonth(desde.getMonth() - 5)
  desde.setDate(1)
  const { data, error } = await supabase
    .from('electronic_documents')
    .select('fecha_emision, importe_total')
    .eq('tipo_comprobante', '01')
    .neq('estado', 'BORRADOR')
    .gte('fecha_emision', desde.toISOString().slice(0, 10))
  if (error) {
    errorMsg.value = error.message
    return
  }
  const meses: { label: string; value: number; key: string }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    meses.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString('es-EC', { month: 'short', year: '2-digit' }), value: 0 })
  }
  for (const doc of data ?? []) {
    const key = doc.fecha_emision.slice(0, 7)
    const mes = meses.find((m) => m.key === key)
    if (mes) mes.value += doc.importe_total
  }
  facturacionData.value = meses.map(({ label, value }) => ({ label, value }))
}

async function loadAll() {
  loading.value = true
  errorMsg.value = ''
  await Promise.all([loadPlanes(), loadCuentasCobrar(), loadDesconexiones(), loadFacturacion6m()])
  loading.value = false
}

onMounted(loadAll)

const totalCuentasCobrar = computed(() => cuentasCobrarData.value.reduce((s, d) => s + d.value, 0))
</script>

<template>
  <div class="mx-auto max-w-3xl px-6 py-8">
    <div class="mb-6">
      <h1 class="text-xl font-semibold text-slate-900">Estadísticas</h1>
      <div class="mt-4 flex flex-wrap gap-1 border-b border-slate-200">
        <button
          class="border-b-2 px-3 py-2 text-sm font-medium"
          :class="tab === 'planes' ? 'border-teal-700 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'"
          @click="tab = 'planes'"
        >
          Planes más usados
        </button>
        <button
          class="border-b-2 px-3 py-2 text-sm font-medium"
          :class="tab === 'cuentas-cobrar' ? 'border-teal-700 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'"
          @click="tab = 'cuentas-cobrar'"
        >
          Cuentas por cobrar
        </button>
        <button
          class="border-b-2 px-3 py-2 text-sm font-medium"
          :class="tab === 'desconexiones' ? 'border-teal-700 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'"
          @click="tab = 'desconexiones'"
        >
          Desconexiones
        </button>
        <button
          class="border-b-2 px-3 py-2 text-sm font-medium"
          :class="tab === 'facturacion' ? 'border-teal-700 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'"
          @click="tab = 'facturacion'"
        >
          Facturación
        </button>
      </div>
    </div>

    <p v-if="errorMsg" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMsg }}</p>
    <div v-if="loading" class="text-sm text-slate-400">Cargando…</div>

    <template v-else>
      <section v-if="tab === 'planes'" class="rounded-xl border border-slate-200 bg-white p-6">
        <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Planes más usados (contratos activos)</h2>
        <SimpleBarChart :data="planesData" value-suffix=" clientes" />
      </section>

      <section v-else-if="tab === 'cuentas-cobrar'" class="rounded-xl border border-slate-200 bg-white p-6">
        <h2 class="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">Cuentas por cobrar por antigüedad</h2>
        <p class="mb-4 text-xs text-slate-500">Total pendiente: ${{ totalCuentasCobrar.toFixed(2) }}</p>
        <SimpleBarChart :data="cuentasCobrarData" value-prefix="$" />
      </section>

      <section v-else-if="tab === 'desconexiones'" class="rounded-xl border border-slate-200 bg-white p-6">
        <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Historial de desconexiones (últimas 50)</h2>
        <div v-if="!desconexiones.length" class="text-sm text-slate-400">Sin registros todavía.</div>
        <div class="overflow-x-auto">
          <table v-if="desconexiones.length" class="min-w-full divide-y divide-slate-200 text-sm">
            <thead class="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th class="py-2 pr-4">Cliente</th>
                <th class="py-2 pr-4">Cambio</th>
                <th class="py-2">Fecha</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="(d, i) in desconexiones" :key="i">
                <td class="py-2 pr-4 text-slate-900">{{ d.client }}</td>
                <td class="py-2 pr-4 text-slate-600">{{ d.old_status || '—' }} → {{ d.new_status }}</td>
                <td class="py-2 text-slate-600">{{ new Date(d.changed_at).toLocaleDateString('es-EC') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-else class="rounded-xl border border-slate-200 bg-white p-6">
        <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Facturación — últimos 6 meses</h2>
        <SimpleBarChart :data="facturacionData" value-prefix="$" />
      </section>
    </template>
  </div>
</template>
