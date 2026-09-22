import { MpcOutputCacheReader, type RequestIdHex } from '@sig-net/midnight'

/** Where one network's attested outputs are read from. */
export interface MpcOutputCacheLocation {
  readonly cacheUrl: string
  readonly networkId: string
  readonly signetContractAddress: string
}

const outputs = new Map<string, Promise<Uint8Array>>()

/**
 * The serialised output the MPC cached for `requestId`, once per cache and request: the MPC writes
 * each object once, so every later call shares the first result. UNTRUSTED until an attestation
 * verifies over it. Rejects when the cache holds no object yet, cannot be reached, or refuses the
 * browser, and a rejected read is forgotten, so the next call retries.
 */
export function loadMpcCachedOutput(
  location: MpcOutputCacheLocation,
  requestId: RequestIdHex,
): Promise<Uint8Array> {
  const key = JSON.stringify([location, requestId])
  let output = outputs.get(key)
  if (output === undefined) {
    output = new MpcOutputCacheReader(location).fetchSerializedOutput(requestId).then((bytes) => {
      if (bytes === undefined) {
        throw new Error('the MPC output cache holds no output for this request')
      }
      return bytes
    })
    output.catch(() => outputs.delete(key))
    outputs.set(key, output)
  }
  return output
}
