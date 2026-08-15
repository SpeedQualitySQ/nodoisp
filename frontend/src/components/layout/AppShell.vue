<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { computed } from 'vue'
import {
  UsersIcon,
  Squares2X2Icon,
  ViewColumnsIcon,
  MapPinIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  BanknotesIcon,
  CalculatorIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ServerIcon,
  Square3Stack3DIcon,
  SignalIcon,
  ArrowsRightLeftIcon,
  TagIcon,
  BoltIcon,
  AdjustmentsHorizontalIcon,
  WrenchScrewdriverIcon,
  CloudIcon,
  ArchiveBoxIcon,
  ArrowRightStartOnRectangleIcon,
} from '@heroicons/vue/24/outline'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()

const nav = [
  { name: 'clients-list', label: 'Clientes', icon: UsersIcon, match: '/clientes' },
  { name: 'plans', label: 'Planes', icon: Squares2X2Icon, match: '/planes' },
  { name: 'contracts-kanban', label: 'Contratos', icon: ViewColumnsIcon, match: '/contratos' },
  { name: 'installations', label: 'Instalaciones', icon: MapPinIcon, match: '/instalaciones' },
]

const navFacturacion = [
  { name: 'invoicing-manual', label: 'Facturación manual', icon: DocumentTextIcon, match: '/facturacion/manual' },
  { name: 'invoicing-recurring', label: 'Facturación recurrente', icon: ArrowPathIcon, match: '/facturacion/recurrente' },
  { name: 'collections', label: 'Cobros', icon: BanknotesIcon, match: '/facturacion/cobros' },
  { name: 'cash-register', label: 'Caja del día', icon: CalculatorIcon, match: '/facturacion/caja' },
  { name: 'billing-reports', label: 'Reportes', icon: ChartBarIcon, match: '/reportes' },
]

const navConfig = [
  { name: 'sri-emitter-config', label: 'Emisor SRI', icon: Cog6ToothIcon, match: '/configuracion' },
]

const navOlt = [
  { name: 'olt-devices', label: 'OLTs', icon: ServerIcon, match: '/olt' },
  { name: 'olt-cards', label: 'Tarjetas', icon: Square3Stack3DIcon, match: '/olt/cards' },
  { name: 'olt-pon-ports', label: 'Puertos PON', icon: SignalIcon, match: '/olt/pon-ports' },
  { name: 'olt-uplink-ports', label: 'Uplinks', icon: ArrowsRightLeftIcon, match: '/olt/uplink-ports' },
  { name: 'olt-vlans', label: 'VLANs', icon: TagIcon, match: '/olt/vlans' },
  { name: 'olt-speed-profiles', label: 'Perfiles de velocidad', icon: BoltIcon, match: '/olt/speed-profiles' },
  { name: 'olt-line-profiles', label: 'Line profiles', icon: AdjustmentsHorizontalIcon, match: '/olt/line-profiles' },
  { name: 'olt-service-profiles', label: 'Service profiles', icon: WrenchScrewdriverIcon, match: '/olt/profiles' },
  { name: 'olt-tr069-profiles', label: 'Perfiles TR-069', icon: CloudIcon, match: '/olt/tr069-profiles' },
  { name: 'olt-backups', label: 'Backups', icon: ArchiveBoxIcon, match: '/olt/backup' },
]

// Varias rutas de OLT comparten el prefijo /olt (p.ej. "/olt" para el listado
// de dispositivos y "/olt/vlans" para VLANs); con un simple startsWith ambas
// quedarían resaltadas a la vez. Se resalta solo el ítem cuyo `match` sea el
// prefijo más largo que calza con la ruta actual, entre todas las secciones.
const allNavItems = computed(() => [...nav, ...navFacturacion, ...navConfig, ...navOlt])

function isActive(item: { name: string; match: string }) {
  const candidates = allNavItems.value.filter((i) => route.path.startsWith(i.match))
  const longest = candidates.reduce<{ name: string; match: string } | null>(
    (best, current) => (!best || current.match.length > best.match.length ? current : best),
    null,
  )
  return longest?.name === item.name
}
</script>

<template>
  <div class="flex min-h-screen bg-slate-50">
    <aside class="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div class="px-5 py-5">
        <p class="text-lg font-semibold tracking-tight text-slate-900">NodoISP</p>
        <p class="text-xs text-slate-500">Fase 1-3 — Clientes, contratos, facturación y OLTs</p>
      </div>
      <nav class="flex-1 space-y-4 px-3">
        <div class="space-y-1">
          <RouterLink
            v-for="item in nav"
            :key="item.name"
            :to="{ name: item.name }"
            class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            :class="isActive(item) ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-100'"
          >
            <component :is="item.icon" class="h-5 w-5" />
            {{ item.label }}
          </RouterLink>
        </div>

        <div>
          <p class="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Facturación</p>
          <div class="space-y-1">
            <RouterLink
              v-for="item in navFacturacion"
              :key="item.name"
              :to="{ name: item.name }"
              class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              :class="isActive(item) ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-100'"
            >
              <component :is="item.icon" class="h-5 w-5" />
              {{ item.label }}
            </RouterLink>
          </div>
        </div>

        <div>
          <p class="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">OLT</p>
          <div class="space-y-1">
            <RouterLink
              v-for="item in navOlt"
              :key="item.name"
              :to="{ name: item.name }"
              class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              :class="isActive(item) ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-100'"
            >
              <component :is="item.icon" class="h-5 w-5" />
              {{ item.label }}
            </RouterLink>
          </div>
        </div>

        <div>
          <p class="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Configuración</p>
          <div class="space-y-1">
            <RouterLink
              v-for="item in navConfig"
              :key="item.name"
              :to="{ name: item.name }"
              class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              :class="isActive(item) ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-100'"
            >
              <component :is="item.icon" class="h-5 w-5" />
              {{ item.label }}
            </RouterLink>
          </div>
        </div>
      </nav>
      <div class="border-t border-slate-200 p-3">
        <p class="truncate px-2 text-xs text-slate-500">
          {{ auth.profile?.full_name || auth.user?.email }}
        </p>
        <button
          class="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-600 hover:bg-slate-100"
          @click="auth.signOut()"
        >
          <ArrowRightStartOnRectangleIcon class="h-5 w-5" />
          Cerrar sesión
        </button>
      </div>
    </aside>
    <main class="flex-1 overflow-y-auto">
      <RouterView />
    </main>
  </div>
</template>
