import type { GenieAcsDevice } from '@/types/database'

/**
 * Cliente contra el API NBI real de GenieACS (puerto 7557), a través del
 * proxy de Vite en /genieacs-api (ver vite.config.ts — el NBI no manda
 * CORS, así que el navegador no puede pegarle directo). A diferencia de
 * src/lib/olt.ts y src/lib/mikrotik.ts, esto no es una simulación: el ACS
 * está corriendo de verdad y los comandos se encolan para ejecutarse contra
 * el CPE real la próxima vez que se conecte (o de inmediato si está online
 * y se pide connectionRequest).
 */

const BASE = '/genieacs-api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `GenieACS respondió ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export async function listDevices() {
  return request<GenieAcsDevice[]>('/devices/')
}

export async function getDevice(id: string) {
  const query = encodeURIComponent(JSON.stringify({ _id: id }))
  const devices = await request<GenieAcsDevice[]>(`/devices/?query=${query}`)
  return devices[0] ?? null
}

export async function deleteDevice(id: string) {
  await request<void>(`/devices/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

type ParamValueTask = {
  name: 'setParameterValues'
  parameterValues: [string, string | number | boolean, string][]
}
type ParamNamesTask = { name: 'getParameterValues'; parameterNames: string[] }
type RefreshObjectTask = { name: 'refreshObject'; objectName: string }
type SimpleTask = { name: 'reboot' | 'factoryReset' }
export type GenieAcsTask = ParamValueTask | ParamNamesTask | RefreshObjectTask | SimpleTask

export async function queueTask(id: string, task: GenieAcsTask, opts?: { connectionRequest?: boolean }) {
  const qs = opts?.connectionRequest ? '?connection_request' : ''
  return request<unknown>(`/devices/${encodeURIComponent(id)}/tasks${qs}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  })
}

/** Lee un nodo del árbol TR-069 (`{ _value, _type, ... }` anidado) por path con puntos. */
export function getParamValue(device: GenieAcsDevice, path: string): string | null {
  let node: unknown = device
  for (const part of path.split('.')) {
    if (typeof node !== 'object' || node === null) return null
    node = (node as Record<string, unknown>)[part]
  }
  if (typeof node !== 'object' || node === null) return null
  const value = (node as Record<string, unknown>)._value
  return value == null ? null : String(value)
}

type ParamMatch = { path: string; value: string }

// El número de instancia de LANDevice/WANConnectionDevice/etc. varía por
// fabricante (Realtek, Huawei y ZTE no coinciden), así que en vez de asumir
// rutas fijas con instancia "1" se recorre TODO el árbol una vez y se buscan
// las hojas cuyo path termine en el sufijo esperado.
function walkTree(node: unknown, path: string, out: ParamMatch[]) {
  if (typeof node !== 'object' || node === null) return
  const obj = node as Record<string, unknown>
  if ('_value' in obj) {
    out.push({ path, value: String(obj._value) })
    return
  }
  for (const key of Object.keys(obj)) {
    if (key.startsWith('_')) continue
    walkTree(obj[key], path ? `${path}.${key}` : key, out)
  }
}

/** Todas las hojas del árbol cuyo path termine con `suffix` (ej. ".SSID"). */
export function findParams(device: GenieAcsDevice, suffix: string, mustInclude?: string): ParamMatch[] {
  const all: ParamMatch[] = []
  walkTree(device, '', all)
  return all.filter((p) => p.path.endsWith(suffix) && (!mustInclude || p.path.includes(mustInclude)))
}

/** Path del padre inmediato (todo el path menos la última hoja). Sirve para agrupar Username/Password/IP de una misma conexión WAN. */
function parentPath(path: string) {
  return path.slice(0, path.lastIndexOf('.'))
}

// Equipos más nuevos reportan bajo el modelo de datos TR-181 ("Device.*")
// en vez del clásico TR-098 ("InternetGatewayDevice.*") que usan la mayoría
// de ONUs Huawei/ZTE/Realtek desplegadas hoy. Ambos se buscan siempre, para
// no depender de qué marca conecte.
export function findWifiNetworks(device: GenieAcsDevice) {
  const tr098 = findParams(device, '.SSID', 'WLANConfiguration').map((p) => ({ ...p, model: 'tr098' as const }))
  const tr181 = findParams(device, '.SSID', 'WiFi.SSID').map((p) => ({ ...p, model: 'tr181' as const }))
  return [...tr098, ...tr181].map((ssid) => {
    const group = parentPath(ssid.path)
    if (ssid.model === 'tr098') {
      const passwordPath = `${group}.KeyPassphrase`
      const password = getParamValue(device, passwordPath) ?? getParamValue(device, `${group}.PreSharedKey.1.KeyPassphrase`) ?? ''
      return { ssidPath: ssid.path, ssid: ssid.value, passwordPath, password }
    }
    // TR-181: la contraseña vive en Device.WiFi.AccessPoint.{n}.Security, no
    // junto al SSID. La instancia de AccessPoint no siempre coincide con la
    // del SSID, pero en la gran mayoría de equipos sí (misma numeración).
    const instance = group.split('.').pop()
    const passwordPath = `Device.WiFi.AccessPoint.${instance}.Security.KeyPassphrase`
    const password = getParamValue(device, passwordPath) ?? ''
    return { ssidPath: ssid.path, ssid: ssid.value, passwordPath, password }
  })
}

// Campos editables de bajo riesgo (nombre, MTU, NAT, etc.) — no incluyen
// nada que pueda dejar al equipo sin conectividad. El path es relativo al
// "group" de cada conexión (mismo padre que Username/Password).
const WAN_ADVANCED_EDITABLE: { key: string; label: string; suffix: string; type: string }[] = [
  { key: 'name', label: 'Nombre de conexión', suffix: 'Name', type: 'xsd:string' },
  { key: 'mtu', label: 'MTU', suffix: 'MaxMRUSize', type: 'xsd:unsignedInt' },
  { key: 'nat', label: 'NAT habilitado', suffix: 'NATEnabled', type: 'xsd:boolean' },
  { key: 'trigger', label: 'Tipo de conexión PPP', suffix: 'ConnectionTrigger', type: 'xsd:string' },
  { key: 'serviceName', label: 'Service-Name', suffix: 'PPPoEServiceName', type: 'xsd:string' },
  { key: 'serviceList', label: 'Modo de servicio', suffix: 'X_CT-COM_ServiceList', type: 'xsd:string' },
  { key: 'priority', label: 'Prioridad 802.1p', suffix: 'X_CT-COM_802-1pMark', type: 'xsd:unsignedInt' },
]

// Solo lectura: tocarlos mal puede desconectar el equipo por completo (y de
// paso perder el canal de gestión TR-069, que viaja por la misma WAN).
const WAN_ADVANCED_READONLY: { key: string; label: string; suffix: string }[] = [
  { key: 'connectionType', label: 'Modo (Route/Bridge)', suffix: 'ConnectionType' },
  { key: 'vlanEnabled', label: 'VLAN habilitada', suffix: 'X_CT-COM_VLANMode' },
  { key: 'vlanId', label: 'VLAN ID', suffix: 'X_CT-COM_VLANIDMark' },
  { key: 'status', label: 'Estado de conexión', suffix: 'ConnectionStatus' },
  { key: 'lastError', label: 'Último error', suffix: 'LastConnectionError' },
]

export type WanAdvancedField = { key: string; label: string; path: string; value: string; xsdType?: string }

export type WanConnection = {
  group: string
  type: 'pppoe' | 'ip'
  usernamePath?: string
  username: string
  passwordPath?: string
  externalIp: string
  mac: string
  advancedEditable: WanAdvancedField[]
  advancedReadonly: WanAdvancedField[]
}

function readWanAdvanced(device: GenieAcsDevice, group: string) {
  const editable: WanAdvancedField[] = []
  for (const f of WAN_ADVANCED_EDITABLE) {
    const path = `${group}.${f.suffix}`
    const value = getParamValue(device, path)
    if (value != null) editable.push({ key: f.key, label: f.label, path, value, xsdType: f.type })
  }
  const readonly: WanAdvancedField[] = []
  for (const f of WAN_ADVANCED_READONLY) {
    const path = `${group}.${f.suffix}`
    const value = getParamValue(device, path)
    if (value != null) readonly.push({ key: f.key, label: f.label, path, value })
  }
  return { editable, readonly }
}

export function findWanConnections(device: GenieAcsDevice): WanConnection[] {
  const results: WanConnection[] = []
  const seen = new Set<string>()

  // Conexiones con autenticación PPPoE (TR-098 WANPPPConnection y TR-181 PPP.Interface).
  const usernames = [
    ...findParams(device, '.Username', 'WANPPPConnection'),
    ...findParams(device, '.Username', 'PPP.Interface'),
  ]
  for (const u of usernames) {
    const group = parentPath(u.path)
    if (seen.has(group)) continue
    seen.add(group)
    const advanced = readWanAdvanced(device, group)
    results.push({
      group,
      type: 'pppoe',
      usernamePath: u.path,
      username: u.value,
      passwordPath: `${group}.Password`,
      externalIp: getParamValue(device, `${group}.ExternalIPAddress`) ?? '',
      mac: getParamValue(device, `${group}.MACAddress`) ?? '',
      advancedEditable: advanced.editable,
      advancedReadonly: advanced.readonly,
    })
  }

  // Conexiones sin PPPoE (IP fija o DHCP directo del ISP) — solo lectura,
  // no hay usuario/contraseña que editar.
  for (const ext of findParams(device, '.ExternalIPAddress', 'WANIPConnection')) {
    const group = parentPath(ext.path)
    if (seen.has(group)) continue
    seen.add(group)
    const advanced = readWanAdvanced(device, group)
    results.push({
      group,
      type: 'ip',
      username: '',
      externalIp: ext.value,
      mac: getParamValue(device, `${group}.MACAddress`) ?? '',
      advancedEditable: advanced.editable,
      advancedReadonly: advanced.readonly,
    })
  }

  return results
}

export const COMMON_PARAMS = {
  softwareVersion: ['InternetGatewayDevice.DeviceInfo.SoftwareVersion', 'Device.DeviceInfo.SoftwareVersion'],
  uptime: ['InternetGatewayDevice.DeviceInfo.UpTime', 'Device.DeviceInfo.UpTime'],
}

/** Primer path (de una lista de candidatos fijos) que efectivamente tenga valor. Útil solo para campos que sí son estables entre fabricantes (versión de firmware, uptime). */
export function firstParamValue(device: GenieAcsDevice, paths: string[]): { path: string; value: string } | null {
  for (const path of paths) {
    const value = getParamValue(device, path)
    if (value != null) return { path, value }
  }
  return null
}

export function deviceLabel(device: GenieAcsDevice) {
  const id = device._deviceId
  const manufacturer = id?._Manufacturer ?? '—'
  const productClass = id?._ProductClass ?? ''
  const serial = id?._SerialNumber ?? device._id
  return { manufacturer, productClass, serial }
}

/** Se considera online si informó en los últimos 2x el intervalo típico (1h -> 2h de margen). */
export function isOnline(device: GenieAcsDevice, thresholdMs = 2 * 60 * 60 * 1000) {
  if (!device._lastInform) return false
  return Date.now() - new Date(device._lastInform).getTime() < thresholdMs
}
