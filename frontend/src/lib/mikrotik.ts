import { supabase } from '@/lib/supabase'
import type {
  MikrotikClientBlock,
  MikrotikDevice,
  MikrotikFirewallRule,
  MikrotikIpPool,
  MikrotikIpv6Pool,
} from '@/types/database'

/**
 * Simula la API de RouterOS (librería `routeros-client` o llamadas REST al
 * puerto 8728/8729): prueba de conexión, bloqueo/desbloqueo de clientes.
 * No hay infraestructura de backend en este repo para abrir esa conexión
 * real, así que aquí solo se simula la latencia de red y la respuesta del
 * equipo, igual que la conexión SSH a la OLT en src/lib/olt.ts.
 */

function firmwareRouterOs() {
  const versions = ['7.15.3', '7.16.1', '7.14.2', '7.17']
  return versions[Math.floor(Math.random() * versions.length)]
}

export async function probarConexionMikrotik(device: MikrotikDevice) {
  await new Promise((resolve) => setTimeout(resolve, 700))

  const { error } = await supabase
    .from('mikrotik_devices')
    .update({
      status: 'online',
      last_checked_at: new Date().toISOString(),
      firmware_version: firmwareRouterOs(),
    })
    .eq('id', device.id)
  if (error) throw error
}

export function generarComandoIpPool(pool: MikrotikIpPool) {
  let cmd = `/ip pool\nadd name=${pool.name} ranges=${pool.ranges}`
  if (pool.ppp_profile_name) {
    const dns = [pool.dns_primary, pool.dns_secondary].filter(Boolean).join(',')
    cmd +=
      `\n\n/ppp profile\n` +
      `add name=${pool.ppp_profile_name} local-address=${pool.local_address ?? '0.0.0.0'} ` +
      `remote-address=${pool.name} dns-server=${dns}`
  }
  return cmd
}

export function generarComandoFirewallRule(rule: MikrotikFirewallRule) {
  const base = rule.table_name === 'nat' ? '/ip firewall nat' : '/ip firewall filter'
  const parts = [`add chain=${rule.chain}`]
  if (rule.src_address) parts.push(`src-address=${rule.src_address}`)
  if (rule.dst_address) parts.push(`dst-address=${rule.dst_address}`)
  if (rule.protocol) parts.push(`protocol=${rule.protocol}`)
  if (rule.dst_port) parts.push(`dst-port=${rule.dst_port}`)
  if (rule.src_address_list) parts.push(`src-address-list=${rule.src_address_list}`)
  if (rule.out_interface) parts.push(`out-interface=${rule.out_interface}`)
  parts.push(`action=${rule.action}`)
  if (rule.comment) parts.push(`comment="${rule.comment}"`)
  return `${base}\n${parts.join(' ')}`
}

export function generarComandoBloqueo(block: MikrotikClientBlock) {
  const lines: string[] = []
  if (block.ip_address) {
    lines.push(
      `/ip firewall address-list add list=bloqueados address=${block.ip_address}` +
        (block.reason ? ` comment="${block.reason}"` : ''),
    )
  }
  if (block.pppoe_username) {
    lines.push(`/ppp secret disable [find name="${block.pppoe_username}"]`)
    lines.push(`/ppp active remove [find user="${block.pppoe_username}"]`)
  }
  return lines.join('\n')
}

export function generarComandoDesbloqueo(block: MikrotikClientBlock) {
  const lines: string[] = []
  if (block.ip_address) {
    lines.push(`/ip firewall address-list remove [find list=bloqueados address=${block.ip_address}]`)
  }
  if (block.pppoe_username) {
    lines.push(`/ppp secret enable [find name="${block.pppoe_username}"]`)
  }
  return lines.join('\n')
}

export async function bloquearCliente(block: MikrotikClientBlock) {
  await new Promise((resolve) => setTimeout(resolve, 800))

  const { error } = await supabase
    .from('mikrotik_client_blocks')
    .update({ status: 'blocked', blocked_at: new Date().toISOString(), unblocked_at: null })
    .eq('id', block.id)
  if (error) throw error
}

export async function desbloquearCliente(block: MikrotikClientBlock) {
  await new Promise((resolve) => setTimeout(resolve, 800))

  const { error } = await supabase
    .from('mikrotik_client_blocks')
    .update({ status: 'active', unblocked_at: new Date().toISOString() })
    .eq('id', block.id)
  if (error) throw error
}

export function generarComandoIpv6Pool(pool: MikrotikIpv6Pool) {
  let cmd = `/ipv6 pool\nadd name=${pool.name} prefix=${pool.prefix} prefix-length=${pool.prefix_length}`
  if (pool.interface_name) {
    cmd +=
      `\n\n/ipv6 dhcp-server\n` +
      `add name=dhcpv6-${pool.name} interface=${pool.interface_name} address-pool=${pool.name}`
  }
  return cmd
}
