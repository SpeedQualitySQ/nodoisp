<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import type { SupportTicket, TicketType } from '@/types/database'
import StatusBadge from '@/components/StatusBadge.vue'

const auth = useAuthStore()
const tickets = ref<SupportTicket[]>([])
const loading = ref(true)
const errorMsg = ref('')
const saving = ref(false)
const showForm = ref(false)

const TYPES: { value: TicketType; label: string }[] = [
  { value: 'incident', label: 'Problema técnico' },
  { value: 'request', label: 'Solicitud' },
  { value: 'billing', label: 'Facturación' },
  { value: 'complaint', label: 'Queja' },
  { value: 'other', label: 'Otro' },
]

const form = reactive({ type: 'incident' as TicketType, title: '', description: '' })

async function loadTickets() {
  loading.value = true
  errorMsg.value = ''
  // RLS ya filtra por client_id del profile del usuario portal conectado —
  // acá no hace falta (ni se puede) elegir el cliente.
  const { data, error } = await supabase.from('support_tickets').select('*').order('created_at', { ascending: false })
  if (error) {
    errorMsg.value = error.message
  } else {
    tickets.value = (data ?? []) as SupportTicket[]
  }
  loading.value = false
}

onMounted(loadTickets)

function openNew() {
  form.type = 'incident'
  form.title = ''
  form.description = ''
  showForm.value = true
}

async function onCrear() {
  if (!auth.profile?.client_id) return
  saving.value = true
  errorMsg.value = ''
  try {
    const { error } = await supabase.from('support_tickets').insert({
      client_id: auth.profile.client_id,
      type: form.type,
      title: form.title,
      description: form.description || null,
    })
    if (error) throw error
    showForm.value = false
    await loadTickets()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo crear el ticket'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-6 py-8">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-xl font-semibold text-slate-900">Mis tickets</h1>
      <button
        class="rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
        @click="openNew"
      >
        Nuevo ticket
      </button>
    </div>

    <p v-if="errorMsg" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMsg }}</p>

    <div v-if="showForm" class="mb-6 rounded-xl border border-slate-200 bg-white p-6">
      <form class="space-y-4" @submit.prevent="onCrear">
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Tipo</label>
          <select v-model="form.type" class="input">
            <option v-for="t in TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
          </select>
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Título</label>
          <input v-model="form.title" required placeholder="Sin internet desde ayer" class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Descripción</label>
          <textarea v-model="form.description" rows="3" class="input"></textarea>
        </div>
        <div class="flex justify-end gap-3">
          <button type="button" class="px-3 py-2 text-sm text-slate-600" @click="showForm = false">Cancelar</button>
          <button
            type="submit"
            :disabled="saving"
            class="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {{ saving ? 'Enviando…' : 'Enviar' }}
          </button>
        </div>
      </form>
    </div>

    <div class="space-y-3">
      <div v-if="loading" class="text-sm text-slate-400">Cargando…</div>
      <p v-else-if="!tickets.length" class="text-sm text-slate-400">No tenés tickets registrados.</p>
      <RouterLink
        v-for="t in tickets"
        :key="t.id"
        :to="{ name: 'portal-ticket-detail', params: { id: t.id } }"
        class="block rounded-xl border border-slate-200 bg-white p-4 hover:border-teal-300"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="font-mono text-xs text-slate-500">#{{ t.ticket_number }}</p>
            <p class="font-medium text-slate-900">{{ t.title }}</p>
          </div>
          <StatusBadge :status="t.status" />
        </div>
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.input {
  @apply w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600;
}
</style>
