import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

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
      redirect: '/clientes',
    },
    {
      path: '/clientes',
      name: 'clients-list',
      component: () => import('@/views/clients/ClientsListView.vue'),
    },
    {
      path: '/clientes/nuevo',
      name: 'client-new',
      component: () => import('@/views/clients/ClientFormView.vue'),
    },
    {
      path: '/clientes/:id',
      name: 'client-edit',
      component: () => import('@/views/clients/ClientFormView.vue'),
      props: true,
    },
    {
      path: '/planes',
      name: 'plans',
      component: () => import('@/views/plans/PlansView.vue'),
    },
    {
      path: '/contratos/kanban',
      name: 'contracts-kanban',
      component: () => import('@/views/contracts/ContractsKanbanView.vue'),
    },
    {
      path: '/instalaciones',
      name: 'installations',
      component: () => import('@/views/installations/InstallationsView.vue'),
    },
    {
      path: '/facturacion/manual',
      name: 'invoicing-manual',
      component: () => import('@/views/facturacion/ManualInvoicingView.vue'),
    },
    {
      path: '/facturacion/recurrente',
      name: 'invoicing-recurring',
      component: () => import('@/views/facturacion/RecurringBillingView.vue'),
    },
    {
      path: '/facturacion/cobros',
      name: 'collections',
      component: () => import('@/views/facturacion/CollectionsView.vue'),
    },
    {
      path: '/facturacion/caja',
      name: 'cash-register',
      component: () => import('@/views/facturacion/CashRegisterView.vue'),
    },
    {
      path: '/reportes/exportar',
      name: 'billing-reports',
      component: () => import('@/views/reportes/BillingReportsView.vue'),
    },
    {
      path: '/configuracion/emisor-sri',
      name: 'sri-emitter-config',
      component: () => import('@/views/configuracion/SriEmitterConfigView.vue'),
    },
    {
      path: '/olt',
      name: 'olt-devices',
      component: () => import('@/views/olt/OltDevicesView.vue'),
    },
    {
      path: '/olt/cards',
      name: 'olt-cards',
      component: () => import('@/views/olt/OltCardsView.vue'),
    },
    {
      path: '/olt/pon-ports',
      name: 'olt-pon-ports',
      component: () => import('@/views/olt/OltPonPortsView.vue'),
    },
    {
      path: '/olt/uplink-ports',
      name: 'olt-uplink-ports',
      component: () => import('@/views/olt/OltUplinkPortsView.vue'),
    },
    {
      path: '/olt/vlans',
      name: 'olt-vlans',
      component: () => import('@/views/olt/OltVlansView.vue'),
    },
    {
      path: '/olt/speed-profiles',
      name: 'olt-speed-profiles',
      component: () => import('@/views/olt/OltSpeedProfilesView.vue'),
    },
    {
      path: '/olt/line-profiles',
      name: 'olt-line-profiles',
      component: () => import('@/views/olt/OltLineProfilesView.vue'),
    },
    {
      path: '/olt/profiles',
      name: 'olt-service-profiles',
      component: () => import('@/views/olt/OltServiceProfilesView.vue'),
    },
    {
      path: '/olt/tr069-profiles',
      name: 'olt-tr069-profiles',
      component: () => import('@/views/olt/OltTr069ProfilesView.vue'),
    },
    {
      path: '/olt/backup',
      name: 'olt-backups',
      component: () => import('@/views/olt/OltBackupsView.vue'),
    },
    {
      path: '/olt/onu-types',
      name: 'olt-onu-types',
      component: () => import('@/views/olt/OltOnuTypesView.vue'),
    },
    {
      path: '/olt/onus',
      name: 'olt-onus',
      component: () => import('@/views/olt/OltOnusView.vue'),
    },
    {
      path: '/olt/ip-pools',
      name: 'olt-ip-pools',
      component: () => import('@/views/olt/OltIpPoolsView.vue'),
    },
    {
      path: '/mikrotik',
      name: 'mikrotik-devices',
      component: () => import('@/views/mikrotik/MikrotikDevicesView.vue'),
    },
    {
      path: '/mikrotik/ip-address',
      name: 'mikrotik-ip-address',
      component: () => import('@/views/mikrotik/MikrotikIpPoolsView.vue'),
    },
    {
      path: '/mikrotik/firewall',
      name: 'mikrotik-firewall',
      component: () => import('@/views/mikrotik/MikrotikFirewallView.vue'),
    },
    {
      path: '/mikrotik/bloqueos',
      name: 'mikrotik-blocks',
      component: () => import('@/views/mikrotik/MikrotikBlocksView.vue'),
    },
    {
      path: '/mikrotik/ipv6-pool',
      name: 'mikrotik-ipv6-pool',
      component: () => import('@/views/mikrotik/MikrotikIpv6PoolsView.vue'),
    },
    {
      path: '/soporte',
      name: 'tickets-list',
      component: () => import('@/views/soporte/TicketsListView.vue'),
    },
    {
      path: '/soporte/portal-usuarios',
      name: 'portal-users',
      component: () => import('@/views/soporte/PortalUsersView.vue'),
    },
    {
      path: '/soporte/:id',
      name: 'ticket-detail',
      component: () => import('@/views/soporte/TicketDetailView.vue'),
      props: true,
    },
    {
      path: '/configuracion/whatsapp',
      name: 'whatsapp-config',
      component: () => import('@/views/configuracion/WhatsappConfigView.vue'),
    },
    {
      path: '/tr069',
      name: 'tr069-devices',
      component: () => import('@/views/tr069/Tr069DevicesView.vue'),
    },
    {
      path: '/tr069/:id',
      name: 'tr069-device-detail',
      component: () => import('@/views/tr069/Tr069DeviceDetailView.vue'),
      props: true,
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
    return { name: 'clients-list' }
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
    return { name: 'tickets-list' }
  }
  return true
})

export default router
