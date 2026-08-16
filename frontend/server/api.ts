import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ViteDevServer } from 'vite'
import { createClient } from '@supabase/supabase-js'

/**
 * Dos operaciones que no pueden hacerse desde el navegador porque necesitan
 * un secreto de servidor:
 *  - Enviar WhatsApp: el access_token de Meta no debe viajar al bundle del
 *    frontend, y el Graph API de Meta no tiene CORS (mismo problema que el
 *    NBI de GenieACS en la Fase 6, ver /genieacs-api en vite.config.ts).
 *  - Crear un usuario de portal: requiere el service_role key de Supabase
 *    (auth.admin.*), que rompe toda la seguridad de RLS si llega al
 *    navegador.
 * Se registran como middlewares del servidor de Vite en dev — ver el uso de
 * registerApiMiddlewares() en vite.config.ts.
 */

function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => (data += chunk))
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {})
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

export function registerApiMiddlewares(server: ViteDevServer, env: Record<string, string>) {
  const supabaseUrl = env.VITE_SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

  server.middlewares.use('/api/whatsapp/send', async (req, res) => {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })
    if (!supabaseUrl || !serviceRoleKey) {
      return sendJson(res, 500, { error: 'Faltan VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el .env del servidor' })
    }
    try {
      const { to, message } = (await readJsonBody(req)) as { to?: string; message?: string }
      if (!to || !message) return sendJson(res, 400, { error: 'Faltan los campos to/message' })

      const admin = createClient(supabaseUrl, serviceRoleKey)
      const { data: config, error } = await admin.from('whatsapp_config').select('*').single()
      if (error || !config) return sendJson(res, 500, { error: 'No se pudo leer whatsapp_config' })
      if (!config.enabled) return sendJson(res, 400, { error: 'WhatsApp está deshabilitado en la configuración' })
      if (!config.phone_number_id || !config.access_token) {
        return sendJson(res, 400, { error: 'Falta configurar phone_number_id / access_token en /configuracion/whatsapp' })
      }

      const metaRes = await fetch(`https://graph.facebook.com/v21.0/${config.phone_number_id}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: message } }),
      })
      const metaBody = await metaRes.json().catch(() => ({}))
      if (!metaRes.ok) return sendJson(res, metaRes.status, { error: 'Meta rechazó el mensaje', detail: metaBody })
      return sendJson(res, 200, metaBody)
    } catch (e) {
      return sendJson(res, 500, { error: e instanceof Error ? e.message : 'Error desconocido' })
    }
  })

  server.middlewares.use('/api/portal/create-user', async (req, res) => {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })
    if (!supabaseUrl || !serviceRoleKey) {
      return sendJson(res, 500, { error: 'Faltan VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el .env del servidor' })
    }
    try {
      const { email, client_id } = (await readJsonBody(req)) as { email?: string; client_id?: string }
      if (!email || !client_id) return sendJson(res, 400, { error: 'Faltan los campos email/client_id' })

      const admin = createClient(supabaseUrl, serviceRoleKey)
      // Manda el correo de invitación (el cliente define su propia
      // contraseña al abrirlo). El trigger on_auth_user_created ya crea la
      // fila en profiles con role='staff' por defecto — acá se corrige.
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email)
      if (error) return sendJson(res, 400, { error: error.message })

      const userId = data.user.id
      const { error: profileError } = await admin
        .from('profiles')
        .update({ role: 'cliente_portal', client_id })
        .eq('id', userId)
      if (profileError) return sendJson(res, 500, { error: profileError.message })

      return sendJson(res, 200, { id: userId, email })
    } catch (e) {
      return sendJson(res, 500, { error: e instanceof Error ? e.message : 'Error desconocido' })
    }
  })
}
