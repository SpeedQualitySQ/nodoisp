<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import type {
  Canton,
  ClientStatus,
  InstallationAddress,
  Plan,
  Province,
  ServiceContract,
} from '@/types/database'
import StatusBadge from '@/components/StatusBadge.vue'
import LeafletMap, { type MapMarker } from '@/components/LeafletMap.vue'

const props = defineProps<{ id?: string }>()
const router = useRouter()
const isEdit = computed(() => !!props.id)

const saving = ref(false)
const loading = ref(isEdit.value)
const errorMsg = ref('')
const status = ref<ClientStatus>('prospect')

const client = reactive({
  first_name: '',
  last_name: '',
  identification: '',
  email: '',
  mobile: '',
  phone: '',
  province_id: null as number | null,
  canton_id: null as number | null,
})

const address = reactive({
  id: null as string | null,
  address_line: '',
  reference: '',
  lat: null as number | null,
  lng: null as number | null,
})

const provinces = ref<Province[]>([])
const cantons = ref<Canton[]>([])

const contract = ref<ServiceContract | null>(null)
const plans = ref<Plan[]>([])
const newContract = reactive({
  plan_id: '',
  monthly_fee: null as number | null,
  billing_day: 1,
  installation_date: '',
})

const markers = computed<MapMarker[]>(() =>
  address.lat != null && address.lng != null
    ? [{ id: 'address', lat: address.lat, lng: address.lng, color: '#0e6f5c' }]
    : [],
)

function onMapClick({ lat, lng }: { lat: number; lng: number }) {
  address.lat = lat
  address.lng = lng
}

watch(
  () => client.province_id,
  async (provinceId) => {
    if (!provinceId) {
      cantons.value = []
      return
    }
    const { data } = await supabase
      .from('cantons')
      .select('id, province_id, name')
      .eq('province_id', provinceId)
      .order('name')
    cantons.value = (data ?? []) as Canton[]
  },
)

async function loadLookups() {
  const [{ data: prov }, { data: pl }] = await Promise.all([
    supabase.from('provinces').select('id, name').order('name'),
    supabase.from('plans').select('*').eq('is_active', true).order('name'),
  ])
  provinces.value = (prov ?? []) as Province[]
  plans.value = (pl ?? []) as Plan[]
}

async function loadClient() {
  if (!props.id) return
  const [{ data: c, error: cErr }, { data: addr }, { data: contracts }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', props.id).single(),
    supabase
      .from('installation_addresses')
      .select('*')
      .eq('client_id', props.id)
      .eq('is_primary', true)
      .maybeSingle(),
    supabase
      .from('service_contracts')
      .select('*')
      .eq('client_id', props.id)
      .order('created_at', { ascending: false })
      .limit(1),
  ])
  if (cErr) {
    errorMsg.value = cErr.message
    return
  }
  Object.assign(client, c)
  status.value = c.status
  if (addr) Object.assign(address, addr as InstallationAddress)
  contract.value = (contracts?.[0] as ServiceContract) ?? null
}

onMounted(async () => {
  await Promise.all([loadLookups(), loadClient()])
  loading.value = false
})

async function onSave() {
  errorMsg.value = ''
  saving.value = true
  try {
    let clientId = props.id

    if (isEdit.value) {
      const { error } = await supabase.from('clients').update(client).eq('id', clientId)
      if (error) throw error
    } else {
      const { data, error } = await supabase
        .from('clients')
        .insert(client)
        .select('id')
        .single()
      if (error) throw error
      clientId = data.id
    }

    if (address.address_line || address.lat != null) {
      const payload = { ...address, client_id: clientId, is_primary: true }
      if (address.id) {
        const { error } = await supabase
          .from('installation_addresses')
          .update(payload)
          .eq('id', address.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('installation_addresses').insert(payload)
        if (error) throw error
      }
    }

    router.push({ name: 'client-edit', params: { id: clientId } })
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo guardar el cliente'
  } finally {
    saving.value = false
  }
}

async function onCreateContract() {
  if (!props.id || !newContract.plan_id) return
  errorMsg.value = ''
  saving.value = true
  try {
    const plan = plans.value.find((p) => p.id === newContract.plan_id)
    const { data, error } = await supabase
      .from('service_contracts')
      .insert({
        client_id: props.id,
        plan_id: newContract.plan_id,
        monthly_fee: newContract.monthly_fee ?? plan?.price ?? 0,
        billing_day: newContract.billing_day,
        installation_date: newContract.installation_date || null,
        status: 'pending',
      })
      .select('*')
      .single()
    if (error) throw error
    contract.value = data as ServiceContract
    status.value = 'pending'
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo crear el contrato'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-6 py-8">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-xl font-semibold text-slate-900">
        {{ isEdit ? `${client.first_name} ${client.last_name}` || 'Editar cliente' : 'Nuevo cliente' }}
      </h1>
      <StatusBadge v-if="isEdit" :status="status" />
    </div>

    <p v-if="errorMsg" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      {{ errorMsg }}
    </p>

    <div v-if="loading" class="text-sm text-slate-400">Cargando…</div>

    <form v-else class="space-y-8" @submit.prevent="onSave">
      <section class="rounded-xl border border-slate-200 bg-white p-6">
        <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Datos personales</h2>
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Nombres</label>
            <input v-model="client.first_name" required class="input" />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Apellidos</label>
            <input v-model="client.last_name" required class="input" />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Cédula / RUC</label>
            <input v-model="client.identification" required class="input" />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Correo</label>
            <input v-model="client.email" type="email" class="input" />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Celular</label>
            <input v-model="client.mobile" class="input" />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Teléfono fijo</label>
            <input v-model="client.phone" class="input" />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Provincia</label>
            <select v-model="client.province_id" class="input">
              <option :value="null">—</option>
              <option v-for="p in provinces" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Cantón</label>
            <select v-model="client.canton_id" class="input" :disabled="!cantons.length">
              <option :value="null">—</option>
              <option v-for="c in cantons" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
        </div>
      </section>

      <section class="rounded-xl border border-slate-200 bg-white p-6">
        <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Dirección de instalación
        </h2>
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Dirección</label>
            <input v-model="address.address_line" class="input" />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Referencia</label>
            <input v-model="address.reference" class="input" />
          </div>
        </div>
        <p class="mt-4 mb-2 text-xs text-slate-500">
          Haz clic en el mapa para fijar las coordenadas de instalación.
        </p>
        <div class="h-72 overflow-hidden rounded-lg border border-slate-200">
          <LeafletMap clickable :markers="markers" @map-click="onMapClick" />
        </div>
        <p v-if="address.lat != null" class="mt-2 font-mono text-xs text-slate-500">
          {{ address.lat.toFixed(6) }}, {{ address.lng?.toFixed(6) }}
        </p>
      </section>

      <div class="flex justify-end gap-3">
        <button
          type="submit"
          :disabled="saving"
          class="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {{ saving ? 'Guardando…' : 'Guardar cliente' }}
        </button>
      </div>
    </form>

    <section v-if="isEdit && !loading" class="mt-8 rounded-xl border border-slate-200 bg-white p-6">
      <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Contrato</h2>

      <div v-if="contract" class="flex items-center justify-between text-sm">
        <div>
          <p class="font-medium text-slate-900">{{ contract.contract_number }}</p>
          <p class="text-slate-500">
            Mensualidad ${{ contract.monthly_fee }} · día de facturación {{ contract.billing_day }}
          </p>
        </div>
        <StatusBadge :status="contract.status" />
      </div>

      <form v-else class="grid grid-cols-2 gap-4" @submit.prevent="onCreateContract">
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Plan</label>
          <select v-model="newContract.plan_id" required class="input">
            <option value="" disabled>Selecciona un plan</option>
            <option v-for="p in plans" :key="p.id" :value="p.id">
              {{ p.name }} — ${{ p.price }}
            </option>
          </select>
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Mensualidad (opcional)</label>
          <input v-model.number="newContract.monthly_fee" type="number" step="0.01" class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Día de facturación</label>
          <input v-model.number="newContract.billing_day" type="number" min="1" max="28" class="input" />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Fecha de instalación programada</label>
          <input v-model="newContract.installation_date" type="date" class="input" />
        </div>
        <div class="col-span-2">
          <button
            type="submit"
            :disabled="saving"
            class="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          >
            Crear contrato
          </button>
        </div>
      </form>
    </section>
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.input {
  @apply w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600;
}
</style>
