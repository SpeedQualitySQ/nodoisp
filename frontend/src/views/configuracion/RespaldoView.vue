<script setup lang="ts">
import { ref } from 'vue'
import { ArrowDownTrayIcon } from '@heroicons/vue/24/outline'
import { supabase } from '@/lib/supabase'

// Export cliente-side de las tablas clave a JSON — complementa (no
// reemplaza) el respaldo automático por cron en el servidor
// (scripts/backup-db.sh), que es el único con el que se puede restaurar
// TODO el sistema tal cual estaba. Esto sirve para bajarse una copia rápida
// de los datos de negocio sin acceso al servidor.
const TABLES = [
  'clients',
  'installation_addresses',
  'service_contracts',
  'plans',
  'electronic_documents',
  'support_tickets',
  'ticket_updates',
  'olt_devices',
  'mikrotik_devices',
  'products',
  'inventory_movements',
] as const

const exporting = ref<string | null>(null)
const errorMsg = ref('')

function descargarJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

async function onExportarTabla(table: string) {
  exporting.value = table
  errorMsg.value = ''
  try {
    const { data, error } = await supabase.from(table).select('*')
    if (error) throw error
    descargarJson(`${table}_${new Date().toISOString().slice(0, 10)}.json`, data ?? [])
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : `No se pudo exportar ${table}`
  } finally {
    exporting.value = null
  }
}

async function onExportarTodo() {
  exporting.value = 'todo'
  errorMsg.value = ''
  try {
    const result: Record<string, unknown> = {}
    for (const table of TABLES) {
      const { data, error } = await supabase.from(table).select('*')
      if (error) throw error
      result[table] = data ?? []
    }
    descargarJson(`respaldo_completo_${new Date().toISOString().slice(0, 10)}.json`, result)
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo exportar el respaldo completo'
  } finally {
    exporting.value = null
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl px-6 py-8">
    <div class="mb-6">
      <h1 class="text-xl font-semibold text-slate-900">Respaldo de datos</h1>
      <p class="text-sm text-slate-500">Exportá una copia de los datos de negocio en formato JSON.</p>
    </div>

    <div class="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
      Este export es una copia rápida de los datos para revisarlos o llevártelos — no reemplaza el respaldo automático
      del servidor (todas las noches, con el que sí se puede restaurar el sistema completo si algo se rompe).
    </div>

    <p v-if="errorMsg" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMsg }}</p>

    <div class="mb-4 rounded-xl border border-slate-200 bg-white p-6">
      <button
        :disabled="exporting !== null"
        class="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
        @click="onExportarTodo"
      >
        <ArrowDownTrayIcon class="h-4 w-4" />
        {{ exporting === 'todo' ? 'Exportando…' : 'Exportar todo (un solo archivo)' }}
      </button>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white">
      <p class="border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Exportar tabla por tabla
      </p>
      <div class="divide-y divide-slate-100">
        <div v-for="t in TABLES" :key="t" class="flex items-center justify-between px-4 py-3">
          <span class="font-mono text-sm text-slate-700">{{ t }}</span>
          <button
            :disabled="exporting !== null"
            class="text-sm font-medium text-teal-700 hover:text-teal-900 disabled:opacity-60"
            @click="onExportarTabla(t)"
          >
            {{ exporting === t ? 'Exportando…' : 'Exportar' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
