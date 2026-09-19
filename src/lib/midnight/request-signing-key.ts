import {
  deriveSignBidirectionalEventSignerEvmAddress,
  deriveSignBidirectionalEventSigningKey,
  formatSecp256k1PublicKey,
  type SignBidirectionalEventKeySelector,
} from '@sig-net/midnight'

import { parseMpcRootPublicKey } from '@/lib/midnight/network'

/** The key the MPC signs a request's transaction with. */
export interface RequestSigningKey {
  /** Uncompressed SEC1 hex with a `0x` prefix. */
  readonly publicKey: string
  readonly evmAddress: string
}

/** A request's signing key, or null while the configured MPC root public key is not a valid key. */
export function deriveRequestSigningKey(
  mpcRootPublicKey: string,
  request: SignBidirectionalEventKeySelector,
): RequestSigningKey | null {
  const rootKey = parseMpcRootPublicKey(mpcRootPublicKey)
  return rootKey === null
    ? null
    : {
        publicKey: formatSecp256k1PublicKey(
          deriveSignBidirectionalEventSigningKey(rootKey, request),
        ),
        evmAddress: deriveSignBidirectionalEventSignerEvmAddress(rootKey, request),
      }
}
