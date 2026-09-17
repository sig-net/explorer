import { fileURLToPath } from 'node:url'

import babel from '@rolldown/plugin-babel'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import wasm from 'vite-plugin-wasm'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    // The router plugin must run before the React plugin.
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    // @sig-net/midnight reaches the Midnight onchain-runtime WebAssembly module through the
    // Compact runtime.
    wasm(),
  ],
  optimizeDeps: {
    // The dependency optimizer cannot inline wasm-bindgen imports. Keeping this package out of the
    // prebundle lets the wasm plugin serve its .wasm import, while the rest of the SDK tree (which
    // includes CommonJS packages) is still optimized.
    exclude: ['@midnightntwrk/onchain-runtime-v4'],
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
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
})
