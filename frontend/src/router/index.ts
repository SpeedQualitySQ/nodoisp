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
