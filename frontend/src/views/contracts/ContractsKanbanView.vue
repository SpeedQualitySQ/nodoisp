<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { supabase } from '@/lib/supabase'
import type { ContractBoardItem, ContractStatus } from '@/types/database'

interface Column {
  status: ContractStatus
  label: string
}

const COLUMNS: Column[] = [
  { status: 'pending', label: 'Pendiente' },
  { status: 'active', label: 'Activo' },
  { status: 'suspended', label: 'Suspendido' },
  { status: 'cut', label: 'Cortado' },
]

const ACTIONS: Record<ContractStatus, { label: string; target: ContractStatus }[]> = {
  pending: [
    { label: 'Activar', target: 'active' },
    { label: 'Terminar', target: 'terminated' },
  ],
  active: [
    { label: 'Suspender', target: 'suspended' },
    { label: 'Cortar', target: 'cut' },
    { label: 'Terminar', target: 'terminated' },
  ],
  suspended: [
    { label: 'Reactivar', target: 'active' },
    { label: 'Cortar', target: 'cut' },
    { label: 'Terminar', target: 'terminated' },
  ],
  cut: [
    { label: 'Reactivar', target: 'active' },
    { label: 'Terminar', target: 'terminated' },
  ],
  terminated: [],
}

const contracts = ref<ContractBoardItem[]>([])
const loading = ref(true)
const errorMsg = ref('')
const search = ref('')
const showTerminated = ref(false)
const updatingId = ref<string | null>(null)

async function loadContracts() {
  loading.value = true
  const { data, error } = await supabase
    .from('service_contracts')
    .select(
      `*, clients ( first_name, last_name ), plans ( name ), technician:profiles ( full_name )`,
    )
    .order('created_at', { ascending: false })

  if (error) {
    errorMsg.value = error.message
  } else {
    contracts.value = (data ?? []).map((row: any) => ({
      ...row,
      client_first_name: row.clients?.first_name ?? '',
      client_last_name: row.clients?.last_name ?? '',
      plan_name: row.plans?.name ?? '',
      technician_full_name: row.technician?.full_name ?? null,
    })) as ContractBoardItem[]
  }
  loading.value = false
}

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()
  return contracts.value.filter((c) => {
    if (c.status === 'terminated' && !showTerminated.value) return false
    if (!term) return true
    return (
      c.contract_number.toLowerCase().includes(term) ||
      `${c.client_first_name} ${c.client_last_name}`.toLowerCase().includes(term) ||
      c.plan_name.toLowerCase().includes(term)
    )
  })
})

function columnItems(status: ContractStatus) {
  return filtered.value.filter((c) => c.status === status)
}

async function moveTo(contract: ContractBoardItem, target: ContractStatus) {
  updatingId.value = contract.id
  errorMsg.value = ''
  const payload: Record<string, unknown> = { status: target }
  if (target === 'active' && !contract.start_date) {
    payload.start_date = new Date().toISOString().slice(0, 10)
  }
  const { error } = await supabase.from('service_contracts').update(payload).eq('id', contract.id)
  if (error) {
    errorMsg.value = error.message
  } else {
    await loadContracts()
  }
  updatingId.value = null
}

onMounted(loadContracts)
</script>

<template>
  <div class="mx-auto max-w-7xl px-6 py-8">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-xl font-semibold text-slate-900">Contratos</h1>
      <label class="flex items-center gap-2 text-sm text-slate-600">
        <input v-model="showTerminated" type="checkbox" class="h-4 w-4 rounded border-slate-300" />
        Mostrar terminados
      </label>
    </div>

    <input
      v-model="search"
      type="text"
      placeholder="Buscar por cliente, número de contrato o plan…"
      class="mb-6 w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
    />

    <p v-if="errorMsg" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      {{ errorMsg }}
    </p>

    <div v-if="loading" class="text-sm text-slate-400">Cargando…</div>

    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div v-for="col in COLUMNS" :key="col.status" class="min-w-0">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-slate-700">{{ col.label }}</h2>
          <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 tabular-nums">
            {{ columnItems(col.status).length }}
          </span>
        </div>
        <div class="space-y-3">
          <article
            v-for="c in columnItems(col.status)"
            :key="c.id"
            class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p class="font-medium text-slate-900">{{ c.client_first_name }} {{ c.client_last_name }}</p>
            <p class="text-xs font-mono text-slate-500">{{ c.contract_number }}</p>
            <p class="mt-2 text-sm text-slate-600">{{ c.plan_name }} · ${{ c.monthly_fee }}</p>
            <p v-if="c.technician_full_name" class="mt-1 text-xs text-slate-500">
              Técnico: {{ c.technician_full_name }}
            </p>
            <div class="mt-3 flex flex-wrap gap-2">
              <button
                v-for="action in ACTIONS[c.status]"
                :key="action.target"
                :disabled="updatingId === c.id"
                class="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:border-teal-600 hover:text-teal-700 disabled:opacity-50"
                @click="moveTo(c, action.target)"
              >
                {{ action.label }}
              </button>
            </div>
          </article>
          <p v-if="!columnItems(col.status).length" class="text-xs text-slate-400">Sin contratos</p>
        </div>
      </div>
    </div>
  </div>
</template>
