<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { PlusIcon } from '@heroicons/vue/24/outline'
import { supabase } from '@/lib/supabase'
import type { ServiceProfile, ServiceProfileTipo } from '@/types/database'

const profiles = ref<ServiceProfile[]>([])
const loading = ref(true)
const errorMsg = ref('')
const saving = ref(false)
const editingId = ref<string | null>(null)
const showForm = ref(false)

const TIPOS: ServiceProfileTipo[] = ['VEIP', 'ETH']

const form = reactive({
  name: '',
  tipo: 'VEIP' as ServiceProfileTipo,
  puerto_ani: 0,
})

function resetForm() {
  editingId.value = null
  form.name = ''
  form.tipo = 'VEIP'
  form.puerto_ani = 0
}

function openNew() {
  resetForm()
  showForm.value = true
}

function openEdit(profile: ServiceProfile) {
  editingId.value = profile.id
  form.name = profile.name
  form.tipo = profile.tipo
  form.puerto_ani = profile.puerto_ani
  showForm.value = true
}

async function loadProfiles() {
  loading.value = true
  errorMsg.value = ''
  const { data, error } = await supabase.from('service_profiles').select('*').order('name')
  if (error) {
    errorMsg.value = error.message
  } else {
    profiles.value = (data ?? []) as ServiceProfile[]
  }
  loading.value = false
}

onMounted(loadProfiles)

async function onSave() {
  saving.value = true
  errorMsg.value = ''
  try {
    if (editingId.value) {
      const { error } = await supabase.from('service_profiles').update(form).eq('id', editingId.value)
      if (error) throw error
    } else {
      const { error } = await supabase.from('service_profiles').insert(form)
      if (error) throw error
    }
    showForm.value = false
    await loadProfiles()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo guardar el service profile'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-6 py-8">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-xl font-semibold text-slate-900">Service profiles (ONU)</h1>
      <button
        class="flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
        @click="openNew"
      >
        <PlusIcon class="h-4 w-4" />
        Nuevo service profile
      </button>
    </div>

    <p v-if="errorMsg" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMsg }}</p>

    <div v-if="showForm" class="mb-6 rounded-xl border border-slate-200 bg-white p-6">
      <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {{ editingId ? 'Editar service profile' : 'Nuevo service profile' }}
      </h2>
      <form class="grid grid-cols-2 gap-4" @submit.prevent="onSave">
        <div class="col-span-2 space-y-1">
          <label class="text-sm font-medium text-slate-700">Nombre</label>
          <input v-model="form.name" required placeholder="SP-HG8145X6" class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Tipo</label>
          <select v-model="form.tipo" class="input">
            <option v-for="t in TIPOS" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Puerto ANI</label>
          <input v-model.number="form.puerto_ani" type="number" min="0" required class="input" />
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
            <th class="px-4 py-3">Tipo</th>
            <th class="px-4 py-3">Puerto ANI</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="loading">
            <td colspan="4" class="px-4 py-6 text-center text-slate-400">Cargando…</td>
          </tr>
          <tr v-else-if="!profiles.length">
            <td colspan="4" class="px-4 py-6 text-center text-slate-400">Sin service profiles</td>
          </tr>
          <tr v-for="p in profiles" :key="p.id" class="hover:bg-slate-50">
            <td class="px-4 py-3 font-medium text-slate-900">{{ p.name }}</td>
            <td class="px-4 py-3 text-slate-600">{{ p.tipo }}</td>
            <td class="px-4 py-3 tabular-nums text-slate-600">{{ p.puerto_ani }}</td>
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
