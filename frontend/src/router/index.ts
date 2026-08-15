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
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (!to.meta.public && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.name === 'login' && auth.isAuthenticated) {
    return { name: 'clients-list' }
  }
  return true
})

export default router
