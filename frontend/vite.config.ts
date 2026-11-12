import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'url'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const envDir = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
  const env = loadEnv(mode, envDir, '')
  const port = Number(env.FRONTEND_PORT || process.env.FRONTEND_PORT || 5173)

  // Automatically fall back to BACKEND_PORT if VITE_API_BASE_URL is not explicitly set
  const backendPort = env.BACKEND_PORT || process.env.BACKEND_PORT || '8080'
  const apiBaseUrl = env.VITE_API_BASE_URL || process.env.VITE_API_BASE_URL || `http://localhost:${backendPort}`

  return {
    envDir,
    define: {
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(apiBaseUrl),
    },
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    server: {
      port,
      host: true,
      watch: {
        // File events don't propagate through Docker bind mounts on Windows/macOS
        usePolling: process.env.VITE_USE_POLLING === 'true',
      },
    },
  }
})
