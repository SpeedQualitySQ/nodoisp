<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { PlusIcon } from '@heroicons/vue/24/outline'
import { supabase } from '@/lib/supabase'
import type { SpeedProfile } from '@/types/database'

const profiles = ref<SpeedProfile[]>([])
const loading = ref(true)
const errorMsg = ref('')
const saving = ref(false)
const editingId = ref<string | null>(null)
const showForm = ref(false)

const form = reactive({
  name: '',
  cir_down_kbps: 20000,
  pir_down_kbps: 20000,
  cir_up_kbps: 20000,
  pir_up_kbps: 20000,
})

function resetForm() {
  editingId.value = null
  form.name = ''
  form.cir_down_kbps = 20000
  form.pir_down_kbps = 20000
  form.cir_up_kbps = 20000
  form.pir_up_kbps = 20000
}

function openNew() {
  resetForm()
  showForm.value = true
}

function openEdit(profile: SpeedProfile) {
  editingId.value = profile.id
  form.name = profile.name
  form.cir_down_kbps = profile.cir_down_kbps
  form.pir_down_kbps = profile.pir_down_kbps
  form.cir_up_kbps = profile.cir_up_kbps
  form.pir_up_kbps = profile.pir_up_kbps
  showForm.value = true
}

async function loadProfiles() {
  loading.value = true
  errorMsg.value = ''
  const { data, error } = await supabase.from('speed_profiles').select('*').order('name')
  if (error) {
    errorMsg.value = error.message
  } else {
    profiles.value = (data ?? []) as SpeedProfile[]
  }
  loading.value = false
}

onMounted(loadProfiles)

async function onSave() {
  saving.value = true
  errorMsg.value = ''
  try {
    if (editingId.value) {
      const { error } = await supabase.from('speed_profiles').update(form).eq('id', editingId.value)
      if (error) throw error
    } else {
      const { error } = await supabase.from('speed_profiles').insert(form)
      if (error) throw error
    }
    showForm.value = false
    await loadProfiles()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo guardar el perfil de velocidad'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-6 py-8">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-xl font-semibold text-slate-900">Perfiles de velocidad</h1>
      <button
        class="flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
        @click="openNew"
      >
        <PlusIcon class="h-4 w-4" />
        Nuevo perfil
      </button>
    </div>

    <p v-if="errorMsg" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMsg }}</p>

    <div v-if="showForm" class="mb-6 rounded-xl border border-slate-200 bg-white p-6">
      <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {{ editingId ? 'Editar perfil' : 'Nuevo perfil' }}
      </h2>
      <form class="grid grid-cols-2 gap-4" @submit.prevent="onSave">
        <div class="col-span-2 space-y-1">
          <label class="text-sm font-medium text-slate-700">Nombre</label>
          <input v-model="form.name" required placeholder="20Mbps-Residencial" class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Bajada garantizada — CIR (Kbps)</label>
          <input v-model.number="form.cir_down_kbps" type="number" min="0" required class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Bajada máxima — PIR (Kbps)</label>
          <input v-model.number="form.pir_down_kbps" type="number" min="0" required class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Subida garantizada — CIR (Kbps)</label>
          <input v-model.number="form.cir_up_kbps" type="number" min="0" required class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Subida máxima — PIR (Kbps)</label>
          <input v-model.number="form.pir_up_kbps" type="number" min="0" required class="input" />
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
            <th class="px-4 py-3">Bajada CIR/PIR</th>
            <th class="px-4 py-3">Subida CIR/PIR</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="loading">
            <td colspan="4" class="px-4 py-6 text-center text-slate-400">Cargando…</td>
          </tr>
          <tr v-else-if="!profiles.length">
            <td colspan="4" class="px-4 py-6 text-center text-slate-400">Sin perfiles de velocidad</td>
          </tr>
          <tr v-for="p in profiles" :key="p.id" class="hover:bg-slate-50">
            <td class="px-4 py-3 font-medium text-slate-900">{{ p.name }}</td>
            <td class="px-4 py-3 tabular-nums text-slate-600">{{ p.cir_down_kbps }} / {{ p.pir_down_kbps }}</td>
            <td class="px-4 py-3 tabular-nums text-slate-600">{{ p.cir_up_kbps }} / {{ p.pir_up_kbps }}</td>
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
