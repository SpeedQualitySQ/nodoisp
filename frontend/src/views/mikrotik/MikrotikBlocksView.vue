<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { PlusIcon } from '@heroicons/vue/24/outline'
import { supabase } from '@/lib/supabase'
import { bloquearCliente, desbloquearCliente, generarComandoBloqueo, generarComandoDesbloqueo } from '@/lib/mikrotik'
import type { Client, MikrotikClientBlockWithClient, MikrotikDevice } from '@/types/database'
import StatusBadge from '@/components/StatusBadge.vue'

const devices = ref<MikrotikDevice[]>([])
const selectedMikrotikId = ref<string | null>(null)
const blocks = ref<MikrotikClientBlockWithClient[]>([])
const clients = ref<Client[]>([])

const loading = ref(true)
const errorMsg = ref('')
const saving = ref(false)
const showForm = ref(false)
const comandoPreview = ref('')
const busyId = ref<string | null>(null)

const form = reactive({
  client_id: '',
  ip_address: '',
  pppoe_username: '',
  reason: '',
})

function resetForm() {
  form.client_id = ''
  form.ip_address = ''
  form.pppoe_username = ''
  form.reason = ''
}

function openNew() {
  resetForm()
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

async function loadBlocks() {
  if (!selectedMikrotikId.value) {
    blocks.value = []
    loading.value = false
    return
  }
  loading.value = true
  errorMsg.value = ''
  const { data, error } = await supabase
    .from('mikrotik_client_blocks')
    .select('*, clients(first_name, last_name, identification)')
    .eq('mikrotik_id', selectedMikrotikId.value)
    .order('created_at', { ascending: false })
  if (error) {
    errorMsg.value = error.message
  } else {
    blocks.value = (data ?? []) as unknown as MikrotikClientBlockWithClient[]
  }
  loading.value = false
}

async function loadClients() {
  const { data } = await supabase.from('clients').select('*').order('last_name')
  clients.value = (data ?? []) as Client[]
}

watch(selectedMikrotikId, loadBlocks)
onMounted(async () => {
  await Promise.all([loadDevices(), loadClients()])
  await loadBlocks()
})

async function onSave() {
  if (!selectedMikrotikId.value || !form.client_id) return
  saving.value = true
  errorMsg.value = ''
  try {
    const payload = {
      mikrotik_id: selectedMikrotikId.value,
      client_id: form.client_id,
      ip_address: form.ip_address || null,
      pppoe_username: form.pppoe_username || null,
      reason: form.reason || null,
    }
    const { error } = await supabase.from('mikrotik_client_blocks').upsert(payload, {
      onConflict: 'mikrotik_id,client_id',
    })
    if (error) throw error
    showForm.value = false
    await loadBlocks()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo registrar el cliente'
  } finally {
    saving.value = false
  }
}

async function onBloquear(block: MikrotikClientBlockWithClient) {
  errorMsg.value = ''
  busyId.value = block.id
  try {
    comandoPreview.value = generarComandoBloqueo(block) || 'Sin IP ni usuario PPPoE registrados: nada que bloquear en el equipo.'
    await bloquearCliente(block)
    await loadBlocks()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo bloquear al cliente'
  } finally {
    busyId.value = null
  }
}

async function onDesbloquear(block: MikrotikClientBlockWithClient) {
  errorMsg.value = ''
  busyId.value = block.id
  try {
    comandoPreview.value = generarComandoDesbloqueo(block) || 'Sin IP ni usuario PPPoE registrados: nada que desbloquear en el equipo.'
    await desbloquearCliente(block)
    await loadBlocks()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo desbloquear al cliente'
  } finally {
    busyId.value = null
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-6 py-8">
    <div class="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-slate-900">Bloqueos de clientes</h1>
        <p class="text-sm text-slate-500">{{ blocks.length }} clientes registrados</p>
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
          Registrar cliente
        </button>
      </div>
    </div>

    <p v-if="errorMsg" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMsg }}</p>

    <div v-if="comandoPreview" class="mb-4 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
      <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-teal-600">Comando RouterOS equivalente</p>
      <pre class="whitespace-pre-wrap font-mono text-xs">{{ comandoPreview }}</pre>
    </div>

    <div v-if="showForm" class="mb-6 rounded-xl border border-slate-200 bg-white p-6">
      <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Registrar cliente para bloqueo</h2>
      <form class="grid grid-cols-2 gap-4" @submit.prevent="onSave">
        <div class="col-span-2 space-y-1">
          <label class="text-sm font-medium text-slate-700">Cliente</label>
          <select v-model="form.client_id" required class="input">
            <option value="" disabled>Buscar cliente…</option>
            <option v-for="c in clients" :key="c.id" :value="c.id">
              {{ c.last_name }} {{ c.first_name }} — {{ c.identification }}
            </option>
          </select>
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">IP asignada (Address-List)</label>
          <input v-model="form.ip_address" placeholder="10.10.1.50" class="input font-mono" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Usuario PPPoE</label>
          <input v-model="form.pppoe_username" placeholder="cliente001@isp" class="input" />
        </div>
        <div class="col-span-2 space-y-1">
          <label class="text-sm font-medium text-slate-700">Motivo</label>
          <input v-model="form.reason" placeholder="Factura vencida" class="input" />
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
            <th class="px-4 py-3">Cliente</th>
            <th class="px-4 py-3">IP / Usuario PPPoE</th>
            <th class="px-4 py-3">Motivo</th>
            <th class="px-4 py-3">Estado</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="loading">
            <td colspan="5" class="px-4 py-6 text-center text-slate-400">Cargando…</td>
          </tr>
          <tr v-else-if="!blocks.length">
            <td colspan="5" class="px-4 py-6 text-center text-slate-400">Sin clientes registrados en este MikroTik</td>
          </tr>
          <tr v-for="b in blocks" :key="b.id" class="hover:bg-slate-50">
            <td class="px-4 py-3 text-slate-900">
              {{ b.clients ? `${b.clients.last_name} ${b.clients.first_name}` : '—' }}
              <span class="block text-xs text-slate-400">{{ b.clients?.identification }}</span>
            </td>
            <td class="px-4 py-3 font-mono text-xs text-slate-600">
              <span v-if="b.ip_address">{{ b.ip_address }}</span>
              <span v-if="b.ip_address && b.pppoe_username"><br /></span>
              <span v-if="b.pppoe_username">{{ b.pppoe_username }}</span>
              <span v-if="!b.ip_address && !b.pppoe_username">—</span>
            </td>
            <td class="px-4 py-3 text-slate-600">{{ b.reason || '—' }}</td>
            <td class="px-4 py-3"><StatusBadge :status="b.status" /></td>
            <td class="px-4 py-3 text-right">
              <button
                v-if="b.status === 'active'"
                :disabled="busyId === b.id"
                class="text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-60"
                @click="onBloquear(b)"
              >
                {{ busyId === b.id ? 'Bloqueando…' : 'Bloquear' }}
              </button>
              <button
                v-else
                :disabled="busyId === b.id"
                class="text-sm font-medium text-teal-700 hover:text-teal-900 disabled:opacity-60"
                @click="onDesbloquear(b)"
              >
                {{ busyId === b.id ? 'Desbloqueando…' : 'Desbloquear' }}
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
