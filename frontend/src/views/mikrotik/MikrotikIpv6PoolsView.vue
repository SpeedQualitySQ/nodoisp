<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { PlusIcon } from '@heroicons/vue/24/outline'
import { supabase } from '@/lib/supabase'
import { generarComandoIpv6Pool } from '@/lib/mikrotik'
import type { MikrotikDevice, MikrotikIpv6Pool } from '@/types/database'

const devices = ref<MikrotikDevice[]>([])
const selectedMikrotikId = ref<string | null>(null)
const pools = ref<MikrotikIpv6Pool[]>([])
const loading = ref(true)
const errorMsg = ref('')
const saving = ref(false)
const editingId = ref<string | null>(null)
const showForm = ref(false)
const comandoPreview = ref('')

const form = reactive({
  name: '',
  prefix: '',
  prefix_length: 56,
  interface_name: '',
})

function resetForm() {
  editingId.value = null
  form.name = ''
  form.prefix = ''
  form.prefix_length = 56
  form.interface_name = ''
}

function openNew() {
  resetForm()
  comandoPreview.value = ''
  showForm.value = true
}

function openEdit(pool: MikrotikIpv6Pool) {
  editingId.value = pool.id
  form.name = pool.name
  form.prefix = pool.prefix
  form.prefix_length = pool.prefix_length
  form.interface_name = pool.interface_name ?? ''
  comandoPreview.value = ''
  showForm.value = true
}

async function loadDevices() {
  const { data, error } = await supabase.from('mikrotik_devices').select('*').order('name')
  if (error) {
    errorMsg.value = error.message
    return
  }
  devices.value = (data ?? []) as MikrotikDevice[]
  if (devices.value.length && !selectedMikrotikId.value) {
    selectedMikrotikId.value = devices.value[0].id
  }
}

async function loadPools() {
  if (!selectedMikrotikId.value) {
    pools.value = []
    loading.value = false
    return
  }
  loading.value = true
  errorMsg.value = ''
  const { data, error } = await supabase
    .from('mikrotik_ipv6_pools')
    .select('*')
    .eq('mikrotik_id', selectedMikrotikId.value)
    .order('name')
  if (error) {
    errorMsg.value = error.message
  } else {
    pools.value = (data ?? []) as MikrotikIpv6Pool[]
  }
  loading.value = false
}

watch(selectedMikrotikId, loadPools)
onMounted(async () => {
  await loadDevices()
  await loadPools()
})

async function onSave() {
  if (!selectedMikrotikId.value) return
  saving.value = true
  errorMsg.value = ''
  try {
    const payload = {
      mikrotik_id: selectedMikrotikId.value,
      name: form.name,
      prefix: form.prefix,
      prefix_length: form.prefix_length,
      interface_name: form.interface_name || null,
    }
    let savedPool: MikrotikIpv6Pool
    if (editingId.value) {
      const { data, error } = await supabase
        .from('mikrotik_ipv6_pools')
        .update(payload)
        .eq('id', editingId.value)
        .select('*')
        .single()
      if (error) throw error
      savedPool = data as MikrotikIpv6Pool
    } else {
      const { data, error } = await supabase.from('mikrotik_ipv6_pools').insert(payload).select('*').single()
      if (error) throw error
      savedPool = data as MikrotikIpv6Pool
    }
    comandoPreview.value = generarComandoIpv6Pool(savedPool)
    showForm.value = false
    await loadPools()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo guardar el pool IPv6'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-6 py-8">
    <div class="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-slate-900">Pools IPv6</h1>
        <p class="text-sm text-slate-500">{{ pools.length }} pools configurados</p>
      </div>
      <div class="flex items-end gap-3">
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">MikroTik</label>
          <select v-model="selectedMikrotikId" class="input">
            <option v-for="d in devices" :key="d.id" :value="d.id">{{ d.name }}</option>
          </select>
        </div>
        <button
          :disabled="!selectedMikrotikId"
          class="flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          @click="openNew"
        >
          <PlusIcon class="h-4 w-4" />
          Nuevo pool
        </button>
      </div>
    </div>

    <p v-if="errorMsg" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMsg }}</p>

    <div v-if="comandoPreview" class="mb-4 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
      <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-teal-600">Comando RouterOS equivalente</p>
      <pre class="whitespace-pre-wrap font-mono text-xs">{{ comandoPreview }}</pre>
    </div>

    <div v-if="showForm" class="mb-6 rounded-xl border border-slate-200 bg-white p-6">
      <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {{ editingId ? 'Editar pool IPv6' : 'Nuevo pool IPv6' }}
      </h2>
      <form class="grid grid-cols-2 gap-4" @submit.prevent="onSave">
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Nombre</label>
          <input v-model="form.name" required placeholder="pool-clientes-v6" class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Interfaz (DHCPv6, opcional)</label>
          <input v-model="form.interface_name" placeholder="bridge-clientes" class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Prefijo (bloque LACNIC)</label>
          <input v-model="form.prefix" required placeholder="2800::/48" class="input font-mono" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Longitud por cliente</label>
          <input v-model.number="form.prefix_length" type="number" min="1" max="128" required class="input" />
        </div>
        <div class="col-span-2 flex justify-end gap-3">
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
            <th class="px-4 py-3">Prefijo</th>
            <th class="px-4 py-3">Por cliente</th>
            <th class="px-4 py-3">Interfaz</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="loading">
            <td colspan="5" class="px-4 py-6 text-center text-slate-400">Cargando…</td>
          </tr>
          <tr v-else-if="!pools.length">
            <td colspan="5" class="px-4 py-6 text-center text-slate-400">Sin pools IPv6 registrados</td>
          </tr>
          <tr v-for="p in pools" :key="p.id" class="hover:bg-slate-50">
            <td class="px-4 py-3 font-medium text-slate-900">{{ p.name }}</td>
            <td class="px-4 py-3 font-mono text-xs text-slate-600">{{ p.prefix }}</td>
            <td class="px-4 py-3 tabular-nums text-slate-600">/{{ p.prefix_length }}</td>
            <td class="px-4 py-3 text-slate-600">{{ p.interface_name || '—' }}</td>
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
