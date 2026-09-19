import { fileURLToPath } from 'node:url'

import babel from '@rolldown/plugin-babel'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import wasm from 'vite-plugin-wasm'
import { defineConfig } from 'vitest/config'

/**
 * The path the app is served under, from `EXPLORER_BASE_PATH`: `/` at a domain root, `/explorer/`
 * on GitHub Pages. It starts and ends with a slash.
 */
function basePath(): string {
  const value = process.env.EXPLORER_BASE_PATH ?? '/'
  if (!value.startsWith('/') || !value.endsWith('/')) {
    throw new Error(`EXPLORER_BASE_PATH must start and end with "/", got "${value}"`)
  }
  return value
}

export default defineConfig({
  base: basePath(),
  plugins: [
    // The router plugin must run before the React plugin.
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    // @sig-net/midnight reaches the Midnight onchain-runtime WebAssembly module through the
    // Compact runtime, and the transaction inspection imports the ledger's.
    wasm(),
  ],
  optimizeDeps: {
    // The dependency optimizer cannot inline wasm-bindgen imports. Keeping these packages out of
    // the prebundle lets the wasm plugin serve their .wasm imports, while the rest of the SDK tree
    // (which includes CommonJS packages) is still optimized.
    exclude: ['@midnightntwrk/onchain-runtime-v4', '@midnightntwrk/ledger-v9'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    browser: {
      enabled: true,
      headless: true,
      // A fixed zone with a half-hour offset and no daylight saving, so tests of local-time
      // rendering pass on every machine and cannot pass by rendering UTC.
      provider: playwright({ contextOptions: { timezoneId: 'Asia/Kolkata' } }),
      instances: [{ browser: 'chromium' }],
    },
  },
})
