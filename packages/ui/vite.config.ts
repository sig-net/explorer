import { execFileSync } from 'node:child_process'
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

/**
 * The version the footer shows. A release build takes it from `EXPLORER_VERSION`, which the
 * deploy workflow sets to the release tag. Any other build describes its checkout as
 * `<latest release tag>-<short commit>`, with `vX.X.X` standing in for a tag or a checkout git
 * cannot describe.
 */
function explorerVersion(): string {
  if (process.env.EXPLORER_VERSION) return process.env.EXPLORER_VERSION
  const git = (...args: string[]): string | undefined => {
    try {
      return execFileSync('git', args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim()
    } catch {
      return undefined
    }
  }
  const tag =
    git('describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*', '--exclude', '*-*') ?? 'vX.X.X'
  const commit = git('rev-parse', '--short', 'HEAD')
  return commit === undefined ? tag : `${tag}-${commit}`
}

export default defineConfig({
  base: basePath(),
  define: {
    'import.meta.env.VITE_EXPLORER_VERSION': JSON.stringify(explorerVersion()),
  },
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
