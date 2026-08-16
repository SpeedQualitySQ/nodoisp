import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import type { ModuleKey } from '@/types/database'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/portal/login',
      name: 'portal-login',
      component: () => import('@/views/portal/PortalLoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/portal/tickets',
      name: 'portal-tickets',
      component: () => import('@/views/portal/PortalTicketsView.vue'),
      meta: { portal: true },
    },
    {
      path: '/portal/tickets/:id',
      name: 'portal-ticket-detail',
      component: () => import('@/views/portal/PortalTicketDetailView.vue'),
      props: true,
      meta: { portal: true },
    },
    {
      path: '/',
      name: 'dashboard',
      component: () => import('@/views/DashboardView.vue'),
      meta: { permKey: 'dashboard' },
    },
    {
      path: '/clientes',
      name: 'clients-list',
      component: () => import('@/views/clients/ClientsListView.vue'),
      meta: { permKey: 'clientes' },
    },
    {
      path: '/clientes/nuevo',
      name: 'client-new',
      component: () => import('@/views/clients/ClientFormView.vue'),
      meta: { permKey: 'clientes' },
    },
    {
      path: '/clientes/:id',
      name: 'client-edit',
      component: () => import('@/views/clients/ClientFormView.vue'),
      props: true,
      meta: { permKey: 'clientes' },
    },
    {
      path: '/planes',
      name: 'plans',
      component: () => import('@/views/plans/PlansView.vue'),
      meta: { permKey: 'planes' },
    },
    {
      path: '/contratos/kanban',
      name: 'contracts-kanban',
      component: () => import('@/views/contracts/ContractsKanbanView.vue'),
      meta: { permKey: 'clientes' },
    },
    {
      path: '/instalaciones',
      name: 'installations',
      component: () => import('@/views/installations/InstallationsView.vue'),
      meta: { permKey: 'clientes' },
    },
    {
      path: '/facturacion/manual',
      name: 'invoicing-manual',
      component: () => import('@/views/facturacion/ManualInvoicingView.vue'),
      meta: { permKey: 'facturacion' },
    },
    {
      path: '/facturacion/recurrente',
      name: 'invoicing-recurring',
      component: () => import('@/views/facturacion/RecurringBillingView.vue'),
      meta: { permKey: 'facturacion' },
    },
    {
      path: '/facturacion/cobros',
      name: 'collections',
      component: () => import('@/views/facturacion/CollectionsView.vue'),
      meta: { permKey: 'cobros' },
    },
    {
      path: '/facturacion/caja',
      name: 'cash-register',
      component: () => import('@/views/facturacion/CashRegisterView.vue'),
      meta: { permKey: 'facturacion' },
    },
    {
      path: '/reportes/exportar',
      name: 'billing-reports',
      component: () => import('@/views/reportes/ReportsView.vue'),
      meta: { permKey: 'reportes' },
    },
    {
      path: '/reportes/estadisticas',
      name: 'estadisticas',
      component: () => import('@/views/reportes/EstadisticasView.vue'),
      meta: { permKey: 'reportes' },
    },
    {
      path: '/reportes/olt',
      name: 'olt-report',
      component: () => import('@/views/reportes/OltReportView.vue'),
      meta: { permKey: 'reportes' },
    },
    {
      path: '/reportes/mikrotik',
      name: 'mikrotik-report',
      component: () => import('@/views/reportes/MikrotikReportView.vue'),
      meta: { permKey: 'reportes' },
    },
    {
      path: '/configuracion/emisor-sri',
      name: 'sri-emitter-config',
      component: () => import('@/views/configuracion/SriEmitterConfigView.vue'),
      meta: { permKey: 'configuracion' },
    },
    {
      path: '/configuracion/empresa',
      name: 'empresa-config',
      component: () => import('@/views/configuracion/EmpresaConfigView.vue'),
      meta: { permKey: 'configuracion' },
    },
    {
      path: '/configuracion/usuarios',
      name: 'usuarios',
      component: () => import('@/views/configuracion/UsuariosView.vue'),
      meta: { permKey: 'configuracion' },
    },
    {
      path: '/inventario/productos',
      name: 'inventory-products',
      component: () => import('@/views/inventario/ProductsView.vue'),
      meta: { permKey: 'inventario' },
    },
    {
      path: '/inventario/ingreso',
      name: 'inventory-in',
      component: () => import('@/views/inventario/InventoryInView.vue'),
      meta: { permKey: 'inventario' },
    },
    {
      path: '/inventario/egreso',
      name: 'inventory-out',
      component: () => import('@/views/inventario/InventoryOutView.vue'),
      meta: { permKey: 'inventario' },
    },
    {
      path: '/inventario/kardex',
      name: 'inventory-kardex',
      component: () => import('@/views/inventario/InventoryKardexView.vue'),
      meta: { permKey: 'inventario' },
    },
    {
      path: '/olt',
      name: 'olt-devices',
      component: () => import('@/views/olt/OltDevicesView.vue'),
      meta: { permKey: 'olt' },
    },
    {
      path: '/olt/cards',
      name: 'olt-cards',
      component: () => import('@/views/olt/OltCardsView.vue'),
      meta: { permKey: 'olt' },
    },
    {
      path: '/olt/pon-ports',
      name: 'olt-pon-ports',
      component: () => import('@/views/olt/OltPonPortsView.vue'),
      meta: { permKey: 'olt' },
    },
    {
      path: '/olt/uplink-ports',
      name: 'olt-uplink-ports',
      component: () => import('@/views/olt/OltUplinkPortsView.vue'),
      meta: { permKey: 'olt' },
    },
    {
      path: '/olt/vlans',
      name: 'olt-vlans',
      component: () => import('@/views/olt/OltVlansView.vue'),
      meta: { permKey: 'olt' },
    },
    {
      path: '/olt/speed-profiles',
      name: 'olt-speed-profiles',
      component: () => import('@/views/olt/OltSpeedProfilesView.vue'),
      meta: { permKey: 'olt' },
    },
    {
      path: '/olt/line-profiles',
      name: 'olt-line-profiles',
      component: () => import('@/views/olt/OltLineProfilesView.vue'),
      meta: { permKey: 'olt' },
    },
    {
      path: '/olt/profiles',
      name: 'olt-service-profiles',
      component: () => import('@/views/olt/OltServiceProfilesView.vue'),
      meta: { permKey: 'olt' },
    },
    {
      path: '/olt/tr069-profiles',
      name: 'olt-tr069-profiles',
      component: () => import('@/views/olt/OltTr069ProfilesView.vue'),
      meta: { permKey: 'olt' },
    },
    {
      path: '/olt/backup',
      name: 'olt-backups',
      component: () => import('@/views/olt/OltBackupsView.vue'),
      meta: { permKey: 'olt' },
    },
    {
      path: '/olt/onu-types',
      name: 'olt-onu-types',
      component: () => import('@/views/olt/OltOnuTypesView.vue'),
      meta: { permKey: 'olt' },
    },
    {
      path: '/olt/onus',
      name: 'olt-onus',
      component: () => import('@/views/olt/OltOnusView.vue'),
      meta: { permKey: 'olt' },
    },
    {
      path: '/olt/ip-pools',
      name: 'olt-ip-pools',
      component: () => import('@/views/olt/OltIpPoolsView.vue'),
      meta: { permKey: 'olt' },
    },
    {
      path: '/mikrotik',
      name: 'mikrotik-devices',
      component: () => import('@/views/mikrotik/MikrotikDevicesView.vue'),
      meta: { permKey: 'mikrotik' },
    },
    {
      path: '/mikrotik/ip-address',
      name: 'mikrotik-ip-address',
      component: () => import('@/views/mikrotik/MikrotikIpPoolsView.vue'),
      meta: { permKey: 'mikrotik' },
    },
    {
      path: '/mikrotik/firewall',
      name: 'mikrotik-firewall',
      component: () => import('@/views/mikrotik/MikrotikFirewallView.vue'),
      meta: { permKey: 'mikrotik' },
    },
    {
      path: '/mikrotik/bloqueos',
      name: 'mikrotik-blocks',
      component: () => import('@/views/mikrotik/MikrotikBlocksView.vue'),
      meta: { permKey: 'mikrotik' },
    },
    {
      path: '/mikrotik/ipv6-pool',
      name: 'mikrotik-ipv6-pool',
      component: () => import('@/views/mikrotik/MikrotikIpv6PoolsView.vue'),
      meta: { permKey: 'mikrotik' },
    },
    {
      path: '/soporte',
      name: 'tickets-list',
      component: () => import('@/views/soporte/TicketsListView.vue'),
      meta: { permKey: 'soporte' },
    },
    {
      path: '/soporte/portal-usuarios',
      name: 'portal-users',
      component: () => import('@/views/soporte/PortalUsersView.vue'),
      meta: { permKey: 'soporte' },
    },
    {
      path: '/soporte/:id',
      name: 'ticket-detail',
      component: () => import('@/views/soporte/TicketDetailView.vue'),
      props: true,
      meta: { permKey: 'soporte' },
    },
    {
      path: '/configuracion/respaldo',
      name: 'respaldo',
      component: () => import('@/views/configuracion/RespaldoView.vue'),
      meta: { permKey: 'configuracion' },
    },
    {
      path: '/configuracion/whatsapp',
      name: 'whatsapp-config',
      component: () => import('@/views/configuracion/WhatsappConfigView.vue'),
      meta: { permKey: 'configuracion' },
    },
    {
      path: '/infraestructura',
      name: 'infraestructura',
      component: () => import('@/views/InfraestructuraView.vue'),
      meta: { permKey: 'olt' },
    },
    {
      path: '/tr069',
      name: 'tr069-devices',
      component: () => import('@/views/tr069/Tr069DevicesView.vue'),
      meta: { permKey: 'tr069' },
    },
    {
      path: '/tr069/:id',
      name: 'tr069-device-detail',
      component: () => import('@/views/tr069/Tr069DeviceDetailView.vue'),
      props: true,
      meta: { permKey: 'tr069' },
    },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()

  if (!to.meta.public && !auth.isAuthenticated) {
    return to.meta.portal
      ? { name: 'portal-login', query: { redirect: to.fullPath } }
      : { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.name === 'login' && auth.isAuthenticated) {
    return { name: 'dashboard' }
  }
  if (to.name === 'portal-login' && auth.isAuthenticated) {
    return { name: 'portal-tickets' }
  }
  // Un usuario de portal no puede entrar al sistema principal, y viceversa
  // — cada uno tiene su propio login y su propio layout (App.vue).
  if (auth.isAuthenticated && auth.isPortalUser && !to.meta.portal && !to.meta.public) {
    return { name: 'portal-tickets' }
  }
  if (auth.isAuthenticated && !auth.isPortalUser && to.meta.portal) {
    return { name: 'dashboard' }
  }
  // Módulo oculto/no otorgado para este usuario (operador/visor sin ese
  // permiso) — lo mandamos al dashboard en vez de dejarlo en una pantalla
  // en blanco o con error de RLS. Solo se evalúa con el profile ya cargado
  // (auth.init() lo espera antes del primer mount, pero justo después de
  // signIn() hay una ventana async donde isAuthenticated ya es true y
  // profile todavía no — evaluar el permiso ahí redirigiría incluso fuera
  // de 'dashboard', y como 'dashboard' es el propio destino, quedaba en
  // loop infinito).
  if (auth.isAuthenticated && auth.profile && to.name !== 'dashboard' && to.meta.permKey && !auth.can(to.meta.permKey as ModuleKey)) {
    return { name: 'dashboard' }
  }
  return true
})

export default router
