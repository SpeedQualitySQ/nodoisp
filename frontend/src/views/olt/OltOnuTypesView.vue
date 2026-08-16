<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { PlusIcon } from '@heroicons/vue/24/outline'
import { supabase } from '@/lib/supabase'
import type { LineProfile, OltOnuType, ServiceProfile } from '@/types/database'

const types = ref<OltOnuType[]>([])
const lineProfiles = ref<LineProfile[]>([])
const serviceProfiles = ref<ServiceProfile[]>([])
const loading = ref(true)
const errorMsg = ref('')
const saving = ref(false)
const editingId = ref<string | null>(null)
const showForm = ref(false)

const form = reactive({
  name: '',
  manufacturer: 'Huawei',
  port_type: 'VEIP' as 'VEIP' | 'ETH',
  eth_ports: 4,
  wifi_bands: 'dual' as OltOnuType['wifi_bands'],
  line_profile_id: '' as string,
  service_profile_id: '' as string,
  notes: '',
})

function resetForm() {
  editingId.value = null
  form.name = ''
  form.manufacturer = 'Huawei'
  form.port_type = 'VEIP'
  form.eth_ports = 4
  form.wifi_bands = 'dual'
  form.line_profile_id = ''
  form.service_profile_id = ''
  form.notes = ''
}

function openNew() {
  resetForm()
  showForm.value = true
}

function openEdit(type: OltOnuType) {
  editingId.value = type.id
  form.name = type.name
  form.manufacturer = type.manufacturer
  form.port_type = type.port_type
  form.eth_ports = type.eth_ports
  form.wifi_bands = type.wifi_bands
  form.line_profile_id = type.line_profile_id ?? ''
  form.service_profile_id = type.service_profile_id ?? ''
  form.notes = type.notes ?? ''
  showForm.value = true
}

async function loadTypes() {
  loading.value = true
  errorMsg.value = ''
  const { data, error } = await supabase.from('olt_onu_types').select('*').order('name')
  if (error) {
    errorMsg.value = error.message
  } else {
    types.value = (data ?? []) as OltOnuType[]
  }
  loading.value = false
}

async function loadProfiles() {
  const [lp, sp] = await Promise.all([
    supabase.from('line_profiles').select('*').order('name'),
    supabase.from('service_profiles').select('*').order('name'),
  ])
  lineProfiles.value = (lp.data ?? []) as LineProfile[]
  serviceProfiles.value = (sp.data ?? []) as ServiceProfile[]
}

onMounted(async () => {
  await Promise.all([loadTypes(), loadProfiles()])
})

async function onSave() {
  saving.value = true
  errorMsg.value = ''
  try {
    const payload = {
      name: form.name,
      manufacturer: form.manufacturer,
      port_type: form.port_type,
      eth_ports: form.eth_ports,
      wifi_bands: form.wifi_bands,
      line_profile_id: form.line_profile_id || null,
      service_profile_id: form.service_profile_id || null,
      notes: form.notes || null,
    }
    if (editingId.value) {
      const { error } = await supabase.from('olt_onu_types').update(payload).eq('id', editingId.value)
      if (error) throw error
    } else {
      const { error } = await supabase.from('olt_onu_types').insert(payload)
      if (error) throw error
    }
    showForm.value = false
    await loadTypes()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo guardar el tipo de ONU'
  } finally {
    saving.value = false
  }
}

function profileName(list: { id: string; name: string }[], id: string | null) {
  return list.find((p) => p.id === id)?.name ?? '—'
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-6 py-8">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-slate-900">Tipos de ONU</h1>
        <p class="text-sm text-slate-500">{{ types.length }} modelos en catálogo</p>
      </div>
      <button
        class="flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
        @click="openNew"
      >
        <PlusIcon class="h-4 w-4" />
        Nuevo tipo
      </button>
    </div>

    <p v-if="errorMsg" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMsg }}</p>

    <div v-if="showForm" class="mb-6 rounded-xl border border-slate-200 bg-white p-6">
      <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {{ editingId ? 'Editar tipo de ONU' : 'Nuevo tipo de ONU' }}
      </h2>
      <form class="grid grid-cols-2 gap-4" @submit.prevent="onSave">
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Nombre / Modelo</label>
          <input v-model="form.name" required placeholder="Huawei HG8145X6" class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Fabricante</label>
          <input v-model="form.manufacturer" required class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Tipo de puerto</label>
          <select v-model="form.port_type" class="input">
            <option value="VEIP">VEIP (Huawei)</option>
            <option value="ETH">ETH (estándar)</option>
          </select>
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Puertos ETH</label>
          <input v-model.number="form.eth_ports" type="number" min="0" required class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">WiFi</label>
          <select v-model="form.wifi_bands" class="input">
            <option value="none">Sin WiFi</option>
            <option value="2.4ghz">2.4 GHz</option>
            <option value="5ghz">5 GHz</option>
            <option value="dual">Dual (2.4 + 5 GHz)</option>
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
        <div class="col-span-2 space-y-1">
          <label class="text-sm font-medium text-slate-700">Notas</label>
          <textarea v-model="form.notes" rows="2" class="input"></textarea>
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
            <th class="px-4 py-3">Modelo</th>
            <th class="px-4 py-3">Fabricante</th>
            <th class="px-4 py-3">Puerto</th>
            <th class="px-4 py-3">ETH / WiFi</th>
            <th class="px-4 py-3">Line / Service Profile</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="loading">
            <td colspan="6" class="px-4 py-6 text-center text-slate-400">Cargando…</td>
          </tr>
          <tr v-else-if="!types.length">
            <td colspan="6" class="px-4 py-6 text-center text-slate-400">Sin tipos de ONU registrados</td>
          </tr>
          <tr v-for="t in types" :key="t.id" class="hover:bg-slate-50">
            <td class="px-4 py-3 font-medium text-slate-900">{{ t.name }}</td>
            <td class="px-4 py-3 text-slate-600">{{ t.manufacturer }}</td>
            <td class="px-4 py-3 text-slate-600">{{ t.port_type }}</td>
            <td class="px-4 py-3 text-slate-600">{{ t.eth_ports }} ETH · {{ t.wifi_bands }}</td>
            <td class="px-4 py-3 text-slate-600">
              {{ profileName(lineProfiles, t.line_profile_id) }} / {{ profileName(serviceProfiles, t.service_profile_id) }}
            </td>
            <td class="px-4 py-3 text-right">
              <button class="text-sm font-medium text-teal-700 hover:text-teal-900" @click="openEdit(t)">
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
