<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { supabase } from '@/lib/supabase'
import type { ClientStatus, SupportTicketWithClient } from '@/types/database'
import StatusBadge from '@/components/StatusBadge.vue'

const loading = ref(true)
const errorMsg = ref('')

const clientCounts = ref<Record<ClientStatus, number>>({
  prospect: 0,
  pending: 0,
  active: 0,
  suspended: 0,
  cut: 0,
  retired: 0,
})
const activeContracts = ref(0)
const openTickets = ref(0)
const urgentTickets = ref(0)
const facturadoMes = ref(0)
const cobradoMes = ref(0)
const oltOnline = ref(0)
const oltTotal = ref(0)
const mikrotikOnline = ref(0)
const mikrotikTotal = ref(0)
const recentTickets = ref<SupportTicketWithClient[]>([])
const recentClients = ref<{ id: string; first_name: string; last_name: string; status: ClientStatus; created_at: string }[]>([])

const pendienteMes = computed(() => facturadoMes.value - cobradoMes.value)
const totalClientes = computed(() => Object.values(clientCounts.value).reduce((a, b) => a + b, 0))

async function loadDashboard() {
  loading.value = true
  errorMsg.value = ''
  try {
    const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

    const [
      { data: clients, error: clientsError },
      { count: contractsCount },
      { data: tickets, error: ticketsError },
      { data: invoices, error: invoicesError },
      { data: olts },
      { data: mikrotiks },
      { data: lastTickets },
      { data: lastClients },
    ] = await Promise.all([
      supabase.from('clients').select('status'),
      supabase.from('service_contracts').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('support_tickets').select('status, priority'),
      supabase
        .from('electronic_documents')
        .select('importe_total, paid_at')
        .eq('tipo_comprobante', '01')
        .neq('estado', 'BORRADOR')
        .gte('fecha_emision', firstOfMonth),
      supabase.from('olt_devices').select('status'),
      supabase.from('mikrotik_devices').select('status'),
      supabase
        .from('support_tickets')
        .select('*, clients(first_name, last_name)')
        .order('created_at', { ascending: false })
        .limit(5),
      supabase.from('clients').select('id, first_name, last_name, status, created_at').order('created_at', { ascending: false }).limit(5),
    ])

    if (clientsError) throw clientsError
    if (ticketsError) throw ticketsError
    if (invoicesError) throw invoicesError

    const counts: Record<ClientStatus, number> = { prospect: 0, pending: 0, active: 0, suspended: 0, cut: 0, retired: 0 }
    for (const c of clients ?? []) counts[c.status as ClientStatus]++
    clientCounts.value = counts

    activeContracts.value = contractsCount ?? 0

    openTickets.value = (tickets ?? []).filter((t) => !['resolved', 'closed'].includes(t.status)).length
    urgentTickets.value = (tickets ?? []).filter((t) => t.priority === 'urgent' && !['resolved', 'closed'].includes(t.status)).length

    facturadoMes.value = (invoices ?? []).reduce((sum, d) => sum + d.importe_total, 0)
    cobradoMes.value = (invoices ?? []).filter((d) => d.paid_at).reduce((sum, d) => sum + d.importe_total, 0)

    oltTotal.value = olts?.length ?? 0
    oltOnline.value = (olts ?? []).filter((o) => o.status === 'online').length
    mikrotikTotal.value = mikrotiks?.length ?? 0
    mikrotikOnline.value = (mikrotiks ?? []).filter((m) => m.status === 'online').length

    recentTickets.value = (lastTickets ?? []) as unknown as SupportTicketWithClient[]
    recentClients.value = (lastClients ?? []) as typeof recentClients.value
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo cargar el dashboard'
  } finally {
    loading.value = false
  }
}

onMounted(loadDashboard)
</script>

<template>
  <div class="mx-auto max-w-6xl px-6 py-8">
    <h1 class="mb-6 text-xl font-semibold text-slate-900">Dashboard</h1>

    <p v-if="errorMsg" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMsg }}</p>
    <div v-if="loading" class="text-sm text-slate-400">Cargando…</div>

    <template v-else>
      <div class="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div class="rounded-xl border border-slate-200 bg-white p-5">
          <p class="text-xs font-medium uppercase tracking-wide text-slate-500">Clientes activos</p>
          <p class="mt-1 text-2xl font-semibold text-teal-700">{{ clientCounts.active }}</p>
          <p class="text-xs text-slate-400">{{ totalClientes }} en total</p>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-5">
          <p class="text-xs font-medium uppercase tracking-wide text-slate-500">Suspendidos / Cortados</p>
          <p class="mt-1 text-2xl font-semibold text-orange-600">{{ clientCounts.suspended + clientCounts.cut }}</p>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-5">
          <p class="text-xs font-medium uppercase tracking-wide text-slate-500">Contratos activos</p>
          <p class="mt-1 text-2xl font-semibold text-slate-900">{{ activeContracts }}</p>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-5">
          <p class="text-xs font-medium uppercase tracking-wide text-slate-500">Tickets abiertos</p>
          <p class="mt-1 text-2xl font-semibold text-slate-900">{{ openTickets }}</p>
          <p v-if="urgentTickets" class="text-xs text-red-600">{{ urgentTickets }} urgentes</p>
        </div>
      </div>

      <div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <section class="rounded-xl border border-slate-200 bg-white p-6">
          <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Facturación del mes</h2>
          <dl class="grid grid-cols-3 gap-4 text-sm">
            <div>
              <dt class="text-slate-500">Facturado</dt>
              <dd class="text-lg font-semibold text-slate-900">${{ facturadoMes.toFixed(2) }}</dd>
            </div>
            <div>
              <dt class="text-slate-500">Cobrado</dt>
              <dd class="text-lg font-semibold text-teal-700">${{ cobradoMes.toFixed(2) }}</dd>
            </div>
            <div>
              <dt class="text-slate-500">Pendiente</dt>
              <dd class="text-lg font-semibold text-amber-600">${{ pendienteMes.toFixed(2) }}</dd>
            </div>
          </dl>
        </section>

        <section class="rounded-xl border border-slate-200 bg-white p-6">
          <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Estado de red</h2>
          <dl class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt class="text-slate-500">OLTs en línea</dt>
              <dd class="text-lg font-semibold text-slate-900">{{ oltOnline }} / {{ oltTotal }}</dd>
            </div>
            <div>
              <dt class="text-slate-500">MikroTik en línea</dt>
              <dd class="text-lg font-semibold text-slate-900">{{ mikrotikOnline }} / {{ mikrotikTotal }}</dd>
            </div>
          </dl>
        </section>
      </div>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section class="rounded-xl border border-slate-200 bg-white p-6">
          <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Últimos tickets</h2>
          <div v-if="!recentTickets.length" class="text-sm text-slate-400">Sin tickets todavía.</div>
          <RouterLink
            v-for="t in recentTickets"
            :key="t.id"
            :to="{ name: 'ticket-detail', params: { id: t.id } }"
            class="mb-2 flex items-center justify-between rounded-lg px-2 py-2 text-sm last:mb-0 hover:bg-slate-50"
          >
            <div>
              <p class="text-slate-900">{{ t.title }}</p>
              <p class="text-xs text-slate-400">{{ t.clients ? `${t.clients.last_name} ${t.clients.first_name}` : '—' }}</p>
            </div>
            <StatusBadge :status="t.status" />
          </RouterLink>
        </section>

        <section class="rounded-xl border border-slate-200 bg-white p-6">
          <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Últimos clientes</h2>
          <div v-if="!recentClients.length" class="text-sm text-slate-400">Sin clientes todavía.</div>
          <RouterLink
            v-for="c in recentClients"
            :key="c.id"
            :to="{ name: 'client-edit', params: { id: c.id } }"
            class="mb-2 flex items-center justify-between rounded-lg px-2 py-2 text-sm last:mb-0 hover:bg-slate-50"
          >
            <p class="text-slate-900">{{ c.last_name }} {{ c.first_name }}</p>
            <StatusBadge :status="c.status" />
          </RouterLink>
        </section>
      </div>
    </template>
  </div>
</template>
