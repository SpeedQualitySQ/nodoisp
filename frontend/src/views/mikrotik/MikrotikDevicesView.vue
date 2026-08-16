<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { PlusIcon } from '@heroicons/vue/24/outline'
import { supabase } from '@/lib/supabase'
import { probarConexionMikrotik } from '@/lib/mikrotik'
import type { MikrotikDevice } from '@/types/database'
import StatusBadge from '@/components/StatusBadge.vue'

const devices = ref<MikrotikDevice[]>([])
const loading = ref(true)
const errorMsg = ref('')
const saving = ref(false)
const editingId = ref<string | null>(null)
const showForm = ref(false)
const testingId = ref<string | null>(null)

const MODELS = ['RB4011iGS+', 'CCR2004-1G-12S+2XS', 'CCR2116-12G-4S+', 'hEX S', 'RB5009UG+S+', 'CRS328-24P-4S+']

const form = reactive({
  name: '',
  host: '',
  api_port: 8728,
  api_ssl: false,
  api_user: '',
  api_password: '',
  model: 'RB4011iGS+',
})

function resetForm() {
  editingId.value = null
  form.name = ''
  form.host = ''
  form.api_port = 8728
  form.api_ssl = false
  form.api_user = ''
  form.api_password = ''
  form.model = 'RB4011iGS+'
}

function openNew() {
  resetForm()
  showForm.value = true
}

function openEdit(device: MikrotikDevice) {
  editingId.value = device.id
  form.name = device.name
  form.host = device.host
  form.api_port = device.api_port
  form.api_ssl = device.api_ssl
  form.api_user = device.api_user
  form.api_password = device.api_password
  form.model = device.model
  showForm.value = true
}

async function loadDevices() {
  loading.value = true
  errorMsg.value = ''
  const { data, error } = await supabase.from('mikrotik_devices').select('*').order('name')
  if (error) {
    errorMsg.value = error.message
  } else {
    devices.value = (data ?? []) as MikrotikDevice[]
  }
  loading.value = false
}

onMounted(loadDevices)

async function onSave() {
  saving.value = true
  errorMsg.value = ''
  try {
    if (editingId.value) {
      const { error } = await supabase.from('mikrotik_devices').update(form).eq('id', editingId.value)
      if (error) throw error
    } else {
      const { error } = await supabase.from('mikrotik_devices').insert(form)
      if (error) throw error
    }
    showForm.value = false
    await loadDevices()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo guardar el MikroTik'
  } finally {
    saving.value = false
  }
}

async function onProbarConexion(device: MikrotikDevice) {
  errorMsg.value = ''
  testingId.value = device.id
  try {
    await probarConexionMikrotik(device)
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
        <h1 class="text-xl font-semibold text-slate-900">MikroTik registrados</h1>
        <p class="text-sm text-slate-500">{{ devices.length }} equipos</p>
      </div>
      <button
        class="flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
        @click="openNew"
      >
        <PlusIcon class="h-4 w-4" />
        Nuevo MikroTik
      </button>
    </div>

    <p v-if="errorMsg" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMsg }}</p>

    <div v-if="showForm" class="mb-6 rounded-xl border border-slate-200 bg-white p-6">
      <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {{ editingId ? 'Editar MikroTik' : 'Nuevo MikroTik' }}
      </h2>
      <form class="grid grid-cols-2 gap-4" @submit.prevent="onSave">
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Nombre</label>
          <input v-model="form.name" required placeholder="MK-CORE-01" class="input" />
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
          <label class="text-sm font-medium text-slate-700">Puerto API</label>
          <input v-model.number="form.api_port" type="number" min="1" required class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Usuario API</label>
          <input v-model="form.api_user" required class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Contraseña API</label>
          <input v-model="form.api_password" type="password" required class="input" />
        </div>
        <div class="col-span-2 flex items-center gap-2">
          <input id="api_ssl" v-model="form.api_ssl" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-teal-700" />
          <label for="api_ssl" class="text-sm font-medium text-slate-700">Usar API-SSL (puerto 8729)</label>
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
            <th class="px-4 py-3">RouterOS</th>
            <th class="px-4 py-3">Estado</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="loading">
            <td colspan="6" class="px-4 py-6 text-center text-slate-400">Cargando…</td>
          </tr>
          <tr v-else-if="!devices.length">
            <td colspan="6" class="px-4 py-6 text-center text-slate-400">Sin MikroTik registrados</td>
          </tr>
          <tr v-for="d in devices" :key="d.id" class="hover:bg-slate-50">
            <td class="px-4 py-3 font-medium text-slate-900">{{ d.name }}</td>
            <td class="px-4 py-3 text-slate-600">{{ d.model }}</td>
            <td class="px-4 py-3 font-mono text-xs text-slate-600">
              {{ d.host }}:{{ d.api_port }}{{ d.api_ssl ? ' (SSL)' : '' }}
            </td>
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
