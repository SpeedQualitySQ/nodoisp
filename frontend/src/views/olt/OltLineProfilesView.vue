<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { PlusIcon } from '@heroicons/vue/24/outline'
import { supabase } from '@/lib/supabase'
import type { LineProfile, SpeedProfile } from '@/types/database'

const profiles = ref<LineProfile[]>([])
const speedProfiles = ref<SpeedProfile[]>([])
const loading = ref(true)
const errorMsg = ref('')
const saving = ref(false)
const editingId = ref<string | null>(null)
const showForm = ref(false)

const form = reactive({
  name: '',
  tcont: 1,
  gem_port_id: 0,
  vlan_id: 100,
  mapping: '802.1p',
  speed_profile_id: null as string | null,
})

const speedProfileName = computed(() => {
  const map = new Map(speedProfiles.value.map((s) => [s.id, s.name]))
  return (id: string | null) => (id ? map.get(id) ?? '—' : '—')
})

function resetForm() {
  editingId.value = null
  form.name = ''
  form.tcont = 1
  form.gem_port_id = 0
  form.vlan_id = 100
  form.mapping = '802.1p'
  form.speed_profile_id = null
}

function openNew() {
  resetForm()
  showForm.value = true
}

function openEdit(profile: LineProfile) {
  editingId.value = profile.id
  form.name = profile.name
  form.tcont = profile.tcont
  form.gem_port_id = profile.gem_port_id
  form.vlan_id = profile.vlan_id
  form.mapping = profile.mapping
  form.speed_profile_id = profile.speed_profile_id
  showForm.value = true
}

async function loadAll() {
  loading.value = true
  errorMsg.value = ''
  const [profilesRes, speedRes] = await Promise.all([
    supabase.from('line_profiles').select('*').order('name'),
    supabase.from('speed_profiles').select('*').order('name'),
  ])
  if (profilesRes.error) errorMsg.value = profilesRes.error.message
  profiles.value = (profilesRes.data ?? []) as LineProfile[]
  speedProfiles.value = (speedRes.data ?? []) as SpeedProfile[]
  loading.value = false
}

onMounted(loadAll)

async function onSave() {
  saving.value = true
  errorMsg.value = ''
  try {
    if (editingId.value) {
      const { error } = await supabase.from('line_profiles').update(form).eq('id', editingId.value)
      if (error) throw error
    } else {
      const { error } = await supabase.from('line_profiles').insert(form)
      if (error) throw error
    }
    showForm.value = false
    await loadAll()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo guardar el line profile'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-6 py-8">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-xl font-semibold text-slate-900">Line profiles</h1>
      <button
        class="flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
        @click="openNew"
      >
        <PlusIcon class="h-4 w-4" />
        Nuevo line profile
      </button>
    </div>

    <p v-if="errorMsg" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMsg }}</p>

    <div v-if="showForm" class="mb-6 rounded-xl border border-slate-200 bg-white p-6">
      <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {{ editingId ? 'Editar line profile' : 'Nuevo line profile' }}
      </h2>
      <form class="grid grid-cols-2 gap-4" @submit.prevent="onSave">
        <div class="col-span-2 space-y-1">
          <label class="text-sm font-medium text-slate-700">Nombre</label>
          <input v-model="form.name" required placeholder="LP-GPON-20M" class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">T-CONT</label>
          <input v-model.number="form.tcont" type="number" min="0" required class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">GEM Port ID</label>
          <input v-model.number="form.gem_port_id" type="number" min="0" required class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">VLAN</label>
          <input v-model.number="form.vlan_id" type="number" min="1" max="4094" required class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Mapping</label>
          <input v-model="form.mapping" required class="input" />
        </div>
        <div class="col-span-2 space-y-1">
          <label class="text-sm font-medium text-slate-700">Speed profile</label>
          <select v-model="form.speed_profile_id" class="input">
            <option :value="null">— Ninguno —</option>
            <option v-for="s in speedProfiles" :key="s.id" :value="s.id">{{ s.name }}</option>
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
            <th class="px-4 py-3">Nombre</th>
            <th class="px-4 py-3">T-CONT</th>
            <th class="px-4 py-3">GEM Port</th>
            <th class="px-4 py-3">VLAN</th>
            <th class="px-4 py-3">Speed profile</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="loading">
            <td colspan="6" class="px-4 py-6 text-center text-slate-400">Cargando…</td>
          </tr>
          <tr v-else-if="!profiles.length">
            <td colspan="6" class="px-4 py-6 text-center text-slate-400">Sin line profiles</td>
          </tr>
          <tr v-for="p in profiles" :key="p.id" class="hover:bg-slate-50">
            <td class="px-4 py-3 font-medium text-slate-900">{{ p.name }}</td>
            <td class="px-4 py-3 tabular-nums text-slate-600">{{ p.tcont }}</td>
            <td class="px-4 py-3 tabular-nums text-slate-600">{{ p.gem_port_id }}</td>
            <td class="px-4 py-3 tabular-nums text-slate-600">{{ p.vlan_id }}</td>
            <td class="px-4 py-3 text-slate-600">{{ speedProfileName(p.speed_profile_id) }}</td>
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
