import { createExplorerApiClient, type ExplorerService } from '@sig-net/explorer-api'

import { EXPLORER_ENV } from '@/lib/explorer-env'

/**
 * The client of the explorer API that `VITE_EXPLORER_API_URL` names, or null when it is unset or
 * not an http or https URL.
 */
export const EXPLORER_API_CLIENT: ExplorerService | null = explorerApiClient(
  EXPLORER_ENV.VITE_EXPLORER_API_URL,
)

/** `value` as an http or https URL, or null when it is empty or not one. */
export function parseExplorerApiUrl(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  if (!URL.canParse(trimmed)) {
    return null
  }
  const url = new URL(trimmed)
  return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
}

function explorerApiClient(configuredUrl: string | undefined): ExplorerService | null {
  const baseUrl = parseExplorerApiUrl(configuredUrl)
  return baseUrl === null ? null : createExplorerApiClient({ baseUrl })
}
