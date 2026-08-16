<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { PlusIcon } from '@heroicons/vue/24/outline'
import { supabase } from '@/lib/supabase'
import type { OltIpPool } from '@/types/database'

const pools = ref<OltIpPool[]>([])
const loading = ref(true)
const errorMsg = ref('')
const saving = ref(false)
const editingId = ref<string | null>(null)
const showForm = ref(false)

const form = reactive({
  name: '',
  network: '',
  gateway: '',
  dns_primary: '8.8.8.8',
  dns_secondary: '8.8.4.4',
  range_start: '',
  range_end: '',
  vlan_id: null as number | null,
})

function resetForm() {
  editingId.value = null
  form.name = ''
  form.network = ''
  form.gateway = ''
  form.dns_primary = '8.8.8.8'
  form.dns_secondary = '8.8.4.4'
  form.range_start = ''
  form.range_end = ''
  form.vlan_id = null
}

function openNew() {
  resetForm()
  showForm.value = true
}

function openEdit(pool: OltIpPool) {
  editingId.value = pool.id
  form.name = pool.name
  form.network = pool.network
  form.gateway = pool.gateway
  form.dns_primary = pool.dns_primary
  form.dns_secondary = pool.dns_secondary ?? ''
  form.range_start = pool.range_start
  form.range_end = pool.range_end
  form.vlan_id = pool.vlan_id
  showForm.value = true
}

async function loadPools() {
  loading.value = true
  errorMsg.value = ''
  const { data, error } = await supabase.from('olt_ip_pools').select('*').order('name')
  if (error) {
    errorMsg.value = error.message
  } else {
    pools.value = (data ?? []) as OltIpPool[]
  }
  loading.value = false
}

onMounted(loadPools)

async function onSave() {
  saving.value = true
  errorMsg.value = ''
  try {
    const payload = { ...form, dns_secondary: form.dns_secondary || null }
    if (editingId.value) {
      const { error } = await supabase.from('olt_ip_pools').update(payload).eq('id', editingId.value)
      if (error) throw error
    } else {
      const { error } = await supabase.from('olt_ip_pools').insert(payload)
      if (error) throw error
    }
    showForm.value = false
    await loadPools()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo guardar el IP pool'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-6 py-8">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-slate-900">IP Pools</h1>
        <p class="text-sm text-slate-500">{{ pools.length }} rangos configurados</p>
      </div>
      <button
        class="flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
        @click="openNew"
      >
        <PlusIcon class="h-4 w-4" />
        Nuevo pool
      </button>
    </div>

    <p v-if="errorMsg" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMsg }}</p>

    <div v-if="showForm" class="mb-6 rounded-xl border border-slate-200 bg-white p-6">
      <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {{ editingId ? 'Editar IP pool' : 'Nuevo IP pool' }}
      </h2>
      <form class="grid grid-cols-3 gap-4" @submit.prevent="onSave">
        <div class="col-span-3 space-y-1">
          <label class="text-sm font-medium text-slate-700">Nombre</label>
          <input v-model="form.name" required placeholder="POOL-CLIENTES-01" class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Red</label>
          <input v-model="form.network" required placeholder="192.168.10.0/24" class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Gateway</label>
          <input v-model="form.gateway" required placeholder="192.168.10.1" class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">VLAN asociada</label>
          <input v-model.number="form.vlan_id" type="number" min="1" max="4094" class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Rango inicio</label>
          <input v-model="form.range_start" required placeholder="192.168.10.100" class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Rango fin</label>
          <input v-model="form.range_end" required placeholder="192.168.10.200" class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">DNS primario</label>
          <input v-model="form.dns_primary" required class="input" />
        </div>
        <div class="col-span-2 space-y-1">
          <label class="text-sm font-medium text-slate-700">DNS secundario</label>
          <input v-model="form.dns_secondary" class="input" />
        </div>
        <div class="col-span-3 flex justify-end gap-3">
          <button type="button" class="px-3 py-2 text-sm text-slate-600" @click="showForm = false">
            Cancelar
          </button>
          <button
            type="submit"
            :disabled="saving"
            class="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          >
            Guardar
          </button>
        </div>
      </form>
    </div>

    <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th class="px-4 py-3">Nombre</th>
            <th class="px-4 py-3">Red</th>
            <th class="px-4 py-3">Gateway</th>
            <th class="px-4 py-3">Rango</th>
            <th class="px-4 py-3">VLAN</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="loading">
            <td colspan="6" class="px-4 py-6 text-center text-slate-400">Cargando…</td>
          </tr>
          <tr v-else-if="!pools.length">
            <td colspan="6" class="px-4 py-6 text-center text-slate-400">Sin IP pools registrados</td>
          </tr>
          <tr v-for="p in pools" :key="p.id" class="hover:bg-slate-50">
            <td class="px-4 py-3 font-medium text-slate-900">{{ p.name }}</td>
            <td class="px-4 py-3 font-mono text-xs text-slate-600">{{ p.network }}</td>
            <td class="px-4 py-3 font-mono text-xs text-slate-600">{{ p.gateway }}</td>
            <td class="px-4 py-3 font-mono text-xs text-slate-600">{{ p.range_start }} – {{ p.range_end }}</td>
            <td class="px-4 py-3 tabular-nums text-slate-600">{{ p.vlan_id ?? '—' }}</td>
            <td class="px-4 py-3 text-right">
              <button class="text-sm font-medium text-teal-700 hover:text-teal-900" @click="openEdit(p)">
                Editar
              </button>
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
