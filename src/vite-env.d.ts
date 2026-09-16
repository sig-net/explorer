/// <reference types="vite/client" />

interface ViteTypeOptions {
  // Undeclared `import.meta.env` keys are a type error instead of `any`.
  strictImportMetaEnv: unknown
}

interface ImportMetaEnv {
  readonly VITE_MIDNIGHT_UNDEPLOYED_MPC_ROOT_PUBLIC_KEY?: string
  readonly VITE_MIDNIGHT_UNDEPLOYED_SIGNET_CONTRACT_ADDRESS?: string
}
