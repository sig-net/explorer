import { expect, test } from 'vitest'

import {
  DEFAULT_MIDNIGHT_NETWORK,
  MIDNIGHT_NETWORK_DEFAULTS,
  MIDNIGHT_NETWORKS,
  isMidnightNetwork,
  parseMidnightNetwork,
  parseMidnightUndeployedEnv,
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
