<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { PlusIcon } from '@heroicons/vue/24/outline'
import { supabase } from '@/lib/supabase'
import type { Client, Profile } from '@/types/database'
import StatusBadge from '@/components/StatusBadge.vue'

const portalUsers = ref<(Profile & { clients: { first_name: string; last_name: string } | null })[]>([])
const clients = ref<Client[]>([])
const loading = ref(true)
const errorMsg = ref('')
const saving = ref(false)
const showForm = ref(false)

const form = reactive({ email: '', client_id: '' })

async function loadPortalUsers() {
  loading.value = true
  errorMsg.value = ''
  const { data, error } = await supabase
    .from('profiles')
    .select('*, clients(first_name, last_name)')
    .eq('role', 'cliente_portal')
    .order('email')
  if (error) {
    errorMsg.value = error.message
  } else {
    portalUsers.value = (data ?? []) as unknown as (Profile & { clients: { first_name: string; last_name: string } | null })[]
  }
  loading.value = false
}

async function loadClients() {
  const { data } = await supabase.from('clients').select('*').order('last_name')
  clients.value = (data ?? []) as Client[]
}

onMounted(async () => {
  await Promise.all([loadClients(), loadPortalUsers()])
})

function openNew() {
  form.email = ''
  form.client_id = ''
  showForm.value = true
}

async function onCrear() {
  saving.value = true
  errorMsg.value = ''
  try {
    const res = await fetch('/api/portal/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.email, client_id: form.client_id }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error || `Error ${res.status}`)
    showForm.value = false
    await loadPortalUsers()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo crear el usuario de portal'
  } finally {
    saving.value = false
  }
}

function clientName(u: Profile & { clients: { first_name: string; last_name: string } | null }) {
  return u.clients ? `${u.clients.last_name} ${u.clients.first_name}` : '—'
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-6 py-8">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-slate-900">Usuarios del portal</h1>
        <p class="text-sm text-slate-500">{{ portalUsers.length }} clientes con acceso</p>
      </div>
      <button
        class="flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
        @click="openNew"
      >
        <PlusIcon class="h-4 w-4" />
        Nuevo usuario
      </button>
    </div>

    <p v-if="errorMsg" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMsg }}</p>

    <div v-if="showForm" class="mb-6 rounded-xl border border-slate-200 bg-white p-6">
      <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Nuevo usuario de portal</h2>
      <form class="grid grid-cols-2 gap-4" @submit.prevent="onCrear">
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Cliente</label>
          <select v-model="form.client_id" required class="input">
            <option value="" disabled>Buscar cliente…</option>
            <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.last_name }} {{ c.first_name }}</option>
          </select>
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Correo</label>
          <input v-model="form.email" type="email" required class="input" />
        </div>
        <div class="col-span-2 flex justify-end gap-3">
          <button type="button" class="px-3 py-2 text-sm text-slate-600" @click="showForm = false">Cancelar</button>
          <button
            type="submit"
            :disabled="saving"
            class="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {{ saving ? 'Creando…' : 'Crear e invitar' }}
          </button>
        </div>
      </form>
    </div>

    <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th class="px-4 py-3">Cliente</th>
            <th class="px-4 py-3">Correo</th>
            <th class="px-4 py-3">Estado</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="loading">
            <td colspan="3" class="px-4 py-6 text-center text-slate-400">Cargando…</td>
          </tr>
          <tr v-else-if="!portalUsers.length">
            <td colspan="3" class="px-4 py-6 text-center text-slate-400">Sin usuarios de portal todavía</td>
          </tr>
          <tr v-for="u in portalUsers" :key="u.id" class="hover:bg-slate-50">
            <td class="px-4 py-3 text-slate-900">{{ clientName(u) }}</td>
            <td class="px-4 py-3 text-slate-600">{{ u.email }}</td>
            <td class="px-4 py-3"><StatusBadge status="active" /></td>
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
