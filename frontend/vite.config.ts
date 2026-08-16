import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { registerApiMiddlewares } from './server/api.js'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Fase 7: /api/whatsapp/send y /api/portal/create-user necesitan
  // secretos de servidor (access_token de Meta, service_role de Supabase)
  // que nunca deben llegar al navegador — ver server/api.ts.
  const apiMiddlewarePlugin: Plugin = {
    name: 'fosmikro-api-middlewares',
    configureServer(server) {
      registerApiMiddlewares(server, env)
    },
  }

  return {
    plugins: [vue(), tailwindcss(), apiMiddlewarePlugin],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      proxy: {
        // El API NBI de GenieACS no manda cabeceras CORS, así que el
        // navegador bloquea las llamadas directas — se proxea por acá.
        '/genieacs-api': {
          target: env.GENIEACS_NBI_URL || 'http://localhost:7557',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/genieacs-api/, ''),
        },
      },
    },
  }
})
