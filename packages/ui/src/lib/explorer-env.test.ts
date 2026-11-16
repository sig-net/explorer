import { expect, test } from 'vitest'

import { EXPLORER_ENV, parseRuntimeExplorerEnv } from './explorer-env'

test('the runtime env keeps string values under known keys and nothing else', () => {
  expect(
    parseRuntimeExplorerEnv({
      VITE_MIDNIGHT_DEFAULT_NETWORK: 'undeployed',
      VITE_MIDNIGHT_PREPROD_MPC_OUTPUT_CACHE_URL: 'https://cache.example/v1/',
      VITE_MIDNIGHT_PREPROD_MPC_ROOT_PUBLIC_KEY: 42,
      VITE_EXPLORER_API_URL: 'https://explorer.example/api',
      VITE_EXPLORER_VERSION: 'not-runtime',
      VITE_SOMETHING_ELSE: 'ignored',
      BASE_URL: '/elsewhere/',
    }),
  ).toEqual({
    VITE_MIDNIGHT_DEFAULT_NETWORK: 'undeployed',
    VITE_MIDNIGHT_PREPROD_MPC_OUTPUT_CACHE_URL: 'https://cache.example/v1/',
    VITE_EXPLORER_API_URL: 'https://explorer.example/api',
  })
})

test('anything but an object sets no variable', () => {
  expect(parseRuntimeExplorerEnv(undefined)).toEqual({})
  expect(parseRuntimeExplorerEnv(null)).toEqual({})
  expect(parseRuntimeExplorerEnv('VITE_MIDNIGHT_DEFAULT_NETWORK=undeployed')).toEqual({})
  expect(parseRuntimeExplorerEnv(['VITE_MIDNIGHT_DEFAULT_NETWORK'])).toEqual({})
})

test('the build env stands where env.js sets nothing', () => {
  expect(EXPLORER_ENV.VITE_MIDNIGHT_DEFAULT_NETWORK).toBe(
    import.meta.env.VITE_MIDNIGHT_DEFAULT_NETWORK,
  )
})
