import {
  signBidirectionalEventToSignedEvmTransaction,
  type SignatureRespondedEvent,
  type SignBidirectionalEvent,
  verifySignatureRespondedEvent,
} from '@sig-net/midnight'

import { deriveRequestSigningKey, type RequestSigningKey } from '@/lib/midnight/request-signing-key'

/** Whether a posted signature is by the signing key of one request. */
export type SignatureCheck =
  /** The configured MPC root public key is not a valid key, so the request has no key to check. */
  | { readonly status: 'no-root-key' }
  /** The signature, over the request's transaction, recovers to another key. */
  | { readonly status: 'invalid'; readonly signingKey: RequestSigningKey }
  | {
      readonly status: 'valid'
      readonly signingKey: RequestSigningKey
      /**
       * The hash the request's transaction has on its EVM chain once signed with this signature. The
       * signature is part of the hashed bytes, so a request has no such hash on its own.
       */
      readonly evmTransactionHash: string
      /** The signed transaction as the raw hex a node's `eth_sendRawTransaction` takes. */
      readonly signedEvmTransaction: string
    }

export function checkSignature(
  mpcRootPublicKey: string,
  request: SignBidirectionalEvent,
  response: SignatureRespondedEvent,
): SignatureCheck {
  const signingKey = deriveRequestSigningKey(mpcRootPublicKey, request)
  if (signingKey === null) {
    return { status: 'no-root-key' }
  }
  if (!verifySignatureRespondedEvent(request, response, signingKey.evmAddress)) {
    return { status: 'invalid', signingKey }
  }
  const { hash, serialized } = signBidirectionalEventToSignedEvmTransaction(request, response)
  if (hash === null) {
    throw new Error('a signed transaction has a hash')
  }
  return {
    status: 'valid',
    signingKey,
    evmTransactionHash: hash,
    signedEvmTransaction: serialized,
  }
}
