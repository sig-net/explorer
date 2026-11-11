import { bytesToHex, contractAddressFromHex } from '@sig-net/midnight'

/**
 * A contract address in the form the indexer takes and the SDK records a caller in: 64 lowercase
 * hex digits without `0x`. Null when `input` is not 32 bytes of hex, with or without the prefix
 * and surrounding space.
 */
export function parseContractAddressHex(input: string): string | null {
  try {
    return normaliseContractAddressHex(input)
  } catch {
    return null
  }
}

/**
 * The form {@link parseContractAddressHex} gives a contract address.
 *
 * @throws {Error} When the value is not 32 bytes of hex.
 */
export function normaliseContractAddressHex(input: string): string {
  return bytesToHex(contractAddressFromHex(input.trim()).bytes)
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
