<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { PlusIcon } from '@heroicons/vue/24/outline'
import { supabase } from '@/lib/supabase'
import {
  activarOnu,
  consultarSenalOptica,
  generarComandoActivarOnu,
  generarComandoEliminarOnu,
} from '@/lib/olt'
import type {
  Client,
  LineProfile,
  OltDevice,
  OltOnuType,
  OltOnuWithDetails,
  ServiceContract,
  ServiceProfile,
} from '@/types/database'
import StatusBadge from '@/components/StatusBadge.vue'

const devices = ref<OltDevice[]>([])
const selectedOltId = ref<string | null>(null)
const onus = ref<OltOnuWithDetails[]>([])
const onuTypes = ref<OltOnuType[]>([])
const lineProfiles = ref<LineProfile[]>([])
const serviceProfiles = ref<ServiceProfile[]>([])
const clients = ref<Client[]>([])
const clientContracts = ref<ServiceContract[]>([])

const loading = ref(true)
const errorMsg = ref('')
const saving = ref(false)
const editingId = ref<string | null>(null)
const showForm = ref(false)
const comandoPreview = ref('')
const busyId = ref<string | null>(null)

const form = reactive({
  frame: 0,
  slot: 0,
  port: 0,
  ont_id: 0,
  serial_number: '',
  onu_type_id: '' as string,
  line_profile_id: '' as string,
  service_profile_id: '' as string,
  vlan_id: 100,
  client_id: '' as string,
  contract_id: '' as string,
})

function resetForm() {
  editingId.value = null
  form.frame = 0
  form.slot = 0
  form.port = 0
  form.ont_id = 0
  form.serial_number = ''
  form.onu_type_id = ''
  form.line_profile_id = ''
  form.service_profile_id = ''
  form.vlan_id = 100
  form.client_id = ''
  form.contract_id = ''
  clientContracts.value = []
}

function openNew() {
  resetForm()
  comandoPreview.value = ''
  showForm.value = true
}

function openEdit(onu: OltOnuWithDetails) {
  editingId.value = onu.id
  form.frame = onu.frame
  form.slot = onu.slot
  form.port = onu.port
  form.ont_id = onu.ont_id
  form.serial_number = onu.serial_number
  form.onu_type_id = onu.onu_type_id ?? ''
  form.line_profile_id = onu.line_profile_id ?? ''
  form.service_profile_id = onu.service_profile_id ?? ''
  form.vlan_id = onu.vlan_id ?? 100
  form.client_id = onu.client_id ?? ''
  form.contract_id = onu.contract_id ?? ''
  comandoPreview.value = ''
  showForm.value = true
}

// Al elegir un tipo de ONU se sugieren sus perfiles por defecto, pero se
// pueden sobreescribir manualmente en el propio formulario.
function onOnuTypeChange() {
  const type = onuTypes.value.find((t) => t.id === form.onu_type_id)
  if (!type) return
  if (type.line_profile_id) form.line_profile_id = type.line_profile_id
  if (type.service_profile_id) form.service_profile_id = type.service_profile_id
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

async function loadDevices() {
  const { data, error } = await supabase.from('olt_devices').select('*').order('name')
  if (error) {
    errorMsg.value = error.message
    return
  }
  devices.value = (data ?? []) as OltDevice[]
  if (devices.value.length && !selectedOltId.value) {
    selectedOltId.value = devices.value[0].id
  }
}

async function loadOnus() {
  if (!selectedOltId.value) {
    onus.value = []
    loading.value = false
    return
  }
  loading.value = true
  errorMsg.value = ''
  const { data, error } = await supabase
    .from('olt_onus')
    .select('*, olt_onu_types(name), clients(first_name, last_name)')
    .eq('olt_id', selectedOltId.value)
    .order('created_at', { ascending: false })
  if (error) {
    errorMsg.value = error.message
  } else {
    onus.value = (data ?? []) as unknown as OltOnuWithDetails[]
  }
  loading.value = false
}

async function loadCatalogs() {
  const [types, lp, sp, cl] = await Promise.all([
    supabase.from('olt_onu_types').select('*').order('name'),
    supabase.from('line_profiles').select('*').order('name'),
    supabase.from('service_profiles').select('*').order('name'),
    supabase.from('clients').select('*').order('last_name'),
  ])
  onuTypes.value = (types.data ?? []) as OltOnuType[]
  lineProfiles.value = (lp.data ?? []) as LineProfile[]
  serviceProfiles.value = (sp.data ?? []) as ServiceProfile[]
  clients.value = (cl.data ?? []) as Client[]
}

watch(selectedOltId, loadOnus)
onMounted(async () => {
  await Promise.all([loadDevices(), loadCatalogs()])
  await loadOnus()
})

async function onSave() {
  if (!selectedOltId.value) return
  saving.value = true
  errorMsg.value = ''
  try {
    const payload = {
      olt_id: selectedOltId.value,
      frame: form.frame,
      slot: form.slot,
      port: form.port,
      ont_id: form.ont_id,
      serial_number: form.serial_number.toUpperCase(),
      onu_type_id: form.onu_type_id || null,
      line_profile_id: form.line_profile_id || null,
      service_profile_id: form.service_profile_id || null,
      vlan_id: form.vlan_id || null,
      client_id: form.client_id || null,
      contract_id: form.contract_id || null,
    }
    if (editingId.value) {
      const { error } = await supabase.from('olt_onus').update(payload).eq('id', editingId.value)
      if (error) throw error
    } else {
      const { error } = await supabase.from('olt_onus').insert(payload)
      if (error) throw error
    }
    showForm.value = false
    await loadOnus()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo guardar la ONU'
  } finally {
    saving.value = false
  }
}

async function onActivar(onu: OltOnuWithDetails) {
  errorMsg.value = ''
  busyId.value = onu.id
  try {
    comandoPreview.value = generarComandoActivarOnu(onu)
    await activarOnu(onu)
    await loadOnus()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo activar la ONU en la OLT'
  } finally {
    busyId.value = null
  }
}

async function onConsultarSenal(onu: OltOnuWithDetails) {
  errorMsg.value = ''
  busyId.value = onu.id
  try {
    await consultarSenalOptica(onu)
    await loadOnus()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo leer la señal óptica'
  } finally {
    busyId.value = null
  }
}

async function onEliminar(onu: OltOnuWithDetails) {
  if (!confirm(`¿Eliminar la ONU ${onu.serial_number}? Esta acción no se puede deshacer.`)) return
  errorMsg.value = ''
  busyId.value = onu.id
  try {
    comandoPreview.value = generarComandoEliminarOnu(onu)
    const { error } = await supabase.from('olt_onus').delete().eq('id', onu.id)
    if (error) throw error
    await loadOnus()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo eliminar la ONU'
  } finally {
    busyId.value = null
  }
}

function signalInfo(dbm: number | null) {
  if (dbm === null) return { label: '—', cls: 'text-slate-400' }
  if (dbm >= -27) return { label: `${dbm} dBm · Óptimo`, cls: 'text-teal-700' }
  if (dbm >= -29) return { label: `${dbm} dBm · Aceptable`, cls: 'text-amber-600' }
  if (dbm >= -31) return { label: `${dbm} dBm · Débil`, cls: 'text-orange-600' }
  return { label: `${dbm} dBm · Sin señal`, cls: 'text-red-600' }
}

const selectedOnuType = computed(() => onuTypes.value.find((t) => t.id === form.onu_type_id) ?? null)
</script>

<template>
  <div class="mx-auto max-w-6xl px-6 py-8">
    <div class="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-slate-900">ONUs</h1>
        <p class="text-sm text-slate-500">{{ onus.length }} equipos registrados</p>
      </div>
      <div class="flex items-end gap-3">
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">OLT</label>
          <select v-model="selectedOltId" class="input">
            <option v-for="d in devices" :key="d.id" :value="d.id">{{ d.name }}</option>
          </select>
        </div>
        <button
          :disabled="!selectedOltId"
          class="flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          @click="openNew"
        >
          <PlusIcon class="h-4 w-4" />
          Nueva ONU
        </button>
      </div>
    </div>

    <p v-if="errorMsg" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMsg }}</p>

    <div v-if="comandoPreview" class="mb-4 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
      <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-teal-600">Comando SSH equivalente</p>
      <pre class="whitespace-pre-wrap font-mono text-xs">{{ comandoPreview }}</pre>
    </div>

    <div v-if="showForm" class="mb-6 rounded-xl border border-slate-200 bg-white p-6">
      <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {{ editingId ? 'Editar ONU' : 'Nueva ONU' }}
      </h2>
      <form class="grid grid-cols-4 gap-4" @submit.prevent="onSave">
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Frame</label>
          <input v-model.number="form.frame" type="number" min="0" required class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Slot</label>
          <input v-model.number="form.slot" type="number" min="0" required class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Puerto PON</label>
          <input v-model.number="form.port" type="number" min="0" required class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">ONT ID</label>
          <input v-model.number="form.ont_id" type="number" min="0" max="127" required class="input" />
        </div>
        <div class="col-span-2 space-y-1">
          <label class="text-sm font-medium text-slate-700">Serial Number (SN)</label>
          <input v-model="form.serial_number" required placeholder="HWTC1A2B3C4D" class="input font-mono uppercase" />
        </div>
        <div class="col-span-2 space-y-1">
          <label class="text-sm font-medium text-slate-700">Tipo de ONU</label>
          <select v-model="form.onu_type_id" class="input" @change="onOnuTypeChange">
            <option value="">Seleccionar del catálogo</option>
            <option v-for="t in onuTypes" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Line Profile</label>
          <select v-model="form.line_profile_id" class="input">
            <option value="">Sin asignar</option>
            <option v-for="lp in lineProfiles" :key="lp.id" :value="lp.id">{{ lp.name }}</option>
          </select>
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Service Profile</label>
          <select v-model="form.service_profile_id" class="input">
            <option value="">Sin asignar</option>
            <option v-for="sp in serviceProfiles" :key="sp.id" :value="sp.id">{{ sp.name }}</option>
          </select>
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">VLAN de internet</label>
          <input v-model.number="form.vlan_id" type="number" min="1" max="4094" class="input" />
        </div>
        <p v-if="selectedOnuType" class="col-span-4 -mt-2 text-xs text-slate-400">
          {{ selectedOnuType.manufacturer }} · {{ selectedOnuType.port_type }} · {{ selectedOnuType.eth_ports }} ETH · WiFi {{ selectedOnuType.wifi_bands }}
        </p>
        <div class="col-span-2 space-y-1">
          <label class="text-sm font-medium text-slate-700">Cliente</label>
          <select v-model="form.client_id" class="input">
            <option value="">Sin asociar</option>
            <option v-for="c in clients" :key="c.id" :value="c.id">
              {{ c.last_name }} {{ c.first_name }} — {{ c.identification }}
            </option>
          </select>
        </div>
        <div class="col-span-2 space-y-1">
          <label class="text-sm font-medium text-slate-700">Contrato</label>
          <select v-model="form.contract_id" :disabled="!form.client_id" class="input disabled:opacity-60">
            <option value="">Sin asociar</option>
            <option v-for="c in clientContracts" :key="c.id" :value="c.id">
              {{ c.contract_number }} — {{ c.status }}
            </option>
          </select>
        </div>
        <div class="col-span-4 flex justify-end gap-3">
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
            <th class="px-4 py-3">F/S/P · ONT</th>
            <th class="px-4 py-3">Serial</th>
            <th class="px-4 py-3">Tipo</th>
            <th class="px-4 py-3">Cliente</th>
            <th class="px-4 py-3">VLAN</th>
            <th class="px-4 py-3">Señal RX</th>
            <th class="px-4 py-3">Estado</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="loading">
            <td colspan="8" class="px-4 py-6 text-center text-slate-400">Cargando…</td>
          </tr>
          <tr v-else-if="!onus.length">
            <td colspan="8" class="px-4 py-6 text-center text-slate-400">Sin ONUs registradas para esta OLT</td>
          </tr>
          <tr v-for="o in onus" :key="o.id" class="hover:bg-slate-50">
            <td class="px-4 py-3 font-mono text-xs text-slate-900">{{ o.frame }}/{{ o.slot }}/{{ o.port }} · {{ o.ont_id }}</td>
            <td class="px-4 py-3 font-mono text-xs text-slate-600">{{ o.serial_number }}</td>
            <td class="px-4 py-3 text-slate-600">{{ o.olt_onu_types?.name ?? '—' }}</td>
            <td class="px-4 py-3 text-slate-600">
              {{ o.clients ? `${o.clients.last_name} ${o.clients.first_name}` : '—' }}
            </td>
            <td class="px-4 py-3 tabular-nums text-slate-600">{{ o.vlan_id ?? '—' }}</td>
            <td class="px-4 py-3 text-xs" :class="signalInfo(o.signal_rx_dbm).cls">{{ signalInfo(o.signal_rx_dbm).label }}</td>
            <td class="px-4 py-3"><StatusBadge :status="o.status" /></td>
            <td class="px-4 py-3 text-right whitespace-nowrap">
              <button
                v-if="o.status === 'pending'"
                :disabled="busyId === o.id"
                class="mr-3 text-sm font-medium text-teal-700 hover:text-teal-900 disabled:opacity-60"
                @click="onActivar(o)"
              >
                {{ busyId === o.id ? 'Activando…' : 'Activar en OLT' }}
              </button>
              <button
                v-else
                :disabled="busyId === o.id"
                class="mr-3 text-sm font-medium text-teal-700 hover:text-teal-900 disabled:opacity-60"
                @click="onConsultarSenal(o)"
              >
                {{ busyId === o.id ? 'Consultando…' : 'Consultar señal' }}
              </button>
              <button class="mr-3 text-sm font-medium text-slate-600 hover:text-slate-900" @click="openEdit(o)">
                Editar
              </button>
              <button
                :disabled="busyId === o.id"
                class="text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-60"
                @click="onEliminar(o)"
              >
                Eliminar
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
