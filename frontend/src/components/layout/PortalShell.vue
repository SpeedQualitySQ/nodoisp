<script setup lang="ts">
import { RouterView } from 'vue-router'
import { ArrowRightStartOnRectangleIcon, TicketIcon } from '@heroicons/vue/24/outline'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
</script>

<template>
  <div class="flex min-h-screen flex-col bg-slate-50">
    <header class="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
      <div class="flex items-center gap-2 text-slate-900">
        <TicketIcon class="h-5 w-5 text-teal-700" />
        <span class="font-semibold">NodoISP — Mis tickets</span>
      </div>
      <div class="flex items-center gap-4">
        <span class="text-sm text-slate-500">{{ auth.profile?.full_name || auth.user?.email }}</span>
        <button
          class="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-600 hover:bg-slate-100"
          @click="auth.signOut()"
        >
          <ArrowRightStartOnRectangleIcon class="h-5 w-5" />
          Cerrar sesión
        </button>
      </div>
    </header>
    <main class="flex-1 overflow-y-auto">
      <RouterView />
    </main>
  </div>
</template>
