import { getMpcOutputCacheUrl, getMpcRootPublicKey, MidnightNetwork } from '@sig-net/midnight'
import { isMidnightNetwork, MIDNIGHT_NETWORKS } from '@sig-net/explorer-lib'
import { expect, test } from 'vitest'

import {
  DEFAULT_MIDNIGHT_NETWORK,
  MIDNIGHT_NETWORK_DEFAULTS,
  parseMidnightDefaultNetworkEnv,
  parseMidnightEvmRpcEnv,
  parseMidnightNetwork,
  parseMidnightMpcEnv,
  parseMidnightUndeployedEnv,
  parseMpcRootPublicKey,
} from './network'

test('every network has defaults and round-trips through the parser', () => {
  for (const network of MIDNIGHT_NETWORKS) {
    expect(isMidnightNetwork(network)).toBe(true)
    expect(parseMidnightNetwork(network)).toBe(network)
    expect(MIDNIGHT_NETWORK_DEFAULTS[network].ethereumSepoliaRpcUrl).toMatch(/^https?:\/\//)
  }
})

test('unknown or missing values fall back to the default network', () => {
  expect(parseMidnightNetwork(undefined)).toBe(DEFAULT_MIDNIGHT_NETWORK)
  expect(parseMidnightNetwork('devnet')).toBe(DEFAULT_MIDNIGHT_NETWORK)
  expect(isMidnightNetwork(42)).toBe(false)
})

test('the default network env value is a network id, and preprod while unset', () => {
  expect(parseMidnightDefaultNetworkEnv({})).toBe(MidnightNetwork.Preprod)
  expect(parseMidnightDefaultNetworkEnv({ VITE_MIDNIGHT_DEFAULT_NETWORK: ' ' })).toBe(
    MidnightNetwork.Preprod,
  )
  expect(parseMidnightDefaultNetworkEnv({ VITE_MIDNIGHT_DEFAULT_NETWORK: ' undeployed ' })).toBe(
    MidnightNetwork.Undeployed,
  )
  expect(() => parseMidnightDefaultNetworkEnv({ VITE_MIDNIGHT_DEFAULT_NETWORK: 'devnet' })).toThrow(
    'Invalid VITE_MIDNIGHT_DEFAULT_NETWORK',
  )
})

test('EVM RPC env values replace the public endpoints, which stand while unset', () => {
  const publicEndpoints = parseMidnightEvmRpcEnv({})
  expect(publicEndpoints.ethereumMainnetRpcUrl).toMatch(/^https:\/\//)
  expect(publicEndpoints.ethereumSepoliaRpcUrl).toMatch(/^https:\/\//)
  expect(
    parseMidnightEvmRpcEnv({
      VITE_MIDNIGHT_ETHEREUM_MAINNET_RPC_URL: ' ',
      VITE_MIDNIGHT_ETHEREUM_SEPOLIA_RPC_URL: ' https://sepolia.example/v3/key ',
    }),
  ).toEqual({
    ethereumMainnetRpcUrl: publicEndpoints.ethereumMainnetRpcUrl,
    ethereumSepoliaRpcUrl: 'https://sepolia.example/v3/key',
  })
})

test('an EVM RPC env value that is not an http or https URL names its variable', () => {
  expect(() =>
    parseMidnightEvmRpcEnv({ VITE_MIDNIGHT_ETHEREUM_SEPOLIA_RPC_URL: 'sepolia.example' }),
  ).toThrow('Invalid VITE_MIDNIGHT_ETHEREUM_SEPOLIA_RPC_URL')
  expect(() =>
    parseMidnightEvmRpcEnv({ VITE_MIDNIGHT_ETHEREUM_MAINNET_RPC_URL: 'wss://mainnet.example' }),
  ).toThrow('Invalid VITE_MIDNIGHT_ETHEREUM_MAINNET_RPC_URL')
})

const LOCAL_MPC_ROOT_PUBLIC_KEY =
  '0x04715f51662249e34979be813de068bf6d73d6abcb8b2ed34f3d4c5311cc5a1365079b3b3e16681054e1be38bff104a231bf25c8d0594d5367cbaf3d204ce1e07a'
test('the undeployed env reads its MPC root public key, empty while unset', () => {
  expect(
    parseMidnightUndeployedEnv({
      VITE_MIDNIGHT_UNDEPLOYED_MPC_ROOT_PUBLIC_KEY: ` ${LOCAL_MPC_ROOT_PUBLIC_KEY} `,
    }),
  ).toEqual({ mpcRootPublicKey: LOCAL_MPC_ROOT_PUBLIC_KEY })
  expect(parseMidnightUndeployedEnv({})).toEqual({ mpcRootPublicKey: '' })
  expect(parseMidnightUndeployedEnv({ VITE_MIDNIGHT_UNDEPLOYED_MPC_ROOT_PUBLIC_KEY: ' ' })).toEqual(
    { mpcRootPublicKey: '' },
  )
  expect(() =>
    parseMidnightUndeployedEnv({ VITE_MIDNIGHT_UNDEPLOYED_MPC_ROOT_PUBLIC_KEY: '0x04abc' }),
  ).toThrow('Invalid VITE_MIDNIGHT_UNDEPLOYED_MPC_ROOT_PUBLIC_KEY')
})

test.each([
  [MidnightNetwork.Preview, 'PREVIEW'],
  [MidnightNetwork.Preprod, 'PREPROD'],
] as const)(
  '%s env values replace the published ones, which stand while unset',
  (network, infix) => {
    const published = {
      mpcRootPublicKey: getMpcRootPublicKey(network),
      mpcOutputCacheUrl: getMpcOutputCacheUrl(network),
    }
    expect(parseMidnightMpcEnv({}, network)).toEqual(published)
    expect(
      parseMidnightMpcEnv(
        {
          [`VITE_MIDNIGHT_${infix}_MPC_ROOT_PUBLIC_KEY`]: ' ',
          [`VITE_MIDNIGHT_${infix}_MPC_OUTPUT_CACHE_URL`]: ' https://cache.example/v1/ ',
        },
        network,
      ),
    ).toEqual({
      mpcRootPublicKey: published.mpcRootPublicKey,
      mpcOutputCacheUrl: 'https://cache.example/v1/',
    })
    expect(
      parseMidnightMpcEnv(
        { [`VITE_MIDNIGHT_${infix}_MPC_ROOT_PUBLIC_KEY`]: LOCAL_MPC_ROOT_PUBLIC_KEY },
        network,
      ).mpcRootPublicKey,
    ).toBe(LOCAL_MPC_ROOT_PUBLIC_KEY)
  },
)

test("a network's env values leave the other network's published ones standing", () => {
  expect(
    parseMidnightMpcEnv(
      { VITE_MIDNIGHT_PREPROD_MPC_OUTPUT_CACHE_URL: 'https://cache.example/v1/' },
      MidnightNetwork.Preview,
    ).mpcOutputCacheUrl,
  ).toBe(getMpcOutputCacheUrl(MidnightNetwork.Preview))
})

test('an invalid MPC env value names its variable', () => {
  expect(() =>
    parseMidnightMpcEnv(
      { VITE_MIDNIGHT_PREPROD_MPC_ROOT_PUBLIC_KEY: '0x04abc' },
      MidnightNetwork.Preprod,
    ),
  ).toThrow('Invalid VITE_MIDNIGHT_PREPROD_MPC_ROOT_PUBLIC_KEY')
  expect(() =>
    parseMidnightMpcEnv(
      { VITE_MIDNIGHT_PREVIEW_MPC_OUTPUT_CACHE_URL: 'gs://bucket' },
      MidnightNetwork.Preview,
    ),
  ).toThrow('Invalid VITE_MIDNIGHT_PREVIEW_MPC_OUTPUT_CACHE_URL')
})

test('a typed MPC root public key parses to its canonical form or to null', () => {
  expect(parseMpcRootPublicKey(LOCAL_MPC_ROOT_PUBLIC_KEY)).toBe(LOCAL_MPC_ROOT_PUBLIC_KEY)
  expect(
    parseMpcRootPublicKey(` ${LOCAL_MPC_ROOT_PUBLIC_KEY.toUpperCase().replace('0X', '0x')} `),
  ).toBe(LOCAL_MPC_ROOT_PUBLIC_KEY)
  expect(parseMpcRootPublicKey(LOCAL_MPC_ROOT_PUBLIC_KEY.slice(2))).toBe(LOCAL_MPC_ROOT_PUBLIC_KEY)
  expect(parseMpcRootPublicKey('')).toBeNull()
  expect(parseMpcRootPublicKey('0x04abc')).toBeNull()
  // 65 bytes with the uncompressed tag, but the point is not on the curve.
  expect(parseMpcRootPublicKey(`0x04${'11'.repeat(64)}`)).toBeNull()
})
