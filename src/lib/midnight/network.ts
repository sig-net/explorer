import {
  bytesToHex,
  contractAddressFromHex,
  getMpcRootPublicKey,
  getSignetContractAddress,
  MidnightNetwork,
  normaliseSecp256k1PublicKey,
} from '@sig-net/midnight'

export const MIDNIGHT_NETWORKS: readonly MidnightNetwork[] = [
  MidnightNetwork.Undeployed,
  MidnightNetwork.Stagenet,
  MidnightNetwork.Preview,
  MidnightNetwork.Preprod,
  MidnightNetwork.Mainnet,
]

export const DEFAULT_MIDNIGHT_NETWORK: MidnightNetwork = MidnightNetwork.Stagenet

export interface MidnightNetworkConfig {
  indexerUrl: string
  indexerWsUrl: string
  nodeUrl: string
  mpcRootPublicKey: string
  signetContractAddress: string
}

/**
 * Renders a contract address in the form the indexer takes: 64 lowercase hex digits with the `0x`
 * prefix dropped.
 *
 * @throws {Error} When the value is not 32 bytes of hex.
 */
function normaliseSignetContractAddress(value: string): string {
  return bytesToHex(contractAddressFromHex(value.trim()).bytes)
}

/** The canonical form of a typed contract address, or null while it is not a valid address. */
export function parseSignetContractAddress(value: string): string | null {
  try {
    return normaliseSignetContractAddress(value)
  } catch {
    return null
  }
}

/** The canonical form of a typed MPC root public key, or null while it is not a valid key. */
export function parseMpcRootPublicKey(value: string): string | null {
  try {
    return normaliseSecp256k1PublicKey(value.trim())
  } catch {
    return null
  }
}

export type MidnightUndeployedEnv = Pick<
  ImportMetaEnv,
  | 'VITE_MIDNIGHT_UNDEPLOYED_MPC_ROOT_PUBLIC_KEY'
  | 'VITE_MIDNIGHT_UNDEPLOYED_SIGNET_CONTRACT_ADDRESS'
>

function readMidnightUndeployedEnv(
  env: MidnightUndeployedEnv,
  name: keyof MidnightUndeployedEnv,
  normalise: (value: string) => string,
): string {
  const value = env[name]?.trim() ?? ''
  if (value === '') {
    return ''
  }
  try {
    return normalise(value)
  } catch (error) {
    throw new Error(`Invalid ${name}`, { cause: error })
  }
}

/**
 * Reads the undeployed network's MPC root public key and Signet contract address, which every local
 * stack generates afresh. Unset or empty variables yield empty strings.
 *
 * @throws {Error} When a set variable is not a valid key or address.
 */
export function parseMidnightUndeployedEnv(
  env: MidnightUndeployedEnv,
): Pick<MidnightNetworkConfig, 'mpcRootPublicKey' | 'signetContractAddress'> {
  return {
    mpcRootPublicKey: readMidnightUndeployedEnv(
      env,
      'VITE_MIDNIGHT_UNDEPLOYED_MPC_ROOT_PUBLIC_KEY',
      normaliseSecp256k1PublicKey,
    ),
    signetContractAddress: readMidnightUndeployedEnv(
      env,
      'VITE_MIDNIGHT_UNDEPLOYED_SIGNET_CONTRACT_ADDRESS',
      normaliseSignetContractAddress,
    ),
  }
}

export const MIDNIGHT_NETWORK_DEFAULTS: Record<MidnightNetwork, MidnightNetworkConfig> = {
  [MidnightNetwork.Undeployed]: {
    indexerUrl: 'http://127.0.0.1:8088/api/v4/graphql',
    indexerWsUrl: 'ws://127.0.0.1:8088/api/v4/graphql/ws',
    nodeUrl: 'http://127.0.0.1:9944',
    ...parseMidnightUndeployedEnv(import.meta.env),
  },
  [MidnightNetwork.Stagenet]: {
    indexerUrl: 'https://indexer.stagenet.shielded.tools/api/v4/graphql',
    indexerWsUrl: 'wss://indexer.stagenet.shielded.tools/api/v4/graphql/ws',
    nodeUrl: 'https://rpc.stagenet.shielded.tools',
    mpcRootPublicKey: getMpcRootPublicKey(MidnightNetwork.Stagenet),
    signetContractAddress: getSignetContractAddress(MidnightNetwork.Stagenet),
  },
  // TODO: populate for this network once released to these networks
  [MidnightNetwork.Preview]: {
    indexerUrl: 'https://indexer.preview.midnight.network/api/v4/graphql',
    indexerWsUrl: 'wss://indexer.preview.midnight.network/api/v4/graphql/ws',
    nodeUrl: 'https://rpc.preview.midnight.network',
    mpcRootPublicKey: '',
    signetContractAddress: '',
  },
  // TODO: populate for this network once released to these networks
  [MidnightNetwork.Preprod]: {
    indexerUrl: 'https://indexer.preprod.midnight.network/api/v4/graphql',
    indexerWsUrl: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
    nodeUrl: 'https://rpc.preprod.midnight.network',
    mpcRootPublicKey: '',
    signetContractAddress: '',
  },
  // TODO: populate for this network once released to these networks
  [MidnightNetwork.Mainnet]: {
    indexerUrl: 'https://indexer.mainnet.midnight.network/api/v4/graphql',
    indexerWsUrl: 'wss://indexer.mainnet.midnight.network/api/v4/graphql/ws',
    nodeUrl: 'https://rpc.mainnet.midnight.network',
    mpcRootPublicKey: '',
    signetContractAddress: '',
  },
}

// Widened to plain strings so a raw value can be tested without comparing across enum types.
const MIDNIGHT_NETWORK_VALUES: readonly string[] = MIDNIGHT_NETWORKS

export function isMidnightNetwork(value: unknown): value is MidnightNetwork {
  return typeof value === 'string' && MIDNIGHT_NETWORK_VALUES.includes(value)
}

/** Narrows a raw search-param value to a network, falling back to the default. */
export function parseMidnightNetwork(value: unknown): MidnightNetwork {
  return isMidnightNetwork(value) ? value : DEFAULT_MIDNIGHT_NETWORK
}
