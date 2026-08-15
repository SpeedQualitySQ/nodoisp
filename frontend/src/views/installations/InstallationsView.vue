<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { supabase } from '@/lib/supabase'
import type { InstallationItem, Profile } from '@/types/database'
import LeafletMap, { type MapMarker } from '@/components/LeafletMap.vue'

const items = ref<InstallationItem[]>([])
const technicians = ref<Profile[]>([])
const loading = ref(true)
const errorMsg = ref('')
const expandedId = ref<string | null>(null)

const installForm = reactive<Record<string, { date: string; notes: string }>>({})

const markers = computed<MapMarker[]>(() =>
  items.value
    .filter((i) => i.lat != null && i.lng != null)
    .map((i) => ({
      id: i.id,
      lat: i.lat as number,
      lng: i.lng as number,
      color: i.technician_id ? '#3b82f6' : '#ef4444',
      popup: `${i.client_first_name} ${i.client_last_name} — ${i.plan_name}`,
    })),
)

async function loadInstallations() {
  loading.value = true
  errorMsg.value = ''
  const [{ data, error }, { data: profiles }] = await Promise.all([
    supabase
      .from('service_contracts')
      .select(
        `*,
         clients ( first_name, last_name, installation_addresses ( address_line, lat, lng, is_primary ) ),
         plans ( name ),
         technician:profiles ( full_name )`,
      )
      .eq('status', 'pending')
      .order('installation_date', { ascending: true, nullsFirst: false }),
    supabase.from('profiles').select('*').order('full_name'),
  ])

  technicians.value = (profiles ?? []) as Profile[]

  if (error) {
    errorMsg.value = error.message
    loading.value = false
    return
  }

  items.value = (data ?? []).map((row: any) => {
    const addresses = row.clients?.installation_addresses ?? []
    const primary = addresses.find((a: any) => a.is_primary) ?? addresses[0]
    return {
      ...row,
      client_first_name: row.clients?.first_name ?? '',
      client_last_name: row.clients?.last_name ?? '',
      plan_name: row.plans?.name ?? '',
      technician_full_name: row.technician?.full_name ?? null,
      address_line: primary?.address_line ?? null,
      lat: primary?.lat ?? null,
      lng: primary?.lng ?? null,
    } as InstallationItem
  })

  for (const item of items.value) {
    installForm[item.id] = { date: new Date().toISOString().slice(0, 10), notes: '' }
  }

  loading.value = false
}

async function assignTechnician(item: InstallationItem, technicianId: string) {
  const { error } = await supabase
    .from('service_contracts')
    .update({ technician_id: technicianId || null })
    .eq('id', item.id)
  if (error) {
    errorMsg.value = error.message
    return
  }
  await loadInstallations()
}

async function confirmInstallation(item: InstallationItem) {
  const form = installForm[item.id]
  const { error } = await supabase
    .from('service_contracts')
    .update({
      status: 'active',
      start_date: form.date,
      notes: form.notes || item.notes,
    })
    .eq('id', item.id)
  if (error) {
    errorMsg.value = error.message
    return
  }
  expandedId.value = null
  await loadInstallations()
}

onMounted(loadInstallations)
</script>

<template>
  <div class="mx-auto max-w-6xl px-6 py-8">
    <div class="mb-6">
      <h1 class="text-xl font-semibold text-slate-900">Instalaciones pendientes</h1>
      <p class="text-sm text-slate-500">{{ items.length }} contratos esperando instalación</p>
    </div>

    <p v-if="errorMsg" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      {{ errorMsg }}
    </p>

    <div class="mb-6 h-80 overflow-hidden rounded-xl border border-slate-200">
      <LeafletMap :markers="markers" :zoom="11" />
    </div>
    <div class="mb-6 flex gap-4 text-xs text-slate-500">
      <span class="flex items-center gap-1"><span class="h-2.5 w-2.5 rounded-full bg-red-500"></span> Sin técnico</span>
      <span class="flex items-center gap-1"><span class="h-2.5 w-2.5 rounded-full bg-blue-500"></span> Con técnico</span>
    </div>

    <div v-if="loading" class="text-sm text-slate-400">Cargando…</div>
    <div v-else-if="!items.length" class="text-sm text-slate-400">No hay instalaciones pendientes.</div>

    <div v-else class="space-y-3">
      <article
        v-for="item in items"
        :key="item.id"
        class="rounded-xl border border-slate-200 bg-white p-4"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="font-medium text-slate-900">
              {{ item.client_first_name }} {{ item.client_last_name }}
              <span class="ml-2 font-mono text-xs text-slate-400">{{ item.contract_number }}</span>
            </p>
            <p class="text-sm text-slate-600">
              {{ item.plan_name }} · {{ item.address_line || 'Sin dirección registrada' }}
            </p>
            <p class="text-xs text-slate-400">
              Programada: {{ item.installation_date || 'sin fecha' }}
            </p>
          </div>

          <div class="flex items-center gap-3">
            <select
              class="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              :value="item.technician_id ?? ''"
              @change="assignTechnician(item, ($event.target as HTMLSelectElement).value)"
            >
              <option value="">Sin técnico</option>
              <option v-for="t in technicians" :key="t.id" :value="t.id">
                {{ t.full_name || t.email }}
              </option>
            </select>
            <button
              class="rounded-lg bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800"
              @click="expandedId = expandedId === item.id ? null : item.id"
            >
              Marcar instalada
            </button>
          </div>
        </div>

        <div v-if="expandedId === item.id" class="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Fecha real de instalación</label>
            <input v-model="installForm[item.id].date" type="date" class="input" />
          </div>
          <div class="col-span-2 space-y-1">
            <label class="text-sm font-medium text-slate-700">Notas</label>
            <textarea v-model="installForm[item.id].notes" rows="2" class="input"></textarea>
          </div>
          <div class="col-span-2 flex justify-end">
            <button
              class="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
              @click="confirmInstallation(item)"
            >
              Confirmar instalación
            </button>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.input {
  @apply w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600;
}
</style>
