import { expect, test } from 'vitest'

import {
  DEFAULT_MIDNIGHT_NETWORK,
  MIDNIGHT_NETWORK_DEFAULTS,
  MIDNIGHT_NETWORKS,
  isMidnightNetwork,
  parseMidnightNetwork,
} from './network'

test('every network has defaults and round-trips through the parser', () => {
  for (const network of MIDNIGHT_NETWORKS) {
    expect(isMidnightNetwork(network)).toBe(true)
    expect(parseMidnightNetwork(network)).toBe(network)
    expect(MIDNIGHT_NETWORK_DEFAULTS[network].nodeUrl).toMatch(/^https?:\/\//)
  }
})

test('unknown or missing values fall back to the default network', () => {
  expect(parseMidnightNetwork(undefined)).toBe(DEFAULT_MIDNIGHT_NETWORK)
  expect(parseMidnightNetwork('devnet')).toBe(DEFAULT_MIDNIGHT_NETWORK)
  expect(isMidnightNetwork(42)).toBe(false)
})
