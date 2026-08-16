<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { PlusIcon } from '@heroicons/vue/24/outline'
import { supabase } from '@/lib/supabase'
import { generarComandoIpPool } from '@/lib/mikrotik'
import type { MikrotikDevice, MikrotikIpPool } from '@/types/database'

const devices = ref<MikrotikDevice[]>([])
const selectedMikrotikId = ref<string | null>(null)
const pools = ref<MikrotikIpPool[]>([])
const loading = ref(true)
const errorMsg = ref('')
const saving = ref(false)
const editingId = ref<string | null>(null)
const showForm = ref(false)
const comandoPreview = ref('')

const form = reactive({
  name: '',
  ranges: '',
  ppp_profile_name: '',
  local_address: '',
  dns_primary: '8.8.8.8',
  dns_secondary: '8.8.4.4',
})

function resetForm() {
  editingId.value = null
  form.name = ''
  form.ranges = ''
  form.ppp_profile_name = ''
  form.local_address = ''
  form.dns_primary = '8.8.8.8'
  form.dns_secondary = '8.8.4.4'
}

function openNew() {
  resetForm()
  comandoPreview.value = ''
  showForm.value = true
}

function openEdit(pool: MikrotikIpPool) {
  editingId.value = pool.id
  form.name = pool.name
  form.ranges = pool.ranges
  form.ppp_profile_name = pool.ppp_profile_name ?? ''
  form.local_address = pool.local_address ?? ''
  form.dns_primary = pool.dns_primary
  form.dns_secondary = pool.dns_secondary ?? ''
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
    .from('mikrotik_ip_pools')
    .select('*')
    .eq('mikrotik_id', selectedMikrotikId.value)
    .order('name')
  if (error) {
    errorMsg.value = error.message
  } else {
    pools.value = (data ?? []) as MikrotikIpPool[]
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
      ranges: form.ranges,
      ppp_profile_name: form.ppp_profile_name || null,
      local_address: form.local_address || null,
      dns_primary: form.dns_primary,
      dns_secondary: form.dns_secondary || null,
    }
    let savedPool: MikrotikIpPool
    if (editingId.value) {
      const { data, error } = await supabase
        .from('mikrotik_ip_pools')
        .update(payload)
        .eq('id', editingId.value)
        .select('*')
        .single()
      if (error) throw error
      savedPool = data as MikrotikIpPool
    } else {
      const { data, error } = await supabase.from('mikrotik_ip_pools').insert(payload).select('*').single()
      if (error) throw error
      savedPool = data as MikrotikIpPool
    }
    comandoPreview.value = generarComandoIpPool(savedPool)
    showForm.value = false
    await loadPools()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo guardar el pool de IPs'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-6 py-8">
    <div class="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-slate-900">IP Address pools</h1>
        <p class="text-sm text-slate-500">{{ pools.length }} pools PPPoE</p>
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
        {{ editingId ? 'Editar pool' : 'Nuevo pool' }}
      </h2>
      <form class="grid grid-cols-2 gap-4" @submit.prevent="onSave">
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Nombre</label>
          <input v-model="form.name" required placeholder="pool-clientes" class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Rango</label>
          <input v-model="form.ranges" required placeholder="10.10.0.1-10.10.255.254" class="input font-mono" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Perfil PPP (opcional)</label>
          <input v-model="form.ppp_profile_name" placeholder="perfil-clientes" class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">IP local (gateway PPP)</label>
          <input v-model="form.local_address" placeholder="10.10.0.0" class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">DNS primario</label>
          <input v-model="form.dns_primary" required class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">DNS secundario</label>
          <input v-model="form.dns_secondary" class="input" />
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
            <th class="px-4 py-3">Rango</th>
            <th class="px-4 py-3">Perfil PPP</th>
            <th class="px-4 py-3">DNS</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="loading">
            <td colspan="5" class="px-4 py-6 text-center text-slate-400">Cargando…</td>
          </tr>
          <tr v-else-if="!pools.length">
            <td colspan="5" class="px-4 py-6 text-center text-slate-400">Sin pools registrados</td>
          </tr>
          <tr v-for="p in pools" :key="p.id" class="hover:bg-slate-50">
            <td class="px-4 py-3 font-medium text-slate-900">{{ p.name }}</td>
            <td class="px-4 py-3 font-mono text-xs text-slate-600">{{ p.ranges }}</td>
            <td class="px-4 py-3 text-slate-600">{{ p.ppp_profile_name || '—' }}</td>
            <td class="px-4 py-3 text-slate-600">{{ p.dns_primary }}{{ p.dns_secondary ? `, ${p.dns_secondary}` : '' }}</td>
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
