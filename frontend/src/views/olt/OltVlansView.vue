<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { PlusIcon } from '@heroicons/vue/24/outline'
import { supabase } from '@/lib/supabase'
import { generarComandoVlan } from '@/lib/olt'
import type { OltDevice, OltVlan } from '@/types/database'

const devices = ref<OltDevice[]>([])
const selectedOltId = ref<string | null>(null)
const vlans = ref<OltVlan[]>([])
const loading = ref(true)
const errorMsg = ref('')
const saving = ref(false)
const editingId = ref<string | null>(null)
const showForm = ref(false)
const comandoPreview = ref('')

const form = reactive({
  vlan_id: 100,
  name: '',
  modo: 'smart' as 'smart' | 'standard',
})

function resetForm() {
  editingId.value = null
  form.vlan_id = 100
  form.name = ''
  form.modo = 'smart'
}

function openNew() {
  resetForm()
  comandoPreview.value = ''
  showForm.value = true
}

function openEdit(vlan: OltVlan) {
  editingId.value = vlan.id
  form.vlan_id = vlan.vlan_id
  form.name = vlan.name
  form.modo = vlan.modo
  comandoPreview.value = ''
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

async function loadVlans() {
  if (!selectedOltId.value) {
    vlans.value = []
    loading.value = false
    return
  }
  loading.value = true
  errorMsg.value = ''
  const { data, error } = await supabase
    .from('olt_vlans')
    .select('*')
    .eq('olt_id', selectedOltId.value)
    .order('vlan_id')
  if (error) {
    errorMsg.value = error.message
  } else {
    vlans.value = (data ?? []) as OltVlan[]
  }
  loading.value = false
}

watch(selectedOltId, loadVlans)
onMounted(async () => {
  await loadDevices()
  await loadVlans()
})

async function onSave() {
  if (!selectedOltId.value) return
  saving.value = true
  errorMsg.value = ''
  try {
    const payload = {
      olt_id: selectedOltId.value,
      vlan_id: form.vlan_id,
      name: form.name,
      modo: form.modo,
    }
    if (editingId.value) {
      const { error } = await supabase.from('olt_vlans').update(payload).eq('id', editingId.value)
      if (error) throw error
    } else {
      const { error } = await supabase.from('olt_vlans').insert(payload)
      if (error) throw error
    }
    comandoPreview.value = generarComandoVlan(form.vlan_id, form.name, form.modo)
    showForm.value = false
    await loadVlans()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo guardar la VLAN'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-6 py-8">
    <div class="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-slate-900">VLANs de servicio</h1>
        <p class="text-sm text-slate-500">{{ vlans.length }} VLANs</p>
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
          Nueva VLAN
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
        {{ editingId ? 'Editar VLAN' : 'Nueva VLAN' }}
      </h2>
      <form class="grid grid-cols-3 gap-4" @submit.prevent="onSave">
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">ID VLAN</label>
          <input v-model.number="form.vlan_id" type="number" min="1" max="4094" required class="input" />
        </div>
        <div class="col-span-2 space-y-1">
          <label class="text-sm font-medium text-slate-700">Nombre descriptivo</label>
          <input v-model="form.name" required placeholder="CLIENTES-INTERNET" class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Tipo</label>
          <select v-model="form.modo" class="input">
            <option value="smart">Smart</option>
            <option value="standard">Standard</option>
          </select>
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
            <th class="px-4 py-3">ID</th>
            <th class="px-4 py-3">Nombre</th>
            <th class="px-4 py-3">Tipo</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="loading">
            <td colspan="4" class="px-4 py-6 text-center text-slate-400">Cargando…</td>
          </tr>
          <tr v-else-if="!vlans.length">
            <td colspan="4" class="px-4 py-6 text-center text-slate-400">Sin VLANs registradas</td>
          </tr>
          <tr v-for="v in vlans" :key="v.id" class="hover:bg-slate-50">
            <td class="px-4 py-3 tabular-nums text-slate-900">{{ v.vlan_id }}</td>
            <td class="px-4 py-3 text-slate-700">{{ v.name }}</td>
            <td class="px-4 py-3 capitalize text-slate-600">{{ v.modo }}</td>
            <td class="px-4 py-3 text-right">
              <button class="text-sm font-medium text-teal-700 hover:text-teal-900" @click="openEdit(v)">
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
