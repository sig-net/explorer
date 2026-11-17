import {
  getMpcOutputCacheUrl,
  getMpcRootPublicKey,
  MidnightNetwork,
  normaliseSecp256k1PublicKey,
} from '@sig-net/midnight'
import { isMidnightNetwork, MIDNIGHT_NETWORKS } from '@sig-net/explorer-lib'

import { EXPLORER_ENV } from '@/lib/explorer-env'

/** What the browser itself reads with, per network, and the user may edit. */
export interface MidnightNetworkConfig {
  mpcRootPublicKey: string
  /** JSON-RPC endpoint asked about requested transactions that target Ethereum mainnet. */
  ethereumMainnetRpcUrl: string
  /** JSON-RPC endpoint asked about requested transactions that target Sepolia. */
  ethereumSepoliaRpcUrl: string
  /**
   * The MPC's output cache down to its object prefix, where attested serialised outputs are read
   * before a transaction is traced. Empty for a network with none.
   */
  mpcOutputCacheUrl: string
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
  'VITE_MIDNIGHT_UNDEPLOYED_MPC_ROOT_PUBLIC_KEY'
>

/**
 * Reads the undeployed network's MPC root public key, which every local stack generates afresh.
 * An unset or empty variable yields an empty string.
 *
 * @throws {Error} When a set variable is not a valid key.
 */
export function parseMidnightUndeployedEnv(
  env: MidnightUndeployedEnv,
): Pick<MidnightNetworkConfig, 'mpcRootPublicKey'> {
  return {
    mpcRootPublicKey: readOptionalEnv(
      env,
      'VITE_MIDNIGHT_UNDEPLOYED_MPC_ROOT_PUBLIC_KEY',
      normaliseSecp256k1PublicKey,
    ),
  }
}

/** The networks the SDK publishes an MPC root public key and an MPC output cache for. */
export type MpcPublishedNetwork = MidnightNetwork.Preview | MidnightNetwork.Preprod

const MPC_ENV_NAMES = {
  [MidnightNetwork.Preview]: {
    mpcRootPublicKey: 'VITE_MIDNIGHT_PREVIEW_MPC_ROOT_PUBLIC_KEY',
    mpcOutputCacheUrl: 'VITE_MIDNIGHT_PREVIEW_MPC_OUTPUT_CACHE_URL',
  },
  [MidnightNetwork.Preprod]: {
    mpcRootPublicKey: 'VITE_MIDNIGHT_PREPROD_MPC_ROOT_PUBLIC_KEY',
    mpcOutputCacheUrl: 'VITE_MIDNIGHT_PREPROD_MPC_OUTPUT_CACHE_URL',
  },
} as const satisfies Record<
  MpcPublishedNetwork,
  Record<'mpcRootPublicKey' | 'mpcOutputCacheUrl', keyof ImportMetaEnv>
>

export type MidnightMpcEnv = Pick<
  ImportMetaEnv,
  (typeof MPC_ENV_NAMES)[MpcPublishedNetwork]['mpcRootPublicKey' | 'mpcOutputCacheUrl']
>

/**
 * Reads a network's MPC root public key and MPC output cache URL. An unset or empty variable
 * yields the value the SDK publishes for the network.
 *
 * @throws {Error} When a set variable is not a valid key or http URL.
 */
export function parseMidnightMpcEnv(
  env: MidnightMpcEnv,
  network: MpcPublishedNetwork,
): Pick<MidnightNetworkConfig, 'mpcRootPublicKey' | 'mpcOutputCacheUrl'> {
  const names = MPC_ENV_NAMES[network]
  return {
    mpcRootPublicKey:
      readOptionalEnv(env, names.mpcRootPublicKey, normaliseSecp256k1PublicKey) ||
      getMpcRootPublicKey(network),
    mpcOutputCacheUrl:
      readOptionalEnv(env, names.mpcOutputCacheUrl, normaliseHttpUrl) ||
      getMpcOutputCacheUrl(network),
  }
}

export const MIDNIGHT_NETWORK_DEFAULTS: Record<MidnightNetwork, MidnightNetworkConfig> = {
  [MidnightNetwork.Undeployed]: {
    ...parseMidnightUndeployedEnv(EXPLORER_ENV),
    ...EVM_RPC_DEFAULTS,
    mpcOutputCacheUrl: '',
  },
  [MidnightNetwork.Preview]: {
    ...parseMidnightMpcEnv(EXPLORER_ENV, MidnightNetwork.Preview),
    ...EVM_RPC_DEFAULTS,
  },
  [MidnightNetwork.Preprod]: {
    ...parseMidnightMpcEnv(EXPLORER_ENV, MidnightNetwork.Preprod),
    ...EVM_RPC_DEFAULTS,
  },
  // TODO: populate for this network once released to it
  [MidnightNetwork.Mainnet]: {
    mpcRootPublicKey: '',
    ...EVM_RPC_DEFAULTS,
    mpcOutputCacheUrl: '',
  },
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
