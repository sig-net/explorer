import { textWithoutUrlCredentials } from '@sig-net/explorer-api'

import { type BackendLogEntry, startBackend, wipeNetwork } from './backend.ts'
import { type BackendConfig, parseBackendEnv } from './config/backend-env.ts'
import { inspectTransactionForStorage } from './inspection/sign-bidirectional-transaction-inspection.ts'
import { createIndexerSource } from './source/indexer/indexer-source.ts'

const USAGE = `usage:
  node packages/backend/src/main.ts                         serve the API and index every configured network
  node packages/backend/src/main.ts wipe-network <network>  drop one network's schema and migrate it again`

await main(process.argv.slice(2))

async function main(args: readonly string[]): Promise<void> {
  const [command, network] = args
  const isWipe = command === 'wipe-network' && network !== undefined && args.length === 2
  if (args.length > 0 && !isWipe) {
    console.error(USAGE)
    process.exit(1)
  }
  let config: BackendConfig
  try {
    config = parseBackendEnv(process.env)
  } catch (error) {
    console.error(errorMessage(error))
    process.exit(1)
  }
  if (isWipe) {
    try {
      console.log(`dropped and migrated the schema ${await wipeNetwork(config, network)}`)
      process.exit(0)
    } catch (error) {
      console.error(errorMessage(error))
      process.exit(1)
    }
  }
  try {
    const backend = await startBackend(config, {
      createSource: ({ config: { sourceUrl, signerContractAddress, responderContractAddress } }) =>
        createIndexerSource({
          queryUrl: sourceUrl,
          signerContractAddress,
          responderContractAddress,
        }),
      inspect: inspectTransactionForStorage,
      log,
    })
    const stopAndExit = (): void => {
      backend.stop().then(
        () => process.exit(0),
        () => process.exit(1),
      )
    }
    process.once('SIGTERM', stopAndExit)
    process.once('SIGINT', stopAndExit)
    await backend.started
  } catch {
    // startBackend has logged why.
    process.exit(1)
  }
}

function log(entry: BackendLogEntry): void {
  console.log(JSON.stringify({ time: new Date().toISOString(), ...entry }))
}

function errorMessage(error: unknown): string {
  return textWithoutUrlCredentials(error instanceof Error ? error.message : String(error))
}
