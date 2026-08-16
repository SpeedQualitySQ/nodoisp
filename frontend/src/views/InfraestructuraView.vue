<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { supabase } from '@/lib/supabase'
import LeafletMap, { type MapMarker } from '@/components/LeafletMap.vue'

// Colores del set categórico validado (dataviz), primeros 3 en orden fijo —
// identidad de 3 tipos de marcador en el mismo mapa.
const COLOR_OLT = '#2a78d6'
const COLOR_ZONA = '#eb6834'
const COLOR_CLIENTE = '#1baf7a'

const loading = ref(true)
const errorMsg = ref('')
const oltMarkers = ref<MapMarker[]>([])
const zoneMarkers = ref<MapMarker[]>([])
const clientMarkers = ref<MapMarker[]>([])
const showOlt = ref(true)
const showZones = ref(true)
const showClients = ref(true)

async function load() {
  loading.value = true
  errorMsg.value = ''
  const [{ data: olts, error: oltError }, { data: zones, error: zoneError }, { data: addresses, error: addrError }] = await Promise.all([
    supabase.from('olt_devices').select('id, name, lat, lng').not('lat', 'is', null).not('lng', 'is', null),
    supabase.from('zones').select('id, name, lat, lng').not('lat', 'is', null).not('lng', 'is', null),
    supabase
      .from('installation_addresses')
      .select('id, address_line, lat, lng, clients(first_name, last_name)')
      .eq('is_primary', true)
      .not('lat', 'is', null)
      .not('lng', 'is', null),
  ])
  if (oltError) errorMsg.value = oltError.message
  if (zoneError) errorMsg.value = zoneError.message
  if (addrError) errorMsg.value = addrError.message

  oltMarkers.value = (olts ?? []).map((o) => ({ id: o.id, lat: o.lat as number, lng: o.lng as number, color: COLOR_OLT, popup: `OLT: ${o.name}` }))
  zoneMarkers.value = (zones ?? []).map((z) => ({ id: z.id, lat: z.lat as number, lng: z.lng as number, color: COLOR_ZONA, popup: `Zona: ${z.name}` }))
  clientMarkers.value = (addresses ?? []).map((a) => {
    const client = a.clients as unknown as { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
    const c = Array.isArray(client) ? client[0] : client
    return {
      id: a.id,
      lat: a.lat as number,
      lng: a.lng as number,
      color: COLOR_CLIENTE,
      popup: c ? `Cliente: ${c.last_name} ${c.first_name}` : a.address_line,
    }
  })
  loading.value = false
}

onMounted(load)

const markers = computed(() => [
  ...(showOlt.value ? oltMarkers.value : []),
  ...(showZones.value ? zoneMarkers.value : []),
  ...(showClients.value ? clientMarkers.value : []),
])
</script>

<template>
  <div class="mx-auto max-w-6xl px-6 py-8">
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold text-slate-900">Infraestructura</h1>
        <p class="text-sm text-slate-500">Mapa de OLTs, zonas y clientes con ubicación registrada.</p>
      </div>
      <div class="flex flex-wrap gap-4 text-sm">
        <label class="flex items-center gap-2">
          <input v-model="showOlt" type="checkbox" class="h-4 w-4 rounded border-slate-300" />
          <span class="inline-block h-2.5 w-2.5 rounded-full" :style="{ background: COLOR_OLT }" />
          OLTs ({{ oltMarkers.length }})
        </label>
        <label class="flex items-center gap-2">
          <input v-model="showZones" type="checkbox" class="h-4 w-4 rounded border-slate-300" />
          <span class="inline-block h-2.5 w-2.5 rounded-full" :style="{ background: COLOR_ZONA }" />
          Zonas ({{ zoneMarkers.length }})
        </label>
        <label class="flex items-center gap-2">
          <input v-model="showClients" type="checkbox" class="h-4 w-4 rounded border-slate-300" />
          <span class="inline-block h-2.5 w-2.5 rounded-full" :style="{ background: COLOR_CLIENTE }" />
          Clientes ({{ clientMarkers.length }})
        </label>
      </div>
    </div>

    <p v-if="errorMsg" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMsg }}</p>
    <p
      v-if="!loading && !oltMarkers.length && !zoneMarkers.length"
      class="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700"
    >
      Ninguna OLT ni zona tiene coordenadas cargadas todavía — se agregan editando el dispositivo/zona. Los clientes sí se
      geolocalizan al registrar su dirección de instalación.
    </p>

    <div v-if="loading" class="text-sm text-slate-400">Cargando…</div>
    <div v-else class="h-[600px] overflow-hidden rounded-xl border border-slate-200">
      <LeafletMap :markers="markers" />
    </div>
  </div>
</template>
