import {
  bytesToHex,
  contractAddressFromHex,
  getMpcOutputCacheUrl,
  getMpcRootPublicKey,
  getSignetContractAddress,
  MidnightNetwork,
  normaliseSecp256k1PublicKey,
} from '@sig-net/midnight'

import { EXPLORER_ENV } from '@/lib/explorer-env'

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
  /**
   * The MPC's output cache down to its object prefix, where attested serialised outputs are read
   * before a transaction is traced. Empty for a network with none.
   */
  mpcOutputCacheUrl: string
  /**
   * The lowest block height the Signet contract's events are read from, as typed: a whole number,
   * or empty for the whole history. It belongs with `signetContractAddress`: a block above the
   * contract's deployment hides events.
   */
  signetEventsFromBlock: string
}

/**
 * The block each known Signet contract's events are read from, as read off the stagenet indexer:
 * the contract's deployment block, the first height its `contract(address, offset: { height })`
 * query answers for, unless its earliest events answer requests of a predecessor contract.
 */
const SIGNET_EVENTS_FROM_BLOCKS: Readonly<Record<string, number>> = {
  // The block of the first request notified on it. The MPC devnet posted responses for 26 requests
  // of its predecessor, 838778d2..., on this contract between blocks 873704 and 873963.
  '49605c93a7f602bd3c4750f013615ee3e4bd4be02a201b051c2c220ece6a32f5': 874309,
  // The deployment block.
  d2a2419b5f296dae40c5681840b660f5ebab6cbd21c107e05e0464045b589517: 866975,
}

/** The listed starting block of `signetContractAddress` as typed, or empty for a contract not listed. */
function listedSignetEventsFromBlock(signetContractAddress: string): string {
  const block = SIGNET_EVENTS_FROM_BLOCKS[signetContractAddress]
  return block === undefined ? '' : String(block)
}

/**
 * The block height a typed `signetEventsFromBlock` names, as `fromBlock`, which is null for an
 * empty value, meaning the whole history. Null for a value that is not a whole number.
 */
export function parseSignetEventsFromBlock(
  value: string,
): { readonly fromBlock: number | null } | null {
  const trimmed = value.trim()
  if (trimmed === '') {
    return { fromBlock: null }
  }
  return /^\d{1,15}$/u.test(trimmed) ? { fromBlock: Number(trimmed) } : null
}

/** @throws {Error} When the value is not a whole number. */
function normaliseSignetEventsFromBlock(value: string): string {
  const parsed = parseSignetEventsFromBlock(value)
  if (parsed === null || parsed.fromBlock === null) {
    throw new Error('expected a block height, a whole number')
  }
  return String(parsed.fromBlock)
}

/** Keyless public endpoints that accept cross-origin calls from a browser. */
const PUBLIC_EVM_RPC_URLS: Pick<
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

/**
 * The trimmed value of an optional env variable in the form `normalise` gives it, or an empty
 * string while the variable is unset or empty.
 *
 * @throws {Error} When `normalise` rejects the value. The error names the variable.
 */
function readOptionalEnv<TName extends string>(
  env: Partial<Record<TName, string>>,
  name: TName,
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

/** @throws {Error} When the value is not an http or https URL. */
function normaliseHttpUrl(value: string): string {
  const { protocol } = new URL(value)
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new Error(`expected an http or https URL, got ${protocol}`)
  }
  return value
}

export type MidnightEvmRpcEnv = Pick<
  ImportMetaEnv,
  'VITE_MIDNIGHT_ETHEREUM_MAINNET_RPC_URL' | 'VITE_MIDNIGHT_ETHEREUM_SEPOLIA_RPC_URL'
>

/**
 * Reads the default EVM RPC endpoints. An unset or empty variable yields the keyless public
 * endpoint for its chain.
 *
 * @throws {Error} When a set variable is not an http or https URL.
 */
export function parseMidnightEvmRpcEnv(
  env: MidnightEvmRpcEnv,
): Pick<MidnightNetworkConfig, 'ethereumMainnetRpcUrl' | 'ethereumSepoliaRpcUrl'> {
  return {
    ethereumMainnetRpcUrl:
      readOptionalEnv(env, 'VITE_MIDNIGHT_ETHEREUM_MAINNET_RPC_URL', normaliseHttpUrl) ||
      PUBLIC_EVM_RPC_URLS.ethereumMainnetRpcUrl,
    ethereumSepoliaRpcUrl:
      readOptionalEnv(env, 'VITE_MIDNIGHT_ETHEREUM_SEPOLIA_RPC_URL', normaliseHttpUrl) ||
      PUBLIC_EVM_RPC_URLS.ethereumSepoliaRpcUrl,
  }
}

const EVM_RPC_DEFAULTS = parseMidnightEvmRpcEnv(EXPLORER_ENV)

export type MidnightUndeployedEnv = Pick<
  ImportMetaEnv,
  | 'VITE_MIDNIGHT_UNDEPLOYED_MPC_ROOT_PUBLIC_KEY'
  | 'VITE_MIDNIGHT_UNDEPLOYED_SIGNET_CONTRACT_ADDRESS'
>

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
    mpcRootPublicKey: readOptionalEnv(
      env,
      'VITE_MIDNIGHT_UNDEPLOYED_MPC_ROOT_PUBLIC_KEY',
      normaliseSecp256k1PublicKey,
    ),
    signetContractAddress: readOptionalEnv(
      env,
      'VITE_MIDNIGHT_UNDEPLOYED_SIGNET_CONTRACT_ADDRESS',
      normaliseSignetContractAddress,
    ),
  }
}

export type MidnightStagenetEnv = Pick<
  ImportMetaEnv,
  | 'VITE_MIDNIGHT_STAGENET_MPC_ROOT_PUBLIC_KEY'
  | 'VITE_MIDNIGHT_STAGENET_SIGNET_CONTRACT_ADDRESS'
  | 'VITE_MIDNIGHT_STAGENET_MPC_OUTPUT_CACHE_URL'
  | 'VITE_MIDNIGHT_STAGENET_SIGNET_EVENTS_FROM_BLOCK'
>

/**
 * Reads stagenet's MPC root public key, Signet contract address, MPC output cache URL and the block
 * its events are read from. An unset or empty variable yields the value the SDK publishes for
 * stagenet, and for the block the one listed for the contract address in use, where known.
 *
 * @throws {Error} When a set variable is not a valid key, address, http URL or block height.
 */
export function parseMidnightStagenetEnv(
  env: MidnightStagenetEnv,
): Pick<
  MidnightNetworkConfig,
  'mpcRootPublicKey' | 'signetContractAddress' | 'mpcOutputCacheUrl' | 'signetEventsFromBlock'
> {
  const signetContractAddress =
    readOptionalEnv(
      env,
      'VITE_MIDNIGHT_STAGENET_SIGNET_CONTRACT_ADDRESS',
      normaliseSignetContractAddress,
    ) || getSignetContractAddress(MidnightNetwork.Stagenet)
  return {
    mpcRootPublicKey:
      readOptionalEnv(
        env,
        'VITE_MIDNIGHT_STAGENET_MPC_ROOT_PUBLIC_KEY',
        normaliseSecp256k1PublicKey,
      ) || getMpcRootPublicKey(MidnightNetwork.Stagenet),
    signetContractAddress,
    mpcOutputCacheUrl:
      readOptionalEnv(env, 'VITE_MIDNIGHT_STAGENET_MPC_OUTPUT_CACHE_URL', normaliseHttpUrl) ||
      getMpcOutputCacheUrl(MidnightNetwork.Stagenet),
    signetEventsFromBlock:
      readOptionalEnv(
        env,
        'VITE_MIDNIGHT_STAGENET_SIGNET_EVENTS_FROM_BLOCK',
        normaliseSignetEventsFromBlock,
      ) || listedSignetEventsFromBlock(signetContractAddress),
  }
}

export const MIDNIGHT_NETWORK_DEFAULTS: Record<MidnightNetwork, MidnightNetworkConfig> = {
  [MidnightNetwork.Undeployed]: {
    indexerUrl: 'http://127.0.0.1:8088/api/v4/graphql',
    indexerWsUrl: 'ws://127.0.0.1:8088/api/v4/graphql/ws',
    nodeUrl: 'http://127.0.0.1:9944',
    ...parseMidnightUndeployedEnv(EXPLORER_ENV),
    ...EVM_RPC_DEFAULTS,
    mpcOutputCacheUrl: '',
    signetEventsFromBlock: '',
  },
  [MidnightNetwork.Stagenet]: {
    indexerUrl: 'https://indexer.stagenet.shielded.tools/api/v4/graphql',
    indexerWsUrl: 'wss://indexer.stagenet.shielded.tools/api/v4/graphql/ws',
    nodeUrl: 'https://rpc.stagenet.shielded.tools',
    ...parseMidnightStagenetEnv(EXPLORER_ENV),
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
    mpcOutputCacheUrl: '',
    signetEventsFromBlock: '',
  },
  // TODO: populate for this network once released to these networks
  [MidnightNetwork.Preprod]: {
    indexerUrl: 'https://indexer.preprod.midnight.network/api/v4/graphql',
    indexerWsUrl: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
    nodeUrl: 'https://rpc.preprod.midnight.network',
    mpcRootPublicKey: '',
    signetContractAddress: '',
    ...EVM_RPC_DEFAULTS,
    mpcOutputCacheUrl: '',
    signetEventsFromBlock: '',
  },
  // TODO: populate for this network once released to these networks
  [MidnightNetwork.Mainnet]: {
    indexerUrl: 'https://indexer.mainnet.midnight.network/api/v4/graphql',
    indexerWsUrl: 'wss://indexer.mainnet.midnight.network/api/v4/graphql/ws',
    nodeUrl: 'https://rpc.mainnet.midnight.network',
    mpcRootPublicKey: '',
    signetContractAddress: '',
    ...EVM_RPC_DEFAULTS,
    mpcOutputCacheUrl: '',
    signetEventsFromBlock: '',
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

export const DEFAULT_MIDNIGHT_NETWORK: MidnightNetwork =
  parseMidnightDefaultNetworkEnv(EXPLORER_ENV)

/** Narrows a raw search-param value to a network, falling back to the default. */
export function parseMidnightNetwork(value: unknown): MidnightNetwork {
  return isMidnightNetwork(value) ? value : DEFAULT_MIDNIGHT_NETWORK
}
