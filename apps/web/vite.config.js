import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // La logica de parseo (coma decimal, "150.150" = dos valores, hilos
      // "2x") la comparten la web, el worker de extraccion y el bot.
      // Se importa desde una sola fuente en vez de copiarse: dos copias de
      // estas reglas divergiendo silenciosamente serian un desastre.
      '@shared': fileURLToPath(new URL('../../supabase/functions/_shared', import.meta.url)),
    },
  },
  server: {
    host: true, // Expone el servidor en la red local
    port: 5173,
    fs: {
      // Permite servir el codigo compartido, que vive fuera de apps/web.
      allow: ['..', '../../supabase/functions/_shared'],
    },
  },
})
