<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router'
import {
  UsersIcon,
  Squares2X2Icon,
  ViewColumnsIcon,
  MapPinIcon,
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
</script>

<template>
  <div class="flex min-h-screen bg-slate-50">
    <aside class="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div class="px-5 py-5">
        <p class="text-lg font-semibold tracking-tight text-slate-900">NodoISP</p>
        <p class="text-xs text-slate-500">Fase 1 — Clientes y contratos</p>
      </div>
      <nav class="flex-1 space-y-1 px-3">
        <RouterLink
          v-for="item in nav"
          :key="item.name"
          :to="{ name: item.name }"
          class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          :class="
            route.path.startsWith(item.match)
              ? 'bg-teal-50 text-teal-700'
              : 'text-slate-600 hover:bg-slate-100'
          "
        >
          <component :is="item.icon" class="h-5 w-5" />
          {{ item.label }}
        </RouterLink>
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
