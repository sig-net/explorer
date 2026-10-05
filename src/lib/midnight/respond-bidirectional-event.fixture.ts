import { hexToBytes, OutputKind, type RespondBidirectionalEvent } from '@sig-net/midnight'

// Attestations for STAGENET_REQUEST, minted in Node with `attestRespondBidirectional` from
// `@sig-net/midnight/testing`, which does not run in a browser.

/** The public key of the root secret key 0x11 repeated 32 times. */
export const FIXTURE_MPC_ROOT_KEY =
  '0x044f355bdcb7cc0af728ef3cceb9615d90684bb5b2ca5f859ab0f0b704075871aa385b6b1b8ead809ca67454d9683fcf2ba03456d6fe2c4abe2b07f0fbdbb2f1c1'

/** The response key {@link FIXTURE_MPC_ROOT_KEY} derives for the request's sender. */
export const FIXTURE_RESPONSE_KEY =
  '0x04be1b56c960a46412c14d490b60d347b973fd2b1b49afda3a13abb3ea723f4f870a5c120e28a9a89a3aa4ace727e3206ae61e55407e2495554418a5dbd2887060'

export const FIXTURE_BLOCK_HEIGHT = 9_000_000n

const REQUEST_ID = hexToBytes('52342beeb51a2437dc09369c4fbf84bf61dedc236c66ab023e36dce207d7df00')

/** Over the single byte 1: the ERC20 transfer's `true`, Borsh serialised. */
export const EXECUTED_TRUE_ATTESTATION: RespondBidirectionalEvent = {
  requestId: REQUEST_ID,
  blockHeight: FIXTURE_BLOCK_HEIGHT,
  outputKind: OutputKind.executed,
  serializedOutputLength: 1n,
  digest: hexToBytes('b535d3dbe0c02f7f6dd223de8674a7582bf36df1d0af18eab4b523f6ba245400'),
  signature: {
    bigR: {
      x: hexToBytes('a21d5444d799d1368feb75cdc199f6c74321deba9317b45e519b68f1e8af3f65'),
      y: hexToBytes('d43f086f7e554612b5a72f4013863944cccf3aee376d4c1d304ba54adfe7584d'),
    },
    s: hexToBytes('40981ef951136e45540c734b708cb52c685da64a95a8a1deb041476f1e529419'),
    recoveryId: 1n,
  },
}

/** One attestation per output kind, each over an empty output. */
export const EMPTY_OUTPUT_ATTESTATIONS: Record<OutputKind, RespondBidirectionalEvent> = {
  [OutputKind.executed]: {
    requestId: REQUEST_ID,
    blockHeight: FIXTURE_BLOCK_HEIGHT,
    outputKind: OutputKind.executed,
    serializedOutputLength: 0n,
    digest: hexToBytes('acd763526e41571038218c8dfbd7f3ca1313277413dd05c9d011d546e7a7e700'),
    signature: {
      bigR: {
        x: hexToBytes('370adf5ff1d13e99de1220387c263312822521bf966741a9a857fbfb60a99849'),
        y: hexToBytes('b94b6dd3eb67ef314579c9172a9d76d84a27c53c7af4d92251469234370b793b'),
      },
      s: hexToBytes('777ef5b76a4e6c9d03ef910575dc4fbb222f50feae722619421c57bc5770b29e'),
      recoveryId: 1n,
    },
  },
  [OutputKind.failed]: {
    requestId: REQUEST_ID,
    blockHeight: FIXTURE_BLOCK_HEIGHT,
    outputKind: OutputKind.failed,
    serializedOutputLength: 0n,
    digest: hexToBytes('c057fba2fcc1c9b44954c54b960b9d596a4d2e8d5b5ea7ee96d877fd5af86500'),
    signature: {
      bigR: {
        x: hexToBytes('a1304afe6d5418e37af69d263dfa506ef4c981e9345a43c100fe507a37d6fe50'),
        y: hexToBytes('d86124cc0f7e4219889ba4613404031fe4f3a0743105877dde215d4696f54ced'),
      },
      s: hexToBytes('6ab6864c3c3a6b205b8877f5257729690c834def1bfd254eedf448a71aa6c9e2'),
      recoveryId: 1n,
    },
  },
  [OutputKind.unviable]: {
    requestId: REQUEST_ID,
    blockHeight: FIXTURE_BLOCK_HEIGHT,
    outputKind: OutputKind.unviable,
    serializedOutputLength: 0n,
    digest: hexToBytes('84815456a3a9c6a6f8f685afbc9b7794b870b50637cba3bf20fb69efe3237600'),
    signature: {
      bigR: {
        x: hexToBytes('250513abcb9f511e9bcbbac1050a18d868701da711a074d0868818a0109c8867'),
        y: hexToBytes('484a46c4511ff22d29872a47c6e88e618d31263caef36d4661c4a03c187f5cbd'),
      },
      s: hexToBytes('0313eac9f58113d563977a12a087459bfd9ac81095096d3181acf0cc4cdbf24c'),
      recoveryId: 1n,
    },
  },
}

/** A failed attestation over an empty output, by the secret key 0x22 repeated 32 times. */
export const FOREIGN_KEY_ATTESTATION: RespondBidirectionalEvent = {
  requestId: REQUEST_ID,
  blockHeight: FIXTURE_BLOCK_HEIGHT,
  outputKind: OutputKind.failed,
  serializedOutputLength: 0n,
  digest: hexToBytes('c057fba2fcc1c9b44954c54b960b9d596a4d2e8d5b5ea7ee96d877fd5af86500'),
  signature: {
    bigR: {
      x: hexToBytes('4c9944fbc4ec494b4d79d77362d419c23d740d7d15b21858342b1ab98a0db73e'),
      y: hexToBytes('34b56f218c69182f0f37bb85442092eb5641398d5fd0cae4e055428a95ddda35'),
    },
    s: hexToBytes('62fd6c07bb69bf5bb63d01eaf6ec0ad9dee89590d1f6937cb99d259c20f78eee'),
    recoveryId: 1n,
  },
}
