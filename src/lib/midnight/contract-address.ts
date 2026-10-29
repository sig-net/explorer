import { contractAddressFromHex } from '@sig-net/midnight'

/**
 * A contract address as the SDK records a caller: lowercase hex without `0x`. Null when `input`
 * is not 32 bytes of hex, with or without the prefix and surrounding space.
 */
export function parseContractAddressHex(input: string): string | null {
  const digits = input.trim().toLowerCase().replace(/^0x/, '')
  try {
    contractAddressFromHex(digits)
  } catch {
    return null
  }
  return digits
}
