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
