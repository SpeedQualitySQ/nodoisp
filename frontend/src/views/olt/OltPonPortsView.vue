<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { supabase } from '@/lib/supabase'
import type { OltDevice, OltPonPortWithCard } from '@/types/database'
import StatusBadge from '@/components/StatusBadge.vue'

const devices = ref<OltDevice[]>([])
const selectedOltId = ref<string | null>(null)
const ports = ref<OltPonPortWithCard[]>([])
const loading = ref(true)
const errorMsg = ref('')

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

async function loadPorts() {
  if (!selectedOltId.value) {
    ports.value = []
    loading.value = false
    return
  }
  loading.value = true
  errorMsg.value = ''
  const { data, error } = await supabase
    .from('olt_pon_ports')
    .select('*, olt_cards!inner(slot, olt_id)')
    .eq('olt_cards.olt_id', selectedOltId.value)
    .order('port')
  if (error) {
    errorMsg.value = error.message
  } else {
    ports.value = (data ?? []) as unknown as OltPonPortWithCard[]
  }
  loading.value = false
}

watch(selectedOltId, loadPorts)
onMounted(async () => {
  await loadDevices()
  await loadPorts()
})
</script>

<template>
  <div class="mx-auto max-w-4xl px-6 py-8">
    <div class="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-slate-900">Puertos PON</h1>
        <p class="text-sm text-slate-500">Se sincronizan junto con las tarjetas</p>
      </div>
      <div class="space-y-1">
        <label class="text-sm font-medium text-slate-700">OLT</label>
        <select v-model="selectedOltId" class="input">
          <option v-for="d in devices" :key="d.id" :value="d.id">{{ d.name }}</option>
        </select>
      </div>
    </div>

    <p v-if="errorMsg" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMsg }}</p>

    <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th class="px-4 py-3">Frame/Slot/Port</th>
            <th class="px-4 py-3">ONUs activas</th>
            <th class="px-4 py-3">Estado</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="loading">
            <td colspan="3" class="px-4 py-6 text-center text-slate-400">Cargando…</td>
          </tr>
          <tr v-else-if="!ports.length">
            <td colspan="3" class="px-4 py-6 text-center text-slate-400">
              Sin puertos sincronizados para esta OLT
            </td>
          </tr>
          <tr v-for="p in ports" :key="p.id" class="hover:bg-slate-50">
            <td class="px-4 py-3 font-mono text-xs text-slate-900">
              {{ p.frame }}/{{ p.olt_cards?.slot }}/{{ p.port }}
            </td>
            <td class="px-4 py-3 tabular-nums text-slate-600">{{ p.onu_count }}</td>
            <td class="px-4 py-3"><StatusBadge :status="p.status" /></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.input {
  @apply rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600;
}
</style>
