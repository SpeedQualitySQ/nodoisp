<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { supabase } from '@/lib/supabase'
import type { SupportTicket, TicketUpdateRow } from '@/types/database'
import StatusBadge from '@/components/StatusBadge.vue'

const props = defineProps<{ id: string }>()

const ticket = ref<SupportTicket | null>(null)
const updates = ref<TicketUpdateRow[]>([])
const loading = ref(true)
const errorMsg = ref('')
const saving = ref(false)
const newBody = ref('')

async function loadTicket() {
  loading.value = true
  errorMsg.value = ''
  const [{ data: t, error: tErr }, { data: u }] = await Promise.all([
    supabase.from('support_tickets').select('*').eq('id', props.id).single(),
    // RLS ya excluye las notas internas para el portal — no hace falta
    // filtrar update_type acá.
    supabase.from('ticket_updates').select('*').eq('ticket_id', props.id).order('created_at', { ascending: true }),
  ])
  if (tErr) {
    errorMsg.value = tErr.message
    loading.value = false
    return
  }
  ticket.value = t as SupportTicket
  updates.value = (u ?? []) as TicketUpdateRow[]
  loading.value = false
}

onMounted(loadTicket)

// Mismo motivo que en ClientFormView.vue / TicketDetailView.vue: ruta
// dinámica, Vue Router reutiliza la instancia si se navega entre tickets.
watch(
  () => props.id,
  () => {
    newBody.value = ''
    loadTicket()
  },
)

async function onReply() {
  if (!ticket.value || !newBody.value.trim()) return
  saving.value = true
  errorMsg.value = ''
  try {
    const { error } = await supabase.from('ticket_updates').insert({
      ticket_id: ticket.value.id,
      update_type: 'reply',
      body: newBody.value,
    })
    if (error) throw error
    newBody.value = ''
    await loadTicket()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo enviar la respuesta'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl px-6 py-8">
    <div v-if="loading" class="text-sm text-slate-400">Cargando…</div>
    <div v-else-if="!ticket" class="text-sm text-slate-400">No se encontró el ticket.</div>

    <template v-else>
      <div class="mb-6 flex items-center justify-between">
        <div>
          <p class="font-mono text-xs text-slate-500">#{{ ticket.ticket_number }}</p>
          <h1 class="text-xl font-semibold text-slate-900">{{ ticket.title }}</h1>
        </div>
        <StatusBadge :status="ticket.status" />
      </div>

      <p v-if="errorMsg" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMsg }}</p>
      <p v-if="ticket.description" class="mb-6 text-sm text-slate-600">{{ ticket.description }}</p>

      <div class="mb-6 space-y-3">
        <div v-if="!updates.length" class="text-sm text-slate-400">Todavía sin respuestas.</div>
        <div v-for="u in updates" :key="u.id" class="rounded-lg border border-slate-100 bg-white p-3">
          <p class="mb-1 text-xs text-slate-400">{{ new Date(u.created_at).toLocaleString('es-EC') }}</p>
          <p class="text-sm text-slate-700">{{ u.body }}</p>
        </div>
      </div>

      <form class="space-y-3" @submit.prevent="onReply">
        <textarea v-model="newBody" rows="3" placeholder="Escribir un mensaje…" class="input"></textarea>
        <div class="flex justify-end">
          <button
            type="submit"
            :disabled="saving || !newBody.trim()"
            class="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {{ saving ? 'Enviando…' : 'Responder' }}
          </button>
        </div>
      </form>
    </template>
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.input {
  @apply w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600;
}
</style>
