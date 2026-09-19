import { expect, test } from 'vitest'

import { deriveRequestSigningKey } from './request-signing-key'

const MPC_ROOT_PUBLIC_KEY =
  '0x04715f51662249e34979be813de068bf6d73d6abcb8b2ed34f3d4c5311cc5a1365079b3b3e16681054e1be38bff104a231bf25c8d0594d5367cbaf3d204ce1e07a'
const REQUEST = {
  sender: { bytes: new Uint8Array(32).fill(0x3a) },
  path: new Uint8Array(32).fill(0x5d),
}

test('a valid root key derives an uncompressed public key and its address', () => {
  const key = deriveRequestSigningKey(MPC_ROOT_PUBLIC_KEY, REQUEST)
  expect(key?.publicKey).toMatch(/^0x04[0-9a-f]{128}$/u)
  expect(key?.evmAddress).toMatch(/^0x[0-9a-fA-F]{40}$/u)
})

test.for(['', 'not a key'])('the root key %j derives nothing', (mpcRootPublicKey) => {
  expect(deriveRequestSigningKey(mpcRootPublicKey, REQUEST)).toBeNull()
})
