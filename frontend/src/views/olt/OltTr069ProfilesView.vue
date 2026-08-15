<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { PlusIcon } from '@heroicons/vue/24/outline'
import { supabase } from '@/lib/supabase'
import type { Tr069Profile } from '@/types/database'

const profiles = ref<Tr069Profile[]>([])
const loading = ref(true)
const errorMsg = ref('')
const saving = ref(false)
const editingId = ref<string | null>(null)
const showForm = ref(false)

const form = reactive({
  name: '',
  acs_url: '',
  acs_user: '',
  acs_password: '',
  interval_seconds: 3600,
})

function resetForm() {
  editingId.value = null
  form.name = ''
  form.acs_url = ''
  form.acs_user = ''
  form.acs_password = ''
  form.interval_seconds = 3600
}

function openNew() {
  resetForm()
  showForm.value = true
}

function openEdit(profile: Tr069Profile) {
  editingId.value = profile.id
  form.name = profile.name
  form.acs_url = profile.acs_url
  form.acs_user = profile.acs_user ?? ''
  form.acs_password = profile.acs_password ?? ''
  form.interval_seconds = profile.interval_seconds
  showForm.value = true
}

async function loadProfiles() {
  loading.value = true
  errorMsg.value = ''
  const { data, error } = await supabase.from('tr069_profiles').select('*').order('name')
  if (error) {
    errorMsg.value = error.message
  } else {
    profiles.value = (data ?? []) as Tr069Profile[]
  }
  loading.value = false
}

onMounted(loadProfiles)

async function onSave() {
  saving.value = true
  errorMsg.value = ''
  try {
    const payload = {
      name: form.name,
      acs_url: form.acs_url,
      acs_user: form.acs_user || null,
      acs_password: form.acs_password || null,
      interval_seconds: form.interval_seconds,
    }
    if (editingId.value) {
      const { error } = await supabase.from('tr069_profiles').update(payload).eq('id', editingId.value)
      if (error) throw error
    } else {
      const { error } = await supabase.from('tr069_profiles').insert(payload)
      if (error) throw error
    }
    showForm.value = false
    await loadProfiles()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo guardar el perfil TR-069'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-6 py-8">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-xl font-semibold text-slate-900">Perfiles TR-069</h1>
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
        {{ editingId ? 'Editar perfil TR-069' : 'Nuevo perfil TR-069' }}
      </h2>
      <form class="grid grid-cols-2 gap-4" @submit.prevent="onSave">
        <div class="col-span-2 space-y-1">
          <label class="text-sm font-medium text-slate-700">Nombre</label>
          <input v-model="form.name" required placeholder="ACS-Principal" class="input" />
        </div>
        <div class="col-span-2 space-y-1">
          <label class="text-sm font-medium text-slate-700">URL ACS</label>
          <input v-model="form.acs_url" required placeholder="http://servidor-genieacs:7547" class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Usuario ACS</label>
          <input v-model="form.acs_user" class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Contraseña ACS</label>
          <input v-model="form.acs_password" type="password" class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Intervalo (segundos)</label>
          <input v-model.number="form.interval_seconds" type="number" min="60" required class="input" />
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
            <th class="px-4 py-3">URL ACS</th>
            <th class="px-4 py-3">Intervalo</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="loading">
            <td colspan="4" class="px-4 py-6 text-center text-slate-400">Cargando…</td>
          </tr>
          <tr v-else-if="!profiles.length">
            <td colspan="4" class="px-4 py-6 text-center text-slate-400">Sin perfiles TR-069</td>
          </tr>
          <tr v-for="p in profiles" :key="p.id" class="hover:bg-slate-50">
            <td class="px-4 py-3 font-medium text-slate-900">{{ p.name }}</td>
            <td class="px-4 py-3 font-mono text-xs text-slate-600">{{ p.acs_url }}</td>
            <td class="px-4 py-3 tabular-nums text-slate-600">{{ p.interval_seconds }}s</td>
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
