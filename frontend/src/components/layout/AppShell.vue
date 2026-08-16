<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { computed, ref, watch } from 'vue'
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
  RectangleStackIcon,
  WifiIcon,
  GlobeAltIcon,
  CpuChipIcon,
  CircleStackIcon,
  ShieldCheckIcon,
  LockClosedIcon,
  GlobeAsiaAustraliaIcon,
  RssIcon,
  TicketIcon,
  IdentificationIcon,
  ChatBubbleLeftRightIcon,
  HomeIcon,
  BuildingOffice2Icon,
  MapIcon,
  ArchiveBoxArrowDownIcon,
  UserGroupIcon,
  CubeIcon,
  ArrowDownOnSquareIcon,
  ArrowUpOnSquareIcon,
  ClipboardDocumentListIcon,
  ArrowRightStartOnRectangleIcon,
} from '@heroicons/vue/24/outline'
import { useAuthStore } from '@/stores/auth'
import type { ModuleKey } from '@/types/database'

const auth = useAuthStore()
const route = useRoute()
const mainEl = ref<HTMLElement | null>(null)

// <main> es el que scrollea (no la ventana), así que vue-router no lo
// resetea solo: sin esto, al navegar a otra pantalla el contenido nuevo se
// dibuja arriba pero el scroll queda donde estaba, y da la sensación de que
// la pantalla "no cargó" hasta que subís manualmente.
watch(
  () => route.fullPath,
  () => mainEl.value?.scrollTo(0, 0),
)

const navDashboard = [{ name: 'dashboard', label: 'Dashboard', icon: HomeIcon, match: '/', perm: 'dashboard' as ModuleKey }]

const nav = [
  { name: 'clients-list', label: 'Clientes', icon: UsersIcon, match: '/clientes', perm: 'clientes' as ModuleKey },
  { name: 'plans', label: 'Planes', icon: Squares2X2Icon, match: '/planes', perm: 'planes' as ModuleKey },
  { name: 'contracts-kanban', label: 'Contratos', icon: ViewColumnsIcon, match: '/contratos', perm: 'clientes' as ModuleKey },
  { name: 'installations', label: 'Instalaciones', icon: MapPinIcon, match: '/instalaciones', perm: 'clientes' as ModuleKey },
]

const navFacturacion = [
  { name: 'invoicing-manual', label: 'Facturación manual', icon: DocumentTextIcon, match: '/facturacion/manual', perm: 'facturacion' as ModuleKey },
  { name: 'invoicing-recurring', label: 'Facturación recurrente', icon: ArrowPathIcon, match: '/facturacion/recurrente', perm: 'facturacion' as ModuleKey },
  { name: 'collections', label: 'Cobros', icon: BanknotesIcon, match: '/facturacion/cobros', perm: 'cobros' as ModuleKey },
  { name: 'cash-register', label: 'Caja del día', icon: CalculatorIcon, match: '/facturacion/caja', perm: 'facturacion' as ModuleKey },
  { name: 'billing-reports', label: 'Reportes', icon: ChartBarIcon, match: '/reportes/exportar', perm: 'reportes' as ModuleKey },
  { name: 'estadisticas', label: 'Estadísticas', icon: ChartBarIcon, match: '/reportes/estadisticas', perm: 'reportes' as ModuleKey },
  { name: 'olt-report', label: 'Reporte OLT', icon: ServerIcon, match: '/reportes/olt', perm: 'reportes' as ModuleKey },
  { name: 'mikrotik-report', label: 'Reporte MikroTik', icon: CpuChipIcon, match: '/reportes/mikrotik', perm: 'reportes' as ModuleKey },
]

const navInventario = [
  { name: 'inventory-products', label: 'Productos', icon: CubeIcon, match: '/inventario/productos', perm: 'inventario' as ModuleKey },
  { name: 'inventory-in', label: 'Ingreso', icon: ArrowDownOnSquareIcon, match: '/inventario/ingreso', perm: 'inventario' as ModuleKey },
  { name: 'inventory-out', label: 'Egreso', icon: ArrowUpOnSquareIcon, match: '/inventario/egreso', perm: 'inventario' as ModuleKey },
  { name: 'inventory-kardex', label: 'Kárdex', icon: ClipboardDocumentListIcon, match: '/inventario/kardex', perm: 'inventario' as ModuleKey },
]

const navConfig = [
  { name: 'empresa-config', label: 'Empresa', icon: BuildingOffice2Icon, match: '/configuracion/empresa', perm: 'configuracion' as ModuleKey },
  { name: 'usuarios', label: 'Usuarios', icon: UserGroupIcon, match: '/configuracion/usuarios', perm: 'configuracion' as ModuleKey },
  { name: 'sri-emitter-config', label: 'Emisor SRI', icon: Cog6ToothIcon, match: '/configuracion/emisor-sri', perm: 'configuracion' as ModuleKey },
  { name: 'whatsapp-config', label: 'WhatsApp', icon: ChatBubbleLeftRightIcon, match: '/configuracion/whatsapp', perm: 'configuracion' as ModuleKey },
  { name: 'respaldo', label: 'Respaldo', icon: ArchiveBoxArrowDownIcon, match: '/configuracion/respaldo', perm: 'configuracion' as ModuleKey },
]

const navSoporte = [
  { name: 'tickets-list', label: 'Tickets', icon: TicketIcon, match: '/soporte', perm: 'soporte' as ModuleKey },
  { name: 'portal-users', label: 'Usuarios de portal', icon: IdentificationIcon, match: '/soporte/portal-usuarios', perm: 'soporte' as ModuleKey },
]

const navOlt = [
  { name: 'infraestructura', label: 'Infraestructura', icon: MapIcon, match: '/infraestructura', perm: 'olt' as ModuleKey },
  { name: 'olt-devices', label: 'OLTs', icon: ServerIcon, match: '/olt', perm: 'olt' as ModuleKey },
  { name: 'olt-cards', label: 'Tarjetas', icon: Square3Stack3DIcon, match: '/olt/cards', perm: 'olt' as ModuleKey },
  { name: 'olt-pon-ports', label: 'Puertos PON', icon: SignalIcon, match: '/olt/pon-ports', perm: 'olt' as ModuleKey },
  { name: 'olt-uplink-ports', label: 'Uplinks', icon: ArrowsRightLeftIcon, match: '/olt/uplink-ports', perm: 'olt' as ModuleKey },
  { name: 'olt-vlans', label: 'VLANs', icon: TagIcon, match: '/olt/vlans', perm: 'olt' as ModuleKey },
  { name: 'olt-speed-profiles', label: 'Perfiles de velocidad', icon: BoltIcon, match: '/olt/speed-profiles', perm: 'olt' as ModuleKey },
  { name: 'olt-line-profiles', label: 'Line profiles', icon: AdjustmentsHorizontalIcon, match: '/olt/line-profiles', perm: 'olt' as ModuleKey },
  { name: 'olt-service-profiles', label: 'Service profiles', icon: WrenchScrewdriverIcon, match: '/olt/profiles', perm: 'olt' as ModuleKey },
  { name: 'olt-tr069-profiles', label: 'Perfiles TR-069', icon: CloudIcon, match: '/olt/tr069-profiles', perm: 'olt' as ModuleKey },
  { name: 'olt-backups', label: 'Backups', icon: ArchiveBoxIcon, match: '/olt/backup', perm: 'olt' as ModuleKey },
]

const navOnu = [
  { name: 'olt-onu-types', label: 'Tipos de ONU', icon: RectangleStackIcon, match: '/olt/onu-types', perm: 'olt' as ModuleKey },
  { name: 'olt-onus', label: 'ONUs', icon: WifiIcon, match: '/olt/onus', perm: 'olt' as ModuleKey },
  { name: 'olt-ip-pools', label: 'IP Pools', icon: GlobeAltIcon, match: '/olt/ip-pools', perm: 'olt' as ModuleKey },
]

const navMikrotik = [
  { name: 'mikrotik-devices', label: 'MikroTik', icon: CpuChipIcon, match: '/mikrotik', perm: 'mikrotik' as ModuleKey },
  { name: 'mikrotik-ip-address', label: 'IP Address', icon: CircleStackIcon, match: '/mikrotik/ip-address', perm: 'mikrotik' as ModuleKey },
  { name: 'mikrotik-firewall', label: 'Firewall', icon: ShieldCheckIcon, match: '/mikrotik/firewall', perm: 'mikrotik' as ModuleKey },
  { name: 'mikrotik-blocks', label: 'Bloqueos', icon: LockClosedIcon, match: '/mikrotik/bloqueos', perm: 'mikrotik' as ModuleKey },
  { name: 'mikrotik-ipv6-pool', label: 'Pools IPv6', icon: GlobeAsiaAustraliaIcon, match: '/mikrotik/ipv6-pool', perm: 'mikrotik' as ModuleKey },
]

const navTr069 = [{ name: 'tr069-devices', label: 'CPEs', icon: RssIcon, match: '/tr069', perm: 'tr069' as ModuleKey }]

// Varias rutas de OLT comparten el prefijo /olt (p.ej. "/olt" para el listado
// de dispositivos y "/olt/vlans" para VLANs); con un simple startsWith ambas
// quedarían resaltadas a la vez. Se resalta solo el ítem cuyo `match` sea el
// prefijo más largo que calza con la ruta actual, entre todas las secciones.
const allNavItems = computed(() => [
  ...navDashboard,
  ...nav,
  ...navFacturacion,
  ...navInventario,
  ...navConfig,
  ...navOlt,
  ...navOnu,
  ...navMikrotik,
  ...navTr069,
  ...navSoporte,
])

function isActive(item: { name: string; match: string }) {
  const candidates = allNavItems.value.filter((i) => route.path.startsWith(i.match))
  const longest = candidates.reduce<{ name: string; match: string } | null>(
    (best, current) => (!best || current.match.length > best.match.length ? current : best),
    null,
  )
  return longest?.name === item.name
}

// El sidebar no debe ofrecer módulos que el usuario no puede abrir — el
// router ya lo rebota a /  si intenta entrar de todos modos (ver
// beforeEach en router/index.ts), pero dejarlo en el menú es confuso para
// operador/visor. admin siempre ve todo vía auth.can().
function visible<T extends { perm: ModuleKey }>(items: T[]) {
  return items.filter((i) => auth.can(i.perm))
}
</script>

<template>
  <div class="flex min-h-screen bg-slate-50">
    <aside class="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div class="px-5 py-5">
        <p class="text-lg font-semibold tracking-tight text-slate-900">NodoISP</p>
        <p class="text-xs text-slate-500">Fase 1-9 — Gestión integral del ISP</p>
      </div>
      <nav class="flex-1 space-y-4 px-3">
        <div class="space-y-1">
          <RouterLink
            v-for="item in visible(navDashboard)"
            :key="item.name"
            :to="{ name: item.name }"
            class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            :class="isActive(item) ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-100'"
          >
            <component :is="item.icon" class="h-5 w-5" />
            {{ item.label }}
          </RouterLink>
        </div>

        <div v-if="visible(nav).length" class="space-y-1">
          <RouterLink
            v-for="item in visible(nav)"
            :key="item.name"
            :to="{ name: item.name }"
            class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            :class="isActive(item) ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-100'"
          >
            <component :is="item.icon" class="h-5 w-5" />
            {{ item.label }}
          </RouterLink>
        </div>

        <div v-if="visible(navFacturacion).length">
          <p class="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Facturación</p>
          <div class="space-y-1">
            <RouterLink
              v-for="item in visible(navFacturacion)"
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

        <div v-if="visible(navInventario).length">
          <p class="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Inventario</p>
          <div class="space-y-1">
            <RouterLink
              v-for="item in visible(navInventario)"
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

        <div v-if="visible(navOlt).length">
          <p class="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">OLT</p>
          <div class="space-y-1">
            <RouterLink
              v-for="item in visible(navOlt)"
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

        <div v-if="visible(navOnu).length">
          <p class="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">ONUs</p>
          <div class="space-y-1">
            <RouterLink
              v-for="item in visible(navOnu)"
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

        <div v-if="visible(navMikrotik).length">
          <p class="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">MikroTik</p>
          <div class="space-y-1">
            <RouterLink
              v-for="item in visible(navMikrotik)"
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

        <div v-if="visible(navTr069).length">
          <p class="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">TR-069</p>
          <div class="space-y-1">
            <RouterLink
              v-for="item in visible(navTr069)"
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

        <div v-if="visible(navSoporte).length">
          <p class="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Soporte</p>
          <div class="space-y-1">
            <RouterLink
              v-for="item in visible(navSoporte)"
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

        <div v-if="visible(navConfig).length">
          <p class="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Configuración</p>
          <div class="space-y-1">
            <RouterLink
              v-for="item in visible(navConfig)"
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
    <main ref="mainEl" class="flex-1 overflow-y-auto">
      <RouterView />
    </main>
  </div>
</template>
