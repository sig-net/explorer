// Probe (gate of stage 03): does the request record survive the wire as the cell the transcript
// wrote? Takes the cell from the preprod fixture transaction, sends it through JSON (atoms as hex,
// the alignment as it is), decodes both ends with the SDK and compares. Run from the repository
// root: node agent-work/probes/request-cell-wire.mjs. With --wire it prints the wire cell alone.
import { Transaction } from '@midnightntwrk/ledger-v9'
import { bytesToHex, calculateRequestId, decodeEvmType2SignBidirectionalEvent, hexToBytes } from '@sig-net/midnight'
import { SIGN_BIDIRECTIONAL_RAW_TRANSACTION_HEX } from '../../packages/ui/src/lib/midnight/sign-bidirectional-transaction-inspection.fixture.ts'

const REQUEST_ID = '54f6494883830237e14f8fe4e0cb14ec0c6b06046a5b8b42ffa8478564388300'
const transaction = Transaction.deserialize('signature', 'proof', 'binding', hexToBytes(SIGN_BIDIRECTIONAL_RAW_TRANSACTION_HEX))
const calls = Array.from(transaction.intents?.values() ?? []).flatMap((intent) => intent.actions.filter((a) => 'entryPoint' in a))
const cells = calls
  .flatMap((call) => [call.guaranteedTranscript, call.fallibleTranscript].filter(Boolean))
  .flatMap((transcript) => transcript.program)
  .flatMap((op) => (typeof op === 'object' && 'push' in op && op.push.value.tag === 'cell' ? [op.push.value.content] : []))
const idOf = (cell) => { try { return bytesToHex(calculateRequestId(decodeEvmType2SignBidirectionalEvent(cell, 'probe'))) } catch { return null } }
const cell = cells.find((candidate) => idOf(candidate) === REQUEST_ID)
if (!cell) { console.log(JSON.stringify({ cellFound: false })); process.exit(1) }

const plain = (value) => JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? `${v}n` : v instanceof Uint8Array ? bytesToHex(v) : v))
const wire = JSON.stringify({ value: cell.value.map((atom) => bytesToHex(atom)), alignment: cell.alignment })
if (process.argv.includes('--wire')) { console.log(wire); process.exit(0) }
const parsed = JSON.parse(wire)
const back = { value: parsed.value.map((atom) => hexToBytes(atom)), alignment: parsed.alignment }
const before = decodeEvmType2SignBidirectionalEvent(cell, 'probe')
const after = decodeEvmType2SignBidirectionalEvent(back, 'probe')
const result = {
  cellFound: true,
  atoms: cell.value.length,
  emptyAtoms: cell.value.filter((atom) => atom.length === 0).length,
  wireBytes: wire.length,
  alignmentIsPlainJson: plain(cell.alignment) === plain(parsed.alignment),
  decodedEqual: plain(before) === plain(after),
  requestIdAfter: bytesToHex(calculateRequestId(after)),
  lossless: plain(before) === plain(after) && bytesToHex(calculateRequestId(after)) === REQUEST_ID,
}
console.log(JSON.stringify(result, null, 2))
process.exit(result.lossless ? 0 : 1)
