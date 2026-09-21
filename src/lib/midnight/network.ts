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

export interface MidnightNetworkConfig {
  indexerUrl: string
  indexerWsUrl: string
  nodeUrl: string
  mpcRootPublicKey: string
  signetContractAddress: string
  /** JSON-RPC endpoint asked about requested transactions that target Ethereum mainnet. */
  ethereumMainnetRpcUrl: string
  /** JSON-RPC endpoint asked about requested transactions that target Sepolia. */
  ethereumSepoliaRpcUrl: string
}

/** Keyless public endpoints that accept cross-origin calls from a browser. */
const EVM_RPC_DEFAULTS: Pick<
  MidnightNetworkConfig,
  'ethereumMainnetRpcUrl' | 'ethereumSepoliaRpcUrl'
> = {
  ethereumMainnetRpcUrl: 'https://ethereum-rpc.publicnode.com',
  ethereumSepoliaRpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
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
    ...EVM_RPC_DEFAULTS,
  },
  [MidnightNetwork.Stagenet]: {
    indexerUrl: 'https://indexer.stagenet.shielded.tools/api/v4/graphql',
    indexerWsUrl: 'wss://indexer.stagenet.shielded.tools/api/v4/graphql/ws',
    nodeUrl: 'https://rpc.stagenet.shielded.tools',
    mpcRootPublicKey: getMpcRootPublicKey(MidnightNetwork.Stagenet),
    signetContractAddress: getSignetContractAddress(MidnightNetwork.Stagenet),
    ...EVM_RPC_DEFAULTS,
  },
  // TODO: populate for this network once released to these networks
  [MidnightNetwork.Preview]: {
    indexerUrl: 'https://indexer.preview.midnight.network/api/v4/graphql',
    indexerWsUrl: 'wss://indexer.preview.midnight.network/api/v4/graphql/ws',
    nodeUrl: 'https://rpc.preview.midnight.network',
    mpcRootPublicKey: '',
    signetContractAddress: '',
    ...EVM_RPC_DEFAULTS,
  },
  // TODO: populate for this network once released to these networks
  [MidnightNetwork.Preprod]: {
    indexerUrl: 'https://indexer.preprod.midnight.network/api/v4/graphql',
    indexerWsUrl: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
    nodeUrl: 'https://rpc.preprod.midnight.network',
    mpcRootPublicKey: '',
    signetContractAddress: '',
    ...EVM_RPC_DEFAULTS,
  },
  // TODO: populate for this network once released to these networks
  [MidnightNetwork.Mainnet]: {
    indexerUrl: 'https://indexer.mainnet.midnight.network/api/v4/graphql',
    indexerWsUrl: 'wss://indexer.mainnet.midnight.network/api/v4/graphql/ws',
    nodeUrl: 'https://rpc.mainnet.midnight.network',
    mpcRootPublicKey: '',
    signetContractAddress: '',
    ...EVM_RPC_DEFAULTS,
  },
}

// Widened to plain strings so a raw value can be tested without comparing across enum types.
const MIDNIGHT_NETWORK_VALUES: readonly string[] = MIDNIGHT_NETWORKS

export function isMidnightNetwork(value: unknown): value is MidnightNetwork {
  return typeof value === 'string' && MIDNIGHT_NETWORK_VALUES.includes(value)
}

export type MidnightDefaultNetworkEnv = Pick<ImportMetaEnv, 'VITE_MIDNIGHT_DEFAULT_NETWORK'>

/**
 * Reads the network the app opens on. An unset or empty variable yields stagenet.
 *
 * @throws {Error} When the variable is set to anything but a network id.
 */
export function parseMidnightDefaultNetworkEnv(env: MidnightDefaultNetworkEnv): MidnightNetwork {
  const value = env.VITE_MIDNIGHT_DEFAULT_NETWORK?.trim() ?? ''
  if (value === '') {
    return MidnightNetwork.Stagenet
  }
  if (!isMidnightNetwork(value)) {
    throw new Error(
      `Invalid VITE_MIDNIGHT_DEFAULT_NETWORK: expected one of ${MIDNIGHT_NETWORKS.join(', ')}`,
    )
  }
  return value
}

export const DEFAULT_MIDNIGHT_NETWORK: MidnightNetwork = parseMidnightDefaultNetworkEnv(
  import.meta.env,
)

/** Narrows a raw search-param value to a network, falling back to the default. */
export function parseMidnightNetwork(value: unknown): MidnightNetwork {
  return isMidnightNetwork(value) ? value : DEFAULT_MIDNIGHT_NETWORK
}
