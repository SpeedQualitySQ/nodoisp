import { supabase } from '@/lib/supabase'
import type { OltCardType, OltDevice } from '@/types/database'

/**
 * Simula la conexión SSH real al equipo (ssh2 + parseo de `display ...`):
 * prueba de conexión, sincronización de tarjetas/puertos y backup de
 * configuración. No hay infraestructura de backend en este repo para abrir
 * sesiones SSH reales (sin supabase/functions ni dependencia ssh2), así que
 * aquí solo se simula la latencia de red y la respuesta del equipo. El punto
 * de integración real queda marcado para una fase posterior, igual que la
 * firma/envío al SRI en src/lib/sri.ts.
 */

const CARD_LAYOUTS: Record<string, { slot: number; card_type: OltCardType; ports: number }[]> = {
  default: [
    { slot: 0, card_type: 'H901GPSF', ports: 16 },
    { slot: 1, card_type: 'H901GPSF', ports: 16 },
    { slot: 7, card_type: 'H901CSHF', ports: 0 },
    { slot: 8, card_type: 'H901MPSC', ports: 0 },
  ],
}

function firmwareParaModelo(model: string) {
  return model.startsWith('V') ? 'V500R023C00SPC100' : 'V800R021C10SPC200'
}

export async function probarConexion(device: OltDevice) {
  await new Promise((resolve) => setTimeout(resolve, 700))

  const { error } = await supabase
    .from('olt_devices')
    .update({
      status: 'online',
      last_checked_at: new Date().toISOString(),
      firmware_version: firmwareParaModelo(device.model),
    })
    .eq('id', device.id)
  if (error) throw error
}

export async function sincronizarTarjetas(oltId: string) {
  await new Promise((resolve) => setTimeout(resolve, 900))

  const { error: deleteError } = await supabase.from('olt_cards').delete().eq('olt_id', oltId)
  if (deleteError) throw deleteError

  const layout = CARD_LAYOUTS.default
  const { data: cards, error: insertError } = await supabase
    .from('olt_cards')
    .insert(
      layout.map((c) => ({
        olt_id: oltId,
        slot: c.slot,
        card_type: c.card_type,
        port_count: c.ports,
      })),
    )
    .select('id, slot, card_type')
  if (insertError) throw insertError

  const ponCards = (cards ?? []).filter((c) => c.card_type === 'H901GPSF')
  const portRows = ponCards.flatMap((card) =>
    Array.from({ length: 16 }, (_, i) => ({
      card_id: card.id,
      frame: 0,
      port: i,
      onu_count: Math.floor(Math.random() * 40),
    })),
  )
  if (portRows.length) {
    const { error: portsError } = await supabase.from('olt_pon_ports').insert(portRows)
    if (portsError) throw portsError
  }
}

export function generarComandoVlan(vlanId: number, nombre: string, modo: string) {
  return `vlan ${vlanId} ${modo}\nvlan desc ${vlanId} description ${nombre}`
}

export async function ejecutarBackup(device: OltDevice, userId: string | undefined) {
  await new Promise((resolve) => setTimeout(resolve, 1000))

  const configText =
    `#\nsysname ${device.name}\n#\n` +
    `display saved-configuration — ${new Date().toISOString()}\n` +
    `#\ninterface GigabitEthernet0/9/0\n port desc uplink-core\n#\n` +
    `ssh user ${device.ssh_user} authentication-type password\nssh user ${device.ssh_user} service-type ssh\n#\nreturn\n`

  const { error } = await supabase
    .from('olt_backups')
    .insert({ olt_id: device.id, config_text: configText, created_by: userId ?? null })
  if (error) throw error
}
