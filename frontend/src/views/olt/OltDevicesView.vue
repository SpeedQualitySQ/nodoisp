<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { PlusIcon } from '@heroicons/vue/24/outline'
import { supabase } from '@/lib/supabase'
import { probarConexion } from '@/lib/olt'
import type { OltDevice } from '@/types/database'
import StatusBadge from '@/components/StatusBadge.vue'

const devices = ref<OltDevice[]>([])
const loading = ref(true)
const errorMsg = ref('')
const saving = ref(false)
const editingId = ref<string | null>(null)
const showForm = ref(false)
const testingId = ref<string | null>(null)

const MODELS = [
  'MA5800-X7',
  'MA5800-X15',
  'MA5800-X17',
  'V1600GS-R',
  'V1600GS-F',
  'V3600GS',
  'V1600GT',
  'V1600G0',
  'V1600G1-R',
  'V1600G2-R',
  'ZXA10 C320',
  'ZXA10 C300',
  'ZXA10 C600',
  'ZXA10 C620',
  'ZXA10 C650',
]

const form = reactive({
  name: '',
  host: '',
  ssh_port: 22,
  ssh_user: '',
  ssh_password: '',
  model: 'MA5800-X7',
})

function resetForm() {
  editingId.value = null
  form.name = ''
  form.host = ''
  form.ssh_port = 22
  form.ssh_user = ''
  form.ssh_password = ''
  form.model = 'MA5800-X7'
}

function openNew() {
  resetForm()
  showForm.value = true
}

function openEdit(device: OltDevice) {
  editingId.value = device.id
  form.name = device.name
  form.host = device.host
  form.ssh_port = device.ssh_port
  form.ssh_user = device.ssh_user
  form.ssh_password = device.ssh_password
  form.model = device.model
  showForm.value = true
}

async function loadDevices() {
  loading.value = true
  errorMsg.value = ''
  const { data, error } = await supabase.from('olt_devices').select('*').order('name')
  if (error) {
    errorMsg.value = error.message
  } else {
    devices.value = (data ?? []) as OltDevice[]
  }
  loading.value = false
}

onMounted(loadDevices)

async function onSave() {
  saving.value = true
  errorMsg.value = ''
  try {
    if (editingId.value) {
      const { error } = await supabase.from('olt_devices').update(form).eq('id', editingId.value)
      if (error) throw error
    } else {
      const { error } = await supabase.from('olt_devices').insert(form)
      if (error) throw error
    }
    showForm.value = false
    await loadDevices()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo guardar la OLT'
  } finally {
    saving.value = false
  }
}

async function onProbarConexion(device: OltDevice) {
  errorMsg.value = ''
  testingId.value = device.id
  try {
    await probarConexion(device)
    await loadDevices()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo probar la conexión'
  } finally {
    testingId.value = null
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-6 py-8">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-slate-900">OLTs registradas</h1>
        <p class="text-sm text-slate-500">{{ devices.length }} equipos</p>
      </div>
      <button
        class="flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
        @click="openNew"
      >
        <PlusIcon class="h-4 w-4" />
        Nueva OLT
      </button>
    </div>

    <p v-if="errorMsg" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMsg }}</p>

    <div v-if="showForm" class="mb-6 rounded-xl border border-slate-200 bg-white p-6">
      <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {{ editingId ? 'Editar OLT' : 'Nueva OLT' }}
      </h2>
      <form class="grid grid-cols-2 gap-4" @submit.prevent="onSave">
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Nombre</label>
          <input v-model="form.name" required placeholder="OLT-NORTE-01" class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Modelo</label>
          <select v-model="form.model" class="input">
            <option v-for="m in MODELS" :key="m" :value="m">{{ m }}</option>
          </select>
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Host / IP</label>
          <input v-model="form.host" required placeholder="10.0.0.1" class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Puerto SSH</label>
          <input v-model.number="form.ssh_port" type="number" min="1" required class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Usuario SSH</label>
          <input v-model="form.ssh_user" required class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Contraseña SSH</label>
          <input v-model="form.ssh_password" type="password" required class="input" />
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
            <th class="px-4 py-3">Modelo</th>
            <th class="px-4 py-3">Host</th>
            <th class="px-4 py-3">Firmware</th>
            <th class="px-4 py-3">Estado</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="loading">
            <td colspan="6" class="px-4 py-6 text-center text-slate-400">Cargando…</td>
          </tr>
          <tr v-else-if="!devices.length">
            <td colspan="6" class="px-4 py-6 text-center text-slate-400">Sin OLTs registradas</td>
          </tr>
          <tr v-for="d in devices" :key="d.id" class="hover:bg-slate-50">
            <td class="px-4 py-3 font-medium text-slate-900">{{ d.name }}</td>
            <td class="px-4 py-3 text-slate-600">{{ d.model }}</td>
            <td class="px-4 py-3 font-mono text-xs text-slate-600">{{ d.host }}:{{ d.ssh_port }}</td>
            <td class="px-4 py-3 text-slate-600">{{ d.firmware_version || '—' }}</td>
            <td class="px-4 py-3"><StatusBadge :status="d.status" /></td>
            <td class="px-4 py-3 text-right">
              <button
                :disabled="testingId === d.id"
                class="mr-3 text-sm font-medium text-teal-700 hover:text-teal-900 disabled:opacity-60"
                @click="onProbarConexion(d)"
              >
                {{ testingId === d.id ? 'Probando…' : 'Probar conexión' }}
              </button>
              <button class="text-sm font-medium text-slate-600 hover:text-slate-900" @click="openEdit(d)">
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
