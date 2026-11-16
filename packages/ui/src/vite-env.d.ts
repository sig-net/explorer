/// <reference types="vite/client" />

interface ViteTypeOptions {
  // Undeclared `import.meta.env` keys are a type error instead of `any`.
  strictImportMetaEnv: unknown
}

interface ImportMetaEnv {
  /** Defined by `vite.config.ts` for every build, never read from an env file. */
  readonly VITE_EXPLORER_VERSION: string
  readonly VITE_MIDNIGHT_DEFAULT_NETWORK?: string
  readonly VITE_MIDNIGHT_ETHEREUM_MAINNET_RPC_URL?: string
  readonly VITE_MIDNIGHT_ETHEREUM_SEPOLIA_RPC_URL?: string
  readonly VITE_MIDNIGHT_PREPROD_BLOCKFROST_PROJECT_ID?: string
  readonly VITE_MIDNIGHT_PREPROD_MPC_OUTPUT_CACHE_URL?: string
  readonly VITE_MIDNIGHT_PREPROD_MPC_ROOT_PUBLIC_KEY?: string
  readonly VITE_MIDNIGHT_PREPROD_RESPONDER_CONTRACT_ADDRESS?: string
  readonly VITE_MIDNIGHT_PREPROD_SIGNER_CONTRACT_ADDRESS?: string
  readonly VITE_MIDNIGHT_PREPROD_SIGNET_EVENTS_FROM_BLOCK?: string
  readonly VITE_MIDNIGHT_UNDEPLOYED_MPC_ROOT_PUBLIC_KEY?: string
  readonly VITE_MIDNIGHT_UNDEPLOYED_RESPONDER_CONTRACT_ADDRESS?: string
  readonly VITE_MIDNIGHT_UNDEPLOYED_SIGNER_CONTRACT_ADDRESS?: string
}
