import { MidnightNetwork } from '@sig-net/midnight'
import { expect, test } from 'vitest'

import {
  DEFAULT_MIDNIGHT_NETWORK,
  MIDNIGHT_NETWORK_DEFAULTS,
  MIDNIGHT_NETWORKS,
  isMidnightNetwork,
  parseMidnightDefaultNetworkEnv,
  parseMidnightNetwork,
  parseMidnightUndeployedEnv,
  parseMpcRootPublicKey,
  parseSignetContractAddress,
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

test('the default network env value is a network id, and stagenet while unset', () => {
  expect(parseMidnightDefaultNetworkEnv({})).toBe(MidnightNetwork.Stagenet)
  expect(parseMidnightDefaultNetworkEnv({ VITE_MIDNIGHT_DEFAULT_NETWORK: ' ' })).toBe(
    MidnightNetwork.Stagenet,
  )
  expect(parseMidnightDefaultNetworkEnv({ VITE_MIDNIGHT_DEFAULT_NETWORK: ' undeployed ' })).toBe(
    MidnightNetwork.Undeployed,
  )
  expect(() => parseMidnightDefaultNetworkEnv({ VITE_MIDNIGHT_DEFAULT_NETWORK: 'devnet' })).toThrow(
    'Invalid VITE_MIDNIGHT_DEFAULT_NETWORK',
  )
})

const LOCAL_MPC_ROOT_PUBLIC_KEY =
  '0x04715f51662249e34979be813de068bf6d73d6abcb8b2ed34f3d4c5311cc5a1365079b3b3e16681054e1be38bff104a231bf25c8d0594d5367cbaf3d204ce1e07a'
const LOCAL_SIGNET_CONTRACT_ADDRESS =
  '380b1348271af7dc5a18e199aa90483830342f16267025699b940ee4bfd35193'

test('undeployed env values are read in canonical form', () => {
  expect(
    parseMidnightUndeployedEnv({
      VITE_MIDNIGHT_UNDEPLOYED_MPC_ROOT_PUBLIC_KEY: ` ${LOCAL_MPC_ROOT_PUBLIC_KEY.toUpperCase().replace('0X', '0x')} `,
      VITE_MIDNIGHT_UNDEPLOYED_SIGNET_CONTRACT_ADDRESS: `0x${LOCAL_SIGNET_CONTRACT_ADDRESS}`,
    }),
  ).toEqual({
    mpcRootPublicKey: LOCAL_MPC_ROOT_PUBLIC_KEY,
    signetContractAddress: LOCAL_SIGNET_CONTRACT_ADDRESS,
  })
})

test('unset or empty undeployed env values yield empty strings', () => {
  const empty = { mpcRootPublicKey: '', signetContractAddress: '' }
  expect(parseMidnightUndeployedEnv({})).toEqual(empty)
  expect(
    parseMidnightUndeployedEnv({
      VITE_MIDNIGHT_UNDEPLOYED_MPC_ROOT_PUBLIC_KEY: '',
      VITE_MIDNIGHT_UNDEPLOYED_SIGNET_CONTRACT_ADDRESS: ' ',
    }),
  ).toEqual(empty)
})

test('an invalid undeployed env value names its variable', () => {
  expect(() =>
    parseMidnightUndeployedEnv({ VITE_MIDNIGHT_UNDEPLOYED_MPC_ROOT_PUBLIC_KEY: '0x04abc' }),
  ).toThrow('Invalid VITE_MIDNIGHT_UNDEPLOYED_MPC_ROOT_PUBLIC_KEY')
  expect(() =>
    parseMidnightUndeployedEnv({ VITE_MIDNIGHT_UNDEPLOYED_SIGNET_CONTRACT_ADDRESS: '380b' }),
  ).toThrow('Invalid VITE_MIDNIGHT_UNDEPLOYED_SIGNET_CONTRACT_ADDRESS')
})

test('a typed contract address parses to its canonical form or to null', () => {
  expect(parseSignetContractAddress(LOCAL_SIGNET_CONTRACT_ADDRESS)).toBe(
    LOCAL_SIGNET_CONTRACT_ADDRESS,
  )
  expect(parseSignetContractAddress(` 0x${LOCAL_SIGNET_CONTRACT_ADDRESS.toUpperCase()} `)).toBe(
    LOCAL_SIGNET_CONTRACT_ADDRESS,
  )
  expect(parseSignetContractAddress('')).toBeNull()
  expect(parseSignetContractAddress('garbage')).toBeNull()
  expect(parseSignetContractAddress(LOCAL_SIGNET_CONTRACT_ADDRESS.slice(2))).toBeNull()
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
