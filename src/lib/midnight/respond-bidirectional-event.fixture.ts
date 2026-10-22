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

const REQUEST_ID = hexToBytes('7ff28136c33741c0c453461823ef424a5d2af315c48fa4094eb4cac671008c00')

/** Over the single byte 1: the ERC20 transfer's `true`, Borsh serialised. */
export const EXECUTED_TRUE_ATTESTATION: RespondBidirectionalEvent = {
  requestId: REQUEST_ID,
  blockHeight: FIXTURE_BLOCK_HEIGHT,
  outputKind: OutputKind.executed,
  serializedOutputLength: 1n,
  outputHash: hexToBytes('964128a9faf20651ee613e71193d276de06718f194a8517e32805be89e1d6e00'),
  digest: hexToBytes('2fba913ea7d841e829162f6cb61afcc26c96c8c5cb5f0d718604fc97d0a00300'),
  signature: {
    bigR: {
      x: hexToBytes('ee0fbdd6b7af5420f09b18f189ce75648cab37079dcce1efb1d309ace8c832b8'),
      y: hexToBytes('d048914c61662a812c6ef2e27df74c2b669d11e05990c81b1c8164dd00051850'),
    },
    s: hexToBytes('7165ea491441ba64f7d5604be82b0e81ed9b2230cab6962654d4f833fc2ff743'),
    recoveryId: 0n,
  },
}

/** One attestation per output kind, each over an empty output. */
export const EMPTY_OUTPUT_ATTESTATIONS: Record<OutputKind, RespondBidirectionalEvent> = {
  [OutputKind.executed]: {
    requestId: REQUEST_ID,
    blockHeight: FIXTURE_BLOCK_HEIGHT,
    outputKind: OutputKind.executed,
    serializedOutputLength: 0n,
    outputHash: hexToBytes('457658ccd1c76524eb79c8b2b32db01dadf14adf6c74e27d870b31a941bce600'),
    digest: hexToBytes('74f78c7414806592abd1c3ad1aa0c3a4729155291a2547ace533c5cc92f88200'),
    signature: {
      bigR: {
        x: hexToBytes('02da640e10bd095c49890d7c5e0533de6b27cb9038af046e82aa32bbedd74580'),
        y: hexToBytes('6d85bd2badf64c05bffde2d9fde8b77cb61afca323fdc2501fd2e347c1702f0c'),
      },
      s: hexToBytes('0fb44c3a88065a532e2e37efe13490a02fae14b7b32f77b6d6b111a088f516df'),
      recoveryId: 0n,
    },
  },
  [OutputKind.failed]: {
    requestId: REQUEST_ID,
    blockHeight: FIXTURE_BLOCK_HEIGHT,
    outputKind: OutputKind.failed,
    serializedOutputLength: 0n,
    outputHash: hexToBytes('457658ccd1c76524eb79c8b2b32db01dadf14adf6c74e27d870b31a941bce600'),
    digest: hexToBytes('756484f9932b34d716662b500975cfd93c0d796707c516ca2adeb10594d9cc00'),
    signature: {
      bigR: {
        x: hexToBytes('9d6ff79074f8d91dbc21a1d1ce82faac413656dc338780eb4b6abd0a13171069'),
        y: hexToBytes('65046f4769bbed1bdd4a1f697f4dade150d740556daca6a1dd3e4591a78a32eb'),
      },
      s: hexToBytes('5ff6e8106c16cf86bf9b01cee3fea8c3b41f34be0ebfc87ee13d8b8741956c0d'),
      recoveryId: 1n,
    },
  },
  [OutputKind.unviable]: {
    requestId: REQUEST_ID,
    blockHeight: FIXTURE_BLOCK_HEIGHT,
    outputKind: OutputKind.unviable,
    serializedOutputLength: 0n,
    outputHash: hexToBytes('457658ccd1c76524eb79c8b2b32db01dadf14adf6c74e27d870b31a941bce600'),
    digest: hexToBytes('8889c3c061df08901cd9afcc9ec39d0b04997211b778cf4b9f61304fd42a9300'),
    signature: {
      bigR: {
        x: hexToBytes('eb576f03e058a7647977100399b03fd87ac09eb9b3af54e28c993f6a98611510'),
        y: hexToBytes('06e0748c6d36ac840892b37fdb6165698f499e5b333e72d445209d1b253cf656'),
      },
      s: hexToBytes('2f6781c697554c7ff26b423b4269672f684754e82fd1749266d8a682cfe12c3d'),
      recoveryId: 0n,
    },
  },
}

/** A failed attestation over an empty output, by the secret key 0x22 repeated 32 times. */
export const FOREIGN_KEY_ATTESTATION: RespondBidirectionalEvent = {
  requestId: REQUEST_ID,
  blockHeight: FIXTURE_BLOCK_HEIGHT,
  outputKind: OutputKind.failed,
  serializedOutputLength: 0n,
  outputHash: hexToBytes('457658ccd1c76524eb79c8b2b32db01dadf14adf6c74e27d870b31a941bce600'),
  digest: hexToBytes('756484f9932b34d716662b500975cfd93c0d796707c516ca2adeb10594d9cc00'),
  signature: {
    bigR: {
      x: hexToBytes('a765f5133c3f135bf0a9aabc4dc49650a1bdb0c0a09d368302d3fc7324f2cdd6'),
      y: hexToBytes('861d24591a3ee2887e6e862d377c741371ce5033085e843ac87e703fd8707c9a'),
    },
    s: hexToBytes('27079b73abcc141288b0cdba246e53c47888d667dcde43da293332b1909ca896'),
    recoveryId: 0n,
  },
}
