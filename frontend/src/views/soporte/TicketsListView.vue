<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { PlusIcon } from '@heroicons/vue/24/outline'
import { RouterLink } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { normalizePhone, sendWhatsApp, ticketCreatedMessage } from '@/lib/whatsapp'
import type { Client, Profile, ServiceContract, SupportTicketWithClient, TicketPriority, TicketType } from '@/types/database'
import StatusBadge from '@/components/StatusBadge.vue'

const tickets = ref<SupportTicketWithClient[]>([])
const clients = ref<Client[]>([])
const staff = ref<Profile[]>([])
const clientContracts = ref<ServiceContract[]>([])

const loading = ref(true)
const errorMsg = ref('')
const saving = ref(false)
const showForm = ref(false)

const statusFilter = ref('')
const priorityFilter = ref('')

const TYPES: { value: TicketType; label: string }[] = [
  { value: 'incident', label: 'Incidente' },
  { value: 'request', label: 'Solicitud' },
  { value: 'billing', label: 'Facturación' },
  { value: 'complaint', label: 'Queja' },
  { value: 'other', label: 'Otro' },
]
const PRIORITIES: { value: TicketPriority; label: string }[] = [
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
]

const form = reactive({
  client_id: '',
  contract_id: '',
  type: 'incident' as TicketType,
  priority: 'medium' as TicketPriority,
  title: '',
  description: '',
  assigned_to: '',
})

function resetForm() {
  form.client_id = ''
  form.contract_id = ''
  form.type = 'incident'
  form.priority = 'medium'
  form.title = ''
  form.description = ''
  form.assigned_to = ''
  clientContracts.value = []
}

watch(
  () => form.client_id,
  async (clientId) => {
    form.contract_id = ''
    if (!clientId) {
      clientContracts.value = []
      return
    }
    const { data } = await supabase
      .from('service_contracts')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    clientContracts.value = (data ?? []) as ServiceContract[]
  },
)

async function loadTickets() {
  loading.value = true
  errorMsg.value = ''
  let query = supabase
    .from('support_tickets')
    .select('*, clients(first_name, last_name)')
    .order('created_at', { ascending: false })
  if (statusFilter.value) query = query.eq('status', statusFilter.value)
  if (priorityFilter.value) query = query.eq('priority', priorityFilter.value)
  const { data, error } = await query
  if (error) {
    errorMsg.value = error.message
  } else {
    tickets.value = (data ?? []) as unknown as SupportTicketWithClient[]
  }
  loading.value = false
}

async function loadLookups() {
  const [{ data: cl }, { data: st }] = await Promise.all([
    supabase.from('clients').select('*').order('last_name'),
    supabase.from('profiles').select('*').eq('role', 'staff').order('full_name'),
  ])
  clients.value = (cl ?? []) as Client[]
  staff.value = (st ?? []) as Profile[]
}

onMounted(async () => {
  await Promise.all([loadLookups(), loadTickets()])
})
watch([statusFilter, priorityFilter], loadTickets)

function openNew() {
  resetForm()
  showForm.value = true
}

async function onSave() {
  saving.value = true
  errorMsg.value = ''
  try {
    const payload = {
      client_id: form.client_id,
      contract_id: form.contract_id || null,
      type: form.type,
      priority: form.priority,
      title: form.title,
      description: form.description || null,
      assigned_to: form.assigned_to || null,
    }
    const { data, error } = await supabase.from('support_tickets').insert(payload).select('*').single()
    if (error) throw error

    showForm.value = false
    await loadTickets()

    // El WhatsApp de aviso es best-effort: si no está configurado (sin
    // credenciales de Meta todavía) no debe bloquear la creación del ticket.
    const client = clients.value.find((c) => c.id === form.client_id)
    const phone = client?.mobile ? normalizePhone(client.mobile) : null
    if (phone && client) {
      try {
        await sendWhatsApp(phone, ticketCreatedMessage(`${client.first_name} ${client.last_name}`, data.ticket_number, data.title))
      } catch {
        // silencioso a propósito — ver comentario arriba
      }
    }
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo crear el ticket'
  } finally {
    saving.value = false
  }
}

function clientName(t: SupportTicketWithClient) {
  return t.clients ? `${t.clients.last_name} ${t.clients.first_name}` : '—'
}
</script>

<template>
  <div class="mx-auto max-w-6xl px-6 py-8">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-slate-900">Tickets de soporte</h1>
        <p class="text-sm text-slate-500">{{ tickets.length }} tickets</p>
      </div>
      <button
        class="flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
        @click="openNew"
      >
        <PlusIcon class="h-4 w-4" />
        Nuevo ticket
      </button>
    </div>

    <p v-if="errorMsg" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMsg }}</p>

    <div v-if="showForm" class="mb-6 rounded-xl border border-slate-200 bg-white p-6">
      <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Nuevo ticket</h2>
      <form class="grid grid-cols-2 gap-4" @submit.prevent="onSave">
        <div class="col-span-2 space-y-1">
          <label class="text-sm font-medium text-slate-700">Cliente</label>
          <select v-model="form.client_id" required class="input">
            <option value="" disabled>Buscar cliente…</option>
            <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.last_name }} {{ c.first_name }}</option>
          </select>
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Contrato (opcional)</label>
          <select v-model="form.contract_id" :disabled="!form.client_id" class="input disabled:opacity-60">
            <option value="">Sin asociar</option>
            <option v-for="c in clientContracts" :key="c.id" :value="c.id">{{ c.contract_number }}</option>
          </select>
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Técnico asignado (opcional)</label>
          <select v-model="form.assigned_to" class="input">
            <option value="">Sin asignar</option>
            <option v-for="s in staff" :key="s.id" :value="s.id">{{ s.full_name || s.email }}</option>
          </select>
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Tipo</label>
          <select v-model="form.type" class="input">
            <option v-for="t in TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
          </select>
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Prioridad</label>
          <select v-model="form.priority" class="input">
            <option v-for="p in PRIORITIES" :key="p.value" :value="p.value">{{ p.label }}</option>
          </select>
        </div>
        <div class="col-span-2 space-y-1">
          <label class="text-sm font-medium text-slate-700">Título</label>
          <input v-model="form.title" required placeholder="Sin internet desde ayer" class="input" />
        </div>
        <div class="col-span-2 space-y-1">
          <label class="text-sm font-medium text-slate-700">Descripción</label>
          <textarea v-model="form.description" rows="3" class="input"></textarea>
        </div>
        <div class="col-span-2 flex justify-end gap-3">
          <button type="button" class="px-3 py-2 text-sm text-slate-600" @click="showForm = false">Cancelar</button>
          <button
            type="submit"
            :disabled="saving"
            class="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {{ saving ? 'Guardando…' : 'Crear ticket' }}
          </button>
        </div>
      </form>
    </div>

    <div class="mb-4 flex gap-3">
      <select v-model="statusFilter" class="input w-auto">
        <option value="">Todos los estados</option>
        <option value="open">Abierto</option>
        <option value="in_progress">En progreso</option>
        <option value="waiting_client">Esperando cliente</option>
        <option value="resolved">Resuelto</option>
        <option value="closed">Cerrado</option>
      </select>
      <select v-model="priorityFilter" class="input w-auto">
        <option value="">Todas las prioridades</option>
        <option v-for="p in PRIORITIES" :key="p.value" :value="p.value">{{ p.label }}</option>
      </select>
    </div>

    <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th class="px-4 py-3">#</th>
            <th class="px-4 py-3">Cliente</th>
            <th class="px-4 py-3">Título</th>
            <th class="px-4 py-3">Prioridad</th>
            <th class="px-4 py-3">Estado</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="loading">
            <td colspan="6" class="px-4 py-6 text-center text-slate-400">Cargando…</td>
          </tr>
          <tr v-else-if="!tickets.length">
            <td colspan="6" class="px-4 py-6 text-center text-slate-400">Sin tickets registrados</td>
          </tr>
          <tr v-for="t in tickets" :key="t.id" class="hover:bg-slate-50">
            <td class="px-4 py-3 font-mono text-xs text-slate-600">{{ t.ticket_number }}</td>
            <td class="px-4 py-3 text-slate-900">{{ clientName(t) }}</td>
            <td class="px-4 py-3 text-slate-600">{{ t.title }}</td>
            <td class="px-4 py-3"><StatusBadge :status="t.priority" /></td>
            <td class="px-4 py-3"><StatusBadge :status="t.status" /></td>
            <td class="px-4 py-3 text-right">
              <RouterLink :to="{ name: 'ticket-detail', params: { id: t.id } }" class="text-sm font-medium text-teal-700 hover:text-teal-900">
                Ver
              </RouterLink>
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
