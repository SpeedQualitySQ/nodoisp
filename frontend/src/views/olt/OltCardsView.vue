<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { ArrowPathIcon } from '@heroicons/vue/24/outline'
import { supabase } from '@/lib/supabase'
import { sincronizarTarjetas } from '@/lib/olt'
import type { OltCard, OltDevice } from '@/types/database'
import StatusBadge from '@/components/StatusBadge.vue'

const devices = ref<OltDevice[]>([])
const selectedOltId = ref<string | null>(null)
const cards = ref<OltCard[]>([])
const loading = ref(true)
const errorMsg = ref('')
const syncing = ref(false)

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

async function loadCards() {
  if (!selectedOltId.value) {
    cards.value = []
    loading.value = false
    return
  }
  loading.value = true
  errorMsg.value = ''
  const { data, error } = await supabase
    .from('olt_cards')
    .select('*')
    .eq('olt_id', selectedOltId.value)
    .order('slot')
  if (error) {
    errorMsg.value = error.message
  } else {
    cards.value = (data ?? []) as OltCard[]
  }
  loading.value = false
}

watch(selectedOltId, loadCards)
onMounted(async () => {
  await loadDevices()
  await loadCards()
})

async function onSincronizar() {
  if (!selectedOltId.value) return
  errorMsg.value = ''
  syncing.value = true
  try {
    await sincronizarTarjetas(selectedOltId.value)
    await loadCards()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo sincronizar las tarjetas'
  } finally {
    syncing.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-6 py-8">
    <div class="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-slate-900">Tarjetas</h1>
        <p class="text-sm text-slate-500">Se leen desde la OLT vía SSH — no se crean manualmente</p>
      </div>
      <div class="flex items-end gap-3">
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">OLT</label>
          <select v-model="selectedOltId" class="input">
            <option v-for="d in devices" :key="d.id" :value="d.id">{{ d.name }}</option>
          </select>
        </div>
        <button
          :disabled="syncing || !selectedOltId"
          class="flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          @click="onSincronizar"
        >
          <ArrowPathIcon class="h-4 w-4" />
          {{ syncing ? 'Sincronizando…' : 'Sincronizar tarjetas' }}
        </button>
      </div>
    </div>

    <p v-if="errorMsg" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMsg }}</p>

    <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th class="px-4 py-3">Slot</th>
            <th class="px-4 py-3">Tipo</th>
            <th class="px-4 py-3">Puertos</th>
            <th class="px-4 py-3">Estado</th>
            <th class="px-4 py-3">Última sincronización</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="loading">
            <td colspan="5" class="px-4 py-6 text-center text-slate-400">Cargando…</td>
          </tr>
          <tr v-else-if="!cards.length">
            <td colspan="5" class="px-4 py-6 text-center text-slate-400">
              Sin tarjetas sincronizadas para esta OLT
            </td>
          </tr>
          <tr v-for="c in cards" :key="c.id" class="hover:bg-slate-50">
            <td class="px-4 py-3 tabular-nums text-slate-900">{{ c.slot }}</td>
            <td class="px-4 py-3 font-mono text-xs text-slate-700">{{ c.card_type }}</td>
            <td class="px-4 py-3 tabular-nums text-slate-600">{{ c.port_count }}</td>
            <td class="px-4 py-3"><StatusBadge :status="c.status" /></td>
            <td class="px-4 py-3 text-slate-500">{{ new Date(c.synced_at).toLocaleString('es-EC') }}</td>
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
