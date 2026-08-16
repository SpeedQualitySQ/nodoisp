#!/usr/bin/env node
/**
 * Fase 7 — aviso automático de facturas vencidas por WhatsApp.
 *
 * Corre UNA VEZ (pensado para lanzarse a diario vía PM2/cron, ver el
 * ejemplo al final del archivo) y:
 *   1. Lee whatsapp_config — si notify_venc_enabled es false, no hace nada.
 *   2. Busca facturas AUTORIZADO sin pagar (paid_at is null) cuyos días
 *      desde fecha_emision alcancen venc_dias_1/2/3.
 *      No hay una columna de "fecha de vencimiento" explícita en
 *      electronic_documents — se usa fecha_emision como referencia, que es
 *      lo que describe la Fase 7. Si el negocio maneja un vencimiento
 *      distinto (p.ej. billing_day del contrato), ajustar el cálculo acá.
 *   3. Por cada factura+nivel que corresponda, si no se envió antes
 *      (vencimiento_notifications, índice único document_id+nivel), manda
 *      el WhatsApp y registra el envío.
 *
 * Requiere el service_role key porque corre fuera del navegador, sin
 * sesión de usuario — igual razón por la que existe server/api.ts.
 *
 * NO se deja corriendo con PM2 en este servidor todavía: no hay
 * credenciales reales de Meta configuradas, así que no serviría de nada
 * (todo intento de envío fallaría). Activar cuando /configuracion/whatsapp
 * tenga un access_token real.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Faltan VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

function normalizePhone(raw) {
  const d = String(raw ?? '').replace(/[^0-9]/g, '')
  if (d.startsWith('09') && d.length === 10) return '593' + d.slice(1)
  if (d.startsWith('593') && d.length === 12) return d
  return null
}

async function sendWhatsApp(config, to, message) {
  const res = await fetch(`https://graph.facebook.com/v21.0/${config.phone_number_id}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: message } }),
  })
  if (!res.ok) throw new Error(`Meta respondió ${res.status}: ${await res.text()}`)
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

async function run() {
  const { data: config, error: configError } = await supabase.from('whatsapp_config').select('*').single()
  if (configError || !config) {
    console.error('No se pudo leer whatsapp_config:', configError?.message)
    process.exit(1)
  }
  if (!config.enabled || !config.notify_venc_enabled) {
    console.log('Notificaciones de vencimiento deshabilitadas — nada que hacer.')
    return
  }
  if (!config.phone_number_id || !config.access_token) {
    console.log('Falta phone_number_id/access_token en whatsapp_config — nada que hacer.')
    return
  }

  const { data: facturas, error: facturasError } = await supabase
    .from('electronic_documents')
    .select('id, fecha_emision, importe_total, client_id, clients(first_name, last_name, mobile)')
    .eq('tipo_comprobante', '01')
    .eq('estado', 'AUTORIZADO')
    .is('paid_at', null)
  if (facturasError) {
    console.error('No se pudieron leer las facturas:', facturasError.message)
    process.exit(1)
  }

  const niveles = [
    [1, config.venc_dias_1],
    [2, config.venc_dias_2],
    [3, config.venc_dias_3],
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
        await sendWhatsApp(config, phone, NIVEL_MENSAJE[nivel](dias))
        await supabase.from('vencimiento_notifications').insert({ document_id: factura.id, nivel })
        console.log(`Nivel ${nivel} enviado — factura ${factura.id} (${dias} días de mora)`)
      } catch (e) {
        console.error(`Error enviando nivel ${nivel} para factura ${factura.id}:`, e.message)
      }
    }
  }
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})

// ---------------------------------------------------------------------------
// Para correrlo a diario con PM2 (cuando haya credenciales reales de Meta):
//
//   pm2 start scripts/vencimiento-monitor.mjs --name fosmikro-monitor \
//     --cron "0 8 * * *" --no-autorestart
//
// ---------------------------------------------------------------------------
