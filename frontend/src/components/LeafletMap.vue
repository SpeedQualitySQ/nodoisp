<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// Fix default marker icon paths breaking under Vite's bundler.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

export interface MapMarker {
  id: string
  lat: number
  lng: number
  color?: string
  popup?: string
}

const props = withDefaults(
  defineProps<{
    center?: [number, number]
    zoom?: number
    clickable?: boolean
    markers?: MapMarker[]
  }>(),
  {
    center: () => [-0.1807, -78.4678], // Quito, Ecuador
    zoom: 12,
    clickable: false,
    markers: () => [],
  },
)

const emit = defineEmits<{
  'map-click': [{ lat: number; lng: number }]
  'marker-click': [string]
}>()

const el = ref<HTMLDivElement | null>(null)
let map: L.Map | null = null
let layerGroup: L.LayerGroup | null = null

function colorIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<span style="
      display:block;width:16px;height:16px;border-radius:9999px;
      background:${color};border:2px solid white;
      box-shadow:0 0 0 1px rgba(0,0,0,0.25);
    "></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

function renderMarkers() {
  if (!layerGroup) return
  layerGroup.clearLayers()
  for (const m of props.markers) {
    const marker = L.marker([m.lat, m.lng], {
      icon: m.color ? colorIcon(m.color) : new L.Icon.Default(),
    })
    if (m.popup) marker.bindPopup(m.popup)
    marker.on('click', () => emit('marker-click', m.id))
    marker.addTo(layerGroup)
  }
}

onMounted(() => {
  if (!el.value) return
  map = L.map(el.value).setView(props.center, props.zoom)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map)
  layerGroup = L.layerGroup().addTo(map)
  renderMarkers()

  if (props.clickable) {
    map.on('click', (e: L.LeafletMouseEvent) => {
      emit('map-click', { lat: e.latlng.lat, lng: e.latlng.lng })
    })
  }
})

onBeforeUnmount(() => {
  map?.remove()
  map = null
})

watch(
  () => props.markers,
  () => renderMarkers(),
  { deep: true },
)
</script>

<template>
  <div ref="el" class="h-full w-full" />
</template>
