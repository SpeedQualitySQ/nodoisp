<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { PlusIcon } from '@heroicons/vue/24/outline'
import { supabase } from '@/lib/supabase'
import type { OltDevice, OltUplinkPort } from '@/types/database'
import StatusBadge from '@/components/StatusBadge.vue'

const devices = ref<OltDevice[]>([])
const selectedOltId = ref<string | null>(null)
const uplinks = ref<OltUplinkPort[]>([])
const loading = ref(true)
const errorMsg = ref('')
const saving = ref(false)
const editingId = ref<string | null>(null)
const showForm = ref(false)

const form = reactive({
  port: '',
  management_vlan: null as number | null,
  management_ip: '',
  status: 'active' as 'active' | 'inactive',
})

function resetForm() {
  editingId.value = null
  form.port = ''
  form.management_vlan = null
  form.management_ip = ''
  form.status = 'active'
}

function openNew() {
  resetForm()
  showForm.value = true
}

function openEdit(uplink: OltUplinkPort) {
  editingId.value = uplink.id
  form.port = uplink.port
  form.management_vlan = uplink.management_vlan
  form.management_ip = uplink.management_ip ?? ''
  form.status = uplink.status
  showForm.value = true
}

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

async function loadUplinks() {
  if (!selectedOltId.value) {
    uplinks.value = []
    loading.value = false
    return
  }
  loading.value = true
  errorMsg.value = ''
  const { data, error } = await supabase
    .from('olt_uplink_ports')
    .select('*')
    .eq('olt_id', selectedOltId.value)
    .order('port')
  if (error) {
    errorMsg.value = error.message
  } else {
    uplinks.value = (data ?? []) as OltUplinkPort[]
  }
  loading.value = false
}

watch(selectedOltId, loadUplinks)
onMounted(async () => {
  await loadDevices()
  await loadUplinks()
})

async function onSave() {
  if (!selectedOltId.value) return
  saving.value = true
  errorMsg.value = ''
  try {
    const payload = {
      olt_id: selectedOltId.value,
      port: form.port,
      management_vlan: form.management_vlan,
      management_ip: form.management_ip || null,
      status: form.status,
    }
    if (editingId.value) {
      const { error } = await supabase.from('olt_uplink_ports').update(payload).eq('id', editingId.value)
      if (error) throw error
    } else {
      const { error } = await supabase.from('olt_uplink_ports').insert(payload)
      if (error) throw error
    }
    showForm.value = false
    await loadUplinks()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo guardar el uplink'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-6 py-8">
    <div class="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-slate-900">Uplink ports</h1>
        <p class="text-sm text-slate-500">{{ uplinks.length }} puertos</p>
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
          Nuevo uplink
        </button>
      </div>
    </div>

    <p v-if="errorMsg" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMsg }}</p>

    <div v-if="showForm" class="mb-6 rounded-xl border border-slate-200 bg-white p-6">
      <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {{ editingId ? 'Editar uplink' : 'Nuevo uplink' }}
      </h2>
      <form class="grid grid-cols-2 gap-4" @submit.prevent="onSave">
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Puerto</label>
          <input v-model="form.port" required placeholder="0/9/0" class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">VLAN de gestión</label>
          <input v-model.number="form.management_vlan" type="number" min="1" max="4094" class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">IP de gestión</label>
          <input v-model="form.management_ip" placeholder="Opcional" class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Estado</label>
          <select v-model="form.status" class="input">
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </select>
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
            <th class="px-4 py-3">Puerto</th>
            <th class="px-4 py-3">VLAN gestión</th>
            <th class="px-4 py-3">IP gestión</th>
            <th class="px-4 py-3">Estado</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="loading">
            <td colspan="5" class="px-4 py-6 text-center text-slate-400">Cargando…</td>
          </tr>
          <tr v-else-if="!uplinks.length">
            <td colspan="5" class="px-4 py-6 text-center text-slate-400">Sin uplinks registrados</td>
          </tr>
          <tr v-for="u in uplinks" :key="u.id" class="hover:bg-slate-50">
            <td class="px-4 py-3 font-mono text-xs text-slate-900">{{ u.port }}</td>
            <td class="px-4 py-3 tabular-nums text-slate-600">{{ u.management_vlan ?? '—' }}</td>
            <td class="px-4 py-3 font-mono text-xs text-slate-600">{{ u.management_ip || '—' }}</td>
            <td class="px-4 py-3"><StatusBadge :status="u.status" /></td>
            <td class="px-4 py-3 text-right">
              <button class="text-sm font-medium text-teal-700 hover:text-teal-900" @click="openEdit(u)">
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
