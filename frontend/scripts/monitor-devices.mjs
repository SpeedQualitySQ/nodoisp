#!/usr/bin/env node
/**
 * Fase 8 — monitor continuo de OLTs/MikroTik + avisos de vencimiento,
 * pensado para correr siempre activo vía PM2 (ver el ejemplo de
 * ecosystem.config.cjs al final del archivo).
 *
 * Cada ciclo (whatsapp_config.check_interval minutos):
 *   1. Hace un TCP check al puerto de gestión de cada OLT (ssh_port) y
 *      MikroTik (api_port) registrado — igual razón que da la Fase 8: TCP
 *      es más preciso que ping porque confirma que el servicio de gestión
 *      realmente responde, y no requiere permisos de root que sí pide ICMP.
 *   2. Actualiza status/last_checked_at en la tabla del dispositivo (mismo
 *      efecto que el botón "Probar conexión" de las pantallas de OLT/
 *      MikroTik, pero automático) — esto pasa siempre, esté o no habilitado
 *      WhatsApp, porque el estado en la UI es útil igual.
 *   3. Si un dispositivo lleva FAIL_THRESHOLD chequeos seguidos sin
 *      responder, o si se recupera después de haber estado caído, y
 *      WhatsApp está habilitado con teléfonos de técnicos configurados,
 *      manda la alerta correspondiente.
 *   4. Una vez al día (si notify_venc_enabled) revisa facturas vencidas —
 *      misma lógica que scripts/vencimiento-monitor.mjs (Fase 7); ese
 *      script sigue sirviendo como alternativa más liviana si se prefiere
 *      un cron diario en vez de un proceso siempre activo.
 *
 * Requiere el service_role key porque no hay sesión de usuario (corre
 * fuera del navegador) — misma razón que server/api.ts y
 * vencimiento-monitor.mjs.
 */

import net from 'node:net'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('[monitor] Faltan VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const FAIL_THRESHOLD = 2
// deviceKey ("tabla:id") -> { failCount, lastKnownUp }
const deviceState = new Map()
let lastVencCheck = null

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function tcpCheck(host, port, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const sock = new net.Socket()
    sock.setTimeout(timeoutMs)
    sock.on('connect', () => {
      sock.destroy()
      resolve(true)
    })
    sock.on('timeout', () => {
      sock.destroy()
      resolve(false)
    })
    sock.on('error', () => {
      sock.destroy()
      resolve(false)
    })
    sock.connect(port, host)
  })
}

function normalizePhone(raw) {
  const d = String(raw ?? '').replace(/[^0-9]/g, '')
  if (d.startsWith('09') && d.length === 10) return '593' + d.slice(1)
  if (d.startsWith('593') && d.length === 12) return d
  return null
}

async function sendWhatsApp(cfg, to, message) {
  const res = await fetch(`https://graph.facebook.com/v21.0/${cfg.phone_number_id}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: message } }),
  })
  if (!res.ok) throw new Error(`Meta respondió ${res.status}: ${await res.text()}`)
}

async function alertaTecnicos(cfg, message) {
  const phones = (cfg.technician_phones ?? '')
    .split(',')
    .map((p) => normalizePhone(p.trim()))
    .filter((p) => p != null)
  for (const phone of phones) {
    try {
      await sendWhatsApp(cfg, phone, message)
      console.log(`[monitor] WhatsApp enviado a ${phone}`)
    } catch (e) {
      console.error(`[monitor] No se pudo enviar WhatsApp a ${phone}:`, e.message)
    }
  }
}

async function checkDevice(cfg, table, device, kind, port) {
  const key = `${table}:${device.id}`
  const online = await tcpCheck(device.host, port)
  const state = deviceState.get(key) ?? { failCount: 0, lastKnownUp: true }

  await supabase
    .from(table)
    .update({ status: online ? 'online' : 'unreachable', last_checked_at: new Date().toISOString() })
    .eq('id', device.id)

  if (online) {
    if (!state.lastKnownUp && state.failCount >= FAIL_THRESHOLD) {
      console.log(`[monitor] ⬆ RECUPERADO: ${device.name} (${device.host}:${port})`)
      if (cfg.enabled) {
        await alertaTecnicos(
          cfg,
          `✅ *RECUPERADO NodoISP*\n\nEl equipo *${device.name}* (${kind}) en \`${device.host}\` está en línea nuevamente.`,
        )
      }
    }
    state.failCount = 0
    state.lastKnownUp = true
  } else {
    state.failCount += 1
    if (state.failCount === FAIL_THRESHOLD) {
      console.log(`[monitor] ⬇ CAÍDO: ${device.name} (${device.host}:${port})`)
      if (cfg.enabled) {
        await alertaTecnicos(
          cfg,
          `⚠️ *ALERTA NodoISP*\n\nEl equipo *${device.name}* (${kind}) en \`${device.host}\` no responde.\n\nVerificar conexión o energía del equipo.`,
        )
      }
      state.lastKnownUp = false
    }
  }
  deviceState.set(key, state)
}

async function checkAll(cfg) {
  const [{ data: olts, error: oltsError }, { data: mikrotiks, error: mtError }] = await Promise.all([
    supabase.from('olt_devices').select('id, name, host, ssh_port'),
    supabase.from('mikrotik_devices').select('id, name, host, api_port'),
  ])
  if (oltsError) console.error('[monitor] Error leyendo olt_devices:', oltsError.message)
  if (mtError) console.error('[monitor] Error leyendo mikrotik_devices:', mtError.message)

  for (const o of olts ?? []) await checkDevice(cfg, 'olt_devices', o, 'OLT', o.ssh_port)
  for (const m of mikrotiks ?? []) await checkDevice(cfg, 'mikrotik_devices', m, 'MikroTik', m.api_port)
}

function diasDeMora(fechaEmision) {
  const emitida = new Date(fechaEmision)
  const hoy = new Date()
  return Math.floor((hoy.getTime() - emitida.getTime()) / (1000 * 60 * 60 * 24))
}

const NIVEL_MENSAJE = {
  1: (dias) => `👋 Hola, te recordamos que tenés una factura pendiente de pago hace ${dias} días. Por favor regulariza tu pago para evitar inconvenientes. _NodoISP_`,
  2: (dias) => `⚠️ Tu factura sigue pendiente hace ${dias} días. Si no se regulariza pronto, el servicio podría suspenderse. _NodoISP_`,
  3: (dias) => `🚫 Tu factura tiene ${dias} días de mora. El servicio será suspendido en breve si no se regulariza el pago. _NodoISP_`,
}

async function checkVencimientos(cfg) {
  const { data: facturas, error } = await supabase
    .from('electronic_documents')
    .select('id, fecha_emision, client_id, clients(mobile)')
    .eq('tipo_comprobante', '01')
    .eq('estado', 'AUTORIZADO')
    .is('paid_at', null)
  if (error) {
    console.error('[monitor] Error leyendo facturas:', error.message)
    return
  }

  console.log(`[monitor] ${facturas?.length ?? 0} facturas pendientes a revisar`)
  const niveles = [
    [1, cfg.venc_dias_1],
    [2, cfg.venc_dias_2],
    [3, cfg.venc_dias_3],
  ]

  for (const factura of facturas ?? []) {
    const dias = diasDeMora(factura.fecha_emision)
    const phone = normalizePhone(factura.clients?.mobile)
    if (!phone) continue

    for (const [nivel, diasConfigurados] of niveles) {
      if (dias < diasConfigurados) continue
      const { data: yaEnviado } = await supabase
        .from('vencimiento_notifications')
        .select('id')
        .eq('document_id', factura.id)
        .eq('nivel', nivel)
        .maybeSingle()
      if (yaEnviado) continue

      try {
        await sendWhatsApp(cfg, phone, NIVEL_MENSAJE[nivel](dias))
        await supabase.from('vencimiento_notifications').insert({ document_id: factura.id, nivel })
        console.log(`[monitor] Vencimiento nivel ${nivel} enviado a ${phone} — factura ${factura.id} (${dias} días mora)`)
      } catch (e) {
        console.error(`[monitor] Error enviando vencimiento nivel ${nivel} para factura ${factura.id}:`, e.message)
      }
    }
  }
}

async function main() {
  console.log('[monitor] Iniciando monitor de dispositivos ISP...')
  for (;;) {
    const { data: cfg, error } = await supabase.from('whatsapp_config').select('*').single()
    if (error || !cfg) {
      console.error('[monitor] No se pudo leer whatsapp_config, reintentando en 1 minuto:', error?.message)
      await sleep(60_000)
      continue
    }

    await checkAll(cfg)

    if (cfg.notify_venc_enabled && cfg.phone_number_id && cfg.access_token) {
      const hoy = new Date().toISOString().slice(0, 10)
      if (lastVencCheck !== hoy) {
        console.log('[monitor] Verificando vencimientos de facturas...')
        await checkVencimientos(cfg)
        lastVencCheck = hoy
      }
    }

    const minutos = Math.max(1, cfg.check_interval ?? 5)
    console.log(`[monitor] Próximo chequeo en ${minutos} minutos`)
    await sleep(minutos * 60_000)
  }
}

main().catch((e) => {
  console.error('[monitor] Error fatal:', e)
  process.exit(1)
})

// ---------------------------------------------------------------------------
// Cómo se dejó corriendo en este servidor (PM2 no hereda el entorno de la
// shell — hace falta --env-file explícito, Node 20.6+ lo soporta nativo,
// sin agregar la dependencia "dotenv" que menciona la Fase 8):
//
//   pm2 start scripts/monitor-devices.mjs --name nodoisp-monitor \
//     --cwd /opt/taller1/frontend --node-args="--env-file=.env"
//   pm2 save
//   pm2 startup   # deja el daemon de PM2 arrancando solo si el server reinicia
//
// Comandos útiles: `pm2 logs nodoisp-monitor`, `pm2 restart nodoisp-monitor`,
// `pm2 list`.
// ---------------------------------------------------------------------------
