<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { supabase } from '@/lib/supabase'
import { normalizePhone, sendWhatsApp, ticketReplyMessage, ticketStatusMessage } from '@/lib/whatsapp'
import type { Client, Profile, SupportTicket, TicketPriority, TicketStatus, TicketUpdateRow } from '@/types/database'
import StatusBadge from '@/components/StatusBadge.vue'

const props = defineProps<{ id: string }>()

const ticket = ref<SupportTicket | null>(null)
const client = ref<Client | null>(null)
const updates = ref<TicketUpdateRow[]>([])
const staff = ref<Profile[]>([])

const loading = ref(true)
const errorMsg = ref('')
const saving = ref(false)

const newUpdate = reactive({ body: '', type: 'reply' as 'reply' | 'internal' })

const STATUSES: { value: TicketStatus; label: string }[] = [
  { value: 'open', label: 'Abierto' },
  { value: 'in_progress', label: 'En progreso' },
  { value: 'waiting_client', label: 'Esperando cliente' },
  { value: 'resolved', label: 'Resuelto' },
  { value: 'closed', label: 'Cerrado' },
]
const PRIORITIES: { value: TicketPriority; label: string }[] = [
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
]

async function loadTicket() {
  loading.value = true
  errorMsg.value = ''
  const [{ data: t, error: tErr }, { data: u }] = await Promise.all([
    supabase.from('support_tickets').select('*').eq('id', props.id).single(),
    supabase.from('ticket_updates').select('*').eq('ticket_id', props.id).order('created_at', { ascending: true }),
  ])
  if (tErr) {
    errorMsg.value = tErr.message
    loading.value = false
    return
  }
  ticket.value = t as SupportTicket
  updates.value = (u ?? []) as TicketUpdateRow[]
  if (t) {
    const { data: c } = await supabase.from('clients').select('*').eq('id', t.client_id).single()
    client.value = c as Client
  }
  loading.value = false
}

async function loadStaff() {
  const { data } = await supabase.from('profiles').select('*').eq('role', 'staff').order('full_name')
  staff.value = (data ?? []) as Profile[]
}

onMounted(async () => {
  await Promise.all([loadStaff(), loadTicket()])
})

// Mismo motivo que en ClientFormView.vue: si se navega de un ticket a otro
// sin pasar por /soporte en el medio, Vue Router reutiliza esta instancia y
// onMounted no vuelve a disparar.
watch(
  () => props.id,
  () => {
    newUpdate.body = ''
    loadTicket()
  },
)

const clientName = computed(() => (client.value ? `${client.value.last_name} ${client.value.first_name}` : '—'))

async function notifyClient(message: string) {
  const phone = client.value?.mobile ? normalizePhone(client.value.mobile) : null
  if (!phone) return
  try {
    await sendWhatsApp(phone, message)
  } catch {
    // best-effort — sin credenciales de Meta configuradas esto va a fallar
    // siempre, y no debe bloquear la acción del ticket en sí.
  }
}

async function onAddUpdate() {
  if (!ticket.value || !newUpdate.body.trim()) return
  saving.value = true
  errorMsg.value = ''
  try {
    const { error } = await supabase.from('ticket_updates').insert({
      ticket_id: ticket.value.id,
      update_type: newUpdate.type,
      body: newUpdate.body,
    })
    if (error) throw error
    if (newUpdate.type === 'reply') {
      await notifyClient(ticketReplyMessage(clientName.value, ticket.value.ticket_number, newUpdate.body))
    }
    newUpdate.body = ''
    await loadTicket()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo agregar la actualización'
  } finally {
    saving.value = false
  }
}

async function onChangeStatus(status: TicketStatus) {
  if (!ticket.value) return
  saving.value = true
  errorMsg.value = ''
  try {
    const { error } = await supabase.from('support_tickets').update({ status }).eq('id', ticket.value.id)
    if (error) throw error
    await notifyClient(ticketStatusMessage(ticket.value.ticket_number, status))
    await loadTicket()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo cambiar el estado'
  } finally {
    saving.value = false
  }
}

async function onChangePriority(priority: TicketPriority) {
  if (!ticket.value) return
  const { error } = await supabase.from('support_tickets').update({ priority }).eq('id', ticket.value.id)
  if (error) {
    errorMsg.value = error.message
  } else {
    await loadTicket()
  }
}

async function onChangeAssigned(assignedTo: string) {
  if (!ticket.value) return
  const { error } = await supabase
    .from('support_tickets')
    .update({ assigned_to: assignedTo || null })
    .eq('id', ticket.value.id)
  if (error) {
    errorMsg.value = error.message
  } else {
    await loadTicket()
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-6 py-8">
    <div v-if="loading" class="text-sm text-slate-400">Cargando…</div>
    <div v-else-if="!ticket" class="text-sm text-slate-400">No se encontró el ticket.</div>

    <template v-else>
      <div class="mb-6">
        <p class="font-mono text-xs text-slate-500">#{{ ticket.ticket_number }}</p>
        <h1 class="text-xl font-semibold text-slate-900">{{ ticket.title }}</h1>
        <p class="text-sm text-slate-500">{{ clientName }}</p>
      </div>

      <p v-if="errorMsg" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMsg }}</p>

      <section class="mb-6 rounded-xl border border-slate-200 bg-white p-6">
        <div class="grid grid-cols-3 gap-4">
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Estado</label>
            <select :value="ticket.status" class="input" @change="onChangeStatus(($event.target as HTMLSelectElement).value as TicketStatus)">
              <option v-for="s in STATUSES" :key="s.value" :value="s.value">{{ s.label }}</option>
            </select>
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Prioridad</label>
            <select :value="ticket.priority" class="input" @change="onChangePriority(($event.target as HTMLSelectElement).value as TicketPriority)">
              <option v-for="p in PRIORITIES" :key="p.value" :value="p.value">{{ p.label }}</option>
            </select>
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Técnico asignado</label>
            <select :value="ticket.assigned_to ?? ''" class="input" @change="onChangeAssigned(($event.target as HTMLSelectElement).value)">
              <option value="">Sin asignar</option>
              <option v-for="s in staff" :key="s.id" :value="s.id">{{ s.full_name || s.email }}</option>
            </select>
          </div>
        </div>
        <p v-if="ticket.description" class="mt-4 text-sm text-slate-600">{{ ticket.description }}</p>
      </section>

      <section class="mb-6 rounded-xl border border-slate-200 bg-white p-6">
        <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Historial</h2>
        <div v-if="!updates.length" class="text-sm text-slate-400">Sin actualizaciones todavía.</div>
        <div v-for="u in updates" :key="u.id" class="mb-3 rounded-lg border border-slate-100 p-3 last:mb-0">
          <div class="mb-1 flex items-center justify-between">
            <StatusBadge :status="u.update_type" />
            <span class="text-xs text-slate-400">{{ new Date(u.created_at).toLocaleString('es-EC') }}</span>
          </div>
          <p class="text-sm text-slate-700">{{ u.body }}</p>
        </div>

        <form class="mt-4 space-y-3" @submit.prevent="onAddUpdate">
          <textarea v-model="newUpdate.body" rows="3" placeholder="Escribir respuesta o nota…" class="input"></textarea>
          <div class="flex items-center justify-between">
            <label class="flex items-center gap-2 text-sm text-slate-600">
              <input v-model="newUpdate.type" type="radio" value="reply" />
              Respuesta (la ve el cliente)
            </label>
            <label class="flex items-center gap-2 text-sm text-slate-600">
              <input v-model="newUpdate.type" type="radio" value="internal" />
              Nota interna
            </label>
            <button
              type="submit"
              :disabled="saving || !newUpdate.body.trim()"
              class="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
            >
              {{ saving ? 'Guardando…' : 'Agregar' }}
            </button>
          </div>
        </form>
      </section>
    </template>
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.input {
  @apply w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600;
}
</style>
