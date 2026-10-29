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

/**
 * The distinct contract addresses in a comma-separated list, each in canonical form and in the
 * order first listed. An entry that is not a contract address is left out.
 */
export function parseContractAddressesHex(input: string): string[] {
  const addresses: string[] = []
  for (const entry of input.split(',')) {
    const address = parseContractAddressHex(entry)
    if (address !== null && !addresses.includes(address)) {
      addresses.push(address)
    }
  }
  return addresses
}
