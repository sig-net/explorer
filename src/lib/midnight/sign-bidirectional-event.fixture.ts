import { asciiPadded, hexToBytes, type SignBidirectionalEvent } from '@sig-net/midnight'

/**
 * Stagenet request ee79...ae00, whose transaction is on Sepolia. The two schema widths are
 * arbitrary: the signed digest covers `txParams` alone.
 */
export const STAGENET_REQUEST: SignBidirectionalEvent = {
  sender: { bytes: hexToBytes('3a1868070c64f8a584b532cb211a10972711dd0a1aa456b085b3b62e2db9008f') },
  requestNonce: 1n,
  keyVersion: 1n,
  path: hexToBytes('5d5716183abae0b5a812ae48b1c40759ba80530874b37322637a63283d89a081'),
  algo: 0,
  dest: 0,
  params: new Uint8Array(64),
  txParamType: 0,
  txParams: {
    chainId: 11155111n,
    nonce: 0n,
    maxPriorityFeePerGas: 1000000000n,
    maxFeePerGas: 30000000000n,
    gasLimit: 100000n,
    to: hexToBytes('575547b4b43a10086c8e812588c43b57a6406289'),
    value: 0n,
    calldata: {
      is_some: true,
      value: {
        selector: hexToBytes('a9059cbb'),
        noWords: 2n,
        words: [
          hexToBytes('00000000000000000000000043b14b01223465fecb212c83f96dba6e167ad7db'),
          hexToBytes('00000000000000000000000000000000000000000000000000000000000f4240'),
          new Uint8Array(32),
        ],
      },
    },
    accessListEntryCount: 0n,
    accessList: [],
  },
  caip2Id: asciiPadded('eip155:1', 32),
  outputDeserializationSchema: asciiPadded('[{"name":"success","type":"bool"}]', 64),
  respondSerializationSchema: asciiPadded('[{"name":"success","type":"bool"}]', 64),
}
