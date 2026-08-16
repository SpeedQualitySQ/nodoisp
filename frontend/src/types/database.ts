export type ClientStatus = 'prospect' | 'pending' | 'active' | 'suspended' | 'cut' | 'retired'
export type ContractStatus = 'pending' | 'active' | 'suspended' | 'cut' | 'terminated'
export type PlanTechnology = 'fiber' | 'radio' | 'cable'

export type DocumentTipo = '01' | '04' | '05'
export type DocumentEstado = 'BORRADOR' | 'PROCESANDO' | 'AUTORIZADO' | 'RECHAZADO' | 'ANULADO'
export type PaymentMethod = 'efectivo' | 'transferencia' | 'deposito' | 'tarjeta' | 'cheque'

export interface Province {
  id: number
  name: string
}

export interface Canton {
  id: number
  province_id: number
  name: string
}

export interface Profile {
  id: string
  full_name: string | null
  email: string | null
  created_at: string
}

export interface Client {
  id: string
  first_name: string
  last_name: string
  identification: string
  email: string | null
  mobile: string | null
  phone: string | null
  status: ClientStatus
  province_id: number | null
  canton_id: number | null
  created_at: string
  updated_at: string
}

export interface InstallationAddress {
  id: string
  client_id: string
  address_line: string
  reference: string | null
  lat: number | null
  lng: number | null
  province_id: number | null
  canton_id: number | null
  is_primary: boolean
  created_at: string
}

export interface ClientStatusHistory {
  id: string
  client_id: string
  old_status: ClientStatus | null
  new_status: ClientStatus
  changed_by: string | null
  changed_at: string
  note: string | null
}

export interface ClientDocument {
  id: string
  client_id: string
  file_path: string
  file_name: string
  doc_type: string | null
  uploaded_by: string | null
  uploaded_at: string
}

export interface Plan {
  id: string
  name: string
  download_speed: number
  upload_speed: number
  price: number
  technology: PlanTechnology
  is_active: boolean
  created_at: string
}

export interface ServiceContract {
  id: string
  contract_number: string
  client_id: string
  plan_id: string
  monthly_fee: number
  billing_day: number
  installation_date: string | null
  start_date: string | null
  status: ContractStatus
  technician_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ClientWithContract extends Client {
  contract_id: string | null
  contract_number: string | null
  contract_status: ContractStatus | null
  plan_id: string | null
  plan_name: string | null
  monthly_fee: number | null
}

export interface ContractBoardItem extends ServiceContract {
  client_first_name: string
  client_last_name: string
  plan_name: string
  technician_full_name: string | null
}

export interface InstallationItem extends ServiceContract {
  client_first_name: string
  client_last_name: string
  plan_name: string
  technician_full_name: string | null
  address_line: string | null
  lat: number | null
  lng: number | null
}

export interface SriEmitterConfig {
  id: string
  ruc: string
  razon_social: string
  nombre_comercial: string | null
  direccion: string
  establecimiento: string
  punto_emision: string
  ambiente: 1 | 2
  certificado_path: string | null
  certificado_password: string | null
  secuencial_factura: number
  secuencial_nota_credito: number
  secuencial_nota_debito: number
  created_at: string
  updated_at: string
}

export interface DocumentItem {
  id: string
  document_id: string
  description: string
  quantity: number
  unit_price: number
  subtotal: number
  created_at: string
}

export interface ElectronicDocument {
  id: string
  tipo_comprobante: DocumentTipo
  establecimiento: string
  punto_emision: string
  secuencial: string
  numero_completo: string
  ambiente: 1 | 2
  fecha_emision: string
  client_id: string | null
  contract_id: string | null
  razon_social_comprador: string
  identificacion_comprador: string
  subtotal_sin_impuestos: number
  iva: number
  importe_total: number
  estado: DocumentEstado
  clave_acceso: string
  numero_autorizacion: string | null
  motivo_rechazo: string | null
  paid_at: string | null
  payment_method: PaymentMethod | null
  payment_notes: string | null
  paid_by: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ElectronicDocumentWithPaidBy extends ElectronicDocument {
  paid_by_profile: { full_name: string | null } | null
}

export type OltDeviceStatus = 'online' | 'offline' | 'unreachable'
export type OltCardType = 'H901GPSF' | 'H901XGHD' | 'H901CSHF' | 'H901MPSC'
export type OltPortStatus = 'active' | 'inactive'
export type OltVlanModo = 'smart' | 'standard'
export type ServiceProfileTipo = 'VEIP' | 'ETH'

export interface OltDevice {
  id: string
  name: string
  host: string
  ssh_port: number
  ssh_user: string
  ssh_password: string
  model: string
  status: OltDeviceStatus
  firmware_version: string | null
  last_checked_at: string | null
  created_at: string
  updated_at: string
}

export interface OltCard {
  id: string
  olt_id: string
  slot: number
  card_type: OltCardType
  port_count: number
  status: OltPortStatus
  synced_at: string
}

export interface OltPonPort {
  id: string
  card_id: string
  frame: number
  port: number
  onu_count: number
  status: OltPortStatus
  synced_at: string
}

export interface OltPonPortWithCard extends OltPonPort {
  olt_cards: { slot: number; olt_id: string } | null
}

export interface OltUplinkPort {
  id: string
  olt_id: string
  port: string
  management_vlan: number | null
  management_ip: string | null
  status: OltPortStatus
  created_at: string
  updated_at: string
}

export interface OltVlan {
  id: string
  olt_id: string
  vlan_id: number
  name: string
  modo: OltVlanModo
  created_at: string
  updated_at: string
}

export interface SpeedProfile {
  id: string
  name: string
  cir_down_kbps: number
  pir_down_kbps: number
  cir_up_kbps: number
  pir_up_kbps: number
  created_at: string
  updated_at: string
}

export interface LineProfile {
  id: string
  name: string
  tcont: number
  gem_port_id: number
  vlan_id: number
  mapping: string
  speed_profile_id: string | null
  created_at: string
  updated_at: string
}

export interface ServiceProfile {
  id: string
  name: string
  tipo: ServiceProfileTipo
  puerto_ani: number
  created_at: string
  updated_at: string
}

export interface Tr069Profile {
  id: string
  name: string
  acs_url: string
  acs_user: string | null
  acs_password: string | null
  interval_seconds: number
  created_at: string
  updated_at: string
}

export interface OltBackup {
  id: string
  olt_id: string
  config_text: string
  created_by: string | null
  created_at: string
}

export type OnuWifiBands = 'none' | '2.4ghz' | '5ghz' | 'dual'
export type OnuStatus = 'pending' | 'active' | 'online' | 'offline'

export interface OltOnuType {
  id: string
  name: string
  manufacturer: string
  port_type: ServiceProfileTipo
  eth_ports: number
  wifi_bands: OnuWifiBands
  line_profile_id: string | null
  service_profile_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface OltOnu {
  id: string
  olt_id: string
  frame: number
  slot: number
  port: number
  ont_id: number
  serial_number: string
  onu_type_id: string | null
  line_profile_id: string | null
  service_profile_id: string | null
  vlan_id: number | null
  client_id: string | null
  contract_id: string | null
  status: OnuStatus
  signal_rx_dbm: number | null
  signal_checked_at: string | null
  activated_at: string | null
  created_at: string
  updated_at: string
}

export interface OltOnuWithDetails extends OltOnu {
  olt_onu_types: { name: string } | null
  clients: { first_name: string; last_name: string } | null
}

export interface OltIpPool {
  id: string
  name: string
  network: string
  gateway: string
  dns_primary: string
  dns_secondary: string | null
  range_start: string
  range_end: string
  vlan_id: number | null
  created_at: string
  updated_at: string
}

export type MikrotikDeviceStatus = 'online' | 'offline' | 'unreachable'
export type FirewallTableName = 'filter' | 'nat'
export type FirewallAction = 'accept' | 'drop' | 'reject' | 'masquerade' | 'log'
export type MikrotikBlockStatus = 'active' | 'blocked'

export interface MikrotikDevice {
  id: string
  name: string
  host: string
  api_port: number
  api_ssl: boolean
  api_user: string
  api_password: string
  model: string
  status: MikrotikDeviceStatus
  firmware_version: string | null
  last_checked_at: string | null
  created_at: string
  updated_at: string
}

export interface MikrotikIpPool {
  id: string
  mikrotik_id: string
  name: string
  ranges: string
  ppp_profile_name: string | null
  local_address: string | null
  dns_primary: string
  dns_secondary: string | null
  created_at: string
  updated_at: string
}

export interface MikrotikFirewallRule {
  id: string
  mikrotik_id: string
  table_name: FirewallTableName
  chain: string
  action: FirewallAction
  src_address: string | null
  dst_address: string | null
  protocol: string | null
  dst_port: string | null
  src_address_list: string | null
  out_interface: string | null
  comment: string | null
  position: number
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface MikrotikClientBlock {
  id: string
  mikrotik_id: string
  client_id: string
  ip_address: string | null
  pppoe_username: string | null
  reason: string | null
  status: MikrotikBlockStatus
  blocked_at: string | null
  unblocked_at: string | null
  created_at: string
  updated_at: string
}

export interface MikrotikClientBlockWithClient extends MikrotikClientBlock {
  clients: { first_name: string; last_name: string; identification: string } | null
}

export interface MikrotikIpv6Pool {
  id: string
  mikrotik_id: string
  name: string
  prefix: string
  prefix_length: number
  interface_name: string | null
  created_at: string
  updated_at: string
}

// Objeto real devuelto por el API NBI de GenieACS (no una tabla de Supabase):
// árbol TR-069 anidado que varía según el modelo de CPE, con metadatos
// prefijados con "_" en la raíz.
export interface GenieAcsDevice {
  _id: string
  _lastInform?: string
  _registered?: string
  _deviceId?: {
    _Manufacturer?: string
    _OUI?: string
    _ProductClass?: string
    _SerialNumber?: string
  }
  [key: string]: unknown
}
