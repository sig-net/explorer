import {
  getMpcRootPublicKey,
  hexToBytes,
  MidnightNetwork,
  type SignatureRespondedEvent,
} from '@sig-net/midnight'
import { expect, test } from 'vitest'

import { STAGENET_REQUEST as REQUEST } from './sign-bidirectional-event.fixture'
import { checkSignature } from './signature-check'

// Two of the signatures posted for the stagenet request: the first is the MPC's, the second
// declares the same request id but is by another key.
const MPC_RESPONSE: SignatureRespondedEvent = {
  signature: {
    bigR: {
      x: hexToBytes('5399e44261c553b474396726a12b361a1ceec85988dfae3fbfc9935f8b3e20ce'),
      y: hexToBytes('07298cddfd3f24215700abd074ae1b5e1a6fc795dbedd75f78952218e26fcc9e'),
    },
    s: hexToBytes('77cf5968439ef22a5b9528b8e6c1e2a4725281847e2d7d908eaf8fe2020fb132'),
    recoveryId: 1n,
  },
}

const FOREIGN_RESPONSE: SignatureRespondedEvent = {
  signature: {
    bigR: {
      x: hexToBytes('4fc634397434856b2b4d5bdda98a341c644671871bba483f4e741185add33460'),
      y: hexToBytes('144ed4e92179d0cab798c4d2718d0708886e2e8f4ff9a2ffa2e8d19e40bf8e67'),
    },
    s: hexToBytes('02fde60d4ae4f0abb4e3a230bba948aa7df63910469bd272adfe2fb354a13965'),
    recoveryId: 0n,
  },
}

const STAGENET_ROOT_KEY = getMpcRootPublicKey(MidnightNetwork.Stagenet)
const SIGNING_KEY = {
  publicKey:
    '0x043e077b539825060243d0bd86fdc2a5587c0733dfe1bf7fea8bd77206301ba7e11e0c2bcfceb32cd3df17a0597712ea5d9a07ab240f7d1db2529c77473db1bdd6',
  evmAddress: '0xCAE822d4c5858b5d8E3b648E008c0Af7577e7B59',
}

test('the MPC signature is valid and yields the hash the transaction has on Sepolia', () => {
  expect(checkSignature(STAGENET_ROOT_KEY, REQUEST, MPC_RESPONSE)).toEqual({
    status: 'valid',
    signingKey: SIGNING_KEY,
    evmTransactionHash: '0x84e8c369f283eb7ca26693d0db2092e121407d140a9a4657ac7780182f963f13',
    // Its Keccak-256 is the hash above.
    signedEvmTransaction:
      '0x02f8b483aa36a780843b9aca008506fc23ac00830186a094575547b4b43a10086c8e812588c43b57a640628980b844a9059cbb00000000000000000000000043b14b01223465fecb212c83f96dba6e167ad7db00000000000000000000000000000000000000000000000000000000000f4240c001a05399e44261c553b474396726a12b361a1ceec85988dfae3fbfc9935f8b3e20cea077cf5968439ef22a5b9528b8e6c1e2a4725281847e2d7d908eaf8fe2020fb132',
  })
})

test('a signature by another key is invalid', () => {
  expect(checkSignature(STAGENET_ROOT_KEY, REQUEST, FOREIGN_RESPONSE)).toEqual({
    status: 'invalid',
    signingKey: SIGNING_KEY,
  })
})

test('the MPC signature is not valid for the same request on another path', () => {
  const check = checkSignature(
    STAGENET_ROOT_KEY,
    { ...REQUEST, path: new Uint8Array(32) },
    MPC_RESPONSE,
  )
  expect(check.status).toBe('invalid')
})

test('an invalid root key leaves nothing to check against', () => {
  expect(checkSignature('not a key', REQUEST, MPC_RESPONSE)).toEqual({ status: 'no-root-key' })
})
