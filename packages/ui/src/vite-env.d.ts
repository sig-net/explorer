/// <reference types="vite/client" />

interface ViteTypeOptions {
  // Undeclared `import.meta.env` keys are a type error instead of `any`.
  strictImportMetaEnv: unknown
}

interface ImportMetaEnv {
  /** Defined by `vite.config.ts` for every build, never read from an env file. */
  readonly VITE_EXPLORER_VERSION: string
  /** The explorer API's http or https URL, without the `/v1` of its routes. */
  readonly VITE_EXPLORER_API_URL?: string
  readonly VITE_MIDNIGHT_DEFAULT_NETWORK?: string
  readonly VITE_MIDNIGHT_ETHEREUM_MAINNET_RPC_URL?: string
  readonly VITE_MIDNIGHT_ETHEREUM_SEPOLIA_RPC_URL?: string
  readonly VITE_MIDNIGHT_PREPROD_MPC_OUTPUT_CACHE_URL?: string
  readonly VITE_MIDNIGHT_PREPROD_MPC_ROOT_PUBLIC_KEY?: string
  readonly VITE_MIDNIGHT_UNDEPLOYED_MPC_ROOT_PUBLIC_KEY?: string
}
