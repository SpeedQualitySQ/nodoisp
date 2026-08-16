<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowPathIcon } from '@heroicons/vue/24/outline'
import { deleteDevice, deviceLabel, isOnline, listDevices } from '@/lib/genieacs'
import type { GenieAcsDevice } from '@/types/database'
import StatusBadge from '@/components/StatusBadge.vue'

const devices = ref<GenieAcsDevice[]>([])
const loading = ref(true)
const errorMsg = ref('')
const busyId = ref<string | null>(null)

async function loadDevices() {
  loading.value = true
  errorMsg.value = ''
  try {
    devices.value = await listDevices()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo conectar con GenieACS'
  } finally {
    loading.value = false
  }
}

onMounted(loadDevices)

async function onEliminar(device: GenieAcsDevice) {
  if (!confirm(`¿Eliminar el CPE ${deviceLabel(device).serial} del ACS? Esta acción no se puede deshacer.`)) return
  busyId.value = device._id
  errorMsg.value = ''
  try {
    await deleteDevice(device._id)
    await loadDevices()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo eliminar el CPE'
  } finally {
    busyId.value = null
  }
}

function lastInformLabel(device: GenieAcsDevice) {
  if (!device._lastInform) return '—'
  return new Date(device._lastInform).toLocaleString('es-EC')
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-6 py-8">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-slate-900">CPEs (TR-069)</h1>
        <p class="text-sm text-slate-500">{{ devices.length }} equipos conectados al ACS</p>
      </div>
      <button
        class="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
        @click="loadDevices"
      >
        <ArrowPathIcon class="h-4 w-4" />
        Refrescar lista
      </button>
    </div>

    <p v-if="errorMsg" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMsg }}</p>

    <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th class="px-4 py-3">Fabricante / Modelo</th>
            <th class="px-4 py-3">Serial</th>
            <th class="px-4 py-3">Último contacto</th>
            <th class="px-4 py-3">Estado</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="loading">
            <td colspan="5" class="px-4 py-6 text-center text-slate-400">Cargando…</td>
          </tr>
          <tr v-else-if="!devices.length">
            <td colspan="5" class="px-4 py-6 text-center text-slate-400">
              Sin CPEs registrados. Configurá la URL del ACS en el equipo del cliente para que aparezca acá.
            </td>
          </tr>
          <tr v-for="d in devices" :key="d._id" class="hover:bg-slate-50">
            <td class="px-4 py-3 font-medium text-slate-900">
              {{ deviceLabel(d).manufacturer }} {{ deviceLabel(d).productClass }}
            </td>
            <td class="px-4 py-3 font-mono text-xs text-slate-600">{{ deviceLabel(d).serial }}</td>
            <td class="px-4 py-3 text-slate-600">{{ lastInformLabel(d) }}</td>
            <td class="px-4 py-3">
              <StatusBadge :status="isOnline(d) ? 'online' : 'offline'" />
            </td>
            <td class="px-4 py-3 text-right whitespace-nowrap">
              <RouterLink
                :to="{ name: 'tr069-device-detail', params: { id: d._id } }"
                class="mr-3 text-sm font-medium text-teal-700 hover:text-teal-900"
              >
                Ver detalle
              </RouterLink>
              <button
                :disabled="busyId === d._id"
                class="text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-60"
                @click="onEliminar(d)"
              >
                Eliminar
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
