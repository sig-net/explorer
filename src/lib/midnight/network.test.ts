import {
  getMpcOutputCacheUrl,
  getMpcRootPublicKey,
  getResponderContractAddress,
  getSignerContractAddress,
  MidnightNetwork,
} from '@sig-net/midnight'
import { expect, test } from 'vitest'

import {
  DEFAULT_MIDNIGHT_NETWORK,
  MIDNIGHT_NETWORK_DEFAULTS,
  MIDNIGHT_NETWORKS,
  isMidnightNetwork,
  parseMidnightDefaultNetworkEnv,
  parseMidnightEvmRpcEnv,
  parseMidnightNetwork,
  parseMidnightPreprodEnv,
  parseSignetEventsFromBlock,
  signetEventsEarliestBlock,
  parseMidnightUndeployedEnv,
  parseMpcRootPublicKey,
} from './network'

test('every network has defaults and round-trips through the parser', () => {
  for (const network of MIDNIGHT_NETWORKS) {
    expect(isMidnightNetwork(network)).toBe(true)
    expect(parseMidnightNetwork(network)).toBe(network)
    expect(MIDNIGHT_NETWORK_DEFAULTS[network].nodeUrl).toMatch(/^(https?:\/\/|$)/)
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
const LOCAL_SIGNER_CONTRACT_ADDRESS =
  '380b1348271af7dc5a18e199aa90483830342f16267025699b940ee4bfd35193'
const LOCAL_RESPONDER_CONTRACT_ADDRESS =
  '4f1a2b6c3d8e9f00112233445566778899aabbccddeeff00112233445566778a'

test('undeployed env values are read in canonical form', () => {
  expect(
    parseMidnightUndeployedEnv({
      VITE_MIDNIGHT_UNDEPLOYED_MPC_ROOT_PUBLIC_KEY: ` ${LOCAL_MPC_ROOT_PUBLIC_KEY.toUpperCase().replace('0X', '0x')} `,
      VITE_MIDNIGHT_UNDEPLOYED_SIGNER_CONTRACT_ADDRESS: `0x${LOCAL_SIGNER_CONTRACT_ADDRESS}`,
      VITE_MIDNIGHT_UNDEPLOYED_RESPONDER_CONTRACT_ADDRESS:
        LOCAL_RESPONDER_CONTRACT_ADDRESS.toUpperCase(),
    }),
  ).toEqual({
    mpcRootPublicKey: LOCAL_MPC_ROOT_PUBLIC_KEY,
    signerContractAddress: LOCAL_SIGNER_CONTRACT_ADDRESS,
    responderContractAddress: LOCAL_RESPONDER_CONTRACT_ADDRESS,
  })
})

test('unset or empty undeployed env values yield empty strings', () => {
  const empty = { mpcRootPublicKey: '', signerContractAddress: '', responderContractAddress: '' }
  expect(parseMidnightUndeployedEnv({})).toEqual(empty)
  expect(
    parseMidnightUndeployedEnv({
      VITE_MIDNIGHT_UNDEPLOYED_MPC_ROOT_PUBLIC_KEY: '',
      VITE_MIDNIGHT_UNDEPLOYED_SIGNER_CONTRACT_ADDRESS: ' ',
      VITE_MIDNIGHT_UNDEPLOYED_RESPONDER_CONTRACT_ADDRESS: ' ',
    }),
  ).toEqual(empty)
})

test('an invalid undeployed env value names its variable', () => {
  expect(() =>
    parseMidnightUndeployedEnv({ VITE_MIDNIGHT_UNDEPLOYED_MPC_ROOT_PUBLIC_KEY: '0x04abc' }),
  ).toThrow('Invalid VITE_MIDNIGHT_UNDEPLOYED_MPC_ROOT_PUBLIC_KEY')
  expect(() =>
    parseMidnightUndeployedEnv({ VITE_MIDNIGHT_UNDEPLOYED_SIGNER_CONTRACT_ADDRESS: '380b' }),
  ).toThrow('Invalid VITE_MIDNIGHT_UNDEPLOYED_SIGNER_CONTRACT_ADDRESS')
  expect(() =>
    parseMidnightUndeployedEnv({ VITE_MIDNIGHT_UNDEPLOYED_RESPONDER_CONTRACT_ADDRESS: '380b' }),
  ).toThrow('Invalid VITE_MIDNIGHT_UNDEPLOYED_RESPONDER_CONTRACT_ADDRESS')
})

test('preprod env values replace what the SDK publishes, which stands while unset', () => {
  const published = {
    mpcRootPublicKey: getMpcRootPublicKey(MidnightNetwork.Preprod),
    signerContractAddress: getSignerContractAddress(MidnightNetwork.Preprod),
    responderContractAddress: getResponderContractAddress(MidnightNetwork.Preprod),
    mpcOutputCacheUrl: getMpcOutputCacheUrl(MidnightNetwork.Preprod),
  }
  expect(parseMidnightPreprodEnv({})).toMatchObject(published)
  expect(
    parseMidnightPreprodEnv({
      VITE_MIDNIGHT_PREPROD_MPC_ROOT_PUBLIC_KEY: LOCAL_MPC_ROOT_PUBLIC_KEY,
      VITE_MIDNIGHT_PREPROD_SIGNER_CONTRACT_ADDRESS: ' ',
      VITE_MIDNIGHT_PREPROD_RESPONDER_CONTRACT_ADDRESS: `0x${LOCAL_RESPONDER_CONTRACT_ADDRESS}`,
      VITE_MIDNIGHT_PREPROD_MPC_OUTPUT_CACHE_URL: ' https://cache.example/v1 ',
    }),
  ).toMatchObject({
    mpcRootPublicKey: LOCAL_MPC_ROOT_PUBLIC_KEY,
    signerContractAddress: published.signerContractAddress,
    responderContractAddress: LOCAL_RESPONDER_CONTRACT_ADDRESS,
    mpcOutputCacheUrl: 'https://cache.example/v1',
  })
  expect(
    parseMidnightPreprodEnv({
      VITE_MIDNIGHT_PREPROD_SIGNER_CONTRACT_ADDRESS: `0x${LOCAL_SIGNER_CONTRACT_ADDRESS}`,
    }).signerContractAddress,
  ).toBe(LOCAL_SIGNER_CONTRACT_ADDRESS)
})

test('the preprod endpoints carry the Blockfrost project token, and are empty without one', () => {
  expect(parseMidnightPreprodEnv({})).toMatchObject({
    indexerUrl: '',
    indexerWsUrl: '',
    nodeUrl: '',
  })
  expect(
    parseMidnightPreprodEnv({ VITE_MIDNIGHT_PREPROD_BLOCKFROST_PROJECT_ID: ' ' }),
  ).toMatchObject({ indexerUrl: '', indexerWsUrl: '', nodeUrl: '' })
  expect(
    parseMidnightPreprodEnv({ VITE_MIDNIGHT_PREPROD_BLOCKFROST_PROJECT_ID: ' preprodAb+1/ ' }),
  ).toMatchObject({
    indexerUrl: 'https://midnight-preprod.blockfrost.io/api/v0?project_id=preprodAb%2B1%2F',
    indexerWsUrl: 'wss://midnight-preprod.blockfrost.io/api/v0/ws?project_id=preprodAb%2B1%2F',
    nodeUrl: 'https://rpc.midnight-preprod.blockfrost.io?project_id=preprodAb%2B1%2F',
  })
  expect(() =>
    parseMidnightPreprodEnv({ VITE_MIDNIGHT_PREPROD_BLOCKFROST_PROJECT_ID: 'preprod Ab' }),
  ).toThrow('Invalid VITE_MIDNIGHT_PREPROD_BLOCKFROST_PROJECT_ID')
})

test('the preprod starting block is the env value, and the default window while unset', () => {
  expect(parseMidnightPreprodEnv({}).signetEventsFromBlock).toBe('')
  expect(
    parseMidnightPreprodEnv({ VITE_MIDNIGHT_PREPROD_SIGNET_EVENTS_FROM_BLOCK: ' 1200 ' })
      .signetEventsFromBlock,
  ).toBe('1200')
  expect(() =>
    parseMidnightPreprodEnv({ VITE_MIDNIGHT_PREPROD_SIGNET_EVENTS_FROM_BLOCK: '12.5' }),
  ).toThrow('Invalid VITE_MIDNIGHT_PREPROD_SIGNET_EVENTS_FROM_BLOCK')
})

test('the earliest block is the lower of a listed preprod signer and responder pair', () => {
  const signer = getSignerContractAddress(MidnightNetwork.Preprod)
  const responder = getResponderContractAddress(MidnightNetwork.Preprod)
  expect(signetEventsEarliestBlock(signer, responder)).toBe(3386746)
  expect(signetEventsEarliestBlock(responder, responder)).toBe(3386749)
  expect(signetEventsEarliestBlock(signer, LOCAL_RESPONDER_CONTRACT_ADDRESS)).toBeNull()
  expect(signetEventsEarliestBlock(LOCAL_SIGNER_CONTRACT_ADDRESS, responder)).toBeNull()
})

test('a typed starting block parses to a height, to the default window, or to null', () => {
  expect(parseSignetEventsFromBlock(' 873495 ')).toEqual({ fromBlock: 873495 })
  expect(parseSignetEventsFromBlock('0')).toEqual({ fromBlock: 0 })
  expect(parseSignetEventsFromBlock('')).toEqual({ fromBlock: null })
  expect(parseSignetEventsFromBlock(' ')).toEqual({ fromBlock: null })
  expect(parseSignetEventsFromBlock('-1')).toBeNull()
  expect(parseSignetEventsFromBlock('12.5')).toBeNull()
  expect(parseSignetEventsFromBlock('latest')).toBeNull()
})

test('an invalid preprod env value names its variable', () => {
  expect(() =>
    parseMidnightPreprodEnv({ VITE_MIDNIGHT_PREPROD_MPC_ROOT_PUBLIC_KEY: '0x04abc' }),
  ).toThrow('Invalid VITE_MIDNIGHT_PREPROD_MPC_ROOT_PUBLIC_KEY')
  expect(() =>
    parseMidnightPreprodEnv({ VITE_MIDNIGHT_PREPROD_SIGNER_CONTRACT_ADDRESS: '380b' }),
  ).toThrow('Invalid VITE_MIDNIGHT_PREPROD_SIGNER_CONTRACT_ADDRESS')
  expect(() =>
    parseMidnightPreprodEnv({ VITE_MIDNIGHT_PREPROD_RESPONDER_CONTRACT_ADDRESS: '380b' }),
  ).toThrow('Invalid VITE_MIDNIGHT_PREPROD_RESPONDER_CONTRACT_ADDRESS')
  expect(() =>
    parseMidnightPreprodEnv({ VITE_MIDNIGHT_PREPROD_MPC_OUTPUT_CACHE_URL: 'gs://bucket' }),
  ).toThrow('Invalid VITE_MIDNIGHT_PREPROD_MPC_OUTPUT_CACHE_URL')
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
