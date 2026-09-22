import { parseRequestIdHex } from '@sig-net/midnight'
import { afterEach, expect, test, vi } from 'vitest'

import { loadMpcCachedOutput } from './mpc-output-cache'

const LOCATION = {
  cacheUrl: 'https://cache.example/v1/stagenet/',
  networkId: 'stagenet',
  signetContractAddress: 'ab'.repeat(32),
}

function stubCache(respond: () => Response): { calls: () => string[] } {
  const calls: string[] = []
  vi.stubGlobal('fetch', (url: string) => {
    calls.push(url)
    return Promise.resolve(respond())
  })
  return { calls: () => calls }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('a cached output is read from its object once per cache and request', async () => {
  const cache = stubCache(() => new Response(new Uint8Array([1])))
  const requestId = parseRequestIdHex('11'.repeat(32))
  expect(await loadMpcCachedOutput(LOCATION, requestId)).toEqual(new Uint8Array([1]))
  await loadMpcCachedOutput(LOCATION, requestId)
  expect(cache.calls()).toEqual([
    `https://cache.example/v1/stagenet/stagenet/${'ab'.repeat(32)}/${'11'.repeat(32)}.bin`,
  ])
})

test('a missing object rejects, and the next call retries', async () => {
  const requestId = parseRequestIdHex('22'.repeat(32))
  stubCache(() => new Response(null, { status: 404 }))
  await expect(loadMpcCachedOutput(LOCATION, requestId)).rejects.toThrow('holds no output')
  stubCache(() => new Response(new Uint8Array([0xde, 0xad])))
  expect(await loadMpcCachedOutput(LOCATION, requestId)).toEqual(new Uint8Array([0xde, 0xad]))
})
