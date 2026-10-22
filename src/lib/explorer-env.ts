/** The explorer's own configuration variables: the `VITE_MIDNIGHT_` keys of `ImportMetaEnv`. */
export type ExplorerEnv = Pick<ImportMetaEnv, ExplorerEnvKey>

type ExplorerEnvKey = Extract<keyof ImportMetaEnv, `VITE_MIDNIGHT_${string}`>

declare global {
  interface Window {
    /** Set by `env.js`, which a container's entrypoint writes from its environment. */
    explorerEnv?: unknown
  }
}

/**
 * The variables `runtime` sets: the string values under known keys of an object, and nothing
 * from any other value. The page's `env.js` is external input until it is read here.
 */
export function parseRuntimeExplorerEnv(runtime: unknown): Partial<ExplorerEnv> {
  if (typeof runtime !== 'object' || runtime === null) {
    return {}
  }
  const read = (key: ExplorerEnvKey): string | undefined => {
    const value: unknown = Object.hasOwn(runtime, key) ? Reflect.get(runtime, key) : undefined
    return typeof value === 'string' ? value : undefined
  }
  // Every key, so a key added to `ImportMetaEnv` without an entry here is a type error.
  const values: Record<ExplorerEnvKey, string | undefined> = {
    VITE_MIDNIGHT_DEFAULT_NETWORK: read('VITE_MIDNIGHT_DEFAULT_NETWORK'),
    VITE_MIDNIGHT_ETHEREUM_MAINNET_RPC_URL: read('VITE_MIDNIGHT_ETHEREUM_MAINNET_RPC_URL'),
    VITE_MIDNIGHT_ETHEREUM_SEPOLIA_RPC_URL: read('VITE_MIDNIGHT_ETHEREUM_SEPOLIA_RPC_URL'),
    VITE_MIDNIGHT_STAGENET_MPC_OUTPUT_CACHE_URL: read(
      'VITE_MIDNIGHT_STAGENET_MPC_OUTPUT_CACHE_URL',
    ),
    VITE_MIDNIGHT_STAGENET_MPC_ROOT_PUBLIC_KEY: read('VITE_MIDNIGHT_STAGENET_MPC_ROOT_PUBLIC_KEY'),
    VITE_MIDNIGHT_STAGENET_SIGNET_CONTRACT_ADDRESS: read(
      'VITE_MIDNIGHT_STAGENET_SIGNET_CONTRACT_ADDRESS',
    ),
    VITE_MIDNIGHT_STAGENET_SIGNET_EVENTS_FROM_BLOCK: read(
      'VITE_MIDNIGHT_STAGENET_SIGNET_EVENTS_FROM_BLOCK',
    ),
    VITE_MIDNIGHT_UNDEPLOYED_MPC_ROOT_PUBLIC_KEY: read(
      'VITE_MIDNIGHT_UNDEPLOYED_MPC_ROOT_PUBLIC_KEY',
    ),
    VITE_MIDNIGHT_UNDEPLOYED_SIGNET_CONTRACT_ADDRESS: read(
      'VITE_MIDNIGHT_UNDEPLOYED_SIGNET_CONTRACT_ADDRESS',
    ),
  }
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined))
}

/**
 * The explorer's variables: those inlined at build time from the env files, then those `env.js`
 * sets at load time, which win.
 */
export const EXPLORER_ENV: ExplorerEnv = {
  ...import.meta.env,
  ...parseRuntimeExplorerEnv(window.explorerEnv),
}
