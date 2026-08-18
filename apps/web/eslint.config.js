import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // `dev-dist` es el service worker que genera vite-plugin-pwa al
  // levantar el server. Es codigo generado y minificado: lintearlo
  // sepultaba los errores reales bajo los suyos.
  globalIgnores(['dist', 'dev-dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // `@shared` aliasea a supabase/functions/_shared (ver vite.config.js).
      // Todo lo que vive bajo `_shared/deno/` importa `npm:pdf-lib` u otro
      // paquete que solo Deno sabe resolver: si el navegador lo importa,
      // Vite intenta resolver el especificador `npm:...` y el build revienta.
      // Lo que haga falta del lado del navegador va en @shared/comprobante-modelo.js.
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['@shared/deno/*'],
          message: 'Ese modulo importa npm:pdf-lib u otro paquete de Deno y '
            + 'solo corre en las Edge Functions. Lo que necesites de ahi va '
            + 'en @shared/comprobante-modelo.js.',
        }],
      }],
    },
  },
])
