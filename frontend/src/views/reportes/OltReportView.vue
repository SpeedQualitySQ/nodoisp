<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { supabase } from '@/lib/supabase'
import type { OltDevice } from '@/types/database'
import StatusBadge from '@/components/StatusBadge.vue'

const devices = ref<OltDevice[]>([])
const loading = ref(true)

onMounted(async () => {
  const { data } = await supabase.from('olt_devices').select('*').order('name')
  devices.value = (data ?? []) as OltDevice[]
  loading.value = false
})

const online = computed(() => devices.value.filter((d) => d.status === 'online').length)
</script>

<template>
  <div class="mx-auto max-w-3xl px-6 py-8">
    <h1 class="mb-1 text-xl font-semibold text-slate-900">Reporte de OLTs</h1>
    <p class="mb-6 text-sm text-slate-500">{{ online }} de {{ devices.length }} en línea</p>

    <div v-if="loading" class="text-sm text-slate-400">Cargando…</div>
    <div v-else class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th class="px-4 py-3">Nombre</th>
            <th class="px-4 py-3">Modelo</th>
            <th class="px-4 py-3">Host</th>
            <th class="px-4 py-3">Estado</th>
            <th class="px-4 py-3">Último chequeo</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="!devices.length">
            <td colspan="5" class="px-4 py-6 text-center text-slate-400">Sin OLTs registradas</td>
          </tr>
          <tr v-for="d in devices" :key="d.id">
            <td class="px-4 py-3 font-medium text-slate-900">{{ d.name }}</td>
            <td class="px-4 py-3 text-slate-600">{{ d.model }}</td>
            <td class="px-4 py-3 font-mono text-xs text-slate-600">{{ d.host }}</td>
            <td class="px-4 py-3"><StatusBadge :status="d.status" /></td>
            <td class="px-4 py-3 text-slate-600">{{ d.last_checked_at ? new Date(d.last_checked_at).toLocaleString('es-EC') : '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
