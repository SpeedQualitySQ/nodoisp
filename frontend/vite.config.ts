import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [vue(), tailwindcss()],
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
