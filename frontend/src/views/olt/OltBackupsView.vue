<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { ArchiveBoxIcon } from '@heroicons/vue/24/outline'
import { supabase } from '@/lib/supabase'
import { ejecutarBackup } from '@/lib/olt'
import { useAuthStore } from '@/stores/auth'
import type { OltBackup, OltDevice } from '@/types/database'

const auth = useAuthStore()

const devices = ref<OltDevice[]>([])
const selectedOltId = ref<string | null>(null)
const backups = ref<OltBackup[]>([])
const loading = ref(true)
const errorMsg = ref('')
const running = ref(false)
const expandedId = ref<string | null>(null)

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

async function loadBackups() {
  if (!selectedOltId.value) {
    backups.value = []
    loading.value = false
    return
  }
  loading.value = true
  errorMsg.value = ''
  const { data, error } = await supabase
    .from('olt_backups')
    .select('*')
    .eq('olt_id', selectedOltId.value)
    .order('created_at', { ascending: false })
  if (error) {
    errorMsg.value = error.message
  } else {
    backups.value = (data ?? []) as OltBackup[]
  }
  loading.value = false
}

watch(selectedOltId, loadBackups)
onMounted(async () => {
  await loadDevices()
  await loadBackups()
})

async function onEjecutarBackup() {
  const device = devices.value.find((d) => d.id === selectedOltId.value)
  if (!device) return
  errorMsg.value = ''
  running.value = true
  try {
    await ejecutarBackup(device, auth.user?.id)
    await loadBackups()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo ejecutar el backup'
  } finally {
    running.value = false
  }
}

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-6 py-8">
    <div class="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-slate-900">Backups de configuración</h1>
        <p class="text-sm text-slate-500">{{ backups.length }} backups guardados</p>
      </div>
      <div class="flex items-end gap-3">
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">OLT</label>
          <select v-model="selectedOltId" class="input">
            <option v-for="d in devices" :key="d.id" :value="d.id">{{ d.name }}</option>
          </select>
        </div>
        <button
          :disabled="running || !selectedOltId"
          class="flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          @click="onEjecutarBackup"
        >
          <ArchiveBoxIcon class="h-4 w-4" />
          {{ running ? 'Ejecutando…' : 'Ejecutar backup' }}
        </button>
      </div>
    </div>

    <p v-if="errorMsg" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMsg }}</p>

    <div class="space-y-3">
      <p v-if="loading" class="text-center text-sm text-slate-400">Cargando…</p>
      <p v-else-if="!backups.length" class="text-center text-sm text-slate-400">Sin backups para esta OLT</p>
      <div v-for="b in backups" :key="b.id" class="rounded-xl border border-slate-200 bg-white">
        <button
          type="button"
          class="flex w-full items-center justify-between px-4 py-3 text-left text-sm"
          @click="toggleExpand(b.id)"
        >
          <span class="text-slate-700">{{ new Date(b.created_at).toLocaleString('es-EC') }}</span>
          <span class="font-medium text-teal-700">{{ expandedId === b.id ? 'Ocultar' : 'Ver' }}</span>
        </button>
        <pre
          v-if="expandedId === b.id"
          class="overflow-x-auto border-t border-slate-100 bg-slate-50 px-4 py-3 font-mono text-xs text-slate-700"
          >{{ b.config_text }}</pre
        >
      </div>
    </div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.input {
  @apply rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600;
}
</style>
