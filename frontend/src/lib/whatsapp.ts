/**
 * Envío de WhatsApp vía el middleware de servidor en /api/whatsapp/send
 * (ver server/api.ts) — el navegador no puede llamar al Graph API de Meta
 * directo (sin CORS) ni debería tener el access_token en su bundle.
 */

export async function sendWhatsApp(to: string, message: string) {
  const res = await fetch('/api/whatsapp/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, message }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || `Error ${res.status} al enviar WhatsApp`)
  return body
}

/** `09XXXXXXXX` (Ecuador) → `593XXXXXXXXX` (E.164 sin el `+`). Null si no matchea el formato esperado. */
export function normalizePhone(raw: string): string | null {
  const d = raw.replace(/[^0-9]/g, '')
  if (d.startsWith('09') && d.length === 10) return '593' + d.slice(1)
  if (d.startsWith('593') && d.length === 12) return d
  return null
}

export function ticketCreatedMessage(clientName: string, ticketNumber: string, title: string) {
  return (
    `🎫 Hola *${clientName}*, tu solicitud de soporte *#${ticketNumber}* ` +
    `ha sido registrada exitosamente.\n` +
    `Título: "${title}"\n` +
    `Nuestro equipo se contactará a la brevedad.\n` +
    `_NodoISP_`
  )
}

export function ticketReplyMessage(clientName: string, ticketNumber: string, replyBody: string) {
  return (
    `💬 *${clientName}*, hay una nueva respuesta en tu ticket *#${ticketNumber}*:\n` +
    `"${replyBody}"\n` +
    `_NodoISP_`
  )
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Abierto',
  in_progress: 'En progreso',
  waiting_client: 'Esperando tu respuesta',
  resolved: 'Resuelto',
  closed: 'Cerrado',
}

export function ticketStatusMessage(ticketNumber: string, status: string) {
  const label = STATUS_LABEL[status] ?? status
  return `✅ Tu ticket *#${ticketNumber}* ha sido marcado como *${label}*.\nGracias por contactarnos. _NodoISP_`
}
