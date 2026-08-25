import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'autoUpdate': el service worker nuevo se activa solo en segundo
      // plano apenas esta listo. No interrumpe a nadie a mitad de un
      // presupuesto: la pestaña sigue con el codigo viejo hasta que
      // alguien navega o recarga. ActualizacionPwa.jsx escucha el evento
      // y avisa con un banner en vez de forzar nada.
      registerType: 'autoUpdate',
      includeAssets: ['favicon-16.png', 'favicon-32.png', 'apple-touch-icon.png'],
      // Sin esto el service worker no se registra en `npm run dev`, y
      // "instalar como app" no se puede probar hasta el primer deploy.
      // Solo sirve para probar en localhost: Android exige HTTPS de
      // verdad para instalar desde el celular por la red local.
      devOptions: { enabled: true, type: 'module' },
      manifest: {
        name: 'Bobinados David',
        short_name: 'Bobinados',
        description: 'Fichas de motores, clientes y presupuestos del taller.',
        lang: 'es-AR',
        start_url: '/',
        display: 'standalone',
        // Mismo azul que --accent en index.css: la barra de estado de
        // Android y la pantalla de carga usan este color, y si no
        // coincide con el resto de la app se nota el salto al abrir.
        theme_color: '#2c5f8f',
        background_color: '#0f2a42',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Solo el shell de la app (JS/CSS/HTML/iconos) se precachea. Los
        // pedidos a Supabase (datos, fotos, PDFs) no entran en ningun
        // glob de aca, asi que siguen yendo a la red siempre: una ficha
        // vieja en cache mostrandose como si fuera la actual seria peor
        // que no tener offline en absoluto.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // El shell responde para cualquier ruta (react-router maneja el
        // resto en el cliente). Sin esto, entrar directo a /sistema/motores
        // con la app instalada y sin señal da un error de red en vez de
        // la pantalla de "sin conexion" propia de la SPA.
        navigateFallback: '/index.html',
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        /*
         * Las bibliotecas van en su propio archivo.
         *
         * React, el router y el cliente de Supabase no cambian cuando
         * cambia el taller: separandolos, un deploy que toca una
         * pantalla invalida solo esa pantalla y no obliga a bajar de
         * nuevo 200 KB que el celular ya tenia en cache.
         */
        manualChunks: {
          react: ['react', 'react-dom', 'react-dom/client', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },

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
