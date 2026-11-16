import {
  contractCallNodeSchema,
  requestCellWireSchema,
  textWithoutUrlCredentials,
} from '@sig-net/explorer-api'
import {
  decodeSignetContractEvent,
  type SignBidirectionalLifecycle,
  type SignetContractEvent,
} from '@sig-net/explorer-lib'
import { type MidnightNetwork, SignetEventName } from '@sig-net/midnight'
import type { Insertable, Selectable } from 'kysely'
import { z } from 'zod'

import type { ExplorerDatabase } from '../db/database.ts'
import {
  type EventsTable,
  type IngestStateTable,
  type NetworkDatabase,
  networkDb,
  type StoredInspection,
  type TransactionsTable,
} from '../db/schema.ts'
import type { MidnightSource, SourceBlock, SourceBlockId } from '../source/port.ts'

/**
 * Reads the next block range of `settings.network` from the source and stores it. The cursor moves
 * in the SQL transaction that stores the range, and only while the row holds the cursor and the
 * identity this cycle read, so a cycle that does not return `stored` leaves the cursor and the
 * stored events as they were. A
 * failure is recorded as the network's last error and returned: the promise does not reject.
 */
export async function runIngestCycle(
  deps: IngestCycleDependencies,
  settings: IngestCycleSettings,
): Promise<IngestCycleOutcome> {
  const tables = networkDb(deps.db, settings.network)
  try {
    return await readAndStoreRange(tables, deps, settings)
  } catch (error) {
    const message = recordedErrorText(error)
    try {
      await tables.updateTable('ingest_state').set({ last_error: message }).execute()
    } catch {
      // The outcome carries the message when the database cannot record it.
    }
    return { kind: 'failed', error: message }
  }
}

export interface IngestCycleDependencies {
  /** Holds the migrated schema of the cycle's network. */
  readonly db: ExplorerDatabase
  readonly source: MidnightSource
  readonly inspect: InspectTransaction
}

/**
 * Inspects one transaction, given as hex, with every sign bidirectional event it emitted. A throw
 * is stored as the failed inspection of that transaction.
 */
export type InspectTransaction = (
  rawTransactionHex: string,
  notifications: readonly SignBidirectionalNotificationEvent[],
) => StoredInspection

export type SignBidirectionalNotificationEvent =
  SignBidirectionalLifecycle['signBidirectionalEvents'][number]

export interface IngestCycleSettings {
  readonly network: MidnightNetwork
  /** Lower case hex. */
  readonly signerContractAddress: string
  /** Lower case hex. */
  readonly responderContractAddress: string
  /** The first block a network with a null cursor reads. */
  readonly startBlock: number
  /** The most blocks one cycle reads. */
  readonly maxRange: number
  /** How many blocks below the source's finalised tip the cursor stays. */
  readonly tipMargin: number
}

export type IngestCycleOutcome =
  /** The blocks `fromBlock` to `toBlock`, both included, are stored and the cursor is `toBlock`. */
  | {
      readonly kind: 'stored'
      readonly fromBlock: number
      readonly toBlock: number
      readonly events: number
    }
  /** The cursor is at the tip less the margin. */
  | { readonly kind: 'caught-up' }
  /** The source or the settings differ from what the schema was indexed for. */
  | { readonly kind: 'stopped'; readonly reason: string }
  /** The cursor or the identity of the schema changed while this cycle read. */
  | { readonly kind: 'superseded' }
  | { readonly kind: 'failed'; readonly error: string }

const RAW_TRANSACTION_FETCHES_AT_ONCE = 8
const RECORDED_ERROR_MAX_LENGTH = 2000
/** U+0000, which `text` and `jsonb` refuse, and unpaired surrogates, which `jsonb` refuses. */
const REFUSED_CHARACTERS = /[\0\p{Surrogate}]/gu
/**
 * Every escape of a text `JSON.stringify` wrote, matched whole so that an escaped backslash never
 * reads as the start of the next one. Group 1 is set for an escape of a refused character.
 */
const JSON_ESCAPES = /\\(?:u(0000|d[89a-f][0-9a-f]{2})|[^])/g
/** A stored inspection nests at most this deep, so no reader's recursion depends on its stack. */
const STORED_INSPECTION_MAX_DEPTH = 64
/** A stored inspection whose call chains and cells the wire's schemas accept. */
const storedInspectionSchema: z.ZodType<StoredInspection> = z.union([
  z.object({ failed: z.string() }),
  z.object({
    callChains: z.array(contractCallNodeSchema),
    requests: z.record(
      z.string(),
      z.union([
        z.object({ failed: z.string() }),
        z.object({ cell: requestCellWireSchema.nullable() }),
      ]),
    ),
  }),
])
/** Keeps a multi-row statement under PostgreSQL's 65,535 bind parameters. */
const ROWS_PER_STATEMENT = 1000

type IngestState = Selectable<IngestStateTable>
type TransactionRow = Insertable<TransactionsTable>
type EventRow = Insertable<EventsTable>

interface RangeTransaction {
  readonly hash: string
  readonly blockHeight: number
  readonly blockHash: string
  readonly blockTime: Date
  readonly notifications: SignBidirectionalNotificationEvent[]
}

class CursorSuperseded extends Error {}

async function readAndStoreRange(
  tables: NetworkDatabase,
  { source, inspect }: IngestCycleDependencies,
  settings: IngestCycleSettings,
): Promise<IngestCycleOutcome> {
  const sourceGenesisHash = await source.genesisHash()
  const state = await ingestStateOf(tables, sourceGenesisHash, settings)
  const mismatch =
    identityMismatch(state, sourceGenesisHash, settings) ?? (await cursorMismatch(state, source))
  if (mismatch !== null) {
    const reason = recordedErrorText(mismatch)
    await tables.updateTable('ingest_state').set({ state: 'stopped', last_error: reason }).execute()
    return { kind: 'stopped', reason }
  }

  const tip = await source.finalisedTip()
  const cursor = state.cursor_height
  const fromBlock = (cursor ?? settings.startBlock - 1) + 1
  const toBlock = Math.min(tip.height - settings.tipMargin, fromBlock - 1 + settings.maxRange)
  if (toBlock < fromBlock) {
    await tables
      .updateTable('ingest_state')
      .set({
        tip_height: tip.height,
        last_success_at: new Date(),
        last_error: null,
        state: 'synced',
      })
      .execute()
    return { kind: 'caught-up' }
  }
  const cursorBlock = await source.blockAt(toBlock)
  if (cursorBlock === null) {
    throw new Error(`the source holds no block ${String(toBlock)} below its tip`)
  }

  const events = (await source.eventsIn({ fromBlock, toBlock })).map((event) =>
    decodeSignetContractEvent(event.source, event.roles),
  )
  const transactionRows = await inspectedTransactionRows(transactionsOf(events), source, inspect)

  try {
    await tables.transaction().execute(async (transaction) => {
      await moveCursor(transaction, state, toBlock, cursorBlock, tip, settings)
      await storeRange(transaction, transactionRows, events)
    })
  } catch (error) {
    if (error instanceof CursorSuperseded) {
      return { kind: 'superseded' }
    }
    throw error
  }
  return { kind: 'stored', fromBlock, toBlock, events: events.length }
}

/** The network's state row, inserted with a null cursor when the schema holds none. */
async function ingestStateOf(
  tables: NetworkDatabase,
  sourceGenesisHash: string,
  settings: IngestCycleSettings,
): Promise<IngestState> {
  await tables
    .insertInto('ingest_state')
    .values({
      genesis_hash: bytesOfHex(sourceGenesisHash),
      signer_address: bytesOfHex(settings.signerContractAddress),
      responder_address: bytesOfHex(settings.responderContractAddress),
      start_block: settings.startBlock,
      state: 'syncing',
    })
    .onConflict((conflict) => conflict.doNothing())
    .execute()
  return tables.selectFrom('ingest_state').selectAll().executeTakeFirstOrThrow()
}

/** How the source or the settings differ from what the schema was indexed for, or null. */
function identityMismatch(
  state: IngestState,
  sourceGenesisHash: string,
  settings: IngestCycleSettings,
): string | null {
  const indexed = (bytes: Buffer): string => bytes.toString('hex')
  if (!bytesOfHex(sourceGenesisHash).equals(state.genesis_hash)) {
    return `the source's genesis hash is ${sourceGenesisHash} and the schema was indexed for ${indexed(state.genesis_hash)}`
  }
  if (!bytesOfHex(settings.signerContractAddress).equals(state.signer_address)) {
    return `the signer contract address is ${settings.signerContractAddress} and the schema was indexed for ${indexed(state.signer_address)}`
  }
  if (!bytesOfHex(settings.responderContractAddress).equals(state.responder_address)) {
    return `the responder contract address is ${settings.responderContractAddress} and the schema was indexed for ${indexed(state.responder_address)}`
  }
  if (settings.startBlock !== state.start_block) {
    return `the start block is ${String(settings.startBlock)} and the schema was indexed from ${String(state.start_block)}`
  }
  return null
}

/**
 * How the source's block at the cursor differs from the stored one, or null.
 *
 * @throws {Error} When the source's tip is below the cursor: a source that is behind is retried.
 */
async function cursorMismatch(state: IngestState, source: MidnightSource): Promise<string | null> {
  if (state.cursor_height === null || state.cursor_hash === null) {
    return null
  }
  const block = await source.blockAt(state.cursor_height)
  if (block === null) {
    throw new Error(`the source holds no block ${String(state.cursor_height)}, the cursor`)
  }
  return bytesOfHex(block.hash).equals(state.cursor_hash)
    ? null
    : `the source's block ${String(state.cursor_height)} is ${block.hash} and the cursor holds ${state.cursor_hash.toString('hex')}`
}

/** The transactions that emitted `events`, each with the sign bidirectional events it emitted. */
function transactionsOf(events: readonly SignetContractEvent[]): RangeTransaction[] {
  const transactions = new Map<string, RangeTransaction>()
  for (const event of events) {
    const { source } = event
    let transaction = transactions.get(source.transactionHash)
    if (transaction === undefined) {
      transaction = {
        hash: source.transactionHash,
        blockHeight: source.blockHeight,
        blockHash: source.blockHash,
        blockTime: source.blockTimestamp,
        notifications: [],
      }
      transactions.set(source.transactionHash, transaction)
    }
    if (event.kind === 'decoded' && event.name === SignetEventName.SignBidirectionalEvent) {
      transaction.notifications.push(event)
    }
  }
  return [...transactions.values()]
}

/**
 * The row of each transaction. One that emitted a sign bidirectional event carries its bytes and
 * its inspection.
 *
 * @throws When the source cannot serve the bytes of a transaction to inspect.
 */
async function inspectedTransactionRows(
  transactions: readonly RangeTransaction[],
  source: MidnightSource,
  inspect: InspectTransaction,
): Promise<TransactionRow[]> {
  const rows = new Map<string, TransactionRow>()
  for (const transaction of transactions) {
    rows.set(transaction.hash, {
      hash: bytesOfHex(transaction.hash),
      block_height: transaction.blockHeight,
      block_hash: bytesOfHex(transaction.blockHash),
      block_time: transaction.blockTime,
      raw: null,
      inspection: null,
    })
  }
  await forEachAtMost(
    transactions.filter((transaction) => transaction.notifications.length > 0),
    RAW_TRANSACTION_FETCHES_AT_ONCE,
    async (transaction) => {
      const raw = await source.rawTransaction(transaction.hash)
      const row = rows.get(transaction.hash)
      if (row !== undefined) {
        row.raw = bytesOfHex(raw)
        row.inspection = storedInspectionJson(inspect, raw, transaction.notifications)
      }
    },
  )
  return [...rows.values()]
}

/**
 * The inspection of a transaction as the JSON its row holds. A throw, a result that does not
 * serialise, one holding a character PostgreSQL refuses and one the wire's schemas reject are each
 * the failed inspection of the whole transaction.
 */
function storedInspectionJson(
  inspect: InspectTransaction,
  rawTransactionHex: string,
  notifications: readonly SignBidirectionalNotificationEvent[],
): string {
  const failed = (reason: unknown): string =>
    JSON.stringify({ failed: recordedErrorText(reason) } satisfies StoredInspection)
  try {
    const inspection = inspect(rawTransactionHex, notifications)
    if ('failed' in inspection) {
      return failed(inspection.failed)
    }
    const json = JSON.stringify(inspection)
    if (jsonHoldsRefusedCharacter(json)) {
      return failed('the inspection holds a character PostgreSQL refuses')
    }
    if (jsonNestingDepth(json) > STORED_INSPECTION_MAX_DEPTH) {
      return failed(
        `the inspection nests deeper than ${String(STORED_INSPECTION_MAX_DEPTH)} levels`,
      )
    }
    const stored = storedInspectionSchema.safeParse(JSON.parse(json))
    if (!stored.success) {
      return failed(`the wire rejects the inspection: ${z.prettifyError(stored.error)}`)
    }
    if ('failed' in stored.data) {
      return failed(stored.data.failed)
    }
    const requests = Object.fromEntries(
      Object.entries(stored.data.requests).map(([eventId, request]) => [
        eventId,
        'failed' in request ? { failed: recordedErrorText(request.failed) } : request,
      ]),
    )
    return JSON.stringify({ ...stored.data, requests } satisfies StoredInspection)
  } catch (error) {
    return failed(error)
  }
}

/** Whether a string or a key of the value `json` serialises holds U+0000 or an unpaired surrogate. */
function jsonHoldsRefusedCharacter(json: string): boolean {
  for (const escape of json.matchAll(JSON_ESCAPES)) {
    if (escape[1] !== undefined) {
      return true
    }
  }
  return false
}

/** How deep the arrays and objects of the value `json` serialises nest. */
function jsonNestingDepth(json: string): number {
  let depth = 0
  let deepest = 0
  let inString = false
  for (let index = 0; index < json.length; index += 1) {
    const character = json.charAt(index)
    if (inString) {
      if (character === '\\') {
        index += 1
      } else if (character === '"') {
        inString = false
      }
    } else if (character === '"') {
      inString = true
    } else if (character === '{' || character === '[') {
      depth += 1
      deepest = Math.max(deepest, depth)
    } else if (character === '}' || character === ']') {
      depth -= 1
    }
  }
  return deepest
}

/**
 * Moves the cursor to `toBlock` when the row still holds the cursor and the identity of `read`. It
 * is the first statement of the storing transaction: the row lock it takes makes a second cycle
 * from the same cursor wait for this one's commit and then change no row.
 *
 * @throws {CursorSuperseded} When the row holds another cursor or another identity.
 */
async function moveCursor(
  transaction: NetworkDatabase,
  read: IngestState,
  toBlock: number,
  cursorBlock: SourceBlockId,
  tip: SourceBlock,
  settings: IngestCycleSettings,
): Promise<void> {
  const moved = await transaction
    .updateTable('ingest_state')
    .set({
      cursor_height: toBlock,
      cursor_hash: bytesOfHex(cursorBlock.hash),
      cursor_block_time: cursorBlock.time,
      tip_height: tip.height,
      last_success_at: new Date(),
      last_error: null,
      state: toBlock === tip.height - settings.tipMargin ? 'synced' : 'syncing',
    })
    .where('cursor_height', 'is not distinct from', read.cursor_height)
    .where('genesis_hash', '=', read.genesis_hash)
    .where('signer_address', '=', read.signer_address)
    .where('responder_address', '=', read.responder_address)
    .where('start_block', '=', read.start_block)
    .executeTakeFirst()
  if (moved.numUpdatedRows === 0n) {
    throw new CursorSuperseded()
  }
}

/**
 * Inserts the transactions and the events of a range, then brings the request rows and the callers
 * of every request id those events declare in line with all its stored events.
 */
async function storeRange(
  transaction: NetworkDatabase,
  transactionRows: readonly TransactionRow[],
  events: readonly SignetContractEvent[],
): Promise<void> {
  for (const rows of chunksOf(transactionRows, ROWS_PER_STATEMENT)) {
    await transaction.insertInto('transactions').values(rows).execute()
  }
  for (const rows of chunksOf(events.map(eventRowOf), ROWS_PER_STATEMENT)) {
    await transaction.insertInto('events').values(rows).execute()
  }

  const requestIds = new Set<string>()
  const callers = new Map<string, { request_id: string; caller: string }>()
  for (const event of events) {
    if (event.kind !== 'decoded') {
      continue
    }
    requestIds.add(event.requestId)
    if (event.name === SignetEventName.SignBidirectionalEvent) {
      const caller = event.record.callerAddress
      callers.set(`${event.requestId} ${caller}`, { request_id: event.requestId, caller })
    }
  }
  for (const ids of chunksOf([...requestIds], ROWS_PER_STATEMENT)) {
    await recomputeRequests(transaction, ids)
  }
  for (const rows of chunksOf([...callers.values()], ROWS_PER_STATEMENT)) {
    await transaction
      .insertInto('request_callers')
      .values(rows)
      .onConflict((conflict) => conflict.doNothing())
      .execute()
  }
}

function eventRowOf(event: SignetContractEvent): EventRow {
  const { source } = event
  return {
    id: source.id,
    transaction_hash: bytesOfHex(source.transactionHash),
    contract_roles: [...event.roles],
    name: storableText(source.name),
    payload: Buffer.from(source.payload),
    request_id: event.kind === 'decoded' ? event.requestId : null,
    decode_failure: event.kind === 'undecodable' ? recordedErrorText(event.reason) : null,
  }
}

/** Writes the `requests` row of each id from every stored event that declares it. */
async function recomputeRequests(
  transaction: NetworkDatabase,
  requestIds: readonly string[],
): Promise<void> {
  await transaction
    .insertInto('requests')
    .columns([
      'request_id',
      'first_event_id',
      'first_requested_at',
      'first_signature_at',
      'first_response_at',
      'sign_bidirectional_count',
      'signature_responded_count',
      'respond_bidirectional_count',
    ])
    .expression((expression) =>
      expression
        .selectFrom('events as e')
        .innerJoin('transactions as t', 't.hash', 'e.transaction_hash')
        .where('e.request_id', 'in', requestIds)
        .groupBy('e.request_id')
        .select(({ fn }) => {
          const firstTimeOf = (name: SignetEventName) =>
            fn.min('t.block_time').filterWhere('e.name', '=', name)
          const countOf = (name: SignetEventName) =>
            fn.countAll<number>().filterWhere('e.name', '=', name)
          return [
            'e.request_id',
            fn.min('e.id').as('first_event_id'),
            firstTimeOf(SignetEventName.SignBidirectionalEvent).as('first_requested_at'),
            firstTimeOf(SignetEventName.SignatureRespondedEvent).as('first_signature_at'),
            firstTimeOf(SignetEventName.RespondBidirectionalEvent).as('first_response_at'),
            countOf(SignetEventName.SignBidirectionalEvent).as('sign_bidirectional_count'),
            countOf(SignetEventName.SignatureRespondedEvent).as('signature_responded_count'),
            countOf(SignetEventName.RespondBidirectionalEvent).as('respond_bidirectional_count'),
          ]
        }),
    )
    .onConflict((conflict) =>
      conflict.column('request_id').doUpdateSet((update) => ({
        first_event_id: update.ref('excluded.first_event_id'),
        first_requested_at: update.ref('excluded.first_requested_at'),
        first_signature_at: update.ref('excluded.first_signature_at'),
        first_response_at: update.ref('excluded.first_response_at'),
        sign_bidirectional_count: update.ref('excluded.sign_bidirectional_count'),
        signature_responded_count: update.ref('excluded.signature_responded_count'),
        respond_bidirectional_count: update.ref('excluded.respond_bidirectional_count'),
      })),
    )
    .execute()
}

/** Runs `work` on each item, at most `limit` at a time, and starts none after one has failed. */
async function forEachAtMost<T>(
  items: readonly T[],
  limit: number,
  work: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0
  let failed = false
  const worker = async (): Promise<void> => {
    while (!failed) {
      const item = items[next]
      if (item === undefined) {
        return
      }
      next += 1
      try {
        await work(item)
      } catch (error) {
        failed = true
        throw error
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

function chunksOf<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let start = 0; start < items.length; start += size) {
    chunks.push(items.slice(start, start + size))
  }
  return chunks
}

function bytesOfHex(hex: string): Buffer {
  return Buffer.from(hex, 'hex')
}

/**
 * The text of a caught error or of a failure reason as the database may hold it: with no character
 * PostgreSQL refuses, with no URL credential, and bounded. URLs are cut from no more of the text
 * than fills the bound.
 */
export function recordedErrorText(error: unknown): string {
  let recorded = ''
  // A URL holds no white space, so cutting run by run gives the text that cutting the whole gives.
  for (const [run] of storableText(textOf(error)).matchAll(/\s+|\S+/g)) {
    recorded += textWithoutUrlCredentials(run)
    if (recorded.length >= RECORDED_ERROR_MAX_LENGTH) {
      break
    }
  }
  // The bound may split a surrogate pair, which leaves an unpaired surrogate.
  return storableText(recorded.slice(0, RECORDED_ERROR_MAX_LENGTH))
}

function textOf(error: unknown): string {
  try {
    const text: unknown = error instanceof Error ? error.message : error
    return typeof text === 'string' ? text : String(text)
  } catch {
    return 'a thrown value that has no text'
  }
}

/** `text` without the characters PostgreSQL refuses. */
function storableText(text: string): string {
  return text.replace(REFUSED_CHARACTERS, '')
}
