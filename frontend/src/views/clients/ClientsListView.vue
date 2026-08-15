<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { PlusIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import { supabase } from '@/lib/supabase'
import type { ClientStatus, ClientWithContract } from '@/types/database'
import StatusBadge from '@/components/StatusBadge.vue'

const clients = ref<ClientWithContract[]>([])
const loading = ref(true)
const errorMsg = ref('')
const search = ref('')
const statusFilter = ref<ClientStatus | ''>('')

const STATUSES: ClientStatus[] = ['prospect', 'pending', 'active', 'suspended', 'cut', 'retired']

async function loadClients() {
  loading.value = true
  errorMsg.value = ''
  const { data, error } = await supabase
    .from('clients_with_contract')
    .select('*')
    .order('first_name')
  if (error) {
    errorMsg.value = error.message
  } else {
    clients.value = (data ?? []) as ClientWithContract[]
  }
  loading.value = false
}

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()
  return clients.value.filter((c) => {
    const matchesStatus = !statusFilter.value || c.status === statusFilter.value
    const matchesTerm =
      !term ||
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(term) ||
      c.identification.toLowerCase().includes(term)
    return matchesStatus && matchesTerm
  })
})

onMounted(loadClients)
</script>

<template>
  <div class="mx-auto max-w-6xl px-6 py-8">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-slate-900">Clientes</h1>
        <p class="text-sm text-slate-500">{{ filtered.length }} de {{ clients.length }} clientes</p>
      </div>
      <RouterLink
        :to="{ name: 'client-new' }"
        class="flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
      >
        <PlusIcon class="h-4 w-4" />
        Nuevo cliente
      </RouterLink>
    </div>

    <div class="mb-4 flex gap-3">
      <div class="relative flex-1">
        <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input
          v-model="search"
          type="text"
          placeholder="Buscar por nombre o cédula/RUC…"
          class="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
        />
      </div>
      <select
        v-model="statusFilter"
        class="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
      >
        <option value="">Todos los estados</option>
        <option v-for="s in STATUSES" :key="s" :value="s">{{ s }}</option>
      </select>
    </div>

    <p v-if="errorMsg" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      {{ errorMsg }}
    </p>

    <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th class="px-4 py-3">Cliente</th>
            <th class="px-4 py-3">Cédula/RUC</th>
            <th class="px-4 py-3">Contacto</th>
            <th class="px-4 py-3">Plan</th>
            <th class="px-4 py-3">Estado</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="loading">
            <td colspan="6" class="px-4 py-6 text-center text-slate-400">Cargando…</td>
          </tr>
          <tr v-else-if="!filtered.length">
            <td colspan="6" class="px-4 py-6 text-center text-slate-400">Sin resultados</td>
          </tr>
          <tr v-for="c in filtered" :key="c.id" class="hover:bg-slate-50">
            <td class="px-4 py-3 font-medium text-slate-900">{{ c.first_name }} {{ c.last_name }}</td>
            <td class="px-4 py-3 tabular-nums text-slate-600">{{ c.identification }}</td>
            <td class="px-4 py-3 text-slate-600">{{ c.mobile || c.email || '—' }}</td>
            <td class="px-4 py-3 text-slate-600">{{ c.plan_name || '—' }}</td>
            <td class="px-4 py-3"><StatusBadge :status="c.status" /></td>
            <td class="px-4 py-3 text-right">
              <RouterLink
                :to="{ name: 'client-edit', params: { id: c.id } }"
                class="text-sm font-medium text-teal-700 hover:text-teal-900"
              >
                Editar
              </RouterLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
