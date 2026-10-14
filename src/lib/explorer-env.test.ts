import { expect, test } from 'vitest'

import { EXPLORER_ENV, parseRuntimeExplorerEnv } from './explorer-env'

test('the runtime env keeps string values under known keys and nothing else', () => {
  expect(
    parseRuntimeExplorerEnv({
      VITE_MIDNIGHT_DEFAULT_NETWORK: 'undeployed',
      VITE_MIDNIGHT_STAGENET_SIGNET_EVENTS_FROM_BLOCK: '874309',
      VITE_MIDNIGHT_STAGENET_MPC_ROOT_PUBLIC_KEY: 42,
      VITE_SOMETHING_ELSE: 'ignored',
      BASE_URL: '/elsewhere/',
    }),
  ).toEqual({
    VITE_MIDNIGHT_DEFAULT_NETWORK: 'undeployed',
    VITE_MIDNIGHT_STAGENET_SIGNET_EVENTS_FROM_BLOCK: '874309',
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
