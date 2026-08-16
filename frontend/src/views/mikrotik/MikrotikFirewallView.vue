<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { PlusIcon } from '@heroicons/vue/24/outline'
import { supabase } from '@/lib/supabase'
import { generarComandoFirewallRule } from '@/lib/mikrotik'
import type { MikrotikDevice, MikrotikFirewallRule } from '@/types/database'
import StatusBadge from '@/components/StatusBadge.vue'

const devices = ref<MikrotikDevice[]>([])
const selectedMikrotikId = ref<string | null>(null)
const rules = ref<MikrotikFirewallRule[]>([])
const loading = ref(true)
const errorMsg = ref('')
const saving = ref(false)
const editingId = ref<string | null>(null)
const showForm = ref(false)
const comandoPreview = ref('')

const form = reactive({
  table_name: 'filter' as 'filter' | 'nat',
  chain: 'forward',
  action: 'accept' as MikrotikFirewallRule['action'],
  src_address: '',
  dst_address: '',
  protocol: '',
  dst_port: '',
  src_address_list: '',
  out_interface: '',
  comment: '',
  position: 0,
  enabled: true,
})

function resetForm() {
  editingId.value = null
  form.table_name = 'filter'
  form.chain = 'forward'
  form.action = 'accept'
  form.src_address = ''
  form.dst_address = ''
  form.protocol = ''
  form.dst_port = ''
  form.src_address_list = ''
  form.out_interface = ''
  form.comment = ''
  form.position = rules.value.length
  form.enabled = true
}

function openNew() {
  resetForm()
  comandoPreview.value = ''
  showForm.value = true
}

function openEdit(rule: MikrotikFirewallRule) {
  editingId.value = rule.id
  form.table_name = rule.table_name
  form.chain = rule.chain
  form.action = rule.action
  form.src_address = rule.src_address ?? ''
  form.dst_address = rule.dst_address ?? ''
  form.protocol = rule.protocol ?? ''
  form.dst_port = rule.dst_port ?? ''
  form.src_address_list = rule.src_address_list ?? ''
  form.out_interface = rule.out_interface ?? ''
  form.comment = rule.comment ?? ''
  form.position = rule.position
  form.enabled = rule.enabled
  comandoPreview.value = ''
  showForm.value = true
}

async function loadDevices() {
  const { data, error } = await supabase.from('mikrotik_devices').select('*').order('name')
  if (error) {
    errorMsg.value = error.message
    return
  }
  devices.value = (data ?? []) as MikrotikDevice[]
  if (devices.value.length && !selectedMikrotikId.value) {
    selectedMikrotikId.value = devices.value[0].id
  }
}

async function loadRules() {
  if (!selectedMikrotikId.value) {
    rules.value = []
    loading.value = false
    return
  }
  loading.value = true
  errorMsg.value = ''
  const { data, error } = await supabase
    .from('mikrotik_firewall_rules')
    .select('*')
    .eq('mikrotik_id', selectedMikrotikId.value)
    .order('table_name')
    .order('position')
  if (error) {
    errorMsg.value = error.message
  } else {
    rules.value = (data ?? []) as MikrotikFirewallRule[]
  }
  loading.value = false
}

watch(selectedMikrotikId, loadRules)
onMounted(async () => {
  await loadDevices()
  await loadRules()
})

async function onSave() {
  if (!selectedMikrotikId.value) return
  saving.value = true
  errorMsg.value = ''
  try {
    const payload = {
      mikrotik_id: selectedMikrotikId.value,
      table_name: form.table_name,
      chain: form.chain,
      action: form.action,
      src_address: form.src_address || null,
      dst_address: form.dst_address || null,
      protocol: form.protocol || null,
      dst_port: form.dst_port || null,
      src_address_list: form.src_address_list || null,
      out_interface: form.out_interface || null,
      comment: form.comment || null,
      position: form.position,
      enabled: form.enabled,
    }
    let savedRule: MikrotikFirewallRule
    if (editingId.value) {
      const { data, error } = await supabase
        .from('mikrotik_firewall_rules')
        .update(payload)
        .eq('id', editingId.value)
        .select('*')
        .single()
      if (error) throw error
      savedRule = data as MikrotikFirewallRule
    } else {
      const { data, error } = await supabase.from('mikrotik_firewall_rules').insert(payload).select('*').single()
      if (error) throw error
      savedRule = data as MikrotikFirewallRule
    }
    comandoPreview.value = generarComandoFirewallRule(savedRule)
    showForm.value = false
    await loadRules()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo guardar la regla de firewall'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-6xl px-6 py-8">
    <div class="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-slate-900">Firewall</h1>
        <p class="text-sm text-slate-500">{{ rules.length }} reglas</p>
      </div>
      <div class="flex items-end gap-3">
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">MikroTik</label>
          <select v-model="selectedMikrotikId" class="input">
            <option v-for="d in devices" :key="d.id" :value="d.id">{{ d.name }}</option>
          </select>
        </div>
        <button
          :disabled="!selectedMikrotikId"
          class="flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          @click="openNew"
        >
          <PlusIcon class="h-4 w-4" />
          Nueva regla
        </button>
      </div>
    </div>

    <p v-if="errorMsg" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMsg }}</p>

    <div v-if="comandoPreview" class="mb-4 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
      <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-teal-600">Comando RouterOS equivalente</p>
      <pre class="whitespace-pre-wrap font-mono text-xs">{{ comandoPreview }}</pre>
    </div>

    <div v-if="showForm" class="mb-6 rounded-xl border border-slate-200 bg-white p-6">
      <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {{ editingId ? 'Editar regla' : 'Nueva regla' }}
      </h2>
      <form class="grid grid-cols-3 gap-4" @submit.prevent="onSave">
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Tabla</label>
          <select v-model="form.table_name" class="input">
            <option value="filter">filter</option>
            <option value="nat">nat</option>
          </select>
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Chain</label>
          <input v-model="form.chain" required placeholder="forward" class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Acción</label>
          <select v-model="form.action" class="input">
            <option value="accept">accept</option>
            <option value="drop">drop</option>
            <option value="reject">reject</option>
            <option value="masquerade">masquerade</option>
            <option value="log">log</option>
          </select>
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Src. address</label>
          <input v-model="form.src_address" placeholder="10.0.0.0/8" class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Dst. address</label>
          <input v-model="form.dst_address" class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Src. address-list</label>
          <input v-model="form.src_address_list" placeholder="bloqueados" class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Protocolo</label>
          <input v-model="form.protocol" placeholder="tcp" class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Puerto destino</label>
          <input v-model="form.dst_port" class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Out. interface</label>
          <input v-model="form.out_interface" placeholder="ether1-WAN" class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Posición</label>
          <input v-model.number="form.position" type="number" min="0" class="input" />
        </div>
        <div class="col-span-2 space-y-1">
          <label class="text-sm font-medium text-slate-700">Comentario</label>
          <input v-model="form.comment" class="input" />
        </div>
        <div class="col-span-3 flex items-center gap-2">
          <input id="enabled" v-model="form.enabled" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-teal-700" />
          <label for="enabled" class="text-sm font-medium text-slate-700">Regla habilitada</label>
        </div>
        <div class="col-span-3 flex justify-end gap-3">
          <button type="button" class="px-3 py-2 text-sm text-slate-600" @click="showForm = false">
            Cancelar
          </button>
          <button
            type="submit"
            :disabled="saving"
            class="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          >
            Guardar
          </button>
        </div>
      </form>
    </div>

    <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th class="px-4 py-3">#</th>
            <th class="px-4 py-3">Tabla / Chain</th>
            <th class="px-4 py-3">Acción</th>
            <th class="px-4 py-3">Condiciones</th>
            <th class="px-4 py-3">Comentario</th>
            <th class="px-4 py-3">Estado</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="loading">
            <td colspan="7" class="px-4 py-6 text-center text-slate-400">Cargando…</td>
          </tr>
          <tr v-else-if="!rules.length">
            <td colspan="7" class="px-4 py-6 text-center text-slate-400">Sin reglas registradas</td>
          </tr>
          <tr v-for="r in rules" :key="r.id" class="hover:bg-slate-50">
            <td class="px-4 py-3 tabular-nums text-slate-500">{{ r.position }}</td>
            <td class="px-4 py-3 font-mono text-xs text-slate-900">{{ r.table_name }} / {{ r.chain }}</td>
            <td class="px-4 py-3 font-mono text-xs text-slate-600">{{ r.action }}</td>
            <td class="px-4 py-3 font-mono text-xs text-slate-600">
              <span v-if="r.src_address">src={{ r.src_address }} </span>
              <span v-if="r.dst_address">dst={{ r.dst_address }} </span>
              <span v-if="r.src_address_list">list={{ r.src_address_list }} </span>
              <span v-if="r.protocol">proto={{ r.protocol }} </span>
              <span v-if="r.dst_port">port={{ r.dst_port }} </span>
              <span v-if="r.out_interface">out={{ r.out_interface }}</span>
            </td>
            <td class="px-4 py-3 text-slate-600">{{ r.comment || '—' }}</td>
            <td class="px-4 py-3"><StatusBadge :status="r.enabled ? 'active' : 'inactive'" /></td>
            <td class="px-4 py-3 text-right">
              <button class="text-sm font-medium text-teal-700 hover:text-teal-900" @click="openEdit(r)">
                Editar
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.input {
  @apply w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600;
}
</style>
