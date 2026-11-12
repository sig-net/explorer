import {
  getMpcOutputCacheUrl,
  getMpcRootPublicKey,
  getResponderContractAddress,
  getSignerContractAddress,
  MidnightNetwork,
  normaliseSecp256k1PublicKey,
} from '@sig-net/midnight'

import { EXPLORER_ENV } from '@/lib/explorer-env'
import { normaliseContractAddressHex } from '@/lib/midnight/contract-address'

export const MIDNIGHT_NETWORKS: readonly MidnightNetwork[] = [
  MidnightNetwork.Undeployed,
  MidnightNetwork.Preview,
  MidnightNetwork.Preprod,
  MidnightNetwork.Mainnet,
]

export interface MidnightNetworkConfig {
  indexerUrl: string
  indexerWsUrl: string
  nodeUrl: string
  mpcRootPublicKey: string
  /** The signet signer, which requester contracts notify of their requests. */
  signerContractAddress: string
  /** The signet responder, which the MPC posts its responses through. */
  responderContractAddress: string
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
   * The lowest block height the events of both the signer and the responder are read from, as
   * typed: a whole number (0 for the whole history), or empty for the default window before the
   * chain tip. A block above either contract's deployment hides that contract's earliest events.
   */
  signetEventsFromBlock: string
}

/**
 * The deployment block of each known signet contract, read off the preprod indexer as the first
 * height its `contract(address, offset: { height })` query answers for.
 */
const SIGNET_EVENTS_EARLIEST_BLOCKS: Readonly<Record<string, number>> = {
  // The preprod signer.
  c423fca48329307ba00383e8c40cf1b3a83a7728a2b6721e863cfa16d25fb3ec: 3386746,
  // The preprod responder.
  '627ef19bb1db09b4261e31a4f87a6b299581c3d635c409bad9ac4547370ef4d5': 3386749,
}

/**
 * The lower of the listed earliest blocks of a signer and a responder in canonical form, or null
 * unless both are listed.
 */
export function signetEventsEarliestBlock(
  signerContractAddress: string,
  responderContractAddress: string,
): number | null {
  const signer = SIGNET_EVENTS_EARLIEST_BLOCKS[signerContractAddress]
  const responder = SIGNET_EVENTS_EARLIEST_BLOCKS[responderContractAddress]
  return signer === undefined || responder === undefined ? null : Math.min(signer, responder)
}

/**
 * The block height a typed `signetEventsFromBlock` names, as `fromBlock`, which is null for an
 * empty value, meaning the default window. Null for a value that is not a whole number.
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
  | 'VITE_MIDNIGHT_UNDEPLOYED_SIGNER_CONTRACT_ADDRESS'
  | 'VITE_MIDNIGHT_UNDEPLOYED_RESPONDER_CONTRACT_ADDRESS'
>

/**
 * Reads the undeployed network's MPC root public key and signet signer and responder addresses,
 * which every local stack generates afresh. Unset or empty variables yield empty strings.
 *
 * @throws {Error} When a set variable is not a valid key or address.
 */
export function parseMidnightUndeployedEnv(
  env: MidnightUndeployedEnv,
): Pick<
  MidnightNetworkConfig,
  'mpcRootPublicKey' | 'signerContractAddress' | 'responderContractAddress'
> {
  return {
    mpcRootPublicKey: readOptionalEnv(
      env,
      'VITE_MIDNIGHT_UNDEPLOYED_MPC_ROOT_PUBLIC_KEY',
      normaliseSecp256k1PublicKey,
    ),
    signerContractAddress: readOptionalEnv(
      env,
      'VITE_MIDNIGHT_UNDEPLOYED_SIGNER_CONTRACT_ADDRESS',
      normaliseContractAddressHex,
    ),
    responderContractAddress: readOptionalEnv(
      env,
      'VITE_MIDNIGHT_UNDEPLOYED_RESPONDER_CONTRACT_ADDRESS',
      normaliseContractAddressHex,
    ),
  }
}

/**
 * Preprod's Blockfrost endpoints, each taking a project token as `?project_id=<token>`. They
 * duplicate `networks.preprod` of `@midnight-ntwrk/midnight-js-utils`, whose dependency on
 * `@midnight-ntwrk/midnight-js-types` would put the ledger WebAssembly on the first page load.
 */
const PREPROD_BLOCKFROST_URLS: Pick<
  MidnightNetworkConfig,
  'indexerUrl' | 'indexerWsUrl' | 'nodeUrl'
> = {
  indexerUrl: 'https://midnight-preprod.blockfrost.io/api/v0',
  indexerWsUrl: 'wss://midnight-preprod.blockfrost.io/api/v0/ws',
  nodeUrl: 'https://rpc.midnight-preprod.blockfrost.io',
}

/** @throws {Error} When the value holds whitespace. */
function normaliseBlockfrostProjectId(value: string): string {
  if (/\s/u.test(value)) {
    throw new Error('expected a Blockfrost project token without whitespace')
  }
  return value
}

export type MidnightPreprodEnv = Pick<
  ImportMetaEnv,
  | 'VITE_MIDNIGHT_PREPROD_BLOCKFROST_PROJECT_ID'
  | 'VITE_MIDNIGHT_PREPROD_MPC_ROOT_PUBLIC_KEY'
  | 'VITE_MIDNIGHT_PREPROD_SIGNER_CONTRACT_ADDRESS'
  | 'VITE_MIDNIGHT_PREPROD_RESPONDER_CONTRACT_ADDRESS'
  | 'VITE_MIDNIGHT_PREPROD_MPC_OUTPUT_CACHE_URL'
  | 'VITE_MIDNIGHT_PREPROD_SIGNET_EVENTS_FROM_BLOCK'
>

/**
 * Reads preprod's endpoints, MPC root public key, signet signer and responder addresses, MPC
 * output cache URL and the block their events are read from. The endpoints are the Blockfrost
 * ones carrying the project token, or empty strings while it is unset or empty. Any other unset
 * or empty variable yields the value the SDK publishes for preprod, and for the block the default
 * window (see `signetEventsFromBlock`).
 *
 * @throws {Error} When a set variable is not a valid token, key, address, http URL or block
 *   height.
 */
export function parseMidnightPreprodEnv(
  env: MidnightPreprodEnv,
): Pick<
  MidnightNetworkConfig,
  | 'indexerUrl'
  | 'indexerWsUrl'
  | 'nodeUrl'
  | 'mpcRootPublicKey'
  | 'signerContractAddress'
  | 'responderContractAddress'
  | 'mpcOutputCacheUrl'
  | 'signetEventsFromBlock'
> {
  const projectId = readOptionalEnv(
    env,
    'VITE_MIDNIGHT_PREPROD_BLOCKFROST_PROJECT_ID',
    normaliseBlockfrostProjectId,
  )
  const withProjectId = (url: string): string =>
    projectId === '' ? '' : `${url}?project_id=${encodeURIComponent(projectId)}`
  return {
    indexerUrl: withProjectId(PREPROD_BLOCKFROST_URLS.indexerUrl),
    indexerWsUrl: withProjectId(PREPROD_BLOCKFROST_URLS.indexerWsUrl),
    nodeUrl: withProjectId(PREPROD_BLOCKFROST_URLS.nodeUrl),
    mpcRootPublicKey:
      readOptionalEnv(
        env,
        'VITE_MIDNIGHT_PREPROD_MPC_ROOT_PUBLIC_KEY',
        normaliseSecp256k1PublicKey,
      ) || getMpcRootPublicKey(MidnightNetwork.Preprod),
    signerContractAddress:
      readOptionalEnv(
        env,
        'VITE_MIDNIGHT_PREPROD_SIGNER_CONTRACT_ADDRESS',
        normaliseContractAddressHex,
      ) || getSignerContractAddress(MidnightNetwork.Preprod),
    responderContractAddress:
      readOptionalEnv(
        env,
        'VITE_MIDNIGHT_PREPROD_RESPONDER_CONTRACT_ADDRESS',
        normaliseContractAddressHex,
      ) || getResponderContractAddress(MidnightNetwork.Preprod),
    mpcOutputCacheUrl:
      readOptionalEnv(env, 'VITE_MIDNIGHT_PREPROD_MPC_OUTPUT_CACHE_URL', normaliseHttpUrl) ||
      getMpcOutputCacheUrl(MidnightNetwork.Preprod),
    signetEventsFromBlock: readOptionalEnv(
      env,
      'VITE_MIDNIGHT_PREPROD_SIGNET_EVENTS_FROM_BLOCK',
      normaliseSignetEventsFromBlock,
    ),
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
  // TODO: populate for this network once released to these networks
  [MidnightNetwork.Preview]: {
    indexerUrl: 'https://indexer.preview.midnight.network/api/v4/graphql',
    indexerWsUrl: 'wss://indexer.preview.midnight.network/api/v4/graphql/ws',
    nodeUrl: 'https://rpc.preview.midnight.network',
    mpcRootPublicKey: '',
    signerContractAddress: '',
    responderContractAddress: '',
    ...EVM_RPC_DEFAULTS,
    mpcOutputCacheUrl: '',
    signetEventsFromBlock: '',
  },
  [MidnightNetwork.Preprod]: {
    ...parseMidnightPreprodEnv(EXPLORER_ENV),
    ...EVM_RPC_DEFAULTS,
  },
  // TODO: populate for this network once released to these networks
  [MidnightNetwork.Mainnet]: {
    indexerUrl: 'https://indexer.mainnet.midnight.network/api/v4/graphql',
    indexerWsUrl: 'wss://indexer.mainnet.midnight.network/api/v4/graphql/ws',
    nodeUrl: 'https://rpc.mainnet.midnight.network',
    mpcRootPublicKey: '',
    signerContractAddress: '',
    responderContractAddress: '',
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
 * Reads the network the app opens on. An unset or empty variable yields preprod.
 *
 * @throws {Error} When the variable is set to anything but a network id.
 */
export function parseMidnightDefaultNetworkEnv(env: MidnightDefaultNetworkEnv): MidnightNetwork {
  const value = env.VITE_MIDNIGHT_DEFAULT_NETWORK?.trim() ?? ''
  if (value === '') {
    return MidnightNetwork.Preprod
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
