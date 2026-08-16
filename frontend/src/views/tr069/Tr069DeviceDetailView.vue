<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  COMMON_PARAMS,
  deviceLabel,
  findWanConnections,
  findWifiNetworks,
  firstParamValue,
  getDevice,
  isOnline,
  queueTask,
  type WanAdvancedField,
} from '@/lib/genieacs'
import type { GenieAcsDevice } from '@/types/database'
import StatusBadge from '@/components/StatusBadge.vue'

const props = defineProps<{ id: string }>()
const router = useRouter()

const device = ref<GenieAcsDevice | null>(null)
const loading = ref(true)
const errorMsg = ref('')
const infoMsg = ref('')
const busy = ref(false)
const showRaw = ref(false)

type WifiForm = { ssid: string; password: string; editing: boolean }
type WanForm = { username: string; password: string; editing: boolean }
const wifiForms = reactive<Record<string, WifiForm>>({})
const wanForms = reactive<Record<string, WanForm>>({})
// Valores de los campos avanzados de bajo riesgo (Name, MTU, NAT, etc.),
// editables directamente sin un modo "editar" aparte, más un toggle para
// mostrar/ocultar el bloque por conexión.
const wanAdvancedValues = reactive<Record<string, Record<string, string>>>({})
const wanAdvancedOpen = reactive<Record<string, boolean>>({})

async function loadDevice() {
  loading.value = true
  errorMsg.value = ''
  try {
    const d = await getDevice(props.id)
    device.value = d
    if (d) {
      for (const net of findWifiNetworks(d)) {
        wifiForms[net.ssidPath] = { ssid: net.ssid, password: net.password, editing: false }
      }
      for (const wan of findWanConnections(d)) {
        wanForms[wan.group] = { username: wan.username, password: '', editing: false }
        wanAdvancedValues[wan.group] = Object.fromEntries(wan.advancedEditable.map((f) => [f.key, f.value]))
      }
    }
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo cargar el CPE'
  } finally {
    loading.value = false
  }
}

onMounted(loadDevice)

// Mismo motivo que en ClientFormView.vue: si se navega de un CPE a otro sin
// pasar por /tr069 en el medio, Vue Router reutiliza esta instancia y
// onMounted no vuelve a dispararse.
watch(
  () => props.id,
  () => {
    Object.keys(wifiForms).forEach((k) => delete wifiForms[k])
    Object.keys(wanForms).forEach((k) => delete wanForms[k])
    Object.keys(wanAdvancedValues).forEach((k) => delete wanAdvancedValues[k])
    Object.keys(wanAdvancedOpen).forEach((k) => delete wanAdvancedOpen[k])
    loadDevice()
  },
)

const info = computed(() => {
  if (!device.value) return null
  return {
    ...deviceLabel(device.value),
    software: firstParamValue(device.value, COMMON_PARAMS.softwareVersion)?.value ?? '—',
    uptime: firstParamValue(device.value, COMMON_PARAMS.uptime)?.value ?? '—',
    lastInform: device.value._lastInform ? new Date(device.value._lastInform).toLocaleString('es-EC') : '—',
  }
})

const wifiNetworks = computed(() => (device.value ? findWifiNetworks(device.value) : []))
const wanConnections = computed(() => (device.value ? findWanConnections(device.value) : []))

async function onRefrescar() {
  if (!device.value) return
  busy.value = true
  errorMsg.value = ''
  infoMsg.value = ''
  try {
    // refreshObject le pide al equipo que enumere y devuelva TODO lo que
    // haya bajo esa rama — necesario la primera vez, porque el CPE solo
    // manda un puñado de parámetros en su Inform inicial (no WiFi/WAN
    // completo). connection_request intenta forzarlo ahora; si el equipo no
    // responde a la orden de conexión (por ejemplo por credenciales de
    // connection-request no configuradas), igual queda encolado para la
    // próxima vez que el CPE se reporte solo.
    await queueTask(device.value._id, { name: 'refreshObject', objectName: 'InternetGatewayDevice.LANDevice' }, { connectionRequest: true })
    await queueTask(device.value._id, { name: 'refreshObject', objectName: 'InternetGatewayDevice.WANDevice' }, { connectionRequest: true })
    infoMsg.value =
      'Se pidió refrescar WiFi y WAN. Si el equipo no responde de inmediato, quedó encolado para la próxima vez que se conecte solo.'
    await loadDevice()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo refrescar el CPE'
  } finally {
    busy.value = false
  }
}

async function onGuardarWifi(net: ReturnType<typeof findWifiNetworks>[number]) {
  if (!device.value) return
  const form = wifiForms[net.ssidPath]
  busy.value = true
  errorMsg.value = ''
  infoMsg.value = ''
  try {
    // Una contraseña vacía es inválida para una red protegida — el equipo
    // rechaza la tarea completa (SSID incluido) si se la mandamos así. Si no
    // se tocó el campo, no se incluye en la tarea.
    if (form.password && form.password.length < 8) {
      throw new Error('La contraseña de WiFi debe tener al menos 8 caracteres (o dejarla igual sin tocarla).')
    }
    const parameterValues: [string, string, string][] = [[net.ssidPath, form.ssid, 'xsd:string']]
    if (form.password) parameterValues.push([net.passwordPath, form.password, 'xsd:string'])
    await queueTask(device.value._id, { name: 'setParameterValues', parameterValues }, { connectionRequest: true })
    form.editing = false
    infoMsg.value = 'Cambio de WiFi encolado. Se aplica ahora si el equipo responde, o en su próxima conexión.'
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo aplicar el cambio de WiFi'
  } finally {
    busy.value = false
  }
}

async function onGuardarWan(wan: ReturnType<typeof findWanConnections>[number]) {
  if (!device.value || wan.type !== 'pppoe' || !wan.usernamePath || !wan.passwordPath) return
  const form = wanForms[wan.group]
  busy.value = true
  errorMsg.value = ''
  infoMsg.value = ''
  try {
    const values: [string, string, string][] = [[wan.usernamePath, form.username, 'xsd:string']]
    if (form.password) values.push([wan.passwordPath, form.password, 'xsd:string'])
    await queueTask(device.value._id, { name: 'setParameterValues', parameterValues: values }, { connectionRequest: true })
    form.editing = false
    infoMsg.value = 'Cambio de WAN encolado. Se aplica ahora si el equipo responde, o en su próxima conexión.'
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo aplicar el cambio de WAN'
  } finally {
    busy.value = false
  }
}

function castWanAdvancedValue(field: WanAdvancedField, raw: string): string | number | boolean {
  if (field.xsdType === 'xsd:boolean') return raw === 'true'
  if (field.xsdType === 'xsd:unsignedInt') return Number(raw) || 0
  return raw
}

async function onGuardarWanAdvanced(wan: ReturnType<typeof findWanConnections>[number]) {
  if (!device.value) return
  const values = wanAdvancedValues[wan.group]
  busy.value = true
  errorMsg.value = ''
  infoMsg.value = ''
  try {
    const parameterValues = wan.advancedEditable.map(
      (f): [string, string | number | boolean, string] => [f.path, castWanAdvancedValue(f, values[f.key]), f.xsdType ?? 'xsd:string'],
    )
    await queueTask(device.value._id, { name: 'setParameterValues', parameterValues }, { connectionRequest: true })
    wanAdvancedOpen[wan.group] = false
    infoMsg.value = 'Configuración avanzada de WAN encolada. Se aplica ahora si el equipo responde, o en su próxima conexión.'
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo aplicar la configuración avanzada'
  } finally {
    busy.value = false
  }
}

async function onReiniciar() {
  if (!device.value || !confirm('¿Reiniciar este equipo? El cliente perderá conexión unos segundos.')) return
  busy.value = true
  errorMsg.value = ''
  try {
    await queueTask(device.value._id, { name: 'reboot' }, { connectionRequest: true })
    infoMsg.value = 'Reinicio encolado.'
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo reiniciar el equipo'
  } finally {
    busy.value = false
  }
}

async function onResetFabrica() {
  if (
    !device.value ||
    !confirm('¿Restaurar este equipo a valores de fábrica? Esto borra su configuración actual y no se puede deshacer.')
  )
    return
  busy.value = true
  errorMsg.value = ''
  try {
    await queueTask(device.value._id, { name: 'factoryReset' }, { connectionRequest: true })
    router.push({ name: 'tr069-devices' })
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo resetear el equipo'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-6 py-8">
    <div v-if="loading" class="text-sm text-slate-400">Cargando…</div>
    <div v-else-if="!device" class="text-sm text-slate-400">No se encontró el CPE.</div>

    <template v-else>
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h1 class="text-xl font-semibold text-slate-900">{{ info!.manufacturer }} {{ info!.productClass }}</h1>
          <p class="font-mono text-xs text-slate-500">{{ info!.serial }}</p>
        </div>
        <StatusBadge :status="isOnline(device) ? 'online' : 'offline'" />
      </div>

      <p v-if="errorMsg" class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMsg }}</p>
      <p v-if="infoMsg" class="mb-4 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-700">{{ infoMsg }}</p>

      <section class="mb-6 rounded-xl border border-slate-200 bg-white p-6">
        <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Datos del equipo</h2>
        <dl class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt class="text-slate-500">Firmware</dt>
            <dd class="text-slate-900">{{ info!.software }}</dd>
          </div>
          <div>
            <dt class="text-slate-500">Uptime</dt>
            <dd class="text-slate-900">{{ info!.uptime }}</dd>
          </div>
          <div>
            <dt class="text-slate-500">Último contacto</dt>
            <dd class="text-slate-900">{{ info!.lastInform }}</dd>
          </div>
        </dl>
        <div class="mt-4 flex flex-wrap gap-3">
          <button
            :disabled="busy"
            class="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60"
            @click="onRefrescar"
          >
            {{ busy ? 'Procesando…' : 'Refrescar WiFi/WAN ahora' }}
          </button>
          <button
            :disabled="busy"
            class="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60"
            @click="onReiniciar"
          >
            Reiniciar
          </button>
          <button
            :disabled="busy"
            class="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
            @click="onResetFabrica"
          >
            Reset de fábrica
          </button>
        </div>
      </section>

      <section class="mb-6 rounded-xl border border-slate-200 bg-white p-6">
        <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">WiFi</h2>
        <p v-if="!wifiNetworks.length" class="text-sm text-slate-400">
          Todavía no se leyó la configuración de WiFi de este equipo. Probá "Refrescar WiFi/WAN ahora".
        </p>
        <div v-for="net in wifiNetworks" :key="net.ssidPath" class="mb-4 border-b border-slate-100 pb-4 last:mb-0 last:border-0 last:pb-0">
          <form v-if="wifiForms[net.ssidPath]?.editing" class="grid grid-cols-2 gap-4" @submit.prevent="onGuardarWifi(net)">
            <div class="space-y-1">
              <label class="text-sm font-medium text-slate-700">SSID</label>
              <input v-model="wifiForms[net.ssidPath].ssid" required class="input" />
            </div>
            <div class="space-y-1">
              <label class="text-sm font-medium text-slate-700">Contraseña</label>
              <input v-model="wifiForms[net.ssidPath].password" class="input" />
            </div>
            <div class="col-span-2 flex justify-end gap-3">
              <button type="button" class="px-3 py-2 text-sm text-slate-600" @click="wifiForms[net.ssidPath].editing = false">
                Cancelar
              </button>
              <button
                type="submit"
                :disabled="busy"
                class="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
              >
                {{ busy ? 'Aplicando…' : 'Aplicar' }}
              </button>
            </div>
          </form>
          <div v-else class="flex items-center justify-between">
            <dl class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt class="text-slate-500">SSID</dt>
                <dd class="text-slate-900">{{ wifiForms[net.ssidPath]?.ssid || '—' }}</dd>
              </div>
              <div>
                <dt class="text-slate-500">Contraseña</dt>
                <dd class="font-mono text-slate-900">{{ wifiForms[net.ssidPath]?.password || '—' }}</dd>
              </div>
            </dl>
            <button class="text-sm font-medium text-teal-700 hover:text-teal-900" @click="wifiForms[net.ssidPath].editing = true">
              Editar
            </button>
          </div>
        </div>
      </section>

      <section class="mb-6 rounded-xl border border-slate-200 bg-white p-6">
        <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">WAN</h2>
        <p v-if="!wanConnections.length" class="text-sm text-slate-400">
          Todavía no se leyó la configuración de WAN de este equipo. Probá "Refrescar WiFi/WAN ahora".
        </p>
        <div v-for="wan in wanConnections" :key="wan.group" class="mb-4 border-b border-slate-100 pb-4 last:mb-0 last:border-0 last:pb-0">
          <form v-if="wan.type === 'pppoe' && wanForms[wan.group]?.editing" class="grid grid-cols-2 gap-4" @submit.prevent="onGuardarWan(wan)">
            <div class="space-y-1">
              <label class="text-sm font-medium text-slate-700">Usuario PPPoE</label>
              <input v-model="wanForms[wan.group].username" required class="input" />
            </div>
            <div class="space-y-1">
              <label class="text-sm font-medium text-slate-700">Contraseña (dejar vacío para no cambiarla)</label>
              <input v-model="wanForms[wan.group].password" class="input" />
            </div>
            <div class="col-span-2 flex justify-end gap-3">
              <button type="button" class="px-3 py-2 text-sm text-slate-600" @click="wanForms[wan.group].editing = false">
                Cancelar
              </button>
              <button
                type="submit"
                :disabled="busy"
                class="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
              >
                {{ busy ? 'Aplicando…' : 'Aplicar' }}
              </button>
            </div>
          </form>
          <div v-else class="flex items-center justify-between">
            <dl class="grid grid-cols-4 gap-4 text-sm">
              <div>
                <dt class="text-slate-500">Tipo</dt>
                <dd class="text-slate-900">{{ wan.type === 'pppoe' ? 'PPPoE' : 'IP directa (DHCP/estática)' }}</dd>
              </div>
              <div v-if="wan.type === 'pppoe'">
                <dt class="text-slate-500">Usuario PPPoE</dt>
                <dd class="text-slate-900">{{ wan.username || '—' }}</dd>
              </div>
              <div>
                <dt class="text-slate-500">IP externa</dt>
                <dd class="font-mono text-slate-900">{{ wan.externalIp || '—' }}</dd>
              </div>
              <div>
                <dt class="text-slate-500">MAC</dt>
                <dd class="font-mono text-slate-900">{{ wan.mac || '—' }}</dd>
              </div>
            </dl>
            <button
              v-if="wan.type === 'pppoe'"
              class="text-sm font-medium text-teal-700 hover:text-teal-900"
              @click="wanForms[wan.group].editing = true"
            >
              Editar
            </button>
          </div>

          <div v-if="wan.advancedEditable.length || wan.advancedReadonly.length" class="mt-3">
            <button
              class="text-xs font-medium text-slate-500 hover:text-slate-700"
              @click="wanAdvancedOpen[wan.group] = !wanAdvancedOpen[wan.group]"
            >
              {{ wanAdvancedOpen[wan.group] ? 'Ocultar' : 'Ver' }} configuración avanzada
            </button>
            <div v-if="wanAdvancedOpen[wan.group]" class="mt-3 rounded-lg bg-slate-50 p-4">
              <form v-if="wan.advancedEditable.length" class="grid grid-cols-2 gap-4" @submit.prevent="onGuardarWanAdvanced(wan)">
                <div v-for="f in wan.advancedEditable" :key="f.key" class="space-y-1">
                  <label class="text-sm font-medium text-slate-700">{{ f.label }}</label>
                  <select v-if="f.xsdType === 'xsd:boolean'" v-model="wanAdvancedValues[wan.group][f.key]" class="input">
                    <option value="true">Sí</option>
                    <option value="false">No</option>
                  </select>
                  <input
                    v-else
                    v-model="wanAdvancedValues[wan.group][f.key]"
                    :type="f.xsdType === 'xsd:unsignedInt' ? 'number' : 'text'"
                    class="input"
                  />
                </div>
                <div class="col-span-2 flex justify-end">
                  <button
                    type="submit"
                    :disabled="busy"
                    class="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
                  >
                    {{ busy ? 'Aplicando…' : 'Guardar avanzado' }}
                  </button>
                </div>
              </form>
              <div v-if="wan.advancedReadonly.length" class="mt-4 border-t border-slate-200 pt-3">
                <p class="mb-2 text-xs text-amber-700">
                  Solo lectura: cambiar esto puede dejar al equipo sin conexión (y sin poder gestionarlo remotamente para revertirlo).
                </p>
                <dl class="grid grid-cols-2 gap-3 text-sm">
                  <div v-for="f in wan.advancedReadonly" :key="f.key">
                    <dt class="text-slate-500">{{ f.label }}</dt>
                    <dd class="font-mono text-slate-900">{{ f.value }}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="rounded-xl border border-slate-200 bg-white p-6">
        <button
          class="text-sm font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700"
          @click="showRaw = !showRaw"
        >
          {{ showRaw ? 'Ocultar' : 'Ver' }} todos los parámetros
        </button>
        <pre v-if="showRaw" class="mt-4 max-h-96 overflow-auto rounded-lg bg-slate-50 p-4 text-xs">{{
          JSON.stringify(device, null, 2)
        }}</pre>
      </section>
    </template>
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.input {
  @apply w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600;
}
</style>
